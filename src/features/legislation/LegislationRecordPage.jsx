import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookOpenText, CheckCircle2, CheckSquare2, ClipboardList, ExternalLink, History, ListChecks, MinusCircle, PlusCircle, Scale } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { FormCard, FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { StatusBadge } from '../../design-system/StatusBadge'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { formatDay } from '../../core/i18n/formatDay'
import { exportRegistry } from '../../core/export/registryExports'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useLegislationAccess } from './legislationAccess'
import { loadRegister, saveRegisterRow } from './legislationService'
import { COMPLIANCE, buildRegister, complianceLabel, complianceTone, kindLabel, legislationCapaSource, registerStateLabel, registerStateTone, textStatusLabel, textStatusTone, todayIso, topicLabel } from './legislationModel'
import { ComplianceBar } from './LegislationPage'
import './legislation.css'

const plusYear = day => { const date = new Date(`${day}T12:00:00Z`); date.setUTCFullYear(date.getUTCFullYear() + 1); return date.toISOString().slice(0, 10) }

export function LegislationRecordPage() {
  const { textId } = useParams()
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/legislation')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const access = useLegislationAccess()
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  const [tab, setTab] = useState('requirements')
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try { setData(await loadRegister(tenant?.id)) } catch (error) { console.error(error); setData({ versions: [], rows: [] }) }
  }, [tenant?.id])
  useEffect(() => { void reload() }, [reload])
  const entry = useMemo(() => (data ? buildRegister(data.versions.filter(item => item.textId === textId), data.rows.filter(item => item.textId === textId))[0] || null : null), [data, textId])
  useEffect(() => { if (entry) setDraft(structuredClone(entry.row || { textId, applicable: true, acceptedVersion: 0, responsible: '', compliance: {}, nextReviewOn: '', notes: '' })) }, [entry, textId])

  if (!data || (entry && !draft)) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (!entry) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Text not found' : 'Το κείμενο δεν βρέθηκε'}</strong></div></Page>

  const { text, history } = entry
  const latest = history[history.length - 1]
  const accepted = history.find(item => item.version === (entry.row?.acceptedVersion || 0))
  const previousWording = new Map((accepted?.snapshot?.requirements || []).map(item => [item.id, item.text]))
  const locked = !access.canManage
  const set = next => setDraft(current => ({ ...current, ...next }))
  const setRequirement = (id, next) => setDraft(current => ({ ...current, compliance: { ...current.compliance, [id]: { ...(current.compliance?.[id] || {}), ...next, checkedOn: todayIso() } } }))

  async function persist(next, message, options) {
    setSaving(true)
    try {
      await saveRegisterRow(tenant?.id, next, options)
      notify(message || (en ? 'Saved.' : 'Αποθηκεύτηκε.'), 'success')
      await reload()
    } catch (error) { console.error(error); notify(en ? 'Could not save.' : 'Δεν ήταν δυνατή η αποθήκευση.', 'error') } finally { setSaving(false) }
  }
  const markApplies = applies => persist({ ...draft, applicable: applies, acceptedVersion: applies ? Math.max(draft.acceptedVersion || 0, entry.row ? draft.acceptedVersion || 0 : latest.version) : draft.acceptedVersion || latest.version, nextReviewOn: applies ? draft.nextReviewOn || plusYear(todayIso()) : draft.nextReviewOn }, applies ? (en ? 'Added to the register: assess each requirement.' : 'Προστέθηκε στο μητρώο: αξιολογήστε κάθε απαίτηση.') : (en ? 'Marked as not applying to the hospital.' : 'Σημειώθηκε ότι δεν αφορά το νοσοκομείο.'))
  const finishReview = () => persist({ ...draft, acceptedVersion: latest.version, nextReviewOn: draft.nextReviewOn && draft.nextReviewOn > todayIso() ? draft.nextReviewOn : plusYear(todayIso()) }, en ? `Version ${latest.version} reviewed.` : `Η έκδοση ${latest.version} επανεξετάστηκε.`, { reviewed: true })
  const openCapa = requirement => navigate('/quality/capas/new', { state: { qualitySource: legislationCapaSource(text, requirement, draft.compliance?.[requirement.id], language) } })

  const tabs = [
    { id: 'requirements', label: en ? `Requirements ${text.requirements.length}` : `Απαιτήσεις ${text.requirements.length}`, icon: ListChecks },
    { id: 'text', label: en ? 'Text' : 'Κείμενο', icon: BookOpenText },
    { id: 'versions', label: en ? `Versions ${history.length}` : `Εκδόσεις ${history.length}`, icon: History },
    { id: 'details', label: en ? 'Register' : 'Μητρώο', icon: ClipboardList },
  ]
  const exportRequirements = () => exportRegistry({ name: `${text.code}-${en ? 'compliance' : 'symmorfosi'}`, headers: en ? ['#', 'Requirement', 'Compliance', 'Evidence', 'Note', 'Checked on'] : ['#', 'Απαίτηση', 'Συμμόρφωση', 'Τεκμήριο', 'Σημείωση', 'Έλεγχος'], rows: text.requirements.map((item, index) => { const record = draft.compliance?.[item.id] || {}; return [index + 1, item.text, complianceLabel(record.status, language), record.evidence || '', record.note || '', record.checkedOn || ''] }) })
  const headerActions = <div className="row-actions">
    <PrintExportActions showPrint={false} onExport={exportRequirements} />
  </div>
  const footer = !locked && entry.row && <div className="inline-edit-footer"><SaveButton loading={saving} disabled={saving} onClick={() => persist(draft)}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></div>

  return <Page fill><EntityRecordShell className="quality-record-shell leg-record-shell workspace-fill" avatar={<Scale size={19} />} eyebrow={`${text.code} · v${text.version}`} title={text.title}
    subtitle={[kindLabel(text.kind, language), text.reference, text.issuer].filter(Boolean).join(' · ')}
    status={<span className="leg-status"><StatusBadge tone={registerStateTone(entry.state)}>{registerStateLabel(entry.state, language)}</StatusBadge>{text.status !== 'in_force' && <StatusBadge tone={textStatusTone(text.status)}>{textStatusLabel(text.status, language)}</StatusBadge>}</span>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'requirements' && <RecordTabPanel title={en ? 'Requirements and compliance' : 'Απαιτήσεις και συμμόρφωση'} subtitle={entry.state === 'new' ? (en ? 'First decide whether the text applies to the hospital.' : 'Ορίστε πρώτα αν το κείμενο αφορά το νοσοκομείο.') : entry.hasUpdate ? (en ? `Version ${latest.version} changed ${entry.changed.size} requirements: check them and finish the review.` : `Η έκδοση ${latest.version} άλλαξε ${entry.changed.size} απαιτήσεις: ελέγξτε τες και ολοκληρώστε την επανεξέταση.`) : ''} footer={footer}>
      <div className="leg-pad">
        {entry.state !== 'new' && entry.state !== 'not_applicable' && <div className="leg-summary"><ComplianceBar summary={entry.summary} language={language} /><span>{en ? `${entry.summary.compliant} compliant · ${entry.summary.partial} partly · ${entry.summary.non_compliant} not · ${entry.summary.unassessed} not assessed` : `${entry.summary.compliant} συμμορφώνονται · ${entry.summary.partial} μερικώς · ${entry.summary.non_compliant} όχι · ${entry.summary.unassessed} χωρίς αξιολόγηση`}</span></div>}
        {entry.state === 'new' && <div className="leg-decision"><div><strong>{en ? 'Does this text apply to the hospital?' : 'Αφορά αυτό το κείμενο το νοσοκομείο;'}</strong><span>{en ? 'If it does, it enters the register and you assess each requirement.' : 'Αν ναι, μπαίνει στο μητρώο και αξιολογείτε κάθε απαίτηση.'}</span></div>{!locked && <div className="row-actions"><Button disabled={saving} onClick={() => markApplies(true)}><PlusCircle size={15} />{en ? 'Applies to us' : 'Αφορά το νοσοκομείο'}</Button><Button variant="secondary" disabled={saving} onClick={() => markApplies(false)}><MinusCircle size={15} />{en ? 'Does not apply' : 'Δεν αφορά'}</Button></div>}</div>}
        {entry.state === 'not_applicable' && <div className="leg-decision"><div><strong>{en ? 'Marked as not applying to the hospital' : 'Σημειώθηκε ότι δεν αφορά το νοσοκομείο'}</strong><span>{en ? 'No e-mails are sent for its updates.' : 'Δεν στέλνονται email για τις ενημερώσεις του.'}</span></div>{!locked && <Button variant="secondary" disabled={saving} onClick={() => markApplies(true)}><PlusCircle size={15} />{en ? 'It applies after all' : 'Τελικά αφορά'}</Button>}</div>}
        {entry.hasUpdate && <div className="leg-update leg-decision"><div><strong>{en ? `What changed in version ${latest.version}` : `Τι άλλαξε στην έκδοση ${latest.version}`}</strong><span>{latest.changeNote || (en ? `${entry.changed.size} requirements are new or changed (marked below).` : `${entry.changed.size} απαιτήσεις είναι νέες ή άλλαξαν (σημειώνονται παρακάτω).`)}</span></div>{!locked && <Button disabled={saving} onClick={finishReview}><CheckCircle2 size={15} />{en ? 'Review done' : 'Ολοκλήρωση επανεξέτασης'}</Button>}</div>}
        <ol className="leg-requirements">
          {text.requirements.map(item => { const record = draft.compliance?.[item.id] || {}; const changed = entry.changed.has(item.id); const before = previousWording.get(item.id); return <li key={item.id} className={changed ? 'is-changed' : ''}>
            <div className="leg-requirement-head">
              <p>{item.text}</p>
              <span className="leg-requirement-badges">{changed && <StatusBadge tone="warning">{before ? (en ? 'Changed' : 'Άλλαξε') : (en ? 'New' : 'Νέα')}</StatusBadge>}<StatusBadge tone={complianceTone(record.status)}>{complianceLabel(record.status, language)}</StatusBadge></span>
            </div>
            {changed && before && before !== item.text && <p className="leg-before"><small>{en ? 'Before' : 'Πριν'}:</small> {before}</p>}
            {item.guidance && <p className="leg-guidance">{item.guidance}</p>}
            {entry.row && entry.row.applicable !== false && (locked ? <div className="leg-requirement-read">{record.evidence && <span><b>{en ? 'Evidence' : 'Τεκμήριο'}:</b> {record.evidence}</span>}{record.note && <span><b>{en ? 'Note' : 'Σημείωση'}:</b> {record.note}</span>}</div> : <div className="leg-requirement-edit">
              <ChoiceField label={en ? 'Compliance' : 'Συμμόρφωση'} value={record.status || ''} options={COMPLIANCE.map(option => ({ value: option.value, label: option.label[en ? 1 : 0] }))} onChange={status => setRequirement(item.id, { status })} />
              <FormGrid columns={2}>
                <Field label={en ? 'Evidence (document, record, control)' : 'Τεκμήριο (έγγραφο, μητρώο, έλεγχος)'}><input value={record.evidence || ''} onChange={e => setRequirement(item.id, { evidence: e.target.value })} /></Field>
                <Field label={en ? 'Note / finding' : 'Σημείωση / διαπίστωση'}><input value={record.note || ''} onChange={e => setRequirement(item.id, { note: e.target.value })} /></Field>
              </FormGrid>
              {['non_compliant', 'partial'].includes(record.status) && <Button variant="secondary" onClick={() => openCapa(item)}><CheckSquare2 size={15} />{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>}
            </div>)}
          </li> })}
        </ol>
      </div>
    </RecordTabPanel>}
    {tab === 'text' && <RecordTabPanel title={en ? 'The text' : 'Το κείμενο'} subtitle={en ? 'As published by the platform.' : 'Όπως το δημοσίευσε η πλατφόρμα.'}>
      <div className="leg-pad">
        <RecordDetailsGrid fields={[
          { label: en ? 'Kind' : 'Είδος', value: kindLabel(text.kind, language) },
          { label: en ? 'Reference' : 'Δημοσίευση', value: text.reference },
          { label: en ? 'Issued by' : 'Φορέας', value: text.issuer },
          { label: en ? 'Date' : 'Ημερομηνία', value: formatDay(text.issuedOn, language) },
          { label: en ? 'Status' : 'Κατάσταση', value: textStatusLabel(text.status, language) },
          { label: en ? 'Topics' : 'Θέματα', value: (text.topics || []).map(topic => topicLabel(topic, language)).join(', ') },
        ]} />
        {text.summary && <p className="leg-text-summary">{text.summary}</p>}
        {text.url && <a className="leg-link" href={text.url} target="_blank" rel="noreferrer"><ExternalLink size={14} />{en ? 'Open the official text' : 'Άνοιγμα του επίσημου κειμένου'}</a>}
      </div>
    </RecordTabPanel>}
    {tab === 'versions' && <RecordTabPanel title={en ? 'Versions' : 'Εκδόσεις'} subtitle={en ? 'Every version the platform published.' : 'Κάθε έκδοση που δημοσίευσε η πλατφόρμα.'}>
      <ol className="leg-versions">{[...history].reverse().map(item => <li key={item.version} className={item.version > (entry.row?.acceptedVersion || 0) && entry.row ? 'is-new' : ''}>
        <strong>v{item.version} · {formatDay(item.publishedAt, language)}</strong>
        <span>{item.changeNote || (item.version === 1 ? (en ? 'First publication.' : 'Πρώτη δημοσίευση.') : '—')}</span>
        <small>{en ? `${item.changedRequirements.length} requirements new or changed` : `${item.changedRequirements.length} απαιτήσεις νέες ή αλλαγμένες`}{entry.row && item.version === entry.row.acceptedVersion ? ` · ${en ? 'reviewed by the hospital' : 'επανεξετάστηκε από το νοσοκομείο'}` : ''}</small>
      </li>)}</ol>
    </RecordTabPanel>}
    {tab === 'details' && <RecordTabPanel title={en ? 'In the hospital register' : 'Στο μητρώο του νοσοκομείου'} footer={footer}>
      {entry.row ? <div className="lo-form-cards"><FormCard wide title={en ? 'Responsibility and review' : 'Ευθύνη και επανεξέταση'}>
        <FormGrid columns={2}>
          <Field label={en ? 'Responsible' : 'Υπεύθυνος'}><input value={draft.responsible || ''} disabled={locked} onChange={e => set({ responsible: e.target.value })} /></Field>
          <ManualDateField label={en ? 'Next review' : 'Επόμενη επανεξέταση'} value={draft.nextReviewOn} disabled={locked} onChange={value => set({ nextReviewOn: value })} optional />
        </FormGrid>
        <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={3} value={draft.notes || ''} disabled={locked} onChange={e => set({ notes: e.target.value })} /></Field>
        <p className="leg-note">{entry.row.reviewedAt ? (en ? `Last review: ${formatDay(entry.row.reviewedAt, language)} (version ${entry.row.acceptedVersion}).` : `Τελευταία επανεξέταση: ${formatDay(entry.row.reviewedAt, language)} (έκδοση ${entry.row.acceptedVersion}).`) : (en ? `Reviewed version: ${entry.row.acceptedVersion}.` : `Επανεξετασμένη έκδοση: ${entry.row.acceptedVersion}.`)}</p>
      </FormCard></div> : <div className="leg-pad"><p className="leg-note">{en ? 'Not in the register yet: decide above whether it applies.' : 'Δεν είναι ακόμη στο μητρώο: ορίστε επάνω αν αφορά το νοσοκομείο.'}</p></div>}
    </RecordTabPanel>}
  </EntityRecordShell></Page>
}
