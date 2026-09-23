/**
 * The plugin wraps `ctx.sandbox.confine()`, the fs mutation methods, and
 * `ctx.shell.run()`. These tests pin the facts that break silently when
 * upstream changes: the grant lands BEFORE the `--` separator, a
 * non-`workspace-write` policy is left completely alone, a denial prompts the
 * user exactly once and only a grant changes the outcome, and workspace grants
 * round-trip through the storage domain.
 */
import { describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, name } from '../src/index.js'
import { ancestorCandidates, filterCandidates, stderrCandidates } from '../src/prompt.js'

/** A fresh canonical temp directory (macOS realpaths /tmp to /private/tmp). */
function tempDir(prefix) {
  return realpathSync(mkdtempSync(`${tmpdir()}/${prefix}`))
}

/**
 * A fresh directory OUTSIDE the platform temp area, for tests about offered
 * candidates: anything under /tmp is writable by default and is (correctly)
 * never offered. Lives under the package's own node_modules/.cache.
 */
function outsideTmpDir(prefix) {
  const base = join(realpathSync(new URL('..', import.meta.url).pathname), 'node_modules', '.cache', 'extra-roots-tests')
  mkdirSync(base, { recursive: true })
  return realpathSync(mkdtempSync(join(base, prefix)))
}

/** In-memory stand-in for one `KvTable` of the storage domain. */
function fakeTable() {
  const records = new Map()
  return {
    records,
    get: key => records.get(key),
    entries: () => records.entries(),
    keys: () => records.keys(),
    get size() { return records.size },
    put: async (key, value) => { records.set(key, value) },
    delete: async key => records.delete(key),
  }
}

/** A `storageDomain` service whose `open` yields the given table. */
function fakeStorageDomain(table = fakeTable()) {
  return {
    table,
    open: vi.fn(async () => ({ table: () => table, close: vi.fn(async () => {}) })),
  }
}

/** Wait for the microtasks the async domain open needs. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/**
 * A context stub carrying the sandbox face plus optional services. `inject`
 * mirrors cordis: the callback runs only when every named service is present,
 * with a scope sharing this context's effect and the SAME service objects.
 * `get` reads the same optional services (the plugin uses it for `agents`,
 * `userQuestions`, `worktreePool`, `sandboxPolicy`).
 */
function contextWith(confine, services = {}) {
  const disposers = []
  const available = { ...services }
  const effect = (fn) => { disposers.push(fn()) }
  const ctx = {
    sandbox: { confine },
    effect,
    inject: (names, cb) => {
      if (!names.every(n => available[n] !== undefined)) return
      cb({ ...available, effect })
    },
    get: name => available[name],
    dispose: async () => { for (const d of disposers) await d?.() },
  }
  for (const [key, value] of Object.entries(available)) ctx[key] = value
  return ctx
}

/** Capture the single registered command definition. */
function commandCapture() {
  const registered = []
  return {
    register: (definition) => { registered.push(definition); return () => {} },
    definition: () => registered[registered.length - 1],
  }
}

/** A `userQuestions` service answering with a scripted reply (or throwing). */
function scriptedQuestions(reply) {
  const asked = []
  return {
    asked,
    ask: vi.fn(async (request) => {
      asked.push(request)
      if (reply instanceof Error) throw reply
      return typeof reply === 'function' ? reply(request) : reply
    }),
  }
}

/** The answer payload selecting `dir` and one scope option. */
function answer(dir, scopeLabel, custom) {
  return {
    answers: [
      { id: 'dir', selected: dir === undefined ? [] : [dir], ...custom === undefined ? {} : { custom } },
      { id: 'scope', selected: [scopeLabel] },
    ],
  }
}

/** `agents` registry knowing exactly the given live ids. */
function agentsWith(...ids) {
  return { get: id => (ids.includes(id) ? { id, session: { id, header: { cwd: '/' } } } : undefined) }
}

/** A denial error the way `dsh-fs-sandbox` throws it. */
function denial() {
  const error = new Error('cannot write: file access denied under workspace-write mode')
  error.code = 'FS_SANDBOX_DENIED'
  return error
}

