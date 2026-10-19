import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { ChoiceField } from '../../design-system/ChoiceField'
import { CheckboxField } from '../../design-system/CheckboxField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { SectionHeader } from '../../design-system/SectionHeader'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { createEmployeeAsync } from '../employees/employeeService'
import { loadDepartments } from '../management/departmentsService'
import { demoLibrarySeed } from '../management/managementData'
import { useInterviewsActor } from './InterviewsShared'
import { CRITERIA, DECISIONS, EMPLOYMENT_TYPES, GENDERS, INTERVIEWER_ROLES, LANGUAGES, LEVELS, MARITAL, MILITARY, OUTCOMES, SCORES, candidateProblems, decisionProblems, employeeDraftFor, fmtRating, interviewProblems, matchingEmployees, newEducation, newEmployer, newLanguage, options, overallRating, ratingTone, todayKey } from './interviewsModel'
import { decide, interviewsErrorMessage, markHired, saveCandidate, saveInterview } from './interviewsService'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const triState = en => [{ value: '', label: '—' }, { value: 'yes', label: en ? 'Yes' : 'Ναι' }, { value: 'no', label: en ? 'No' : 'Όχι' }]
const fromTri = value => (value === 'yes' ? true : value === 'no' ? false : null)
const toTri = value => (value === true ? 'yes' : value === false ? 'no' : '')
const withEmpty = list => [{ value: '', label: '—' }, ...list]

// Saves with the house feedback; the dialog closes only when the save went through.
function useSave(onSaved) {
  const { language } = useLanguage()
  const { notify } = useFeedback()
  const [saving, setSaving] = useState(false)
  const run = async (work, message) => {
    setSaving(true)
    try { const result = await work(); notify(message || (language === 'en' ? 'Saved.' : 'Αποθηκεύτηκε.'), 'success'); await onSaved?.(result) } catch (error) { console.error(error); notify(interviewsErrorMessage(error, language), 'error') } finally { setSaving(false) }
  }
  return [saving, run]
}
const Missing = ({ problems, en }) => (problems.length ? <span className="interviews-dialog-result"><small>{en ? 'Missing' : 'Λείπει'}: {problems.join(' · ')}</small></span> : null)
const Text = ({ label, value, onChange, rows = 0, type = 'text' }) => <Field label={label}>{rows ? <textarea rows={rows} value={value ?? ''} onChange={e => onChange(e.target.value)} /> : <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} />}</Field>

// --- Application -------------------------------------------------------------------------------

