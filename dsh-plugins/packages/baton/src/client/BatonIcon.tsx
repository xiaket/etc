/**
 * Sidebar glyph for the workbench panel entry. The sidebar owns the row and
 * its label; this component only draws the icon at the requested size.
 *
 * @module dsh-baton/client/BatonIcon
 */
import type { ReactElement } from 'react'
import type { IconProps } from './contract.ts'

/** A stylized command-center mark: three lanes converging on one input. */
export function BatonIcon({ size }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="2" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 5.5h7M4.5 8h4.5M4.5 10.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
