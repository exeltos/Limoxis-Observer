import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../../design-system/Page'
import { ActionButton } from '../../../design-system/ActionButton'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { FilterBar } from '../../../design-system/FilterBar'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { exportRegistry, printRegistry } from '../../../core/export/registryExports'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { MeetingsList, filterMeetings, meetingsExport, useMeetings } from './MeetingsPanel'
import { ReviewsTable, reviewsExport, useReviews } from '../review/QualityObjectives'
import '../quality.css'

// The department meetings and the management review, tabs of «Meetings &
// decisions» beside the committees (they were the Quality Center's «Meetings» tab).
// A review's decisions still open, and those past their due date.
const openDecisions = review => (review.actions || []).filter(action => action.status === 'open')
const lateDecisions = review => openDecisions(review).filter(action => action.dueDate && action.dueDate < new Date().toISOString().slice(0, 10))


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
  return <Page fill className="registry-fill-page" title={t('sidebarNav.tabDepartmentMeetings')} subtitle={t('sidebarNav.departmentMeetingsSubtitle')}
    actions={<div className="row-actions">
      <ExportMenu disabled={!visible.length} onPrint={() => printList(meetingsExport(visible, language), t('sidebarNav.tabDepartmentMeetings'))} onExcel={() => exportRegistry(meetingsExport(visible, language))} />
      <ActionButton label={L('Συνάντηση τμήματος', 'Department meeting')} tone="primary" onClick={() => goTo('/meetings/new')}><Plus size={18} /><span>{t('create')}</span></ActionButton>
    </div>}>
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
  return <Page fill className="registry-fill-page" title={t('sidebarNav.tabManagementReview')} subtitle={t('sidebarNav.managementReviewSubtitle')}
    actions={<div className="row-actions">
      <ExportMenu disabled={!visible.length} onPrint={() => printList(reviewsExport(visible, language), t('sidebarNav.tabManagementReview'))} onExcel={() => exportRegistry(reviewsExport(visible, language))} />
      {canManage && <ActionButton label={L('Ανασκόπηση Διοίκησης', 'Management review')} tone="primary" onClick={() => navigate('/quality/reviews/new')}><Plus size={18} /><span>{t('create')}</span></ActionButton>}
    </div>}>
    <section className="surface registry-workspace workspace-column workspace-fill">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση ανασκόπησης', 'Search review')} onClear={() => { setQuery(''); setQuick(null) }} />
      <ReviewsTable rows={visible} loading={reviews.loading} onOpen={review => navigate(`/quality/reviews/${review.id}`)} />
    </section>
  </Page>
}
