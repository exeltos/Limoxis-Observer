import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { FilterBar } from '../../../design-system/FilterBar'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { filterSelf, isOverdue, selfStatusLabel, selfStatusTone } from './selfAssessmentModel'
import { SelfAssessmentProgress } from './SelfAssessmentPanel'
import { useSelfAssessments } from './useSelfAssessments'
import './selfAssessment.css'

const L = (en, el, english) => (en ? english : el)

// /my-department/self-assessment — the self-assessments the Quality team released to the
// department, each with its progress bar; open one to answer it.
export function DepartmentSelfAssessmentsPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const navigate = useNavigate()
  const list = useSelfAssessments(tenant?.id)
  const [query, setQuery] = useState('')
  const rows = useMemo(() => filterSelf(list.items.filter(item => item.status !== 'draft'), query), [list.items, query])
  return <Page fill title={L(en, 'Αυτοαξιολόγηση τμήματος', 'Department self-assessment')} subtitle={L(en, 'Οι αυτοαξιολογήσεις που σας ανέθεσε το Γραφείο Ποιότητας, ως προετοιμασία για την επιθεώρηση.', 'The self-assessments the Quality Office released to you, as a preparation for the audit.')}>
    <section className="surface registry-workspace workspace-column workspace-fill">
      <FilterBar query={query} onQueryChange={setQuery} placeholder={L(en, 'Αναζήτηση…', 'Search…')} />
      <div className="scroll-table">
        <RegistryTable bare className="quality-table self-table" rows={rows} rowKey={item => item.id} loading={list.loading} empty={!list.loading && !rows.length} emptyFiltered={list.items.length > 0}
          emptyIcon={ClipboardCheck} emptyTitle={L(en, 'Δεν υπάρχει αυτοαξιολόγηση για το τμήμα σας', 'No self-assessment for your department')} emptyText={L(en, 'Όταν το Γραφείο Ποιότητας ενεργοποιήσει μία για εσάς, θα εμφανιστεί εδώ.', 'When the Quality Office releases one to you it will appear here.')}
          columns={[{ key: 'title', label: L(en, 'Αυτοαξιολόγηση', 'Self-assessment') }, { key: 'progress', label: L(en, 'Πρόοδος', 'Progress') }, { key: 'due', label: L(en, 'Προθεσμία', 'Due') }, { key: 'status', label: L(en, 'Κατάσταση', 'Status') }]}
          rowProps={item => ({ onClick: () => navigate(`/my-department/self-assessment/${item.id}`) })}
          renderRow={item => <>
            <td><strong>{item.title}</strong><small>{item.departmentName}</small></td>
            <td><SelfAssessmentProgress answered={item.answeredCount} total={item.totalCount} label={L(en, 'Πρόοδος', 'Progress')} /></td>
            <td className="nowrap-cell">{item.dueOn ? formatDay(item.dueOn, language) : '—'}{isOverdue(item) && <small className="quality-overdue-text">{L(en, 'εκπρόθεσμη', 'overdue')}</small>}</td>
            <td><StatusBadge tone={selfStatusTone(item.status)}>{selfStatusLabel(item.status, language)}</StatusBadge></td>
          </>} />
      </div>
    </section>
  </Page>
}
