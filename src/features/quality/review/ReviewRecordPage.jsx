import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ClipboardSignature, ListChecks, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../../design-system/PrintExportActions'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { IconButton } from '../../../design-system/IconButton'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useAuth } from '../../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../../core/audit/actor'
import { formatDay } from '../../../core/i18n/formatDay'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { loadQualityRecords } from '../qualityService'
import { loadReviews, saveReview } from './reviewService'
import { REVIEW_SECTIONS, addDays, newReviewFrom, reviewStatusLabel, sectionFacts } from './reviewTemplate'
import { ObjectiveBars, useObjectives } from './QualityObjectives'
import '../quality.css'

const escapeHtml = text => String(text ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char])

// The minutes as a Word document laid out like the hospital's form.
function downloadMinutes(review, organizationName) {
  const date = formatDay(review.reviewDate, 'el')
  const sections = review.sections.map((section, index) => `<h2>${index + 1}. ${escapeHtml(section.title)}</h2>${String(section.body || '').split(/\n+/).filter(Boolean).map(line => `<p>${escapeHtml(line)}</p>`).join('')}`).join('')
  const actions = review.actions.length ? `<h2>Αποφάσεις και ενέργειες</h2><table border="1" cellpadding="4" cellspacing="0"><tr><th>Α/Α</th><th>Ενέργεια</th><th>Υπεύθυνος</th><th>Προθεσμία</th></tr>${review.actions.map((action, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(action.title)}</td><td>${escapeHtml(action.ownerLabel)}</td><td>${formatDay(action.dueDate, 'el')}</td></tr>`).join('')}</table>` : ''
  const present = review.participants.filter(person => person.attended !== false)
  const absent = review.participants.filter(person => person.attended === false)
  const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(review.title)}</title><style>body{font-family:Calibri,Arial;font-size:11pt}h1{font-size:16pt}h2{font-size:12pt;margin-top:14pt}table{border-collapse:collapse;width:100%}</style></head><body>
<h1>${escapeHtml(review.title)}</h1><p><b>Πρακτικό Επιτροπής Ποιότητας</b> · ${escapeHtml(organizationName || '')}</p>
<p>Ημερομηνία ${date} &nbsp;|&nbsp; Συχνότητα συνεδρίασης: κάθε ${review.frequencyDays} ημέρες &nbsp;|&nbsp; Περίοδος ${formatDay(review.periodFrom, 'el')} – ${formatDay(review.periodTo, 'el')}</p>
<p><b>Συμμετέχοντες</b> ${present.map(person => escapeHtml(person.name)).join(', ')}.</p>${review.summary ? `<p>${escapeHtml(review.summary)}</p>` : ''}
${sections}${actions}
<h2>Υπογραφές συμμετεχόντων</h2><table border="1" cellpadding="4" cellspacing="0"><tr><th>ΑΑ</th><th>Ονοματεπώνυμο</th><th>Υπογραφή</th></tr>${present.map((person, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(person.name)}</td><td>${person.signedAt ? `Υπεγράφη ${formatDay(person.signedAt, 'el')}` : ''}</td></tr>`).join('')}</table>
<p>Απόντες ${absent.length ? absent.map(person => escapeHtml(person.name)).join(', ') : '________________'}</p></body></html>`
  const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${review.code || 'Anaskopisi'}_${review.reviewDate}.doc`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// The text of a section: as tall as what is written (no scrolling inside the
