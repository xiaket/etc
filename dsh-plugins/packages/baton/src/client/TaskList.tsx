/**
 * Right column: filter chips, sort toggle, and one card per task with its
 * status, workspace, age, and the actions its status allows.
 *
 * @module dsh-baton/client/TaskList
 */
import type { ReactElement } from 'react'
import { Button, Pill, StateDot, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { TaskSummary, WorkspaceMap } from '../shared/protocol.ts'
import { css } from './styles.ts'
import {
  FILTERS, filterCounts, filterKey, relativeAge, statusKey, statusLook, visibleTasks,
  type TaskFilter, type TaskSort,
} from './view-model.ts'

/** Task list props. */
export interface TaskListProps {
  t: TranslateNS<'baton'>
  tasks: readonly TaskSummary[]
  workspaceMap: WorkspaceMap
  workspaceTitles: ReadonlyMap<string, string>
  filter: TaskFilter
  sort: TaskSort
  now: number
  onFilter(filter: TaskFilter): void
  onSort(sort: TaskSort): void
  onOpen(sessionId: string): void
  onAck(taskId: string): void
  onCancel(taskId: string): void
}

function workspaceLabel(task: TaskSummary, titles: ReadonlyMap<string, string>, map: WorkspaceMap): string {
  const title = titles.get(task.workspaceId)
  if (title !== undefined) return title
  const path = map[task.workspaceId]?.path
  if (path !== undefined) {
    const base = path.split('/').filter(Boolean).pop()
    if (base !== undefined) return base
  }
  return task.workspaceId
}

/** The task column. */
export function TaskList(props: TaskListProps): ReactElement {
  const { t, tasks, workspaceMap, workspaceTitles, filter, sort, now, onFilter, onSort, onOpen, onAck, onCancel } = props
  const counts = filterCounts(tasks)
  const visible = visibleTasks(tasks, filter, sort)
  return (
    <aside className={css.side} aria-label={t('tasks.title')}>
      <div className={css.sideHead}>
        <div className={css.sideTitle}>
          <span>{t('tasks.title')}</span>
          <Button variant="ghost" size="sm" onClick={() => { onSort(sort === 'status' ? 'recent' : 'status') }} aria-label={t('tasks.sort')}>
            {sort === 'status' ? t('tasks.sort.status') : t('tasks.sort.recent')}
          </Button>
        </div>
        <div className={css.filters} role="tablist">
          {FILTERS.map(item => (
            <Pill key={item} active={filter === item} role="tab" aria-selected={filter === item} onClick={() => { onFilter(item) }}>
              {t(filterKey(item))}
              <span className={css.count}>{counts[item]}</span>
            </Pill>
          ))}
        </div>
      </div>
      <div className={css.taskList}>
        {visible.length === 0 && <div className={css.empty}>{t('tasks.empty')}</div>}
        {visible.map(task => {
          const look = statusLook(task.status)
          const age = relativeAge(task.lastActivityAt, now)
          const openable = task.sessionId !== undefined
          return (
            <div
              key={task.id}
              className={css.task}
              role={openable ? 'button' : undefined}
              tabIndex={openable ? 0 : undefined}
              onClick={() => { if (task.sessionId !== undefined) onOpen(task.sessionId) }}
              onKeyDown={event => { if (event.key === 'Enter' && task.sessionId !== undefined) onOpen(task.sessionId) }}
            >
              <div className={css.taskAccent} data-baton-accent={task.status} />
              <div className={css.taskMain}>
                <div className={css.taskTitle}>
                  <StateDot state={look.dot} size={8} />
                  <span>{task.title}</span>
                  <Tag tone={look.tone}>{t(statusKey(task.status))}</Tag>
                </div>
                <div className={css.taskMeta}>
                  <span className={css.mono}>{workspaceLabel(task, workspaceTitles, workspaceMap)}</span>
                  <span>{t(age.key, age.params)}</span>
                  {task.isolation === 'shared' && <Tag tone="outline">{t('tasks.isolation.shared')}</Tag>}
                </div>
                {task.error !== undefined && <div className={css.error}>{task.error}</div>}
                {(task.status === 'in_review' || task.status === 'running' || task.status === 'needs_input' || task.status === 'failed') && (
                  <div className={css.taskActions} onClick={event => { event.stopPropagation() }}>
                    {task.status === 'in_review' && (
                      <Button variant="primary" size="sm" onClick={() => { onAck(task.id) }}>{t('tasks.ack')}</Button>
                    )}
                    {task.sessionId !== undefined && (
                      <Button variant="ghost" size="sm" onClick={() => { onOpen(task.sessionId ?? '') }}>{t('tasks.open')}</Button>
                    )}
                    {task.status !== 'in_review' && (
                      <Button variant="ghost" size="sm" onClick={() => { onCancel(task.id) }}>{t('tasks.cancel')}</Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
