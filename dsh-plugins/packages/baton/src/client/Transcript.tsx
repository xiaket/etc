/**
 * The commander conversation: user bubbles, Markdown assistant text (live or
 * settled), dispatch cards that reflect the task's current status, and
 * compact rows for other tool calls.
 *
 * @module dsh-baton/client/Transcript
 */
import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { Button, MarkdownText, StateDot, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { TaskSummary } from '../shared/protocol.ts'
import { css } from './styles.ts'
import type { Transcript as TranscriptData } from './transcript.ts'
import { statusKey, statusLook } from './view-model.ts'

/** Transcript props. */
export interface TranscriptProps {
  t: TranslateNS<'baton'>
  transcript: TranscriptData
  tasks: readonly TaskSummary[]
  workspaceTitles: ReadonlyMap<string, string>
  onOpen(sessionId: string): void
}

/** The scrolling conversation column. */
export function Transcript(props: TranscriptProps): ReactElement {
  const { t, transcript, tasks, workspaceTitles, onOpen } = props
  const scroller = useRef<HTMLDivElement | null>(null)
  const pinned = useRef(true)
  const labels = useMemo(() => ({
    code: { copyLabel: t('markdown.copy'), copiedLabel: t('markdown.copied') },
    footnotes: t('markdown.footnotes'),
  }), [t])
  const byId = useMemo(() => new Map(tasks.map(task => [task.id, task] as const)), [tasks])

  useEffect(() => {
    const el = scroller.current
    if (el !== null && pinned.current) el.scrollTop = el.scrollHeight
  }, [transcript])

  const onScroll = (): void => {
    const el = scroller.current
    if (el === null) return
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  return (
    <div className={css.transcript} ref={scroller} onScroll={onScroll}>
      <div className={css.transcriptInner}>
        {transcript.items.length === 0 && <div className={css.empty}>{t('transcript.empty')}</div>}
        {transcript.items.map(item => {
          switch (item.kind) {
            case 'user':
              return (
                <div key={item.key} className={css.row}>
                  <div className={`${css.avatar} ${css.avatarUser}`} aria-hidden>YOU</div>
                  <div className={css.bubble}>{item.text}</div>
                </div>
              )
            case 'assistant':
              return (
                <div key={item.key} className={css.row}>
                  <div className={`${css.avatar} ${css.avatarAi}`} aria-hidden>AI</div>
                  <div className={`${css.bubble} ${item.streaming ? css.streaming : ''}`}>
                    <MarkdownText text={item.text} streaming={item.streaming} labels={labels} />
                  </div>
                </div>
              )
            case 'notice':
              return <div key={item.key} className={css.notice}>{item.text}</div>
            case 'tool':
              return (
                <div key={item.key} className={css.toolRow}>
                  <span className={css.mono}>{item.name}</span>
                  {item.failed && <Tag tone="danger">{t('transcript.toolFailed')}</Tag>}
                </div>
              )
            case 'dispatch': {
              const task = item.taskId === undefined ? undefined : byId.get(item.taskId)
              const status = task?.status
              const look = status === undefined ? undefined : statusLook(status)
              return (
                <div key={item.key} className={css.card}>
                  <div className={css.cardHead}>
                    {look !== undefined && <StateDot state={look.dot} size={8} />}
                    <span className={css.cardTitle}>{task?.title ?? item.title}</span>
                    <span className={css.mono}>{workspaceTitles.get(item.workspaceId) ?? item.workspaceId}</span>
                    <span className={css.cardMeta}>
                      {item.failed
                        ? <Tag tone="danger">{t('dispatch.failed')}</Tag>
                        : status !== undefined && look !== undefined && <Tag tone={look.tone}>{t(statusKey(status))}</Tag>}
                    </span>
                  </div>
                  {task?.resultSummary !== undefined && <div className={css.cardSub}>{task.resultSummary}</div>}
                  {task?.error !== undefined && <div className={css.error}>{task.error}</div>}
                  {task?.sessionId !== undefined && (
                    <div className={css.cardActions}>
                      <Button variant="ghost" size="sm" onClick={() => { onOpen(task.sessionId ?? '') }}>{t('dispatch.open')}</Button>
                    </div>
                  )}
                </div>
              )
            }
          }
        })}
      </div>
    </div>
  )
}
