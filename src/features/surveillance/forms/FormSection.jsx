import { createContext, useContext, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

// Open / closed state of the sections lives in the tab, so a deep link or a header chip can
// open one (e.g. the NEWS2 chip opens «Κλίμακες»). A section is a heading line, a one-line
// summary while it is closed and its content while it is open.
export const FormsTabContext = createContext({ isOpen: () => true, toggle: () => {}, offer: () => {} })
export const useFormsTab = () => useContext(FormsTabContext)

export function FormSection({ id, title, icon: Icon, summary, defaultOpen = false, needsAttention = false, actions, children }) {
  const { isOpen, toggle, offer } = useFormsTab()
  // The tab learns each section's default once; a section that needs action opens itself
  // (unless the user already chose).
  const offered = useRef(false)
  useEffect(() => {
    offer(id, defaultOpen || needsAttention, offered.current ? needsAttention : false)
    offered.current = true
  }, [id, defaultOpen, needsAttention, offer])
  const open = isOpen(id)
  return (
    <section className={`episode-form-section${open ? ' is-open' : ''}`} data-section={id}>
      <div className="episode-form-section-head">
        <button type="button" className="episode-form-section-toggle" aria-expanded={open} aria-controls={`episode-form-body-${id}`} onClick={() => toggle(id)}>
          <ChevronDown size={16} aria-hidden="true" />
          {Icon && <Icon size={15} aria-hidden="true" />}
          <h3>{title}</h3>
          {!open && summary && <span className="episode-form-summary">{summary}</span>}
        </button>
        {actions && <div className="episode-form-section-actions">{actions}</div>}
      </div>
      {/* Always mounted (hidden while closed): the data and dialogs of a section stay alive. */}
      <div className="episode-form-section-body" id={`episode-form-body-${id}`} hidden={!open}>
        {children}
      </div>
    </section>
  )
}
