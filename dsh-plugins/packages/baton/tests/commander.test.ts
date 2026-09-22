import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Commander, type CommanderDeps, type CommanderHandle } from '../src/host/commander.ts'
import { tempStore } from './support.ts'

async function harness(options: { resumeFails?: boolean; recorded?: string } = {}) {
  const store = await tempStore()
  if (options.recorded !== undefined) {
    const id = options.recorded
    await store.mutate('seed', ledger => { ledger.commanderSessionId = id; return [] })
  }
  const dir = join(await mkdtemp(join(tmpdir(), 'dsh-baton-cmd-')), 'commander')
  const handle: CommanderHandle = { agent: { inject: vi.fn() }, dispose: vi.fn(async () => {}) }
  const mounted: string[] = []
  const extra = vi.fn(async () => {})
  const deps: CommanderDeps = {
    presets: { resolve: async id => ({ id: id ?? 'standard' }), mount: async (_ctx, id) => { mounted.push(id ?? '') } },
    preset: 'code',
    store,
    agents: {
      create: vi.fn(async () => handle),
      resume: vi.fn(async () => { if (options.resumeFails) throw new Error('gone'); return handle }),
    },
    workspaces: { archiveSession: vi.fn(async () => {}) },
    title: { rename: vi.fn() },
    cwd: dir,
    model: { provider: 'p', model: 'm' },
    displayTitle: 'baton',
    setup: extra,
    log: () => {},
  }
  return { store, deps, handle, dir, mounted, extra, commander: new Commander(deps) }
}

describe('Commander.ensure', () => {
  it('creates, records, archives, and renames a fresh commander', async () => {
    const h = await harness()
    const result = await h.commander.ensure()
    expect(result.created).toBe(true)
    expect(result.sessionId).toMatch(/^session-baton-commander-/)
    expect((await stat(h.dir)).isDirectory()).toBe(true)
    expect(h.store.snapshot().commanderSessionId).toBe(result.sessionId)
    expect(h.deps.workspaces.archiveSession).toHaveBeenCalledWith(result.sessionId)
    expect(h.deps.title?.rename).toHaveBeenCalledWith(result.sessionId, 'baton')
    const create = h.deps.agents.create as ReturnType<typeof vi.fn>
    const opts = create.mock.calls[0]?.[0] as { meta: { cwd: string; agentPreset?: string }; setup: (ctx: unknown) => Promise<void> }
    expect(opts).toMatchObject({ sessionId: result.sessionId, meta: { cwd: h.dir, agentPreset: 'code' } })
    await opts.setup({})
    expect(h.mounted).toEqual(['code'])
    expect(h.extra).toHaveBeenCalledTimes(1)
  })

  it('resumes with the same composition so baton tools and the preset both come back', async () => {
    const h = await harness({ recorded: 'session-old' })
    await h.commander.ensure()
    const resume = h.deps.agents.resume as ReturnType<typeof vi.fn>
    const opts = resume.mock.calls[0]?.[0] as { setup: (ctx: unknown) => Promise<void> }
    await opts.setup({})
    expect(h.mounted).toEqual(['code'])
    expect(h.extra).toHaveBeenCalledTimes(1)
  })

  it('resumes the recorded commander instead of creating another', async () => {
    const h = await harness({ recorded: 'session-old' })
    const result = await h.commander.ensure()
    expect(result).toEqual({ sessionId: 'session-old', created: false })
    expect(h.deps.agents.create).not.toHaveBeenCalled()
    expect(h.deps.workspaces.archiveSession).not.toHaveBeenCalled()
  })

  it('falls back to a new commander when the recorded one cannot be resumed', async () => {
    const h = await harness({ recorded: 'session-old', resumeFails: true })
    const result = await h.commander.ensure()
    expect(result.created).toBe(true)
    expect(result.sessionId).not.toBe('session-old')
    expect(h.store.snapshot().commanderSessionId).toBe(result.sessionId)
  })

  it('shares one in-flight attempt and is idempotent afterwards', async () => {
    const h = await harness()
    const [a, b] = await Promise.all([h.commander.ensure(), h.commander.ensure()])
    expect(a).toEqual(b)
    expect(h.deps.agents.create).toHaveBeenCalledTimes(1)
    expect(await h.commander.ensure()).toEqual({ sessionId: a.sessionId, created: false })
  })

  it('notify injects a plugin message only once a handle exists', async () => {
    const h = await harness()
    h.commander.notify('early')
    expect(h.handle.agent.inject).not.toHaveBeenCalled()
    await h.commander.ensure()
    h.commander.notify('[baton] done')
    expect(h.handle.agent.inject).toHaveBeenCalledWith(expect.objectContaining({
      role: 'user', source: { kind: 'plugin', plugin: 'dsh-baton' }, content: [{ type: 'text', text: '[baton] done' }],
    }))
  })
})
