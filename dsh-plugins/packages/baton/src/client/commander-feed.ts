/**
 * Follows the commander session in the Client session model and publishes one
 * stable observable the panel binds to: the event window folded into rows
 * plus the session's control state. React-free.
 *
 * @module dsh-baton/client/commander-feed
 */
import type { ISessions, SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { foldTranscript, type Transcript, type TranscriptEntry } from './transcript.ts'

/** How the panel sees the commander. */
export interface CommanderView {
  readonly sessionId: string | null
  /** Whether the Client has a live binding (list knows the session). */
  readonly bound: boolean
  readonly running: boolean
  readonly openState: 'cold' | 'loading' | 'open' | 'error'
  readonly transcript: Transcript
}

const EMPTY: CommanderView = {
  sessionId: null, bound: false, running: false, openState: 'cold', transcript: { items: [] },
}

/**
 * Owns the subscriptions to the commander's Session and event source.
 */
export class CommanderFeed {
  readonly view: SnapshotStore<CommanderView> = createSnapshotStore<CommanderView>(EMPTY)
  private sessionId: string | null = null
  private binding: SessionBinding | undefined
  private unsubscribeEvents: (() => void) | undefined
  private unsubscribeSession: (() => void) | undefined
  private unsubscribeList: (() => void) | undefined
  private lastWindow: unknown

  constructor(private readonly sessions: ISessions) {}

  /**
   * Point the feed at a session. Rebinding happens automatically once the
   * session list knows the id.
   * @param sessionId - commander id, or null to detach.
   */
  follow(sessionId: string | null): void {
    if (sessionId === this.sessionId) return
    this.sessionId = sessionId
    this.detach()
    if (sessionId === null) {
      this.view.set(EMPTY)
      return
    }
    this.view.set({ ...EMPTY, sessionId })
    this.tryBind()
    this.unsubscribeList = this.sessions.list.subscribe(() => { this.tryBind() })
  }

  dispose(): void {
    this.detach()
    this.sessionId = null
  }

  private tryBind(): void {
    if (this.binding !== undefined || this.sessionId === null) return
    const binding = this.sessions.binding(this.sessionId as SessionId)
    if (binding === undefined) return
    this.binding = binding
    this.unsubscribeEvents = binding.eventSource.subscribe(() => { this.publish() })
    this.unsubscribeSession = binding.session.subscribe(() => { this.publish() })
    this.publish()
  }

  private detach(): void {
    this.unsubscribeList?.()
    this.unsubscribeEvents?.()
    this.unsubscribeSession?.()
    this.unsubscribeList = undefined
    this.unsubscribeEvents = undefined
    this.unsubscribeSession = undefined
    this.binding = undefined
    this.lastWindow = undefined
  }

  private publish(): void {
    const binding = this.binding
    if (binding === undefined || this.sessionId === null) return
    const snapshot = binding.session.getSnapshot()
    const window = binding.eventSource.getSnapshot()
    const previous = this.view.getSnapshot()
    const transcript = window === this.lastWindow
      ? previous.transcript
      : foldTranscript(window.entries as unknown as readonly TranscriptEntry[])
    this.lastWindow = window
    this.view.set({
      sessionId: this.sessionId,
      bound: true,
      running: snapshot.running,
      openState: snapshot.openState,
      transcript,
    })
  }
}
