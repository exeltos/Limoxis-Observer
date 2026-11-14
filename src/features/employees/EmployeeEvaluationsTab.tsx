import './employeesScreens.css'
import { useState } from 'react'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { loadSnapshot } from '../../core/data/repository'
import { PERFORMANCE_EVALUATION_QUESTIONNAIRE } from '../management/QuestionnairesPanel'
import { Plus } from 'lucide-react'
import { downloadCertificatePdf } from '../training/trainingCertificate'
import { ActionButton } from '../../design-system/ActionButton'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { useRecordTabExport, type RecordTabProps } from './employeeTabExport'
import {
  loadEvaluationsAsync,
  createEmployeeEvaluationAsync,
  updateEmployeeEvaluationWorkflowAsync,
} from './employeeSubRecordsService'
import { acknowledgementComplete, nextEvaluationStep } from './employeeEvaluationWorkflow'
import {
  SectionTitle,
  Empty,
  State,
  Pager,
  RegistryFilter,
  useRegistryRows,
  statusClass,
} from './employeeRecordShared'
import { trainingAnswerText } from './EmployeeTrainingTab'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import { hospitalToday } from '../../core/dates/hospitalDate'
import type { EmployeeEvaluation, EmployeeEvaluationDraft, EvaluationCriterion } from './employeeTypes'

// A question of the performance questionnaire (Management > Questionnaires, or the built-in one).
type PerformanceQuestion = { id?: string, label?: string, labelEl?: string, labelEn?: string }

// Performance evaluations tab of the employee record, with its HR approval workflow.

// The managed-questionnaire system (QuestionnairesPanel) stores a single
// `label` per question, no English counterpart — every other piece of text
// in this file is carefully en/el branched, so a raw Greek label here would
// stand out. This built-in template's ids are stable, so translate by id;
// an org-customized questionnaire (different ids) falls back to whatever
// label the admin typed, same as before.
const PERFORMANCE_CRITERIA_LABELS_EN: Record<string, string> = {
  'professional-competence': 'Professional competence',
  'quality-accuracy': 'Quality & accuracy of work',
  'procedures-protocols': 'Adherence to procedures / protocols',
  'patient-safety-ipc': 'Patient safety & infection prevention',
  teamwork: 'Teamwork / collaboration',
  communication: 'Communication',
  responsibility: 'Responsibility / reliability',
  'professional-development': 'Professional development',
}
const criterionName = (item: EvaluationCriterion, en: boolean) => (en && PERFORMANCE_CRITERIA_LABELS_EN[item.id ?? '']) || item.name

