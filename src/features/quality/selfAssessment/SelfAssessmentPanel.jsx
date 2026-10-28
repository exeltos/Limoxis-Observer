import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, Clock3, FileWarning, Plus, Send, Trash2, Undo2, Lock } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { IconButton } from '../../../design-system/IconButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { KpiFigures } from '../../../design-system/KpiCard'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { MultiSelect } from '../../../design-system/MultiSelect'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry } from '../../../core/export/registryExports'
import { useDepartments } from '../../management/useLibraries'
import { useAuditTemplates } from '../audits/useAuditTemplates'
import { standardShort } from '../audits/auditStandards'
import { filterSelf, isOverdue, selfCounts, selfExport, selfGaps, selfStatusLabel, selfStatusTone } from './selfAssessmentModel'
import { createSelfAssessments, removeSelfAssessment, setSelfStatus } from './selfAssessmentService'
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
export function SelfAssessmentPanel({ query = '', canManage = false }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const { notify, confirm } = useFeedback()
  const navigate = useNavigate()
  const list = useSelfAssessments(tenant?.id)
  const [creating, setCreating] = useState(false)
  const rows = useMemo(() => filterSelf(list.items, query), [list.items, query])
  const counts = selfCounts(list.items)
  const gaps = list.items.filter(item => item.status === 'submitted').reduce((sum, item) => sum + selfGaps(item.checklist).length, 0)
  const figures = [
    { key: 'all', icon: ClipboardCheck, value: counts.total, label: L(en, 'Αυτοαξιολογήσεις', 'Self-assessments'), hint: counts.drafts ? L(en, `${counts.drafts} πρόχειρες`, `${counts.drafts} drafts`) : null },
    { key: 'progress', icon: Clock3, value: counts.inProgress, label: L(en, 'Σε εξέλιξη', 'In progress'), hint: counts.overdue ? L(en, `${counts.overdue} εκπρόθεσμες`, `${counts.overdue} overdue`) : null, status: counts.overdue ? 'warning' : null },
    { key: 'submitted', icon: CheckCircle2, value: counts.submitted, label: L(en, 'Υποβλήθηκαν', 'Submitted') },
    { key: 'gaps', icon: FileWarning, value: gaps, label: L(en, 'Κενά πριν την επιθεώρηση', 'Gaps before the audit'), tone: 'warning' },
  ]
  async function act(item, status, message) {
    try { await setSelfStatus(tenant?.id, item, status); notify(message, 'success'); await list.reload() } catch (error) { console.error(error); notify(L(en, 'Η ενέργεια δεν ολοκληρώθηκε.', 'The action could not be completed.'), 'error') }
  }
  async function remove(item) {
    const ok = await confirm({ title: L(en, 'Διαγραφή αυτοαξιολόγησης', 'Delete self-assessment'), message: L(en, `Θα διαγραφεί η αυτοαξιολόγηση «${item.title}» του τμήματος ${item.departmentName} μαζί με τις απαντήσεις της.`, `The self-assessment “${item.title}” of ${item.departmentName} and its answers will be deleted.`), confirmLabel: L(en, 'Διαγραφή', 'Delete'), danger: true })
    if (!ok) return
    try { await removeSelfAssessment(tenant?.id, item); await list.reload() } catch (error) { console.error(error); notify(L(en, 'Δεν ήταν δυνατή η διαγραφή.', 'It could not be deleted.'), 'error') }
  }
  return <>
    <KpiFigures label={L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} figures={figures} loading={list.loading} />
    <div className="self-toolbar row-actions">
      <ExportMenu disabled={!rows.length} onExcel={() => exportRegistry(selfExport(rows, language))} />
      {canManage && <Button onClick={() => setCreating(true)}><Plus size={15} />{L(en, 'Νέα αυτοαξιολόγηση', 'New self-assessment')}</Button>}
    </div>
    <div className="scroll-table">
      <RegistryTable bare className="quality-table self-table" rows={rows} rowKey={item => item.id} empty={!list.loading && !rows.length} emptyFiltered={list.items.length > 0} loading={list.loading}
        emptyTitle={L(en, 'Δεν υπάρχουν αυτοαξιολογήσεις', 'No self-assessments')}
        emptyText={L(en, 'Επιλέξτε ερωτηματολόγιο και τμήματα· όταν την ενεργοποιήσετε, το τμήμα τη βλέπει και τη συμπληρώνει ως προετοιμασία για την επιθεώρηση.', 'Choose a questionnaire and departments; once you release it the department sees and answers it as a preparation for the audit.')}
        columns={[{ key: 'title', label: L(en, 'Αυτοαξιολόγηση', 'Self-assessment') }, { key: 'progress', label: L(en, 'Πρόοδος', 'Progress') }, { key: 'score', label: L(en, 'Βαθμός', 'Score') }, { key: 'due', label: L(en, 'Προθεσμία', 'Due') }, { key: 'status', label: L(en, 'Κατάσταση', 'Status') }, { key: 'actions', label: '', ariaLabel: L(en, 'Ενέργειες', 'Actions') }]}
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
    {creating && <NewSelfAssessmentDialog organizationId={tenant?.id} onClose={() => setCreating(false)} onDone={async count => { setCreating(false); notify(L(en, `Δημιουργήθηκαν ${count} αυτοαξιολογήσεις (πρόχειρες). Ενεργοποιήστε τες για να τις δουν τα τμήματα.`, `${count} self-assessments created as drafts. Release them for the departments to see.`), 'success'); await list.reload() }} />}
  </>
}

