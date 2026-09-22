/**
 * The five baton_* agent tools, registered on the commander's scoped context.
 *
 * @module dsh-baton/host/tools
 */
import type { WorkspaceMapStore } from './workspace-map.ts'
import type { TaskStore } from './store.ts'
import type { ExecutionEngine } from './execution.ts'
import {
  newTaskId,
  normalizeTitle,
  summarize,
  type TaskRecord,
} from '../shared/protocol.ts'
import { defineTool, type ToolDefinition } from './sdk.ts'

/** Workspace face for tool validation. */
export interface ToolWorkspaceFace {
  get(id: string): { id: string; path: string; title: string } | undefined
  list(): Array<{ id: string; path: string; title: string }>
}

/** Everything the tools need. */
export interface ToolDeps {
  store: TaskStore
  workspaces: ToolWorkspaceFace
  workspaceMap: WorkspaceMapStore
  engine: ExecutionEngine
  now: () => number
}

/** Render a task line for tool output. */
function taskLine(t: { id: string; title: string; status: string; workspaceId: string; error?: string; pendingInput?: { kind: string } }): string {
  const parts = [`- ${t.id} [${t.status}] · ${t.workspaceId} · 「${t.title}」`]
  if (t.pendingInput !== undefined) parts.push(`等待用户${t.pendingInput.kind === 'approval' ? '审批' : '回答'}`)
  if (t.error !== undefined) parts.push(`错误: ${t.error}`)
  return parts.join(' ')
}

