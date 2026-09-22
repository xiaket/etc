/**
 * ExecutionEngine: creates worker sessions in target workspaces, tracks their
 * live state from host session events, and reports settlement.
 *
 * Worker sessions are created with `meta.cwd` only and never attached to a
 * Workspace record, so a worktree cwd is accepted as-is. When the worktree
 * pool has a warm worktree for the workspace root, the worker runs there
 * (`isolation: 'worktree'`); otherwise it runs in the workspace root itself
 * (`isolation: 'shared'`) and the task record says so.
 *
 * @module dsh-baton/host/execution
 */
import {
  canTransition,
  type PendingInput,
  type TaskRecord,
  type TaskStatus,
} from '../shared/protocol.ts'
import type { SettleOutcome } from '../shared/api.ts'
import { compose, type AgentPresetsFace } from './composition.ts'
import type { TaskStore } from './store.ts'

/** A user message as the agent runtime accepts it. */
export interface WorkerMessage {
  id: string
  role: 'user'
  content: Array<{ type: 'text'; text: string }>
  source: { kind: 'user' } | { kind: 'plugin'; plugin: string }
}

/** Narrow agents face. */
export interface AgentsFace {
  create(options: {
    sessionId: string
    meta?: { cwd?: string; agentPreset?: string }
    agentOptions?: { provider?: string; model?: string }
    setup?: (agentCtx: unknown) => Promise<void> | void
  }): Promise<AgentHandleFace>
}

/** The live agent handle slice the engine drives. */
export interface AgentHandleFace {
  agent: {
    followup(message: WorkerMessage): void
    inject(message: WorkerMessage): void
    whenIdle(): Promise<void>
  }
  dispose(): Promise<void>
}

/** Narrow workspace face. */
export interface WorkspaceFace {
  get(id: string): { id: string; path: string; title: string } | undefined
  list(): Array<{ id: string; path: string; title: string }>
}

/** Narrow worktree-pool face (dsh-worktree-pool `acquire`). */
export interface WorktreePoolFace {
  acquire(repoRoot: string, sessionId: string): Promise<
    | { outcome: 'hit'; record: { path: string } }
    | { outcome: 'miss'; reason: string; detail: string }
  >
}

/** A host session event as the engine reads it. */
export interface WorkerEvent {
  type: string
  data?: unknown
}

/** Narrow event-bus face for worker observation. */
export interface EventsFace {
  onSessionEvent(listener: (sessionId: string, event: WorkerEvent) => void): () => void
}

/** Settlement sink. */
export interface SettleFace {
  onSettled(task: TaskRecord, outcome: SettleOutcome): void
}

/** Model used for worker sessions. */
export interface WorkerModel {
  provider: string
  model: string
}

/** Everything the engine needs. */
export interface ExecutionDeps {
  store: TaskStore
  agents: AgentsFace
  workspaces: WorkspaceFace
  events: EventsFace
  settle: SettleFace
  /** Unset follows the deployment default. */
  workerModel?: WorkerModel
  /** Extra lines appended to every worker's framing (environment facts such as available CLIs). */
  workerNotes: readonly string[]
  /** Agent presets service; undefined when the deployment mounts none. */
  presets: AgentPresetsFace | undefined
  /** Preset id workers mount; undefined selects the deployment default. */
  workerPreset: string | undefined
  worktreePool?: WorktreePoolFace | undefined
  now: () => number
  /** Maximum characters kept from the worker's last assistant text. */
  summaryLimit?: number
}

/** One live execution. */
interface RunEntry {
  sessionId: string
  taskId: string
  handle: AgentHandleFace
  /** Last assistant text seen on this worker. */
  lastAssistantText: string | undefined
  /** Open approval ids and pending ask_user_question call ids. */
  openApprovals: Set<string>
  openQuestions: Set<string>
}

const DEFAULT_SUMMARY_LIMIT = 500
const ERROR_LIMIT = 500
const ASK_USER_TOOL = 'ask_user_question'

/** Text of an assistant message payload, or undefined. */
function assistantText(data: unknown): string | undefined {
  const message = (data as { message?: { content?: unknown } } | undefined)?.message
  const content = message?.content
  if (!Array.isArray(content)) return undefined
  const parts = content
    .filter((part): part is { type: 'text'; text: string } =>
      typeof part === 'object' && part !== null
      && (part as { type?: unknown }).type === 'text'
      && typeof (part as { text?: unknown }).text === 'string')
    .map(part => part.text)
  const text = parts.join('\n').trim()
  return text.length > 0 ? text : undefined
}

