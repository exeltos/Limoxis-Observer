import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, BookMarked, ExternalLink, Plus, Send, Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { FormCard, FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { MultiSelect } from '../../design-system/MultiSelect'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { IconButton } from '../../design-system/IconButton'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useLegislationAccess } from './legislationAccess'
import { loadLibrary, publishText, removeText, saveText, setCandidate } from './legislationService'
import { KINDS, TEXT_STATUSES, TOPICS, hasUnpublished, newText, requirementId, textFromCandidate, textProblems, textStatusLabel, textStatusTone, unpublishedChanges } from './legislationModel'
import './legislation.css'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

// The Platform Owner's working copy of a text: saved as often as needed,
// published as a new version when ready. Publishing e-mails every hospital's
// administrator and quality manager.
export function LegislationEditorPage() {
  const { textId } = useParams()
  const isNew = textId === 'new'
  const location = useLocation()
  const navigate = useNavigate()
  const base = location.pathname.startsWith('/platform') ? '/platform/legislation' : '/legislation'
  const { goBack } = useContextualNavigation(`${base}?tab=library`)
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const candidate = location.state?.candidate || null
  const [library, setLibrary] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(null)

  useEffect(() => {
    let active = true
    loadLibrary().then(data => {
      if (!active) return
      setLibrary(data)
      const found = data.texts.find(item => item.id === textId)
      setDraft(current => current || (isNew ? (candidate ? textFromCandidate(candidate) : newText()) : found ? structuredClone(found) : false))
    }).catch(() => active && setLibrary({ texts: [], versions: [] }))
    return () => { active = false }
  }, [textId, isNew, candidate])

  const { isPlatformOwner } = useLegislationAccess()
  const lastSnapshot = useMemo(() => library?.versions.filter(item => item.textId === textId).sort((a, b) => a.version - b.version).at(-1)?.snapshot || null, [library, textId])
  if (!isPlatformOwner) return <Navigate to={base} replace />
  if (!library || draft === null) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (draft === false) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Text not found' : 'Το κείμενο δεν βρέθηκε'}</strong></div></Page>

  const set = next => setDraft(current => ({ ...current, ...next }))
  const setRequirement = (index, next) => setDraft(current => ({ ...current, requirements: current.requirements.map((item, at) => (at === index ? { ...item, ...next } : item)) }))
  const move = (index, step) => setDraft(current => { const list = [...current.requirements]; const [item] = list.splice(index, 1); list.splice(index + step, 0, item); return { ...current, requirements: list } })
  const saved = library.texts.find(item => item.id === draft.id)
  const changes = unpublishedChanges(draft, lastSnapshot)
  const savedChanges = saved ? unpublishedChanges(saved, lastSnapshot) : null
  const dirty = !saved || JSON.stringify({ ...saved, updatedAt: null }) !== JSON.stringify({ ...draft, updatedAt: null })

  async function save({ quiet = false } = {}) {
    if (String(draft.title || '').trim().length < 3) { notify(en ? 'Give the text a title.' : 'Δώστε τίτλο στο κείμενο.', 'error'); return null }
    setSaving(true)
    try {
      const next = await saveText({ ...draft, requirements: draft.requirements.filter(item => String(item.text || '').trim()) })
      if (candidate) await setCandidate(candidate.id, { status: 'linked', linkedTextId: next.id }).catch(() => {})
      const data = await loadLibrary()
      setLibrary(data)
      setDraft(structuredClone(data.texts.find(item => item.id === next.id) || next))
      if (!quiet) notify(en ? 'Saved. Hospitals see it when you publish.' : 'Αποθηκεύτηκε. Τα νοσοκομεία το βλέπουν όταν το δημοσιεύσετε.', 'success')
      if (isNew) navigate(`${base}/library/${next.id}`, { replace: true })
      return next
    } catch (error) { console.error(error); notify(en ? 'Could not save.' : 'Δεν ήταν δυνατή η αποθήκευση.', 'error'); return null } finally { setSaving(false) }
  }
  function startPublish() {
    const problems = textProblems(draft, language)
    if (problems.length) { notify(`${en ? 'Before publishing:' : 'Πριν τη δημοσίευση:'} ${problems.join(' · ')}`, 'error'); return }
    setPublishing({ note: '' })
  }
  async function publish() {
    if (lastSnapshot && !String(publishing.note || '').trim()) { notify(en ? 'Say what changed: the hospitals read it in the e-mail.' : 'Γράψτε τι άλλαξε: τα νοσοκομεία το διαβάζουν στο email.', 'error'); return }
    setSaving(true)
    try {
      const stored = dirty ? await save({ quiet: true }) : draft
      if (!stored) return
      const version = await publishText(stored.id, publishing.note)
      setPublishing(null)
      notify(en ? `Version ${version} published: the hospitals are e-mailed.` : `Η έκδοση ${version} δημοσιεύτηκε: στάλθηκε email στα νοσοκομεία.`, 'success')
      const data = await loadLibrary()
      setLibrary(data)
      setDraft(structuredClone(data.texts.find(item => item.id === stored.id)))
    } catch (error) { console.error(error); notify(en ? 'Could not publish.' : 'Δεν ήταν δυνατή η δημοσίευση.', 'error') } finally { setSaving(false) }
  }
  async function remove() {
    if (!(await confirm({ title: en ? 'Delete text' : 'Διαγραφή κειμένου', message: en ? 'Only a text never published can be deleted.' : 'Διαγράφεται μόνο κείμενο που δεν έχει δημοσιευτεί.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true }))) return
    try { await removeText(draft.id); goBack() } catch { notify(en ? 'Could not delete.' : 'Δεν διαγράφηκε.', 'error') }
  }

  const publishable = hasUnpublished(changes)
  const publishButton = <Button disabled={saving || !publishable} title={!publishable ? (en ? 'Nothing new to publish' : 'Δεν υπάρχει κάτι νέο για δημοσίευση') : undefined} onClick={startPublish}><Send size={15} />{draft.version ? (en ? `Publish version ${draft.version + 1}` : `Δημοσίευση έκδοσης ${draft.version + 1}`) : (en ? 'Publish' : 'Δημοσίευση')}</Button>
  const headerActions = !isNew && !draft.version && <div className="row-actions">
    <IconButton tone="danger" label={en ? 'Delete text' : 'Διαγραφή κειμένου'} onClick={remove}><Trash2 size={16} /></IconButton>
  </div>
  const changedFieldLabels = { title: en ? 'title' : 'τίτλος', titleEn: en ? 'English title' : 'αγγλικός τίτλος', kind: en ? 'kind' : 'είδος', reference: en ? 'reference' : 'δημοσίευση', issuer: en ? 'issuer' : 'φορέας', issuedOn: en ? 'date' : 'ημερομηνία', summary: en ? 'summary' : 'περίληψη', url: 'link', status: en ? 'status' : 'κατάσταση', topics: en ? 'topics' : 'θέματα' }

  return <Page fill><EntityRecordShell className="quality-record-shell leg-record-shell workspace-fill" avatar={<BookMarked size={19} />} eyebrow={draft.code ? `${draft.code}${draft.version ? ` · v${draft.version}` : ''}` : (en ? 'New text' : 'Νέο κείμενο')} title={draft.title || (en ? 'New text' : 'Νέο κείμενο')}
    subtitle={en ? 'Platform library' : 'Βιβλιοθήκη πλατφόρμας'}
    status={<span className="leg-status"><StatusBadge tone={textStatusTone(draft.status)}>{textStatusLabel(draft.status, language)}</StatusBadge><StatusBadge tone={draft.version ? (savedChanges && hasUnpublished(savedChanges) ? 'warning' : 'success') : 'info'}>{draft.version ? (savedChanges && hasUnpublished(savedChanges) ? (en ? 'Unpublished changes' : 'Μη δημοσιευμένες αλλαγές') : (en ? 'Published' : 'Δημοσιευμένο')) : (en ? 'Not published' : 'Μη δημοσιευμένο')}</StatusBadge></span>}
    headerActions={headerActions} tabs={[{ id: 'edit', label: en ? 'Text and requirements' : 'Κείμενο και απαιτήσεις', icon: BookMarked }]} activeTab="edit" onTabChange={() => {}} onBack={goBack}>
    <RecordTabPanel title={en ? 'Text and requirements' : 'Κείμενο και απαιτήσεις'} subtitle={draft.version && publishable ? (en ? `Not yet published: ${[...changes.fields.map(key => changedFieldLabels[key]), changes.requirements.length ? `${changes.requirements.length} requirements` : '', (changes.removed || []).length ? `${changes.removed.length} removed` : ''].filter(Boolean).join(', ')}.` : `Δεν έχουν δημοσιευτεί: ${[...changes.fields.map(key => changedFieldLabels[key]), changes.requirements.length ? `${changes.requirements.length} απαιτήσεις` : '', (changes.removed || []).length ? `${changes.removed.length} αφαιρέθηκαν` : ''].filter(Boolean).join(', ')}.`) : ''}
      footer={<div className="inline-edit-footer"><Button variant="secondary" onClick={goBack}>{en ? 'Close' : 'Κλείσιμο'}</Button><SaveButton loading={saving} disabled={saving || !dirty} onClick={() => save()}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>{publishButton}</div>}>
      <div className="lo-form-cards">
        {candidate && <div className="leg-update"><strong>{en ? 'From the automatic check' : 'Από τον αυτόματο έλεγχο'}</strong><span>{candidate.title}{candidate.url && <> · <a href={candidate.url} target="_blank" rel="noreferrer">{en ? 'open' : 'άνοιγμα'} <ExternalLink size={12} /></a></>}</span></div>}
        <FormCard wide title={en ? 'The text' : 'Το κείμενο'}>
          <Field label={en ? 'Title *' : 'Τίτλος *'}><input value={draft.title} onChange={e => set({ title: e.target.value })} /></Field>
          <FormGrid columns={3}>
            <SearchableSelect label={en ? 'Kind' : 'Είδος'} value={draft.kind} options={KINDS.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => set({ kind: value || 'other' })} {...selectText(en)} />
            <Field label={en ? 'Reference * (e.g. Government Gazette)' : 'Δημοσίευση * (π.χ. ΦΕΚ Β΄ 1537/2012)'}><input value={draft.reference} onChange={e => set({ reference: e.target.value })} /></Field>
            <Field label={en ? 'Issued by' : 'Φορέας έκδοσης'}><input value={draft.issuer} onChange={e => set({ issuer: e.target.value })} /></Field>
            <ManualDateField label={en ? 'Date' : 'Ημερομηνία'} value={draft.issuedOn} onChange={value => set({ issuedOn: value })} optional />
            <SearchableSelect label={en ? 'Status' : 'Κατάσταση'} value={draft.status} options={TEXT_STATUSES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => set({ status: value || 'in_force' })} {...selectText(en)} />
            <Field label={en ? 'Official link' : 'Σύνδεσμος επίσημου κειμένου'}><input value={draft.url} onChange={e => set({ url: e.target.value })} inputMode="url" placeholder="https://" /></Field>
          </FormGrid>
          <MultiSelect label={en ? 'Topics' : 'Θέματα'} selected={draft.topics} options={TOPICS.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={topics => set({ topics })} placeholder={en ? 'Choose topics' : 'Επιλέξτε θέματα'} searchPlaceholder={en ? 'Search…' : 'Αναζήτηση…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} selectAllLabel={en ? 'All' : 'Όλα'} clearAllLabel={en ? 'None' : 'Κανένα'} countLabel={count => (en ? `${count} topics` : `${count} θέματα`)} />
          <Field label={en ? 'Summary (what it asks of a hospital)' : 'Περίληψη (τι ζητά από ένα νοσοκομείο)'}><textarea rows={3} value={draft.summary} onChange={e => set({ summary: e.target.value })} /></Field>
        </FormCard>
        <FormCard wide title={en ? `Requirements ${draft.requirements.length}` : `Απαιτήσεις ${draft.requirements.length}`} hint={en ? 'Each one is a point a hospital assesses. Changing its wording puts it back to review in every hospital.' : 'Κάθε απαίτηση είναι ένα σημείο που αξιολογεί το νοσοκομείο. Αν αλλάξει η διατύπωσή της, ξαναμπαίνει σε επανεξέταση σε κάθε νοσοκομείο.'}>
          <ol className="leg-requirements leg-requirements-edit">{draft.requirements.map((item, index) => <li key={item.id} className={changes.requirements.includes(item.id) && draft.version ? 'is-changed' : ''}>
            <div className="leg-requirement-row">
              <textarea rows={2} value={item.text} onChange={e => setRequirement(index, { text: e.target.value })} aria-label={`${en ? 'Requirement' : 'Απαίτηση'} ${index + 1}`} placeholder={en ? 'What the hospital must have or do' : 'Τι πρέπει να έχει ή να κάνει το νοσοκομείο'} />
              <div className="row-actions">
                <IconButton size="sm" label={en ? 'Up' : 'Πάνω'} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></IconButton>
                <IconButton size="sm" label={en ? 'Down' : 'Κάτω'} disabled={index === draft.requirements.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></IconButton>
                <IconButton size="sm" tone="danger" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => setDraft(current => ({ ...current, requirements: current.requirements.filter((_, at) => at !== index) }))}><Trash2 size={14} /></IconButton>
              </div>
            </div>
            <input className="leg-guidance-input" value={item.guidance || ''} onChange={e => setRequirement(index, { guidance: e.target.value })} placeholder={en ? 'Guidance for the hospital (optional): article, what counts as evidence' : 'Οδηγία για το νοσοκομείο (προαιρετικό): άρθρο, τι αποτελεί τεκμήριο'} />
          </li>)}</ol>
          <Button variant="secondary" onClick={() => setDraft(current => ({ ...current, requirements: [...current.requirements, { id: requirementId(), text: '' }] }))}><Plus size={15} />{en ? 'Requirement' : 'Απαίτηση'}</Button>
        </FormCard>
      </div>
    </RecordTabPanel>
    {publishing && <ObserverDialog title={draft.version ? (en ? `Publish version ${draft.version + 1}` : `Δημοσίευση έκδοσης ${draft.version + 1}`) : (en ? 'Publish to every hospital' : 'Δημοσίευση σε όλα τα νοσοκομεία')} subtitle={draft.title} onClose={() => setPublishing(null)}
      footer={<DialogActions onCancel={() => setPublishing(null)} onSave={publish} saveLabel={en ? 'Publish and e-mail' : 'Δημοσίευση και email'} disabled={saving} />}>
      <div className="leg-form">
        <p className="leg-note">{draft.version ? (en ? `${changes.requirements.length} requirements are new or changed: every hospital reviews them again. What hospitals declared for the others stays.` : `${changes.requirements.length} απαιτήσεις είναι νέες ή άλλαξαν: κάθε νοσοκομείο τις επανεξετάζει. Όσα έχουν δηλώσει τα νοσοκομεία για τις υπόλοιπες μένουν.`) : (en ? 'Every hospital sees the text as new and decides whether it applies.' : 'Κάθε νοσοκομείο βλέπει το κείμενο ως νέο και αποφασίζει αν το αφορά.')}</p>
        <Field label={draft.version ? (en ? 'What changed *' : 'Τι άλλαξε *') : (en ? 'Note to the hospitals (optional)' : 'Σημείωμα προς τα νοσοκομεία (προαιρετικό)')}><textarea rows={3} value={publishing.note} onChange={e => setPublishing({ note: e.target.value })} /></Field>
        <p className="leg-note">{en ? 'An e-mail goes to the administrator and the quality manager of every hospital (not to hospitals that marked the text as not applying).' : 'Στέλνεται email στον διαχειριστή και στον υπεύθυνο ποιότητας κάθε νοσοκομείου (όχι σε όσα έχουν δηλώσει ότι το κείμενο δεν τα αφορά).'}</p>
      </div>
    </ObserverDialog>}
  </EntityRecordShell></Page>
}
