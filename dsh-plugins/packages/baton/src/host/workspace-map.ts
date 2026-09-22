/**
 * WorkspaceMap: persistent semantic descriptions of workspaces.
 *
 * The mapping is injected into the system prompt so the LLM can decide
 * which workspace a task belongs to. The LLM can update descriptions
 * via the baton_update_workspace_map tool.
 *
 * @module dsh-baton/host/workspace-map
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { WorkspaceMap, WorkspaceMapEntry } from '../shared/protocol.ts'

export class WorkspaceMapStore {
  private map: WorkspaceMap = {}
  private loaded = false
  private readonly file: string

  constructor(options: { file: string }) {
    this.file = options.file
  }

  /** Load the map from disk. */
  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await readFile(this.file, 'utf-8')
      const parsed = JSON.parse(raw) as WorkspaceMap
      if (typeof parsed === 'object' && parsed !== null) {
        this.map = parsed
      }
    } catch {
      // File missing — start empty.
    }
    this.loaded = true
  }

  /** Current snapshot. */
  snapshot(): WorkspaceMap {
    return this.map
  }

  /**
   * Sync with the workspace registry: add entries for new workspaces
   * (preserving existing descriptions), refresh moved paths, and drop entries
   * whose workspace no longer exists or that are excluded (a worktree-pool
   * container is a worker location, not a dispatch target).
   * @param workspaces - the registry's current rows.
   * @param exclude - predicate for rows that must not appear in the map.
   */
  async initFromWorkspaces(
    workspaces: Array<{ id: string; path: string; title: string }>,
    exclude: (ws: { id: string; path: string; title: string }) => boolean = () => false,
  ): Promise<void> {
    await this.load()
    let dirty = false
    const keep = new Set<string>()
    for (const ws of workspaces) {
      if (exclude(ws)) continue
      keep.add(ws.id)
      const entry = this.map[ws.id]
      if (entry === undefined) {
        this.map[ws.id] = { path: ws.path, description: '', aliases: [ws.title] }
        dirty = true
      } else if (entry.path !== ws.path) {
        entry.path = ws.path
        dirty = true
      }
    }
    for (const id of Object.keys(this.map)) {
      if (!keep.has(id)) {
        delete this.map[id]
        dirty = true
      }
    }
    if (dirty) await this.persist()
  }

  /**
   * Update one workspace entry. Merges with existing data.
   */
  async update(workspaceId: string, patch: Partial<WorkspaceMapEntry>): Promise<void> {
    await this.load()
    const existing = this.map[workspaceId]
    if (existing === undefined) {
      if (patch.path === undefined) throw new Error(`unknown workspace ${workspaceId} and no path provided`)
      this.map[workspaceId] = {
        path: patch.path,
        description: patch.description ?? '',
        ...(patch.aliases !== undefined ? { aliases: patch.aliases } : {}),
      }
    } else {
      if (patch.description !== undefined) existing.description = patch.description
      if (patch.aliases !== undefined) existing.aliases = patch.aliases
      if (patch.path !== undefined) existing.path = patch.path
    }
    await this.persist()
  }

  /** Render the map as a human-readable string for the system prompt. */
  render(): string {
    const entries = Object.entries(this.map)
    if (entries.length === 0) return '（尚未配置工作区描述）'
    return entries.map(([id, entry]) => {
      const aliases = entry.aliases !== undefined && entry.aliases.length > 0
        ? ` (别名: ${entry.aliases.join(', ')})`
        : ''
      const desc = entry.description.length > 0 ? entry.description : '（未描述）'
      return `- **${id}**${aliases}\n  路径: ${entry.path}\n  描述: ${desc}`
    }).join('\n')
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    await writeFile(this.file, JSON.stringify(this.map, null, 2) + '\n', 'utf-8')
  }
}
