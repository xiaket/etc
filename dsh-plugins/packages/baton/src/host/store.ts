/**
 * TaskStore: JSON-file-backed task ledger with serial mutation queue.
 *
 * @module dsh-baton/host/store
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  emptyLedger,
  migrateLedger,
  type TaskLedger,
  type TaskRecord,
} from '../shared/protocol.ts'

/** Subscriber callback on ledger changes. */
export type StoreListener = (ledger: TaskLedger) => void

/**
 * Serial-queue JSON file store.
 */
export class TaskStore {
  private ledger: TaskLedger = emptyLedger()
  private loaded = false
  private readonly file: string
  private readonly listeners = new Set<StoreListener>()
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(options: { file: string }) {
    this.file = options.file
  }

  /** Load the ledger from disk, upgrading older formats. Safe to call multiple times. */
  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await readFile(this.file, 'utf-8')
      this.ledger = migrateLedger(JSON.parse(raw))
    } catch {
      // File missing or corrupt — start fresh.
    }
    this.loaded = true
  }

  /** Current ledger snapshot (read-only). */
  snapshot(): TaskLedger {
    return this.ledger
  }

  /** Get one task by id. */
  get(id: string): TaskRecord | undefined {
    return this.ledger.tasks.find(t => t.id === id)
  }

  /** Subscribe to ledger changes. Returns unsubscribe function. */
  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Mutate the ledger inside a serial queue. The callback receives the
   * live ledger and may modify it in place; it returns the touched records
   * (an empty array for a ledger-level change) or `undefined` for no change.
   * Returns after the write commits.
   * @param label - operation name, for diagnostics only.
   * @param fn - in-place mutation.
   */
  async mutate(label: string, fn: (ledger: TaskLedger) => TaskRecord[] | undefined): Promise<void> {
    await this.load()
    const job = this.writeQueue.then(async () => {
      const touched = fn(this.ledger)
      if (touched === undefined) return
      this.ledger.revision++
      await this.persist()
      for (const listener of this.listeners) {
        try { listener(this.ledger) } catch (error) {
          console.error(`[dsh-baton] store listener failed after ${label}:`, error)
        }
      }
    })
    this.writeQueue = job.catch(() => { /* keep the queue alive */ })
    await job
  }

  /** Read inside the serial queue without mutating. */
  async read<T>(fn: (ledger: TaskLedger) => T): Promise<T> {
    await this.load()
    return fn(this.ledger)
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    await writeFile(this.file, JSON.stringify(this.ledger, null, 2) + '\n', 'utf-8')
  }
}
