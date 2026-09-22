/**
 * Pure helpers behind the task list and banner: filtering, sorting, counts,
 * status presentation, and relative time.
 *
 * @module dsh-baton/client/view-model
 */
import type { StateDotState, TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import { ALL_STATUSES, type TaskStatus, type TaskSummary } from '../shared/protocol.ts'
import type { BatonKey } from './locales.ts'

/** Task-list filter chips. */
export type TaskFilter = 'all' | 'running' | 'needs_input' | 'in_review' | 'failed'

/** Every filter in chip order. */
export const FILTERS: readonly TaskFilter[] = ['all', 'running', 'needs_input', 'in_review', 'failed']

/** Task-list sort orders. */
export type TaskSort = 'status' | 'recent'

/** Statuses hidden from the "all" chip: finished work stays out of the way. */
const HIDDEN_WHEN_ALL: readonly TaskStatus[] = ['completed', 'cancelled']

/**
 * Filter then sort.
 * @param tasks - every task.
 * @param filter - active chip.
 * @param sort - active order.
 * @returns the visible list.
 */
export function visibleTasks(tasks: readonly TaskSummary[], filter: TaskFilter, sort: TaskSort): TaskSummary[] {
  const kept = tasks.filter(task => filter === 'all'
    ? !HIDDEN_WHEN_ALL.includes(task.status)
    : task.status === filter)
  const rank = (status: TaskStatus): number => ALL_STATUSES.indexOf(status)
  return kept.sort((a, b) => sort === 'status'
    ? rank(a.status) - rank(b.status) || b.updatedAt - a.updatedAt
    : b.updatedAt - a.updatedAt)
}

/**
 * How many tasks each chip would show.
 * @param tasks - every task.
 * @returns counts keyed by filter.
 */
export function filterCounts(tasks: readonly TaskSummary[]): Record<TaskFilter, number> {
  const counts: Record<TaskFilter, number> = { all: 0, running: 0, needs_input: 0, in_review: 0, failed: 0 }
  for (const task of tasks) {
    if (!HIDDEN_WHEN_ALL.includes(task.status)) counts.all += 1
    if (task.status === 'running' || task.status === 'needs_input' || task.status === 'in_review' || task.status === 'failed') {
      counts[task.status] += 1
    }
  }
  return counts
}

/** @returns tasks blocked on the user, oldest block first. */
export function needsInput(tasks: readonly TaskSummary[]): TaskSummary[] {
  return tasks
    .filter(task => task.status === 'needs_input')
    .sort((a, b) => (a.pendingInput?.since ?? 0) - (b.pendingInput?.since ?? 0))
}

/** @returns how many workers are live. */
export function runningCount(tasks: readonly TaskSummary[]): number {
  return tasks.filter(task => task.status === 'running' || task.status === 'needs_input').length
}

/** Status mark and tag tone for one status. */
export function statusLook(status: TaskStatus): { dot: StateDotState; tone: TagTone } {
  switch (status) {
    case 'running': return { dot: 'ongoing', tone: 'success' }
    case 'needs_input': return { dot: 'warning', tone: 'warning' }
    case 'in_review': return { dot: 'done', tone: 'info' }
    case 'failed': return { dot: 'error', tone: 'danger' }
    case 'completed': return { dot: 'done', tone: 'neutral' }
    case 'pending': return { dot: 'idle', tone: 'quiet' }
    case 'cancelled': return { dot: 'idle', tone: 'quiet' }
  }
}

/** @returns the copy key for a status label. */
export function statusKey(status: TaskStatus): BatonKey {
  return `status.${status}`
}

/** @returns the copy key for a filter chip. */
export function filterKey(filter: TaskFilter): BatonKey {
  return `tasks.filter.${filter}`
}

/** Relative time as a copy key plus parameter. */
export function relativeAge(from: number, now: number): { key: BatonKey; params: Record<string, number> } {
  const minutes = Math.max(0, Math.round((now - from) / 60_000))
  if (minutes < 1) return { key: 'time.justNow', params: {} }
  if (minutes < 60) return { key: 'time.minutes', params: { n: minutes } }
  const hours = Math.round(minutes / 60)
  if (hours < 48) return { key: 'time.hours', params: { n: hours } }
  return { key: 'time.days', params: { n: Math.round(hours / 24) } }
}

/**
 * Compose the outgoing prompt from the composer state.
 * @param text - what the user typed.
 * @param repoPrefix - localized "In <repo>: " prefix, or undefined.
 * @param researchSuffix - localized research-only suffix, or undefined.
 * @returns the prompt text, or an empty string when nothing was typed.
 */
export function composePrompt(text: string, repoPrefix: string | undefined, researchSuffix: string | undefined): string {
  const body = text.trim()
  if (body.length === 0) return ''
  return `${repoPrefix ?? ''}${body}${researchSuffix ?? ''}`
}