function NewSelfAssessmentDialog({ organizationId, onClose, onDone }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { templates, loading } = useAuditTemplates(organizationId)
  const { departments } = useDepartments()
  const navigate = useNavigate()
  // The ward checklist (a department's own checklist) first, then the standards' questionnaires.
  const active = useMemo(() => templates.filter(item => item.active !== false && item.questions.length).sort((a, b) => Number(b.key === 'ward' || b.basedOn != null) - Number(a.key === 'ward' || a.basedOn != null)), [templates])
  const [templateId, setTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState([])
  const [dueOn, setDueOn] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (templateId || !active.length) return
    const first = active.find(item => item.key === 'ward') || active[0]
    setTemplateId(first.id)
    setTitle(`${L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} · ${first.title}`)
  }, [active, templateId, en])
  const template = active.find(item => item.id === templateId)
  const options = departments.map(item => ({ value: item.id || item.name, label: item.name || item.el || '' }))
  async function save() {
    if (!template || !picked.length || busy) return
    setBusy(true)
    try {
      const chosen = departments.filter(item => picked.includes(item.id || item.name)).map(item => ({ id: item.id || item.name, name: item.name || item.el || '' }))
      const made = await createSelfAssessments(organizationId, { template, departments: chosen, title: title.trim() || `${L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} · ${template.title}`, dueOn })
      if (!made.length) { notify(L(en, 'Το ερωτηματολόγιο δεν έχει ερωτήσεις για τα τμήματα που επιλέξατε.', 'The questionnaire has no questions for the chosen departments.'), 'error'); return }
      await onDone(made.length)
    } catch (error) { console.error(error); notify(L(en, 'Δεν ήταν δυνατή η δημιουργία.', 'It could not be created.'), 'error') } finally { setBusy(false) }
  }
  return <ObserverDialog width="standard" title={L(en, 'Νέα αυτοαξιολόγηση', 'New self-assessment')} subtitle={L(en, 'Μία αυτοαξιολόγηση ανά τμήμα, με τις ερωτήσεις του ερωτηματολογίου που ταιριάζουν στο τμήμα. Μένει πρόχειρη μέχρι να την ενεργοποιήσετε.', 'One self-assessment per department, with the questions of the questionnaire that fit the department. It stays a draft until you release it.')} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={busy || !template || !picked.length} saveLabel={busy ? L(en, 'Δημιουργία…', 'Creating…') : L(en, 'Δημιουργία', 'Create')} />}>
    <div className="self-new">
      <ChoiceField label={L(en, 'Ερωτηματολόγιο *', 'Questionnaire *')} value={templateId} disabled={loading} onChange={value => { setTemplateId(value); const next = active.find(item => item.id === value); if (next && !title) setTitle(`${L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} · ${next.title}`) }}
        options={active.map(item => ({ value: item.id, label: `${item.title} (${item.questions.length})`, description: standardShort(item.standard) }))} placeholder={L(en, 'Επιλέξτε ερωτηματολόγιο…', 'Choose a questionnaire…')} />
      <p className="self-new-hint">{L(en, 'Θέλετε άλλες ερωτήσεις; Δημιουργήστε αντίγραφο του ερωτηματολογίου για το νοσοκομείο σας και προσθέστε ή αλλάξτε ερωτήσεις.', 'Want other questions? Make a hospital copy of the questionnaire and add or change questions.')} <button type="button" className="text-button" onClick={() => navigate('/quality/audit-questionnaires')}>{L(en, 'Άνοιγμα ερωτηματολογίων', 'Open the questionnaires')}</button></p>
      <Field label={L(en, 'Τίτλος', 'Title')}><input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} /></Field>
      <MultiSelect label={L(en, 'Τμήματα *', 'Departments *')} options={options} selected={picked} onChange={setPicked} tags placeholder={L(en, 'Επιλέξτε τμήματα…', 'Choose departments…')} />
      <ManualDateField label={L(en, 'Προθεσμία', 'Due date')} value={dueOn} onChange={setDueOn} />
    </div>
  </ObserverDialog>
}
