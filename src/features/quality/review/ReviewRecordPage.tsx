import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, CheckCircle2, CheckSquare2, ClipboardList, ClipboardSignature, ListChecks, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { IconButton } from '../../../design-system/IconButton'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useAuth } from '../../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../../core/audit/actor'
import { formatDay } from '../../../core/i18n/formatDay'
import { reportExports } from '../../../core/export/reportDocument'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { loadQualityRecords } from '../qualityService'
import { loadResources } from '../resources/resourceService'
import { loadRiskAssessments } from '../risk/riskService'
import { loadResponses, loadSurveys } from '../surveys/surveyService'
import { loadMeetingGroups, loadMeetings } from '../meetings/meetingService'
import { loadTrainingStateAsync } from '../../training/trainingService'
import { loadCommitteesFullAsync } from '../../committees/committeeService'
import { loadDocumentsAsync } from '../../documents/documentService'
import { loadReviews, saveReview } from './reviewService'
import { REVIEW_SECTIONS, addDays, newReviewFrom, reviewStatusLabel, sectionFacts } from './reviewTemplate'
import { ObjectiveBars, useObjectives } from './QualityObjectives'
import '../quality.css'
import { TableSkeleton } from '../../../design-system/LoadingSkeleton'
import type { AnyRecord } from '../../../types/featureTypes'

// The minutes on the shared document layout (hospital band, DEMO mark in a
// Demo, signatures): as Word, laid out like the hospital's form, or printed.
function minutesDocument(review: AnyRecord) {
  const present = review.participants.filter((person: AnyRecord) => person.attended !== false)
  const absent = review.participants.filter((person: AnyRecord) => person.attended === false)
  return {
    language: 'el',
    kind: 'Πρακτικό Επιτροπής Ποιότητας',
    code: review.code,
    title: review.title,
    meta: [
      ['Ημερομηνία', formatDay(review.reviewDate, 'el')],
      ['Περίοδος', `${formatDay(review.periodFrom, 'el')} – ${formatDay(review.periodTo, 'el')}`],
      ['Συχνότητα συνεδρίασης', `κάθε ${review.frequencyDays} ημέρες`],
      ['Κατάσταση', reviewStatusLabel(review.status, 'el')],
      ['Συμμετέχοντες', present.map((person: AnyRecord) => person.name).join(', ')],
      ['Απόντες', absent.length ? absent.map((person: AnyRecord) => person.name).join(', ') : '—'],
    ],
    sections: [
      review.summary && { title: 'Σύνοψη', text: review.summary },
      ...review.sections.map((section: string) => ({ title: section.title, text: String(section.body || '').trim() || '—' })),
      review.actions.length && { title: 'Αποφάσεις και ενέργειες', table: { columns: ['Α/Α', 'Ενέργεια', 'Υπεύθυνος', 'Προθεσμία'], rows: review.actions.map((action: AnyRecord, index: number) => [String(index + 1), action.title, action.ownerLabel || '—', formatDay(action.dueDate, 'el')]) } },
      { title: 'Υπογραφές συμμετεχόντων', keepTogether: true, table: { columns: ['Α/Α', 'Ονοματεπώνυμο', 'Υπογραφή'], rows: present.map((person: AnyRecord, index: number) => [String(index + 1), person.name, person.signedAt ? `Υπεγράφη ${formatDay(person.signedAt, 'el')}` : '']) } },
    ].filter(Boolean),
    filename: `${review.code || 'Anaskopisi'}_${review.reviewDate}`,
  }
}

