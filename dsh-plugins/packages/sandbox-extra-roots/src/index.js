/**
 * dsh-sandbox-extra-roots — grant extra writable roots to confined executions
 * AND to the fs write/edit tools, under `workspace-write` only.
 *
 * DSH fences writes two independent ways, both derived from the single
 * `workspaceRoot` in the resolved policy:
 *   - bash one-shot: `ctx.sandbox.confine()` runs under `writableRoots(policy)`
 *     = [workspaceRoot, /tmp, os.tmpdir()], so a tool writing under $HOME/.cache
 *     is denied by the process sandbox.
 *   - fs write/edit tools: `SandboxedFileSystem.checkedTarget()` denies any
 *     target outside those same roots with `FS_SANDBOX_DENIED`.
 * Granting a directory therefore needs BOTH fences widened; this plugin wraps
 * both. Reads are never fenced by DSH (landlock `readOnly:['/']`, bwrap
 * `--ro-bind / /`, and the fs read tool is unfenced), so this plugin is about
 * writes only.
 *
 * Four grant sources, unioned per call:
 *   - `roots`: global, every workspace-write session (e.g. ~/.cache/bazel).
 *   - `grants: [{ repoRoot, roots }]`: configured, applied only when the
 *     session's workspace root is at or under `repoRoot`.
 *   - workspace grants: durable (storage domain `sandbox_extra_roots`), keyed
 *     by the session's workspace — the worktree-pool repository root when that
 *     plugin owns the session, else the session cwd. Applied when the workspace
 *     key equals the repo root or contains the workspace root. Written by
 *     `/grant-dir workspace <path>` or by the denial prompt. Enable with
 *     `allowWorkspaceGrants` (default true; needs `storageDomain`).
 *   - session grants: in memory, keyed by session id, cleared on restart.
 *     Written by `/grant-dir <path>` or by the denial prompt. Enable with
 *     `allowSessionGrants` (default true).
 *
 * The denial prompt (`promptOnDenial`, default true): when a workspace-write
 * call is refused, the plugin asks the session's user through
 * `ctx.userQuestions` which directory to grant and for which scope. A granted
 * fs write/edit is retried once immediately; a granted bash command is NOT
 * rerun (it may not be idempotent) — the result tells the model to rerun it.
 * Delegated child agents, agent-less calls, and sessions without a UI never
 * see a prompt and keep the plain denial.
 *
 * Extra roots apply ONLY under `workspace-write` — `read-only` and
 * `danger-full-access` are unaffected. Missing roots are skipped per call
 * (landlock-run fails the whole command on a nonexistent rule path).
 *
 * NOTE: this reaches into the runner argv dialect of dsh-sandbox-local, the
 * method surface of dsh-fs-sandbox, and the `result.sandbox.denied` fact of
 * dsh-bash-sandbox (verified against dsh 0.1.1-rc.2 .. 0.1.6-alpha.1); a
 * future DSH that grows a first-class extra-writable-roots config supersedes it.
 */
import { existsSync, realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, resolve, sep } from 'node:path'
import { ancestorCandidates, askGrant, filterCandidates, isDirectory, stderrCandidates } from './prompt.js'
import { grantsDomainSpec } from './spec.js'

export const name = 'dsh-sandbox-extra-roots'
export const inject = ['sandbox']

/** Expand a leading `~` and resolve to an absolute path against `base`. */
function expandHome(p, base) {
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return resolve(homedir(), p.slice(2))
  return base === undefined ? resolve(p) : resolve(base, p)
}

/** Canonicalize a path for containment tests, tolerating a missing target. */
function canonical(p) {
  try {
    return realpathSync(p)
  } catch {
    // Missing or unreadable: compare the spelled path instead.
    return resolve(p)
  }
}

/** Whether `child` is at or under `parent` (both treated as canonical paths). */
function isWithin(child, parent) {
  if (child === parent) return true
  return child.startsWith(parent.endsWith(sep) ? parent : parent + sep)
}

