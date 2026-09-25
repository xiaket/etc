/**
 * Host loader entry for dsh-baton.
 *
 * Owns the task ledger, the workspace map, the commander session, the worker
 * execution engine, and the HTTP/SSE routes the workbench panel talks to.
 * Conversation with the commander itself goes through the ordinary session
 * controller; the commander's tools and system prompt are installed on its
 * scoped context by `setup`, so the host must hold the commander's agent
 * handle for the whole process lifetime.
 *
 * @module dsh-baton
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-workspace'
import { PROTOCOL_SECTION_NAME, PROTOCOL_SECTION_ORDER, buildProtocol } from './host/protocol-text.ts'
import { Commander, type CommanderAgentsFace, type CommanderWorkspaceFace } from './host/commander.ts'
import { expandConfigPath } from './host/config-path.ts'
import type { AgentPresetsFace } from './host/composition.ts'
import { ExecutionEngine, type AgentsFace, type EventsFace, type WorktreePoolFace } from './host/execution.ts'
import { NotificationService } from './host/notification.ts'
import { registerBatonRoutes } from './host/routes.ts'
import { dshHomePath } from './host/sdk.ts'
import { TaskStore } from './host/store.ts'
import { WorkspaceMapStore } from './host/workspace-map.ts'
import { registerBatonTools, type ToolWorkspaceFace } from './host/tools.ts'
import type { StateResponse } from './shared/api.ts'
import { summarize, type TaskRecord } from './shared/protocol.ts'

export const LEDGER_FILE = 'dsh-baton.json'
export const MAP_FILE = 'dsh-baton-workspace-map.json'
export const name = 'dsh-baton'

/** Services required before the plugin body runs. */
export const inject = ['workspaceRegistry', 'agents']

/** One model selection. */
export interface ModelRef {
  provider: string
  model: string
}

/** Resolved plugin configuration. */
export interface Config {
  /** Model for the commander session; unset follows the deployment default. */
  commanderModel?: ModelRef
  /** Model for every worker session; unset follows the deployment default. */
  workerModel?: ModelRef
  /** Working directory of the commander session; created when missing. */
  commanderCwd: string
  /** Sidebar/tab title of the commander session. */
  commanderTitle: string
  /** Agent preset the commander mounts; empty selects the deployment default. */
  commanderPreset: string
  /** Agent preset every worker mounts; empty selects the deployment default. */
  workerPreset: string
  /** Environment facts appended to every worker's framing, one line each. */
  workerNotes: string[]
  /** Maximum characters kept from a worker's final assistant text. */
  summaryLimit: number
}

const modelRef = z.object({
  provider: z.string().required().description('Provider id as registered with the harness (for example `amazon-bedrock`).'),
  model: z.string().required().description('Model id on that provider.'),
})

/**
 * Config schema. Models and the commander directory vary per deployment.
 */
export const Config: z<Partial<Config>, Omit<Config, 'commanderModel' | 'workerModel'> & {
  commanderModel: ModelRef | undefined
  workerModel: ModelRef | undefined
}> = z.object({
  commanderModel: z.union([modelRef, z.const(undefined)])
    .description('Model for the commander session. Unset follows the deployment default.'),
  workerModel: z.union([modelRef, z.const(undefined)])
    .description('Model for worker sessions. Unset follows the deployment default.'),
  commanderCwd: z.string().default(dshHomePath('baton'))
    .description('Working directory of the commander session. Not a workspace; created when missing.'),
  commanderTitle: z.string().default('代码工作台').description('Title shown for the commander session.'),
  commanderPreset: z.string().default('')
    .description('Agent preset id the commander mounts (tools, prompt sections). Empty selects the deployment default.'),
  workerPreset: z.string().default('')
    .description('Agent preset id every worker mounts. Empty selects the deployment default, the same one an ordinary new session gets.'),
  workerNotes: z.array(z.string())
    .default([])
    .description('Environment facts appended to every worker\'s framing message, one line each (available CLIs, credential locations, house rules).'),
  summaryLimit: z.natural().default(500).description('Maximum characters kept from a worker\'s final assistant text.'),
})

/** Workspace registry rows the plugin reads. */
interface RegistryWorkspace { id: string; path: string; title: string }

/** The registry slice this plugin touches. */
interface RegistryFace {
  get(id: never): RegistryWorkspace | undefined
  list(): RegistryWorkspace[]
  archiveSession(sessionId: never): Promise<void>
}

function workspaceFace(registry: RegistryFace): ToolWorkspaceFace {
  return {
    get: id => {
      const ws = registry.get(id as never)
      return ws === undefined ? undefined : { id: ws.id, path: ws.path, title: ws.title }
    },
    list: () => registry.list().map(ws => ({ id: ws.id, path: ws.path, title: ws.title })),
  }
}

/**
 * A worktree-pool container or the commander's own directory is where work
 * runs, never where the commander dispatches to.
 * @param ws - registry row.
 * @returns true when the row must stay out of the workspace map.
 */
function isWorkerLocation(ws: { path: string; title: string }): boolean {
  return /(^|\/)wtpool-[0-9a-f]+$/.test(ws.path) || ws.title.startsWith('wtpool-') || ws.title === 'baton'
}