/** A fake fs whose mutations deny unless the policy is danger-full-access, recording each call. */
function fencedFs() {
  const calls = []
  const mutate = (target, _payload, _expected, _signal, sandboxPolicy) => {
    calls.push({ target, sandboxPolicy })
    if (sandboxPolicy?.mode !== 'danger-full-access') throw denial()
    return { ok: true }
  }
  return { calls, writeText: mutate, editText: mutate }
}

const landlock = () => ({ argv: ['landlock-run', '--', 'bash'] })
const grantArgv = confined => confined.argv.slice(0, confined.argv.indexOf('--'))

describe('dsh-sandbox-extra-roots', () => {
  it('names itself so the loader can address the row', () => {
    expect(name).toBe('dsh-sandbox-extra-roots')
  })

  it('appends --rw grants before the argv separator for landlock-run', () => {
    const root = tempDir('extra-root-')
    const original = vi.fn(() => ({ argv: ['landlock-run', '--ro', '/usr', '--', 'bash', '-c', 'true'] }))
    const ctx = contextWith(original)
    apply(ctx, { roots: [root] })

    const result = ctx.sandbox.confine(['bash'], { mode: 'workspace-write' })
    const sep = result.argv.indexOf('--')
    expect(result.argv.slice(0, sep)).toContain('--rw')
    expect(result.argv.slice(0, sep)).toContain(root)
    // The command itself must stay untouched after the separator.
    expect(result.argv.slice(sep)).toEqual(['--', 'bash', '-c', 'true'])
  })

  it('binds roots for bwrap using its own dialect', () => {
    const root = tempDir('extra-root-')
    const ctx = contextWith(() => ({ argv: ['bwrap', '--dev', '/dev', '--', 'bash'] }))
    apply(ctx, { roots: [root] })

    const grant = grantArgv(ctx.sandbox.confine(['bash'], { mode: 'workspace-write' }))
    expect(grant.filter(a => a === '--bind')).toHaveLength(1)
    // bwrap needs the root twice: source and destination.
    expect(grant.filter(a => a === root)).toHaveLength(2)
  })

  it('adds writable subpaths to the sandbox-exec Seatbelt profile', () => {
    const root = tempDir('extra-root-')
    const baseProfile = '(version 1)\n(allow default)\n(deny file-write*)'
    const ctx = contextWith(() => ({ argv: ['sandbox-exec', '-p', baseProfile, '--', 'bash', '-c', 'true'] }))
    apply(ctx, { roots: [root] })

    const result = ctx.sandbox.confine(['bash'], { mode: 'workspace-write' })
    expect(result.argv.slice(result.argv.indexOf('--'))).toEqual(['--', 'bash', '-c', 'true'])
    expect(result.argv[2]).toBe(`${baseProfile}\n(allow file-write* (subpath "${root}"))`)
  })

  it('leaves read-only and full-access policies untouched', () => {
    const root = tempDir('extra-root-')
    const base = ['landlock-run', '--', 'bash']
    const ctx = contextWith(landlock)
    apply(ctx, { roots: [root] })

    for (const mode of ['read-only', 'danger-full-access']) {
      expect(ctx.sandbox.confine(['bash'], { mode }).argv).toEqual(base)
    }
  })

  it('skips a configured root that does not exist, because landlock-run refuses to start on one', () => {
    const ctx = contextWith(landlock)
    apply(ctx, { roots: ['/definitely/not/here'] })

    expect(ctx.sandbox.confine(['bash'], { mode: 'workspace-write' }).argv)
      .toEqual(['landlock-run', '--', 'bash'])
  })

  it('stops injecting grants once the fiber is disposed', async () => {
    const root = tempDir('extra-root-')
    const base = ['landlock-run', '--', 'bash']
    const ctx = contextWith(landlock)
    apply(ctx, { roots: [root] })
    expect(ctx.sandbox.confine(['bash'], { mode: 'workspace-write' }).argv).toContain('--rw')

    // The restored function is `confine.bind(sandbox)`, never the same
    // reference as the original, so the observable behaviour is the contract.
    await ctx.dispose()
    expect(ctx.sandbox.confine(['bash'], { mode: 'workspace-write' }).argv).toEqual(base)
  })

  it('is a true no-op only when nothing is configured AND every grant kind is disabled', () => {
    const original = vi.fn(landlock)
    const ctx = contextWith(original)
    apply(ctx, { allowSessionGrants: false, allowWorkspaceGrants: false })
    expect(ctx.sandbox.confine).toBe(original)
  })

  it('still wraps (for future session grants) when only session grants are enabled', () => {
    const ctx = contextWith(landlock)
    apply(ctx, {})
    // Wrapped, but behaviorally a no-op until a session grant is added.
    expect(ctx.sandbox.confine(['bash'], { mode: 'workspace-write', sessionId: 's1' }).argv).toEqual(['landlock-run', '--', 'bash'])
  })

  it('grants a per-repo root only when the session workspace is under that repo', () => {
    const repo = tempDir('extra-repo-')
    const shared = tempDir('extra-shared-')
    const ctx = contextWith(landlock)
    apply(ctx, { grants: [{ repoRoot: repo, roots: [shared] }] })

    // A session inside the repo earns the grant.
    expect(grantArgv(ctx.sandbox.confine(['bash'], { mode: 'workspace-write', workspaceRoot: repo }))).toContain(shared)

    // A session elsewhere does not.
    const outside = ctx.sandbox.confine(['bash'], { mode: 'workspace-write', workspaceRoot: tempDir('extra-elsewhere-') })
    expect(outside.argv).toEqual(['landlock-run', '--', 'bash'])
  })
})

