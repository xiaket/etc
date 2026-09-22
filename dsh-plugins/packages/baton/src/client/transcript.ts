/**
 * Folds the commander session's event window into display entries. Pure over
 * `SessionEventLikeEntry` values, so the panel re-derives it with `useMemo`.
 *
 * Every `assistant/message` supersedes the transient live chunks of its
 * attempt; a live attempt with no settlement yet renders as a streaming
 * assistant entry. `baton_dispatch` calls become task cards keyed by the task
 * id read from the call result.
 *
 * @module dsh-baton/client/transcript
 */

/** Minimal event shape the folder reads; structurally matches SessionEventLike. */
export interface TranscriptEvent {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly data?: unknown
}

/** Minimal window entry shape; structurally matches SessionEventLikeEntry. */
export interface TranscriptEntry {
  readonly type: 'event' | 'transient'
  readonly event: TranscriptEvent
}

/** One rendered row. */
export type TranscriptItem =
  | { kind: 'user'; key: string; time: number; text: string }
  | { kind: 'assistant'; key: string; time: number; text: string; streaming: boolean }
  | { kind: 'dispatch'; key: string; time: number; taskId: string | undefined; title: string; workspaceId: string; failed: boolean }
  | { kind: 'tool'; key: string; time: number; name: string; failed: boolean }
  | { kind: 'notice'; key: string; time: number; text: string }

/** Folded transcript. */
export interface Transcript {
  readonly items: readonly TranscriptItem[]
}

const DISPATCH_TOOL = 'baton_dispatch'
const PLUGIN_NOTICE_PREFIX = '[baton]'
const BATON_PLUGIN = 'dsh-baton'

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: 'text'; text: string } =>
      typeof block === 'object' && block !== null
      && (block as { type?: unknown }).type === 'text'
      && typeof (block as { text?: unknown }).text === 'string')
    .map(block => block.text)
    .join('\n')
    .trim()
}

interface OpenCall { index: number; name: string; args: unknown }

/**
 * Fold a window into rows.
 * @param entries - the session's contiguous event window, oldest first.
 * @returns rows in display order.
 */
export function foldTranscript(entries: readonly TranscriptEntry[]): Transcript {
  const items: TranscriptItem[] = []
  const openCalls = new Map<string, OpenCall>()
  // Live text per attempt, cleared when the attempt settles.
  const live = new Map<string, { index: number; text: string }>()

  for (const entry of entries) {
    const event = entry.event
    const key = `${event.type}:${event.seq}`
    if (entry.type === 'transient') {
      const data = event.data as { attemptId?: string; chunk?: { type?: string; text?: string } } | undefined
      const attemptId = data?.attemptId ?? 'live'
      const chunk = data?.chunk
      if (chunk?.type !== 'text-delta' || typeof chunk.text !== 'string') continue
      const current = live.get(attemptId)
      if (current === undefined) {
        live.set(attemptId, { index: items.length, text: chunk.text })
        items.push({ kind: 'assistant', key: `live:${attemptId}`, time: event.time, text: chunk.text, streaming: true })
      } else {
        current.text += chunk.text
        const row = items[current.index]
        if (row?.kind === 'assistant') items[current.index] = { ...row, text: current.text }
      }
      continue
    }

    switch (event.type) {
      case 'user/message': {
        const data = event.data as { content?: unknown; source?: { kind?: string; plugin?: string } } | undefined
        const text = textOf(data?.content)
        if (text.length === 0) continue
        const source = data?.source
        if (source?.kind === 'user') {
          items.push({ kind: 'user', key, time: event.time, text })
        } else if (source?.kind === 'plugin' && source.plugin === BATON_PLUGIN && text.startsWith(PLUGIN_NOTICE_PREFIX)) {
          items.push({ kind: 'notice', key, time: event.time, text })
        }
        // Every other injected message (runtime-context snapshots, skill
        // catalogs, other plugins' framing) is model-facing only.
        continue
      }
      case 'assistant/message': {
        const data = event.data as { message?: { content?: unknown; attemptId?: string } } | undefined
        // A settled message supersedes every live row still open.
        for (const [attemptId, open] of live) {
          items.splice(open.index, 1)
          live.delete(attemptId)
          reindex(live, openCalls, open.index)
        }
        const content = data?.message?.content
        const text = textOf(content)
        if (text.length > 0) items.push({ kind: 'assistant', key, time: event.time, text, streaming: false })
        if (Array.isArray(content)) {
          for (const block of content as Array<{ type?: unknown; id?: unknown; name?: unknown; arguments?: unknown }>) {
            if (block?.type !== 'tool-call' || typeof block.id !== 'string' || typeof block.name !== 'string') continue
            let args: unknown
            try { args = typeof block.arguments === 'string' ? JSON.parse(block.arguments) : undefined } catch { args = undefined }
            openCalls.set(block.id, { index: items.length, name: block.name, args })
            items.push(block.name === DISPATCH_TOOL
              ? {
                kind: 'dispatch', key: `call:${block.id}`, time: event.time, taskId: undefined,
                title: stringField(args, 'title') ?? '', workspaceId: stringField(args, 'workspaceId') ?? '', failed: false,
              }
              : { kind: 'tool', key: `call:${block.id}`, time: event.time, name: block.name, failed: false })
          }
        }
        continue
      }
      case 'tool/result': {
        const data = event.data as { message?: { content?: unknown }; error?: unknown } | undefined
        const content = data?.message?.content
        if (!Array.isArray(content)) continue
        for (const block of content as Array<{ type?: unknown; toolCallId?: unknown; isError?: unknown; content?: unknown }>) {
          if (block?.type !== 'tool-result' || typeof block.toolCallId !== 'string') continue
          const open = openCalls.get(block.toolCallId)
          if (open === undefined) continue
          openCalls.delete(block.toolCallId)
          const row = items[open.index]
          const failed = block.isError === true || data?.error !== undefined
          if (row?.kind === 'dispatch') {
            items[open.index] = { ...row, failed, taskId: failed ? undefined : dispatchedTaskId(block.content) }
          } else if (row?.kind === 'tool') {
            items[open.index] = { ...row, failed }
          }
        }
        continue
      }
      default:
        continue
    }
  }
  return { items }
}

/** After removing the row at `removed`, shift every remembered index above it. */
function reindex(live: Map<string, { index: number }>, calls: Map<string, OpenCall>, removed: number): void {
  for (const open of live.values()) if (open.index > removed) open.index -= 1
  for (const open of calls.values()) if (open.index > removed) open.index -= 1
}

function stringField(args: unknown, field: string): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined
  const value = (args as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : undefined
}

/** Read `task.id` from a baton_dispatch result's text content. */
function dispatchedTaskId(content: unknown): string | undefined {
  const text = textOf(content)
  const match = /\b(bt-[a-z0-9]+-[a-z0-9]+)\b/.exec(text)
  return match?.[1]
}