// The application form («ΑΙΤΗΣΗ ΕΡΓΑΣΙΑΣ»): position, personal details, contact, the
// rest of the form and the consent to the processing of personal data.
export function CandidateDialog({ initial, organizationId, positions = [], onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [draft, setDraft] = useState(() => structuredClone(initial))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const problems = candidateProblems(draft, language)
  const save = () => run(async () => { const id = await saveCandidate(organizationId, draft); onClose(); return id }, en ? 'Application saved.' : 'Η αίτηση αποθηκεύτηκε.')
  return <ObserverDialog width="wide" title={initial.id ? `${en ? 'Application' : 'Αίτηση'} ${initial.code || ''}`.trim() : (en ? 'New application' : 'Νέα αίτηση εργασίας')} subtitle={en ? 'Personal data of a candidate: kept only with their consent and seen only by HR.' : 'Προσωπικά δεδομένα υποψηφίου: τηρούνται μόνο με τη συναίνεσή του και τα βλέπει μόνο το Γραφείο Προσωπικού.'} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || problems.length > 0} saveLabel={en ? 'Save' : 'Αποθήκευση'}><Missing problems={problems} en={en} /></DialogActions>}>
    <SectionHeader title={en ? 'Position' : 'Θέση'} />
    <FormGrid columns={3}>
      <SearchableSelect label={en ? 'Position applied for' : 'Αιτούμενη θέση εργασίας'} value={draft.requestedPosition} allowCustom options={positions.map(value => ({ value, label: value }))} onChange={value => set({ requestedPosition: value || '' })} {...selectText(en)} />
      <ChoiceField label={en ? 'Employment type' : 'Είδος απασχόλησης'} value={draft.employmentType} options={withEmpty(options(EMPLOYMENT_TYPES, language))} onChange={value => set({ employmentType: value })} />
      <ManualDateField label={en ? 'Application date' : 'Ημερομηνία αίτησης'} value={draft.appliedOn} onChange={value => set({ appliedOn: value })} />
    </FormGrid>
    <SectionHeader title={en ? 'Personal details' : 'Προσωπικά στοιχεία'} />
    <FormGrid columns={3}>
      <Text label={en ? 'Full name *' : 'Ονοματεπώνυμο *'} value={draft.fullName} onChange={value => set({ fullName: value })} />
      <ChoiceField label={en ? 'Gender' : 'Φύλο'} value={draft.gender} options={withEmpty(options(GENDERS, language))} onChange={value => set({ gender: value })} />
      <ManualDateField label={en ? 'Birth date' : 'Ημερομηνία γέννησης'} value={draft.birthDate} onChange={value => set({ birthDate: value })} optional />
      <Text label={en ? "Father's name" : 'Όνομα πατρός'} value={draft.fatherName} onChange={value => set({ fatherName: value })} />
      <Text label={en ? "Mother's name" : 'Όνομα μητρός'} value={draft.motherName} onChange={value => set({ motherName: value })} />
      <Text label={en ? 'Place of birth' : 'Τόπος γέννησης'} value={draft.birthPlace} onChange={value => set({ birthPlace: value })} />
      <Text label={en ? 'Nationality' : 'Εθνικότητα'} value={draft.nationality} onChange={value => set({ nationality: value })} />
      <Text label={en ? 'Citizenship' : 'Υπηκοότητα'} value={draft.citizenship} onChange={value => set({ citizenship: value })} />
      <ChoiceField label={en ? 'Marital status' : 'Οικογενειακή κατάσταση'} value={draft.maritalStatus} options={withEmpty(options(MARITAL, language))} onChange={value => set({ maritalStatus: value })} />
      <Text label={en ? 'Children' : 'Αριθμός παιδιών'} type="number" value={draft.children} onChange={value => set({ children: value })} />
      <ChoiceField label={en ? 'Military service' : 'Στρατιωτική θητεία'} value={draft.militaryService} options={withEmpty(options(MILITARY, language))} onChange={value => set({ militaryService: value })} />
      <ChoiceField label={en ? 'Smoker' : 'Κάπνισμα'} value={toTri(draft.smoker)} options={triState(en)} onChange={value => set({ smoker: fromTri(value) })} />
      <Text label={en ? 'ID card number' : 'Αρ. ταυτότητας'} value={draft.idNumber} onChange={value => set({ idNumber: value })} />
      <Text label={en ? 'Issuing authority' : 'Εκδούσα αρχή'} value={draft.idAuthority} onChange={value => set({ idAuthority: value })} />
      <ManualDateField label={en ? 'Issued on' : 'Ημερομηνία έκδοσης'} value={draft.idIssuedOn} onChange={value => set({ idIssuedOn: value })} optional />
      <ChoiceField label={en ? 'Work permit' : 'Άδεια εργασίας'} value={toTri(draft.workPermit)} options={triState(en)} onChange={value => set({ workPermit: fromTri(value) })} />
      <ChoiceField label={en ? 'Licence to practise' : 'Άδεια άσκησης επαγγέλματος'} value={toTri(draft.practiceLicence)} options={triState(en)} onChange={value => set({ practiceLicence: fromTri(value) })} />
    </FormGrid>
    <SectionHeader title={en ? 'Contact' : 'Επικοινωνία'} />
    <FormGrid columns={3}>
      <Text label={en ? 'Address' : 'Διεύθυνση κατοικίας'} value={draft.address} onChange={value => set({ address: value })} />
      <Text label={en ? 'Area' : 'Περιοχή'} value={draft.area} onChange={value => set({ area: value })} />
      <Text label={en ? 'Postcode' : 'ΤΚ'} value={draft.postcode} onChange={value => set({ postcode: value })} />
      <Text label={en ? 'Mobile' : 'Κινητό τηλέφωνο'} value={draft.phoneMobile} onChange={value => set({ phoneMobile: value })} />
      <Text label={en ? 'Landline' : 'Σταθερό τηλέφωνο'} value={draft.phoneLandline} onChange={value => set({ phoneLandline: value })} />
      <Text label="Email" type="email" value={draft.email} onChange={value => set({ email: value })} />
    </FormGrid>
    <SectionHeader title={en ? 'About the application' : 'Για την αίτηση'} />
    <FormGrid columns={2}>
      <Text label={en ? 'Why did you choose us?' : 'Γιατί επιλέξατε εμάς;'} rows={2} value={draft.whyUs} onChange={value => set({ whyUs: value })} />
      <Text label={en ? 'Reason for applying' : 'Λόγος αίτησης'} rows={2} value={draft.applicationReason} onChange={value => set({ applicationReason: value })} />
      <Text label={en ? 'Activities / interests' : 'Δραστηριότητες / ενδιαφέροντα'} rows={2} value={draft.activities} onChange={value => set({ activities: value })} />
      <Text label={en ? 'Notes (HR)' : 'Σημειώσεις (HR)'} rows={2} value={draft.notes} onChange={value => set({ notes: value })} />
    </FormGrid>
    <SectionHeader title={en ? 'Personal data' : 'Προσωπικά δεδομένα'} subtitle={en ? 'Without the signed consent the application is not kept.' : 'Χωρίς την υπογεγραμμένη συναίνεση η αίτηση δεν τηρείται.'} />
    <FormGrid columns={2}>
      <CheckboxField label={en ? 'The candidate consents to the processing of personal data (GDPR) *' : 'Ο υποψήφιος συναινεί στην επεξεργασία των προσωπικών δεδομένων (GDPR) *'} checked={draft.consentGiven} onChange={value => set({ consentGiven: value })} />
      <Text label={en ? 'Consent form / note' : 'Έντυπο / σημείωση συναίνεσης'} value={draft.consentText} onChange={value => set({ consentText: value })} />
    </FormGrid>
  </ObserverDialog>
}