describe('dsh-sandbox-extra-roots — fs tool fence', () => {
  /** A fake fs service recording the policy each write receives. */
  function fakeFs() {
    const calls = []
    return {
      writeText: (target, content, expected, signal, sandboxPolicy) => {
        calls.push({ target, sandboxPolicy })
        return { ok: true }
      },
      editText: (target, edit, expected, signal, sandboxPolicy) => {
        calls.push({ target, sandboxPolicy })
        return { ok: true }
      },
      calls,
    }
  }

  it('relaxes the policy to danger-full-access for a target under a granted root', async () => {
    const root = tempDir('extra-fs-')
    const fs = fakeFs()
    const ctx = contextWith(landlock, { fs })
    apply(ctx, { roots: [root] })

    const target = { targetKey: `${root}/out.txt`, displayPath: `${root}/out.txt` }
    await ctx.fs.writeText(target, 'x', undefined, undefined, { mode: 'workspace-write', workspaceRoot: '/somewhere' })
    expect(fs.calls[0].sandboxPolicy.mode).toBe('danger-full-access')
  })

  it('leaves the policy untouched for a target NOT under any granted root', async () => {
    const root = tempDir('extra-fs-')
    const fs = fakeFs()
    const ctx = contextWith(landlock, { fs })
    apply(ctx, { roots: [root] })

    const policy = { mode: 'workspace-write', workspaceRoot: '/somewhere' }
    await ctx.fs.writeText({ targetKey: '/elsewhere/out.txt', displayPath: '/elsewhere/out.txt' }, 'x', undefined, undefined, policy)
    expect(fs.calls[0].sandboxPolicy).toBe(policy)
  })

  it('never relaxes a read-only policy', async () => {
    const root = tempDir('extra-fs-')
    const fs = fakeFs()
    const ctx = contextWith(landlock, { fs })
    apply(ctx, { roots: [root] })

    const policy = { mode: 'read-only', workspaceRoot: '/somewhere' }
    await ctx.fs.editText({ targetKey: `${root}/out.txt`, displayPath: `${root}/out.txt` }, {}, undefined, undefined, policy)
    expect(fs.calls[0].sandboxPolicy).toBe(policy)
  })

  it('restores the original fs methods when disposed', async () => {
    const root = tempDir('extra-fs-')
    const fs = fakeFs()
    const before = fs.writeText
    const ctx = contextWith(landlock, { fs })
    apply(ctx, { roots: [root] })
    expect(fs.writeText).not.toBe(before)
    await ctx.dispose()
    expect(fs.writeText).toBe(before)
  })
})

