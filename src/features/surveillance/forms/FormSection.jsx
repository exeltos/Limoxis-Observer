import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Open / closed state of the sections lives in the tab, so a deep link or a header chip can
// open one (e.g. the NEWS2 chip opens «Κλίμακες»). A section is a heading line, a one-line
// summary while it is closed and its content while it is open.
export const FormsTabContext = createContext({ isOpen: () => true, toggle: () => {}, offer: () => {} })
export const useFormsTab = () => useContext(FormsTabContext)

// Which sections are open: the tab and any page that shows a few sections on their own
// (the staff record) keep it with this hook. A section that needs action opens itself unless
// the user already chose; openSection opens one from outside (a deep link, a header chip).
export function useFormsTabState() {
  const [open, setOpen] = useState({})
  const touched = useRef(new Set())
  const toggle = useCallback(id => {
    touched.current.add(id)
    setOpen(current => ({ ...current, [id]: !current[id] }))
  }, [])
  const offer = useCallback((id, wantOpen, attentionNow) => {
    setOpen(current => {
      if (!(id in current)) return { ...current, [id]: wantOpen }
      if (attentionNow && !touched.current.has(id) && !current[id]) return { ...current, [id]: true }
      return current
    })
  }, [])
  const openSection = useCallback(id => {
    touched.current.add(id)
    setOpen(current => ({ ...current, [id]: true }))
  }, [])
  const value = useMemo(() => ({ isOpen: id => Boolean(open[id]), toggle, offer }), [open, toggle, offer])
  return { value, openSection }
}

export function FormsTabProvider({ children }) {
  const { value } = useFormsTabState()
  return <FormsTabContext.Provider value={value}>{children}</FormsTabContext.Provider>
}

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
