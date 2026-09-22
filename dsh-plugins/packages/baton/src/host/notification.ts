/**
 * NotificationService: pushes baton state and settlement events to connected
 * SSE clients. The browser half re-renders the task list from `state` and
 * shows a toast with a sound on `task-settled`.
 *
 * @module dsh-baton/host/notification
 */
import type { ServerResponse } from 'node:http'
import type { SettleOutcome, SseEvent, StateResponse } from '../shared/api.ts'
import type { TaskSummary } from '../shared/protocol.ts'

/** One connected SSE client. */
interface SseClient {
  res: ServerResponse
  alive: boolean
}

/** Heartbeat period; keeps proxies from closing an idle stream. */
const HEARTBEAT_MS = 20_000

/**
 * Manages SSE connections and pushes events to the browser.
 */
export class NotificationService {
  private readonly clients = new Set<SseClient>()
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined

  constructor() {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast({ type: 'heartbeat' })
    }, HEARTBEAT_MS)
  }

  dispose(): void {
    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
    for (const client of this.clients) {
      try { client.res.end() } catch { /* already closed */ }
    }
    this.clients.clear()
  }

  /**
   * Register an SSE client connection and send it the current state.
   * @param res - the open response.
   * @param initial - state to deliver before any increment.
   */
  addClient(res: ServerResponse, initial: StateResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write('\n')

    const client: SseClient = { res, alive: true }
    this.clients.add(client)
    res.on('close', () => {
      client.alive = false
      this.clients.delete(client)
    })
    this.send(client, { type: 'state', state: initial })
  }

  /**
   * Push a full state snapshot to all clients.
   * @param state - the authoritative snapshot.
   */
  pushState(state: StateResponse): void {
    this.broadcast({ type: 'state', state })
  }

  /**
   * Announce that a worker left its live state.
   * @param task - the settled task.
   * @param outcome - review or failure.
   */
  pushSettled(task: TaskSummary, outcome: SettleOutcome): void {
    this.broadcast({ type: 'task-settled', task, outcome })
  }

  /** @returns the number of live listeners. */
  clientCount(): number {
    return this.clients.size
  }

  private broadcast(event: SseEvent): void {
    for (const client of this.clients) this.send(client, event)
  }

  private send(client: SseClient, event: SseEvent): void {
    if (!client.alive) return
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
    try {
      client.res.write(payload)
    } catch {
      client.alive = false
      this.clients.delete(client)
    }
  }
}