describe('dsh-sandbox-extra-roots — prompt on fs denial', () => {
  const policyFor = (sessionId, workspaceRoot = '/repo') => ({ mode: 'workspace-write', workspaceRoot, sessionId })

  it('asks once, and a "this session" grant retries the same call relaxed', async () => {
    const dir = outsideTmpDir('extra-deny-')
    const target = { targetKey: `${dir}/out.txt`, displayPath: `${dir}/out.txt` }
    const fs = fencedFs()
    const userQuestions = scriptedQuestions(answer(dir, 'This session only'))
    const ctx = contextWith(landlock, { fs, userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})

    const result = await ctx.fs.writeText(target, 'x', undefined, undefined, policyFor('s1'))
    expect(result).toEqual({ ok: true })
    expect(userQuestions.ask).toHaveBeenCalledTimes(1)
    // First attempt under the original policy, retry under the relaxed one.
    expect(fs.calls.map(c => c.sandboxPolicy.mode)).toEqual(['workspace-write', 'danger-full-access'])
    // The offered directories include the target's parent.
    const dirQuestion = userQuestions.asked[0].questions.find(q => q.id === 'dir')
    expect(dirQuestion.options.map(o => o.label)).toContain(dir)
    // The question is routed through the denied session's agent.
    expect(userQuestions.asked[0].agent.id).toBe('s1')

    // The grant is per session: another session is still denied.
    const decline = scriptedQuestions(answer(undefined, 'No'))
    const ctx2 = contextWith(landlock, { fs: fencedFs(), userQuestions: decline, agents: agentsWith('s2') })
    apply(ctx2, {})
    await expect(ctx2.fs.writeText(target, 'x', undefined, undefined, policyFor('s2'))).rejects.toMatchObject({ code: 'FS_SANDBOX_DENIED' })
  })

  it('a "No" answer rethrows the original denial after a single attempt', async () => {
    const dir = tempDir('extra-deny-')
    const fs = fencedFs()
    const userQuestions = scriptedQuestions(answer(dir, 'No'))
    const ctx = contextWith(landlock, { fs, userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})

    await expect(ctx.fs.editText({ targetKey: `${dir}/f`, displayPath: `${dir}/f` }, {}, undefined, undefined, policyFor('s1')))
      .rejects.toMatchObject({ code: 'FS_SANDBOX_DENIED' })
    expect(fs.calls).toHaveLength(1)
  })

  it('does not prompt without userQuestions, without a live agent, when the ask throws, under read-only, or when disabled', async () => {
    const dir = tempDir('extra-deny-')
    const target = { targetKey: `${dir}/f`, displayPath: `${dir}/f` }
    const denied = { code: 'FS_SANDBOX_DENIED' }

    // No userQuestions service composed.
    let ctx = contextWith(landlock, { fs: fencedFs(), agents: agentsWith('s1') })
    apply(ctx, {})
    await expect(ctx.fs.writeText(target, 'x', undefined, undefined, policyFor('s1'))).rejects.toMatchObject(denied)

    // The denied session is not a live agent (e.g. already gone).
    let userQuestions = scriptedQuestions(answer(dir, 'This session only'))
    ctx = contextWith(landlock, { fs: fencedFs(), userQuestions, agents: agentsWith('other') })
    apply(ctx, {})
    await expect(ctx.fs.writeText(target, 'x', undefined, undefined, policyFor('s1'))).rejects.toMatchObject(denied)
    expect(userQuestions.ask).not.toHaveBeenCalled()

    // The UI rejects (delegated child, aborted, no provider).
    userQuestions = scriptedQuestions(Object.assign(new Error('delegated'), { code: 'DELEGATED_CALLER' }))
    ctx = contextWith(landlock, { fs: fencedFs(), userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})
    await expect(ctx.fs.writeText(target, 'x', undefined, undefined, policyFor('s1'))).rejects.toMatchObject(denied)
    expect(userQuestions.ask).toHaveBeenCalledTimes(1)

    // read-only never prompts: there is no current permission to extend.
    userQuestions = scriptedQuestions(answer(dir, 'This session only'))
    ctx = contextWith(landlock, { fs: fencedFs(), userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})
    await expect(ctx.fs.writeText(target, 'x', undefined, undefined, { mode: 'read-only', workspaceRoot: '/repo', sessionId: 's1' }))
      .rejects.toMatchObject(denied)
    expect(userQuestions.ask).not.toHaveBeenCalled()

    // promptOnDenial: false keeps the plain denial too.
    userQuestions = scriptedQuestions(answer(dir, 'This session only'))
    ctx = contextWith(landlock, { fs: fencedFs(), userQuestions, agents: agentsWith('s1') })
    apply(ctx, { promptOnDenial: false })
    await expect(ctx.fs.writeText(target, 'x', undefined, undefined, policyFor('s1'))).rejects.toMatchObject(denied)
    expect(userQuestions.ask).not.toHaveBeenCalled()
  })

  it('rejects a typed path that is not a directory, and never grants the filesystem root', async () => {
    const dir = tempDir('extra-deny-')
    const target = { targetKey: `${dir}/f`, displayPath: `${dir}/f` }
    for (const custom of ['/definitely/not/here', '/']) {
      const fs = fencedFs()
      const userQuestions = scriptedQuestions(answer(undefined, 'This session only', custom))
      const ctx = contextWith(landlock, { fs, userQuestions, agents: agentsWith('s1') })
      apply(ctx, {})
      await expect(ctx.fs.writeText(target, 'x', undefined, undefined, policyFor('s1'))).rejects.toMatchObject({ code: 'FS_SANDBOX_DENIED' })
      expect(fs.calls).toHaveLength(1)
    }
  })

  it('a typed path wins over the selected option', async () => {
    const dir = tempDir('extra-deny-')
    const target = { targetKey: `${dir}/f`, displayPath: `${dir}/f` }
    const fs = fencedFs()
    const userQuestions = scriptedQuestions(answer('/not/used', 'This session only', dir))
    const ctx = contextWith(landlock, { fs, userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})
    await expect(ctx.fs.writeText(target, 'x', undefined, undefined, policyFor('s1'))).resolves.toEqual({ ok: true })
  })

  it('asks only once for concurrent denials in the same session', async () => {
    const dir = tempDir('extra-deny-')
    const fs = fencedFs()
    let release
    const gate = new Promise(resolve => { release = resolve })
    const userQuestions = scriptedQuestions(async () => { await gate; return answer(dir, 'This session only') })
    const ctx = contextWith(landlock, { fs, userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})

    const first = ctx.fs.writeText({ targetKey: `${dir}/a`, displayPath: `${dir}/a` }, 'x', undefined, undefined, policyFor('s1'))
    const second = ctx.fs.writeText({ targetKey: `${dir}/b`, displayPath: `${dir}/b` }, 'x', undefined, undefined, policyFor('s1'))
    // The second denial finds a prompt in flight and fails plainly.
    await expect(second).rejects.toMatchObject({ code: 'FS_SANDBOX_DENIED' })
    release()
    await expect(first).resolves.toEqual({ ok: true })
    expect(userQuestions.ask).toHaveBeenCalledTimes(1)
  })
})

