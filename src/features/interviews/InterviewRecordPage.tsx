import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, UserPlus, UserSearch, Users } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Button } from '../../design-system/Button'
import { SectionHeader } from '../../design-system/SectionHeader'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useEmployeesData } from '../employees/useEmployeesData'
import { CandidateStatusBadge, useInterviews, useInterviewsAccess, useInterviewsActor } from './InterviewsShared'
import { CandidateDialog, DecisionDialog, EducationDialog, EmployersDialog, HireDialog } from './InterviewsDialogs'
import { ageOn, categoryLabel, certificateLabel, employmentLabel, fmtDay, fmtMoney, fmtStamp, genderLabel, languageLabel, levelLabel, maritalLabel, militaryLabel, todayKey, yesNo } from './interviewsModel'
import { Field } from '../../design-system/Field'
import { ExportMenu } from '../../design-system/ExportMenu'
import { exportCandidates } from './interviewsReports'
import { CONSENTS } from './applicationModel'
import { decide, interviewsErrorMessage, loadCandidateSignature, removeCandidate, saveCandidateNotes } from './interviewsService'
import { DivisionCandidatePage } from './InterviewDivisions'



// An application («ΑΙΤΗΣΗ ΕΡΓΑΣΙΑΣ»): the details, education and languages, previous
// employers, the interviews with their evaluation, and the decision / hiring.
export function InterviewRecordPage() {
  const access = useInterviewsAccess()
  return access.divisionOnly ? <DivisionCandidatePage /> : <InterviewRecordFull />
}