export function EmployeeEvaluationsTab({
  employee,
  language,
  fmt,
  organizationId,
  canCreate = false,
  canHrApprove = false,
  canAdminApprove = false,
  selfReadOnly = false,
  onExportItems,
}: RecordTabProps & {
  fmt: (value: unknown) => string
  organizationId: string | null | undefined
  canCreate?: boolean
  canHrApprove?: boolean
  canAdminApprove?: boolean
  selfReadOnly?: boolean
  // Passed by the record page; the tab words its own labels.
  t?: (key: string) => string
}) {
  const state = useEmployeeSubRecords(
    loadEvaluationsAsync,
    organizationId,
    employee.dbId,
    employee.id,
  )
  const { notify, notifyError } = useFeedback()
  const [selected, setSelected] = useState<EmployeeEvaluation | null>(null),
    [creating, setCreating] = useState(false),
    [saving, setSaving] = useState(false),
    [ackOpen, setAckOpen] = useState(false),
    [ackAgreement, setAckAgreement] = useState(''),
    [ackComment, setAckComment] = useState('')
  const registry = useRegistryRows(state.data),
    paging = registry.paging,
    en = language === 'en'
  const managedQuestionnaires = loadSnapshot('management_questionnaires_v1', null)
  const performanceTemplate =
    (Array.isArray(managedQuestionnaires)
      ? managedQuestionnaires.find(x => x.id === 'employee-performance-evaluation')
      : null) || PERFORMANCE_EVALUATION_QUESTIONNAIRE
  const [draft, setDraft] = useState<EmployeeEvaluationDraft & { criteria: EvaluationCriterion[] }>({
    period: '',
    date: hospitalToday(),
    notes: '',
    criteria: performanceTemplate.questions.map((q: PerformanceQuestion, index: number) => ({
      id: q.id || String(index + 1),
      name: q.label || q.labelEl || q.labelEn,
      score: 3,
      weight: 1,
    })),
  })
  const nextStep = nextEvaluationStep(selected, {
    canCreate,
    canHrApprove,
    canAdminApprove,
    selfReadOnly,
  })
  const statusLabel = (v: string) =>
    ({
      draft: en ? 'Draft' : 'Πρόχειρη',
      submitted: en ? 'Submitted' : 'Υποβλήθηκε',
      employee_acknowledged: en ? 'Employee acknowledged' : 'Έλαβε γνώση',
      hr_approved: en ? 'HR approved' : 'Εγκρίθηκε από HR',
      finalized: en ? 'Finalized' : 'Οριστικοποιημένη',
      passed: en ? 'Passed' : 'Επιτυχής',
      failed: en ? 'Retraining required' : 'Απαιτείται επανεκπαίδευση',
      reviewed: en ? 'Reviewed' : 'Ελέγχθηκε',
      pending_review: en ? 'To be reviewed' : 'Προς έλεγχο',
    } as Record<string, string>)[v] ||
    v ||
    '—'
  async function create() {
    setSaving(true)
    try {
      await createEmployeeEvaluationAsync(organizationId, employee.dbId, draft)
      signalDemoStep('performance_evaluation', 'create')
      notify(en ? 'Evaluation saved.' : 'Η αξιολόγηση αποθηκεύτηκε.', 'success')
      setCreating(false)
      await state.reload()
    } catch (error) {
      notifyError(
        error,
        en ? 'Could not save evaluation.' : 'Δεν ήταν δυνατή η αποθήκευση της αξιολόγησης.',
      )
    } finally {
      setSaving(false)
    }
  }
  async function action(name: string, comment = '', agreement = '') {
    if (!selected) return
    setSaving(true)
    try {
      await updateEmployeeEvaluationWorkflowAsync(organizationId, employee.dbId, selected.id, {
        action: name,
        comment,
        agreement,
      })
      const rows = await state.reload()
      setSelected(rows.find(row => row.id === selected.id) || null)
    } finally {
      setSaving(false)
    }
  }
  const scoreText = (row: EmployeeEvaluation) => (row.overallScore != null ? `${row.overallScore.toFixed(2)} / 5` : row.score != null ? `${row.score}%` : row.source === 'training' ? '' : (en ? row.resultEn : row.resultEl) || '')
  const exportDialog = useRecordTabExport({
    onExportItems, id: 'evaluations', label: { el: 'Αξιολογήσεις', en: 'Evaluations' }, employee, language, count: registry.filtered.length,
    table: () => ({ headers: en ? ['Evaluation', 'Period', 'Evaluator', 'Date', 'Score', 'Status'] : ['Αξιολόγηση', 'Περίοδος', 'Αξιολογητής', 'Ημερομηνία', 'Βαθμολογία', 'Κατάσταση'], rows: registry.filtered.map(row => [en ? row.titleEn : row.titleEl, row.period || '', row.source === 'training' ? (en ? 'Training' : 'Εκπαίδευση') : row.evaluatorName || '', fmt(row.date), scoreText(row), statusLabel(row.status)]) }),
  })
  return (
    <section className="record-section record-secondary-registry">
      {exportDialog}
      <SectionTitle
        title={en ? 'Evaluations' : 'Αξιολογήσεις'}
        subtitle={
          en
            ? 'Performance evaluations and training knowledge assessments.'
            : 'Αξιολογήσεις απόδοσης και αξιολογήσεις γνώσεων από την Εκπαίδευση.'
        }
        action={
          canCreate && (
            <ActionButton
              tone="primary"
              label={en ? 'New evaluation' : 'Νέα αξιολόγηση'}
              onClick={() => setCreating(true)}
            >
              <Plus size={16} />
              <span>{en ? 'New evaluation' : 'Νέα αξιολόγηση'}</span>
            </ActionButton>
          )
        }
      />
      <State {...state} language={language} onRetry={state.reload} />
      {!state.loading && !state.error && (
        <RegistryFilter
          query={registry.query}
          setQuery={registry.setQuery}
          language={language}
          count={registry.filtered.length}
        />
      )}
      {!state.loading &&
        !state.error &&
        (registry.filtered.length ? (
          <>
            <div className="scroll-table">
              <table className="data-table sticky-table record-table-clickable">
                <thead>
                  <tr>
                    <th>{en ? 'Evaluation' : 'Αξιολόγηση'}</th>
                    <th>{en ? 'Period' : 'Περίοδος'}</th>
                    <th>{en ? 'Evaluator' : 'Αξιολογητής'}</th>
                    <th>{en ? 'Date' : 'Ημερομηνία'}</th>
                    <th>{en ? 'Score' : 'Βαθμολογία'}</th>
                    <th>{en ? 'Status' : 'Κατάσταση'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paging.paged.map(row => (
                    <tr key={row.id} tabIndex={0} onClick={() => setSelected(row)}>
                      <td>
                        <strong title={en ? row.titleEn : row.titleEl}>
                          {en ? row.titleEn : row.titleEl}
                        </strong>
                      </td>
                      <td>{row.period || '—'}</td>
                      <td>
                        {row.source === 'training'
                          ? en
                            ? 'Training'
                            : 'Εκπαίδευση'
                          : row.evaluatorName || '—'}
                      </td>
                      <td>{fmt(row.date)}</td>
                      <td>
                        {row.overallScore != null
                          ? `${row.overallScore.toFixed(2)} / 5`
                          : row.score != null
                            ? `${row.score}%`
                            : row.source === 'training' ? '—' : (en ? row.resultEn : row.resultEl) || '—'}
                      </td>
                      <td>
                        <span className={`status-badge ${statusClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paging={paging} total={registry.filtered.length} language={language} />
          </>
        ) : (
          <Empty language={language} />
        ))}
      {creating && (
        <ObserverDialog
          width="wide"
          eyebrow={en ? 'Performance evaluation' : 'Αξιολόγηση απόδοσης'}
          title={en ? 'New employee evaluation' : 'Νέα αξιολόγηση εργαζομένου'}
          onClose={() => setCreating(false)}
          footer={
            <div className="dialog-actions">
              <Button onClick={create} disabled={saving || !draft.period}>
                {en ? 'Save' : 'Αποθήκευση'}
              </Button>
            </div>
          }
        >
          <div className="entry-grid">
            <label>
              <span>{en ? 'Evaluation period' : 'Περίοδος αξιολόγησης'} *</span>
              <input
                value={draft.period}
                onChange={e => setDraft(v => ({ ...v, period: e.target.value }))}
                placeholder="2026"
              />
            </label>
            <ManualDateField
              label={en ? 'Evaluation date' : 'Ημερομηνία αξιολόγησης'}
              value={draft.date}
              onChange={value => setDraft(v => ({ ...v, date: value }))}
            />
          </div>
          <div className="evaluation-scale-grid">
            {[
              [1, en ? 'Unsatisfactory' : 'Ανεπαρκής'],
              [2, en ? 'Needs improvement' : 'Χρειάζεται βελτίωση'],
              [3, en ? 'Meets requirements' : 'Πλήρως επαρκής'],
              [4, en ? 'Exceeds requirements' : 'Υπερβαίνει τις απαιτήσεις'],
              [5, en ? 'Outstanding' : 'Εξαιρετική επίδοση'],
            ].map(([n, label]) => (
              <div key={n}>
                <strong>{n}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="evaluation-criteria evaluation-criteria-edit">
            {draft.criteria.map((item, index: number) => (
              <div className="evaluation-criterion" key={item.id}>
                <strong>{criterionName(item, en)}</strong>
                <div className="evaluation-rating">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      type="button"
                      key={n}
                      className={item.score === n ? 'is-selected' : ''}
                      aria-pressed={item.score === n}
                      onClick={() =>
                        setDraft(v => ({
                          ...v,
                          criteria: v.criteria.map((x, i: number) =>
                            i === index ? { ...x, score: n } : x,
                          ),
                        }))
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <label className="entry-field">
            <span>{en ? 'Manager comments' : 'Σχόλια προϊσταμένου'}</span>
            <textarea
              value={draft.notes}
              onChange={e => setDraft(v => ({ ...v, notes: e.target.value }))}
            />
          </label>
        </ObserverDialog>
      )}
      {selected && (
        <ObserverDialog
          width="wide"
          eyebrow={en ? 'Employee evaluation' : 'Αξιολόγηση εργαζομένου'}
          title={en ? selected.titleEn : selected.titleEl}
          subtitle={[selected.period, fmt(selected.date)].filter(part => part && part !== '—').join(' · ')}
          onClose={() => setSelected(null)}
        >
          {selected.source === 'training' && (
            <div className="training-assessment-review">
              <div className="training-assessment-summary">
                <div>
                  <span className="eyebrow">
                    {en ? 'KNOWLEDGE ASSESSMENT' : 'ΑΞΙΟΛΟΓΗΣΗ ΓΝΩΣΕΩΝ'}
                  </span>
                  <strong>{selected.program?.title || selected.titleEl}</strong>
                  <small>{fmt(selected.date)}</small>
                </div>
                <div className="training-assessment-score">
                  {selected.score != null && <strong>{`${selected.score}%`}</strong>}
                  <span>{statusLabel(selected.status)}</span>
                </div>
              </div>
              {(selected.assessmentQuestions || []).length > 0 ? <section className="training-review-section">
                <div className="training-review-heading">
                  <div>
                    <span className="eyebrow">{en ? 'ASSESSMENT FORM' : 'ΦΟΡΜΑ ΑΞΙΟΛΟΓΗΣΗΣ'}</span>
                    <h3>
                      {en ? 'Questions & submitted answers' : 'Ερωτήσεις & υποβληθείσες απαντήσεις'}
                    </h3>
                    <p>
                      {en
                        ? 'The answers submitted by the employee are shown below.'
                        : 'Παρακάτω εμφανίζονται οι απαντήσεις που υπέβαλε ο εργαζόμενος.'}
                    </p>
                  </div>
                </div>
                <div className="training-answer-list">
                  {(selected.assessmentQuestions || []).map((question, index: number) => (
                    <article className="training-answer-card" key={question.id || index}>
                      <div className="training-answer-question">
                        <span className="training-answer-index">{index + 1}</span>
                        <strong>{question.text || '—'}</strong>
                      </div>
                      <div className="training-answer-value">
                        <span className="training-answer-label">{en ? 'Answer' : 'Απάντηση'}</span>
                        <strong>
                          {trainingAnswerText(
                            question,
                            selected.assessmentAnswers?.[question.id as string],
                            en,
                          )}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section> : <p className="training-assessment-note">{en ? 'The questions and answers of this assessment were not kept (imported from the earlier system).' : 'Οι ερωτήσεις και οι απαντήσεις αυτής της αξιολόγησης δεν έχουν διατηρηθεί (μεταφέρθηκε από το προηγούμενο σύστημα).'}</p>}
              {selected.certificate && (
                <div className="training-review-certificate-row">
                  <div>
                    <strong>{en ? 'Training certificate' : 'Πιστοποιητικό εκπαίδευσης'}</strong>
                    <small>
                      {en
                        ? 'Available after successful completion.'
                        : 'Διαθέσιμο μετά την επιτυχή ολοκλήρωση.'}
                    </small>
                  </div>
                  <ExportMenu
                    onPrint={() =>
                      downloadCertificatePdf({
                        certificate: selected.certificate,
                        program: selected.program,
                        participantName:
                          [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
                          employee.id,
                        en,
                      })
                    }
                    onPdf={() =>
                      downloadCertificatePdf({
                        certificate: selected.certificate,
                        program: selected.program,
                        participantName:
                          [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
                          employee.id,
                        en,
                        pdf: true,
                      })
                    }
                  />
                </div>
              )}
            </div>
          )}
          {selected.source !== 'training' && (
            <div className="performance-review">
              <div className="performance-review-summary">
                <div className="performance-review-person">
                  <span className="eyebrow">
                    {en ? 'SUPERVISOR / EVALUATOR' : 'ΠΡΟΪΣΤΑΜΕΝΟΣ / ΑΞΙΟΛΟΓΗΤΗΣ'}
                  </span>
                  <strong>{selected.evaluatorName || '—'}</strong>
                  <small>
                    {en ? 'Evaluation period' : 'Περίοδος αξιολόγησης'}: {selected.period || '—'} ·{' '}
                    {fmt(selected.date)}
                  </small>
                </div>
                <div className="performance-review-score">
                  <span>{en ? 'Overall score' : 'Συνολική βαθμολογία'}</span>
                  <strong>
                    {selected.overallScore != null ? selected.overallScore.toFixed(2) : '—'}{' '}
                    <small>/ 5</small>
                  </strong>
                  <em>{statusLabel(selected.status)}</em>
                </div>
              </div>
              <section className="performance-review-section">
                <div className="performance-review-section-head">
                  <div>
                    <span className="eyebrow">
                      {en ? 'PERFORMANCE CRITERIA' : 'ΚΡΙΤΗΡΙΑ ΑΠΟΔΟΣΗΣ'}
                    </span>
                    <h3>{en ? 'Evaluation results' : 'Αποτελέσματα αξιολόγησης'}</h3>
                  </div>
                </div>
                <div className="performance-criteria-grid">
                  {(selected.criteria || []).map(item => (
                    <div className="performance-criterion" key={item.id || item.name}>
                      <div>
                        <strong>{criterionName(item, en)}</strong>
                        <div className="performance-score-track" aria-label={`${item.score} / 5`}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <span key={n} className={n <= Number(item.score) ? 'is-filled' : ''} />
                          ))}
                        </div>
                      </div>
                      <span className="performance-criterion-score">
                        {item.score}
                        <small>/5</small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              {selected.notes && (
                <div className="performance-review-note">
                  <span>{en ? 'Supervisor comments' : 'Σχόλια προϊσταμένου'}</span>
                  <p>{selected.notes}</p>
                </div>
              )}
              {selected.employeeAgreement && (
                <div
                  className={`performance-review-note employee-position ${selected.employeeAgreement === 'disagree' ? 'is-disagree' : 'is-agree'}`}
                >
                  <span>{en ? 'Employee position' : 'Θέση εργαζομένου'}</span>
                  <strong>
                    {selected.employeeAgreement === 'agree'
                      ? en
                        ? 'Agrees with the evaluation'
                        : 'Συμφωνεί με την αξιολόγηση'
                      : en
                        ? 'Disagrees with the evaluation'
                        : 'Διαφωνεί με την αξιολόγηση'}
                  </strong>
                  {selected.employeeComment && <p>{selected.employeeComment}</p>}
                </div>
              )}
            </div>
          )}
          <div className="dialog-actions">
            {nextStep === 'submit' && (
              <Button onClick={() => action('submit')} disabled={saving}>
                {en ? 'Submit to employee' : 'Υποβολή στον εργαζόμενο'}
              </Button>
            )}
            {nextStep === 'acknowledge' && (
              <Button
                onClick={() => {
                  setAckAgreement('')
                  setAckComment('')
                  setAckOpen(true)
                }}
                disabled={saving}
              >
                {en ? 'Acknowledge receipt' : 'Έλαβα γνώση'}
              </Button>
            )}
            {nextStep === 'hrApprove' && (
              <Button onClick={() => action('hrApprove')} disabled={saving}>
                {en ? 'HR approval' : 'Έγκριση HR'}
              </Button>
            )}
            {nextStep === 'finalize' && (
              <Button onClick={() => action('finalize')} disabled={saving}>
                {en ? 'Final approval' : 'Τελική έγκριση'}
              </Button>
            )}
          </div>
        </ObserverDialog>
      )}
      {ackOpen && (
        <ObserverDialog
          width="medium"
          eyebrow={en ? 'Employee acknowledgement' : 'Γνώση εργαζομένου'}
          title={en ? 'Acknowledge evaluation' : 'Έλαβα γνώση της αξιολόγησης'}
          onClose={() => setAckOpen(false)}
          footer={
            <div className="dialog-actions">
              <Button
                disabled={saving || !acknowledgementComplete(ackAgreement, ackComment)}
                onClick={async () => {
                  await action('acknowledge', ackComment, ackAgreement)
                  setAckOpen(false)
                }}
              >
                {en ? 'Confirm' : 'Επιβεβαίωση'}
              </Button>
            </div>
          }
        >
          <div className="evaluation-acknowledgement">
            <p>
              {en
                ? 'Your acknowledgement does not change the supervisor score. Select whether you agree or disagree with the evaluation.'
                : 'Η δήλωση γνώσης δεν μεταβάλλει τη βαθμολογία του προϊσταμένου. Επιλέξτε αν συμφωνείτε ή διαφωνείτε με την αξιολόγηση.'}
            </p>
            <label className="evaluation-ack-choice">
              <input
                type="radio"
                name="evaluation-agreement"
                value="agree"
                checked={ackAgreement === 'agree'}
                onChange={() => setAckAgreement('agree')}
              />
              <span>
                <strong>{en ? 'I agree' : 'Συμφωνώ'}</strong>
                <small>{en ? 'I agree with the evaluation.' : 'Συμφωνώ με την αξιολόγηση.'}</small>
              </span>
            </label>
            <label className="evaluation-ack-choice">
              <input
                type="radio"
                name="evaluation-agreement"
                value="disagree"
                checked={ackAgreement === 'disagree'}
                onChange={() => setAckAgreement('disagree')}
              />
              <span>
                <strong>{en ? 'I disagree' : 'Διαφωνώ'}</strong>
                <small>
                  {en
                    ? 'My disagreement will be recorded for HR and the administrator.'
                    : 'Η διαφωνία μου θα καταγραφεί για το HR και τον διαχειριστή.'}
                </small>
              </span>
            </label>
            <label className="entry-field">
              <span>
                {en ? 'Employee comment' : 'Σχόλιο εργαζομένου'}
                {ackAgreement === 'disagree' ? ' *' : ''}
              </span>
              <textarea
                value={ackComment}
                onChange={e => setAckComment(e.target.value)}
                placeholder={
                  en
                    ? 'Optional when you agree; required when you disagree.'
                    : 'Προαιρετικό όταν συμφωνείτε · υποχρεωτικό όταν διαφωνείτε.'
                }
              />
            </label>
          </div>
        </ObserverDialog>
      )}
    </section>
  )
}
