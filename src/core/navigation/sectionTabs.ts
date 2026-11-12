import { CAPABILITIES, can, canAny, isProfileDisabled } from '../permissions/roles'

// Sections that bring several screens together under one menu entry, each
// screen a tab. Every tab keeps the gate its screen had on its own: a merged
// section shows only the tabs the role may open, and is hidden when none.
// `capability` is also the module gate (switched off by the operating profile);
// `anyCapabilities`, when present, is the access rule.
// Μια καρτέλα ενότητας: η οθόνη, το όνομά της και η πύλη πρόσβασης.
export interface SectionTab {
  id: string
  label: string
  capability: string
  anyCapabilities?: string[]
}

export interface SectionDefinition {
  path: string
  title: string
  defaultTab: string
  tabs: SectionTab[]
}

interface TabAccess {
  role?: string | null
  addOns?: string[]
  customCapabilities?: string[]
}

export const SECTION_TABS: Readonly<Record<string, SectionDefinition>> = Object.freeze({
  surveillance: {
    path: '/surveillance',
    title: 'sidebarNav.surveillanceSection',
    defaultTab: 'episodes',
    tabs: [
      { id: 'episodes', label: 'sidebarNav.tabEpisodes', capability: CAPABILITIES.VIEW_SURVEILLANCE },
      { id: 'registry', label: 'sidebarNav.tabRegistry', capability: CAPABILITIES.VIEW_PATIENTS },
      { id: 'outbreaks', label: 'sidebarNav.tabOutbreaks', capability: CAPABILITIES.VIEW_LIRA },
      { id: 'employees', label: 'sidebarNav.tabEmployees', capability: CAPABILITIES.VIEW_SURVEILLANCE },
      { id: 'environmental', label: 'sidebarNav.tabEnvironment', capability: CAPABILITIES.VIEW_SURVEILLANCE },
    ],
  },
  documents: {
    path: '/documents',
    title: 'sidebarNav.documentsRegulations',
    defaultTab: 'documents',
    tabs: [
      { id: 'documents', label: 'sidebarNav.tabDocuments', capability: CAPABILITIES.VIEW_DOCUMENTS },
      { id: 'regulations', label: 'sidebarNav.tabRegulations', capability: CAPABILITIES.VIEW_DOCUMENTS, anyCapabilities: [CAPABILITIES.VIEW_DOCUMENTS, CAPABILITIES.VIEW_QUALITY] },
      { id: 'legislation', label: 'sidebarNav.tabLegislation', capability: CAPABILITIES.VIEW_QUALITY },
      { id: 'acknowledgements', label: 'sidebarNav.tabAcknowledgements', capability: CAPABILITIES.VIEW_DOCUMENTS },
    ],
  },
  meetings: {
    path: '/meetings',
    title: 'sidebarNav.meetingsDecisions',
    defaultTab: 'committees',
    tabs: [
      { id: 'committees', label: 'sidebarNav.tabCommittees', capability: CAPABILITIES.VIEW_COMMITTEES },
      { id: 'departments', label: 'sidebarNav.tabDepartmentMeetings', capability: CAPABILITIES.VIEW_QUALITY },
      { id: 'reviews', label: 'sidebarNav.tabManagementReview', capability: CAPABILITIES.VIEW_QUALITY },
    ],
  },
})

// Every capability that opens at least one tab of the section (the route gate).
export function sectionCapabilities(sectionId: string): string[] {
  const section = SECTION_TABS[sectionId]
  if (!section) return []
  return [...new Set(section.tabs.flatMap(tab => tab.anyCapabilities || [tab.capability]))]
}

export function sectionTabAllowed(tab: SectionTab | null | undefined, { role, addOns = [], customCapabilities = [] }: TabAccess = {}): boolean {
  if (!tab || isProfileDisabled(tab.capability)) return false
  return tab.anyCapabilities ? canAny(role, tab.anyCapabilities, addOns, customCapabilities) : can(role, tab.capability, addOns, customCapabilities)
}

// The tabs of a section the role may open, in their order.
export function sectionTabsFor(sectionId: string, context: TabAccess = {}): SectionTab[] {
  const section = SECTION_TABS[sectionId]
  if (!section) return []
  return section.tabs.filter(tab => sectionTabAllowed(tab, context))
}

// The tab to show: the requested one when allowed, else the section's default, else the first allowed.
export function resolveSectionTab(sectionId: string, requested: string | null | undefined, allowed: readonly SectionTab[] | null | undefined): string | null {
  const ids = (allowed || []).map(tab => tab.id)
  if (requested && ids.includes(requested)) return requested
  const fallback = SECTION_TABS[sectionId]?.defaultTab
  return fallback && ids.includes(fallback) ? fallback : ids[0] || null
}

// The address of a tab: the section path, with ?tab= unless it is the default tab.
export function sectionTabPath(sectionId: string, tabId: string | null | undefined, extra = ''): string {
  const section = SECTION_TABS[sectionId]
  if (!section) return '/'
  const params = new URLSearchParams(extra)
  if (tabId && tabId !== section.defaultTab) params.set('tab', tabId)
  else params.delete('tab')
  const query = params.toString()
  return query ? `${section.path}?${query}` : section.path
}