/** JSON output helper. */
function json<T>(value: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

const JSON_OUT = { type: 'json' } as const

/**
 * Register all five tools.
 * @returns dispose functions.
 */
export function registerBatonTools(
  ctx: { tools: { register(tool: { name: string }): unknown } },
  deps: ToolDeps,
): Array<() => void> {
  const disposers: Array<() => void> = []
  const { store, workspaces, workspaceMap, engine } = deps

  // ---------------------------------------------------------------- dispatch
  disposers.push(ctx.tools.register(defineTool({
    name: 'baton_dispatch',
    description:
      'Dispatch a task to a workspace for execution. Creates a child session '
      + 'that works on the task independently. The workspaceId must match one of '
      + 'the configured workspaces from the workspace mapping in the system prompt.',
    parameters: {
      title: { type: 'string', required: true, description: 'Short task title (1..200 chars).' },
      description: { type: 'string', required: true, description: 'Full task description / prompt for the child session.' },
      workspaceId: { type: 'string', required: true, description: 'Target workspace id (from the workspace mapping).' },
    },
    output: {
      schema: JSON_OUT,
      render: (_args, value) => {
        const v = value as { task?: { id?: string; status?: string; isolation?: string } }
        if (v.task === undefined) return [{ type: 'text', text: '分派失败。' }]
        const where = v.task.isolation === 'worktree' ? '独立 worktree' : '仓库根目录（未隔离）'
        return [{ type: 'text', text: `已分派任务 ${v.task.id} [${v.task.status}]，运行于${where}。完成后页面会通知用户。` }]
      },
    },
    async execute(args: { title: string; description: string; workspaceId: string }) {
      const title = normalizeTitle(args.title)
      if (workspaces.get(args.workspaceId) === undefined) {
        throw new Error(`unknown workspace ${args.workspaceId}; check the workspace mapping`)
      }
      const now = deps.now()
      const task: TaskRecord = {
        id: newTaskId(),
        title,
        description: (args.description ?? '').trim(),
        workspaceId: args.workspaceId,
        status: 'pending',
        isolation: 'shared',
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      }
      await store.mutate('task-created', (ledger) => {
        ledger.tasks.push(task)
        return [task]
      })
      // Dispatch immediately.
      const result = await engine.dispatch(task)
      if ('error' in result) {
        throw new Error(`dispatch failed: ${result.error}`)
      }
      const updated = store.get(task.id)
      return json({ task: updated !== undefined ? summarize(updated) : summarize(task) })
    },
  })) as () => void)

  // ---------------------------------------------------------------- follow_up
  disposers.push(ctx.tools.register(defineTool({
    name: 'baton_follow_up',
    description:
      'Send a follow-up instruction to a task\'s worker session. Works while the '
      + 'worker is running or waiting for input, and revives a worker that is in '
      + 'review or failed but still held by this host.',
    parameters: {
      taskId: { type: 'string', required: true, description: 'Task id.' },
      instruction: { type: 'string', required: true, description: 'The follow-up instruction.' },
    },
    output: {
      schema: JSON_OUT,
      render: (_args, value) => {
        const v = value as { ok?: boolean; error?: string }
        return [{ type: 'text', text: v.ok ? '已发送跟进指令。' : `跟进失败: ${v.error ?? '未知错误'}` }]
      },
    },
    async execute(args: { taskId: string; instruction: string }) {
      const task = store.get(args.taskId)
      if (task === undefined) throw new Error(`no task ${args.taskId}`)
      const result = await engine.followUp(args.taskId, args.instruction)
      if (!result.ok) throw new Error(result.error)
      return json(result)
    },
  })) as () => void)

  // ---------------------------------------------------------------- status
  disposers.push(ctx.tools.register(defineTool({
    name: 'baton_status',
    description:
      'View task status. Without taskId lists every task that is not completed or cancelled. With taskId shows full details.',
    parameters: {
      taskId: { type: 'string', description: 'Optional task id for details.' },
    },
    output: {
      schema: JSON_OUT,
      render: (_args, value) => {
        const v = value as { tasks?: Array<Record<string, unknown>>; task?: Record<string, unknown> }
        if (v.task !== undefined) {
          const t = v.task as { id?: string; title?: string; status?: string; workspaceId?: string; error?: string; resultSummary?: string }
          const lines = [
            `任务 ${t.id} 「${t.title}」`,
            `状态: ${t.status} · 工作区: ${t.workspaceId}`,
          ]
          if (t.error !== undefined) lines.push(`错误: ${t.error}`)
          if (t.resultSummary !== undefined) lines.push(`结果: ${t.resultSummary}`)
          return [{ type: 'text', text: lines.join('\n') }]
        }
        const tasks = v.tasks ?? []
        if (tasks.length === 0) return [{ type: 'text', text: '当前没有任务。' }]
        return [{ type: 'text', text: `任务 ${tasks.length} 个：\n${tasks.map(t => taskLine(t as never)).join('\n')}` }]
      },
    },
    async execute(args: { taskId?: string }) {
      if (args.taskId !== undefined) {
        const task = store.get(args.taskId)
        if (task === undefined) throw new Error(`no task ${args.taskId}`)
        return json({ task: summarize(task) })
      }
      const tasks = store.snapshot().tasks.filter(t =>
        t.status !== 'completed' && t.status !== 'cancelled')
      return json({ tasks: tasks.map(summarize) })
    },
  })) as () => void)

  // ---------------------------------------------------------------- cancel
  disposers.push(ctx.tools.register(defineTool({
    name: 'baton_cancel',
    description: 'Cancel a task. A live worker session is stopped.',
    parameters: {
      taskId: { type: 'string', required: true, description: 'Task id.' },
    },
    output: {
      schema: JSON_OUT,
      render: (_args, value) => {
        const v = value as { ok?: boolean; error?: string }
        return [{ type: 'text', text: v.ok ? '任务已取消。' : `取消失败: ${v.error ?? '未知错误'}` }]
      },
    },
    async execute(args: { taskId: string }) {
      const result = await engine.cancel(args.taskId)
      if (!result.ok) throw new Error(result.error)
      return json(result)
    },
  })) as () => void)

  // -------------------------------------------------------- update_workspace_map
  disposers.push(ctx.tools.register(defineTool({
    name: 'baton_update_workspace_map',
    description:
      'Update the workspace semantic description mapping. Use when a workspace '
      + 'description is missing, incorrect, or needs additional aliases.',
    parameters: {
      workspaceId: { type: 'string', required: true, description: 'Workspace id to update.' },
      description: { type: 'string', description: 'New description of what this workspace/repo is for.' },
      aliases: {
        type: 'array',
        description: 'Short names or keywords for this workspace.',
        items: { type: 'string' },
      },
    },
    output: {
      schema: JSON_OUT,
      render: (_args, value) => {
        const v = value as { ok?: boolean }
        return [{ type: 'text', text: v.ok ? '工作区描述已更新。' : '更新失败。' }]
      },
    },
    async execute(args: { workspaceId: string; description?: string; aliases?: string[] }) {
      await workspaceMap.update(args.workspaceId, {
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...(args.aliases !== undefined ? { aliases: args.aliases } : {}),
      })
      return json({ ok: true })
    },
  })) as () => void)

  return disposers
}
