import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useOptionalLanguage } from '../core/i18n/LanguageContext'

// Secondary content of a summary, folded behind «Περισσότερα» so a record's
// first screen stays short (no long scrolling). It is always in the page (only
// `hidden`), so printing shows it unfolded.
export function MoreSection({ children, moreLabel, lessLabel, className = '', defaultOpen = false }) {
  const en = useOptionalLanguage()?.language === 'en'
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={`lo-more-section ${open ? 'is-open' : ''} ${className}`.trim()}>
      <div id={id} className="lo-more-section-body" hidden={!open}>
        {children}
      </div>
      <button
        type="button"
        className="lo-more-section-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(value => !value)}
      >
        {open ? lessLabel || (en ? 'Less' : 'Λιγότερα') : moreLabel || (en ? 'More' : 'Περισσότερα')}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
