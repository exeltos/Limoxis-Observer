import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CalendarDays, ClipboardList, ClipboardSignature, Clock3, ListChecks, Plus, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../../design-system/Page'
import { ActionButton } from '../../../design-system/ActionButton'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { FilterBar } from '../../../design-system/FilterBar'
import { MetricCard } from '../../../design-system/MetricCard'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry } from '../../../core/export/registryExports'
import { MeetingsList, filterMeetings, meetingsExport, useMeetings } from './MeetingsPanel'
import { departmentMeetingStatus, latestMeetings, lateDecisions as meetingLateDecisions, openDecisions as meetingOpenDecisions } from './meetingModel'
import { ReviewsTable, reviewsExport, useReviews } from '../review/QualityObjectives'
import '../quality.css'

// The department meetings and the management review, tabs of «Meetings &
// decisions» beside the committees (they were the Quality Center's «Meetings» tab).
// A review's decisions still open, and those past their due date.
const openDecisions = review => (review.actions || []).filter(action => action.status === 'open')
const lateDecisions = review => openDecisions(review).filter(action => action.dueDate && action.dueDate < new Date().toISOString().slice(0, 10))

function Figures({ figures, loading }) {
  if (!figures.length) return null
  return <div className="workspace-summary"><div className="module-summary-strip quality-kpis" style={{ '--quality-kpis': figures.length }}>
    {figures.map(figure => <MetricCard key={figure.key} loading={loading && typeof figure.value === 'number'} icon={figure.icon} value={figure.value} label={figure.label} tone={figure.tone} onClick={figure.go} active={figure.active} />)}
  </div></div>
}

export function DepartmentMeetingsScreen() {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
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
    { key: 'year', icon: Users, value: meetings.loading ? '—' : yearMeetings.length, label: L('Συναντήσεις φέτος', 'Meetings this year'), active: !filters.quick, go: () => setFilters(current => ({ ...current, quick: null })) },
    { key: 'departments', icon: ClipboardList, value: status.length, label: L('Τμήματα με συναντήσεις', 'Departments meeting') },
    { key: 'nextLate', icon: CalendarClock, value: late, label: L('Εκπρόθεσμη επόμενη συνάντηση', 'Next meeting overdue'), tone: late ? 'warning' : 'neutral' },
    { key: 'open', icon: ListChecks, value: latest.reduce((sum, item) => sum + meetingOpenDecisions(item).length, 0), label: L('Ανοιχτές αποφάσεις', 'Open decisions'), active: filters.quick === 'open', go: () => toggle('open') },
    { key: 'late', icon: AlertTriangle, value: latest.reduce((sum, item) => sum + meetingLateDecisions(item).length, 0), label: L('Εκπρόθεσμες αποφάσεις', 'Overdue decisions'), tone: latest.some(item => meetingLateDecisions(item).length) ? 'danger' : 'neutral', active: filters.quick === 'late', go: () => toggle('late') },
    { key: 'draft', icon: Clock3, value: meetings.meetings.filter(item => item.status === 'draft').length, label: L('Πρακτικά σε πρόχειρο', 'Draft minutes'), active: filters.quick === 'draft', go: () => toggle('draft') },
  ]
  return <Page fill className="registry-fill-page" title={t('sidebarNav.tabDepartmentMeetings')} subtitle={t('sidebarNav.departmentMeetingsSubtitle')}
    actions={<div className="row-actions">
      <ExportMenu disabled={!visible.length} onExcel={() => exportRegistry(meetingsExport(visible, language))} />
      <ActionButton label={L('Συνάντηση τμήματος', 'Department meeting')} tone="primary" onClick={() => goTo('/meetings/new')}><Plus size={18} /><span>{t('create')}</span></ActionButton>
    </div>}>
    <Figures figures={figures} loading={meetings.loading} />
    <section className="surface registry-workspace workspace-column workspace-fill">
      <MeetingsList list={meetings} filters={filters} setFilters={setFilters} onOpen={meeting => goTo(`/meetings/${meeting.id}`)} />
    </section>
  </Page>
}

export function ManagementReviewsScreen() {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
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
    { key: 'reviews', icon: ClipboardSignature, value: reviews.loading ? '—' : reviews.reviews.length, label: L('Ανασκοπήσεις', 'Reviews'), active: !quick, go: () => setQuick(null) },
    { key: 'last', icon: CalendarDays, value: formatDay(latestReview?.reviewDate, language) || '—', label: L('Τελευταία ανασκόπηση', 'Last review') },
    { key: 'next', icon: CalendarClock, value: formatDay(latestReview?.nextReviewDate, language) || '—', label: nextReviewLate ? L('Επόμενη · εκπρόθεσμη', 'Next · overdue') : L('Επόμενη ανασκόπηση', 'Next review'), tone: nextReviewLate ? 'danger' : 'neutral' },
    { key: 'open', icon: ListChecks, value: reviews.reviews.reduce((sum, item) => sum + openDecisions(item).length, 0), label: L('Ανοιχτές αποφάσεις', 'Open decisions'), active: quick === 'open', go: () => setQuick(current => (current === 'open' ? null : 'open')) },
    { key: 'late', icon: AlertTriangle, value: reviews.reviews.reduce((sum, item) => sum + lateDecisions(item).length, 0), label: L('Εκπρόθεσμες αποφάσεις', 'Overdue decisions'), tone: reviews.reviews.some(item => lateDecisions(item).length) ? 'danger' : 'neutral', active: quick === 'late', go: () => setQuick(current => (current === 'late' ? null : 'late')) },
  ]
  return <Page fill className="registry-fill-page" title={t('sidebarNav.tabManagementReview')} subtitle={t('sidebarNav.managementReviewSubtitle')}
    actions={<div className="row-actions">
      <ExportMenu disabled={!visible.length} onExcel={() => exportRegistry(reviewsExport(visible, language))} />
      {canManage && <ActionButton label={L('Ανασκόπηση Διοίκησης', 'Management review')} tone="primary" onClick={() => navigate('/quality/reviews/new')}><Plus size={18} /><span>{t('create')}</span></ActionButton>}
    </div>}>
    <Figures figures={figures} loading={reviews.loading} />
    <section className="surface registry-workspace workspace-column workspace-fill">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση ανασκόπησης', 'Search review')} onClear={() => { setQuery(''); setQuick(null) }} />
      <ReviewsTable rows={visible} loading={reviews.loading} onOpen={review => navigate(`/quality/reviews/${review.id}`)} />
    </section>
  </Page>
}