/** Whether a turn/end payload closed with an error. */
function turnEndError(data: unknown): string | undefined {
  const reason = (data as { reason?: { kind?: unknown; error?: { message?: unknown } } } | undefined)?.reason
  if (reason?.kind !== 'error') return undefined
  const message = reason.error?.message
  return typeof message === 'string' ? message : 'turn failed'
}

/**
 * Worker lifecycle owner.
 */
export class ExecutionEngine {
  private readonly runs = new Map<string, RunEntry>()
  private readonly bySession = new Map<string, RunEntry>()
  private readonly unsubscribe: () => void
  private readonly summaryLimit: number

  constructor(private readonly deps: ExecutionDeps) {
    this.summaryLimit = deps.summaryLimit ?? DEFAULT_SUMMARY_LIMIT
    this.unsubscribe = deps.events.onSessionEvent((sessionId, event) => {
      const run = this.bySession.get(sessionId)
      if (run !== undefined) this.observe(run, event)
    })
  }

  dispose(): void {
    this.unsubscribe()
  }

  /**
   * Mark every task the ledger believes live as failed: this host has no
   * agent for it, so it cannot be running.
   */
  async reconcileAfterRestart(): Promise<void> {
    const now = this.deps.now()
    await this.deps.store.mutate('restart-reconcile', (ledger) => {
      const touched: TaskRecord[] = []
      for (const task of ledger.tasks) {
        if (task.status !== 'running' && task.status !== 'needs_input' && task.status !== 'pending') continue
        task.status = 'failed'
        task.error = 'host restarted while the task was running'
        delete task.pendingInput
        task.settledAt = now
        task.updatedAt = now
        touched.push(task)
      }
      return touched.length > 0 ? touched : undefined
    })
  }

