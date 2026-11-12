import './recordLink.css'
import type { ReactNode } from 'react'

// A name inside a table cell that opens the record it names (user, organization). The row itself is not clickable, so a
// row with a «⋯» menu keeps one meaning; where no record exists the caller renders plain text instead.
export function RecordLink({ onClick, title, children }: { onClick: () => void, title?: string, children?: ReactNode }) {
  return <button type="button" className="record-link" title={title} onClick={event => { event.stopPropagation(); onClick() }}>{children}</button>
}
