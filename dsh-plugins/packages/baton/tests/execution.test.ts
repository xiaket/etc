import { describe, expect, it, vi } from 'vitest'
import { ExecutionEngine, type AgentHandleFace, type ExecutionDeps, type WorkerEvent, type WorkerMessage } from '../src/host/execution.ts'
import type { SettleOutcome } from '../src/shared/api.ts'
import type { TaskRecord } from '../src/shared/protocol.ts'
import { deferred, pendingTask, settle, tempStore } from './support.ts'

interface FakeAgent {
  handle: AgentHandleFace
  sessionId: string
  idle: ReturnType<typeof deferred<void>>
  followups: WorkerMessage[]
  injected: WorkerMessage[]
  disposed: boolean
}

async function harness(options: { pool?: 'hit' | 'miss' | 'none'; createFails?: boolean; presets?: boolean } = {}) {
  const store = await tempStore()
  const agents: FakeAgent[] = []
  const mounted: Array<{ ctx: unknown; id: string | undefined }> = []
  const createOptions: Array<Parameters<ExecutionDeps['agents']['create']>[0]> = []
  const listeners = new Set<(sessionId: string, event: WorkerEvent) => void>()
  const settled: Array<{ task: TaskRecord; outcome: SettleOutcome }> = []
  let clock = 10_000
  const deps: ExecutionDeps = {
    store,
    agents: {
      create: async (opts) => {
        const { sessionId } = opts
        createOptions.push(opts)
        if (options.createFails) throw new Error('no model')
        const idle = deferred<void>()
        const fake: FakeAgent = {
          sessionId, idle, followups: [], injected: [], disposed: false,
          handle: {
            agent: {
              followup: message => { fake.followups.push(message) },
              inject: message => { fake.injected.push(message) },
              whenIdle: () => fake.idle.promise,
            },
            dispose: async () => { fake.disposed = true },
          },
        }
        agents.push(fake)
        return fake.handle
      },
    },
    workspaces: {
      get: id => id === 'ws-1' ? { id, path: '/repo/one', title: 'one' } : undefined,
      list: () => [{ id: 'ws-1', path: '/repo/one', title: 'one' }],
    },
    events: { onSessionEvent: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } },
    settle: { onSettled: (task, outcome) => { settled.push({ task: structuredClone(task), outcome }) } },
    workerModel: { provider: 'p', model: 'm' },
    workerNotes: ['gh 可用'],
    presets: options.presets === false ? undefined : {
      resolve: async id => ({ id: id ?? 'standard' }),
      mount: async (ctx, id) => { mounted.push({ ctx, id }) },
    },
    workerPreset: undefined,
    worktreePool: options.pool === 'none' || options.pool === undefined ? undefined : {
      acquire: async () => options.pool === 'hit'
        ? { outcome: 'hit' as const, record: { path: '/pool/wt-1' } }
        : { outcome: 'miss' as const, reason: 'pool-empty', detail: 'empty' },
    },
    now: () => clock,
  }
  const engine = new ExecutionEngine(deps)
  const emit = (sessionId: string, event: WorkerEvent): void => { for (const l of listeners) l(sessionId, event) }
  const add = async (id: string): Promise<TaskRecord> => {
    const task = pendingTask(id)
    await store.mutate('add', ledger => { ledger.tasks.push(task); return [task] })
    return task
  }
  return { store, engine, agents, emit, settled, add, mounted, createOptions, tick: (ms: number) => { clock += ms } }
}

describe('ExecutionEngine composition', () => {
  it('mounts the default agent preset on the worker and records its id', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const opts = h.createOptions[0]!
    expect(opts.meta?.agentPreset).toBe('standard')
    const scoped = { fake: 'agentCtx' }
    await opts.setup?.(scoped)
    expect(h.mounted).toEqual([{ ctx: scoped, id: 'standard' }])
  })

  it('creates a bare worker when the deployment has no presets service', async () => {
    const h = await harness({ presets: false })
    await h.engine.dispatch(await h.add('bt-1'))
    const opts = h.createOptions[0]!
    expect(opts.meta?.agentPreset).toBeUndefined()
    await opts.setup?.({})
    expect(h.mounted).toEqual([])
  })
})