// Education, IT skills and languages of an application.
export function EducationDialog({ candidate, organizationId, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [draft, setDraft] = useState(() => ({ ...structuredClone(candidate), education: candidate.education?.length ? structuredClone(candidate.education) : [newEducation()], languages: candidate.languages?.length ? structuredClone(candidate.languages) : [newLanguage()] }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const setRow = (key, index, next) => setDraft(current => ({ ...current, [key]: current[key].map((row, at) => (at === index ? { ...row, ...next } : row)) }))
  const addRow = (key, row) => setDraft(current => ({ ...current, [key]: [...current[key], row] }))
  const removeRow = (key, index) => setDraft(current => ({ ...current, [key]: current[key].filter((_, at) => at !== index) }))
  const levels = withEmpty(options(LEVELS, language))
  const save = () => run(async () => { await saveCandidate(organizationId, draft); onClose() })
  return <ObserverDialog width="wide" title={en ? 'Education and languages' : 'Εκπαίδευση και γλώσσες'} subtitle={candidate.fullName} onClose={onClose} footer={<DialogActions onSave={save} disabled={saving} />}>
    <FormGrid columns={2}>
      <Text label={en ? 'Secondary education' : 'Βασική εκπαίδευση'} value={draft.educationLevel} onChange={value => set({ educationLevel: value })} />
      <Text label={en ? 'IT skills' : 'Γνώσεις πληροφορικής'} value={draft.itSkills} onChange={value => set({ itSkills: value })} />
    </FormGrid>
    <SectionHeader title={en ? 'Degrees and schools' : 'Πτυχία και σχολές'} actions={<Button variant="secondary" onClick={() => addRow('education', newEducation())}><Plus size={15} />{en ? 'Add' : 'Προσθήκη'}</Button>} />
    <div className="interviews-row-list">
      {draft.education.map((row, index) => <div className="interviews-row" key={index}>
        <FormGrid columns={4}>
          <Text label={en ? 'Level' : 'Επίπεδο'} value={row.level} onChange={value => setRow('education', index, { level: value })} />
          <Text label={en ? 'School / department' : 'Σχολή / τμήμα'} value={row.school} onChange={value => setRow('education', index, { school: value })} />
          <Text label={en ? 'Degree title' : 'Τίτλος πτυχίου'} value={row.title} onChange={value => setRow('education', index, { title: value })} />
          <Text label={en ? 'Year' : 'Έτος'} value={row.year} onChange={value => setRow('education', index, { year: value })} />
        </FormGrid>
        <div className="interviews-row-end"><CheckboxField label={en ? 'Completed' : 'Ολοκληρώθηκε'} checked={row.completed !== false} onChange={value => setRow('education', index, { completed: value })} /><IconButton tone="danger" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => removeRow('education', index)}><Trash2 size={15} /></IconButton></div>
      </div>)}
    </div>
    <SectionHeader title={en ? 'Languages' : 'Ξένες γλώσσες'} actions={<Button variant="secondary" onClick={() => addRow('languages', newLanguage())}><Plus size={15} />{en ? 'Add' : 'Προσθήκη'}</Button>} />
    <div className="interviews-row-list">
      {draft.languages.map((row, index) => <div className="interviews-row" key={row.id || index}>
        <FormGrid columns={4}>
          <SearchableSelect label={en ? 'Language' : 'Γλώσσα'} value={row.language} allowCustom options={options(LANGUAGES, language)} onChange={value => setRow('languages', index, { language: value || '' })} {...selectText(en)} />
          <ChoiceField label={en ? 'Speaking' : 'Ομιλία'} value={row.speaking} options={levels} onChange={value => setRow('languages', index, { speaking: value })} />
          <ChoiceField label={en ? 'Reading' : 'Ανάγνωση'} value={row.reading} options={levels} onChange={value => setRow('languages', index, { reading: value })} />
          <ChoiceField label={en ? 'Writing' : 'Γραφή'} value={row.writing} options={levels} onChange={value => setRow('languages', index, { writing: value })} />
        </FormGrid>
        <div className="interviews-row-end"><CheckboxField label={en ? 'Certificate' : 'Πιστοποιητικό'} checked={Boolean(row.certificate)} onChange={value => setRow('languages', index, { certificate: value })} />{row.certificate && <input aria-label={en ? 'Certificate title' : 'Τίτλος πιστοποιητικού'} placeholder={en ? 'e.g. B2, Proficiency' : 'π.χ. B2, Proficiency'} value={row.certificateName || ''} onChange={e => setRow('languages', index, { certificateName: e.target.value })} />}<IconButton tone="danger" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => removeRow('languages', index)}><Trash2 size={15} /></IconButton></div>
      </div>)}
    </div>
  </ObserverDialog>
}

// Previous employers («ΠΡΟΫΠΗΡΕΣΙΑ»): employer, period, position, salary, reason for leaving.
export function EmployersDialog({ candidate, organizationId, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [rows, setRows] = useState(() => (candidate.employers?.length ? structuredClone(candidate.employers) : [newEmployer()]))
  const [saving, run] = useSave(onSaved)
  const setRow = (index, next) => setRows(current => current.map((row, at) => (at === index ? { ...row, ...next } : row)))
  const problems = candidateProblems({ ...candidate, employers: rows }, language)
  const save = () => run(async () => { await saveCandidate(organizationId, { ...candidate, employers: rows }); onClose() })
  return <ObserverDialog width="wide" title={en ? 'Previous employers' : 'Προϋπηρεσία'} subtitle={candidate.fullName} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || problems.length > 0}><Missing problems={problems} en={en} /></DialogActions>}>
    <SectionHeader title={en ? 'Employers' : 'Εργοδότες'} actions={<Button variant="secondary" onClick={() => setRows(current => [...current, newEmployer()])}><Plus size={15} />{en ? 'Add' : 'Προσθήκη'}</Button>} />
    <div className="interviews-row-list">
      {rows.map((row, index) => <div className="interviews-row" key={row.id || index}>
        <FormGrid columns={3}>
          <Text label={en ? 'Employer' : 'Επωνυμία εργοδότη'} value={row.employer} onChange={value => setRow(index, { employer: value })} />
          <ManualDateField label={en ? 'From' : 'Από'} value={row.fromOn} onChange={value => setRow(index, { fromOn: value })} optional />
          <ManualDateField label={en ? 'To' : 'Έως'} value={row.toOn} onChange={value => setRow(index, { toOn: value })} optional />
          <Text label={en ? 'Position' : 'Θέση'} value={row.jobTitle} onChange={value => setRow(index, { jobTitle: value })} />
          <Text label={en ? 'Salary (€)' : 'Μισθός (€)'} type="number" value={row.salary} onChange={value => setRow(index, { salary: value })} />
          <Text label={en ? 'Reason for leaving' : 'Λόγος αποχώρησης'} value={row.leavingReason} onChange={value => setRow(index, { leavingReason: value })} />
        </FormGrid>
        <div className="interviews-row-end"><IconButton tone="danger" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => setRows(current => current.filter((_, at) => at !== index))}><Trash2 size={15} /></IconButton></div>
      </div>)}
    </div>
  </ObserverDialog>
}

