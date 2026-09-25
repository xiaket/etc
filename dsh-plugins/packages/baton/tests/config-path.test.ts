import { describe, expect, it } from 'vitest'
import { expandConfigPath } from '../src/host/config-path.ts'

describe('expandConfigPath', () => {
  const env = { HOME: '/home/test-user', WORK: 'project dir' }

  it('expands a bare tilde to the home directory', () => {
    expect(expandConfigPath('~', env, '/fallback/home')).toBe('/home/test-user')
  })

  it('expands tilde paths and normalizes their separators', () => {
    expect(expandConfigPath('~/.dsh/baton', env)).toBe('/home/test-user/.dsh/baton')
  })

  it('expands bare and braced environment variables', () => {
    expect(expandConfigPath('$HOME/.dsh/${WORK}', env)).toBe('/home/test-user/.dsh/project dir')
  })

  it('uses the platform home directory when HOME is missing', () => {
    expect(expandConfigPath('$HOME/.dsh/baton', {}, '/fallback/home')).toBe('/fallback/home/.dsh/baton')
    expect(expandConfigPath('~/baton', {}, '/fallback/home')).toBe('/fallback/home/baton')
  })

  it('leaves relative paths relative', () => {
    expect(expandConfigPath('./baton', env)).toBe('./baton')
  })

  it('fails clearly for an unset variable', () => {
    expect(() => expandConfigPath('$MISSING/baton', env)).toThrow('environment variable is not set')
  })
})
