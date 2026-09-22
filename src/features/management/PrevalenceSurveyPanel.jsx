import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { IconButton } from '../../design-system/IconButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { deletePrevalenceSurvey, loadPrevalenceSurveyHistory, savePrevalenceSurvey } from './prevalenceSurveyCloudService'
import { loadDepartments } from './departmentsService'
import { demoLibrarySeed } from './managementData'

const todayIso = () => new Date().toISOString().slice(0, 10)
const emptyDraft = { surveyDate: todayIso(), departmentId: '', departmentEl: '', patientsTotal: '', patientsWithHai: '', patientsOnAntibiotics: '', responsibleName: '', notes: '' }

export function PrevalenceSurveyPanel() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError, confirm } = useFeedback()
  const { role, tenant, isDemo } = useTenant()
  const isPlatformOwner = role === ROLES.PLATFORM_OWNER
  const [rows, setRows] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [editor, setEditor] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)

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

  async function remove(id) {
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
          <p>{en ? 'Snapshot count of inpatients, active HAIs and antibiotic use on a survey day, whole-hospital or per department (ΥΑ 388/2014 §2.2 / ECDC PPS).' : 'Στιγμιαία καταγραφή νοσηλευόμενων, ενεργών ΝΝΛ και χρήσης αντιβιοτικών σε ημέρα επισκόπησης, σε επίπεδο νοσοκομείου ή τμήματος (ΥΑ 388/2014 §2.2 / ECDC PPS).'}</p>
        </div>
        <Button onClick={() => setEditor(true)}>+ {en ? 'New survey' : 'Νέα επισκόπηση'}</Button>
      </div>
      {loading && <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div>}
      {!loading && !rows.length && <div className="inline-empty">{en ? 'No prevalence surveys recorded yet.' : 'Δεν έχουν καταγραφεί επισκοπήσεις επιπολασμού.'}</div>}
      {!loading && Boolean(rows.length) && (
        <div className="record-table-wrap">
          <table className="record-table">
            <thead><tr><th>{en ? 'Survey date' : 'Ημερομηνία'}</th><th>{en ? 'Scope' : 'Εύρος'}</th><th>{en ? 'Patients' : 'Ασθενείς'}</th><th>{en ? 'With HAI' : 'Με ΝΝΛ'}</th><th>{en ? 'On antibiotics' : 'Υπό αντιβίωση'}</th><th>{en ? 'Responsible' : 'Υπεύθυνος'}</th>{isPlatformOwner && <th/>}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <td>{row.surveyDate}</td><td>{row.departmentId ? (row.departmentEl || '—') : (en ? 'Whole hospital' : 'Όλο το νοσοκομείο')}</td><td>{row.patientsTotal}</td><td>{row.patientsWithHai}</td><td>{row.patientsOnAntibiotics}</td><td>{row.responsibleName || '—'}</td>
              {isPlatformOwner && <td><IconButton tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => remove(row.id)}><Trash2 size={16} /></IconButton></td>}
            </tr>)}</tbody>
          </table>
        </div>
      )}
      {editor && <SurveyDialog en={en} draft={draft} setDraft={setDraft} departments={departments} language={language} onClose={() => setEditor(false)} onSave={save} />}
    </section>
  )
}

function SurveyDialog({ en, draft, setDraft, departments, language, onClose, onSave }) {
  const countField = (key, label) => (
    <label><span>{label}</span><input type="number" min="0" value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} /></label>
  )
  return (
    <div className="modal-backdrop">
      <div className="entry-card">
        <header><h3>{en ? 'New prevalence survey' : 'Νέα επισκόπηση επιπολασμού'}</h3><button className="icon-close" onClick={onClose}>×</button></header>
        <div className="entry-grid">
          <ManualDateField label={en ? 'Survey date' : 'Ημερομηνία επισκόπησης'} value={draft.surveyDate} onChange={value => setDraft(d => ({ ...d, surveyDate: value }))} />
          <label><span>{en ? 'Scope / department' : 'Εύρος / Τμήμα'}</span><select value={draft.departmentId} onChange={e => setDraft(d => ({ ...d, departmentId: e.target.value }))}><option value="">{en ? 'Whole hospital' : 'Όλο το νοσοκομείο'}</option>{departments.map(item => <option key={item.id} value={item.id}>{language === 'el' ? item.name : (item.nameEn || item.name)}</option>)}</select></label>
          {countField('patientsTotal', en ? 'Patients present' : 'Νοσηλευόμενοι ασθενείς')}
          {countField('patientsWithHai', en ? 'Patients with active HAI' : 'Ασθενείς με ενεργή ΝΝΛ')}
          {countField('patientsOnAntibiotics', en ? 'Patients on antibiotics' : 'Ασθενείς υπό αντιβίωση')}
          <label><span>{en ? 'Responsible' : 'Υπεύθυνος'}</span><input type="text" value={draft.responsibleName} onChange={e => setDraft(d => ({ ...d, responsibleName: e.target.value }))} /></label>
          <label className="entry-span-2"><span>{en ? 'Notes' : 'Σημειώσεις'}</span><textarea rows={3} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></label>
        </div>
        <footer><Button variant="secondary" onClick={onClose}>{en ? 'Cancel' : 'Ακύρωση'}</Button><SaveButton disabled={!draft.surveyDate} onClick={onSave}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></footer>
      </div>
    </div>
  )
}
