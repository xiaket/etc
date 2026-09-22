# dsh-sandbox-extra-roots

Grant extra writable directories to a DeepSeek Harness session under `workspace-write`, for both fences DSH enforces: the process sandbox around `bash` (landlock-run / bwrap) and the in-process fence of the `write` / `edit` tools.

## What you get

A `workspace-write` session may write under its workspace root and the platform temp areas, nothing else. This plugin adds directories to that allow-list from four sources, unioned per call:

| Source | Lifetime | Where it lives |
|---|---|---|
| `roots` | every session | plugin config |
| `grants[{repoRoot, roots}]` | sessions whose workspace is at or under `repoRoot` | plugin config |
| workspace grants | every session of one workspace, across restarts | storage domain `sandbox_extra_roots` (`~/.dsh/storages/sandbox_extra_roots.json` with the JSON backend) |
| session grants | one session, until the DSH process exits | memory |

`read-only` and `danger-full-access` sessions are never changed.

### Prompt on denial

When a `workspace-write` call is refused, the plugin asks the user in the normal question UI:

1. **Which directory should become writable?** — for a `write`/`edit`, the target's parent and a few ancestors; for `bash`, the absolute paths named in the command's stderr (plus the workdir). A free-text field takes any other path (`~` expands).
2. **Scope** — *This session only*, *All sessions in `<workspace>`* (persisted), or *No*.

After a grant, a `write`/`edit` is retried once immediately, so the model sees the successful result. A `bash` command is **not** rerun (it may not be idempotent); its result gains a notice telling the model to rerun the same command.

No prompt appears — and the plain denial stands — for delegated child agents, agent-less calls, sessions without a UI answerer, aborted calls, or while another prompt is already pending for the same session.

The workspace of a session is the `dsh-worktree-pool` repository root when that plugin owns the session, else the session's cwd. A workspace grant applies to sessions whose key equals the repository root or whose workspace root lies under the granted workspace directory.

### `/grant-dir`

```text
/grant-dir <path>                 grant <path> to this session (memory only)
/grant-dir list                   session grants + workspace grants that apply
/grant-dir revoke <path>
/grant-dir clear
/grant-dir workspace <path>       persist <path> for every session in this workspace
/grant-dir workspace list
/grant-dir workspace revoke <path>
/grant-dir workspace clear
```

Relative paths resolve against the session cwd; `~` expands. Only existing directories can be granted.

### Model experience

The runtime-context snapshot gains one line listing the extra writable directories of the session when there are any (order right after the DSH sandbox policy line). It rides the same cache-safe snapshot the harness already logs, so it costs no stable-prefix invalidation and is reconstructable from the session log.

## Configuration

```yaml
- insert:
    - id: sandbox-extra-roots
      name: 'dsh-sandbox-extra-roots'
      config:
        roots: ['~/.cache/bazel']                 # global
        grants:                                    # per configured repo
          - repoRoot: ~/work/some-repo
            roots: ['~/.cache/some-repo-build-cache']
        allowSessionGrants: true                   # /grant-dir <path>, prompt "This session only"
        allowWorkspaceGrants: true                 # /grant-dir workspace, prompt "All sessions in …"; needs storageDomain
        promptOnDenial: true                       # ask on fs/bash denials
```

Workspace grants require `@deepseek-ai/dsh-storage`, a backend, and `@deepseek-ai/dsh-storage-domain` in the composition (the `dsh-base` bundle has them). Without them the workspace option is omitted and `/grant-dir workspace` reports the gap. The prompt requires `@deepseek-ai/dsh-user-questions` plus a UI answerer (`dsh-web-app`).

## Known limitations

- Background `bash` jobs (`run_in_background`) are confined with the grants but a denial inside one does not prompt.
- The directories offered for a `bash` denial come from parsing stderr for absolute paths; a tool that reports a relative path yields no candidates, and the free-text field is the fallback.
- Extra roots are appended to the runner argv (`--rw` for landlock-run, `--bind` for bwrap); the seatbelt runner is not supported and logs a warning once.
- The plugin reaches into `dsh-sandbox-local` (argv dialect), `dsh-fs-sandbox` (`writeText`/`editText` policy argument, `FS_SANDBOX_DENIED`), and `dsh-bash-sandbox` (`result.sandbox.denied`). Verified against dsh 0.1.1-rc.2 through 0.1.6-alpha.1.

## Development

```sh
pnpm --filter dsh-sandbox-extra-roots test
scripts/redeploy.sh sandbox-extra-roots   # relink into ~/.dsh/profiles/web, then restart dsh web
```
