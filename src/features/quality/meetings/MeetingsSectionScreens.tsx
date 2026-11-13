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
import { meetingsExport, useMeetingGroups } from './MeetingsPanel'
import { MeetingGroupDialog, MeetingGroupPage, MeetingGroupsList } from './MeetingGroups'
import { saveMeetingGroup } from './meetingService'
import { useDepartments } from '../../management/useLibraries'
import { ReviewsTable, reviewsExport, useReviews } from '../review/QualityObjectives'
import '../quality.css'
import { hospitalToday } from '../../../core/dates/hospitalDate'
import type { Translate } from '../../../types/featureTypes'
import type { RegistryExport } from '../../../core/export/registryExports'
import type { MeetingGroup, ReviewDecisions } from './meetingModel'

// The department meetings and the management review, tabs of «Meetings &
// decisions» beside the committees (they were the Quality Center's «Meetings» tab).
// A review's decisions still open, and those past their due date.
const openDecisions = (review: ReviewDecisions) => (review.actions || []).filter(action => action.status === 'open')
const lateDecisions = (review: ReviewDecisions) => openDecisions(review).filter(action => action.dueDate && action.dueDate < hospitalToday())


// The department meeting groups (one per department, defined by Quality): how often each meets,
// the last meeting and the next one due. `home`: where a group returns to.
export function DepartmentMeetingsScreen({ home = '/meetings?tab=departments', ownDepartment = false }: { home?: string, ownDepartment?: boolean } = {}) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const L: Translate = (el, enText) => (en ? enText : el)
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const printList = (data: RegistryExport, title: string) => { if (!printRegistry(data, { language, kind: t('sidebarNav.meetingsDecisions'), title })) notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'Allow pop-ups to print.'), 'error') }
  const { goTo } = useContextualNavigation(home)
  const data = useMeetingGroups()
  const { departments } = useDepartments()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const shown = useMemo(() => { const q = query.trim().toLowerCase(); return { ...data, groups: data.groups.filter(group => !q || `${group.name} ${group.department}`.toLowerCase().includes(q)) } }, [data, query])
  // The department's own page opens straight into its group when it has one.
  if (ownDepartment && !data.loading && data.groups.length === 1) return <MeetingGroupPage groupId={data.groups[0].id} home={home} />
  async function addGroup(group: MeetingGroup) {
    setSaving(true)
    try { const saved = await saveMeetingGroup(tenant?.id, group); notify(L('Το τμήμα προστέθηκε.', 'Department added.'), 'success'); setAdding(false); data.reload(); goTo(`/meetings/groups/${saved.id}`) } catch (error) { console.error(error); notify(L('Δεν ήταν δυνατή η αποθήκευση της ομάδας.', 'The group could not be saved.'), 'error') } finally { setSaving(false) }
  }
  return <Page fill className="registry-fill-page" title={ownDepartment ? t('sidebarNav.departmentMeetings') : t('sidebarNav.tabDepartmentMeetings')} subtitle={L('Οι συναντήσεις κάθε τμήματος, με τη συχνότητα που όρισε η διοίκηση.', 'The meetings of each department, as often as the administration set.')}
    actions={<div className="row-actions">
      <ExportMenu disabled={!data.meetings.meetings.length} onPrint={() => printList(meetingsExport(data.meetings.meetings, language), t('sidebarNav.tabDepartmentMeetings'))} onExcel={() => exportRegistry(meetingsExport(data.meetings.meetings, language))} />
      {data.canManage && <ActionButton label={L('Νέο τμήμα συναντήσεων', 'New meeting department')} tone="primary" onClick={() => setAdding(true)}><Plus size={18} /><span>{L('Τμήμα', 'Department')}</span></ActionButton>}
    </div>}>
    <section className="surface registry-workspace workspace-column workspace-fill">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={L('Αναζήτηση τμήματος…', 'Search department…')} onClear={() => setQuery('')} />
      <MeetingGroupsList data={shown} language={language} onOpen={(group: MeetingGroup) => goTo(`/meetings/groups/${group.id}`)} />
    </section>
    {adding && <MeetingGroupDialog initial={{}} departments={departments} saving={saving} onClose={() => setAdding(false)} onSave={addGroup} language={language} />}
  </Page>
}

export function ManagementReviewsScreen() {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const L: Translate = (el, enText) => (en ? enText : el)
  const { notify } = useFeedback()
  const printList = (data: RegistryExport, title: string) => { if (!printRegistry(data, { language, kind: t('sidebarNav.meetingsDecisions'), title })) notify(L('Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'Allow pop-ups to print.'), 'error') }
  const navigate = useNavigate()
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const canManage = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const reviews = useReviews(tenant?.id)
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState<string | null>(null)
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
