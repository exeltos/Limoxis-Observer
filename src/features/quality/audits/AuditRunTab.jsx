import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, ClipboardCheck, FilePlus2, Info, Paperclip, Plus, SearchCheck, Users } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { FormGrid } from '../../../design-system/FormCard'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { SectionHeader } from '../../../design-system/SectionHeader'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { AttachmentField } from '../../../design-system/AttachmentField'
import { meterTone } from '../../../design-system/MiniCharts'
import { formatDay } from '../../../core/i18n/formatDay'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { createQualityRecord, saveQualityRecord } from '../qualityService'
import { AUDIT_RESULTS, FINDING_CLASSES, areaLabel, departmentArea, findingClassLabel, standardShort } from './auditStandards'
import { adHocRow, auditScore, awaitingFinding, capaDraftFromFinding, chapterKey, classesFor, findingDraftFromAnswer, needsClass, questionsForStandards, unclassified } from './auditModel'
import { useAuditTemplates } from './useAuditTemplates'
import { AuditFindingDialog } from './AuditFindingDialog'
import './audits.css'

const L = (en, el, english) => (en ? english : el)
const pick = (pair, en) => pair[en ? 1 : 0]
const RESULT_SHORT = { yes: ['Ναι', 'Yes'], partial: ['Μερική', 'Partial'], no: ['Όχι', 'No'], na: ['Δ.Ε.', 'N/A'] }
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))

