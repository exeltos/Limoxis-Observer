import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import type { ReactNode } from 'react'
import type { OverflowItem } from '../../../design-system/OverflowMenu'
import type { LucideIcon } from 'lucide-react'

// Open / closed state of the sections lives in the tab, so a deep link or a header chip can
// open one (e.g. the NEWS2 chip opens «Κλίμακες»). A section is a heading line, a one-line
// summary while it is closed and its content while it is open.
export interface FormsTabValue {
  isOpen: (id: string) => boolean
  toggle: (id: string) => void
  offer: (id: string, wantOpen: boolean) => void
  // The forms tab itself: every section open, the row's action in its «⋯».
  flat?: boolean
}
export const FormsTabContext = createContext<FormsTabValue>({ isOpen: () => true, toggle: () => {}, offer: () => {} })
export const useFormsTab = () => useContext(FormsTabContext)

// Which sections are open: the tab and any page that shows a few sections on their own
// (the staff record) keep it with this hook. A section that needs action opens itself unless
// the user already chose; openSection opens one from outside (a deep link, a header chip).
export function useFormsTabState() {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const touched = useRef(new Set<string>())
  const toggle = useCallback((id: string) => {
    touched.current.add(id)
    setOpen(current => ({ ...current, [id]: !current[id] }))
  }, [])
  // A section says how it would like to be: the first time sets its default; later it only ever
  // asks to open (its data arrived, or it needs action), and only if the user has not chosen.
  const offer = useCallback((id: string, wantOpen: boolean) => {
    setOpen(current => {
      if (!(id in current)) return { ...current, [id]: wantOpen }
      if (wantOpen && !touched.current.has(id) && !current[id]) return { ...current, [id]: true }
      return current
    })
  }, [])
  const openSection = useCallback((id: string) => {
    touched.current.add(id)
    setOpen(current => ({ ...current, [id]: true }))
  }, [])
  const value = useMemo(() => ({ isOpen: (id: string) => Boolean(open[id]), toggle, offer }), [open, toggle, offer])
  return { value, openSection }
}

interface FormsTabProviderProps {
  children: ReactNode
}
export function FormsTabProvider({ children }: FormsTabProviderProps) {
  const { value } = useFormsTabState()
  return <FormsTabContext.Provider value={value}>{children}</FormsTabContext.Provider>
}

interface FormLineProps {
  id: string
  title: string
  icon: LucideIcon
  summary?: ReactNode
  action?: ReactNode
}
// A section that is a single line, without a body: icon, title, what it says and its link.
export function FormLine({ id, title, icon: Icon, summary, action }: FormLineProps) {
  return (
    <section className="episode-form-section episode-form-line" data-section={id}>
      <div className="episode-form-section-head">
        <div className="episode-form-section-toggle">
          {Icon && <Icon size={15} aria-hidden="true" />}
          <h3>{title}</h3>
          <span className="episode-form-summary">{summary}</span>
        </div>
        {action && <div className="episode-form-section-actions">{action}</div>}
      </div>
    </section>
  )
}

interface FormSectionProps {
  id: string
  title: string
  icon: LucideIcon
  summary?: ReactNode
  defaultOpen?: boolean
  needsAttention?: boolean
  // A list becomes the section's «⋯» menu; anything else is shown as it is (a button).
  actions?: (OverflowItem | false | null | undefined)[] | ReactNode
  children: ReactNode
}
export function FormSection({ id, title, icon: Icon, summary, defaultOpen = false, needsAttention = false, actions, children }: FormSectionProps) {
  const { isOpen, toggle, offer, flat } = useFormsTab()
  const { t } = useLanguage()
  // The tab learns how each section would like to be; one that needs action opens itself
  // (unless the user already chose).
  useEffect(() => {
    offer(id, defaultOpen || needsAttention)
  }, [id, defaultOpen, needsAttention, offer])
  const open = flat || isOpen(id)
  // Actions as menu items ([{ id, label, icon, onClick }]) sit in a «⋯»; a node is shown as it is.
  const actionNode = Array.isArray(actions) ? (actions.filter(Boolean).length ? <OverflowMenu label={t('episodeForms.rowActions')} items={actions.filter(Boolean)} /> : null) : actions
  if (flat)
    return (
      <section className="episode-form-section is-open is-flat" data-section={id}>
        <div className="episode-form-section-head">
          <div className="episode-form-section-title">
            {Icon && <Icon size={15} aria-hidden="true" />}
            <h3>{title}</h3>
          </div>
          {actionNode && <div className="episode-form-section-actions">{actionNode}</div>}
        </div>
        <div className="episode-form-section-body" id={`episode-form-body-${id}`}>
          {children}
        </div>
      </section>
    )
  return (
    <section className={`episode-form-section${open ? ' is-open' : ''}`} data-section={id}>
      <div className="episode-form-section-head">
        <button type="button" className="episode-form-section-toggle" aria-expanded={open} aria-controls={`episode-form-body-${id}`} onClick={() => toggle(id)}>
          <ChevronDown size={16} aria-hidden="true" />
          {Icon && <Icon size={15} aria-hidden="true" />}
          <h3>{title}</h3>
          {!open && summary && <span className="episode-form-summary">{summary}</span>}
        </button>
        {actionNode && <div className="episode-form-section-actions">{actionNode}</div>}
      </div>
      {/* Always mounted (hidden while closed): the data and dialogs of a section stay alive. */}
      <div className="episode-form-section-body" id={`episode-form-body-${id}`} hidden={!open}>
        {children}
      </div>
    </section>
  )
}