const log = (message: string, ...rest: unknown[]): void => {
  console.error(`[dsh-baton] ${message}`, ...rest)
}

/**
 * Plugin body.
 * @param ctx - host context with `workspaceRegistry` and `agents`.
 * @param config - validated configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const store = new TaskStore({ file: dshHomePath(LEDGER_FILE) })
  const wsMap = new WorkspaceMapStore({ file: dshHomePath(MAP_FILE) })
  const notification = new NotificationService()
  const now = (): number => Date.now()
  const registry = ctx.workspaceRegistry as unknown as RegistryFace
  const workspaces = workspaceFace(registry)

  const state = (): StateResponse => {
    const ledger = store.snapshot()
    return {
      revision: ledger.revision,
      tasks: ledger.tasks.map(summarize),
      workspaceMap: wsMap.snapshot(),
      commander: { sessionId: ledger.commanderSessionId ?? null },
    }
  }

  const events: EventsFace = {
    onSessionEvent: listener => ctx.on('session/event', (session, event) => {
      listener(session.id, event as { type: string; data?: unknown })
    }),
  }

  let worktreePool: WorktreePoolFace | undefined
  try {
    const pool = ctx.get('worktreePool') as { acquire?: unknown } | undefined
    if (typeof pool?.acquire === 'function') worktreePool = pool as unknown as WorktreePoolFace
  } catch (error) {
    log('worktree pool lookup failed; workers run in workspace roots:', error)
  }

  // Declared below; referenced from the engine's settlement sink.
  let commander: Commander | undefined

  const presets = ctx.get('agentPresets') as AgentPresetsFace | undefined
  if (presets === undefined) log('no agentPresets service; baton sessions get only globally mounted tools')
  const presetOrDefault = (id: string): string | undefined => id.length > 0 ? id : undefined

  const engine = new ExecutionEngine({
    store,
    agents: ctx.agents as unknown as AgentsFace,
    workspaces,
    events,
    ...(config.workerModel === undefined ? {} : { workerModel: config.workerModel }),
    workerNotes: config.workerNotes,
    presets,
    workerPreset: presetOrDefault(config.workerPreset),
    worktreePool,
    now,
    summaryLimit: config.summaryLimit,
    settle: {
      onSettled: (task: TaskRecord, outcome) => {
        notification.pushSettled(summarize(task), outcome)
        const verdict = outcome === 'in_review' ? '已完成，等待你审阅' : `失败：${task.error ?? '未知原因'}`
        const summary = task.resultSummary !== undefined ? `\n结果摘要：${task.resultSummary}` : ''
        commander?.notify(`[baton] 任务 ${task.id}「${task.title}」${verdict}。${summary}`)
      },
    },
  })

  const setup = async (agentScopedCtx: unknown): Promise<void> => {
    const scoped = agentScopedCtx as Context
    scoped.systemPrompt.section({
      name: PROTOCOL_SECTION_NAME,
      order: PROTOCOL_SECTION_ORDER,
      get text() { return buildProtocol(wsMap, config.workerNotes) },
    })
    registerBatonTools(scoped, { store, workspaces, workspaceMap: wsMap, engine, now })
  }

  const titleService = ctx.get('sessionTitle') as { rename(session: unknown, title: string): unknown } | undefined
  const sessionsService = ctx.get('sessions') as { get(id: string): unknown } | undefined

  commander = new Commander({
    store,
    agents: ctx.agents as unknown as CommanderAgentsFace,
    workspaces: {
      archiveSession: id => registry.archiveSession(id as never),
    } satisfies CommanderWorkspaceFace,
    title: titleService === undefined || sessionsService === undefined
      ? undefined
      : {
        rename: (sessionId, title) => {
          const session = sessionsService.get(sessionId)
          if (session !== undefined) titleService.rename(session, title)
        },
      },
    cwd: expandConfigPath(config.commanderCwd),
    ...(config.commanderModel === undefined ? {} : { model: config.commanderModel }),
    displayTitle: config.commanderTitle,
    presets,
    preset: presetOrDefault(config.commanderPreset),
    setup,
    log,
  })

  ctx.effect(() => {
    const unsubscribe = store.subscribe(() => { notification.pushState(state()) })
    return () => {
      unsubscribe()
      engine.dispose()
      notification.dispose()
      void engine.disposeAll()
      void commander?.dispose()
    }
  }, 'dsh-baton: host services')

  // Boot: load stores, mark orphaned live tasks failed, hold the commander.
  void (async () => {
    await store.load()
    await wsMap.load()
    await wsMap.initFromWorkspaces(workspaces.list(), isWorkerLocation)
    await engine.reconcileAfterRestart()
    if (store.snapshot().commanderSessionId !== undefined) {
      try {
        await commander?.ensure()
      } catch (error) {
        log('commander resume at boot failed; it will be created on first use:', error)
      }
    }
  })().catch((error: unknown) => { log('boot failed:', error) })

  ctx.inject(['webServer'], (webCtx: Context) => registerBatonRoutes(webCtx, {
    notification,
    state,
    ensureCommander: async () => {
      if (commander === undefined) throw new Error('commander not initialized')
      return commander.ensure()
    },
    acknowledge: id => engine.acknowledge(id),
    cancel: id => engine.cancel(id),
  }))
}
