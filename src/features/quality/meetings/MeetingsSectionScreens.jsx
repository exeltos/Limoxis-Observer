import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CalendarDays, Clock3, ListChecks, Plus, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../../design-system/Page'
import { ActionButton } from '../../../design-system/ActionButton'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { FilterBar } from '../../../design-system/FilterBar'
import { KpiFigures } from '../../../design-system/KpiCard'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry, printRegistry } from '../../../core/export/registryExports'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { MeetingsList, filterMeetings, meetingsExport, useMeetings } from './MeetingsPanel'
import { departmentMeetingStatus, latestMeetings, lateDecisions as meetingLateDecisions, openDecisions as meetingOpenDecisions } from './meetingModel'
import { ReviewsTable, reviewsExport, useReviews } from '../review/QualityObjectives'
import '../quality.css'

// The department meetings and the management review, tabs of «Meetings &
// decisions» beside the committees (they were the Quality Center's «Meetings» tab).
// A review's decisions still open, and those past their due date.
const openDecisions = review => (review.actions || []).filter(action => action.status === 'open')
const lateDecisions = review => openDecisions(review).filter(action => action.dueDate && action.dueDate < new Date().toISOString().slice(0, 10))

function Figures({ figures, loading, label }) {
  return <KpiFigures label={label} loading={loading} figures={figures} />
}

export function DepartmentMeetingsScreen() {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const { notify } = useFeedback()
  const printList = (data, title) => { if (!printRegistry(data, { language, kind: t('sidebarNav.meetingsDecisions'), title })) notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'Allow pop-ups to print.'), 'error') }
  const { goTo } = useContextualNavigation('/meetings?tab=departments')
  const meetings = useMeetings()
  const [filters, setFilters] = useState({ query: '', department: 'all', status: 'all', quick: null })
  const visible = useMemo(() => filterMeetings(meetings.meetings, filters, en), [meetings.meetings, filters, en])
  const todayIso = new Date().toISOString().slice(0, 10)
  const yearMeetings = meetings.meetings.filter(item => String(item.meetingDate).startsWith(todayIso.slice(0, 4)))
  const status = departmentMeetingStatus(meetings.meetings, todayIso)
  const late = status.filter(item => item.overdue).length
  const latest = latestMeetings(meetings.meetings)
  const toggle = key => setFilters(current => ({ ...current, quick: current.quick === key ? null : key }))
  const figures = [
    { key: 'year', icon: Users, value: yearMeetings.length, label: L('Συναντήσεις φέτος', 'Meetings this year'), hint: L(`${status.length} τμήματα · ${latest.reduce((sum, item) => sum + meetingOpenDecisions(item).length, 0)} ανοιχτές αποφάσεις`, `${status.length} departments · ${latest.reduce((sum, item) => sum + meetingOpenDecisions(item).length, 0)} open decisions`), active: !filters.quick, go: () => setFilters(current => ({ ...current, quick: null })) },
    { key: 'nextLate', icon: CalendarClock, value: late, label: L('Εκπρόθεσμη επόμενη συνάντηση', 'Next meeting overdue'), status: late ? 'danger' : 'good', target: L('στόχος: 0', 'target: 0') },
    { key: 'late', icon: AlertTriangle, value: latest.reduce((sum, item) => sum + meetingLateDecisions(item).length, 0), label: L('Εκπρόθεσμες αποφάσεις', 'Overdue decisions'), status: latest.some(item => meetingLateDecisions(item).length) ? 'danger' : 'good', target: L('στόχος: 0', 'target: 0'), active: filters.quick === 'late', go: () => toggle('late') },
    { key: 'draft', icon: Clock3, value: meetings.meetings.filter(item => item.status === 'draft').length, label: L('Πρακτικά σε πρόχειρο', 'Draft minutes'), tone: 'warning', active: filters.quick === 'draft', go: () => toggle('draft') },
  ]
  return <Page fill className="registry-fill-page" title={t('sidebarNav.tabDepartmentMeetings')} subtitle={t('sidebarNav.departmentMeetingsSubtitle')}
    actions={<div className="row-actions">
      <ExportMenu disabled={!visible.length} onPrint={() => printList(meetingsExport(visible, language), t('sidebarNav.tabDepartmentMeetings'))} onExcel={() => exportRegistry(meetingsExport(visible, language))} />
      <ActionButton label={L('Συνάντηση τμήματος', 'Department meeting')} tone="primary" onClick={() => goTo('/meetings/new')}><Plus size={18} /><span>{t('create')}</span></ActionButton>
    </div>}>
    <Figures label={t('sidebarNav.tabDepartmentMeetings')} figures={figures} loading={meetings.loading} />
    <section className="surface registry-workspace workspace-column workspace-fill">
      <MeetingsList list={meetings} filters={filters} setFilters={setFilters} onOpen={meeting => goTo(`/meetings/${meeting.id}`)} />
    </section>
  </Page>
}