describe('dsh-sandbox-extra-roots — workspace grants', () => {
  it('persists a workspace grant chosen at the prompt and applies it to new sessions of that workspace', async () => {
    const repo = tempDir('extra-ws-repo-')
    const dir = tempDir('extra-ws-dir-')
    const storageDomain = fakeStorageDomain()
    const fs = fencedFs()
    const userQuestions = scriptedQuestions(answer(dir, `All sessions in ${repo}`))
    const ctx = contextWith(landlock, { fs, userQuestions, agents: agentsWith('s1'), storageDomain })
    apply(ctx, {})
    await settle()
    expect(storageDomain.open).toHaveBeenCalledTimes(1)

    const target = { targetKey: `${dir}/f`, displayPath: `${dir}/f` }
    const policy = { mode: 'workspace-write', workspaceRoot: repo, sessionId: 's1' }
    await expect(ctx.fs.writeText(target, 'x', undefined, undefined, policy)).resolves.toEqual({ ok: true })
    expect(storageDomain.table.get(repo)).toEqual({ roots: [dir] })
    // The scope option named the workspace it would apply to.
    const scopeQuestion = userQuestions.asked[0].questions.find(q => q.id === 'scope')
    expect(scopeQuestion.options.map(o => o.label)).toContain(`All sessions in ${repo}`)

    // A brand-new plugin instance over the same durable table (a restart) grants
    // another session in the same workspace without asking.
    const again = scriptedQuestions(new Error('must not ask'))
    const ctx2 = contextWith(landlock, {
      fs: fencedFs(), userQuestions: again, agents: agentsWith('s9'), storageDomain: fakeStorageDomain(storageDomain.table),
    })
    apply(ctx2, {})
    await settle()
    expect(grantArgv(ctx2.sandbox.confine(['bash'], { mode: 'workspace-write', workspaceRoot: repo, sessionId: 's9' }))).toContain(dir)
    await expect(ctx2.fs.writeText(target, 'x', undefined, undefined, { mode: 'workspace-write', workspaceRoot: repo, sessionId: 's9' }))
      .resolves.toEqual({ ok: true })
    expect(again.ask).not.toHaveBeenCalled()

    // A session in an unrelated workspace does not inherit it.
    const elsewhere = ctx2.sandbox.confine(['bash'], { mode: 'workspace-write', workspaceRoot: tempDir('extra-ws-other-'), sessionId: 's9' })
    expect(elsewhere.argv).toEqual(['landlock-run', '--', 'bash'])

    // A session whose workspace root is a subdirectory of the granted workspace inherits it.
    const sub = join(repo, 'sub')
    mkdirSync(sub)
    expect(grantArgv(ctx2.sandbox.confine(['bash'], { mode: 'workspace-write', workspaceRoot: sub, sessionId: 's9' }))).toContain(dir)
  })

  it('keys the grant by the worktree-pool repository root when the pool owns the session', async () => {
    const repo = tempDir('extra-ws-repo-')
    const worktree = tempDir('extra-ws-wt-')
    const dir = tempDir('extra-ws-dir-')
    const storageDomain = fakeStorageDomain()
    const worktreePool = { forSession: id => (id === 's1' ? { repoRoot: repo } : undefined) }
    const fs = fencedFs()
    const userQuestions = scriptedQuestions(answer(dir, `All sessions in ${repo}`))
    const ctx = contextWith(landlock, { fs, userQuestions, agents: agentsWith('s1'), storageDomain, worktreePool })
    apply(ctx, {})
    await settle()

    // The session runs in a pool worktree, not under the repo root.
    const policy = { mode: 'workspace-write', workspaceRoot: worktree, sessionId: 's1' }
    await expect(ctx.fs.writeText({ targetKey: `${dir}/f`, displayPath: `${dir}/f` }, 'x', undefined, undefined, policy)).resolves.toEqual({ ok: true })
    expect([...storageDomain.table.keys()]).toEqual([repo])

    // A later session in the repo root itself gets it.
    expect(grantArgv(ctx.sandbox.confine(['bash'], { mode: 'workspace-write', workspaceRoot: repo, sessionId: 's2' }))).toContain(dir)
  })

  it('omits the workspace option when storageDomain is absent, and fails loud on /grant-dir workspace', async () => {
    const dir = tempDir('extra-ws-dir-')
    const commands = commandCapture()
    const userQuestions = scriptedQuestions(answer(dir, 'This session only'))
    const ctx = contextWith(landlock, { fs: fencedFs(), userQuestions, agents: agentsWith('s1'), commands })
    apply(ctx, {})

    await ctx.fs.writeText({ targetKey: `${dir}/f`, displayPath: `${dir}/f` }, 'x', undefined, undefined, { mode: 'workspace-write', workspaceRoot: '/repo', sessionId: 's1' })
    const scopeQuestion = userQuestions.asked[0].questions.find(q => q.id === 'scope')
    expect(scopeQuestion.options.map(o => o.label)).toEqual(['This session only', 'No'])

    const result = await commands.definition().handler({ agent: { id: 's1', session: { header: { cwd: '/' } } }, rawInput: `workspace ${dir}` })
    expect(result.kind).toBe('error')
    expect(result.text).toMatch(/unavailable/u)
  })

  it('closes the domain on dispose and stops granting', async () => {
    const repo = tempDir('extra-ws-repo-')
    const dir = tempDir('extra-ws-dir-')
    const table = fakeTable()
    await table.put(repo, { roots: [dir] })
    const storageDomain = fakeStorageDomain(table)
    const ctx = contextWith(landlock, { storageDomain })
    apply(ctx, {})
    await settle()
    const policy = { mode: 'workspace-write', workspaceRoot: repo, sessionId: 's1' }
    expect(grantArgv(ctx.sandbox.confine(['bash'], policy))).toContain(dir)
    await ctx.dispose()
    const opened = await storageDomain.open.mock.results[0].value
    expect(opened.close).toHaveBeenCalledTimes(1)
  })
})

