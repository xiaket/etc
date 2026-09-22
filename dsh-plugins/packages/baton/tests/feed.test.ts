import { describe, expect, it } from 'vitest'
import { BatonFeed, type EventSourceLike, type FeedDeps } from '../src/client/feed.ts'
import type { StateResponse } from '../src/shared/api.ts'
import { settle } from './support.ts'

class FakeSource {
  static instances: FakeSource[] = []
  listeners = new Map<string, (event: { data: string }) => void>()
  onerror: ((event: unknown) => void) | null = null
  onopen: ((event: unknown) => void) | null = null
  closed = false
  constructor(readonly url: string) { FakeSource.instances.push(this) }
  addEventListener(type: string, listener: (event: { data: string }) => void): void { this.listeners.set(type, listener) }
  close(): void { this.closed = true }
  emit(type: string, payload: unknown): void { this.listeners.get(type)?.({ data: JSON.stringify(payload) }) }
}

const state = (revision: number, commander: string | null = null): StateResponse => ({
  revision, tasks: [], workspaceMap: {}, commander: { sessionId: commander },
})

function harness(responses: Record<string, unknown>) {
  FakeSource.instances = []
  const calls: string[] = []
  const timers: Array<{ fn: () => void; ms: number }> = []
  const deps: FeedDeps = {
    fetch: async (input, init) => {
      calls.push(`${init?.method ?? 'GET'} ${input}`)
      const body = responses[input]
      return new Response(JSON.stringify(body ?? { ok: false, error: 'unrouted' }))
    },
    EventSource: FakeSource as unknown as EventSourceLike,
    now: () => 42,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length },
    clearTimeout: () => {},
  }
  return { feed: new BatonFeed(deps), calls, timers }
}

describe('BatonFeed', () => {
  it('pulls state on start and mirrors SSE state frames', async () => {
    const h = harness({ '/dsh-baton/state': { ok: true, data: state(1, 'session-c') } })
    h.feed.start()
    await settle()
    expect(h.feed.state.getSnapshot()).toMatchObject({ connection: 'live', revision: 1, commanderSessionId: 'session-c' })
    FakeSource.instances[0]!.emit('state', { type: 'state', state: state(2, 'session-c') })
    expect(h.feed.state.getSnapshot().revision).toBe(2)
  })

  it('queues a notice per settlement and lets the UI dismiss it', () => {
    const h = harness({})
    h.feed.start()
    const source = FakeSource.instances[0]!
    source.emit('task-settled', { type: 'task-settled', outcome: 'failed', task: { id: 'bt-1', title: 'T', status: 'failed' } })
    expect(h.feed.notices.getSnapshot()).toEqual([expect.objectContaining({ id: 'bt-1:42', outcome: 'failed' })])
    h.feed.dismissNotice('bt-1:42')
    expect(h.feed.notices.getSnapshot()).toEqual([])
  })

  it('reconnects with growing backoff and refreshes on reconnect', () => {
    const h = harness({})
    h.feed.start()
    const first = FakeSource.instances[0]!
    first.onerror?.({})
    expect(first.closed).toBe(true)
    expect(h.feed.state.getSnapshot().connection).toBe('reconnecting')
    expect(h.timers[0]?.ms).toBe(1_000)
    h.timers[0]!.fn()
    const second = FakeSource.instances[1]!
    second.onerror?.({})
    expect(h.timers[1]?.ms).toBe(2_000)
    expect(h.calls.filter(c => c.endsWith('/state')).length).toBe(2)
  })

  it('surfaces verb failures through lastError and clears them on success', async () => {
    const h = harness({
      '/dsh-baton/tasks/x/ack': { ok: false, error: 'not awaiting review' },
      '/dsh-baton/tasks/y/cancel': { ok: true, data: {} },
    })
    await h.feed.acknowledge('x')
    expect(h.feed.state.getSnapshot().lastError).toBe('not awaiting review')
    await h.feed.cancelTask('y')
    expect(h.feed.state.getSnapshot().lastError).toBeNull()
  })

  it('ensureCommander records the id and throws on failure', async () => {
    const h = harness({ '/dsh-baton/commander': { ok: true, data: { sessionId: 'session-c', created: true } } })
    await expect(h.feed.ensureCommander()).resolves.toEqual({ sessionId: 'session-c', created: true })
    expect(h.feed.state.getSnapshot().commanderSessionId).toBe('session-c')
    const failing = harness({ '/dsh-baton/commander': { ok: false, error: 'no agents' } })
    await expect(failing.feed.ensureCommander()).rejects.toThrow('no agents')
  })
})