  /**
   * Dispatch a task: claim a worktree when one is warm, create the worker
   * session, inject the framing, send the task prompt, and watch for settlement.
   * @param task - a `pending` record already in the ledger.
   * @returns the worker session id, or the reason dispatch failed.
   */
  async dispatch(task: TaskRecord): Promise<{ sessionId: string } | { error: string }> {
    const workspace = this.deps.workspaces.get(task.workspaceId)
    if (workspace === undefined) {
      const error = `unknown workspace ${task.workspaceId}`
      await this.markFailed(task.id, error)
      return { error }
    }

    const sessionId = `session-baton-${crypto.randomUUID()}`
    let cwd = workspace.path
    let isolation: TaskRecord['isolation'] = 'shared'
    if (this.deps.worktreePool !== undefined) {
      try {
        const result = await this.deps.worktreePool.acquire(workspace.path, sessionId)
        if (result.outcome === 'hit') {
          cwd = result.record.path
          isolation = 'worktree'
        }
      } catch (error) {
        console.error('[dsh-baton] worktree acquire failed, running in the workspace root:', error)
      }
    }

    let handle: AgentHandleFace
    try {
      const composition = await compose(this.deps.presets, this.deps.workerPreset)
      handle = await this.deps.agents.create({
        sessionId,
        meta: { cwd, ...(composition.agentPreset === undefined ? {} : { agentPreset: composition.agentPreset }) },
        ...(this.deps.workerModel === undefined
          ? {}
          : { agentOptions: { provider: this.deps.workerModel.provider, model: this.deps.workerModel.model } }),
        setup: composition.setup,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.markFailed(task.id, message)
      return { error: message }
    }

    const now = this.deps.now()
    await this.deps.store.mutate('task-dispatched', (ledger) => {
      const t = ledger.tasks.find(r => r.id === task.id)
      if (t === undefined || !canTransition(t.status, 'running')) return undefined
      t.status = 'running'
      t.sessionId = sessionId
      t.isolation = isolation
      if (isolation === 'worktree') t.worktreePath = cwd
      else delete t.worktreePath
      delete t.error
      delete t.pendingInput
      t.startedAt = now
      t.updatedAt = now
      t.lastActivityAt = now
      return [t]
    })

    const run: RunEntry = {
      sessionId, taskId: task.id, handle,
      lastAssistantText: undefined,
      openApprovals: new Set(), openQuestions: new Set(),
    }
    this.runs.set(task.id, run)
    this.bySession.set(sessionId, run)

    handle.agent.inject(this.message(this.framing(task, isolation, cwd), { kind: 'plugin', plugin: 'dsh-baton' }))
    handle.agent.followup(this.message(task.description || task.title, { kind: 'user' }))
    this.watch(run)
    return { sessionId }
  }

  /**
   * Send a follow-up instruction to a task's worker. A `failed` or
   * `in_review` worker whose handle is still held returns to `running`.
   * @param taskId - task id.
   * @param instruction - the user's instruction.
   */
  async followUp(taskId: string, instruction: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const run = this.runs.get(taskId)
    if (run === undefined) {
      return { ok: false, error: `task ${taskId} has no live worker session; dispatch a new task instead` }
    }
    const now = this.deps.now()
    let accepted = false
    await this.deps.store.mutate('task-follow-up', (ledger) => {
      const t = ledger.tasks.find(r => r.id === taskId)
      if (t === undefined) return undefined
      if (t.status !== 'running' && !canTransition(t.status, 'running')) return undefined
      accepted = true
      t.status = 'running'
      delete t.pendingInput
      delete t.error
      t.updatedAt = now
      t.lastActivityAt = now
      return [t]
    })
    if (!accepted) return { ok: false, error: `task ${taskId} cannot accept a follow-up in its current state` }
    run.handle.agent.followup(this.message(instruction, { kind: 'user' }))
    this.watch(run)
    return { ok: true }
  }

  /**
   * Cancel a task. A live worker is disposed; a non-live task only changes status.
   * @param taskId - task id.
   */
  async cancel(taskId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const run = this.runs.get(taskId)
    if (run !== undefined) {
      this.forget(run)
      try { await run.handle.dispose() } catch { /* already gone */ }
    }
    let ok = false
    const now = this.deps.now()
    await this.deps.store.mutate('task-cancelled', (ledger) => {
      const t = ledger.tasks.find(r => r.id === taskId)
      if (t === undefined || !canTransition(t.status, 'cancelled')) return undefined
      ok = true
      t.status = 'cancelled'
      delete t.pendingInput
      t.updatedAt = now
      return [t]
    })
    return ok ? { ok: true } : { ok: false, error: `task ${taskId} cannot be cancelled in its current state` }
  }

  /**
   * The user confirmed an `in_review` result. The worker handle is released.
   * @param taskId - task id.
   */
  async acknowledge(taskId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    let ok = false
    const now = this.deps.now()
    await this.deps.store.mutate('task-acknowledged', (ledger) => {
      const t = ledger.tasks.find(r => r.id === taskId)
      if (t === undefined || !canTransition(t.status, 'completed')) return undefined
      ok = true
      t.status = 'completed'
      t.completedAt = now
      t.updatedAt = now
      return [t]
    })
    if (!ok) return { ok: false, error: `task ${taskId} is not awaiting review` }
    const run = this.runs.get(taskId)
    if (run !== undefined) {
      this.forget(run)
      try { await run.handle.dispose() } catch { /* already gone */ }
    }
    return { ok: true }
  }

  /** @returns how many workers are live. */
  inFlight(): number {
    return this.runs.size
  }

  /** Dispose every live worker handle. */
  async disposeAll(): Promise<void> {
    const runs = [...this.runs.values()]
    this.runs.clear()
    this.bySession.clear()
    await Promise.allSettled(runs.map(run => run.handle.dispose()))
  }

  // ---------------------------------------------------------------- internals

  private message(text: string, source: WorkerMessage['source']): WorkerMessage {
    return {
      id: `msg-baton-${crypto.randomUUID()}`,
      role: 'user',
      content: [{ type: 'text', text }],
      source,
    }
  }

  private framing(task: TaskRecord, isolation: TaskRecord['isolation'], cwd: string): string {
    const where = isolation === 'worktree'
      ? `你在一个独立的 git worktree 中工作（${cwd}），可以自由修改文件；完成后不要 merge，留给用户审阅。`
      : `你直接在仓库根目录工作（${cwd}），没有 worktree 隔离，改动会直接落在主 checkout 上，请谨慎。`
    const notes = this.deps.workerNotes.map(note => `${note}\n`).join('')
    return `【baton 任务】${task.title}（ID: ${task.id}）\n`
      + '本会话由 baton 任务编排器启动。\n'
      + `${where}\n`
      + notes
      + '完成后用一段简短的文字总结结果并正常结束；如果无法完成，说明原因。'
  }

  private watch(run: RunEntry): void {
    void run.handle.agent.whenIdle().then(
      () => { void this.settle(run, 'in_review') },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : 'worker did not reach quiescence'
        void this.settle(run, 'failed', message)
      },
    )
  }

  private forget(run: RunEntry): void {
    this.runs.delete(run.taskId)
    this.bySession.delete(run.sessionId)
  }

  private observe(run: RunEntry, event: WorkerEvent): void {
    const now = this.deps.now()
    switch (event.type) {
      case 'assistant/message': {
        const text = assistantText(event.data)
        if (text !== undefined) run.lastAssistantText = text
        void this.touch(run.taskId, now)
        return
      }
      case 'approval/asked': {
        const id = (event.data as { id?: unknown } | undefined)?.id
        if (typeof id === 'string') run.openApprovals.add(id)
        void this.setPending(run, { kind: 'approval', since: now })
        return
      }
      case 'approval/decided': {
        const id = (event.data as { id?: unknown } | undefined)?.id
        if (typeof id === 'string') run.openApprovals.delete(id)
        void this.clearPendingIfIdle(run, now)
        return
      }
      case 'tool/call': {
        const data = event.data as { name?: unknown; callId?: unknown } | undefined
        if (data?.name === ASK_USER_TOOL && typeof data.callId === 'string') {
          run.openQuestions.add(data.callId)
          void this.setPending(run, { kind: 'question', since: now })
        }
        return
      }
      case 'tool/result': {
        const content = (event.data as { message?: { content?: unknown } } | undefined)?.message?.content
        if (!Array.isArray(content)) return
        let closed = false
        for (const block of content as Array<{ type?: unknown; toolCallId?: unknown }>) {
          if (block?.type === 'tool-result' && typeof block.toolCallId === 'string' && run.openQuestions.delete(block.toolCallId)) {
            closed = true
          }
        }
        if (closed) void this.clearPendingIfIdle(run, now)
        return
      }
      case 'turn/end': {
        const failure = turnEndError(event.data)
        if (failure !== undefined) void this.settle(run, 'failed', failure)
        return
      }
      default:
        return
    }
  }

  private async touch(taskId: string, now: number): Promise<void> {
    await this.deps.store.mutate('task-activity', (ledger) => {
      const t = ledger.tasks.find(r => r.id === taskId)
      if (t === undefined || (t.status !== 'running' && t.status !== 'needs_input')) return undefined
      t.lastActivityAt = now
      return [t]
    })
  }

  private async setPending(run: RunEntry, pending: PendingInput): Promise<void> {
    await this.deps.store.mutate('task-needs-input', (ledger) => {
      const t = ledger.tasks.find(r => r.id === run.taskId)
      if (t === undefined) return undefined
      if (t.status !== 'needs_input' && !canTransition(t.status, 'needs_input')) return undefined
      t.status = 'needs_input'
      t.pendingInput = t.pendingInput ?? pending
      t.updatedAt = pending.since
      t.lastActivityAt = pending.since
      return [t]
    })
  }

  private async clearPendingIfIdle(run: RunEntry, now: number): Promise<void> {
    if (run.openApprovals.size > 0 || run.openQuestions.size > 0) return
    await this.deps.store.mutate('task-input-received', (ledger) => {
      const t = ledger.tasks.find(r => r.id === run.taskId)
      if (t === undefined || t.status !== 'needs_input') return undefined
      t.status = 'running'
      delete t.pendingInput
      t.updatedAt = now
      t.lastActivityAt = now
      return [t]
    })
  }

  private async settle(run: RunEntry, outcome: SettleOutcome, error?: string): Promise<void> {
    // A run that already settled or was cancelled/acknowledged is no longer tracked.
    if (this.runs.get(run.taskId) !== run) return
    const target: TaskStatus = outcome
    const now = this.deps.now()
    let settled: TaskRecord | undefined
    await this.deps.store.mutate(`task-${outcome}`, (ledger) => {
      const t = ledger.tasks.find(r => r.id === run.taskId)
      if (t === undefined || !canTransition(t.status, target)) return undefined
      t.status = target
      delete t.pendingInput
      if (run.lastAssistantText !== undefined) t.resultSummary = run.lastAssistantText.slice(0, this.summaryLimit)
      if (error !== undefined) t.error = error.slice(0, ERROR_LIMIT)
      t.settledAt = now
      t.updatedAt = now
      t.lastActivityAt = now
      settled = t
      return [t]
    })
    if (settled === undefined) return
    // The handle stays held after settlement so a follow-up can revive the
    // worker; it is released on cancel, acknowledge, or host teardown.
    this.deps.settle.onSettled(settled, outcome)
  }

  /** Dispatch never reached a live worker. */
  private async markFailed(taskId: string, error: string): Promise<void> {
    const now = this.deps.now()
    let task: TaskRecord | undefined
    await this.deps.store.mutate('task-failed', (ledger) => {
      const t = ledger.tasks.find(r => r.id === taskId)
      if (t === undefined || !canTransition(t.status, 'failed')) return undefined
      t.status = 'failed'
      t.error = error.slice(0, ERROR_LIMIT)
      t.settledAt = now
      t.updatedAt = now
      task = t
      return [t]
    })
    if (task !== undefined) this.deps.settle.onSettled(task, 'failed')
  }
}