describe('dsh-sandbox-extra-roots — prompt on bash denial', () => {
  it('offers directories named in stderr and appends a rerun notice on grant, leaving denied=true', async () => {
    const dir = outsideTmpDir('extra-bash-')
    const denied = {
      exitCode: 1,
      stdout: { text: '', truncated: false },
      stderr: { text: `touch: cannot touch '${dir}/x': Permission denied\n`, truncated: false },
      sandbox: { mode: 'workspace-write', denied: true },
    }
    const original = vi.fn(async () => denied)
    const shell = { run: original }
    const userQuestions = scriptedQuestions(answer(dir, 'This session only'))
    const ctx = contextWith(landlock, { shell, userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})

    const policy = { mode: 'workspace-write', workspaceRoot: '/repo', sessionId: 's1' }
    const result = await ctx.shell.run({ command: `touch ${dir}/x`, sandboxPolicy: policy })
    // The command is never rerun by the plugin.
    expect(original).toHaveBeenCalledTimes(1)
    expect(result.sandbox.denied).toBe(true)
    expect(result.stderr.text).toContain('rerun the same command')
    expect(result.stderr.text).toContain(dir)
    const dirQuestion = userQuestions.asked[0].questions.find(q => q.id === 'dir')
    expect(dirQuestion.options.map(o => o.label)).toContain(dir)
    // The grant now reaches bash through confine for the same session.
    expect(grantArgv(ctx.sandbox.confine(['bash'], policy))).toContain(dir)
  })

  it('passes non-denied results through untouched and restores run on dispose', async () => {
    const ok = { exitCode: 0, stdout: { text: 'hi' }, stderr: { text: '' }, sandbox: { mode: 'workspace-write', denied: false } }
    const original = vi.fn(async () => ok)
    const shell = { run: original }
    const userQuestions = scriptedQuestions(new Error('must not ask'))
    const ctx = contextWith(landlock, { shell, userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})
    expect(shell.run).not.toBe(original)
    const result = await ctx.shell.run({ command: 'true', sandboxPolicy: { mode: 'workspace-write', workspaceRoot: '/repo', sessionId: 's1' } })
    expect(result).toBe(ok)
    expect(userQuestions.ask).not.toHaveBeenCalled()
    await ctx.dispose()
    expect(shell.run).toBe(original)
  })

  it('a declined bash prompt returns the original result object', async () => {
    const dir = tempDir('extra-bash-')
    const denied = { exitCode: 1, stdout: { text: '' }, stderr: { text: `${dir}/x: Permission denied` }, sandbox: { mode: 'workspace-write', denied: true } }
    const shell = { run: vi.fn(async () => denied) }
    const userQuestions = scriptedQuestions(answer(dir, 'No'))
    const ctx = contextWith(landlock, { shell, userQuestions, agents: agentsWith('s1') })
    apply(ctx, {})
    const result = await ctx.shell.run({ command: 'x', sandboxPolicy: { mode: 'workspace-write', workspaceRoot: '/repo', sessionId: 's1' } })
    expect(result).toBe(denied)
  })
})