// The text of a section: as tall as what is written (no scrolling inside the
// card), and plain paragraphs once the review is approved.
function MinutesText({ label, value, locked, onChange, rows = 3 }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fit = () => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px` }
    fit()
    // A narrower record wraps the text onto more lines: fit again when the width changes.
    let width = el.clientWidth
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (el.clientWidth !== width) { width = el.clientWidth; fit() } })
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [value, locked])
  if (locked) return <div className="review-text" aria-label={label}>{String(value || '').split(/\n+/).filter(line => line.trim()).map((line, index) => <p key={index}>{line}</p>)}{!String(value || '').trim() && <p className="review-text-empty">—</p>}</div>
  return <textarea ref={ref} aria-label={label} rows={rows} value={value || ''} onChange={event => onChange(event.target.value)} />
}

// One management review: the minutes section by section (each with the facts
// Limoxis holds for the period), the decisions, and who took part and signed.
export function ReviewRecordPage() {
  const { reviewId } = useParams()
  const isNew = reviewId === 'new'
  const navigate = useNavigate()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const { user, profile } = useAuth()
  const canManage = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const [reviews, setReviews] = useState<AnyRecord | null>(null)
  const [review, setReview] = useState<AnyRecord | null>(null)
  const [tab, setTab] = useState('details')
  const [sectionKey, setSectionKey] = useState(REVIEW_SECTIONS[0].key)
  const [saving, setSaving] = useState(false)
  const [facts, setFacts] = useState({ incidents: [], capas: [], findings: [], audits: [] })
  const objectives = useObjectives(tenant?.id)
  const { goBack, goTo } = useContextualNavigation('/meetings?tab=reviews')

  useEffect(() => {
    let active = true
    loadReviews(tenant?.id).then(rows => {
      if (!active) return
      setReviews(rows)
      const found = isNew ? newReviewFrom(rows.find((row: AnyRecord) => row.status === 'approved') || rows[0]) : rows.find((row: AnyRecord) => row.id === reviewId || row.code === reviewId)
      setReview(found ? structuredClone(found) : null)
    }).catch(() => { if (active) setReviews([]) })
    const add = next => { if (active) setFacts(current => ({ ...current, ...next })) }
    const orgId = tenant?.id
    Promise.all(['incidents', 'capas', 'findings', 'audits'].map(section => loadQualityRecords(section, orgId).catch(() => []))).then(([incidents, capas, findings, audits]) => add({ incidents, capas, findings, audits }))
    // What the other screens hold for the remaining sections; a screen the user cannot read adds nothing.
    loadResources(orgId).then(resources => add({ suppliers: resources.suppliers, equipment: resources.equipment, equipmentEvents: resources.events })).catch(() => {})
    loadRiskAssessments(orgId).then(riskAssessments => add({ riskAssessments })).catch(() => {})
    loadTrainingStateAsync(orgId).then(state => add({ trainingPrograms: state.programs, trainingAssignments: state.assignments })).catch(() => {})
    loadCommitteesFullAsync(orgId).then(committees => add({ committees: Array.isArray(committees) ? committees : [] })).catch(() => {})
    loadDocumentsAsync(orgId).then(documents => add({ documents: Array.isArray(documents) ? documents : [] })).catch(() => {})
    Promise.all([loadMeetingGroups(orgId), loadMeetings(orgId)]).then(([meetingGroups, meetings]) => add({ meetingGroups, meetings })).catch(() => {})
    loadSurveys(orgId).then(surveys => Promise.all(surveys.filter((survey: AnyRecord) => survey.responseCount > 0).map((survey: AnyRecord) => loadResponses(orgId, survey.id).then(responses => ({ survey, responses })).catch(() => ({ survey, responses: [] }))))).then(surveys => add({ surveys })).catch(() => {})
    return () => { active = false }
  }, [tenant?.id, reviewId, isNew])

  const previous = useMemo(() => (reviews || []).filter((row: AnyRecord) => row.id !== review?.id && row.reviewDate <= (review?.reviewDate || '9999')).sort((a: AnyRecord, b: AnyRecord) => b.reviewDate.localeCompare(a.reviewDate))[0] || null, [reviews, review])
  if (!reviews) return <Page fill><TableSkeleton/></Page>
  if (!review) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Review not found' : 'Η ανασκόπηση δεν βρέθηκε'}</strong></div></Page>

  const locked = review.status === 'approved' || !canManage
  const period = { from: review.periodFrom || '0000-01-01', to: review.periodTo || review.reviewDate }
  const data = { ...facts, objectives: objectives.objectives, previous }
  const set = next => setReview(current => ({ ...current, ...next }))
  const setSection = (key: string, body) => setReview(current => ({ ...current, sections: current.sections.map((section: string) => (section.key === key ? { ...section, body } : section)) }))
  const setAction = (index: number, next) => setReview(current => ({ ...current, actions: current.actions.map((action, position: number) => (position === index ? { ...action, ...next } : action)) }))
  const setPerson = (index: number, next) => setReview(current => ({ ...current, participants: current.participants.map((person, position: number) => (position === index ? { ...person, ...next } : person)) }))
  const present = review.participants.filter((person: AnyRecord) => person.attended !== false)
  const allSigned = present.length > 0 && present.every((person: AnyRecord) => person.signedAt)

  async function save(nextStatus) {
    setSaving(true)
    try {
      const next = { ...review, status: nextStatus || review.status, ...(nextStatus === 'approved' ? { approvedAt: new Date().toISOString(), approvedByLabel: auditActorFromAuth({ profile, user }).name } : {}) }
      const saved = await saveReview(tenant?.id, next)
      notify(nextStatus === 'approved' ? (en ? 'Review approved.' : 'Η ανασκόπηση εγκρίθηκε.') : (en ? 'Review saved.' : 'Η ανασκόπηση αποθηκεύτηκε.'), 'success')
      if (isNew) navigate(`/quality/reviews/${saved.id}`, { replace: true })
      else setReview(structuredClone(saved))
    } catch (error) { console.error(error); notify(en ? 'The review could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.', 'error') } finally { setSaving(false) }
  }
  // A decision's corrective action: its source is this review and decision, so the decision
  // then opens the one already made (and «Back» returns here).
  const capaSource = (action: AnyRecord) => `MR:${review.code}#${action.id}`
  const capaOf = (action: AnyRecord) => (action.id ? (facts.capas || []).find(capa => capa.sourceId === capaSource(action) || (action.capaId && (capa.id === action.capaId || capa.dbId === action.capaId))) : null)
  function openCapa(action: AnyRecord) {
    const existing = capaOf(action)
    if (existing) { goTo(`/quality/capas/${existing.id}`, { tab }); return }
    goTo('/quality/capas/new', { tab, state: { qualitySource: { source: 'other', sourceId: capaSource(action), title: action.title, dueDate: action.dueDate, description: en ? `Decision of the management review ${review.code} (${formatDay(review.reviewDate, 'en')}).` : `Απόφαση της Ανασκόπησης Διοίκησης ${review.code} (${formatDay(review.reviewDate, 'el')}).` } } })
  }
  const capaButton = (action: AnyRecord) => {
    if (!action.title || !canManage) return null
    const existing = capaOf(action)
    if (existing) return <Button variant="secondary" onClick={() => openCapa(action)}><CheckSquare2 size={15} />{existing.code || (en ? 'Corrective action' : 'Διορθωτική ενέργεια')}</Button>
    if (action.status !== 'open') return null
    return <Button variant="secondary" disabled={!action.id || isNew} title={!action.id || isNew ? (en ? 'Save the review first' : 'Αποθηκεύστε πρώτα την ανασκόπηση') : undefined} onClick={() => openCapa(action)}><Plus size={15} />{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>
  }

  const tabs = [
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList },
    { id: 'minutes', label: en ? 'Minutes' : 'Πρακτικό', icon: ClipboardSignature },
    { id: 'actions', label: en ? `Decisions ${review.actions.length}` : `Αποφάσεις ${review.actions.length}`, icon: ListChecks },
    { id: 'people', label: en ? `Participants ${review.participants.length}` : `Συμμετέχοντες ${review.participants.length}`, icon: Users },
  ]
  const footer = !locked && <div className="inline-edit-footer"><SaveButton loading={saving} disabled={saving} onClick={() => save()}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>{!isNew && <Button disabled={saving || !allSigned} onClick={() => save('approved')}><CheckCircle2 size={15} />{en ? 'Approve' : 'Έγκριση'}</Button>}</div>
  return <Page fill><EntityRecordShell className="quality-record-shell review-record-shell workspace-fill" avatar={<ClipboardSignature size={19} />} eyebrow={review.code || (en ? 'New' : 'Νέα')} title={review.title} subtitle={`${formatDay(review.reviewDate, language)} · ${en ? 'every' : 'κάθε'} ${review.frequencyDays} ${en ? 'days' : 'ημέρες'}`} status={<StatusBadge tone={review.status === 'approved' ? 'success' : 'info'}>{reviewStatusLabel(review.status, language)}</StatusBadge>} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}
    headerActions={<ExportMenu {...reportExports(() => minutesDocument(review), { word: true, onBlocked: () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error') })} />}>
    {tab === 'details' && <RecordTabPanel className="review-minutes" title={en ? 'Details' : 'Στοιχεία'} footer={footer}>
      <div className="lo-form-cards">
        <FormCard wide title={en ? 'Review' : 'Ανασκόπηση'}>
          <FormGrid columns={4}>
            <ManualDateField label={en ? 'Date' : 'Ημερομηνία'} value={review.reviewDate} disabled={locked} onChange={value => set({ reviewDate: value, nextReviewDate: value ? addDays(value, Number(review.frequencyDays) || 90) : review.nextReviewDate })} />
            <ManualDateField label={en ? 'Period from' : 'Περίοδος από'} value={review.periodFrom} disabled={locked} onChange={value => set({ periodFrom: value })} />
            <ManualDateField label={en ? 'Period to' : 'Περίοδος έως'} value={review.periodTo} disabled={locked} onChange={value => set({ periodTo: value })} />
            <Field label={en ? 'Frequency (days)' : 'Συχνότητα (ημέρες)'}><input inputMode="numeric" value={review.frequencyDays} disabled={locked} onChange={event => set({ frequencyDays: Number(event.target.value) || '', nextReviewDate: review.reviewDate ? addDays(review.reviewDate, Number(event.target.value) || 90) : '' })} /></Field>
          </FormGrid>
          <Field label={en ? 'Summary' : 'Σύνοψη'}><MinutesText label={en ? 'Summary' : 'Σύνοψη'} value={review.summary} locked={locked} onChange={value => set({ summary: value })} /></Field>
        </FormCard>
      </div>
    </RecordTabPanel>}
    {tab === 'minutes' && (() => {
      // One section at a time, picked from the list on the left (no long page to scroll).
      const index = Math.max(0, review.sections.findIndex((section: string) => section.key === sectionKey))
      const section = review.sections[index]
      const meta = REVIEW_SECTIONS.find(item => item.key === section?.key) || {}
      // The facts help write the minutes; an approved review shows its text only.
      const lines = meta.source && !locked ? sectionFacts(meta.source, data, period, language) : []
      return <RecordTabPanel className="review-minutes" title={en ? 'Minutes' : 'Πρακτικό'} subtitle={locked ? undefined : (en ? '«From Limoxis» brings what the other screens hold for the period; edit it freely.' : 'Το «Από το Limoxis» φέρνει όσα έχουν οι άλλες οθόνες για την περίοδο· τα επεξεργάζεστε ελεύθερα.')} footer={footer}>
        <div className="review-sections-layout">
          <nav className="review-sections-rail" aria-label={en ? 'Sections of the minutes' : 'Ενότητες του πρακτικού'}>
            {review.sections.map((item: AnyRecord, position: number) => { const itemMeta = REVIEW_SECTIONS.find(entry => entry.key === item.key) || {}; const written = Boolean(String(item.body || '').trim()); return <button key={item.key} type="button" className={`${item.key === section?.key ? 'is-active' : ''}${written ? ' is-done' : ''}`.trim()} aria-current={item.key === section?.key ? 'true' : undefined} onClick={() => setSectionKey(item.key)}>
              <i>{written ? <Check size={12} aria-hidden="true" /> : position + 1}</i><span>{(en ? itemMeta.shortEn : itemMeta.short) || item.title}</span>
            </button> })}
          </nav>
          {section && <div className="lo-form-cards review-section-main">
            <FormCard wide title={`${index + 1}. ${en ? meta.titleEn || section.title : section.title}`}>
              {lines.length > 0 && <div className="review-facts"><span><Sparkles size={14} />{en ? 'From Limoxis' : 'Από το Limoxis'}</span><ul>{lines.map(line => <li key={line}>{line}</li>)}</ul><Button variant="secondary" onClick={() => setSection(section.key, [section.body, lines.join('\n')].filter(Boolean).join('\n'))}>{en ? 'Insert into the text' : 'Στοιχεία του Limoxis στο κείμενο'}</Button></div>}
              {section.key === 'objectives' && !locked && <ObjectiveBars objectives={objectives.objectives} />}
              <MinutesText label={section.title} value={section.body} locked={locked} rows={6} onChange={value => setSection(section.key, value)} />
            </FormCard>
          </div>}
        </div>
      </RecordTabPanel>
    })()}
    {tab === 'actions' && <RecordTabPanel title={en ? 'Decisions and actions' : 'Αποφάσεις και ενέργειες'} subtitle={en ? 'Open actions of the previous review are carried over.' : 'Οι ανοιχτές ενέργειες της προηγούμενης ανασκόπησης μεταφέρονται εδώ.'} actions={!locked && <Button variant="secondary" onClick={() => set({ actions: [...review.actions, { title: '', ownerLabel: '', dueDate: '', status: 'open', sectionKey: '' }] })}><Plus size={15} />{en ? 'Decision' : 'Απόφαση'}</Button>} footer={footer}>
      {locked
        // An approved review reads as a table; what was decided does not change here.
        ? <RegistryTable className="review-decisions-table" rows={review.actions} rowKey={(action, index) => action.id || index}
          columns={[{ key: 'n', label: '#' }, { key: 'title', label: en ? 'Decision / action' : 'Απόφαση / ενέργεια' }, { key: 'owner', label: en ? 'Owner' : 'Υπεύθυνος' }, { key: 'due', label: en ? 'Due' : 'Προθεσμία' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }, { key: 'capa', label: '', ariaLabel: en ? 'Corrective action' : 'Διορθωτική ενέργεια' }]}
          renderRow={(action, index) => <>
            <td>{index + 1}</td>
            <td className="review-decision-title">{action.title || '—'}</td>
            <td>{action.ownerLabel || '—'}</td>
            <td className="nowrap-cell">{formatDay(action.dueDate, language) || '—'}</td>
            <td><StatusBadge tone={action.status === 'done' ? 'success' : 'info'}>{action.status === 'done' ? (en ? 'Done' : 'Ολοκληρώθηκε') : (en ? 'Open' : 'Ανοιχτή')}</StatusBadge></td>
            <td>{capaButton(action)}</td>
          </>}
          emptyTitle={en ? 'No decisions' : 'Δεν υπάρχουν αποφάσεις'} />
        : <div className="review-actions">{review.actions.map((action: AnyRecord, index: number) => <div key={action.id || index} className="review-action-row">
          <Field label={`${index + 1}. ${en ? 'Decision / action' : 'Απόφαση / ενέργεια'}`}><MinutesText label={en ? 'Decision / action' : 'Απόφαση / ενέργεια'} value={action.title} rows={1} onChange={value => setAction(index, { title: value })} /></Field>
          <Field label={en ? 'Owner' : 'Υπεύθυνος'}><input value={action.ownerLabel} onChange={event => setAction(index, { ownerLabel: event.target.value })} /></Field>
          <ManualDateField label={en ? 'Due' : 'Προθεσμία'} value={action.dueDate} onChange={value => setAction(index, { dueDate: value })} />
          <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={action.status} options={[{ value: 'open', label: en ? 'Open' : 'Ανοιχτή' }, { value: 'done', label: en ? 'Done' : 'Ολοκληρώθηκε' }]} onChange={value => setAction(index, { status: value })} />
          <span className="review-action-tools">{capaButton(action)}<IconButton label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ actions: review.actions.filter((_, position: number) => position !== index) })}><Trash2 size={15} /></IconButton></span>
        </div>)}{!review.actions.length && <div className="inline-empty">{en ? 'No decisions yet.' : 'Δεν υπάρχουν αποφάσεις ακόμη.'}</div>}</div>}
    </RecordTabPanel>}
    {tab === 'people' && <RecordTabPanel title={en ? 'Participants and signatures' : 'Συμμετέχοντες και υπογραφές'} subtitle={allSigned ? (en ? 'Everyone present has signed: the review can be approved.' : 'Υπέγραψαν όλοι οι παρόντες: η ανασκόπηση μπορεί να εγκριθεί.') : (en ? 'The review is approved once everyone present has signed.' : 'Η ανασκόπηση εγκρίνεται όταν υπογράψουν όλοι οι παρόντες.')} actions={!locked && <Button variant="secondary" onClick={() => set({ participants: [...review.participants, { name: '', role: '', attended: true, signedAt: null }] })}><Plus size={15} />{en ? 'Participant' : 'Συμμετέχων'}</Button>} footer={footer}>
      {locked
        ? <RegistryTable className="review-decisions-table" rows={review.participants} rowKey={(person, index) => person.id || index}
          columns={[{ key: 'n', label: '#' }, { key: 'name', label: en ? 'Name' : 'Ονοματεπώνυμο' }, { key: 'role', label: en ? 'Role' : 'Ιδιότητα' }, { key: 'present', label: en ? 'Present' : 'Παρουσία' }, { key: 'signed', label: en ? 'Signature' : 'Υπογραφή' }]}
          renderRow={(person, index) => <>
            <td>{index + 1}</td>
            <td><strong>{person.name || '—'}</strong></td>
            <td>{person.role || '—'}</td>
            <td>{person.attended === false ? (en ? 'Absent' : 'Απών') : (en ? 'Present' : 'Παρών')}</td>
            <td>{person.attended !== false && (person.signedAt ? <StatusBadge tone="success">{en ? 'Signed' : 'Υπέγραψε'} {formatDay(person.signedAt, language)}</StatusBadge> : '—')}</td>
          </>} />
        : <div className="review-actions">{review.participants.map((person: AnyRecord, index: number) => <div key={person.id || index} className="review-action-row">
          <Field label={`${index + 1}. ${en ? 'Name' : 'Ονοματεπώνυμο'}`}><input value={person.name} onChange={event => setPerson(index, { name: event.target.value })} /></Field>
          <Field label={en ? 'Role' : 'Ιδιότητα'}><input value={person.role} onChange={event => setPerson(index, { role: event.target.value })} /></Field>
          <ChoiceField label={en ? 'Present' : 'Παρών'} value={person.attended === false ? 'no' : 'yes'} options={[{ value: 'yes', label: en ? 'Present' : 'Παρών' }, { value: 'no', label: en ? 'Absent' : 'Απών' }]} onChange={value => setPerson(index, { attended: value === 'yes', signedAt: value === 'yes' ? person.signedAt : null })} />
          <span className="review-action-tools">{person.attended !== false && (person.signedAt ? <StatusBadge tone="success">{en ? 'Signed' : 'Υπέγραψε'} {formatDay(person.signedAt, language)}</StatusBadge> : <Button variant="secondary" disabled={!person.name} onClick={() => setPerson(index, { signedAt: new Date().toISOString() })}>{en ? 'Mark signed' : 'Υπογραφή'}</Button>)}<IconButton label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ participants: review.participants.filter((_, position: number) => position !== index) })}><Trash2 size={15} /></IconButton></span>
        </div>)}</div>}
    </RecordTabPanel>}
  </EntityRecordShell></Page>
}
