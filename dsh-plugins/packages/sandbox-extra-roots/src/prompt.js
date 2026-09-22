/**
 * The grant prompt: turn one workspace-write denial into a question the user
 * answers in the normal question UI, and return the grant they chose.
 *
 * Asking goes through `ctx.userQuestions` on behalf of the denied session's
 * live agent. Every reason the question cannot be asked — no `userQuestions`
 * or `agents` service, an agent that is not live, a delegated child agent, an
 * aborted signal, the user declining — resolves to `undefined`, and the caller
 * leaves the original denial untouched. Nothing here grants anything; the
 * caller applies the returned choice.
 *
 * @module dsh-sandbox-extra-roots/prompt
 */
import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'

const DIR_QUESTION = 'dir'
const SCOPE_QUESTION = 'scope'
const SESSION_LABEL = 'This session only'
const DECLINE_LABEL = 'No'
const WORKSPACE_LABEL_PREFIX = 'All sessions in '

/** Whether `path` names an existing directory. */
export function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    // ENOENT/EACCES/ENOTDIR: not a grantable directory either way.
    return false
  }
}

/** Whether `child` is at or under `parent` (both canonical). */
function isWithin(child, parent) {
  if (child === parent) return true
  return child.startsWith(parent.endsWith('/') ? parent : `${parent}/`)
}

/**
 * Directories worth offering for a denied target: the target itself when it
 * is a directory, else its parent, then further ancestors up to `depth`
 * levels. Stops at the filesystem root (never offered) and does not climb
 * above the user's home directory (home itself is offered).
 * @param target - canonical absolute path the sandbox refused.
 * @param depth - how many ancestor levels to offer.
 * @returns candidate directories, nearest first.
 */
export function ancestorCandidates(target, depth = 4) {
  const out = []
  let current = isDirectory(target) ? target : dirname(target)
  const home = homedir()
  for (let i = 0; i < depth && current !== dirname(current); i += 1) {
    out.push(current)
    if (current === home) break
    current = dirname(current)
  }
  return out
}

/**
 * Absolute paths named in a command's stderr, each reduced to the directory
 * to grant (itself when a directory, else its parent). Heuristic by design:
 * the kernel reports the denied path in most tools' error text, but the plugin
 * also offers a free-text answer for the cases it cannot see.
 * @param stderr - the denied command's stderr text.
 * @param limit - maximum number of distinct directories.
 * @returns candidate directories in order of first mention.
 */
export function stderrCandidates(stderr, limit = 4) {
  const out = []
  for (const match of stderr.matchAll(/(?<![\w.])\/[^\s:'"`()<>]+/gu)) {
    const raw = match[0].replace(/[.,;]+$/u, '')
    if (raw === '/' || raw === '') continue
    const dir = isDirectory(raw) ? raw : dirname(raw)
    if (dir === '/' || out.includes(dir)) continue
    out.push(dir)
    if (out.length >= limit) break
  }
  return out
}

/**
 * Drop candidates that are already writable or already granted, or that are
 * the filesystem root; keep order and remove duplicates.
 * @param candidates - raw candidate directories.
 * @param writable - roots already writable for this call (defaults + grants).
 * @returns the candidates still worth asking about.
 */
export function filterCandidates(candidates, writable) {
  const out = []
  for (const candidate of candidates) {
    if (candidate === '/' || out.includes(candidate)) continue
    if (writable.some(root => isWithin(candidate, root))) continue
    if (!isDirectory(candidate)) continue
    out.push(candidate)
  }
  return out
}

/** Expand a leading `~` and resolve against `base`. */
function expandHome(p, base) {
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return resolve(homedir(), p.slice(2))
  return base === undefined ? resolve(p) : resolve(base, p)
}

/**
 * Ask the user whether to grant a directory for the denied session.
 * @param input.ctx - the plugin context; `agents` and `userQuestions` are read optionally.
 * @param input.policy - the denied call's resolved policy (`sessionId` routes the question).
 * @param input.candidates - directories to offer, already filtered.
 * @param input.workspaceKey - the workspace a durable grant would apply to, or
 *   `undefined` when workspace grants are unavailable (the option is then omitted).
 * @param input.allowSession - whether the session-only scope is offered (default true).
 * @param input.subject - what was denied, for the question text (`write to /x/y` or `command`).
 * @param input.signal - the denied call's abort signal, if any.
 * @param input.canonical - canonicalizer for a typed path.
 * @returns `{ dir, scope: 'session' | 'workspace' }`, or `undefined` for no grant.
 */
export async function askGrant({ ctx, policy, candidates, workspaceKey, allowSession = true, subject, signal, canonical }) {
  if (policy?.mode !== 'workspace-write' || typeof policy.sessionId !== 'string') return undefined
  if (!allowSession && workspaceKey === undefined) return undefined
  const agents = ctx.get('agents')
  const userQuestions = ctx.get('userQuestions')
  if (agents === undefined || userQuestions === undefined) return undefined
  const agent = agents.get(policy.sessionId)
  if (agent === undefined) return undefined

  const scopeOptions = [
    ...allowSession
      ? [{ label: SESSION_LABEL, description: 'Held in memory until this DSH process exits.' }]
      : [],
    ...workspaceKey === undefined
      ? []
      : [{
          label: `${WORKSPACE_LABEL_PREFIX}${workspaceKey}`,
          description: 'Persisted; every future session of this workspace gets it too.',
        }],
    { label: DECLINE_LABEL, description: 'Keep the denial; the model may still ask for a one-off escalation.' },
  ]
  const questions = [
    {
      id: DIR_QUESTION,
      header: 'Sandbox denial',
      question: `The sandbox refused ${subject} under workspace-write. Which directory should become writable? (type another path if none fits)`,
      options: candidates.map(dir => ({ label: dir })),
    },
    {
      id: SCOPE_QUESTION,
      header: 'Scope',
      question: 'Grant write access for:',
      options: scopeOptions,
    },
  ]

  let answer
  try {
    answer = await userQuestions.ask({ questions, agent, ...signal === undefined ? {} : { signal } })
  } catch {
    // ASK_ABORTED, DELEGATED_CALLER, CALLER_NOT_LIVE, NO_PROVIDER, or a UI
    // failure: none of them is a grant, and the denial already explains itself.
    return undefined
  }
  const answers = Array.isArray(answer?.answers) ? answer.answers : []
  const scopeAnswer = answers.find(a => a.id === SCOPE_QUESTION)
  const dirAnswer = answers.find(a => a.id === DIR_QUESTION)
  const scopeLabel = scopeAnswer?.selected?.[0]
  let scope
  if (scopeLabel === SESSION_LABEL && allowSession) scope = 'session'
  else if (typeof scopeLabel === 'string' && scopeLabel.startsWith(WORKSPACE_LABEL_PREFIX) && workspaceKey !== undefined) scope = 'workspace'
  else return undefined

  const custom = typeof dirAnswer?.custom === 'string' ? dirAnswer.custom.trim() : ''
  const chosen = custom !== '' ? custom : dirAnswer?.selected?.[0]
  if (typeof chosen !== 'string' || chosen === '') return undefined
  const dir = canonical(expandHome(chosen, agent.session?.header?.cwd))
  if (dir === '/' || !isDirectory(dir)) return undefined
  return { dir, scope }
}