// --- Interview -------------------------------------------------------------------------------

// The panel: evaluators from the staff registry (or a name), and the HR office.
function InterviewersEditor({ value, onChange, employees, language }) {
  const en = language === 'en'
  const rows = value || []
  const employeeOptions = employees.map(item => ({ value: String(item.dbId || item.id), label: `${item.lastName} ${item.firstName}`.trim(), description: [item.position || item.profession, item.department].filter(Boolean).join(' · ') }))
  const setRow = (index, next) => onChange(rows.map((row, at) => (at === index ? { ...row, ...next } : row)))
  return <>
    <SectionHeader title={en ? 'Interview panel' : 'Επιτροπή συνέντευξης'} subtitle={en ? 'Evaluator 1 / 2 and the HR office.' : 'Αξιολογητής 1 / 2 και Γραφείο Προσωπικού.'} actions={<Button variant="secondary" onClick={() => onChange([...rows, { employeeId: '', name: '', role: 'evaluator' }])}><Plus size={15} />{en ? 'Add member' : 'Προσθήκη μέλους'}</Button>} />
    <div className="interviews-row-list">
      {rows.map((row, index) => <div className="interviews-row interviews-row-inline" key={index}>
        <SearchableSelect label={en ? 'Name' : 'Ονοματεπώνυμο'} value={row.employeeId || row.name} allowCustom options={employeeOptions}
          onChange={next => { const found = employeeOptions.find(item => item.value === String(next)); setRow(index, found ? { employeeId: found.value, name: found.label } : { employeeId: '', name: next || '' }) }} {...selectText(en)} />
        <ChoiceField label={en ? 'Role' : 'Ρόλος'} value={row.role || 'evaluator'} options={options(INTERVIEWER_ROLES, language)} onChange={next => setRow(index, { role: next })} />
        <IconButton tone="danger" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => onChange(rows.filter((_, at) => at !== index))}><Trash2 size={15} /></IconButton>
      </div>)}
      {!rows.length && <p className="interviews-muted">{en ? 'No members yet.' : 'Δεν έχουν οριστεί μέλη.'}</p>}
    </div>
  </>
}

