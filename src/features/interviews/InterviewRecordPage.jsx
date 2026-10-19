import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Briefcase, CalendarPlus, ClipboardCheck, Gavel, GraduationCap, Info, MessagesSquare, Pencil, Trash2, UserPlus, UserSearch, Users } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RecordMetricStrip } from '../../design-system/RecordMetricStrip'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { ExportMenu } from '../../design-system/ExportMenu'
import { SectionHeader } from '../../design-system/SectionHeader'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { reportExports } from '../../core/export/reportDocument'
import { useEmployeesData } from '../employees/useEmployeesData'
import { CandidateStatusBadge, useInterviews, useInterviewsAccess } from './InterviewsShared'
import { CandidateDialog, DecisionDialog, EducationDialog, EmployersDialog, EvaluationDialog, HireDialog, ScheduleDialog } from './InterviewsDialogs'
import { CRITERIA, ageOn, decisionLabel, employmentLabel, fmtDay, fmtMoney, fmtRating, fmtStamp, genderLabel, interviewStatusLabel, interviewerRoleLabel, languageLabel, latestEvaluation, levelLabel, maritalLabel, militaryLabel, newInterview, outcomeLabel, outcomeTone, positionsOf, ratingTone, sortedInterviews, yesNo } from './interviewsModel'
import { evaluationDocument } from './interviewsReports'
import { interviewsErrorMessage, removeCandidate, removeInterview } from './interviewsService'

