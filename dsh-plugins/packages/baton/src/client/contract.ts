/**
 * Component prop contracts for the workbench panel, derived from the slot
 * shares plus this plugin's own inject face.
 *
 * @module dsh-baton/client/contract
 */
import type { ComposedProps, HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { CommanderView } from './commander-feed.ts'
import type { BatonState, SettledNotice } from './feed.ts'
import type { TaskFilter, TaskSort } from './view-model.ts'

/** Shared viewing state of the panel: chips, sort, composer options. */
export interface PanelPrefs {
  readonly filter: TaskFilter
  readonly sort: TaskSort
  readonly repoId: string | null
  readonly researchOnly: boolean
}

/** Commander bootstrap state the panel shows before the transcript exists. */
export interface BootState {
  readonly phase: 'idle' | 'starting' | 'ready' | 'failed'
  readonly error: string | null
}

/** Injected face of the `main`/`baton` entry: callbacks plus reactive sources. */
export interface PanelInjected {
  /** Make sure the commander exists and is the current session. */
  activate(): void
  /** Retry after a failed activation. */
  retryActivate(): void
  /** Send one prompt to the commander (already composed). */
  send(text: string): void
  /** Cancel the commander's current turn. */
  stopCommander(): void
  /** Open any session in the ordinary Conversation panel. */
  openSession(sessionId: string): void
  /** Show the commander in the ordinary Conversation panel. */
  openCommanderFull(): void
  acknowledge(taskId: string): void
  cancelTask(taskId: string): void
  setFilter(filter: TaskFilter): void
  setSort(sort: TaskSort): void
  setRepo(repoId: string | null): void
  setResearchOnly(on: boolean): void
  hooks: {
    baton: HostObservable<BatonState>
    commander: HostObservable<CommanderView>
    prefs: HostObservable<PanelPrefs>
    boot: HostObservable<BootState>
  }
}

/** Props of the panel body. */
export type PanelProps = ComposedProps<'main', 'baton', never, undefined, PanelInjected, never, 'baton'>

/** Injected face of the toast stack. */
export interface ToastInjected {
  openSession(sessionId: string): void
  dismiss(id: string): void
  hooks: {
    notices: HostObservable<readonly SettledNotice[]>
  }
}

/** Props of the overlay toast stack. */
export type ToastProps = ComposedProps<'shell.overlay', never, never, undefined, ToastInjected, never, 'baton'>

/** Props of the sidebar icon. */
export type IconProps = ComposedProps<'sidebar.panellist', never, never, undefined, Record<never, never>, never, 'baton'>
