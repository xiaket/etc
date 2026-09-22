import { describe, expect, it } from 'vitest'
import { foldTranscript, type TranscriptEntry } from '../src/client/transcript.ts'

let seq = 0
const ev = (type: string, data: unknown, kind: 'event' | 'transient' = 'event'): TranscriptEntry => ({
  type: kind, event: { type, seq: ++seq, time: seq * 10, data },
})
const user = (text: string, source: unknown = { kind: 'user' }) => ev('user/message', { content: [{ type: 'text', text }], source })
const assistant = (content: unknown[]) => ev('assistant/message', { message: { content } })
const chunk = (attemptId: string, text: string) => ev('assistant/live-chunk', { attemptId, chunk: { type: 'text-delta', text } }, 'transient')
const result = (toolCallId: string, text: string, isError = false) =>
  ev('tool/result', { message: { content: [{ type: 'tool-result', toolCallId, isError, content: [{ type: 'text', text }] }] } })

describe('foldTranscript', () => {
  it('renders user text, assistant markdown, and drops empty or non-text rows', () => {
    const { items } = foldTranscript([
      user('hi'),
      assistant([{ type: 'text', text: 'hello **there**' }]),
      ev('turn/end', { turn: 1 }),
      assistant([{ type: 'reasoning', text: 'thinking' }]),
    ])
    expect(items.map(i => i.kind)).toEqual(['user', 'assistant'])
    expect(items[1]).toMatchObject({ text: 'hello **there**', streaming: false })
  })

  it('accumulates live chunks into one streaming row and replaces it on settlement', () => {
    const entries = [user('go'), chunk('a1', 'Wor'), chunk('a1', 'king…')]
    const live = foldTranscript(entries)
    expect(live.items[1]).toMatchObject({ kind: 'assistant', text: 'Working…', streaming: true })
    const settled = foldTranscript([...entries, assistant([{ type: 'text', text: 'Done.' }])])
    expect(settled.items.map(i => i.kind)).toEqual(['user', 'assistant'])
    expect(settled.items[1]).toMatchObject({ text: 'Done.', streaming: false })
  })

  it('turns a baton_dispatch call into a task card and reads the task id from its result', () => {
    const { items } = foldTranscript([
      assistant([
        { type: 'text', text: 'On it.' },
        { type: 'tool-call', id: 'c1', name: 'baton_dispatch', arguments: JSON.stringify({ title: 'Fix retries', workspaceId: 'ws-1' }) },
      ]),
      result('c1', '已分派任务 bt-abc123-x9y8z7 [running]，运行于独立 worktree。'),
    ])
    expect(items).toHaveLength(2)
    expect(items[1]).toMatchObject({ kind: 'dispatch', title: 'Fix retries', workspaceId: 'ws-1', taskId: 'bt-abc123-x9y8z7', failed: false })
  })

  it('marks a failed dispatch and a failed tool row', () => {
    const { items } = foldTranscript([
      assistant([
        { type: 'tool-call', id: 'c1', name: 'baton_dispatch', arguments: '{"title":"T","workspaceId":"w"}' },
        { type: 'tool-call', id: 'c2', name: 'bash', arguments: '{}' },
      ]),
      result('c1', 'dispatch failed: unknown workspace', true),
      result('c2', 'boom', true),
    ])
    expect(items[0]).toMatchObject({ kind: 'dispatch', failed: true, taskId: undefined })
    expect(items[1]).toMatchObject({ kind: 'tool', name: 'bash', failed: true })
  })

  it('shows [baton] plugin notices and hides other plugin messages', () => {
    const { items } = foldTranscript([
      user('[baton] 任务 bt-1「T」已完成', { kind: 'plugin', plugin: 'dsh-baton' }),
      user('framing text', { kind: 'plugin', plugin: 'other' }),
      user('Current runtime context…', { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt', form: 'snapshot' }),
      user('<system-reminder> skills…', { kind: 'skill-catalog', form: 'catalog' }),
    ])
    expect(items).toEqual([expect.objectContaining({ kind: 'notice', text: '[baton] 任务 bt-1「T」已完成' })])
  })

  it('keeps tool-call indices valid after a live row is removed', () => {
    const { items } = foldTranscript([
      chunk('a1', 'partial'),
      assistant([{ type: 'tool-call', id: 'c1', name: 'baton_status', arguments: '{}' }]),
      result('c1', 'ok'),
    ])
    expect(items).toEqual([expect.objectContaining({ kind: 'tool', name: 'baton_status', failed: false })])
  })
})