describe('ExecutionEngine.dispatch', () => {
  it('runs in a warm worktree when the pool hits and records the isolation', async () => {
    const h = await harness({ pool: 'hit' })
    const task = await h.add('bt-1')
    const result = await h.engine.dispatch(task)
    expect('sessionId' in result).toBe(true)
    const stored = h.store.get('bt-1')
    expect(stored).toMatchObject({ status: 'running', isolation: 'worktree', worktreePath: '/pool/wt-1', startedAt: 10_000 })
    expect(h.agents[0]?.injected[0]?.content[0]?.text).toContain('/pool/wt-1')
    expect(h.agents[0]?.injected[0]?.content[0]?.text).toContain('gh 可用')
    expect(h.agents[0]?.followups[0]?.content[0]?.text).toBe('Do bt-1')
  })

  it('degrades to the workspace root on a pool miss and says so in the framing', async () => {
    const h = await harness({ pool: 'miss' })
    await h.engine.dispatch(await h.add('bt-1'))
    expect(h.store.get('bt-1')).toMatchObject({ status: 'running', isolation: 'shared' })
    expect(h.store.get('bt-1')?.worktreePath).toBeUndefined()
    expect(h.agents[0]?.injected[0]?.content[0]?.text).toContain('没有 worktree 隔离')
  })

  it('marks the task failed and reports it when the agent cannot be created', async () => {
    const h = await harness({ createFails: true })
    const result = await h.engine.dispatch(await h.add('bt-1'))
    expect(result).toEqual({ error: 'no model' })
    expect(h.store.get('bt-1')).toMatchObject({ status: 'failed', error: 'no model' })
    expect(h.settled).toHaveLength(1)
    expect(h.settled[0]?.outcome).toBe('failed')
  })

  it('rejects an unknown workspace without creating an agent', async () => {
    const h = await harness()
    const task = pendingTask('bt-x', 'ws-missing')
    await h.store.mutate('add', ledger => { ledger.tasks.push(task); return [task] })
    const result = await h.engine.dispatch(task)
    expect(result).toEqual({ error: 'unknown workspace ws-missing' })
    expect(h.agents).toHaveLength(0)
  })
})

describe('ExecutionEngine settlement', () => {
  it('moves a quiescent worker to in_review with the last assistant text as summary', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const agent = h.agents[0]!
    h.emit(agent.sessionId, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'All done: ' + 'x'.repeat(600) }] } } })
    await settle()
    agent.idle.resolve()
    await settle()
    const stored = h.store.get('bt-1')!
    expect(stored.status).toBe('in_review')
    expect(stored.resultSummary).toHaveLength(500)
    expect(h.settled.map(s => s.outcome)).toEqual(['in_review'])
    expect(agent.disposed).toBe(false)
  })

  it('fails the task on an error turn end and keeps the handle for a follow-up', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const agent = h.agents[0]!
    h.emit(agent.sessionId, { type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { message: 'boom' } } } })
    await settle()
    expect(h.store.get('bt-1')).toMatchObject({ status: 'failed', error: 'boom' })
    const revived = await h.engine.followUp('bt-1', 'try again')
    expect(revived).toEqual({ ok: true })
    expect(h.store.get('bt-1')?.status).toBe('running')
    expect(agent.followups.at(-1)?.content[0]?.text).toBe('try again')
  })

  it('does not settle twice when whenIdle resolves after an error turn', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const agent = h.agents[0]!
    h.emit(agent.sessionId, { type: 'turn/end', data: { reason: { kind: 'error', error: { message: 'boom' } } } })
    await settle()
    agent.idle.resolve()
    await settle()
    expect(h.store.get('bt-1')?.status).toBe('failed')
    expect(h.settled).toHaveLength(1)
  })
})

