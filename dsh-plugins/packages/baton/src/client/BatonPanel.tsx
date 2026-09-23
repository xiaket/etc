/**
 * The workbench main panel: header counters, the needs-input banner, the
 * commander transcript with its composer, and the task column.
 *
 * Everything reactive arrives through injected `use*` hooks and the standard
 * `useWorkspaces` / `useSessionPendingInteraction` seats; every verb is an
 * injected callback.
 *
 * @module dsh-baton/client/BatonPanel
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { Composer } from './Composer.tsx'
import type { PanelProps } from './contract.ts'
import { css } from './styles.ts'
import { TaskList } from './TaskList.tsx'
import { Transcript } from './TranscriptView.tsx'
import { needsInput, runningCount } from './view-model.ts'

const CLOCK_MS = 30_000

/** The panel body. */
export function BatonPanel(props: PanelProps): ReactElement {
  const { t, useBaton, useCommander, usePrefs, useBoot, useWorkspaces, useSessionPendingInteraction } = props
  const baton = useBaton(state => state)
  const commander = useCommander(view => view)
  const prefs = usePrefs(view => view)
  const boot = useBoot(view => view)
  const workspaceItems = useWorkspaces(snapshot => snapshot.items)
  const pending = useSessionPendingInteraction(snapshot => snapshot)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { props.activate() }, [props.activate])
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, CLOCK_MS)
    return () => { clearInterval(timer) }
  }, [])

  const repos = useMemo(() => workspaceItems.map(item => ({ id: item.workspaceId, title: item.title })), [workspaceItems])
  const workspaceTitles = useMemo(() => new Map(repos.map(repo => [repo.id, repo.title] as const)), [repos])
  const blocked = useMemo(() => needsInput(baton.tasks), [baton.tasks])
  const running = runningCount(baton.tasks)
  const commanderWaiting = commander.sessionId !== null && pending.has(commander.sessionId as never)
  const composerDisabled = boot.phase !== 'ready' || !commander.bound

  return (
    <div className={css.root}>
      <header className={css.header}>
        <span className={css.headerTitle}>{t('header.title')}</span>
        <span className={css.headerChip}>{t('header.repos', { count: repos.length })}</span>
        <div className={css.headerRight}>
          {baton.connection !== 'live' && (
            <span className={css.headerChip}>
              {t(baton.connection === 'connecting' ? 'connection.connecting' : 'connection.reconnecting')}
            </span>
          )}
          <span className={css.headerChip}>
            <span className={css.icon} data-baton-accent="running" style={{ width: 6, height: 6, borderRadius: 3 }} aria-hidden />
            {t('header.running', { count: running })}
          </span>
        </div>
      </header>

      {boot.phase === 'failed' && (
        <div className={`${css.banner} ${css.bannerWarn}`} role="alert">
          <span className={css.bannerText}>{t('commander.failed', { error: boot.error ?? '' })}</span>
          <div className={css.bannerActions}>
            <Button variant="outline" size="sm" onClick={props.retryActivate}>{t('commander.retry')}</Button>
          </div>
        </div>
      )}
      {boot.phase === 'starting' && (
        <div className={css.banner}><span className={css.bannerText}>{t('commander.starting')}</span></div>
      )}
      {blocked.length > 0 && (
        <div className={`${css.banner} ${css.bannerWarn}`} role="status">
          <strong>{t('banner.needsInput', { count: blocked.length })}</strong>
          <span className={css.bannerText}>
            {t('banner.needsInput.detail', {
              title: blocked[0]?.title ?? '',
              kind: t(blocked[0]?.pendingInput?.kind === 'approval' ? 'banner.kind.approval' : 'banner.kind.question'),
            })}
          </span>
          <div className={css.bannerActions}>
            <Button variant="primary" size="sm" onClick={() => { const id = blocked[0]?.sessionId; if (id !== undefined) props.openSession(id) }}>
              {t('banner.go')}
            </Button>
          </div>
        </div>
      )}
      {commanderWaiting && (
        <div className={`${css.banner} ${css.bannerWarn}`} role="status">
          <span className={css.bannerText}>{t('banner.commanderWaiting')}</span>
          <div className={css.bannerActions}>
            <Button variant="primary" size="sm" onClick={props.openCommanderFull}>{t('banner.openFull')}</Button>
          </div>
        </div>
      )}
      {baton.lastError !== null && (
        <div className={`${css.banner} ${css.bannerWarn}`} role="alert"><span className={css.bannerText}>{baton.lastError}</span></div>
      )}

      <div className={css.body}>
        <div className={css.center}>
          <Transcript
            t={t}
            transcript={commander.transcript}
            tasks={baton.tasks}
            workspaceTitles={workspaceTitles}
            onOpen={props.openSession}
          />
          <Composer
            t={t}
            repos={repos}
            repoId={prefs.repoId}
            researchOnly={prefs.researchOnly}
            running={commander.running}
            disabled={composerDisabled}
            onSend={props.send}
            onStop={props.stopCommander}
            onRepo={props.setRepo}
            onResearchOnly={props.setResearchOnly}
          />
        </div>
        <TaskList
          t={t}
          tasks={baton.tasks}
          workspaceMap={baton.workspaceMap}
          workspaceTitles={workspaceTitles}
          filter={prefs.filter}
          sort={prefs.sort}
          now={now}
          onFilter={props.setFilter}
          onSort={props.setSort}
          onOpen={props.openSession}
          onAck={props.acknowledge}
          onCancel={props.cancelTask}
        />
      </div>
    </div>
  )
}
