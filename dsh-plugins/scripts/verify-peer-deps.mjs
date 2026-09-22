/**
 * Gate: harness-provided packages must never be `dependencies`.
 *
 * A plugin is loaded INTO a running harness, so it must consume the host's
 * copy of every `@deepseek-ai/*` runtime package. Declaring one as a
 * `dependency` installs a SECOND copy beside the host's: two `Service`
 * registries, two sets of branded ids, and failures that surface as
 * "service not found" long after the mistake.
 *
 * The reference is the shipped third-party plugin `dsh-taskboard`, whose
 * `dependencies` and `peerDependencies` are both empty: the host supplies
 * everything. Verified against dsh 0.1.5-rc.2.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const PACKAGES = 'packages'
const failures = []

for (const name of readdirSync(PACKAGES)) {
  const manifestPath = join(PACKAGES, name, 'package.json')
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const deps = manifest.dependencies ?? {}
  for (const dep of Object.keys(deps)) {
    if (dep.startsWith('@deepseek-ai/')) {
      failures.push(`${name}: "${dep}" is a dependency; move it to peerDependencies`)
    }
  }
  // A pinned prerelease peer cannot float with the host. Range or nothing.
  const peers = manifest.peerDependencies ?? {}
  for (const [dep, range] of Object.entries(peers)) {
    if (!dep.startsWith('@deepseek-ai/')) continue
    if (/^\d/.test(range) && range.includes('-')) {
      failures.push(`${name}: peer "${dep}" is pinned to exactly ${range}; a host on any other build cannot satisfy it`)
    }
  }
}

if (failures.length > 0) {
  console.error('verify-peer-deps FAILED:')
  for (const line of failures) console.error('  -', line)
  process.exit(1)
}
console.log(`verify-peer-deps ok (${readdirSync(PACKAGES).length} packages)`)
