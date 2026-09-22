/**
 * HTTP routes for dsh-baton: the JSON API the workbench panel calls plus the
 * SSE stream that pushes task state to it.
 *
 * Conversation with the commander does not go through these routes: the
 * browser prompts the commander session through the ordinary session
 * controller, exactly like any other session.
 *
 * @module dsh-baton/host/routes
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { ROUTE_PREFIX, SSE_PATH, type CommanderResponse, type StateResponse } from '../shared/api.ts'
import type { NotificationService } from './notification.ts'

/** Send a JSON response. */
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Task verb result. */
export type VerbResult = { ok: true } | { ok: false; error: string }

/** Options. */
export interface RoutesOptions {
  notification: NotificationService
  /** Build the authoritative state snapshot. */
  state: () => StateResponse
  /** Resume or create the commander session. */
  ensureCommander: () => Promise<CommanderResponse>
  /** The user confirmed an in-review task. */
  acknowledge: (taskId: string) => Promise<VerbResult>
  /** The user cancelled a task. */
  cancel: (taskId: string) => Promise<VerbResult>
}

const TASK_VERB = new RegExp(`^${ROUTE_PREFIX}/tasks/([^/]+)/(ack|cancel)$`)

/**
 * Register baton routes on the DSH webserver.
 * @param ctx - a context with `webServer`.
 * @param opts - the operations the routes expose.
 * @returns disposer.
 */
export function registerBatonRoutes(ctx: Context, opts: RoutesOptions): () => void {
  const { notification, state, ensureCommander, acknowledge, cancel } = opts

  const run = (res: ServerResponse, work: () => Promise<unknown>): void => {
    void work().then(
      data => { json(res, 200, { ok: true, data }) },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        json(res, 500, { ok: false, error: message })
      },
    )
  }

  const verb = (res: ServerResponse, work: () => Promise<VerbResult>): void => {
    void work().then(
      result => { result.ok ? json(res, 200, { ok: true, data: {} }) : json(res, 409, { ok: false, error: result.error }) },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        json(res, 500, { ok: false, error: message })
      },
    )
  }

  /** Prefix handler: /dsh-baton/* routes. */
  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    const url = (req.url ?? '').split('?')[0] ?? ''
    const method = req.method ?? 'GET'

    if (url === SSE_PATH && method === 'GET') {
      notification.addClient(res, state())
      return
    }
    if (url === `${ROUTE_PREFIX}/state` && method === 'GET') {
      run(res, async () => state())
      return
    }
    if (url === `${ROUTE_PREFIX}/commander` && method === 'POST') {
      run(res, ensureCommander)
      return
    }
    const match = TASK_VERB.exec(url)
    if (match !== null && method === 'POST') {
      const taskId = decodeURIComponent(match[1] ?? '')
      verb(res, () => match[2] === 'ack' ? acknowledge(taskId) : cancel(taskId))
      return
    }
    json(res, 404, { ok: false, error: 'not found' })
  }

  return ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler })
}