describe('dsh-sandbox-extra-roots — candidate helpers', () => {
  it('ancestorCandidates walks up from the parent, never offering /', () => {
    const dir = tempDir('extra-cand-')
    mkdirSync(`${dir}/a/b`, { recursive: true })
    const out = ancestorCandidates(`${dir}/a/b/file.txt`)
    expect(out[0]).toBe(`${dir}/a/b`)
    expect(out[1]).toBe(`${dir}/a`)
    expect(out).not.toContain('/')
    expect(out.length).toBeLessThanOrEqual(4)
  })

  it('stderrCandidates extracts absolute paths and reduces files to their directory', () => {
    const dir = tempDir('extra-cand-')
    writeFileSync(`${dir}/f`, '')
    const out = stderrCandidates(`sh: ${dir}/f: Permission denied\nmkdir: cannot create directory '${dir}/new': Permission denied`)
    expect(out).toEqual([dir])
  })

  it('filterCandidates drops writable, duplicate, root and missing entries', () => {
    const dir = tempDir('extra-cand-')
    // dir lives under tmpdir(), which is writable by default.
    expect(filterCandidates([dir, dir, '/', '/definitely/not/here'], [realpathSync(tmpdir())])).toEqual([])
    expect(filterCandidates([dir, dir], ['/nowhere'])).toEqual([dir])
  })
})