// card), and plain paragraphs once the review is approved.
function MinutesText({ label, value, locked, onChange }) {
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
  return <textarea ref={ref} aria-label={label} rows={3} value={value || ''} onChange={event => onChange(event.target.value)} />
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
  const [reviews, setReviews] = useState(null)
  const [review, setReview] = useState(null)
  const [tab, setTab] = useState('minutes')
  const [saving, setSaving] = useState(false)
  const [facts, setFacts] = useState({ incidents: [], capas: [], findings: [], audits: [] })
  const objectives = useObjectives(tenant?.id)
  const back = () => navigate('/quality', { replace: true })

  useEffect(() => {
    let active = true
    loadReviews(tenant?.id).then(rows => {
      if (!active) return
      setReviews(rows)
      const found = isNew ? newReviewFrom(rows.find(row => row.status === 'approved') || rows[0]) : rows.find(row => row.id === reviewId)
      setReview(found ? structuredClone(found) : null)
    }).catch(() => { if (active) setReviews([]) })
    Promise.all(['incidents', 'capas', 'findings', 'audits'].map(section => loadQualityRecords(section, tenant?.id).catch(() => []))).then(([incidents, capas, findings, audits]) => { if (active) setFacts({ incidents, capas, findings, audits }) })
    return () => { active = false }
  }, [tenant?.id, reviewId, isNew])

  const previous = useMemo(() => (reviews || []).filter(row => row.id !== review?.id && row.reviewDate <= (review?.reviewDate || '9999')).sort((a, b) => b.reviewDate.localeCompare(a.reviewDate))[0] || null, [reviews, review])
  if (!reviews) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (!review) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Review not found' : 'Η ανασκόπηση δεν βρέθηκε'}</strong></div></Page>

  const locked = review.status === 'approved' || !canManage
  const period = { from: review.periodFrom || '0000-01-01', to: review.periodTo || review.reviewDate }
  const data = { ...facts, objectives: objectives.objectives, previous }
  const set = next => setReview(current => ({ ...current, ...next }))
  const setSection = (key, body) => setReview(current => ({ ...current, sections: current.sections.map(section => (section.key === key ? { ...section, body } : section)) }))
  const setAction = (index, next) => setReview(current => ({ ...current, actions: current.actions.map((action, position) => (position === index ? { ...action, ...next } : action)) }))
  const setPerson = (index, next) => setReview(current => ({ ...current, participants: current.participants.map((person, position) => (position === index ? { ...person, ...next } : person)) }))
  const present = review.participants.filter(person => person.attended !== false)
  const allSigned = present.length > 0 && present.every(person => person.signedAt)

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
  function openCapa(action) {
    navigate('/quality/capas/new', { state: { qualitySource: { source: 'other', sourceId: `MR:${review.code || 'new'}`, title: action.title, dueDate: action.dueDate, description: en ? `Decision of the management review ${review.code} (${formatDay(review.reviewDate, 'en')}).` : `Απόφαση της Ανασκόπησης Διοίκησης ${review.code} (${formatDay(review.reviewDate, 'el')}).` } } })
  }

  const tabs = [
    { id: 'minutes', label: en ? 'Minutes' : 'Πρακτικό', icon: ClipboardSignature },
    { id: 'actions', label: en ? `Decisions ${review.actions.length}` : `Αποφάσεις ${review.actions.length}`, icon: ListChecks },
    { id: 'people', label: en ? `Participants ${review.participants.length}` : `Συμμετέχοντες ${review.participants.length}`, icon: Users },
  ]
  const footer = !locked && <div className="inline-edit-footer"><Button variant="secondary" onClick={back}>{en ? 'Close' : 'Κλείσιμο'}</Button><SaveButton loading={saving} disabled={saving} onClick={() => save()}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>{!isNew && <Button disabled={saving || !allSigned} onClick={() => save('approved')}><CheckCircle2 size={15} />{en ? 'Approve' : 'Έγκριση'}</Button>}</div>
  return <Page fill><EntityRecordShell className="quality-record-shell review-record-shell workspace-fill" avatar={<ClipboardSignature size={19} />} eyebrow={review.code || (en ? 'New' : 'Νέα')} title={review.title} subtitle={`${formatDay(review.reviewDate, language)} · ${en ? 'every' : 'κάθε'} ${review.frequencyDays} ${en ? 'days' : 'ημέρες'}`} status={<StatusBadge tone={review.status === 'approved' ? 'success' : 'info'}>{reviewStatusLabel(review.status, language)}</StatusBadge>} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={back}
>
    {tab === 'minutes' && <RecordTabPanel className="review-minutes" title={en ? 'Minutes' : 'Πρακτικό'} subtitle={en ? '«Insert data» adds what Limoxis holds for the period; edit it freely.' : 'Το «Στοιχεία του Limoxis» προσθέτει όσα υπάρχουν για την περίοδο· τα επεξεργάζεστε ελεύθερα.'} actions={<PrintExportActions showPrint={false} onExport={() => downloadMinutes(review, tenant?.name)} />} footer={footer}>
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
        {review.sections.map((section, index) => {
          const source = REVIEW_SECTIONS.find(item => item.key === section.key)?.source
          // The facts help write the minutes; an approved review shows its text only.
          const lines = source && !locked ? sectionFacts(source, data, period, language) : []
          return <FormCard key={section.key} wide title={`${index + 1}. ${en ? REVIEW_SECTIONS.find(item => item.key === section.key)?.titleEn || section.title : section.title}`}>
            {lines.length > 0 && <div className="review-facts"><span><Sparkles size={14} />{en ? 'From Limoxis' : 'Από το Limoxis'}</span><ul>{lines.map(line => <li key={line}>{line}</li>)}</ul><Button variant="secondary" onClick={() => setSection(section.key, [section.body, lines.join('\n')].filter(Boolean).join('\n'))}>{en ? 'Insert into the text' : 'Στοιχεία του Limoxis στο κείμενο'}</Button></div>}
            {section.key === 'objectives' && !locked && <ObjectiveBars objectives={objectives.objectives} />}
            <MinutesText label={section.title} value={section.body} locked={locked} onChange={value => setSection(section.key, value)} />
          </FormCard>
        })}
      </div>
    </RecordTabPanel>}
    {tab === 'actions' && <RecordTabPanel title={en ? 'Decisions and actions' : 'Αποφάσεις και ενέργειες'} subtitle={en ? 'Open actions of the previous review are carried over.' : 'Οι ανοιχτές ενέργειες της προηγούμενης ανασκόπησης μεταφέρονται εδώ.'} actions={!locked && <Button variant="secondary" onClick={() => set({ actions: [...review.actions, { title: '', ownerLabel: '', dueDate: '', status: 'open', sectionKey: '' }] })}><Plus size={15} />{en ? 'Decision' : 'Απόφαση'}</Button>} footer={footer}>
      <div className="review-actions">{review.actions.map((action, index) => <div key={action.id || index} className="review-action-row">
        <Field label={`${index + 1}. ${en ? 'Action' : 'Ενέργεια'}`}><input value={action.title} disabled={locked} onChange={event => setAction(index, { title: event.target.value })} /></Field>
        <Field label={en ? 'Owner' : 'Υπεύθυνος'}><input value={action.ownerLabel} disabled={locked} onChange={event => setAction(index, { ownerLabel: event.target.value })} /></Field>
        <ManualDateField label={en ? 'Due' : 'Προθεσμία'} value={action.dueDate} disabled={locked} onChange={value => setAction(index, { dueDate: value })} />
        <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={action.status} options={[{ value: 'open', label: en ? 'Open' : 'Ανοιχτή' }, { value: 'done', label: en ? 'Done' : 'Ολοκληρώθηκε' }]} onChange={value => !locked && setAction(index, { status: value })} />
        <span className="review-action-tools">{action.title && action.status === 'open' && canManage && <Button variant="secondary" onClick={() => openCapa(action)}>{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>}{!locked && <IconButton label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ actions: review.actions.filter((_, position) => position !== index) })}><Trash2 size={15} /></IconButton>}</span>
      </div>)}{!review.actions.length && <div className="inline-empty">{en ? 'No decisions yet.' : 'Δεν υπάρχουν αποφάσεις ακόμη.'}</div>}</div>
    </RecordTabPanel>}
    {tab === 'people' && <RecordTabPanel title={en ? 'Participants and signatures' : 'Συμμετέχοντες και υπογραφές'} subtitle={allSigned ? (en ? 'Everyone present has signed: the review can be approved.' : 'Υπέγραψαν όλοι οι παρόντες: η ανασκόπηση μπορεί να εγκριθεί.') : (en ? 'The review is approved once everyone present has signed.' : 'Η ανασκόπηση εγκρίνεται όταν υπογράψουν όλοι οι παρόντες.')} actions={!locked && <Button variant="secondary" onClick={() => set({ participants: [...review.participants, { name: '', role: '', attended: true, signedAt: null }] })}><Plus size={15} />{en ? 'Participant' : 'Συμμετέχων'}</Button>} footer={footer}>
      <div className="review-actions">{review.participants.map((person, index) => <div key={person.id || index} className="review-action-row">
        <Field label={`${index + 1}. ${en ? 'Name' : 'Ονοματεπώνυμο'}`}><input value={person.name} disabled={locked} onChange={event => setPerson(index, { name: event.target.value })} /></Field>
        <Field label={en ? 'Role' : 'Ιδιότητα'}><input value={person.role} disabled={locked} onChange={event => setPerson(index, { role: event.target.value })} /></Field>
        <ChoiceField label={en ? 'Present' : 'Παρών'} value={person.attended === false ? 'no' : 'yes'} options={[{ value: 'yes', label: en ? 'Present' : 'Παρών' }, { value: 'no', label: en ? 'Absent' : 'Απών' }]} onChange={value => !locked && setPerson(index, { attended: value === 'yes', signedAt: value === 'yes' ? person.signedAt : null })} />
        <span className="review-action-tools">{person.attended !== false && (person.signedAt ? <StatusBadge tone="success">{en ? 'Signed' : 'Υπέγραψε'} {formatDay(person.signedAt, language)}</StatusBadge> : !locked && <Button variant="secondary" disabled={!person.name} onClick={() => setPerson(index, { signedAt: new Date().toISOString() })}>{en ? 'Mark signed' : 'Υπογραφή'}</Button>)}{!locked && <IconButton label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ participants: review.participants.filter((_, position) => position !== index) })}><Trash2 size={15} /></IconButton>}</span>
      </div>)}</div>
    </RecordTabPanel>}
  </EntityRecordShell></Page>
}
