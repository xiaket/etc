/**
 * Browser half of dsh-baton: the workbench panel.
 *
 * Three slot registrations, all through `ctx.slots.inject` so they wait for
 * the declaring entries: a `sidebar.panellist` row, the `main` panel under
 * the `baton` key, and a `shell.overlay` toast stack. The conversation with
 * the commander goes through the ordinary Client session model
 * (`ctx.sessions.open` for the event window, `binding.session.prompt` to
 * send), so the official Conversation panel — and its workspace requirement —
 * is never rendered for the commander.
 *
 * @module dsh-baton/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { BatonIcon } from './BatonIcon.tsx'
import { BatonPanel } from './BatonPanel.tsx'
import { CommanderFeed } from './commander-feed.ts'
import type { BootState, PanelInjected, PanelPrefs, ToastInjected } from './contract.ts'
import { browserFeed } from './feed.ts'
import { NS, en, zh } from './locales.ts'
import { ensureStyles } from './styles.ts'
import { ToastStack } from './ToastStack.tsx'

/** Client plugin name. */
export const name = 'dsh-baton/client'

/** Required client services. */
export const inject = ['slots', 'sessions', 'layout', 'locale']

/** The `main` key and `sidebar.panellist` id of the workbench. */
const PANEL_ID = 'baton' as MainPanelId

/** How long the client waits for the session list to learn the commander id. */
const BIND_TIMEOUT_MS = 8_000

/**
 * Client plugin body.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ensureStyles()
  const sessions = ctx.sessions as unknown as ISessions
  const feed = browserFeed()
  const commander = new CommanderFeed(sessions)
  const prefs = createSnapshotStore<PanelPrefs>(
    { filter: 'all', sort: 'status', repoId: null, researchOnly: false },
    { persist: { name: 'dsh-baton.prefs' } },
  )
  const boot = createSnapshotStore<BootState>({ phase: 'idle', error: null })

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-baton: dictionaries')
  ctx.effect(() => {
    feed.start()
    return () => { feed.dispose(); commander.dispose() }
  }, 'dsh-baton: feeds')

  // Follow whatever the host says the commander is.
  ctx.effect(() => feed.state.subscribe(() => {
    commander.follow(feed.state.getSnapshot().commanderSessionId)
  }), 'dsh-baton: follow commander')

  /** Wait until the Client session list knows `id`, then make it current. */
  const openWhenListed = (id: string): Promise<void> => new Promise((resolve, reject) => {
    const tryOpen = (): boolean => {
      if (sessions.list.getSnapshot().byId[id as SessionId] === undefined) return false
      sessions.open(id as SessionId)
      return true
    }
    if (tryOpen()) { resolve(); return }
    void sessions.refresh()
    const timer = setTimeout(() => {
      stop()
      reject(new Error('the session list did not report the commander in time'))
    }, BIND_TIMEOUT_MS)
    const stop = sessions.list.subscribe(() => {
      if (tryOpen()) { clearTimeout(timer); stop(); resolve() }
    })
  })

  let activating: Promise<void> | undefined
  const activate = (): void => {
    if (activating !== undefined) return
    if (boot.getSnapshot().phase === 'ready') {
      // Re-selecting the panel after navigating away: put the commander back on stage.
      const id = feed.state.getSnapshot().commanderSessionId
      const list = sessions.list.getSnapshot()
      if (id !== null && list.current !== id && list.byId[id as SessionId] !== undefined) {
        sessions.open(id as SessionId)
      }
      return
    }
    boot.set({ phase: 'starting', error: null })
    activating = (async () => {
      const { sessionId } = await feed.ensureCommander()
      await openWhenListed(sessionId)
      commander.follow(sessionId)
      boot.set({ phase: 'ready', error: null })
    })().catch((error: unknown) => {
      boot.set({ phase: 'failed', error: error instanceof Error ? error.message : String(error) })
    }).finally(() => { activating = undefined })
  }

  const openSession = (sessionId: string): void => {
    sessions.open(sessionId as SessionId)
    ctx.layout.selectPanel(null)
  }

  const setLastError = (message: string | null): void => {
    feed.state.update(draft => { (draft as { lastError: string | null }).lastError = message })
  }

  const panelInjected = (): PanelInjected => ({
    activate,
    retryActivate: () => { boot.set({ phase: 'idle', error: null }); activate() },
    send: (text) => {
      const id = commander.view.getSnapshot().sessionId
      if (id === null) return
      const binding = sessions.binding(id as SessionId)
      if (binding === undefined) return
      void binding.session.prompt([{ type: 'text', text }], 'queue').then(result => {
        if (!result.ok) setLastError(result.error.message)
      })
    },
    stopCommander: () => {
      const id = commander.view.getSnapshot().sessionId
      if (id === null) return
      void sessions.binding(id as SessionId)?.session.cancel()
    },
    openSession,
    openCommanderFull: () => {
      const id = commander.view.getSnapshot().sessionId
      if (id !== null) openSession(id)
    },
    acknowledge: (taskId) => { void feed.acknowledge(taskId) },
    cancelTask: (taskId) => { void feed.cancelTask(taskId) },
    setFilter: (filter) => { prefs.update(draft => { (draft as { filter: PanelPrefs['filter'] }).filter = filter }) },
    setSort: (sort) => { prefs.update(draft => { (draft as { sort: PanelPrefs['sort'] }).sort = sort }) },
    setRepo: (repoId) => { prefs.update(draft => { (draft as { repoId: string | null }).repoId = repoId }) },
    setResearchOnly: (on) => { prefs.update(draft => { (draft as { researchOnly: boolean }).researchOnly = on }) },
    hooks: { baton: feed.state, commander: commander.view, prefs, boot },
  })

  const toastInjected = (): ToastInjected => ({
    openSession,
    dismiss: id => { feed.dismissNotice(id) },
    hooks: { notices: feed.notices },
  })

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 10,
    label: () => ctx.locale.bind(NS)('panel.label'),
    locale: NS,
  }, BatonIcon))

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: panelInjected,
  }, BatonPanel))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'baton-toasts',
    locale: NS,
    inject: toastInjected,
  }, ToastStack))
}
