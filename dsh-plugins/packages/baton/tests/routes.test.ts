import { describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import { registerBatonRoutes, type RoutesOptions } from '../src/host/routes.ts'
import { NotificationService } from '../src/host/notification.ts'
import type { StateResponse } from '../src/shared/api.ts'

interface Route { kind: 'prefix' | 'exact'; path: string; handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void }

async function serve(overrides: Partial<RoutesOptions> = {}) {
  const routes: Route[] = []
  const notification = new NotificationService()
  const state: StateResponse = { revision: 3, tasks: [], workspaceMap: {}, commander: { sessionId: null } }
  const opts: RoutesOptions = {
    notification,
    state: () => state,
    ensureCommander: vi.fn(async () => ({ sessionId: 'session-c', created: true })),
    acknowledge: vi.fn(async (id: string) => id === 'ok' ? { ok: true as const } : { ok: false as const, error: 'not awaiting review' }),
    cancel: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  }
  const ctx = { webServer: { register: (route: Route) => { routes.push(route); return () => {} } } }
  const dispose = registerBatonRoutes(ctx as never, opts)
  const server: Server = createServer((req, res) => {
    const url = req.url ?? ''
    const route = routes.find(r => r.kind === 'exact' && r.path === url) ?? routes.find(r => r.kind === 'prefix' && url.startsWith(r.path))
    if (route === undefined) { res.writeHead(404); res.end(); return }
    route.handler(req, res)
  })
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  const base = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : ''
  return {
    base, opts, notification,
    close: async () => { dispose(); notification.dispose(); await new Promise<void>(resolve => { server.close(() => { resolve() }) }) },
  }
}

describe('baton routes', () => {
  it('serves the state snapshot', async () => {
    const s = await serve()
    try {
      const body = await (await fetch(`${s.base}/dsh-baton/state`)).json()
      expect(body).toEqual({ ok: true, data: { revision: 3, tasks: [], workspaceMap: {}, commander: { sessionId: null } } })
    } finally { await s.close() }
  })

  it('creates the commander on POST /commander', async () => {
    const s = await serve()
    try {
      const body = await (await fetch(`${s.base}/dsh-baton/commander`, { method: 'POST' })).json()
      expect(body).toEqual({ ok: true, data: { sessionId: 'session-c', created: true } })
    } finally { await s.close() }
  })

  it('maps verb outcomes to 200 / 409 and decodes the task id', async () => {
    const s = await serve()
    try {
      const good = await fetch(`${s.base}/dsh-baton/tasks/ok/ack`, { method: 'POST' })
      expect(good.status).toBe(200)
      const bad = await fetch(`${s.base}/dsh-baton/tasks/bt%2F1/ack`, { method: 'POST' })
      expect(bad.status).toBe(409)
      expect(await bad.json()).toEqual({ ok: false, error: 'not awaiting review' })
      expect(s.opts.acknowledge).toHaveBeenLastCalledWith('bt/1')
      await fetch(`${s.base}/dsh-baton/tasks/x/cancel`, { method: 'POST' })
      expect(s.opts.cancel).toHaveBeenCalledWith('x')
    } finally { await s.close() }
  })

  it('reports thrown operation errors as 500 and unknown paths as 404', async () => {
    const s = await serve({ ensureCommander: async () => { throw new Error('nope') } })
    try {
      const failed = await fetch(`${s.base}/dsh-baton/commander`, { method: 'POST' })
      expect(failed.status).toBe(500)
      expect(await failed.json()).toEqual({ ok: false, error: 'nope' })
      expect((await fetch(`${s.base}/dsh-baton/whatever`)).status).toBe(404)
      expect((await fetch(`${s.base}/dsh-baton/state`, { method: 'POST' })).status).toBe(404)
    } finally { await s.close() }
  })

  it('opens the SSE stream with the current state and pushes settlements', async () => {
    const s = await serve()
    try {
      const controller = new AbortController()
      const response = await fetch(`${s.base}/dsh-baton/events`, { signal: controller.signal })
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let text = ''
      const readUntil = async (needle: string): Promise<void> => {
        while (!text.includes(needle)) {
          const { value, done } = await reader.read()
          if (done) throw new Error('stream ended')
          text += decoder.decode(value)
        }
      }
      await readUntil('event: state')
      expect(text).toContain('"revision":3')
      s.notification.pushSettled({
        id: 'bt-1', title: 'T', workspaceId: 'ws', status: 'in_review', isolation: 'shared', createdAt: 1, updatedAt: 2, lastActivityAt: 2,
      }, 'in_review')
      await readUntil('event: task-settled')
      expect(text).toContain('"outcome":"in_review"')
      expect(s.notification.clientCount()).toBe(1)
      controller.abort()
    } finally { await s.close() }
  })
})