describe('ExecutionEngine needs_input', () => {
  it('enters needs_input on approval/asked and leaves it when every open request is decided', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const sid = h.agents[0]!.sessionId
    h.emit(sid, { type: 'approval/asked', data: { id: 'a1' } })
    h.emit(sid, { type: 'approval/asked', data: { id: 'a2' } })
    await settle()
    expect(h.store.get('bt-1')).toMatchObject({ status: 'needs_input', pendingInput: { kind: 'approval', since: 10_000 } })
    h.emit(sid, { type: 'approval/decided', data: { id: 'a1' } })
    await settle()
    expect(h.store.get('bt-1')?.status).toBe('needs_input')
    h.emit(sid, { type: 'approval/decided', data: { id: 'a2' } })
    await settle()
    expect(h.store.get('bt-1')?.status).toBe('running')
    expect(h.store.get('bt-1')?.pendingInput).toBeUndefined()
  })

  it('treats an ask_user_question call as needs_input until its tool result lands', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const sid = h.agents[0]!.sessionId
    h.emit(sid, { type: 'tool/call', data: { callId: 'c1', name: 'ask_user_question', arguments: '{}' } })
    await settle()
    expect(h.store.get('bt-1')).toMatchObject({ status: 'needs_input', pendingInput: { kind: 'question' } })
    h.emit(sid, { type: 'tool/call', data: { callId: 'c2', name: 'bash', arguments: '{}' } })
    h.emit(sid, { type: 'tool/result', data: { message: { content: [{ type: 'tool-result', toolCallId: 'c2', content: [] }] } } })
    await settle()
    expect(h.store.get('bt-1')?.status).toBe('needs_input')
    h.emit(sid, { type: 'tool/result', data: { message: { content: [{ type: 'tool-result', toolCallId: 'c1', content: [] }] } } })
    await settle()
    expect(h.store.get('bt-1')?.status).toBe('running')
  })
})

describe('ExecutionEngine verbs', () => {
  it('acknowledge completes an in_review task and releases the worker', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const agent = h.agents[0]!
    agent.idle.resolve()
    await settle()
    expect(await h.engine.acknowledge('bt-1')).toEqual({ ok: true })
    expect(h.store.get('bt-1')).toMatchObject({ status: 'completed', completedAt: 10_000 })
    expect(agent.disposed).toBe(true)
    expect(h.engine.inFlight()).toBe(0)
  })

  it('acknowledge refuses a running task', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const result = await h.engine.acknowledge('bt-1')
    expect(result.ok).toBe(false)
  })

  it('cancel disposes a live worker and refuses a completed task', async () => {
    const h = await harness()
    await h.engine.dispatch(await h.add('bt-1'))
    const agent = h.agents[0]!
    expect(await h.engine.cancel('bt-1')).toEqual({ ok: true })
    expect(agent.disposed).toBe(true)
    expect(h.store.get('bt-1')?.status).toBe('cancelled')
    agent.idle.resolve()
    await settle()
    expect(h.store.get('bt-1')?.status).toBe('cancelled')
    expect(h.settled).toHaveLength(0)
    expect((await h.engine.cancel('bt-1')).ok).toBe(false)
  })

  it('followUp without a live worker explains itself', async () => {
    const h = await harness()
    await h.add('bt-1')
    const result = await h.engine.followUp('bt-1', 'x')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain('no live worker')
  })
})

describe('ExecutionEngine.reconcileAfterRestart', () => {
  it('fails every task the ledger believes live and leaves settled ones alone', async () => {
    const store = await tempStore()
    for (const [id, status] of [['a', 'running'], ['b', 'needs_input'], ['c', 'pending'], ['d', 'in_review'], ['e', 'completed']] as const) {
      const task = pendingTask(id)
      task.status = status
      if (status === 'needs_input') task.pendingInput = { kind: 'approval', since: 1 }
      await store.mutate('seed', ledger => { ledger.tasks.push(task); return [task] })
    }
    const engine = new ExecutionEngine({
      store,
      agents: { create: vi.fn() },
      workspaces: { get: () => undefined, list: () => [] },
      events: { onSessionEvent: () => () => {} },
      settle: { onSettled: vi.fn() },
      workerModel: { provider: 'p', model: 'm' },
      workerNotes: [],
      presets: undefined,
      workerPreset: undefined,
      now: () => 99,
    })
    await engine.reconcileAfterRestart()
    const byId = Object.fromEntries(store.snapshot().tasks.map(t => [t.id, t]))
    expect(byId.a).toMatchObject({ status: 'failed', error: 'host restarted while the task was running', settledAt: 99 })
    expect(byId.b?.status).toBe('failed')
    expect(byId.b?.pendingInput).toBeUndefined()
    expect(byId.c?.status).toBe('failed')
    expect(byId.d?.status).toBe('in_review')
    expect(byId.e?.status).toBe('completed')
  })
})