const splitStamp = value => { if (!value) return ['', '']; const d = new Date(value); if (Number.isNaN(d.getTime())) return ['', '']; return [todayKey(d), `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`] }
const joinStamp = (dayValue, time) => (dayValue ? new Date(`${dayValue}T${time || '09:00'}:00`).toISOString() : '')

// Schedule (or move) an interview: day, time, place and the panel.
export function ScheduleDialog({ candidate, initial, organizationId, employees = [], onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [draft, setDraft] = useState(() => structuredClone(initial))
  const [[dayValue, time], setWhen] = useState(() => splitStamp(initial.scheduledAt))
  const [saving, run] = useSave(onSaved)
  const entry = { ...draft, scheduledAt: joinStamp(dayValue, time), status: draft.status === 'completed' ? 'completed' : draft.status || 'scheduled' }
  const problems = interviewProblems(entry, language)
  const save = () => run(async () => { await saveInterview(organizationId, candidate, entry); onClose() }, en ? 'Interview scheduled.' : 'Η συνέντευξη προγραμματίστηκε.')
  return <ObserverDialog title={initial.id ? (en ? 'Interview' : 'Συνέντευξη') : (en ? 'Schedule interview' : 'Προγραμματισμός συνέντευξης')} subtitle={candidate.fullName} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || problems.length > 0} saveLabel={en ? 'Save' : 'Αποθήκευση'}><Missing problems={problems} en={en} /></DialogActions>}>
    <FormGrid columns={3}>
      <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={dayValue} onChange={value => setWhen([value, time])} />
      <TimeField label={en ? 'Time' : 'Ώρα'} value={time} onChange={value => setWhen([dayValue, value])} />
      <Text label={en ? 'Place' : 'Τόπος'} value={draft.location} onChange={value => setDraft(current => ({ ...current, location: value }))} />
    </FormGrid>
    {initial.id && draft.status !== 'completed' && <FormGrid columns={3}><ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={draft.status} options={[{ value: 'scheduled', label: en ? 'Scheduled' : 'Προγραμματισμένη' }, { value: 'cancelled', label: en ? 'Cancelled' : 'Ακυρώθηκε' }]} onChange={value => setDraft(current => ({ ...current, status: value }))} /></FormGrid>}
    <InterviewersEditor value={draft.interviewers} onChange={value => setDraft(current => ({ ...current, interviewers: value }))} employees={employees} language={language} />
  </ObserverDialog>
}

