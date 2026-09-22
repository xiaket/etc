/**
 * Durable state declaration for workspace grants.
 *
 * A workspace grant says "every session whose workspace is (or is under) this
 * directory may write under these roots". It lives in a storage domain rather
 * than a hand-rolled JSON file so the domain layer owns serialization, schema
 * validation, and cross-process write ordering; the same choice the harness's
 * own `dsh-workspace` and the sibling `dsh-worktree-pool` plugin make.
 *
 * Table `workspace_grants`: key = canonical workspace directory (the
 * worktree-pool repository root when that plugin owns the session, else the
 * session cwd); value = the granted roots, canonical absolute paths.
 *
 * The domain name uses an underscore: `UNIT_NAME_RE` is `/^[a-z][a-z0-9_]*$/`,
 * and `defineDomain` throws at module load on a hyphenated name.
 *
 * @module dsh-sandbox-extra-roots/spec
 */
import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

/** One workspace's granted roots. */
export const workspaceGrant = z.object({
  /** Canonical absolute directories every session of the workspace may write under. */
  roots: z.array(z.string()),
})

/** The plugin's storage domain: one table of workspace grants. */
export const grantsDomainSpec = defineDomain({
  name: 'sandbox_extra_roots',
  version: 1,
  tables: { workspace_grants: domainTable(workspaceGrant) },
})
