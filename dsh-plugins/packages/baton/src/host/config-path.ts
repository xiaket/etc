import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Expand home shorthand and environment references in a user-configured path.
 * This is deliberately interpolation only: it does not invoke a shell.
 */
export function expandConfigPath(
  input: string,
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): string {
  const home = env.HOME || homeDirectory
  let expanded = input

  if (expanded === '~') expanded = home
  else if (expanded.startsWith('~/')) expanded = join(home, expanded.slice(2))

  return expanded.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (reference, braced: string | undefined, bare: string | undefined) => {
    const name = braced ?? bare
    if (name === undefined) return reference
    const value = name === 'HOME' ? home : env[name]
    if (value === undefined) {
      throw new Error(`Cannot expand $${name} in commanderCwd: environment variable is not set`)
    }
    return value
  })
}