// The evaluation of an interview: the score per criterion (1–5), the overall rating, the
// recommendation, salary and availability.
export function EvaluationDialog({ candidate, initial, organizationId, employees = [], onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const actor = useInterviewsActor()
  const [draft, setDraft] = useState(() => ({ ...structuredClone(initial), scheduledAt: initial.scheduledAt || new Date().toISOString(), interviewers: initial.interviewers?.length ? structuredClone(initial.interviewers) : [{ employeeId: '', name: actor.name, role: 'hr' }] }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const rating = overallRating(draft.scores)
  const entry = { ...draft, status: 'completed', evaluatedByName: draft.evaluatedByName || actor.name }
  const problems = interviewProblems(entry, language, { evaluation: true })
  const scoreOptions = [{ value: '', label: '—' }, ...SCORES.map(([value, el, enText]) => ({ value: String(value), label: `${value} · ${en ? enText : el}` }))]
  const save = () => run(async () => { await saveInterview(organizationId, candidate, entry, { actor }); onClose() }, en ? 'Evaluation recorded.' : 'Η αξιολόγηση καταχωρίστηκε.')
  return <ObserverDialog width="wide" title={en ? 'Interview evaluation' : 'Αξιολόγηση συνέντευξης'} subtitle={`${candidate.fullName}${candidate.requestedPosition ? ` · ${candidate.requestedPosition}` : ''}`} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || problems.length > 0} saveLabel={en ? 'Record evaluation' : 'Καταχώριση αξιολόγησης'}>
      <span className="interviews-dialog-result"><StatusBadge tone={ratingTone(rating)}>{fmtRating(rating, language)}</StatusBadge>{problems.length > 0 && <small>{en ? 'Missing' : 'Λείπει'}: {problems.join(' · ')}</small>}</span>
    </DialogActions>}>
    <InterviewersEditor value={draft.interviewers} onChange={value => set({ interviewers: value })} employees={employees} language={language} />
    <SectionHeader title={en ? 'Score per criterion' : 'Βαθμολογία ανά κριτήριο'} subtitle={en ? '1 poor · 3 good · 5 excellent. The overall rating is their mean.' : '1 ανεπαρκής · 3 καλή · 5 εξαιρετική. Η συνολική βαθμολογία είναι ο μέσος όρος.'} />
    <FormGrid columns={3}>
      {CRITERIA.map(([key, el, enText]) => <ChoiceField key={key} label={en ? enText : el} value={draft.scores?.[key] ? String(draft.scores[key]) : ''} options={scoreOptions}
        onChange={value => set({ scores: Object.fromEntries(Object.entries({ ...draft.scores, [key]: value ? Number(value) : null }).filter(([, score]) => score != null)) })} />)}
    </FormGrid>
    <SectionHeader title={en ? 'Recommendation' : 'Πρόταση'} />
    <FormGrid columns={3}>
      <ChoiceField label={en ? 'Panel recommendation *' : 'Πρόταση επιτροπής *'} value={draft.outcome} options={withEmpty(options(OUTCOMES, language))} onChange={value => set({ outcome: value })} />
      <Text label={en ? 'Salary asked (€)' : 'Μισθός που ζητά (€)'} type="number" value={draft.salaryExpectation} onChange={value => set({ salaryExpectation: value })} />
      <Text label={en ? 'Salary offered (€)' : 'Μισθός που προτείνεται (€)'} type="number" value={draft.offeredSalary} onChange={value => set({ offeredSalary: value })} />
      <Text label={en ? 'Benefits' : 'Παροχές'} value={draft.benefits} onChange={value => set({ benefits: value })} />
      <ManualDateField label={en ? 'Available from' : 'Διαθέσιμος από'} value={draft.availableFrom} onChange={value => set({ availableFrom: value })} optional />
    </FormGrid>
    <FormGrid columns={2}>
      <Text label={en ? 'Proposal for cooperation' : 'Πρόταση συνεργασίας'} rows={2} value={draft.recommendation} onChange={value => set({ recommendation: value })} />
      <Text label={en ? 'Notes' : 'Σημειώσεις'} rows={2} value={draft.notes} onChange={value => set({ notes: value })} />
      <Text label={en ? 'Strengths' : 'Δυνατά σημεία'} rows={2} value={draft.strengths} onChange={value => set({ strengths: value })} />
      <Text label={en ? 'Areas to improve' : 'Σημεία προς βελτίωση'} rows={2} value={draft.weaknesses} onChange={value => set({ weaknesses: value })} />
    </FormGrid>
  </ObserverDialog>
}

// --- Decision and hiring ----------------------------------------------------------------------

export function DecisionDialog({ candidate, organizationId, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const actor = useInterviewsActor()
  const [draft, setDraft] = useState(() => ({ decision: candidate.decision || '', decisionOn: candidate.decisionOn || todayKey(), decisionByName: candidate.decisionByName || actor.name, decisionNotes: candidate.decisionNotes || '', withdrawn: candidate.status === 'withdrawn' }))
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  const problems = draft.withdrawn ? [] : decisionProblems(draft, language)
  const save = () => run(async () => { await decide(organizationId, candidate, { ...draft, status: draft.withdrawn ? 'withdrawn' : undefined }); onClose() }, en ? 'Decision recorded.' : 'Η απόφαση καταχωρίστηκε.')
  return <ObserverDialog title={en ? 'Decision' : 'Απόφαση'} subtitle={candidate.fullName} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || problems.length > 0} saveLabel={en ? 'Record decision' : 'Καταχώριση απόφασης'}><Missing problems={problems} en={en} /></DialogActions>}>
    <FormGrid columns={3}>
      <ChoiceField label={en ? 'Decision *' : 'Απόφαση *'} value={draft.decision} options={withEmpty(options(DECISIONS, language))} onChange={value => set({ decision: value })} />
      <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={draft.decisionOn} onChange={value => set({ decisionOn: value })} />
      <Text label={en ? 'Decided by' : 'Αποφάσισε'} value={draft.decisionByName} onChange={value => set({ decisionByName: value })} />
    </FormGrid>
    <FormGrid columns={1}>
      <Text label={draft.decision === 'reject' ? (en ? 'Reason *' : 'Αιτιολογία *') : (en ? 'Notes' : 'Σημειώσεις')} rows={3} value={draft.decisionNotes} onChange={value => set({ decisionNotes: value })} />
      <CheckboxField label={en ? 'The candidate withdrew (declined the offer or is no longer interested)' : 'Ο υποψήφιος αποσύρθηκε (αρνήθηκε την πρόταση ή δεν ενδιαφέρεται πια)'} checked={draft.withdrawn} onChange={value => set({ withdrawn: value })} />
    </FormGrid>
    {draft.decision === 'hire' && !draft.withdrawn && <p className="interviews-muted">{en ? 'The application stays at «Offer» until «Hire» creates or links the employee.' : 'Η αίτηση μένει «Πρόταση συνεργασίας» ώσπου η «Πρόσληψη» να δημιουργήσει ή να συνδέσει τον εργαζόμενο.'}</p>}
  </ObserverDialog>
}

