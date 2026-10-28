import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, FileWarning, Gauge, Save, Send } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { BackButton } from '../../../design-system/BackButton'
import { Button } from '../../../design-system/Button'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { KpiFigures } from '../../../design-system/KpiCard'
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
import { selfChapters, selfFigures, selfGaps, selfStatusLabel, selfStatusTone } from './selfAssessmentModel'
import { saveSelfAnswers } from './selfAssessmentService'
import { useSelfAssessments } from './useSelfAssessments'
import { SelfAssessmentProgress } from './SelfAssessmentPanel'
import './selfAssessment.css'

const L = (en, el, english) => (en ? english : el)

// The department answers its self-assessment (Quality may too, before it closes). The progress
// bar counts the answered questions; «Submit» needs every one answered. Once submitted, the
// «Gaps» list (partial and nonconforming answers) is the preparation for the audit.
export function SelfAssessmentRunPage({ backTo = '/quality' }) {
  const { id } = useParams()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const { goBack } = useContextualNavigation(backTo)
  const list = useSelfAssessments(tenant?.id)
  const item = list.items.find(entry => entry.id === id) || null
  const manager = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (item) { setRows(item.checklist); setDirty(false) } }, [item?.id, item?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const editable = Boolean(item) && (item.status === 'released' || (manager && item.status !== 'closed'))
  const figures = useMemo(() => selfFigures(rows), [rows])
  const gaps = useMemo(() => selfGaps(rows), [rows])
  const chapters = useMemo(() => selfChapters(rows), [rows])
  const set = (rowId, patch) => { setRows(current => current.map(row => (row.id === rowId ? { ...row, ...patch } : row))); setDirty(true) }
  const answers = () => rows.map(row => ({ id: row.id, answer: row.answer || '', note: row.note || '', evidence: row.evidence || '' }))
  async function save(submit) {
    if (!item || busy) return
    setBusy(true)
    try {
      await saveSelfAnswers(tenant?.id, { ...item, checklist: rows }, answers(), { submit })
      notify(submit ? L(en, 'Η αυτοαξιολόγηση υποβλήθηκε.', 'The self-assessment was submitted.') : L(en, 'Αποθηκεύτηκε.', 'Saved.'), 'success')
      await list.reload()
    } catch (error) {
      console.error(error)
      notify(String(error?.message || '').includes('INCOMPLETE') ? L(en, 'Απαντήστε σε όλες τις ερωτήσεις πριν την υποβολή.', 'Answer every question before submitting.') : L(en, 'Δεν αποθηκεύτηκε.', 'It could not be saved.'), 'error')
    } finally { setBusy(false) }
  }
  const gapsExport = () => ({ name: en ? 'self-assessment-gaps' : 'aftoaxiologisi-kena', headers: en ? ['Clause', 'Question', 'Answer', 'Critical', 'Note'] : ['Ρήτρα', 'Ερώτηση', 'Απάντηση', 'Κρίσιμη', 'Σημείωση'], rows: gaps.map(row => [row.clauseRef, row.item, resultLabel(row.answer, language), row.critical ? (en ? 'Yes' : 'Ναι') : '', row.note || '']) })
  if (!item) return <Page fill title={L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} navigation={<BackButton onClick={goBack} label={L(en, 'Πίσω', 'Back')} />}>
    {list.loading ? null : <RegistryEmptyState icon={ClipboardCheck} title={L(en, 'Δεν βρέθηκε η αυτοαξιολόγηση', 'Self-assessment not found')} text={L(en, 'Μπορεί να έχει αποσυρθεί ή να μην έχει ενεργοποιηθεί ακόμα για το τμήμα σας.', 'It may have been withdrawn or not yet released to your department.')} />}
  </Page>
  const cards = [
    { key: 'answered', icon: ClipboardCheck, value: `${figures.answered}/${figures.total}`, label: L(en, 'Απαντήθηκαν', 'Answered'), hint: `${figures.pct}%` },
    { key: 'score', icon: Gauge, value: figures.score == null ? null : figures.score, unit: '%', label: L(en, 'Βαθμός συμμόρφωσης', 'Compliance score') },
    { key: 'gaps', icon: FileWarning, value: gaps.length, label: L(en, 'Κενά', 'Gaps'), tone: 'warning', hint: figures.criticalFailed ? L(en, `${figures.criticalFailed} κρίσιμα`, `${figures.criticalFailed} critical`) : null },
  ]
  return <Page fill className="self-run-page" title={item.title} subtitle={[item.departmentName, item.dueOn && `${L(en, 'προθεσμία', 'due')} ${formatDay(item.dueOn, language)}`].filter(Boolean).join(' · ')}
    navigation={<BackButton onClick={goBack} label={L(en, 'Πίσω', 'Back')} />}
    actions={<div className="row-actions"><StatusBadge tone={selfStatusTone(item.status)}>{selfStatusLabel(item.status, language)}</StatusBadge>
      <ExportMenu disabled={!gaps.length} onPrint={() => printRegistry(gapsExport(), { language, kind: L(en, 'Αυτοαξιολόγηση', 'Self-assessment'), title: item.title })} onExcel={() => exportRegistry(gapsExport())} />
      {editable && <Button variant="secondary" disabled={busy || !dirty} onClick={() => save(false)}><Save size={15} />{L(en, 'Αποθήκευση', 'Save')}</Button>}
      {editable && item.status === 'released' && <Button disabled={busy || figures.answered < figures.total} title={figures.answered < figures.total ? L(en, 'Απαντήστε σε όλες τις ερωτήσεις', 'Answer every question') : undefined} onClick={() => save(true)}><Send size={15} />{L(en, 'Υποβολή', 'Submit')}</Button>}</div>}>
    <KpiFigures label={L(en, 'Αυτοαξιολόγηση', 'Self-assessment')} figures={cards} />
    <section className="surface registry-workspace workspace-column workspace-fill self-run">
      <SelfAssessmentProgress answered={figures.answered} total={figures.total} label={L(en, 'Πρόοδος', 'Progress')} />
      {item.status === 'submitted' && gaps.length > 0 && <div className="self-gaps"><SectionHeader title={L(en, `Κενά προς διόρθωση πριν την επιθεώρηση ${gaps.length}`, `Gaps to fix before the audit ${gaps.length}`)} subtitle={L(en, 'Οι κρίσιμες ερωτήσεις πρώτες.', 'Critical questions first.')} />
        <ul>{gaps.slice(0, 12).map(row => <li key={row.id}><StatusBadge tone={row.answer === 'no' ? 'danger' : 'warning'}>{resultLabel(row.answer, language)}</StatusBadge> {row.critical && <strong>{L(en, 'Κρίσιμη · ', 'Critical · ')}</strong>}<span>{row.clauseRef ? `${row.clauseRef} · ` : ''}{row.item}</span></li>)}{gaps.length > 12 && <li className="self-gaps-more">+{gaps.length - 12}</li>}</ul></div>}
      {chapters.map(chapter => <div className="self-chapter" key={chapter.ref || 'none'}>
        <h3>{[chapter.ref, chapter.title].filter(Boolean).join(' · ') || L(en, 'Ερωτήσεις', 'Questions')} <small>{chapter.rows.filter(row => row.answer).length}/{chapter.rows.length}</small></h3>
        {chapter.rows.map(row => <div className="self-question" key={row.id}>
          <div className="self-question-text"><span>{row.clauseRef && <small>{row.clauseRef}</small>}{row.item}{row.critical && <StatusBadge tone="danger">{L(en, 'Κρίσιμη', 'Critical')}</StatusBadge>}</span>
            {(row.guidance || row.evidenceRequired) && <small>{[row.guidance, row.evidenceRequired && `${L(en, 'Αποδεικτικό', 'Evidence')}: ${row.evidenceRequired}`].filter(Boolean).join(' · ')}</small>}</div>
          <div className="self-answers" role="group" aria-label={row.item}>{AUDIT_RESULTS.map(option => <button key={option.value} type="button" disabled={!editable} aria-pressed={row.answer === option.value} className={`self-answer self-answer-${option.value}${row.answer === option.value ? ' selected' : ''}`} onClick={() => set(row.id, { answer: row.answer === option.value ? '' : option.value })}>{option.label[en ? 1 : 0]}</button>)}</div>
          {(row.answer === 'partial' || row.answer === 'no' || row.note) && <input className="self-note" value={row.note || ''} disabled={!editable} maxLength={2000} placeholder={L(en, 'Σχόλιο: τι λείπει ή τι θα γίνει', 'Comment: what is missing or what will be done')} aria-label={L(en, 'Σχόλιο', 'Comment')} onChange={event => set(row.id, { note: event.target.value })} />}
        </div>)}
      </div>)}
      {!rows.length && <RegistryEmptyState icon={CheckCircle2} title={L(en, 'Δεν υπάρχουν ερωτήσεις', 'No questions')} text={L(en, 'Το ερωτηματολόγιο δεν έχει ερωτήσεις για αυτό το τμήμα.', 'The questionnaire has no questions for this department.')} />}
    </section>
  </Page>
}
