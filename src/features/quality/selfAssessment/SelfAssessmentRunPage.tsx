import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, Send } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { SaveButton } from '../../../design-system/SaveButton'
import { Button } from '../../../design-system/Button'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { SectionHeader } from '../../../design-system/SectionHeader'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { RegistryEmptyState } from '../../../design-system/RegistryEmptyState'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry, printRegistry } from '../../../core/export/registryExports'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { AUDIT_RESULTS, resultLabel } from '../audits/auditStandards'
import { selfChapters, selfFigures, selfGaps, selfStatusLabel, selfStatusTone, type SelfRow } from './selfAssessmentModel'
import { saveSelfAnswers } from './selfAssessmentService'
import { useSelfAssessments } from './useSelfAssessments'
import { SelfAssessmentProgress } from './SelfAssessmentPanel'
import '../audits/audits.css'
import './selfAssessment.css'

const L = (en: boolean, el: string, english: string) => (en ? english : el)
const RESULT_SHORT: Record<string, string[]> = { yes: ['Ναι', 'Yes'], partial: ['Μερική', 'Partial'], no: ['Όχι', 'No'], na: ['Δ.Ε.', 'N/A'] }

// The department answers its self-assessment (Quality may too, before it closes). The progress
// bar counts the answered questions; «Submit» needs every one answered. Once submitted, the
// «Gaps» list (partial and nonconforming answers) is the preparation for the audit.
export function SelfAssessmentRunPage({ backTo = '/quality' }: { backTo?: string }) {
  const { id } = useParams()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const { goBack } = useContextualNavigation(backTo)
  const list = useSelfAssessments(tenant?.id)
  const item = list.items.find(entry => entry.id === id) || null
  const manager = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const [rows, setRows] = useState<SelfRow[]>([])
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (item) { setRows(item.checklist); setDirty(false) } }, [item?.id, item?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const editable = Boolean(item) && (item?.status === 'released' || (manager && item?.status !== 'closed'))
  const figures = useMemo(() => selfFigures(rows), [rows])
  const gaps = useMemo(() => selfGaps(rows), [rows])
  const chapters = useMemo(() => selfChapters(rows), [rows])
  const set = (rowId: string, patch: Partial<SelfRow>) => { setRows(current => current.map(row => (row.id === rowId ? { ...row, ...patch } : row))); setDirty(true) }
  const answers = () => rows.map(row => ({ id: row.id, answer: row.answer || '', note: row.note || '', evidence: row.evidence || '' }))
  async function save(submit: boolean) {
    if (!item || busy) return
    setBusy(true)
    try {
      await saveSelfAnswers(tenant?.id, { ...item, checklist: rows }, answers(), { submit })
      notify(submit ? L(en, 'Η αυτοαξιολόγηση υποβλήθηκε.', 'The self-assessment was submitted.') : L(en, 'Αποθηκεύτηκε.', 'Saved.'), 'success')
      await list.reload()
    } catch (error) {
      console.error(error)
      notify(String((error as { message?: unknown } | null)?.message || '').includes('INCOMPLETE') ? L(en, 'Απαντήστε σε όλες τις ερωτήσεις πριν την υποβολή.', 'Answer every question before submitting.') : L(en, 'Δεν αποθηκεύτηκε.', 'It could not be saved.'), 'error')
    } finally { setBusy(false) }
  }
  const gapsExport = () => ({ name: en ? 'self-assessment-gaps' : 'aftoaxiologisi-kena', headers: en ? ['Clause', 'Question', 'Answer', 'Critical', 'Note'] : ['Ρήτρα', 'Ερώτηση', 'Απάντηση', 'Κρίσιμη', 'Σημείωση'], rows: gaps.map(row => [row.clauseRef, row.item, resultLabel(row.answer, language), row.critical ? (en ? 'Yes' : 'Ναι') : '', row.note || '']) })
  const kind = L(en, 'Αυτοαξιολόγηση', 'Self-assessment')
  // Like every record of the Quality Center: the record header (back, title, status, export) and the record card below it.
  if (!item) return <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<ClipboardCheck size={19} />} eyebrow={kind} title={kind} tabs={[]} activeTab="" onTabChange={() => {}} onBack={goBack}>
    <div className="record-section">{list.loading ? null : list.error ? <RegistryEmptyState error onRetry={list.reload} /> : <RegistryEmptyState icon={ClipboardCheck} title={L(en, 'Δεν βρέθηκε η αυτοαξιολόγηση', 'Self-assessment not found')} text={L(en, 'Μπορεί να έχει αποσυρθεί ή να μην έχει ενεργοποιηθεί ακόμα για το τμήμα σας.', 'It may have been withdrawn or not yet released to your department.')} />}</div>
  </EntityRecordShell></Page>
  return <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<ClipboardCheck size={19} />} eyebrow={kind} title={item.title} subtitle={[item.departmentName, item.dueOn && `${L(en, 'προθεσμία', 'due')} ${formatDay(item.dueOn, language)}`].filter(Boolean).join(' · ')}
    status={<StatusBadge tone={selfStatusTone(item.status)}>{selfStatusLabel(item.status, language)}</StatusBadge>}
    headerActions={<>
      {editable && <SaveButton variant="secondary" loading={busy} disabled={busy || !dirty} onClick={() => save(false)}>{L(en, 'Αποθήκευση', 'Save')}</SaveButton>}
      {editable && item.status === 'released' && <Button disabled={busy || figures.answered < figures.total} title={figures.answered < figures.total ? L(en, 'Απαντήστε σε όλες τις ερωτήσεις', 'Answer every question') : undefined} onClick={() => save(true)}><Send size={15} />{L(en, 'Υποβολή', 'Submit')}</Button>}
      <ExportMenu ownPrint disabled={!gaps.length} onPrint={() => printRegistry(gapsExport(), { language, kind, title: item.title })} onExcel={() => exportRegistry(gapsExport())} /></>}
    tabs={[]} activeTab="" onTabChange={() => {}} onBack={goBack}>
    <div className="record-section audit-run self-run">
      <p className="quality-summary-line quality-record-line">
        <SelfAssessmentProgress answered={figures.answered} total={figures.total} label={L(en, 'Πρόοδος', 'Progress')} />
        <span>{L(en, 'Βαθμός συμμόρφωσης', 'Compliance score')} <b>{figures.score == null ? '—' : `${figures.score}%`}</b></span>
        <span className={gaps.length ? 'is-late' : undefined}><b>{gaps.length}</b> {L(en, 'κενά', 'gaps')}</span>
        {figures.criticalFailed > 0 && <span className="is-late"><b>{figures.criticalFailed}</b> {L(en, 'κρίσιμα', 'critical')}</span>}
      </p>
      {item.status === 'submitted' && gaps.length > 0 && <div className="self-gaps"><SectionHeader title={L(en, `Κενά προς διόρθωση πριν την επιθεώρηση ${gaps.length}`, `Gaps to fix before the audit ${gaps.length}`)} subtitle={L(en, 'Οι κρίσιμες ερωτήσεις πρώτες.', 'Critical questions first.')} />
        <ul>{gaps.slice(0, 12).map(row => <li key={row.id}><StatusBadge tone={row.answer === 'no' ? 'danger' : 'warning'}>{resultLabel(row.answer, language)}</StatusBadge> {row.critical && <strong>{L(en, 'Κρίσιμη · ', 'Critical · ')}</strong>}<span>{row.clauseRef ? `${row.clauseRef} · ` : ''}{row.item}</span></li>)}{gaps.length > 12 && <li className="self-gaps-more">+{gaps.length - 12}</li>}</ul></div>}
      {rows.length > 0 && <ol className="audit-questions">
        {chapters.map(chapter => chapter.rows.map((row, index) => <li key={row.id} className={`audit-question is-${row.answer || 'open'}`}>
          {index === 0 && <h4 className="audit-chapter-title">{[chapter.ref, chapter.title].filter(Boolean).join(' · ') || L(en, 'Ερωτήσεις', 'Questions')} · {chapter.rows.filter(entry => entry.answer).length}/{chapter.rows.length}</h4>}
          <div className="audit-question-head">{row.clauseRef && <span className="audit-clause">{row.clauseRef}</span>}<strong>{row.item}</strong>{row.critical && <StatusBadge tone="danger">{L(en, 'Κρίσιμη', 'Critical')}</StatusBadge>}</div>
          <div className="audit-answer-buttons" role="radiogroup" aria-label={row.item}>{AUDIT_RESULTS.map(option => <button key={option.value} type="button" role="radio" disabled={!editable} aria-checked={row.answer === option.value} title={option.label[en ? 1 : 0]} className={`is-${option.tone}${row.answer === option.value ? ' is-on' : ''}`} onClick={() => set(row.id, { answer: row.answer === option.value ? '' : option.value })}>{RESULT_SHORT[option.value][en ? 1 : 0]}</button>)}</div>
          {(row.guidance || row.evidenceRequired) && <p className="audit-question-guide">{row.guidance && <span>{row.guidance}</span>}{row.evidenceRequired && <span><b>{L(en, 'Αποδεικτικό:', 'Evidence:')}</b> {row.evidenceRequired}</span>}</p>}
          {(row.answer === 'partial' || row.answer === 'no' || row.note) && <input className="self-note" value={row.note || ''} disabled={!editable} maxLength={2000} placeholder={L(en, 'Σχόλιο: τι λείπει ή τι θα γίνει', 'Comment: what is missing or what will be done')} aria-label={L(en, 'Σχόλιο', 'Comment')} onChange={event => set(row.id, { note: event.target.value })} />}
        </li>))}
      </ol>}
      {!rows.length && <RegistryEmptyState icon={CheckCircle2} title={L(en, 'Δεν υπάρχουν ερωτήσεις', 'No questions')} text={L(en, 'Το ερωτηματολόγιο δεν έχει ερωτήσεις για αυτό το τμήμα.', 'The questionnaire has no questions for this department.')} />}
    </div>
  </EntityRecordShell></Page>
}
