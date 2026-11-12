import { useCallback, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { Activity, BookMarked, BookOpenCheck, ClipboardList, ClipboardSignature, FileText, HeartPulse, ListChecks, Microscope, Radar, Scale, Users } from 'lucide-react'
import { SectionRoute } from '../../core/navigation/SectionRoute'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { Page } from '../../design-system/Page'
import { PatientsPage } from '../patients/PatientsPage'
import { SurveillanceCanonicalPage } from '../surveillance/SurveillanceCanonicalPage'
import { surveillanceTabAccess } from '../surveillance/surveillanceTabAccess'
import { CultureProgrammePage } from '../surveillance/CultureProgrammePage'
import { LiraOutbreakInvestigationsPanel } from '../management/LiraOutbreakInvestigationsPanel'
import { DocumentsPage } from '../documents/DocumentsPage'
import { DocumentAcknowledgementsPage } from '../documents/DocumentAcknowledgementsPage'
import { RegulationsPage } from '../regulations/RegulationsPage'
import { LegislationPage } from '../legislation/LegislationPage'
import { CommitteesPage } from '../committees/CommitteesPage'
import { DepartmentMeetingsScreen, ManagementReviewsScreen } from '../quality/meetings/MeetingsSectionScreens'

// The merged sections of the menu (core/navigation/sectionTabs.js): each tab
// is the screen it always was, with its own gate.
const SURVEILLANCE_ICONS = Object.freeze({ registry: HeartPulse, episodes: Activity, employees: Users, environmental: Microscope, outbreaks: Radar })
const DOCUMENT_ICONS = Object.freeze({ documents: FileText, regulations: BookMarked, legislation: Scale, acknowledgements: ListChecks })
const MEETING_ICONS = Object.freeze({ committees: BookOpenCheck, departments: ClipboardList, reviews: ClipboardSignature })

// The outbreak investigations (formerly Management Center › LIRA & AI), now a tab of Surveillance.
function OutbreakInvestigationsScreen() {
  const { t } = useLanguage()
  // The same screen layout as the other tabs: the create button in the header, counts, then the list.
  return <LiraOutbreakInvestigationsPanel shell={({ actions, summary, children }) => <Page fill title={t('sidebarNav.tabOutbreaks')} actions={actions}>
    {summary}
    {children}
  </Page>} />
}

// Culture programme (its own entry «Cultures» under «Controls» in the menu): the environmental cultures due and
// done, for the infection control lead and the administrator; any other role goes back to Surveillance.
export function CultureProgrammeScreen() {
  const { t } = useLanguage()
  const { role, actualRole, canSeeSensitiveEmployeeHealth } = useTenant()
  if (!surveillanceTabAccess({ role, actualRole, canSeeSensitiveEmployeeHealth }).cultures) return <Navigate to="/controls" replace />
  return <Page fill title={t('sidebarNav.cultureProgramme')} subtitle={t('sidebarNav.culturesSubtitle')}><CultureProgrammePage /></Page>
}

export function SurveillanceSectionPage() {
  const { role, actualRole, canSeeSensitiveEmployeeHealth } = useTenant()
  const access = useMemo(() => surveillanceTabAccess({ role, actualRole, canSeeSensitiveEmployeeHealth }), [role, actualRole, canSeeSensitiveEmployeeHealth])
  const allow = useCallback((id: string) => (id === 'employees' ? access.employees : id === 'environmental' ? access.environment : true), [access])
  return <SectionRoute sectionId="surveillance" icons={SURVEILLANCE_ICONS} allow={allow} render={tab => tab === 'registry' ? <PatientsPage /> : tab === 'outbreaks' ? <OutbreakInvestigationsScreen /> : <SurveillanceCanonicalPage />} />
}

export function DocumentsSectionPage() {
  return <SectionRoute sectionId="documents" icons={DOCUMENT_ICONS} render={tab => tab === 'regulations' ? <RegulationsPage /> : tab === 'legislation' ? <LegislationPage /> : tab === 'acknowledgements' ? <DocumentAcknowledgementsPage /> : <DocumentsPage />} />
}

export function MeetingsSectionPage() {
  return <SectionRoute sectionId="meetings" icons={MEETING_ICONS} render={tab => tab === 'departments' ? <DepartmentMeetingsScreen /> : tab === 'reviews' ? <ManagementReviewsScreen /> : <CommitteesPage />} />
}