/** Read a string-array config field, dropping blanks; `~` expands to home. */
function readRoots(value) {
  return Array.isArray(value)
    ? value.filter(r => typeof r === 'string' && r.trim() !== '').map(r => expandHome(r))
    : []
}

/** The DSH default writable roots for a workspace-write policy (mirrors dsh-sandbox `writableRoots`). */
function defaultWritableRoots(policy) {
  return [...new Set([policy.workspaceRoot, '/tmp', tmpdir()].filter(r => typeof r === 'string').map(canonical))]
}

/** Quote one path as an SBPL string literal (matching dsh-sandbox-local). */
function sbplString(path) {
  return `"${path.replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`)}"`
}

/** Add writable subpaths to an existing sandbox-exec SBPL profile. */
function addSeatbeltGrants(profile, roots) {
  const grants = roots.map(root => `(subpath ${sbplString(root)})`).join(' ')
  return `${profile}\n(allow file-write* ${grants})`
}

export function apply(ctx, config) {
  const globalRoots = readRoots(config?.roots)
  const repoGrants = Array.isArray(config?.grants)
    ? config.grants
      .filter(g => g !== null && typeof g === 'object' && typeof g.repoRoot === 'string')
      .map(g => ({ repoRoot: canonical(expandHome(g.repoRoot)), roots: readRoots(g.roots) }))
      .filter(g => g.roots.length > 0)
    : []
  const allowSessionGrants = config?.allowSessionGrants !== false
  const allowWorkspaceGrants = config?.allowWorkspaceGrants !== false
  const promptOnDenial = config?.promptOnDenial !== false

  // Per-session ad-hoc grants, keyed by session id. In memory by design: a
  // session grant is a deliberate, transient act, and persisting it would
  // silently widen a session's authority across restarts.
  const sessionGrants = new Map()

  // Nothing can ever be granted: leave every seam untouched (a true no-op).
  if (globalRoots.length === 0 && repoGrants.length === 0 && !allowSessionGrants && !allowWorkspaceGrants) {
    console.warn('[sandbox-extra-roots] nothing configured and session/workspace grants disabled; plugin is a no-op')
    return
  }

  // --- durable workspace grants: the storage domain, opened when available. ---
  /** The open `workspace_grants` table, or undefined until `storageDomain` mounts. */
  let workspaceTable
  if (allowWorkspaceGrants) {
    ctx.inject(['storageDomain'], (scope) => {
      let domain
      const opening = scope.storageDomain.open(grantsDomainSpec).then((opened) => {
        domain = opened
        workspaceTable = opened.table('workspace_grants')
      }, (error) => {
        console.warn(`[sandbox-extra-roots] workspace grants unavailable: ${String(error)}`)
      })
      scope.effect(() => async () => {
        await opening
        workspaceTable = undefined
        await domain?.close()
      })
    })
  }

  /**
   * The workspace a durable grant for this policy belongs to: the worktree
   * pool's repository root when it owns the session, else the workspace root.
   * Undefined when workspace grants are unavailable.
   */
  const workspaceKeyFor = (policy) => {
    if (workspaceTable === undefined) return undefined
    const pool = ctx.get('worktreePool')
    const entry = pool !== undefined && typeof policy?.sessionId === 'string' ? pool.forSession(policy.sessionId) : undefined
    const base = typeof entry?.repoRoot === 'string' ? entry.repoRoot : policy?.workspaceRoot
    return typeof base === 'string' ? canonical(base) : undefined
  }

  /** Workspace grants that apply to this policy: the exact key row plus any row containing the workspace root. */
  const workspaceRootsFor = (policy) => {
    if (workspaceTable === undefined) return []
    const out = new Set()
    const key = workspaceKeyFor(policy)
    if (key !== undefined) for (const root of workspaceTable.get(key)?.roots ?? []) out.add(root)
    const workspaceRoot = typeof policy.workspaceRoot === 'string' ? canonical(policy.workspaceRoot) : undefined
    if (workspaceRoot !== undefined) {
      for (const [row, value] of workspaceTable.entries()) {
        if (isWithin(workspaceRoot, row)) for (const root of value.roots) out.add(root)
      }
    }
    return [...out]
  }

  /** Persist one root for a workspace key. */
  const addWorkspaceGrant = async (key, root) => {
    const current = workspaceTable.get(key)?.roots ?? []
    if (!current.includes(root)) await workspaceTable.put(key, { roots: [...current, root] })
  }

  /** Remove one root for a workspace key; returns whether it was present. */
  const removeWorkspaceGrant = async (key, root) => {
    const current = workspaceTable.get(key)?.roots ?? []
    if (!current.includes(root)) return false
    const next = current.filter(r => r !== root)
    if (next.length === 0) await workspaceTable.delete(key)
    else await workspaceTable.put(key, { roots: next })
    return true
  }

  /**
   * The writable roots this policy earns beyond the DSH defaults. Empty unless
   * the mode is `workspace-write`; missing directories are dropped last so a
   * grant that names a not-yet-created path never breaks a command.
   */
  const extraRootsFor = (policy) => {
    if (policy?.mode !== 'workspace-write') return []
    const out = new Set(globalRoots)
    const workspaceRoot = typeof policy.workspaceRoot === 'string' ? canonical(policy.workspaceRoot) : undefined
    if (workspaceRoot !== undefined) {
      for (const grant of repoGrants) {
        if (isWithin(workspaceRoot, grant.repoRoot)) for (const root of grant.roots) out.add(root)
      }
    }
    for (const root of workspaceRootsFor(policy)) out.add(root)
    const session = policy.sessionId === undefined ? undefined : sessionGrants.get(policy.sessionId)
    if (session !== undefined) for (const root of session) out.add(root)
    return [...out].filter(existsSync)
  }

  /**
   * Apply a grant the user chose (prompt or command).
   * @returns the user-facing confirmation line.
   */
  const applyGrant = async (policy, dir, scope) => {
    if (scope === 'workspace') {
      const key = workspaceKeyFor(policy)
      if (key === undefined) throw new Error('workspace grants are unavailable (no storageDomain)')
      await addWorkspaceGrant(key, dir)
      return `granted write access to ${dir} for every session in ${key}`
    }
    const set = sessionGrants.get(policy.sessionId) ?? new Set()
    set.add(dir)
    sessionGrants.set(policy.sessionId, set)
    return `granted write access to ${dir} for this session`
  }

  // --- the denial prompt, shared by the fs and bash hooks. -----------------
  /** Sessions with a prompt in flight: concurrent denials in one session ask once. */
  const prompting = new Set()

  /**
   * Ask the user about a denial and apply their answer.
   * @returns the confirmation line, or undefined when nothing was granted.
   */
  const promptAndGrant = async ({ policy, candidates, subject, signal }) => {
    if (!promptOnDenial || policy?.mode !== 'workspace-write' || typeof policy.sessionId !== 'string') return undefined
    const workspaceKey = workspaceKeyFor(policy)
    if (!allowSessionGrants && workspaceKey === undefined) return undefined
    if (prompting.has(policy.sessionId)) return undefined
    prompting.add(policy.sessionId)
    try {
      const writable = [...defaultWritableRoots(policy), ...extraRootsFor(policy)]
      const choice = await askGrant({
        ctx,
        policy,
        candidates: filterCandidates(candidates, writable),
        workspaceKey,
        allowSession: allowSessionGrants,
        subject,
        signal,
        canonical,
      })
      if (choice === undefined) return undefined
      return await applyGrant(policy, choice.dir, choice.scope)
    } finally {
      prompting.delete(policy.sessionId)
    }
  }

  // --- bash one-shot writes: widen the process-sandbox grant argv. ---------
  const sandbox = ctx.sandbox
  const origConfine = sandbox.confine.bind(sandbox)
  const warned = new Set()

  sandbox.confine = function confine(argv, policy, signal) {
    const confined = origConfine(argv, policy, signal)
    const roots = extraRootsFor(policy)
    if (roots.length === 0) return confined

    const runner = basename(confined.argv[0] ?? '')
    const separator = confined.argv.indexOf('--')
    if (separator === -1) return confined

    let grant
    if (runner === 'landlock-run') {
      grant = roots.flatMap(r => ['--rw', r])
    } else if (runner === 'bwrap') {
      grant = roots.flatMap(r => ['--bind', r, r])
    } else if (runner === 'sandbox-exec') {
      // DSH's macOS runner uses `sandbox-exec -p <SBPL> -- <command>`.
      // Preserve its base policy and add a single allow rule for every root.
      const profile = confined.argv.indexOf('-p')
      if (profile === -1 || profile + 1 >= separator || typeof confined.argv[profile + 1] !== 'string') {
        if (!warned.has(runner)) {
          warned.add(runner)
          console.warn('[sandbox-extra-roots] sandbox-exec argv has no SBPL profile; extra roots not granted to bash')
        }
        return confined
      }
      const argv = [...confined.argv]
      argv[profile + 1] = addSeatbeltGrants(argv[profile + 1], roots)
      return { ...confined, argv }
    } else {
      if (!warned.has(runner)) {
        warned.add(runner)
        console.warn(`[sandbox-extra-roots] unsupported runner "${runner}"; extra roots not granted to bash`)
      }
      return confined
    }
    return {
      ...confined,
      argv: [...confined.argv.slice(0, separator), ...grant, ...confined.argv.slice(separator)],
    }
  }

  ctx.effect(() => () => {
    sandbox.confine = origConfine
  })

  // --- bash denials: offer a grant after the fact. --------------------------
  // The command already ran and was refused; a grant only helps its rerun, so
  // the result carries a notice for the model instead of a silent second run.
  // Background jobs (`shell.start`) are not covered.
  if (promptOnDenial) {
    ctx.inject(['shell'], (scope) => {
      const shell = scope.shell
      const origRun = shell.run
      shell.run = async function run(spec) {
        const result = await origRun.call(shell, spec)
        const policy = spec?.sandboxPolicy
        if (result?.sandbox?.denied !== true || policy?.mode !== 'workspace-write') return result
        const candidates = stderrCandidates(result.stderr?.text ?? '').map(canonical)
        if (typeof spec.workdir === 'string' && isDirectory(spec.workdir)) candidates.push(canonical(spec.workdir))
        const granted = await promptAndGrant({
          policy,
          candidates,
          subject: 'a file write by this command',
          signal: spec.signal,
        })
        if (granted === undefined) return result
        const notice = `[sandbox-extra-roots: ${granted}; the command did not run with it — rerun the same command without sandbox_permissions]`
        const text = result.stderr?.text ?? ''
        return {
          ...result,
          stderr: { ...result.stderr, text: text === '' ? notice : `${text.replace(/\n+$/u, '')}\n${notice}` },
        }
      }
      scope.effect(() => () => { shell.run = origRun })
    })
  }

  // --- fs write/edit tools: relax the per-target fence for granted roots. ---
  // The tool passes the resolved `sandboxPolicy` (carrying mode, workspaceRoot
  // and sessionId) as the last argument. When the target falls under a granted
  // root, we hand the fs backend a `danger-full-access` policy so its own
  // containment check returns the target unfenced; every other target keeps the
  // original policy, so normal workspace writes and denials are unchanged. A
  // denial under workspace-write prompts the user once and, on a grant, retries
  // the same call once with the relaxed policy.
  ctx.inject(['fs'], (scope) => {
    const fs = scope.fs

    const relaxPolicyForTarget = (target, policy) => {
      if (policy?.mode !== 'workspace-write') return policy
      const roots = extraRootsFor(policy)
      if (roots.length === 0) return policy
      const key = canonical(target?.targetKey ?? target?.displayPath ?? '')
      for (const root of roots) {
        if (isWithin(key, canonical(root))) return { ...policy, mode: 'danger-full-access' }
      }
      return policy
    }

    const wrap = (methodName) => {
      const original = fs[methodName]
      fs[methodName] = async function wrapped(target, ...rest) {
        const policy = rest[rest.length - 1]
        const call = (effective) => {
          const args = [...rest]
          if (effective !== policy) args[args.length - 1] = effective
          return original.call(fs, target, ...args)
        }
        try {
          return await call(relaxPolicyForTarget(target, policy))
        } catch (error) {
          if (error?.code !== 'FS_SANDBOX_DENIED' || policy?.mode !== 'workspace-write') throw error
          const key = canonical(target?.targetKey ?? target?.displayPath ?? '')
          // (target, content|edit, expected, signal, sandboxPolicy): the signal precedes the policy.
          const signal = rest[rest.length - 2]
          const granted = await promptAndGrant({
            policy,
            candidates: ancestorCandidates(key),
            subject: `a write to ${target?.displayPath ?? key}`,
            signal: signal instanceof AbortSignal ? signal : undefined,
          })
          if (granted === undefined) throw error
          const relaxed = relaxPolicyForTarget(target, policy)
          if (relaxed === policy) throw error
          return await call(relaxed)
        }
      }
      scope.effect(() => () => { fs[methodName] = original })
    }

    if (typeof fs.writeText === 'function') wrap('writeText')
    if (typeof fs.editText === 'function') wrap('editText')
  })

  // --- model-visible list of the extra roots, in the runtime-context snapshot. ---
  // The agent loop logs the snapshot as model history, so the roots the model
  // is told about are reconstructable from the session log.
  ctx.inject(['systemPrompt', 'sandboxPolicy'], (scope) => {
    scope.effect(() => scope.systemPrompt.context({
      name: 'sandbox-extra-roots',
      order: scope.systemPrompt.getContextOrder('SANDBOX_POLICY') + 1,
      text: (context) => {
        const session = context.agent?.session
        if (session === undefined) return ''
        const roots = extraRootsFor(scope.sandboxPolicy.resolve({ session }))
        return roots.length === 0
          ? ''
          : `Additional directories writable under the DSH file sandbox in this session: ${roots.map(r => JSON.stringify(r)).join(', ')}.`
      },
    }))
  })

  // --- ad-hoc grants: the /grant-dir command. -------------------------------
  if (allowSessionGrants || allowWorkspaceGrants) {
    ctx.inject(['commands'], (scope) => {
      scope.effect(() => scope.commands.register({
        name: 'grant-dir',
        description: 'Grant extra writable directories (workspace-write only). '
          + '`/grant-dir <path>` lasts for this session and DSH process; '
          + '`/grant-dir workspace <path>` persists for every session in this workspace.',
        input: { hint: '<path> | list | revoke <path> | clear | workspace <path> | workspace list|revoke <path>|clear' },
        handler: async (invocation) => {
          const sessionId = invocation.agent?.id
          if (sessionId === undefined) {
            return { kind: 'error', text: 'grant-dir: no session in scope.' }
          }
          const session = invocation.agent?.session
          const baseDir = session?.header?.cwd
          const policyService = ctx.get('sandboxPolicy')
          const policy = policyService !== undefined && session !== undefined
            ? policyService.resolve({ session })
            : { mode: 'workspace-write', workspaceRoot: baseDir, sessionId }
          const raw = invocation.rawInput.trim()
          const [sub = '', ...restParts] = raw.split(/\s+/u).filter(part => part !== '')

          const resolveDir = (spelled) => {
            const path = canonical(expandHome(spelled, baseDir))
            return isDirectory(path) ? path : undefined
          }
          const current = () => sessionGrants.get(sessionId) ?? new Set()
          const listAll = () => {
            const lines = []
            const mine = [...current()]
            lines.push(mine.length === 0
              ? 'No session grants. Add one with: /grant-dir <path>'
              : `Session grants:\n${mine.map(r => `  ${r}`).join('\n')}`)
            const key = workspaceKeyFor(policy)
            if (key !== undefined) {
              const rows = workspaceRootsFor(policy)
              lines.push(rows.length === 0
                ? `No workspace grants for ${key}. Add one with: /grant-dir workspace <path>`
                : `Workspace grants (${key}):\n${rows.map(r => `  ${r}`).join('\n')}`)
            }
            return lines.join('\n')
          }

          if (sub === '' || sub === 'list') return { kind: 'success', text: listAll() }
          if (sub === 'clear') {
            sessionGrants.delete(sessionId)
            return { kind: 'success', text: 'Cleared this session\'s extra writable directories.' }
          }
          if (sub === 'revoke') {
            const argPath = restParts.join(' ')
            if (argPath === '') return { kind: 'error', text: 'Name the directory to revoke: /grant-dir revoke <path>' }
            const path = canonical(expandHome(argPath, baseDir))
            const set = current()
            const removed = set.delete(path)
            if (set.size === 0) sessionGrants.delete(sessionId)
            else sessionGrants.set(sessionId, set)
            return removed
              ? { kind: 'success', text: `Revoked ${path}.` }
              : { kind: 'error', text: `${path} was not granted to this session.` }
          }

          if (sub === 'workspace') {
            const key = workspaceKeyFor(policy)
            if (key === undefined) {
              return { kind: 'error', text: 'Workspace grants are unavailable (no storageDomain, or allowWorkspaceGrants is false).' }
            }
            const [wsub = '', ...wrest] = restParts
            if (wsub === '' || wsub === 'list') {
              const rows = workspaceTable.get(key)?.roots ?? []
              return {
                kind: 'success',
                text: rows.length === 0
                  ? `No workspace grants for ${key}.`
                  : `Workspace grants (${key}):\n${rows.map(r => `  ${r}`).join('\n')}`,
              }
            }
            if (wsub === 'clear') {
              await workspaceTable.delete(key)
              return { kind: 'success', text: `Cleared workspace grants for ${key}.` }
            }
            if (wsub === 'revoke') {
              const argPath = wrest.join(' ')
              if (argPath === '') return { kind: 'error', text: 'Name the directory to revoke: /grant-dir workspace revoke <path>' }
              const path = canonical(expandHome(argPath, baseDir))
              const removed = await removeWorkspaceGrant(key, path)
              return removed
                ? { kind: 'success', text: `Revoked ${path} for ${key}.` }
                : { kind: 'error', text: `${path} was not granted to ${key}.` }
            }
            const spelled = restParts.join(' ')
            const path = resolveDir(spelled)
            if (path === undefined) {
              return { kind: 'error', text: `${canonical(expandHome(spelled, baseDir))} is not an existing directory; cannot grant it.` }
            }
            await addWorkspaceGrant(key, path)
            return {
              kind: 'success',
              text: `Granted write access to ${path} for every session in ${key} (workspace-write only; persisted).`,
            }
          }

          if (!allowSessionGrants) {
            return { kind: 'error', text: 'Session grants are disabled; use /grant-dir workspace <path>.' }
          }
          // Anything else is a path to grant (`sub` is the first path token).
          const path = resolveDir(raw)
          if (path === undefined) {
            return { kind: 'error', text: `${canonical(expandHome(raw, baseDir))} is not an existing directory; cannot grant it.` }
          }
          const set = current()
          set.add(path)
          sessionGrants.set(sessionId, set)
          return {
            kind: 'success',
            text: `Granted write access to ${path} for this session (workspace-write only).`,
          }
        },
      }))
    })
  }
}
