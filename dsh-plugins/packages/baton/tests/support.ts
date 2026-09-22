import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TaskStore } from '../src/host/store.ts'
import type { TaskRecord } from '../src/shared/protocol.ts'

/** A fresh ledger in a temp directory. */
export async function tempStore(): Promise<TaskStore> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-baton-'))
  const store = new TaskStore({ file: join(dir, 'ledger.json') })
  await store.load()
  return store
}

/** A pending record. */
export function pendingTask(id: string, workspaceId = 'ws-1', now = 1_000): TaskRecord {
  return {
    id, title: `Task ${id}`, description: `Do ${id}`, workspaceId, status: 'pending', isolation: 'shared',
    createdAt: now, updatedAt: now, lastActivityAt: now,
  }
}

/** Deferred promise. */
export function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** Yield to the microtask queue a few times. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise<void>(resolve => { setTimeout(resolve, 0) })
}