// Running an audit: the opening meeting, the questionnaire by chapter (one
// select per question, a comment, the evidence seen and attachments, a class for
// every «Μερική» / «Μη συμμόρφωση»), the score per chapter and overall, the
// findings (and CAPA) the answers become, and the closing meeting. Laid out for
// a tablet: one question per card, large controls, the save bar in view.
export function AuditRunTab({ record, setRecord, organizationId, canManage, finalized, language, actor, notify, userId }) {
  const en = language === 'en'
  const { goTo } = useContextualNavigation('/quality')
  const { templates } = useAuditTemplates(organizationId)
  const template = templates.find(item => item.id === record.templateId) || null
  // The other standards of the same audit: each one's questionnaire (the hospital's copy, else the library's).
  const others = useMemo(() => (record.standards || []).filter(value => value !== record.standard).map(standard => templates.find(item => item.standard === standard && !item.isSystem && item.active !== false) || templates.find(item => item.standard === standard)).filter(Boolean), [record.standards, record.standard, templates])
  const [allAreas, setAllAreas] = useState(false)
  const stored = useMemo(() => record.checklist || [], [record.checklist])
  // A planned audit opens with its questionnaire for the department and the chapters in scope.
  const initial = useMemo(() => (stored.length || (!template && !others.length) ? stored : questionsForStandards([template, ...others], { department: record.department, scope: record.clausesScope, allAreas })), [stored, template, others, record.department, record.clausesScope, allAreas])
  const [rows, setRows] = useState(initial)
  const [meetings, setMeetings] = useState(() => meetingState(record))
  // A questionnaire of several chapters opens on the first chapter still to answer, one chapter at a time.
  const [standardView, setStandardView] = useState(() => firstOpenView(initial).standard)
  const [chapter, setChapter] = useState(() => firstOpenView(initial).chapter)
  const [openOnly, setOpenOnly] = useState(false)
  const [attachmentsOf, setAttachmentsOf] = useState(null)
  const [notesOpen, setNotesOpen] = useState(() => new Set())
  const [guideOpen, setGuideOpen] = useState(() => new Set())
  const [adHoc, setAdHoc] = useState('')
  const [saving, setSaving] = useState(false)
  const [findingFor, setFindingFor] = useState(null)
  useEffect(() => { setRows(initial) }, [initial])
  useEffect(() => { setMeetings(meetingState(record)) }, [record])
  const editable = canManage && !finalized && record.status !== 'cancelled'
  const dirty = JSON.stringify(rows) !== JSON.stringify(stored) || JSON.stringify(meetings) !== JSON.stringify(meetingState(record))
  const score = auditScore(rows)
  const toClassify = unclassified(rows)
  const toRaise = awaitingFinding(rows)
  const chapters = score.chapters
  const shownChapters = standardView === 'all' && score.standards.length > 1 ? [] : chapters.filter(item => standardView === 'all' || item.standard === standardView)
  const visible = rows.map((row, index) => ({ row, index })).filter(({ row }) => (standardView === 'all' || (row.standard || '') === standardView) && (chapter === 'all' || chapterKey(row) === chapter) && (!openOnly || !row.answer || (needsClass(row) && (!row.findingClass || !row.findingId))))
  const chapterAt = shownChapters.findIndex(item => item.key === chapter)
  const nextChapter = chapter !== 'all' && chapterAt >= 0 ? shownChapters[chapterAt + 1] : null
  const setRow = (index, next) => setRows(current => current.map((row, at) => (at === index ? { ...row, ...next, ...(next.answer !== undefined && !classesFor(next.answer).includes(row.findingClass) ? { findingClass: '' } : {}) } : row)))
  const complete = rows.length > 0 && score.overall.unanswered === 0 && toClassify.length === 0

  async function persist(next, message) {
    setSaving(true)
    try {
      const saved = await saveQualityRecord('audits', organizationId, next)
      setRecord(saved)
      if (message) notify?.(message, 'success')
      return saved
    } catch (error) {
      console.error(error)
      notify?.(L(en, 'Δεν ήταν δυνατή η αποθήκευση της επιθεώρησης.', 'The audit could not be saved.'), 'error')
      return null
    } finally { setSaving(false) }
  }
  const history = (action, extra = {}) => [{ at: new Date().toISOString(), action, actor: actor?.name || '', ...extra }, ...(record.history || [])]
  const withMeetings = base => ({ ...base, openingMeeting: meetings.opening, closingMeeting: meetings.closing, conclusion: meetings.conclusion, auditeeRepresentative: meetings.representative })
  const save = () => persist(withMeetings({ ...record, checklist: rows, status: record.status === 'planned' && (rows.some(row => row.answer) || meetings.opening.date) ? 'inProgress' : record.status, history: history('recordUpdated') }), L(en, 'Η επιθεώρηση αποθηκεύτηκε.', 'Audit saved.'))
  const finish = () => persist(withMeetings({ ...record, checklist: rows, status: 'completed', completedDate: meetings.closing.date || record.completedDate || new Date().toISOString().slice(0, 10), history: history('auditCompleted') }), L(en, 'Η επιθεώρηση ολοκληρώθηκε.', 'Audit completed.'))
  const addQuestion = () => {
    const text = adHoc.trim()
    if (!text) return
    const picked = chapters.find(item => item.key === chapter)
    const ref = picked?.ref || ''
    setRows(current => [...current, { ...adHocRow(text, { chapterRef: ref, clauseRef: ref, chapterTitle: picked?.title || '', position: current.length + 1 }), standard: picked?.standard || (standardView !== 'all' ? standardView : record.standard || '') }])
    setAdHoc('')
  }

  // One answer becomes a finding (and, when asked, its CAPA); the answer keeps the finding's code.
  async function raise(row, { owner, dueDate, findingClass, withCapa, capaOwner, capaDueDate }) {
    setSaving(true)
    try {
      const draft = findingDraftFromAnswer(record, { ...row, findingClass }, { language, owner, dueDate })
      const finding = await createQualityRecord('findings', organizationId, { ...draft, reportedByLabel: actor?.name || '', history: [{ at: new Date().toISOString(), action: 'findingCreated', actor: actor?.name || '' }] }, userId)
      let capa = null
      if (withCapa) capa = await createQualityRecord('capas', organizationId, { ...capaDraftFromFinding(finding, { owner: capaOwner || owner, dueDate: capaDueDate || dueDate, language }), history: [{ at: new Date().toISOString(), action: 'capaAssigned', actor: actor?.name || '' }] }, userId)
      const next = rows.map(item => (item.id === row.id ? { ...item, findingClass, findingId: finding.id } : item))
      setRows(next)
      await persist(withMeetings({ ...record, checklist: next, history: history('findingCreated') }), capa ? L(en, `Δημιουργήθηκαν το εύρημα ${finding.id} και η διορθωτική ενέργεια ${capa.id}.`, `Finding ${finding.id} and corrective action ${capa.id} created.`) : L(en, `Δημιουργήθηκε το εύρημα ${finding.id}.`, `Finding ${finding.id} created.`))
      setFindingFor(null)
    } catch (error) {
      console.error(error)
      notify?.(L(en, 'Δεν ήταν δυνατή η δημιουργία του ευρήματος.', 'The finding could not be created.'), 'error')
    } finally { setSaving(false) }
  }
  // Every classified answer without a finding becomes one, with the class's due date.
  async function raiseAll() {
    if (!toRaise.length || saving) return
    setSaving(true)
    try {
      const codes = new Map()
      for (const row of toRaise) {
        const finding = await createQualityRecord('findings', organizationId, { ...findingDraftFromAnswer(record, row, { language }), reportedByLabel: actor?.name || '', history: [{ at: new Date().toISOString(), action: 'findingCreated', actor: actor?.name || '' }] }, userId)
        codes.set(row.id, finding.id)
      }
      const next = rows.map(item => (codes.has(item.id) ? { ...item, findingId: codes.get(item.id) } : item))
      setRows(next)
      await persist(withMeetings({ ...record, checklist: next, history: history('findingCreated') }), L(en, `Δημιουργήθηκαν ${codes.size} ευρήματα.`, `${codes.size} findings created.`))
    } catch (error) {
      console.error(error)
      notify?.(L(en, 'Δεν ήταν δυνατή η δημιουργία των ευρημάτων.', 'The findings could not be created.'), 'error')
    } finally { setSaving(false) }
  }

  if (!rows.length && !editable) return <div className="record-section"><SectionHeader title={L(en, 'Ερωτηματολόγιο', 'Questionnaire')} /><div className="inline-empty">{L(en, 'Η επιθεώρηση δεν έχει ερωτήσεις.', 'This audit has no questions.')}</div></div>
  const area = record.department ? departmentArea(record.department) : ''
  return <div className="record-section audit-run">
    <p className="quality-summary-line quality-record-line">
      <span className={score.overall.rate != null && score.overall.rate < 70 ? 'is-late' : undefined}>{L(en, 'Συμμόρφωση', 'Compliance')} <b>{score.overall.rate == null ? '—' : `${score.overall.rate}%`}</b></span>
      <span><b>{score.overall.answered}/{score.overall.total}</b> {L(en, 'απαντήθηκαν', 'answered')}</span>
      <span><b>{score.overall.partial}</b> {L(en, 'μερική', 'partial')}</span>
      <span className={score.overall.no ? 'is-late' : undefined}><b>{score.overall.no}</b> {L(en, 'μη συμμόρφωση', 'nonconformity')}</span>
      <span><b>{score.overall.na}</b> {L(en, 'δεν εφαρμόζεται', 'not applicable')}</span>
      {score.criticalFailed > 0 && <span className="is-late"><b>{score.criticalFailed}</b> {L(en, 'κρίσιμες σε μη συμμόρφωση', 'critical not met')}</span>}
    </p>
    {score.standards.length > 1 && <div className="audit-chapter-strip audit-standard-strip" role="group" aria-label={L(en, 'Πρότυπα', 'Standards')}>
      <button type="button" className={standardView === 'all' ? 'is-active' : ''} onClick={() => { setStandardView('all'); setChapter('all') }}><strong>{L(en, 'Όλα τα πρότυπα', 'All standards')}</strong><small>{score.overall.rate == null ? '—' : `${score.overall.rate}%`}</small></button>
      {score.standards.map(item => <button type="button" key={item.standard || 'none'} className={`${standardView === item.standard ? 'is-active' : ''} is-${item.rate == null ? 'neutral' : meterTone(item.rate)}`} onClick={() => { setStandardView(item.standard); setChapter('all') }}><strong>{standardShort(item.standard) || '—'}</strong><small>{item.rate == null ? `${item.answered}/${item.total}` : `${item.rate}%`}</small></button>)}
    </div>}
    {shownChapters.length > 1 && <div className="audit-chapter-strip" role="group" aria-label={L(en, 'Κεφάλαια', 'Chapters')}>
      <button type="button" className={chapter === 'all' ? 'is-active' : ''} onClick={() => setChapter('all')}><strong>{L(en, 'Όλα', 'All')}</strong><small>{score.overall.rate == null ? '—' : `${score.overall.rate}%`}</small></button>
      {shownChapters.map(item => <button type="button" key={item.key} className={`${chapter === item.key ? 'is-active' : ''} is-${item.rate == null ? 'neutral' : meterTone(item.rate)}`} title={item.title} onClick={() => setChapter(item.key)}><strong>{item.ref || '—'}</strong><small>{item.rate == null ? `${item.answered}/${item.total}` : `${item.rate}%`}</small></button>)}
    </div>}

    <MeetingLine title={L(en, 'Εναρκτήρια σύσκεψη', 'Opening meeting')} summary={[meetings.opening.date && formatDay(meetings.opening.date, language), meetings.representative, meetings.opening.attendees].filter(Boolean).join(' · ')} language={language}>
      <FormGrid columns={3}>
        <ManualDateField label={L(en, 'Ημερομηνία', 'Date')} value={meetings.opening.date} onChange={date => setMeetings(current => ({ ...current, opening: { ...current.opening, date } }))} disabled={!editable} />
        <Field label={L(en, 'Εκπρόσωπος του τμήματος', 'Auditee representative')}><input value={meetings.representative} disabled={!editable} onChange={event => setMeetings(current => ({ ...current, representative: event.target.value }))} /></Field>
        <Field label={L(en, 'Παρόντες', 'Attendees')}><input value={meetings.opening.attendees} disabled={!editable} onChange={event => setMeetings(current => ({ ...current, opening: { ...current.opening, attendees: event.target.value } }))} /></Field>
      </FormGrid>
    </MeetingLine>

    <SectionHeader title={L(en, `Ερωτηματολόγιο${record.templateTitle ? ` · ${record.templateTitle}` : ''}`, `Questionnaire${record.templateTitle ? ` · ${record.templateTitle}` : ''}`)}
      subtitle={!stored.length && template ? L(en, `${rows.length} ερωτήσεις για ${area ? `την περιοχή «${areaLabel(area, language)}»` : 'όλο τον οργανισμό'}${record.clausesScope?.length ? ` και τα κεφάλαια ${record.clausesScope.join(', ')}` : ''}. Αποθηκεύονται με την πρώτη αποθήκευση.`, `${rows.length} questions for ${area ? `the «${areaLabel(area, language)}» area` : 'the whole organization'}${record.clausesScope?.length ? ` and chapters ${record.clausesScope.join(', ')}` : ''}. Kept on the first save.`) : undefined}
      actions={<div className="audit-run-filters">
        {!stored.length && template && area && <CheckboxField label={L(en, 'Και οι ερωτήσεις άλλων περιοχών', 'Include other areas')} checked={allAreas} onChange={setAllAreas} />}
        <Button variant="secondary" onClick={() => document.querySelector('.audit-question.is-open')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{L(en, 'Επόμενη αναπάντητη', 'Next unanswered')}</Button>
        <CheckboxField label={L(en, 'Μόνο ό,τι εκκρεμεί', 'Only what is open')} checked={openOnly} onChange={setOpenOnly} />
      </div>} />
    {!rows.length && <div className="inline-empty">{template ? L(en, 'Καμία ερώτηση για αυτό το πεδίο.', 'No question for this scope.') : L(en, 'Η επιθεώρηση δεν έχει ερωτηματολόγιο· ορίστε το στον «Σχεδιασμό» ή προσθέστε ερωτήσεις εδώ.', 'This audit has no questionnaire; set one in «Planning» or add questions here.')}</div>}
    <ol className="audit-questions">
      {visible.map(({ row, index }) => {
        const classes = classesFor(row.answer)
        const first = index === 0 || chapterKey(rows[index - 1]) !== chapterKey(row)
        return <li key={row.id || index} className={`audit-question is-${row.answer || 'open'}`}>
          {first && chapter === 'all' && row.chapterRef && <h4 className="audit-chapter-title">{score.standards.length > 1 && row.standard ? `${standardShort(row.standard)} · ` : ''}{row.chapterRef}{row.chapterTitle ? ` · ${row.chapterTitle}` : ''}</h4>}
          <div className="audit-question-head">
            <span className="audit-clause">{row.clauseRef || '—'}</span>
            <strong>{en ? row.itemEn || row.item : row.item}</strong>
            {row.critical && <StatusBadge tone="danger">{L(en, 'Κρίσιμη', 'Critical')}</StatusBadge>}
            {row.adHoc && <StatusBadge tone="neutral">{L(en, 'Επιπλέον ερώτηση', 'Added question')}</StatusBadge>}
            {Number(row.weight) > 1 && <StatusBadge tone="info">{L(en, `βάρος ${row.weight}`, `weight ${row.weight}`)}</StatusBadge>}
            {(row.guidance || row.evidenceRequired) && <button type="button" className="audit-info" aria-expanded={guideOpen.has(row.id)} title={L(en, 'Οδηγία και τεκμήρια', 'Guidance and evidence')} onClick={() => setGuideOpen(current => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next })}><Info size={14} /></button>}
          </div>
          {(row.guidance || row.evidenceRequired) && guideOpen.has(row.id) && <p className="audit-question-guide">{row.guidance && <span>{row.guidance}</span>}{row.evidenceRequired && <span><b>{L(en, 'Τεκμήρια:', 'Evidence:')}</b> {row.evidenceRequired}</span>}</p>}
          <div className="audit-answer-buttons" role="radiogroup" aria-label={L(en, 'Αποτέλεσμα', 'Result')}>
            {AUDIT_RESULTS.map(item => <button key={item.value} type="button" role="radio" aria-checked={row.answer === item.value} className={`is-${item.tone}${row.answer === item.value ? ' is-on' : ''}`} disabled={!editable} title={pick(item.label, en)}
              onClick={() => setRow(index, { answer: row.answer === item.value ? '' : item.value })}>{pick(RESULT_SHORT[item.value], en)}</button>)}
          </div>
          <div className="audit-answer-tools">
            {!(needsClass(row) || row.note || row.evidence || notesOpen.has(row.id)) && <button type="button" className="audit-answer-link" onClick={() => setNotesOpen(current => new Set(current).add(row.id))}>+ {L(en, 'Σχόλιο', 'Comment')}</button>}
            <button type="button" className="audit-answer-link" onClick={() => setAttachmentsOf(attachmentsOf === row.id ? null : row.id)} aria-expanded={attachmentsOf === row.id}><Paperclip size={13} /> {row.attachments?.length ? row.attachments.length : L(en, 'Αρχεία', 'Files')}</button>
          </div>
          {(needsClass(row) || row.findingClass || row.findingId) && <FormGrid columns={3} className="audit-answer-grid">
            <ChoiceField label={needsClass(row) ? L(en, 'Κατάταξη ευρήματος *', 'Finding class *') : L(en, 'Κατάταξη (προαιρετικά)', 'Class (optional)')} value={row.findingClass || ''} disabled={!editable || !classes.length || Boolean(row.findingId)} placeholder={classes.length ? L(en, 'Επιλέξτε', 'Choose') : '—'} options={FINDING_CLASSES.filter(item => classes.includes(item.value)).map(item => ({ value: item.value, label: pick(item.label, en) }))} onChange={findingClass => setRow(index, { findingClass })} />
            <div className="audit-answer-actions">
              {row.findingId
                ? <button type="button" className="quality-audit-finding-link" disabled={dirty} title={dirty ? L(en, 'Αποθηκεύστε πρώτα', 'Save first') : undefined} onClick={() => goTo(`/quality/findings/${row.findingId}`, { tab: 'checklist' })}>{L(en, 'Εύρημα', 'Finding')} {row.findingId}<ChevronRight size={13} /></button>
                : editable && row.findingClass && <Button variant="secondary" disabled={dirty || saving || !isSavedRow(row, organizationId)} title={dirty ? L(en, 'Αποθηκεύστε πρώτα', 'Save first') : undefined} onClick={() => setFindingFor(row)}><SearchCheck size={15} /> {L(en, 'Εύρημα / διορθωτική ενέργεια', 'Finding / CAPA')}</Button>}
            </div>
          </FormGrid>}
          {(needsClass(row) || row.note || row.evidence || notesOpen.has(row.id)) && <FormGrid columns={2} className="audit-answer-grid">
            <Field label={needsClass(row) ? L(en, 'Διαπίστωση *', 'What was found *') : L(en, 'Σχόλιο', 'Comment')}><textarea rows={2} value={row.note || ''} disabled={!editable} onChange={event => setRow(index, { note: event.target.value })} /></Field>
            <Field label={L(en, 'Τεκμήρια που εξετάστηκαν', 'Evidence examined')}><textarea rows={2} value={row.evidence || ''} disabled={!editable} onChange={event => setRow(index, { evidence: event.target.value })} placeholder={row.evidenceRequired || ''} /></Field>
          </FormGrid>}
          {attachmentsOf === row.id && <div className="audit-question-attachments">
            {isSavedRow(row, organizationId)
              ? <AttachmentField disabled={!editable} value={row.attachments || []} onChange={attachments => setRow(index, { attachments })} organizationId={organizationId} entityType="quality_audit_answer" entityId={row.id} accept="image/*,application/pdf" />
              : <p className="inline-empty">{L(en, 'Αποθηκεύστε πρώτα την επιθεώρηση για να επισυνάψετε φωτογραφίες και έγγραφα.', 'Save the audit first to attach photos and documents.')}</p>}
          </div>}
        </li>
      })}
    </ol>
    {nextChapter && <div className="audit-next-chapter"><Button variant="secondary" onClick={() => { setChapter(nextChapter.key); document.querySelector('.audit-run')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{L(en, 'Επόμενο κεφάλαιο', 'Next chapter')}: {nextChapter.ref}{nextChapter.title ? ` · ${nextChapter.title}` : ''} <ChevronRight size={15} /></Button></div>}
    {editable && <FormGrid columns={3} className="audit-adhoc"><Field label={L(en, 'Επιπλέον ερώτηση (εκτός ερωτηματολογίου)', 'Additional question (not in the questionnaire)')}><input value={adHoc} onChange={event => setAdHoc(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addQuestion() } }} /></Field><Button variant="secondary" disabled={!adHoc.trim()} onClick={addQuestion}><Plus size={15} /> {L(en, 'Προσθήκη ερώτησης', 'Add question')}</Button></FormGrid>}

    {(toClassify.length > 0 || toRaise.length > 0 || rows.some(row => row.findingId)) && <div className={`governance-banner ${toClassify.length || toRaise.length ? 'warning' : 'success'} quality-audit-findings`}><ClipboardCheck size={17} aria-hidden="true" /><span>{toClassify.length
      ? L(en, `${toClassify.length} απαντήσεις «Μερική» ή «Μη συμμόρφωση» χωρίς κατάταξη (Μείζον, Έλασσον, Παρατήρηση, Ευκαιρία βελτίωσης).`, `${toClassify.length} «Partial» or «Nonconformity» answers without a class.`)
      : toRaise.length ? L(en, `${toRaise.length} κατατεταγμένες απαντήσεις χωρίς εύρημα: ${[...new Set(toRaise.map(row => findingClassLabel(row.findingClass, language)))].join(', ')}.`, `${toRaise.length} classified answers without a finding.`)
      : L(en, 'Κάθε κατατεταγμένη απάντηση έχει το εύρημά της.', 'Every classified answer has its finding.')}</span>{canManage && !finalized && toRaise.length > 0 && !dirty && <Button disabled={saving} onClick={raiseAll}><FilePlus2 size={15} /> {L(en, 'Δημιουργία ευρημάτων', 'Create findings')}</Button>}</div>}

    <MeetingLine title={L(en, 'Καταληκτική σύσκεψη', 'Closing meeting')} summary={[meetings.closing.date && formatDay(meetings.closing.date, language), meetings.closing.attendees, meetings.conclusion].filter(Boolean).join(' · ')} language={language} defaultOpen={complete}>
      <FormGrid columns={3}>
        <ManualDateField label={L(en, 'Ημερομηνία', 'Date')} value={meetings.closing.date} onChange={date => setMeetings(current => ({ ...current, closing: { ...current.closing, date } }))} disabled={!editable} />
        <Field label={L(en, 'Παρόντες', 'Attendees')}><input value={meetings.closing.attendees} disabled={!editable} onChange={event => setMeetings(current => ({ ...current, closing: { ...current.closing, attendees: event.target.value } }))} /></Field>
        <Field label={L(en, 'Συμπέρασμα επιθεώρησης', 'Audit conclusion')}><textarea rows={2} value={meetings.conclusion} disabled={!editable} onChange={event => setMeetings(current => ({ ...current, conclusion: event.target.value }))} /></Field>
      </FormGrid>
    </MeetingLine>

    {editable && <div className="inline-edit-footer quality-audit-footer">
      <span className="quality-audit-score">{L(en, `${score.overall.answered} από ${score.overall.total} απαντήθηκαν${score.overall.rate != null ? ` · ${score.overall.rate}%` : ''}`, `${score.overall.answered} of ${score.overall.total} answered${score.overall.rate != null ? ` · ${score.overall.rate}%` : ''}`)}</span>
      <SaveButton loading={saving} disabled={!dirty || saving} onClick={save}>{L(en, 'Αποθήκευση', 'Save')}</SaveButton>
      <Button disabled={!complete || saving || dirty} title={!complete ? L(en, 'Απαντήστε σε όλες τις ερωτήσεις και κατατάξτε κάθε μερική ή μη συμμόρφωση.', 'Answer every question and classify every partial or nonconformity.') : undefined} onClick={finish}><CheckCircle2 size={15} /> {L(en, 'Ολοκλήρωση επιθεώρησης', 'Complete audit')}</Button>
    </div>}
    {findingFor && <AuditFindingDialog row={findingFor} audit={record} language={language} saving={saving} onClose={() => setFindingFor(null)} onCreate={values => raise(findingFor, values)} />}
  </div>
}

// What to open on: the first standard still to answer and its first chapter with an answer missing
// (one standard and one chapter at a time), or everything when nothing is open or there is one chapter.
const firstOpenView = rows => {
  const score = auditScore(rows)
  const standard = score.standards.length > 1 ? (score.standards.find(item => item.unanswered > 0)?.standard ?? 'all') : 'all'
  const chapters = score.chapters.filter(item => standard === 'all' || item.standard === standard)
  if (chapters.length < 2) return { standard, chapter: 'all' }
  return { standard, chapter: chapters.find(item => item.unanswered > 0)?.key || 'all' }
}

// A meeting on one line: its title and what was recorded, opening the fields on a click.
function MeetingLine({ title, summary, language, defaultOpen = false, children }) {
  const en = language === 'en'
  const [open, setOpen] = useState(defaultOpen)
  return <div className="audit-meeting">
    <button type="button" className="audit-meeting-line" aria-expanded={open} onClick={() => setOpen(!open)}><Users size={15} aria-hidden="true" /><strong>{title}</strong><span>{summary || L(en, 'δεν έχει καταγραφεί', 'not recorded')}</span><ChevronRight size={14} aria-hidden="true" /></button>
    {open && <div className="audit-meeting-fields">{children}</div>}
  </div>
}

const meetingState = record => ({
  opening: { date: record.openingMeeting?.date || '', attendees: record.openingMeeting?.attendees || '' },
  closing: { date: record.closingMeeting?.date || '', attendees: record.closingMeeting?.attendees || '' },
  conclusion: record.conclusion || '',
  representative: record.auditeeRepresentative || '',
})
// In the cloud an answer can carry a finding or a file once it is saved (its id is the row's).
const isSavedRow = (row, organizationId) => !organizationId || isDemoDataEnvironment() || isUuid(row.id)