export function ManagementReviewsScreen() {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const { notify } = useFeedback()
  const printList = (data, title) => { if (!printRegistry(data, { language, kind: t('sidebarNav.meetingsDecisions'), title })) notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'Allow pop-ups to print.'), 'error') }
  const navigate = useNavigate()
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const canManage = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const reviews = useReviews(tenant?.id)
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState(null)
  const visible = useMemo(() => { const q = query.trim().toLowerCase(); return reviews.reviews.filter(item => !q || `${item.code} ${item.reviewDate || ''}`.toLowerCase().includes(q)).filter(item => quick === 'open' ? openDecisions(item).length > 0 : quick === 'late' ? lateDecisions(item).length > 0 : true) }, [reviews.reviews, query, quick])
  const todayIso = new Date().toISOString().slice(0, 10)
  const latestReview = [...reviews.reviews].sort((a, b) => String(b.reviewDate).localeCompare(String(a.reviewDate)))[0]
  const nextReviewLate = Boolean(latestReview?.nextReviewDate && latestReview.nextReviewDate < todayIso)
  const figures = [
    { key: 'last', icon: CalendarDays, value: formatDay(latestReview?.reviewDate, language) || null, label: L('Τελευταία ανασκόπηση', 'Last review'), hint: L(`${reviews.reviews.length} ${reviews.reviews.length === 1 ? 'ανασκόπηση' : 'ανασκοπήσεις'}`, `${reviews.reviews.length} ${reviews.reviews.length === 1 ? 'review' : 'reviews'}`), active: !quick, go: () => setQuick(null) },
    { key: 'next', icon: CalendarClock, value: formatDay(latestReview?.nextReviewDate, language) || null, label: L('Επόμενη ανασκόπηση', 'Next review'), status: latestReview?.nextReviewDate ? (nextReviewLate ? 'danger' : 'good') : null, statusLabel: nextReviewLate ? L('Εκπρόθεσμη', 'Overdue') : L('Εγκαίρως', 'On time') },
    { key: 'open', icon: ListChecks, value: reviews.reviews.reduce((sum, item) => sum + openDecisions(item).length, 0), label: L('Ανοιχτές αποφάσεις', 'Open decisions'), active: quick === 'open', go: () => setQuick(current => (current === 'open' ? null : 'open')) },
    { key: 'late', icon: AlertTriangle, value: reviews.reviews.reduce((sum, item) => sum + lateDecisions(item).length, 0), label: L('Εκπρόθεσμες αποφάσεις', 'Overdue decisions'), status: reviews.reviews.some(item => lateDecisions(item).length) ? 'danger' : 'good', target: L('στόχος: 0', 'target: 0'), active: quick === 'late', go: () => setQuick(current => (current === 'late' ? null : 'late')) },
  ]
  return <Page fill className="registry-fill-page" title={t('sidebarNav.tabManagementReview')} subtitle={t('sidebarNav.managementReviewSubtitle')}
    actions={<div className="row-actions">
      <ExportMenu disabled={!visible.length} onPrint={() => printList(reviewsExport(visible, language), t('sidebarNav.tabManagementReview'))} onExcel={() => exportRegistry(reviewsExport(visible, language))} />
      {canManage && <ActionButton label={L('Ανασκόπηση Διοίκησης', 'Management review')} tone="primary" onClick={() => navigate('/quality/reviews/new')}><Plus size={18} /><span>{t('create')}</span></ActionButton>}
    </div>}>
    <Figures label={t('sidebarNav.tabManagementReview')} figures={figures} loading={reviews.loading} />
    <section className="surface registry-workspace workspace-column workspace-fill">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση ανασκόπησης', 'Search review')} onClear={() => { setQuery(''); setQuick(null) }} />
      <ReviewsTable rows={visible} loading={reviews.loading} onOpen={review => navigate(`/quality/reviews/${review.id}`)} />
    </section>
  </Page>
}