describe('dsh-sandbox-extra-roots — /grant-dir command', () => {
  it('grants a session an extra root that both fences then honor', async () => {
    const dir = tempDir('extra-session-')
    const commands = commandCapture()
    const confineArgv = ['landlock-run', '--', 'bash']
    const fakeFs = { writeText: (t, c, e, s, p) => ({ p }) }
    const ctx = contextWith(landlock, { fs: fakeFs, commands })
    apply(ctx, {})

    const sessionPolicy = { mode: 'workspace-write', workspaceRoot: '/repo', sessionId: 'session-1' }

    // Before granting: bash gets no extra root for this session.
    expect(ctx.sandbox.confine(['bash'], sessionPolicy).argv).toEqual(confineArgv)

    // Grant via the command as session-1.
    const result = await commands.definition().handler({
      agent: { id: 'session-1', session: { header: { cwd: '/repo' } } },
      rawInput: dir,
    })
    expect(result.kind).toBe('success')

    // After granting: bash for session-1 now carries the root...
    expect(grantArgv(ctx.sandbox.confine(['bash'], sessionPolicy))).toContain(dir)

    // ...but a different session is unaffected.
    const other = ctx.sandbox.confine(['bash'], { ...sessionPolicy, sessionId: 'session-2' })
    expect(other.argv).toEqual(confineArgv)
  })

  it('lists, revokes, and rejects a non-directory', async () => {
    const dir = tempDir('extra-session-')
    const commands = commandCapture()
    const ctx = contextWith(landlock, { commands })
    apply(ctx, {})
    const run = (rawInput) => commands.definition().handler({ agent: { id: 's1', session: { header: { cwd: '/' } } }, rawInput })

    expect((await run('/definitely/not/here')).kind).toBe('error')
    expect((await run(dir)).kind).toBe('success')
    expect((await run('list')).text).toContain(dir)
    expect((await run(`revoke ${dir}`)).kind).toBe('success')
    expect((await run('list')).text).toContain('No session grants')
  })

  it('manages workspace grants: add, list, revoke, clear', async () => {
    const repo = tempDir('extra-ws-repo-')
    const dir = tempDir('extra-ws-dir-')
    const commands = commandCapture()
    const storageDomain = fakeStorageDomain()
    const sandboxPolicy = { resolve: ({ session }) => ({ mode: 'workspace-write', workspaceRoot: session.header.cwd, sessionId: session.id }) }
    const ctx = contextWith(landlock, { commands, storageDomain, sandboxPolicy })
    apply(ctx, {})
    await settle()
    const agent = { id: 's1', session: { id: 's1', header: { cwd: repo } } }
    const run = (rawInput) => commands.definition().handler({ agent, rawInput })

    expect((await run(`workspace ${dir}`)).kind).toBe('success')
    expect(storageDomain.table.get(repo)).toEqual({ roots: [dir] })
    expect((await run('workspace list')).text).toContain(dir)
    expect((await run('list')).text).toContain(`Workspace grants (${repo})`)
    expect((await run('workspace /definitely/not/here')).kind).toBe('error')
    expect((await run(`workspace revoke ${dir}`)).kind).toBe('success')
    expect(storageDomain.table.get(repo)).toBeUndefined()
    expect((await run(`workspace revoke ${dir}`)).kind).toBe('error')
    expect((await run(`workspace ${dir}`)).kind).toBe('success')
    expect((await run('workspace clear')).kind).toBe('success')
    expect(storageDomain.table.size).toBe(0)
  })

  it('is not registered when both session and workspace grants are disabled', () => {
    const commands = commandCapture()
    const ctx = contextWith(landlock, { commands })
    apply(ctx, { allowSessionGrants: false, allowWorkspaceGrants: false })
    expect(commands.definition()).toBeUndefined()
  })

  it('refuses a session grant when only workspace grants are enabled', async () => {
    const dir = tempDir('extra-session-')
    const commands = commandCapture()
    const ctx = contextWith(landlock, { commands, storageDomain: fakeStorageDomain() })
    apply(ctx, { allowSessionGrants: false })
    await settle()
    const result = await commands.definition().handler({ agent: { id: 's1', session: { id: 's1', header: { cwd: '/' } } }, rawInput: dir })
    expect(result.kind).toBe('error')
    expect(result.text).toContain('/grant-dir workspace')
  })
})
