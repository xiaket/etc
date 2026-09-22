/**
 * Browser-side mirror of the host's baton state, fed by `GET /state` and the
 * SSE stream. React-free; the panel reads it through an injected hook.
 *
 * @module dsh-baton/client/feed
 */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { ROUTE_PREFIX, SSE_PATH, type ApiResult, type CommanderResponse, type SettleOutcome, type SseEvent, type StateResponse } from '../shared/api.ts'
import type { TaskSummary } from '../shared/protocol.ts'

/** Connection to the host's baton routes. */
export type FeedConnection = 'connecting' | 'live' | 'reconnecting'

/** What the panel renders from. */
export interface BatonState {
  readonly connection: FeedConnection
  readonly revision: number
  readonly tasks: readonly TaskSummary[]
  readonly workspaceMap: StateResponse['workspaceMap']
  readonly commanderSessionId: string | null
  /** Last host error surfaced by a verb; cleared by the next success. */
  readonly lastError: string | null
}

/** A settlement the panel should announce. */
export interface SettledNotice {
  readonly id: string
  readonly task: TaskSummary
  readonly outcome: SettleOutcome
  readonly at: number
}

const EMPTY: BatonState = {
  connection: 'connecting', revision: -1, tasks: [], workspaceMap: {}, commanderSessionId: null, lastError: null,
}

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

/** Fetch face, injectable for tests. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** EventSource constructor face, injectable for tests. */
export type EventSourceLike = new (url: string) => {
  addEventListener(type: string, listener: (event: { data: string }) => void): void
  onerror: ((event: unknown) => void) | null
  onopen: ((event: unknown) => void) | null
  close(): void
}

/** Dependencies of {@link BatonFeed}. */
export interface FeedDeps {
  fetch: FetchLike
  EventSource: EventSourceLike
  now: () => number
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

/**
 * Owns the SSE connection and the two stores the panel subscribes to.
 */
export class BatonFeed {
  readonly state: SnapshotStore<BatonState> = createSnapshotStore<BatonState>(EMPTY)
  readonly notices: SnapshotStore<readonly SettledNotice[]> = createSnapshotStore<readonly SettledNotice[]>([])
  private source: InstanceType<EventSourceLike> | undefined
  private retryHandle: unknown
  private attempt = 0
  private disposed = false

  constructor(private readonly deps: FeedDeps) {}

  /** Open the stream; reconnects with backoff until disposed. */
  start(): void {
    if (this.disposed) return
    void this.refresh()
    this.connect()
  }

  dispose(): void {
    this.disposed = true
    this.source?.close()
    this.source = undefined
    if (this.retryHandle !== undefined) this.deps.clearTimeout(this.retryHandle)
  }

  /** Re-pull the authoritative snapshot. */
  async refresh(): Promise<void> {
    const result = await this.get<StateResponse>('/state')
    if (result.ok) this.applyState(result.data)
  }

  /** Resume or create the commander. */
  async ensureCommander(): Promise<CommanderResponse> {
    const result = await this.post<CommanderResponse>('/commander')
    if (!result.ok) throw new Error(result.error)
    this.state.update(draft => { (draft as { commanderSessionId: string | null }).commanderSessionId = result.data.sessionId })
    return result.data
  }

  /** The user confirmed an in-review task. */
  async acknowledge(taskId: string): Promise<void> {
    await this.verb(`/tasks/${encodeURIComponent(taskId)}/ack`)
  }

  /** The user cancelled a task. */
  async cancelTask(taskId: string): Promise<void> {
    await this.verb(`/tasks/${encodeURIComponent(taskId)}/cancel`)
  }

  /** Drop one announced notice. */
  dismissNotice(id: string): void {
    this.notices.set(this.notices.getSnapshot().filter(notice => notice.id !== id))
  }

  private async verb(path: string): Promise<void> {
    const result = await this.post<Record<string, never>>(path)
    this.state.update(draft => { (draft as { lastError: string | null }).lastError = result.ok ? null : result.error })
  }

  private applyState(state: StateResponse): void {
    this.state.update(draft => {
      const d = draft as {
        revision: number; tasks: readonly TaskSummary[]; workspaceMap: StateResponse['workspaceMap']
        commanderSessionId: string | null; connection: FeedConnection
      }
      d.revision = state.revision
      d.tasks = state.tasks
      d.workspaceMap = state.workspaceMap
      d.commanderSessionId = state.commander.sessionId
      d.connection = 'live'
    })
  }

  private connect(): void {
    if (this.disposed) return
    const source = new this.deps.EventSource(SSE_PATH)
    this.source = source
    source.onopen = () => { this.attempt = 0 }
    source.addEventListener('state', event => {
      const parsed = this.parse(event.data)
      if (parsed?.type === 'state') this.applyState(parsed.state)
    })
    source.addEventListener('task-settled', event => {
      const parsed = this.parse(event.data)
      if (parsed?.type !== 'task-settled') return
      const notice: SettledNotice = {
        id: `${parsed.task.id}:${this.deps.now()}`,
        task: parsed.task,
        outcome: parsed.outcome,
        at: this.deps.now(),
      }
      this.notices.set([...this.notices.getSnapshot(), notice])
    })
    source.onerror = () => {
      source.close()
      if (this.source !== source || this.disposed) return
      this.source = undefined
      this.state.update(draft => { (draft as { connection: FeedConnection }).connection = 'reconnecting' })
      const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.attempt)
      this.attempt += 1
      this.retryHandle = this.deps.setTimeout(() => {
        this.retryHandle = undefined
        void this.refresh()
        this.connect()
      }, delay)
    }
  }

  private parse(data: string): SseEvent | undefined {
    try {
      return JSON.parse(data) as SseEvent
    } catch {
      return undefined
    }
  }

  private async get<T>(path: string): Promise<ApiResult<T>> {
    return this.request<T>(path, { method: 'GET' })
  }

  private async post<T>(path: string): Promise<ApiResult<T>> {
    return this.request<T>(path, { method: 'POST' })
  }

  private async request<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
    try {
      const response = await this.deps.fetch(`${ROUTE_PREFIX}${path}`, init)
      const body = await response.json() as ApiResult<T>
      if (typeof body !== 'object' || body === null || typeof (body as { ok?: unknown }).ok !== 'boolean') {
        return { ok: false, error: `malformed response from ${path}` }
      }
      return body
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

/** @returns a feed bound to the browser's fetch, EventSource, and timers. */
export function browserFeed(): BatonFeed {
  return new BatonFeed({
    fetch: (input, init) => fetch(input, init),
    EventSource: EventSource as unknown as EventSourceLike,
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  })
}
