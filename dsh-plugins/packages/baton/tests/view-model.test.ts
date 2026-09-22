import { describe, expect, it } from 'vitest'
import type { TaskSummary } from '../src/shared/protocol.ts'
import { composePrompt, filterCounts, needsInput, relativeAge, runningCount, visibleTasks } from '../src/client/view-model.ts'

const task = (id: string, status: TaskSummary['status'], updatedAt: number, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id, title: id, workspaceId: 'ws', status, isolation: 'shared', createdAt: 0, updatedAt, lastActivityAt: updatedAt, ...extra,
})

const tasks = [
  task('a', 'running', 5),
  task('b', 'completed', 9),
  task('c', 'needs_input', 3, { pendingInput: { kind: 'question', since: 30 } }),
  task('d', 'failed', 7),
  task('e', 'in_review', 1),
  task('f', 'needs_input', 8, { pendingInput: { kind: 'approval', since: 10 } }),
  task('g', 'cancelled', 2),
]

describe('visibleTasks', () => {
  it('hides finished work under "all" and ranks by status then recency', () => {
    expect(visibleTasks(tasks, 'all', 'status').map(t => t.id)).toEqual(['f', 'c', 'd', 'e', 'a'])
  })
  it('sorts by recency when asked', () => {
    expect(visibleTasks(tasks, 'all', 'recent').map(t => t.id)).toEqual(['f', 'd', 'a', 'c', 'e'])
  })
  it('narrows to one status', () => {
    expect(visibleTasks(tasks, 'failed', 'status').map(t => t.id)).toEqual(['d'])
  })
})

describe('counts', () => {
  it('counts every chip', () => {
    expect(filterCounts(tasks)).toEqual({ all: 5, running: 1, needs_input: 2, in_review: 1, failed: 1 })
    expect(runningCount(tasks)).toBe(3)
  })
  it('orders blocked tasks oldest block first', () => {
    expect(needsInput(tasks).map(t => t.id)).toEqual(['f', 'c'])
  })
})

describe('relativeAge', () => {
  it('buckets minutes, hours, days', () => {
    expect(relativeAge(1000, 1000 + 20_000)).toEqual({ key: 'time.justNow', params: {} })
    expect(relativeAge(0, 11 * 60_000)).toEqual({ key: 'time.minutes', params: { n: 11 } })
    expect(relativeAge(0, 3 * 3_600_000)).toEqual({ key: 'time.hours', params: { n: 3 } })
    expect(relativeAge(0, 5 * 86_400_000)).toEqual({ key: 'time.days', params: { n: 5 } })
  })
})

describe('composePrompt', () => {
  it('wraps the trimmed text with the optional prefix and suffix', () => {
    expect(composePrompt('  fix it  ', '在仓库里：', '\n\n只调研')).toBe('在仓库里：fix it\n\n只调研')
    expect(composePrompt('fix it', undefined, undefined)).toBe('fix it')
  })
  it('returns empty for whitespace so nothing is sent', () => {
    expect(composePrompt('   ', 'p', 's')).toBe('')
  })
})
