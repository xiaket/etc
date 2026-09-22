/**
 * Frame-wide toasts for settled tasks, in the `shell.overlay` seat. A toast
 * plays a short tone on arrival, opens the worker session when clicked, and
 * dismisses itself after a hold.
 *
 * @module dsh-baton/client/ToastStack
 */
import { useEffect, useRef, type ReactElement } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToastProps } from './contract.ts'
import type { SettledNotice } from './feed.ts'
import { css } from './styles.ts'

const HOLD_MS = 8_000

/** Short two-note chime; silently no-ops without Web Audio. */
function chime(failed: boolean): void {
  try {
    const ac = new AudioContext()
    const play = (frequency: number, at: number): void => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.type = 'sine'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, ac.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.3)
      osc.start(ac.currentTime + at)
      osc.stop(ac.currentTime + at + 0.32)
    }
    play(failed ? 440 : 660, 0)
    play(failed ? 330 : 880, 0.18)
    setTimeout(() => { void ac.close() }, 800)
  } catch {
    // Audio is unavailable (autoplay policy or no AudioContext); the toast still shows.
  }
}

function ToastItem({ notice, onOpen, onDismiss, text }: {
  notice: SettledNotice
  text: string
  onOpen(sessionId: string): void
  onDismiss(id: string): void
}): ReactElement {
  const played = useRef(false)
  useEffect(() => {
    if (!played.current) {
      played.current = true
      chime(notice.outcome === 'failed')
    }
    const timer = setTimeout(() => { onDismiss(notice.id) }, HOLD_MS)
    return () => { clearTimeout(timer) }
  }, [notice.id, notice.outcome, onDismiss])
  return (
    <div
      className={css.toast}
      role="status"
      onClick={() => {
        if (notice.task.sessionId !== undefined) onOpen(notice.task.sessionId)
        onDismiss(notice.id)
      }}
    >
      <StateDot state={notice.outcome === 'failed' ? 'error' : 'done'} size={10} />
      <div>
        <div className={css.toastTitle}>{text}</div>
        {notice.task.resultSummary !== undefined && <div className={css.toastBody}>{notice.task.resultSummary}</div>}
        {notice.task.error !== undefined && <div className={css.toastBody}>{notice.task.error}</div>}
      </div>
    </div>
  )
}

/** The overlay stack. */
export function ToastStack(props: ToastProps): ReactElement | null {
  const { t, useNotices, openSession, dismiss } = props
  const notices = useNotices(list => list)
  if (notices.length === 0) return null
  return (
    <div className={css.toastStack}>
      {notices.map(notice => (
        <ToastItem
          key={notice.id}
          notice={notice}
          text={t(notice.outcome === 'failed' ? 'toast.failed' : 'toast.in_review', { title: notice.task.title })}
          onOpen={openSession}
          onDismiss={dismiss}
        />
      ))}
    </div>
  )
}
