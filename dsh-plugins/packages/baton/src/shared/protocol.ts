/**
 * Task domain model shared by the host and the browser half: statuses, the
 * legal transition table, the durable ledger, and the workspace map.
 *
 * @module dsh-baton/shared/protocol
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Task lifecycle states.
 *
 * - `pending`: recorded, worker session not yet created.
 * - `running`: the worker session is executing.
 * - `needs_input`: the worker is blocked on an approval or a user question.
 * - `in_review`: the worker reached quiescence; waiting for the user to confirm.
 * - `completed`: the user confirmed the result.
 * - `failed`: the worker errored, or the host restarted while it was running.
 * - `cancelled`: the user or the commander cancelled it.
 */
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'needs_input'
  | 'in_review'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** Every valid status value, in display order. */
export const ALL_STATUSES: readonly TaskStatus[] = [
  'needs_input', 'failed', 'in_review', 'running', 'pending', 'completed', 'cancelled',
]

/** Statuses whose worker session is alive on the host. */
export const LIVE_STATUSES: readonly TaskStatus[] = ['running', 'needs_input']

/** Legal transitions. */
const TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  pending: ['running', 'failed', 'cancelled'],
  running: ['needs_input', 'in_review', 'failed', 'cancelled'],
  needs_input: ['running', 'in_review', 'failed', 'cancelled'],
  in_review: ['completed', 'running', 'cancelled'],
  completed: [],
  failed: ['running', 'cancelled'],
  cancelled: [],
}

/**
 * Whether a status move is legal.
 * @param from - current status.
 * @param to - requested status.
 * @returns true when the transition table allows it.
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/** How the worker's working directory relates to the workspace root. */
export type TaskIsolation = 'worktree' | 'shared'

/** Why a worker is blocked on the user. */
export interface PendingInput {
  kind: 'approval' | 'question'
  /** Epoch ms when the block started. */
  since: number
}

/** One dispatched task. */
export interface TaskRecord {
  id: string
  title: string
  description: string
  workspaceId: string
  status: TaskStatus

  /** The worker session running this task. */
  sessionId?: string
  /** Where the worker runs; `shared` means the workspace root itself. */
  isolation: TaskIsolation
  worktreePath?: string
  /** Present only while `status === 'needs_input'`. */
  pendingInput?: PendingInput

  startedAt?: number
  /** When the worker reached quiescence (in_review) or failed. */
  settledAt?: number
  /** When the user confirmed the result. */
  completedAt?: number
  error?: string
  /** Last assistant text from the worker, truncated. */
  resultSummary?: string

  createdAt: number
  updatedAt: number
  /** Last worker event observed. */
  lastActivityAt: number
}

/** The whole durable ledger. */
export interface TaskLedger {
  schemaVersion: number
  revision: number
  tasks: TaskRecord[]
  /** The commander session this host resumes on boot. */
  commanderSessionId?: string
}

/** Current ledger format version. */
export const LEDGER_SCHEMA_VERSION = 2

/** @returns an empty ledger. */
export function emptyLedger(): TaskLedger {
  return { schemaVersion: LEDGER_SCHEMA_VERSION, revision: 0, tasks: [] }
}

/**
 * Upgrade any stored ledger to the current format. Unknown or corrupt input
 * yields an empty ledger. Version 1 records gain `isolation: 'shared'` and
 * `lastActivityAt`; their statuses are kept as stored.
 * @param raw - parsed JSON of unknown provenance.
 * @returns a v2 ledger.
 */
export function migrateLedger(raw: unknown): TaskLedger {
  if (typeof raw !== 'object' || raw === null) return emptyLedger()
  const source = raw as Partial<TaskLedger> & { tasks?: unknown }
  if (!Array.isArray(source.tasks)) return emptyLedger()
  const tasks: TaskRecord[] = []
  for (const entry of source.tasks as Array<Partial<TaskRecord>>) {
    if (typeof entry !== 'object' || entry === null || typeof entry.id !== 'string') continue
    const updatedAt = entry.updatedAt ?? entry.createdAt ?? 0
    tasks.push({
      id: entry.id,
      title: entry.title ?? entry.id,
      description: entry.description ?? '',
      workspaceId: entry.workspaceId ?? '',
      status: ALL_STATUSES.includes(entry.status as TaskStatus) ? entry.status as TaskStatus : 'failed',
      isolation: entry.isolation === 'worktree' ? 'worktree' : 'shared',
      createdAt: entry.createdAt ?? updatedAt,
      updatedAt,
      lastActivityAt: entry.lastActivityAt ?? updatedAt,
      ...(entry.sessionId !== undefined ? { sessionId: entry.sessionId } : {}),
      ...(entry.worktreePath !== undefined ? { worktreePath: entry.worktreePath } : {}),
      ...(entry.pendingInput !== undefined ? { pendingInput: entry.pendingInput } : {}),
      ...(entry.startedAt !== undefined ? { startedAt: entry.startedAt } : {}),
      ...(entry.settledAt !== undefined ? { settledAt: entry.settledAt } : {}),
      ...(entry.completedAt !== undefined ? { completedAt: entry.completedAt } : {}),
      ...(entry.error !== undefined ? { error: entry.error } : {}),
      ...(entry.resultSummary !== undefined ? { resultSummary: entry.resultSummary } : {}),
    })
  }
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    revision: typeof source.revision === 'number' ? source.revision : 0,
    tasks,
    ...(typeof source.commanderSessionId === 'string' ? { commanderSessionId: source.commanderSessionId } : {}),
  }
}

// ---------------------------------------------------------------------------
// Workspace map
// ---------------------------------------------------------------------------

/** One workspace entry in the persistent mapping. */
export interface WorkspaceMapEntry {
  path: string
  description: string
  aliases?: string[]
}

/** The persistent workspace-to-description mapping. */
export type WorkspaceMap = Record<string, WorkspaceMapEntry>

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

function suffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** @returns a fresh task id. */
export function newTaskId(): string {
  return `bt-${Date.now().toString(36)}-${suffix()}`
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate and normalize a title: trimmed, 1..200 chars.
 * @param raw - untrusted title.
 * @returns the trimmed title.
 */
export function normalizeTitle(raw: string): string {
  const t = raw.trim()
  if (t.length === 0 || t.length > 200) {
    throw new Error('title must be 1..200 characters')
  }
  return t
}

/** Compact summary for tool output and the browser. */
export interface TaskSummary {
  id: string
  title: string
  workspaceId: string
  status: TaskStatus
  isolation: TaskIsolation
  createdAt: number
  updatedAt: number
  lastActivityAt: number
  sessionId?: string
  startedAt?: number
  settledAt?: number
  error?: string
  resultSummary?: string
  pendingInput?: PendingInput
}

/**
 * Build a compact summary.
 * @param task - full record.
 * @returns the fields the browser and the model read.
 */
export function summarize(task: TaskRecord): TaskSummary {
  return {
    id: task.id,
    title: task.title,
    workspaceId: task.workspaceId,
    status: task.status,
    isolation: task.isolation,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    lastActivityAt: task.lastActivityAt,
    ...(task.sessionId !== undefined ? { sessionId: task.sessionId } : {}),
    ...(task.startedAt !== undefined ? { startedAt: task.startedAt } : {}),
    ...(task.settledAt !== undefined ? { settledAt: task.settledAt } : {}),
    ...(task.error !== undefined ? { error: task.error } : {}),
    ...(task.resultSummary !== undefined ? { resultSummary: task.resultSummary } : {}),
    ...(task.pendingInput !== undefined ? { pendingInput: task.pendingInput } : {}),
  }
}