function InterviewRecordFull() {
  const { candidateId } = useParams()
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/interviews')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const access = useInterviewsAccess()
  const actor = useInterviewsActor()
  const { state, loading, reload, organizationId } = useInterviews()
  const { data: employees } = useEmployeesData()
  const [dialog, setDialog] = useState(null)
  const [notes, setNotes] = useState(null)
  const [busy, setBusy] = useState(false)
  const candidate = state?.candidates.find(item => item.id === candidateId) || null

  if (!state) return <Page fill><div className="inline-empty">{loading ? (en ? 'Loading…' : 'Φόρτωση…') : (en ? 'Not available.' : 'Δεν είναι διαθέσιμο.')}</div></Page>
  if (!candidate) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Application not found' : 'Η αίτηση δεν βρέθηκε'}</strong></div></Page>

  const employee = candidate.employeeId ? employees.find(item => String(item.dbId || item.id) === String(candidate.employeeId)) : null
  const close = () => setDialog(null)
  const common = { candidate, organizationId, onClose: close, onSaved: reload }
  async function remove() {
    if (!await confirm({ title: en ? 'Delete application' : 'Διαγραφή αίτησης', message: en ? 'The application, its languages and employers are deleted.' : 'Διαγράφονται η αίτηση, οι γλώσσες και η προϋπηρεσία της.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeCandidate(organizationId, candidate.id); notify(en ? 'Deleted.' : 'Διαγράφηκε.', 'success'); goBack() } catch (error) { notify(interviewsErrorMessage(error, language), 'error') }
  }
  async function run(work) {
    setBusy(true)
    try { await work() } catch (error) { console.error(error); notify(interviewsErrorMessage(error, language), 'error') } finally { setBusy(false) }
  }
  const notesText = notes ?? candidate.notes ?? ''
  const saveNotes = () => run(async () => { await saveCandidateNotes(organizationId, candidate, notesText); setNotes(null); notify(en ? 'Notes saved.' : 'Οι σημειώσεις αποθηκεύτηκαν.', 'success'); await reload() })
  // Three answers: hire (then the employee is created), reserve list, reject (with a reason).
  const decideNow = decision => run(async () => {
    await decide(organizationId, candidate, { decision, decisionOn: todayKey(), decisionByName: actor.name, decisionNotes: notesText })
    await reload()
    if (decision === 'hire' && access.canHire) setDialog({ type: 'hire' })
  })
  const closed = candidate.status === 'hired'
  const canDecide = access.canManage && !closed
  const headerActions = <div className="row-actions">
    <ExportMenu onExcel={() => exportCandidates([candidate], language)} />
    {access.canManage && <Button recordMenu variant="secondary" onClick={() => setDialog({ type: 'candidate' })}><Pencil size={15} />{en ? 'Edit application' : 'Επεξεργασία αίτησης'}</Button>}
    {access.canManage && <Button recordMenu variant="secondary" onClick={() => setDialog({ type: 'education' })}><Pencil size={15} />{en ? 'Edit education & languages' : 'Επεξεργασία εκπαίδευσης & γλωσσών'}</Button>}
    {access.canManage && <Button recordMenu variant="secondary" onClick={() => setDialog({ type: 'employers' })}><Pencil size={15} />{en ? 'Edit previous employers' : 'Επεξεργασία προϋπηρεσίας'}</Button>}
    {access.canManage && <Button recordMenu variant="secondary" onClick={remove}><Trash2 size={15} />{en ? 'Delete application' : 'Διαγραφή αίτησης'}</Button>}
  </div>
  // The big forms open as a page in place of the record, not as a window over it.
  if (['candidate', 'education', 'employers', 'hire'].includes(dialog?.type)) return <>
    {dialog.type === 'candidate' && <CandidateDialog initial={candidate} organizationId={organizationId} onClose={close} onSaved={reload} />}
    {dialog.type === 'education' && <EducationDialog {...common} />}
    {dialog.type === 'employers' && <EmployersDialog {...common} />}
    {dialog.type === 'hire' && <HireDialog {...common} employees={employees} />}
  </>
  const age = ageOn(candidate.birthDate)
  // Only the details that have a value; the rest are added with «Add details».
  const filled = fields => fields.map(field => ({ ...field, hidden: field.hidden || !field.value || field.value === '—' }))
  const decisionBar = <div className="interviews-decision-bar">
    {candidate.decision && <span className="interviews-decision-now">{en ? 'Decision' : 'Απόφαση'}: <CandidateStatusBadge status={candidate.status} language={language} /></span>}
    {employee && <Button variant="secondary" onClick={() => navigate(`/employees/${encodeURIComponent(employee.id)}`)}><Users size={15} />{en ? 'Employee record' : 'Καρτέλα εργαζομένου'}</Button>}
    {canDecide && <>
      <Button variant="secondary" disabled={busy} onClick={() => setDialog({ type: 'decide', decision: 'reject' })}>{en ? 'Reject' : 'Απόρριψη'}</Button>
      <Button variant="secondary" disabled={busy} onClick={() => decideNow('reserve')}>{en ? 'Reserve list' : 'Αναμονή'}</Button>
      <Button disabled={busy} onClick={() => decideNow('hire')}><UserPlus size={15} />{en ? 'Hire' : 'Πρόσληψη'}</Button>
    </>}
  </div>
  return <Page fill><EntityRecordShell className="interviews-record-shell workspace-fill" avatar={<UserSearch size={19} />} eyebrow={candidate.code} title={candidate.fullName}
    subtitle={[candidate.requestedPosition, categoryLabel(candidate.professionalCategory, language), employmentLabel(candidate.employmentType, language), `${en ? 'Applied' : 'Αίτηση'} ${fmtDay(candidate.appliedOn)}`].filter(Boolean).join(' · ')}
    status={<CandidateStatusBadge status={candidate.status} language={language} />} headerActions={headerActions} onBack={goBack}>
    <RecordTabPanel title={en ? 'Application' : 'Αίτηση'} subtitle={en ? 'Look at it together with the candidate, write what you discuss, then decide.' : 'Δείτε την μαζί με τον υποψήφιο, γράψτε όσα λέτε και αποφασίστε.'}
      footer={decisionBar}>
      <div className="record-view-stack">
        <RecordDetailsGrid fields={filled([
          { label: en ? 'Position applied for' : 'Αιτούμενη θέση', value: candidate.requestedPosition }, { label: en ? 'Professional category' : 'Επαγγελματική κατηγορία', value: categoryLabel(candidate.professionalCategory, language) }, { label: en ? 'Employment type' : 'Είδος απασχόλησης', value: employmentLabel(candidate.employmentType, language) }, { label: en ? 'Application date' : 'Ημερομηνία αίτησης', value: fmtDay(candidate.appliedOn), meta: candidate.source === 'filemaker' ? '' : candidate.source === 'tablet' ? (en ? 'From tablet' : 'Από tablet') : '' },
          { label: en ? 'Gender' : 'Φύλο', value: genderLabel(candidate.gender, language) }, { label: en ? 'Birth date' : 'Ημερομηνία γέννησης', value: fmtDay(candidate.birthDate), meta: age != null ? `${age} ${en ? 'years' : 'ετών'}` : '' }, { label: en ? 'Place of birth' : 'Τόπος γέννησης', value: candidate.birthPlace },
          { label: en ? "Father's / mother's name" : 'Όνομα πατρός / μητρός', value: [candidate.fatherName, candidate.motherName].filter(Boolean).join(' / ') }, { label: en ? 'Nationality / citizenship' : 'Εθνικότητα / υπηκοότητα', value: [candidate.nationality, candidate.citizenship].filter(Boolean).join(' / ') }, { label: en ? 'Marital status' : 'Οικογενειακή κατάσταση', value: [maritalLabel(candidate.maritalStatus, language), candidate.children !== '' && candidate.children != null ? `${candidate.children} ${en ? 'children' : 'παιδιά'}` : ''].filter(Boolean).join(' · ') },
          { label: en ? 'Military service' : 'Στρατιωτική θητεία', value: militaryLabel(candidate.militaryService, language) }, { label: en ? 'Work permit' : 'Άδεια εργασίας', value: yesNo(candidate.workPermit, language) }, { label: en ? 'Licence to practise' : 'Άδεια άσκησης επαγγέλματος', value: yesNo(candidate.practiceLicence, language) },
          { label: en ? 'Smoker' : 'Κάπνισμα', value: yesNo(candidate.smoker, language) }, { label: en ? 'ID card' : 'Ταυτότητα', value: [candidate.idNumber, candidate.idAuthority].filter(Boolean).join(' · '), meta: candidate.idIssuedOn ? fmtDay(candidate.idIssuedOn) : '' },
          { label: en ? 'Address' : 'Διεύθυνση', value: [candidate.address, candidate.area, candidate.postcode].filter(Boolean).join(', ') }, { label: en ? 'Phones' : 'Τηλέφωνα', value: [candidate.phoneMobile, candidate.phoneLandline].filter(Boolean).join(' · ') }, { label: 'Email', value: candidate.email },
          { label: en ? 'Why us' : 'Γιατί εμάς', value: candidate.whyUs, className: 'interviews-span-3' }, { label: en ? 'Reason for applying' : 'Λόγος αίτησης', value: candidate.applicationReason, className: 'interviews-span-3' }, { label: en ? 'Activities / interests' : 'Δραστηριότητες', value: candidate.activities, className: 'interviews-span-3' }, { label: en ? 'Notes (HR)' : 'Σημειώσεις (HR)', value: candidate.notes, className: 'interviews-span-3' },
          { label: en ? 'Consent (GDPR)' : 'Συναίνεση (GDPR)', value: candidate.consentGiven ? (en ? 'Given' : 'Δόθηκε') : (en ? 'Not given' : 'Δεν δόθηκε'), meta: [candidate.consentText, fmtStamp(candidate.consentAt, language)].filter(Boolean).join(' · ') }])} />
        {(candidate.source === 'tablet' || candidate.consentVersion) && <CandidateConsents candidate={candidate} organizationId={organizationId} en={en} language={language} />}
        <SectionHeader title={en ? 'Education & languages' : 'Εκπαίδευση & γλώσσες'} />
        <RecordDetailsGrid fields={filled([{ label: en ? 'Secondary education' : 'Βασική εκπαίδευση', value: candidate.educationLevel }, { label: en ? 'IT skills' : 'Γνώσεις πληροφορικής', value: candidate.itSkills, className: 'interviews-span-2' }])} />
        <RegistryTable bare sortable={false} rows={candidate.education.map((row, index) => ({ ...row, id: index }))} columns={[{ key: 'level', label: en ? 'Level' : 'Επίπεδο' }, { key: 'school', label: en ? 'School / department' : 'Σχολή / τμήμα' }, { key: 'title', label: en ? 'Degree' : 'Πτυχίο' }, { key: 'year', label: en ? 'Year' : 'Έτος' }]}
          emptyTitle={en ? 'No degrees recorded' : 'Δεν καταγράφηκαν πτυχία'} renderRow={row => <><td>{row.level || '—'}</td><td><strong>{row.school || '—'}</strong></td><td>{row.title || '—'}{row.completed === false && <small>{en ? 'In progress' : 'Σε εξέλιξη'}</small>}</td><td className="nowrap-cell">{row.year || '—'}</td></>} />
        <RegistryTable bare sortable={false} rows={candidate.languages} rowKey={row => row.id || row.language} columns={[{ key: 'language', label: en ? 'Language' : 'Γλώσσα' }, { key: 'speaking', label: en ? 'Speaking' : 'Ομιλία' }, { key: 'reading', label: en ? 'Reading' : 'Ανάγνωση' }, { key: 'writing', label: en ? 'Writing' : 'Γραφή' }, { key: 'certificate', label: en ? 'Certificate' : 'Πιστοποιητικό' }]}
          emptyTitle={en ? 'No languages recorded' : 'Δεν καταγράφηκαν γλώσσες'} renderRow={row => <><td><strong>{languageLabel(row.language, language)}</strong></td><td>{levelLabel(row.speaking, language) || '—'}</td><td>{levelLabel(row.reading, language) || '—'}</td><td>{levelLabel(row.writing, language) || '—'}</td><td>{certificateLabel(row, language) || '—'}</td></>} />
        <SectionHeader title={en ? 'Previous employers' : 'Προϋπηρεσία'} />
      <RegistryTable bare sortable={false} rows={[...candidate.employers].sort((a, b) => String(b.fromOn || '').localeCompare(String(a.fromOn || '')))} rowKey={row => row.id || row.employer} columns={[{ key: 'employer', label: en ? 'Employer' : 'Εργοδότης' }, { key: 'period', label: en ? 'Period' : 'Περίοδος' }, { key: 'position', label: en ? 'Position' : 'Θέση' }, { key: 'salary', label: en ? 'Salary' : 'Μισθός' }, { key: 'reason', label: en ? 'Reason for leaving' : 'Λόγος αποχώρησης' }]}
        emptyTitle={en ? 'No previous employers' : 'Χωρίς προϋπηρεσία'} renderRow={row => <><td><strong>{row.employer}</strong></td><td className="nowrap-cell">{fmtDay(row.fromOn)} – {row.toOn ? fmtDay(row.toOn) : (en ? 'today' : 'σήμερα')}</td><td>{row.jobTitle || '—'}</td><td className="nowrap-cell">{fmtMoney(row.salary, language)}</td><td>{row.leavingReason || '—'}</td></>} />
        <SectionHeader title={en ? 'Notes from the discussion' : 'Σημειώσεις συζήτησης'} />
        <Field><textarea rows={4} value={notesText} disabled={!access.canManage} placeholder={en ? 'What was said…' : 'Τι ειπώθηκε…'} onChange={event => setNotes(event.target.value)} /></Field>
        {access.canManage && notes !== null && notes !== (candidate.notes ?? '') && <div className="row-actions"><Button variant="secondary" disabled={busy} onClick={() => setNotes(null)}>{en ? 'Cancel' : 'Ακύρωση'}</Button><Button disabled={busy} onClick={saveNotes}>{en ? 'Save notes' : 'Αποθήκευση σημειώσεων'}</Button></div>}
      </div>
    </RecordTabPanel>
    {dialog?.type === 'decide' && <DecisionDialog {...common} initialDecision={dialog.decision} />}
  </EntityRecordShell></Page>
}

// The consents given on the tablet, each with the text the candidate read, and the
// signature under them (loaded only here, not with the list).
function CandidateConsents({ candidate, organizationId, en, language }) {
  const [signature, setSignature] = useState('')
  useEffect(() => {
    let live = true
    loadCandidateSignature(organizationId, candidate).then(image => { if (live) setSignature(image) }).catch(() => {})
    return () => { live = false }
  }, [organizationId, candidate])
  const given = { gdpr: candidate.consentGiven, future: candidate.consentFuture, references: candidate.consentReferences, truth: candidate.declarationTruth }
  const texts = candidate.consentTexts || {}
  return <>
    <SectionHeader title={en ? 'Consents and signature' : 'Συναινέσεις και υπογραφή'} subtitle={[candidate.consentVersion && `${en ? 'Text version' : 'Έκδοση κειμένων'} ${candidate.consentVersion}`, fmtStamp(candidate.signedAt || candidate.consentAt, language)].filter(Boolean).join(' · ')} />
    <ul className="interviews-consents">{CONSENTS.map(consent => <li key={consent.key}>
      <StatusBadge tone={given[consent.key] ? 'success' : consent.required ? 'danger' : 'neutral'}>{given[consent.key] ? (en ? 'Yes' : 'Ναι') : (en ? 'No' : 'Όχι')}</StatusBadge>
      <div><strong>{consent.title[en ? 1 : 0]}</strong><small>{texts[consent.key] || consent.text[en ? 'en' : 'el']}</small></div>
    </li>)}</ul>
    {signature ? <figure className="interviews-signature"><img src={signature} alt={en ? 'Signature of the candidate' : 'Υπογραφή υποψηφίου'} /><figcaption>{candidate.fullName} · {fmtStamp(candidate.signedAt || candidate.consentAt, language)}</figcaption></figure>
      : <p className="interviews-muted">{en ? 'No signature on file.' : 'Δεν υπάρχει υπογραφή.'}</p>}
  </>
}
