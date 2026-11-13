import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { DepartmentChoice, PrevalenceSurvey, PrevalenceSurveyDraft } from './managementTypes'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { RegistryTable } from '../../design-system/RegistryTable'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { deletePrevalenceSurvey, loadPrevalenceSurveyHistory, savePrevalenceSurvey } from './prevalenceSurveyCloudService'
import { loadDepartments } from './departmentsService'
import { demoLibrarySeed } from './managementData'
import { ShareOf } from './HospitalStructurePanel'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { hospitalToday } from '../../core/dates/hospitalDate'

const todayIso = () => hospitalToday()
type SurveyDraft = Record<keyof PrevalenceSurveyDraft, string>
const emptyDraft: SurveyDraft = { surveyDate: todayIso(), departmentId: '', departmentEl: '', patientsTotal: '', patientsWithHai: '', patientsOnAntibiotics: '', responsibleName: '', notes: '' }

export function PrevalenceSurveyPanel() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError, confirm } = useFeedback()
  const { role, tenant, isDemo } = useTenant()
  const isPlatformOwner = role === ROLES.PLATFORM_OWNER
  const fmt = (value: string | null | undefined) => value ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR').format(new Date(`${value}T12:00:00`)) : '—'
  const [rows, setRows] = useState<PrevalenceSurvey[]>([])
  // The responsible column only when it says something (not the same name on every row).
  const showResponsible = new Set(rows.map(row => row.responsibleName || '')).size > 1
  const [departments, setDepartments] = useState<DepartmentChoice[]>([])
  const [loading, setLoading] = useState(false)
  const [editor, setEditor] = useState(false)
  const [draft, setDraft] = useState<SurveyDraft>(emptyDraft)

  useEffect(() => {
    if (isDemo) { setDepartments(demoLibrarySeed.departments.map(([el, enName]) => ({ id: el, name: el, nameEn: enName }))); return }
    if (!tenant?.id) return
    let active = true
    loadDepartments(tenant.id).then(data => { if (active) setDepartments(data) }).catch(() => {})
    return () => { active = false }
  }, [isDemo, tenant?.id])

  useEffect(() => {
    if (!isDemo && !tenant?.id) return
    let active = true
    setLoading(true)
    loadPrevalenceSurveyHistory(tenant?.id).then(data => { if (active) setRows(data) }).catch(error => notifyError(error, 'load', { operation: 'prevalence_survey_load' })).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isDemo, tenant?.id, notifyError])

  async function save() {
    if (!draft.surveyDate || draft.patientsTotal === '' || draft.patientsWithHai === '' || draft.patientsOnAntibiotics === '') {
      notify(en ? 'Survey date and patient counts are required.' : 'Απαιτούνται ημερομηνία επισκόπησης και αριθμοί ασθενών.', 'danger')
      return
    }
    const total = Number(draft.patientsTotal), hai = Number(draft.patientsWithHai), abx = Number(draft.patientsOnAntibiotics)
    if (hai > total || abx > total) {
      notify(en ? 'HAI and antibiotic counts cannot exceed the total number of patients.' : 'Οι ασθενείς με ΝΝΛ και υπό αντιβίωση δεν μπορούν να υπερβαίνουν το σύνολο ασθενών.', 'danger')
      return
    }
    try {
      const department = departments.find(d => d.id === draft.departmentId)
      const record = { ...draft, departmentEl: department ? (language === 'el' ? department.name : (department.nameEn || department.name)) : '' }
      const saved = await savePrevalenceSurvey(tenant?.id, record)
      setRows(current => [saved, ...current])
      setEditor(false)
      setDraft(emptyDraft)
      notify(en ? 'Prevalence survey saved.' : 'Η καταγραφή επιπολασμού αποθηκεύτηκε.', 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'prevalence_survey_save' })
    }
  }

  function departmentName(row: PrevalenceSurvey) {
    const match = departments.find(item => item.id === row.departmentId)
    return en ? (match?.nameEn || row.departmentEl) : (row.departmentEl || match?.name)
  }

  async function remove(id: string) {
    const ok = await confirm({ message: en ? 'Delete this survey entry?' : 'Διαγραφή αυτής της καταγραφής επιπολασμού;', danger: true, confirmLabel: en ? 'Delete' : 'Διαγραφή' })
    if (!ok) return
    try {
      await deletePrevalenceSurvey(tenant?.id, id)
      setRows(current => current.filter(row => row.id !== id))
      notify(en ? 'Entry deleted.' : 'Η καταχώριση διαγράφηκε.', 'success')
    } catch (error) {
      notifyError(error, 'delete', { operation: 'prevalence_survey_delete' })
    }
  }

  return (
    <section className="management-section management-scroll-section">
      <div className="section-toolbar">
        <div>
          <h2>{en ? 'Point prevalence survey (PPS)' : 'Σημειακός επιπολασμός λοιμώξεων'}</h2>
          <p>{en ? 'One survey day: inpatients, those with a hospital infection and those on antibiotics (ECDC PPS).' : 'Μία ημέρα μέτρησης: νοσηλευόμενοι, όσοι έχουν νοσοκομειακή λοίμωξη και όσοι παίρνουν αντιβίωση (ECDC PPS).'}</p>
        </div>
        <Button onClick={() => setEditor(true)}><Plus size={15} />{en ? 'New survey' : 'Νέα επισκόπηση'}</Button>
      </div>
      {loading && <TableSkeleton/>}
      {!loading && <RegistryTable
        wrapperClassName="table-wrap scroll-table"
        columns={[{ key: 'date', label: en ? 'Survey date' : 'Ημερομηνία' }, { key: 'scope', label: en ? 'Scope' : 'Εύρος' }, { key: 'patients', label: en ? 'Patients' : 'Ασθενείς' }, { key: 'hai', label: en ? 'With a hospital infection' : 'Με νοσοκομειακή λοίμωξη' }, { key: 'abx', label: en ? 'On antibiotics' : 'Υπό αντιβίωση' }, ...(showResponsible ? [{ key: 'responsible', label: en ? 'Responsible' : 'Υπεύθυνος' }] : []), ...(isPlatformOwner ? [{ key: 'actions', label: '' }] : [])]}
        rows={rows}
        rowKey={row => row.id}
        renderRow={row => <>
          <td><strong>{fmt(row.surveyDate)}</strong></td><td>{row.departmentId ? (departmentName(row) || '—') : (en ? 'Whole hospital' : 'Όλο το νοσοκομείο')}</td><td>{row.patientsTotal}</td><td>{row.patientsWithHai}<ShareOf part={row.patientsWithHai} whole={row.patientsTotal} en={en} /></td><td>{row.patientsOnAntibiotics}<ShareOf part={row.patientsOnAntibiotics} whole={row.patientsTotal} en={en} /></td>{showResponsible && <td>{en && row.responsibleName === 'ΕΝΛ' ? 'IPC committee' : (row.responsibleName || '—')}</td>}
          {isPlatformOwner && <td><OverflowMenu items={[{ id: 'delete', label: en ? 'Delete' : 'Διαγραφή', icon: Trash2, tone: 'danger', onClick: () => remove(row.id) }]} /></td>}
        </>}
        emptyTitle={en ? 'No prevalence surveys recorded yet.' : 'Δεν έχουν καταγραφεί επισκοπήσεις επιπολασμού.'}
      />}
      {editor && <SurveyDialog en={en} draft={draft} setDraft={setDraft} departments={departments} language={language} onClose={() => setEditor(false)} onSave={save} />}
    </section>
  )
}