// «Πρόσληψη»: create the employee from the application, or link one already in the registry.
export function HireDialog({ candidate, organizationId, employees = [], onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { isDemo } = useTenant()
  const matches = matchingEmployees(candidate, employees)
  const [mode, setMode] = useState(matches.length ? 'link' : 'create')
  const [linked, setLinked] = useState(matches[0] ? String(matches[0].dbId || matches[0].id) : '')
  const [draft, setDraft] = useState(() => employeeDraftFor(candidate))
  const [departments, setDepartments] = useState([])
  const [saving, run] = useSave(onSaved)
  const set = next => setDraft(current => ({ ...current, ...next }))
  useEffect(() => {
    let active = true
    if (isDemo) { setDepartments(demoLibrarySeed.departments.map(([name, nameEn]) => ({ id: name, name, nameEn }))); return () => { active = false } }
    if (!organizationId) return () => { active = false }
    loadDepartments(organizationId).then(rows => { if (active) setDepartments((rows || []).filter(row => row.is_active !== false)) }).catch(() => { if (active) setDepartments([]) })
    return () => { active = false }
  }, [isDemo, organizationId])
  const code = draft.employeeCode.trim().toLowerCase()
  const duplicate = Boolean(code && employees.some(item => String(item.id || '').trim().toLowerCase() === code))
  const problems = mode === 'link' ? (linked ? [] : [en ? 'the employee' : 'τον εργαζόμενο']) : [!draft.employeeCode.trim() && (en ? 'employee code' : 'κωδικό εργαζομένου'), duplicate && (en ? 'a code not in use' : 'κωδικό που δεν χρησιμοποιείται'), !draft.lastName.trim() && (en ? 'last name' : 'επώνυμο'), !draft.firstName.trim() && (en ? 'first name' : 'όνομα'), !draft.department && (en ? 'department' : 'τμήμα')].filter(Boolean)
  const save = () => run(async () => {
    let employee = employees.find(item => String(item.dbId || item.id) === linked)
    if (mode === 'create') {
      const department = departments.find(row => row.id === draft.department || row.name === draft.department)
      employee = await createEmployeeAsync(organizationId, { ...draft, id: draft.employeeCode.trim(), employeeCode: draft.employeeCode.trim(), department: department?.name || draft.department, departmentId: isDemo ? null : department?.id || null, departmentEn: department?.nameEn || department?.name || draft.department, firstNameEn: draft.firstName, lastNameEn: draft.lastName })
    }
    await markHired(organizationId, candidate, employee)
    onClose()
    return employee
  }, en ? 'The candidate was hired.' : 'Ο υποψήφιος προσλήφθηκε.')
  const employeeOptions = employees.map(item => ({ value: String(item.dbId || item.id), label: `${item.lastName} ${item.firstName}`.trim(), description: [item.id, item.department].filter(Boolean).join(' · ') }))
  return <ObserverDialog width="wide" title={en ? 'Hire' : 'Πρόσληψη'} subtitle={`${candidate.fullName}${candidate.requestedPosition ? ` · ${candidate.requestedPosition}` : ''}`} onClose={onClose}
    footer={<DialogActions onSave={save} disabled={saving || problems.length > 0} saveLabel={mode === 'create' ? (en ? 'Create employee and hire' : 'Δημιουργία εργαζομένου και πρόσληψη') : (en ? 'Link and hire' : 'Σύνδεση και πρόσληψη')}><Missing problems={problems} en={en} /></DialogActions>}>
    <FormGrid columns={2}>
      <ChoiceField label={en ? 'Employee' : 'Εργαζόμενος'} value={mode} options={[{ value: 'create', label: en ? 'New employee from the application' : 'Νέος εργαζόμενος από την αίτηση' }, { value: 'link', label: en ? 'Already in the staff registry' : 'Υπάρχει ήδη στο μητρώο προσωπικού' }]} onChange={setMode} />
      {mode === 'link' && <SearchableSelect label={en ? 'Employee *' : 'Εργαζόμενος *'} value={linked} options={employeeOptions} onChange={value => setLinked(value || '')} {...selectText(en)} />}
    </FormGrid>
    {mode === 'link' && matches.length > 0 && <p className="interviews-muted">{en ? 'Found in the registry by name or email: ' : 'Βρέθηκαν στο μητρώο με το όνομα ή το email: '}{matches.map(item => `${item.lastName} ${item.firstName} (${item.id})`).join(', ')}</p>}
    {mode === 'create' && <FormGrid columns={3}>
      <Text label={en ? 'Last name *' : 'Επώνυμο *'} value={draft.lastName} onChange={value => set({ lastName: value })} />
      <Text label={en ? 'First name *' : 'Όνομα *'} value={draft.firstName} onChange={value => set({ firstName: value })} />
      <Text label={en ? "Father's name" : 'Πατρώνυμο'} value={draft.fatherName} onChange={value => set({ fatherName: value })} />
      <Text label={en ? 'Employee / folder code *' : 'Κωδικός εργαζομένου / φακέλου *'} value={draft.employeeCode} onChange={value => set({ employeeCode: value })} />
      <SearchableSelect label={en ? 'Department *' : 'Τμήμα *'} value={draft.department} options={departments.map(row => ({ value: row.id, label: en ? row.nameEn || row.name : row.name }))} onChange={value => set({ department: value || '' })} {...selectText(en)} />
      <ManualDateField label={en ? 'Hire date' : 'Ημερομηνία πρόσληψης'} value={draft.hireDate} onChange={value => set({ hireDate: value })} optional />
      <Text label={en ? 'Position' : 'Θέση'} value={draft.position} onChange={value => set({ position: value })} />
      <Text label="Email" type="email" value={draft.email} onChange={value => set({ email: value })} />
      <Text label={en ? 'Phone' : 'Τηλέφωνο'} value={draft.phone} onChange={value => set({ phone: value })} />
    </FormGrid>}
    {duplicate && <p className="interviews-muted">{en ? 'This code already belongs to another employee record.' : 'Ο κωδικός αυτός ανήκει ήδη σε άλλη καρτέλα εργαζομένου.'}</p>}
  </ObserverDialog>
}
