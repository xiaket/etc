/**
 * The unified input: a textarea, the send/stop button, and two chips — pick
 * a repo (prefixes the prompt) and research-only (suffixes it).
 *
 * @module dsh-baton/client/Composer
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { Button, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { css } from './styles.ts'
import { composePrompt } from './view-model.ts'

/** One selectable repo. */
export interface RepoOption { id: string; title: string }

/** Composer props. */
export interface ComposerProps {
  t: TranslateNS<'baton'>
  repos: readonly RepoOption[]
  repoId: string | null
  researchOnly: boolean
  running: boolean
  disabled: boolean
  onSend(text: string): void
  onStop(): void
  onRepo(id: string | null): void
  onResearchOnly(on: boolean): void
}

/** The workbench composer. */
export function Composer(props: ComposerProps): ReactElement {
  const { t, repos, repoId, researchOnly, running, disabled, onSend, onStop, onRepo, onResearchOnly } = props
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const repo = repos.find(item => item.id === repoId)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: PointerEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => { document.removeEventListener('pointerdown', close, true) }
  }, [menuOpen])

  useEffect(() => {
    const el = textareaRef.current
    if (el === null) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(240, el.scrollHeight)}px`
  }, [text])

  const submit = useCallback((): void => {
    const prompt = composePrompt(
      text,
      repo === undefined ? undefined : t('composer.pickRepo.prefix', { title: repo.title }),
      researchOnly ? t('composer.researchOnly.suffix') : undefined,
    )
    if (prompt.length === 0 || disabled) return
    onSend(prompt)
    setText('')
  }, [text, repo, researchOnly, disabled, onSend, t])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className={css.composer}>
      <div className={css.composerBox}>
        <textarea
          ref={textareaRef}
          className={css.textarea}
          value={text}
          placeholder={t('composer.placeholder')}
          disabled={disabled}
          rows={2}
          onChange={event => { setText(event.target.value) }}
          onKeyDown={onKeyDown}
        />
        <div className={css.composerBar}>
          <div className={css.composerChips} ref={menuRef}>
            <Pill active={repo !== undefined} onClick={() => { setMenuOpen(open => !open) }} aria-haspopup="menu" aria-expanded={menuOpen}>
              {repo === undefined ? `+ ${t('composer.pickRepo')}` : repo.title}
            </Pill>
            <Pill active={researchOnly} onClick={() => { onResearchOnly(!researchOnly) }} aria-pressed={researchOnly}>
              {t('composer.researchOnly')}
            </Pill>
            {menuOpen && (
              <div className={css.menu} role="menu">
                <button type="button" role="menuitem" className={css.menuItem} onClick={() => { onRepo(null); setMenuOpen(false) }}>
                  {t('composer.pickRepo.clear')}
                </button>
                {repos.map(item => (
                  <button key={item.id} type="button" role="menuitem" className={css.menuItem} onClick={() => { onRepo(item.id); setMenuOpen(false) }}>
                    {item.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          {running
            ? <Button className={css.sendButton} variant="outline" size="sm" onClick={onStop}>{t('composer.stop')}</Button>
            : <Button className={css.sendButton} variant="primary" size="sm" disabled={disabled || text.trim().length === 0} onClick={submit}>{t('composer.send')}</Button>}
        </div>
      </div>
    </div>
  )
}
