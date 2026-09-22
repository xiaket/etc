import { describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkspaceMapStore } from '../src/host/workspace-map.ts'

async function store(): Promise<WorkspaceMapStore> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-baton-map-'))
  const s = new WorkspaceMapStore({ file: join(dir, 'map.json') })
  await s.load()
  return s
}

describe('WorkspaceMapStore.initFromWorkspaces', () => {
  it('adds new rows, keeps descriptions, refreshes paths, prunes gone and excluded rows', async () => {
    const s = await store()
    await s.initFromWorkspaces([{ id: 'a', path: '/a', title: 'A' }, { id: 'gone', path: '/g', title: 'G' }])
    await s.update('a', { description: 'the A repo' })
    await s.initFromWorkspaces(
      [{ id: 'a', path: '/a2', title: 'A' }, { id: 'pool', path: '/mnt/wtpool-abc', title: 'wtpool-abc' }, { id: 'b', path: '/b', title: 'B' }],
      ws => ws.title.startsWith('wtpool-'),
    )
    expect(s.snapshot()).toEqual({
      a: { path: '/a2', description: 'the A repo', aliases: ['A'] },
      b: { path: '/b', description: '', aliases: ['B'] },
    })
  })
})