// An application («ΑΙΤΗΣΗ ΕΡΓΑΣΙΑΣ»): the details, education and languages, previous
// employers, the interviews with their evaluation, and the decision / hiring.
export function InterviewRecordPage() {
  const { candidateId } = useParams()
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/interviews')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const access = useInterviewsAccess()
  const { state, loading, reload, organizationId } = useInterviews()
  const { data: employees } = useEmployeesData()
  const [tab, setTab] = useState('details')
  const [dialog, setDialog] = useState(null)
  const candidate = state?.candidates.find(item => item.id === candidateId) || null

  if (!state) return <Page fill><div className="inline-empty">{loading ? (en ? 'Loading…' : 'Φόρτωση…') : (en ? 'Not available.' : 'Δεν είναι διαθέσιμο.')}</div></Page>
  if (!candidate) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Application not found' : 'Η αίτηση δεν βρέθηκε'}</strong></div></Page>

  const interviews = sortedInterviews(candidate)
  const evaluation = latestEvaluation(candidate)
  const employee = candidate.employeeId ? employees.find(item => String(item.dbId || item.id) === String(candidate.employeeId)) : null
  const blocked = () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  const close = () => setDialog(null)
  const common = { candidate, organizationId, onClose: close, onSaved: reload }
  async function remove() {
    if (!await confirm({ title: en ? 'Delete application' : 'Διαγραφή αίτησης', message: en ? 'The application, its languages, employers and interviews are deleted.' : 'Διαγράφονται η αίτηση, οι γλώσσες, η προϋπηρεσία και οι συνεντεύξεις της.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeCandidate(organizationId, candidate.id); notify(en ? 'Deleted.' : 'Διαγράφηκε.', 'success'); goBack() } catch (error) { notify(interviewsErrorMessage(error, language), 'error') }
  }
  async function removeOne(item) {
    if (!await confirm({ title: en ? 'Delete interview' : 'Διαγραφή συνέντευξης', message: fmtStamp(item.scheduledAt, language) || '', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeInterview(organizationId, candidate, item.id); await reload() } catch (error) { notify(interviewsErrorMessage(error, language), 'error') }
  }
  const closed = ['hired', 'rejected', 'withdrawn'].includes(candidate.status)
  const canHireNow = access.canHire && !candidate.employeeId && candidate.status !== 'rejected'
  const headerActions = <div className="row-actions">
    {evaluation && <ExportMenu {...reportExports(() => evaluationDocument(candidate, evaluation, { language }), { word: true, onBlocked: blocked })} />}
    {access.canManage && !closed && <Button variant="secondary" onClick={() => setDialog({ type: 'schedule', interview: newInterview(candidate.id) })}><CalendarPlus size={15} />{en ? 'Schedule interview' : 'Προγραμματισμός'}</Button>}
    {access.canManage && !closed && <Button variant="secondary" onClick={() => setDialog({ type: 'evaluate', interview: interviews.find(item => item.status === 'scheduled') || newInterview(candidate.id) })}><ClipboardCheck size={15} />{en ? 'Record evaluation' : 'Αξιολόγηση'}</Button>}
    {access.canManage && candidate.status !== 'hired' && <Button variant="secondary" onClick={() => setDialog({ type: 'decide' })}><Gavel size={15} />{en ? 'Decide' : 'Απόφαση'}</Button>}
    {canHireNow && candidate.decision === 'hire' && candidate.status !== 'withdrawn' && <Button onClick={() => setDialog({ type: 'hire' })}><UserPlus size={15} />{en ? 'Hire' : 'Πρόσληψη'}</Button>}
    {access.canManage && <IconButton tone="edit" label={en ? 'Edit application' : 'Επεξεργασία αίτησης'} onClick={() => setDialog({ type: 'candidate' })}><Pencil size={16} /></IconButton>}
    {access.canManage && <IconButton tone="danger" label={en ? 'Delete application' : 'Διαγραφή αίτησης'} onClick={remove}><Trash2 size={16} /></IconButton>}
  </div>
  const tabs = [
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: Info },
    { id: 'education', label: en ? 'Education & languages' : 'Εκπαίδευση & γλώσσες', icon: GraduationCap },
    { id: 'employers', label: en ? `Experience ${candidate.employers.length}` : `Προϋπηρεσία ${candidate.employers.length}`, icon: Briefcase },
    { id: 'interviews', label: en ? `Interviews ${interviews.length}` : `Συνεντεύξεις ${interviews.length}`, icon: MessagesSquare },
    { id: 'decision', label: en ? 'Decision' : 'Απόφαση', icon: Gavel },
  ]
  const age = ageOn(candidate.birthDate)
  return <Page fill><EntityRecordShell className="interviews-record-shell workspace-fill" avatar={<UserSearch size={19} />} eyebrow={candidate.code} title={candidate.fullName}
    subtitle={[candidate.requestedPosition, employmentLabel(candidate.employmentType, language), `${en ? 'Applied' : 'Αίτηση'} ${fmtDay(candidate.appliedOn)}`].filter(Boolean).join(' · ')}
    status={<span className="interviews-badges"><CandidateStatusBadge status={candidate.status} language={language} />{evaluation && <StatusBadge tone={ratingTone(evaluation.overallRating)}>{fmtRating(evaluation.overallRating, language)}</StatusBadge>}{!candidate.consentGiven && <StatusBadge tone="danger">{en ? 'No consent' : 'Χωρίς συναίνεση'}</StatusBadge>}</span>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'details' && <RecordTabPanel title={en ? 'Details' : 'Στοιχεία'} subtitle={en ? 'Personal data: seen only by HR and the Hospital Admin.' : 'Προσωπικά δεδομένα: τα βλέπει μόνο το Γραφείο Προσωπικού και ο Διαχειριστής.'}>
      <div className="record-view-stack">
        <RecordDetailsGrid fields={[
          { label: en ? 'Position applied for' : 'Αιτούμενη θέση', value: candidate.requestedPosition }, { label: en ? 'Employment type' : 'Είδος απασχόλησης', value: employmentLabel(candidate.employmentType, language) }, { label: en ? 'Application date' : 'Ημερομηνία αίτησης', value: fmtDay(candidate.appliedOn), meta: candidate.source === 'filemaker' ? 'FileMaker' : '' },
          { label: en ? 'Gender' : 'Φύλο', value: genderLabel(candidate.gender, language) }, { label: en ? 'Birth date' : 'Ημερομηνία γέννησης', value: fmtDay(candidate.birthDate), meta: age != null ? `${age} ${en ? 'years' : 'ετών'}` : '' }, { label: en ? 'Place of birth' : 'Τόπος γέννησης', value: candidate.birthPlace },
          { label: en ? "Father's / mother's name" : 'Όνομα πατρός / μητρός', value: [candidate.fatherName, candidate.motherName].filter(Boolean).join(' / ') }, { label: en ? 'Nationality / citizenship' : 'Εθνικότητα / υπηκοότητα', value: [candidate.nationality, candidate.citizenship].filter(Boolean).join(' / ') }, { label: en ? 'Marital status' : 'Οικογενειακή κατάσταση', value: [maritalLabel(candidate.maritalStatus, language), candidate.children !== '' && candidate.children != null ? `${candidate.children} ${en ? 'children' : 'παιδιά'}` : ''].filter(Boolean).join(' · ') },
          { label: en ? 'Military service' : 'Στρατιωτική θητεία', value: militaryLabel(candidate.militaryService, language) }, { label: en ? 'Work permit' : 'Άδεια εργασίας', value: yesNo(candidate.workPermit, language) }, { label: en ? 'Licence to practise' : 'Άδεια άσκησης επαγγέλματος', value: yesNo(candidate.practiceLicence, language) },
          { label: en ? 'Smoker' : 'Κάπνισμα', value: yesNo(candidate.smoker, language) }, { label: en ? 'ID card' : 'Ταυτότητα', value: [candidate.idNumber, candidate.idAuthority].filter(Boolean).join(' · '), meta: candidate.idIssuedOn ? fmtDay(candidate.idIssuedOn) : '' },
        ]} />
        <SectionHeader title={en ? 'Contact' : 'Επικοινωνία'} />
        <RecordDetailsGrid fields={[{ label: en ? 'Address' : 'Διεύθυνση', value: [candidate.address, candidate.area, candidate.postcode].filter(Boolean).join(', ') }, { label: en ? 'Phones' : 'Τηλέφωνα', value: [candidate.phoneMobile, candidate.phoneLandline].filter(Boolean).join(' · ') }, { label: 'Email', value: candidate.email }]} />
        <SectionHeader title={en ? 'About the application' : 'Για την αίτηση'} />
        <RecordDetailsGrid fields={[{ label: en ? 'Why us' : 'Γιατί εμάς', value: candidate.whyUs, className: 'interviews-span-3' }, { label: en ? 'Reason for applying' : 'Λόγος αίτησης', value: candidate.applicationReason, className: 'interviews-span-3' }, { label: en ? 'Activities / interests' : 'Δραστηριότητες', value: candidate.activities, className: 'interviews-span-3' }, { label: en ? 'Notes (HR)' : 'Σημειώσεις (HR)', value: candidate.notes, className: 'interviews-span-3' },
          { label: en ? 'Consent (GDPR)' : 'Συναίνεση (GDPR)', value: candidate.consentGiven ? (en ? 'Given' : 'Δόθηκε') : (en ? 'Not given' : 'Δεν δόθηκε'), meta: [candidate.consentText, fmtStamp(candidate.consentAt, language)].filter(Boolean).join(' · ') }]} />
      </div>
    </RecordTabPanel>}
    {tab === 'education' && <RecordTabPanel title={en ? 'Education & languages' : 'Εκπαίδευση & γλώσσες'} actions={access.canManage && <Button variant="secondary" onClick={() => setDialog({ type: 'education' })}><Pencil size={15} />{en ? 'Edit' : 'Επεξεργασία'}</Button>}>
      <div className="record-view-stack">
        <RecordDetailsGrid fields={[{ label: en ? 'Secondary education' : 'Βασική εκπαίδευση', value: candidate.educationLevel }, { label: en ? 'IT skills' : 'Γνώσεις πληροφορικής', value: candidate.itSkills, className: 'interviews-span-2' }]} />
        <RegistryTable rows={candidate.education.map((row, index) => ({ ...row, id: index }))} columns={[{ key: 'level', label: en ? 'Level' : 'Επίπεδο' }, { key: 'school', label: en ? 'School / department' : 'Σχολή / τμήμα' }, { key: 'title', label: en ? 'Degree' : 'Πτυχίο' }, { key: 'year', label: en ? 'Year' : 'Έτος' }]}
          emptyTitle={en ? 'No degrees recorded' : 'Δεν καταγράφηκαν πτυχία'} renderRow={row => <><td>{row.level || '—'}</td><td><strong>{row.school || '—'}</strong></td><td>{row.title || '—'}{row.completed === false && <small>{en ? 'In progress' : 'Σε εξέλιξη'}</small>}</td><td className="nowrap-cell">{row.year || '—'}</td></>} />
        <RegistryTable rows={candidate.languages} rowKey={row => row.id || row.language} columns={[{ key: 'language', label: en ? 'Language' : 'Γλώσσα' }, { key: 'speaking', label: en ? 'Speaking' : 'Ομιλία' }, { key: 'reading', label: en ? 'Reading' : 'Ανάγνωση' }, { key: 'writing', label: en ? 'Writing' : 'Γραφή' }, { key: 'certificate', label: en ? 'Certificate' : 'Πιστοποιητικό' }]}
          emptyTitle={en ? 'No languages recorded' : 'Δεν καταγράφηκαν γλώσσες'} renderRow={row => <><td><strong>{languageLabel(row.language, language)}</strong></td><td>{levelLabel(row.speaking, language) || '—'}</td><td>{levelLabel(row.reading, language) || '—'}</td><td>{levelLabel(row.writing, language) || '—'}</td><td>{yesNo(row.certificate, language)}{row.certificateName && <small>{row.certificateName}</small>}</td></>} />
      </div>
    </RecordTabPanel>}
    {tab === 'employers' && <RecordTabPanel title={en ? 'Previous employers' : 'Προϋπηρεσία'} actions={access.canManage && <Button variant="secondary" onClick={() => setDialog({ type: 'employers' })}><Pencil size={15} />{en ? 'Edit' : 'Επεξεργασία'}</Button>}>
      <RegistryTable rows={[...candidate.employers].sort((a, b) => String(b.fromOn || '').localeCompare(String(a.fromOn || '')))} rowKey={row => row.id || row.employer} columns={[{ key: 'employer', label: en ? 'Employer' : 'Εργοδότης' }, { key: 'period', label: en ? 'Period' : 'Περίοδος' }, { key: 'position', label: en ? 'Position' : 'Θέση' }, { key: 'salary', label: en ? 'Salary' : 'Μισθός' }, { key: 'reason', label: en ? 'Reason for leaving' : 'Λόγος αποχώρησης' }]}
        emptyTitle={en ? 'No previous employers' : 'Χωρίς προϋπηρεσία'} renderRow={row => <><td><strong>{row.employer}</strong></td><td className="nowrap-cell">{fmtDay(row.fromOn)} – {row.toOn ? fmtDay(row.toOn) : (en ? 'today' : 'σήμερα')}</td><td>{row.jobTitle || '—'}</td><td className="nowrap-cell">{fmtMoney(row.salary, language)}</td><td>{row.leavingReason || '—'}</td></>} />
    </RecordTabPanel>}
    {tab === 'interviews' && <RecordTabPanel title={en ? 'Interviews' : 'Συνεντεύξεις'} subtitle={en ? 'Scheduled interviews and their evaluation by the panel.' : 'Οι προγραμματισμένες συνεντεύξεις και η αξιολόγησή τους από την επιτροπή.'}>
      <RecordMetricStrip items={[{ label: en ? 'Interviews' : 'Συνεντεύξεις', value: interviews.length, primary: true }, { label: en ? 'Scheduled' : 'Προγραμματισμένες', value: interviews.filter(item => item.status === 'scheduled').length }, { label: en ? 'Latest rating' : 'Τελευταία βαθμολογία', value: fmtRating(evaluation?.overallRating, language) }, { label: en ? 'Recommendation' : 'Πρόταση', value: outcomeLabel(evaluation?.outcome, language) || '—' }]} />
      <RegistryTable rows={interviews} rowKey={item => item.id} columns={[{ key: 'when', label: en ? 'When' : 'Πότε' }, { key: 'panel', label: en ? 'Panel' : 'Επιτροπή' }, { key: 'scores', label: en ? 'Scores' : 'Βαθμολογίες' }, { key: 'outcome', label: en ? 'Recommendation' : 'Πρόταση' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No interviews yet' : 'Δεν έχουν γίνει συνεντεύξεις'} emptyIcon={Users}
        emptyAction={access.canManage && !closed ? { label: en ? 'Schedule interview' : 'Προγραμματισμός συνέντευξης', icon: CalendarPlus, onClick: () => setDialog({ type: 'schedule', interview: newInterview(candidate.id) }) } : null}
        renderRow={item => <>
          <td className="nowrap-cell"><strong>{fmtStamp(item.scheduledAt, language) || fmtStamp(item.evaluatedAt, language) || '—'}</strong>{item.location && <small>{item.location}</small>}</td>
          <td>{(item.interviewers || []).map((member, index) => <small key={index}>{member.name} · {interviewerRoleLabel(member.role, language)}</small>)}{!(item.interviewers || []).length && '—'}</td>
          <td>{item.status === 'completed' ? <><StatusBadge tone={ratingTone(item.overallRating)}>{fmtRating(item.overallRating, language)}</StatusBadge><small>{CRITERIA.filter(([key]) => item.scores?.[key]).map(([key, el, enText]) => `${en ? enText : el}: ${item.scores[key]}`).join(' · ')}</small></> : '—'}</td>
          <td>{item.outcome ? <StatusBadge tone={outcomeTone(item.outcome)}>{outcomeLabel(item.outcome, language)}</StatusBadge> : '—'}{item.recommendation && <small className="interviews-clip" title={item.recommendation}>{item.recommendation}</small>}</td>
          <td><StatusBadge tone={item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'neutral' : 'warning'}>{interviewStatusLabel(item.status, language)}</StatusBadge></td>
          <td className="nowrap-cell"><span className="row-actions">
            {item.status === 'completed' && <ExportMenu compact {...reportExports(() => evaluationDocument(candidate, item, { language }), { onBlocked: blocked })} />}
            {access.canManage && item.status !== 'cancelled' && <IconButton size="sm" label={en ? 'Record evaluation' : 'Αξιολόγηση'} onClick={() => setDialog({ type: 'evaluate', interview: item })}><ClipboardCheck size={14} /></IconButton>}
            {access.canManage && item.status === 'scheduled' && <IconButton size="sm" tone="edit" label={en ? 'Edit interview' : 'Επεξεργασία συνέντευξης'} onClick={() => setDialog({ type: 'schedule', interview: item })}><Pencil size={14} /></IconButton>}
            {access.canManage && <IconButton size="sm" tone="danger" label={en ? 'Delete interview' : 'Διαγραφή συνέντευξης'} onClick={() => removeOne(item)}><Trash2 size={14} /></IconButton>}
          </span></td>
        </>} />
    </RecordTabPanel>}
    {tab === 'decision' && <RecordTabPanel title={en ? 'Decision' : 'Απόφαση'} subtitle={en ? 'Hire, reserve list or reject; «Hire» then creates or links the employee.' : 'Πρόσληψη, λίστα αναμονής ή απόρριψη· η «Πρόσληψη» δημιουργεί ή συνδέει τον εργαζόμενο.'}>
      <div className="record-view-stack">
        <RecordDetailsGrid fields={[{ label: en ? 'Status' : 'Κατάσταση', value: <CandidateStatusBadge status={candidate.status} language={language} /> }, { label: en ? 'Decision' : 'Απόφαση', value: decisionLabel(candidate.decision, language) }, { label: en ? 'Date · decided by' : 'Ημερομηνία · αποφάσισε', value: [fmtDay(candidate.decisionOn), candidate.decisionByName].filter(item => item && item !== '—').join(' · ') },
          { label: en ? 'Notes / reason' : 'Σημειώσεις / αιτιολογία', value: candidate.decisionNotes, className: 'interviews-span-3' },
          { label: en ? 'Salary offered' : 'Προτεινόμενος μισθός', value: fmtMoney(evaluation?.offeredSalary, language), meta: evaluation?.salaryExpectation ? `${en ? 'Asked' : 'Ζήτησε'} ${fmtMoney(evaluation.salaryExpectation, language)}` : '' }, { label: en ? 'Benefits' : 'Παροχές', value: evaluation?.benefits }, { label: en ? 'Available from' : 'Διαθέσιμος από', value: fmtDay(evaluation?.availableFrom) },
          { label: en ? 'Employee' : 'Εργαζόμενος', value: employee ? `${employee.lastName} ${employee.firstName} (${employee.id})` : candidate.employeeId ? (en ? 'Linked' : 'Συνδέθηκε') : '—' }]} />
        <div className="row-actions">
          {employee && <Button variant="secondary" onClick={() => navigate(`/employees/${encodeURIComponent(employee.id)}`)}><Users size={15} />{en ? 'Employee record' : 'Καρτέλα εργαζομένου'}</Button>}
          {canHireNow && candidate.status !== 'withdrawn' && <Button onClick={() => setDialog({ type: 'hire' })}><UserPlus size={15} />{en ? 'Hire' : 'Πρόσληψη'}</Button>}
        </div>
      </div>
    </RecordTabPanel>}
    {dialog?.type === 'candidate' && <CandidateDialog initial={candidate} organizationId={organizationId} positions={positionsOf(state.candidates)} onClose={close} onSaved={reload} />}
    {dialog?.type === 'education' && <EducationDialog {...common} />}
    {dialog?.type === 'employers' && <EmployersDialog {...common} />}
    {dialog?.type === 'schedule' && <ScheduleDialog {...common} initial={dialog.interview} employees={employees} />}
    {dialog?.type === 'evaluate' && <EvaluationDialog {...common} initial={dialog.interview} employees={employees} />}
    {dialog?.type === 'decide' && <DecisionDialog {...common} />}
    {dialog?.type === 'hire' && <HireDialog {...common} employees={employees} />}
  </EntityRecordShell></Page>
}
