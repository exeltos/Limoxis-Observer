import { createContext, useContext, type ReactNode } from 'react'
import { CanonicalTabs, type CanonicalTab } from './CanonicalTabs'

// A section that brings several screens under one menu entry (see
// core/navigation/sectionTabs.js) gives its screens this context: the page
// shows the section's name and its tabs under the header, whichever screen is open.
// value: { title, ariaLabel, items: [{ value, label, icon }], value, onChange }
export interface SectionTabsValue {
  title?: string
  ariaLabel?: string
  items: CanonicalTab[]
  value: string
  onChange: (value: string) => void
}

const SectionTabsContext = createContext<SectionTabsValue | null>(null)

export function SectionTabsProvider({ value, children }: { value: SectionTabsValue | null; children?: ReactNode }) {
  return <SectionTabsContext.Provider value={value}>{children}</SectionTabsContext.Provider>
}

export function useSectionTabs() {
  return useContext(SectionTabsContext)
}

export function SectionTabStrip({ section }: { section: SectionTabsValue | null }) {
  if (!section || section.items.length < 2) return null
  return <CanonicalTabs className="section-tabs" items={section.items} value={section.value} onChange={section.onChange} ariaLabel={section.ariaLabel || section.title} />
}
