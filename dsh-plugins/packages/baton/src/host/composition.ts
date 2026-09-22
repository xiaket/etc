/**
 * Agent composition: which agent preset a baton-created session mounts.
 *
 * The session controller gives every ordinary session its tools by mounting
 * an agent preset on the scoped context (`agentPresets.mount`). A session
 * created straight through `agents.create` gets none of that, so a worker
 * without this step has no bash/read/edit — only globally mounted MCP tools.
 * Baton mirrors the controller: resolve the preset once per creation, mount
 * it in `setup`, and record its id in `meta.agentPreset` so a later resume by
 * the controller composes the same world.
 *
 * @module dsh-baton/host/composition
 */

/** The agent-presets service slice baton reads. */
export interface AgentPresetsFace {
  /** Resolve a preset id (or the deployment default when undefined). */
  resolve(id?: string): Promise<{ id: string }>
  /** Mount a preset's tools and prompt sections on an agent's scoped context. */
  mount(agentCtx: unknown, id?: string): Promise<unknown>
}

/** What `agents.create` / `agents.resume` receive for one composed session. */
export interface Composition {
  /** Resolved preset id, absent when the deployment mounts no presets service. */
  readonly agentPreset: string | undefined
  /** Setup that mounts the preset, then runs `extra`. */
  readonly setup: (agentCtx: unknown) => Promise<void>
}

/**
 * Build the composition for one session.
 * @param presets - the presets service, or undefined when the deployment has none.
 * @param requested - configured preset id, or undefined for the default.
 * @param extra - additional scoped registrations (the commander's tools and prompt).
 * @returns the preset id and a setup callback.
 */
export async function compose(
  presets: AgentPresetsFace | undefined,
  requested: string | undefined,
  extra?: (agentCtx: unknown) => Promise<void> | void,
): Promise<Composition> {
  if (presets === undefined) {
    return { agentPreset: undefined, setup: async (agentCtx) => { await extra?.(agentCtx) } }
  }
  const { id } = await presets.resolve(requested)
  return {
    agentPreset: id,
    setup: async (agentCtx) => {
      await presets.mount(agentCtx, id)
      await extra?.(agentCtx)
    },
  }
}
