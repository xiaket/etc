/**
 * Commander: the single long-lived session the user talks to from the
 * workbench panel. The host owns its agent handle for the whole process
 * lifetime so the session controller's `prompt()` reuses this agent (with the
 * baton tools installed by `setup`) instead of resuming a bare one.
 *
 * The session is created with `meta.cwd` only and never attached to a
 * Workspace record, then archived so no sidebar grouping shows it.
 *
 * @module dsh-baton/host/commander
 */
import { mkdir } from 'node:fs/promises'
import { compose, type AgentPresetsFace } from './composition.ts'
import type { TaskStore } from './store.ts'

/** Agent runtime slice the commander needs. */
export interface CommanderAgentsFace {
  create(options: {
    sessionId: string
    meta: { cwd: string; agentPreset?: string }
    agentOptions?: { provider?: string; model?: string }
    setup: (agentCtx: unknown) => Promise<void> | void
  }): Promise<CommanderHandle>
  resume(options: {
    resumeSessionId: string
    agentOptions?: { provider?: string; model?: string }
    setup: (agentCtx: unknown) => Promise<void> | void
  }): Promise<CommanderHandle>
}

/** The commander's live handle. */
export interface CommanderHandle {
  agent: {
    inject(message: {
      id: string
      role: 'user'
      content: Array<{ type: 'text'; text: string }>
      source: { kind: 'plugin'; plugin: string }
    }): void
  }
  dispose(): Promise<void>
}

/** Workspace registry slice: hide the commander from the sidebar. */
export interface CommanderWorkspaceFace {
  archiveSession(sessionId: string): Promise<void>
}

/** Optional title service slice. */
export interface CommanderTitleFace {
  rename(sessionId: string, title: string): void
}

/** Everything the commander needs. */
export interface CommanderDeps {
  store: TaskStore
  agents: CommanderAgentsFace
  workspaces: CommanderWorkspaceFace
  title?: CommanderTitleFace | undefined
  cwd: string
  /** Unset follows the deployment default. */
  model?: { provider: string; model: string }
  displayTitle: string
  /** Agent presets service; undefined when the deployment mounts none. */
  presets: AgentPresetsFace | undefined
  /** Preset id the commander mounts; undefined selects the deployment default. */
  preset: string | undefined
  /** Baton's own scoped registrations, run after the preset mounts. */
  setup: (agentCtx: unknown) => Promise<void> | void
  log: (message: string, ...rest: unknown[]) => void
}

/** Result of {@link Commander.ensure}. */
export interface EnsureResult {
  sessionId: string
  created: boolean
}

/**
 * Owns the commander session handle.
 */
export class Commander {
  private handle: CommanderHandle | undefined
  private sessionId: string | undefined
  private ensuring: Promise<EnsureResult> | undefined

  constructor(private readonly deps: CommanderDeps) {}

  /** @returns the live session id, or undefined before the first ensure. */
  current(): string | undefined {
    return this.sessionId
  }

  /**
   * Resume the recorded commander session, or create one. Concurrent calls
   * share one in-flight attempt.
   */
  ensure(): Promise<EnsureResult> {
    if (this.handle !== undefined && this.sessionId !== undefined) {
      return Promise.resolve({ sessionId: this.sessionId, created: false })
    }
    if (this.ensuring === undefined) {
      this.ensuring = this.doEnsure().finally(() => { this.ensuring = undefined })
    }
    return this.ensuring
  }

  /**
   * Tell the commander something happened, as a plugin message it reads on
   * its next turn. No-op before the commander exists.
   * @param text - the notice.
   */
  notify(text: string): void {
    if (this.handle === undefined) return
    this.handle.agent.inject({
      id: `msg-baton-${crypto.randomUUID()}`,
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'plugin', plugin: 'dsh-baton' },
    })
  }

  async dispose(): Promise<void> {
    const handle = this.handle
    this.handle = undefined
    if (handle !== undefined) {
      try { await handle.dispose() } catch { /* already gone */ }
    }
  }

  private async doEnsure(): Promise<EnsureResult> {
    await mkdir(this.deps.cwd, { recursive: true })
    const recorded = await this.deps.store.read(ledger => ledger.commanderSessionId)
    const composition = await compose(this.deps.presets, this.deps.preset, this.deps.setup)
    if (recorded !== undefined) {
      try {
        this.handle = await this.deps.agents.resume({
          resumeSessionId: recorded,
          ...(this.deps.model === undefined ? {} : { agentOptions: this.deps.model }),
          setup: composition.setup,
        })
        this.sessionId = recorded
        this.deps.log(`resumed commander ${recorded}`)
        return { sessionId: recorded, created: false }
      } catch (error) {
        this.deps.log(`commander ${recorded} could not be resumed, creating a new one:`, error)
      }
    }

    const sessionId = `session-baton-commander-${crypto.randomUUID()}`
    this.handle = await this.deps.agents.create({
      sessionId,
      meta: { cwd: this.deps.cwd, ...(composition.agentPreset === undefined ? {} : { agentPreset: composition.agentPreset }) },
      ...(this.deps.model === undefined ? {} : { agentOptions: this.deps.model }),
      setup: composition.setup,
    })
    this.sessionId = sessionId
    await this.deps.store.mutate('commander-created', (ledger) => {
      ledger.commanderSessionId = sessionId
      return []
    })
    try {
      await this.deps.workspaces.archiveSession(sessionId)
    } catch (error) {
      this.deps.log('commander could not be archived; it will show under Ungrouped:', error)
    }
    try {
      this.deps.title?.rename(sessionId, this.deps.displayTitle)
    } catch (error) {
      this.deps.log('commander rename failed:', error)
    }
    this.deps.log(`created commander ${sessionId} in ${this.deps.cwd}`)
    return { sessionId, created: true }
  }
}
