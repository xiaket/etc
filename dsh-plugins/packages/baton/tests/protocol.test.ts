import { describe, expect, it } from 'vitest'
import {
  ALL_STATUSES, LEDGER_SCHEMA_VERSION, canTransition, migrateLedger, summarize, type TaskRecord, type TaskStatus,
} from '../src/shared/protocol.ts'

describe('transition table', () => {
  it('lets a live worker block, settle, fail, or be cancelled', () => {
    expect(canTransition('running', 'needs_input')).toBe(true)
    expect(canTransition('running', 'in_review')).toBe(true)
    expect(canTransition('running', 'failed')).toBe(true)
    expect(canTransition('running', 'cancelled')).toBe(true)
    expect(canTransition('running', 'completed')).toBe(false)
  })

  it('only the user completes a task, and only from review', () => {
    for (const from of ALL_STATUSES) {
      expect(canTransition(from, 'completed')).toBe(from === 'in_review')
    }
  })

  it('revives failed and in-review tasks through a follow-up but never finished ones', () => {
    expect(canTransition('failed', 'running')).toBe(true)
    expect(canTransition('in_review', 'running')).toBe(true)
    expect(canTransition('completed', 'running')).toBe(false)
    expect(canTransition('cancelled', 'running')).toBe(false)
  })
})

describe('migrateLedger', () => {
  it('upgrades a v1 ledger, filling isolation and activity', () => {
    const v1 = {
      schemaVersion: 1, revision: 7,
      tasks: [{ id: 'bt-a', title: 'A', description: 'd', workspaceId: 'ws', status: 'completed', createdAt: 1, updatedAt: 5 }],
    }
    const ledger = migrateLedger(v1)
    expect(ledger.schemaVersion).toBe(LEDGER_SCHEMA_VERSION)
    expect(ledger.revision).toBe(7)
    expect(ledger.tasks[0]).toMatchObject({ id: 'bt-a', status: 'completed', isolation: 'shared', lastActivityAt: 5 })
    expect(ledger.commanderSessionId).toBeUndefined()
  })

  it('keeps a v2 ledger intact including the commander id', () => {
    const v2 = { schemaVersion: 2, revision: 1, tasks: [], commanderSessionId: 'session-x' }
    expect(migrateLedger(v2)).toEqual(v2)
  })

  it('treats garbage as an empty ledger and drops records without ids', () => {
    expect(migrateLedger(null).tasks).toEqual([])
    expect(migrateLedger('nope').tasks).toEqual([])
    expect(migrateLedger({ tasks: [{ title: 'no id' }, 42] }).tasks).toEqual([])
  })

  it('maps an unknown status to failed', () => {
    const ledger = migrateLedger({ tasks: [{ id: 'x', status: 'bogus' as TaskStatus, createdAt: 1, updatedAt: 1 }] })
    expect(ledger.tasks[0]?.status).toBe('failed')
  })
})

describe('summarize', () => {
  it('omits absent optional fields instead of writing undefined', () => {
    const task: TaskRecord = {
      id: 'bt-1', title: 'T', description: '', workspaceId: 'ws', status: 'running', isolation: 'worktree',
      createdAt: 1, updatedAt: 2, lastActivityAt: 3, sessionId: 's',
    }
    const summary = summarize(task)
    expect(summary).toEqual({
      id: 'bt-1', title: 'T', workspaceId: 'ws', status: 'running', isolation: 'worktree',
      createdAt: 1, updatedAt: 2, lastActivityAt: 3, sessionId: 's',
    })
    expect('error' in summary).toBe(false)
  })
})
