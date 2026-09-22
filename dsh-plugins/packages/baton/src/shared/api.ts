/**
 * HTTP API types shared between host routes and the browser half.
 *
 * @module dsh-baton/shared/api
 */
import type { TaskSummary, WorkspaceMap } from './protocol.ts'

/** Route prefix for all baton HTTP endpoints. */
export const ROUTE_PREFIX = '/dsh-baton'

/** SSE stream path. */
export const SSE_PATH = `${ROUTE_PREFIX}/events`

/** API success envelope. */
export interface ApiOk<T> { ok: true; data: T }

/** API error envelope. */
export interface ApiFail { ok: false; error: string; code?: string }

/** API result. */
export type ApiResult<T> = ApiOk<T> | ApiFail

/** The commander session as the browser sees it. */
export interface CommanderInfo {
  /** Absent until the commander has been created once. */
  sessionId: string | null
}

/** GET /state response and the `state` SSE payload. */
export interface StateResponse {
  revision: number
  tasks: TaskSummary[]
  workspaceMap: WorkspaceMap
  commander: CommanderInfo
}

/** POST /commander response. */
export interface CommanderResponse {
  sessionId: string
  created: boolean
}

/** How a worker left its live state. */
export type SettleOutcome = 'in_review' | 'failed'

/** SSE events pushed to the browser. */
export type SseEvent =
  | { type: 'state'; state: StateResponse }
  | { type: 'task-settled'; task: TaskSummary; outcome: SettleOutcome }
  | { type: 'heartbeat' }

/** SSE event names, mirrored from {@link SseEvent}. */
export type SseEventType = SseEvent['type']
