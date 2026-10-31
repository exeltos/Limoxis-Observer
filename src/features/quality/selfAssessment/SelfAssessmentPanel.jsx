import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Plus, Send, Trash2, Undo2, Lock } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { IconButton } from '../../../design-system/IconButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry } from '../../../core/export/registryExports'
import { standardShort } from '../audits/auditStandards'
import { filterSelf, isOverdue, selfCounts, selfExport, selfGaps, selfStatusLabel, selfStatusTone } from './selfAssessmentModel'
import { removeSelfAssessment, setSelfStatus } from './selfAssessmentService'
import { useSelfAssessments } from './useSelfAssessments'
import './selfAssessment.css'

const L = (en, el, english) => (en ? english : el)

export function SelfAssessmentProgress({ answered, total, label }) {
  const pct = total ? Math.round((answered * 100) / total) : 0
  return <div className="self-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
    <span className="self-progress-track"><span className="self-progress-fill" style={{ width: `${pct}%` }} /></span>
    <span className="self-progress-text">{answered}/{total} · {pct}%</span>
  </div>
}

// Quality → Audits → «Αυτοαξιολόγηση»: the Quality team creates a self-assessment for
// departments from an audit questionnaire and releases it; the department then sees and
// answers it, and the gaps it leaves are the preparation for the audit.
export function SelfAssessmentPanel({ query = '', canManage = false, toolbarSlot = null }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const { notify, confirm } = useFeedback()
  const navigate = useNavigate()
  const list = useSelfAssessments(tenant?.id)
  const rows = useMemo(() => filterSelf(list.items, query), [list.items, query])
  const counts = selfCounts(list.items)
  const gaps = list.items.filter(item => item.status === 'submitted').reduce((sum, item) => sum + selfGaps(item.checklist).length, 0)
  async function act(item, status, message) {
    try { await setSelfStatus(tenant?.id, item, status); notify(message, 'success'); await list.reload() } catch (error) { console.error(error); notify(L(en, 'Η ενέργεια δεν ολοκληρώθηκε.', 'The action could not be completed.'), 'error') }
  }
  async function remove(item) {
    const ok = await confirm({ title: L(en, 'Διαγραφή αυτοαξιολόγησης', 'Delete self-assessment'), message: L(en, `Θα διαγραφεί η αυτοαξιολόγηση «${item.title}» του τμήματος ${item.departmentName} μαζί με τις απαντήσεις της.`, `The self-assessment “${item.title}” of ${item.departmentName} and its answers will be deleted.`), confirmLabel: L(en, 'Διαγραφή', 'Delete'), danger: true })
    if (!ok) return
    try { await removeSelfAssessment(tenant?.id, item); await list.reload() } catch (error) { console.error(error); notify(L(en, 'Δεν ήταν δυνατή η διαγραφή.', 'It could not be deleted.'), 'error') }
  }
  const toolbar = <>
      <ExportMenu disabled={!rows.length} onExcel={() => exportRegistry(selfExport(rows, language))} />
      {canManage && <Button onClick={() => navigate('/quality/self-assessments/new')}><Plus size={15} />{L(en, 'Νέα αυτοαξιολόγηση', 'New self-assessment')}</Button>}
  </>
  return <>
    {!list.loading && !list.error && !list.items.length ? <div className="self-empty">
      <ClipboardCheck size={30} aria-hidden="true" />
      <h3>{L(en, 'Η αυτοαξιολόγηση προετοιμάζει το τμήμα πριν την επιθεώρηση', 'Self-assessment prepares the department before the audit')}</h3>
      <ol className="self-steps">
        <li><b>1</b><span>{L(en, 'Διαλέγετε ερωτηματολόγιο και τμήματα', 'Choose a questionnaire and departments')}</span></li>
        <li><b>2</b><span>{L(en, 'Την ενεργοποιείτε: το τμήμα τη βλέπει', 'Release it: the department sees it')}</span></li>
        <li><b>3</b><span>{L(en, 'Το τμήμα τη συμπληρώνει και τα κενά φαίνονται εδώ', 'The department fills it in and the gaps show here')}</span></li>
      </ol>
      {canManage && <Button onClick={() => navigate('/quality/self-assessments/new')}><Plus size={15} />{L(en, 'Νέα αυτοαξιολόγηση', 'New self-assessment')}</Button>}
    </div> : <>
    <p className="quality-summary-line self-summary">
      <span><b>{counts.total}</b> {L(en, 'αυτοαξιολογήσεις', 'self-assessments')}</span>
      <span><b>{counts.inProgress}</b> {L(en, 'σε εξέλιξη', 'in progress')}</span>
      <span><b>{counts.submitted}</b> {L(en, 'υποβλήθηκαν', 'submitted')}</span>
      {counts.overdue > 0 && <span className="is-late"><b>{counts.overdue}</b> {L(en, 'εκπρόθεσμες', 'overdue')}</span>}
      <span className={gaps ? 'is-late' : undefined}><b>{gaps}</b> {L(en, 'κενά πριν την επιθεώρηση', 'gaps before the audit')}</span>
    </p>
    {toolbarSlot ? createPortal(toolbar, toolbarSlot) : <div className="self-toolbar row-actions">{toolbar}</div>}
    <div className="scroll-table">
      <RegistryTable bare className="quality-table self-table" rows={rows} rowKey={item => item.id} empty={!list.loading && !list.error && !rows.length} emptyFiltered={list.items.length > 0} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyTitle={L(en, 'Δεν υπάρχουν αυτοαξιολογήσεις', 'No self-assessments')}
        emptyText={L(en, 'Επιλέξτε ερωτηματολόγιο και τμήματα· όταν την ενεργοποιήσετε, το τμήμα τη βλέπει και τη συμπληρώνει ως προετοιμασία για την επιθεώρηση.', 'Choose a questionnaire and departments; once you release it the department sees and answers it as a preparation for the audit.')}
        columns={[{ key: 'title', label: L(en, 'Αυτοαξιολόγηση', 'Self-assessment'), sortValue: item => item.title }, { key: 'progress', label: L(en, 'Πρόοδος', 'Progress'), sortValue: item => (item.totalCount ? item.answeredCount / item.totalCount : null) }, { key: 'score', label: L(en, 'Βαθμός', 'Score'), sortValue: item => item.score }, { key: 'due', label: L(en, 'Προθεσμία', 'Due'), sortValue: item => item.dueOn }, { key: 'status', label: L(en, 'Κατάσταση', 'Status'), sortValue: item => item.status }, { key: 'actions', label: '', ariaLabel: L(en, 'Ενέργειες', 'Actions') }]}
        rowProps={item => ({ onClick: () => navigate(`/quality/self-assessments/${item.id}`) })}
        renderRow={item => <>
          <td><strong>{item.title}</strong><small>{item.departmentName}{item.standard ? ` · ${standardShort(item.standard)}` : ''}</small></td>
          <td><SelfAssessmentProgress answered={item.answeredCount} total={item.totalCount} label={L(en, 'Πρόοδος', 'Progress')} /></td>
          <td>{item.score == null ? '—' : `${item.score}%`}</td>
          <td className="nowrap-cell">{item.dueOn ? formatDay(item.dueOn, language) : '—'}{isOverdue(item) && <small className="quality-overdue-text">{L(en, 'εκπρόθεσμη', 'overdue')}</small>}</td>
          <td><StatusBadge tone={selfStatusTone(item.status)}>{selfStatusLabel(item.status, language)}</StatusBadge></td>
          <td onClick={event => event.stopPropagation()}>{canManage && <div className="row-actions">
            {item.status === 'draft' && <Button variant="secondary" onClick={() => act(item, 'released', L(en, 'Ενεργοποιήθηκε: το τμήμα τη βλέπει τώρα.', 'Released: the department sees it now.'))}><Send size={14} />{L(en, 'Ενεργοποίηση για το τμήμα', 'Release to the department')}</Button>}
            {item.status === 'released' && <IconButton size="sm" label={L(en, 'Απόσυρση από το τμήμα', 'Withdraw from the department')} onClick={() => act(item, 'draft', L(en, 'Αποσύρθηκε από το τμήμα.', 'Withdrawn from the department.'))}><Undo2 size={14} /></IconButton>}
            {item.status === 'submitted' && <IconButton size="sm" label={L(en, 'Κλείσιμο', 'Close')} onClick={() => act(item, 'closed', L(en, 'Έκλεισε.', 'Closed.'))}><Lock size={14} /></IconButton>}
            <IconButton size="sm" tone="danger" label={L(en, 'Διαγραφή', 'Delete')} onClick={() => remove(item)}><Trash2 size={14} /></IconButton>
          </div>}</td>
        </>} />
    </div>
    </>}
  </>
}