function SurveyDialog({ en, draft, setDraft, departments, language, onClose, onSave }: { en: boolean, draft: SurveyDraft, setDraft: Dispatch<SetStateAction<SurveyDraft>>, departments: DepartmentChoice[], language: string, onClose: () => void, onSave: () => void }) {
  const countField = (key: keyof SurveyDraft, label: string) => (
    <label><span>{label}</span><input type="number" min="0" value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} /></label>
  )
  return (
    <ObserverDialog width="standard" title={en ? 'New prevalence survey' : 'Νέα επισκόπηση επιπολασμού'} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={onSave} disabled={!draft.surveyDate} />}>
        <div className="entry-grid">
          <ManualDateField label={en ? 'Survey date' : 'Ημερομηνία επισκόπησης'} value={draft.surveyDate} onChange={value => setDraft(d => ({ ...d, surveyDate: value }))} />
          <label><span>{en ? 'Scope / department' : 'Εύρος / Τμήμα'}</span><select value={draft.departmentId} onChange={e => setDraft(d => ({ ...d, departmentId: e.target.value }))}><option value="">{en ? 'Whole hospital' : 'Όλο το νοσοκομείο'}</option>{departments.map(item => <option key={item.id} value={item.id}>{language === 'el' ? item.name : (item.nameEn || item.name)}</option>)}</select></label>
          {countField('patientsTotal', en ? 'Patients present' : 'Νοσηλευόμενοι ασθενείς')}
          {countField('patientsWithHai', en ? 'Patients with active HAI' : 'Ασθενείς με ενεργή ΝΝΛ')}
          {countField('patientsOnAntibiotics', en ? 'Patients on antibiotics' : 'Ασθενείς υπό αντιβίωση')}
          <label><span>{en ? 'Responsible' : 'Υπεύθυνος'}</span><input type="text" value={draft.responsibleName} onChange={e => setDraft(d => ({ ...d, responsibleName: e.target.value }))} /></label>
          <label className="entry-span-2"><span>{en ? 'Notes' : 'Σημειώσεις'}</span><textarea rows={3} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></label>
        </div>
    </ObserverDialog>
  )
}
