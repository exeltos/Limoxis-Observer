import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, FilePlus2, ListChecks } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ChecklistAnswers } from '../../design-system/ChecklistAnswers'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { FormCard } from '../../design-system/FormCard'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { SectionHeader } from '../../design-system/SectionHeader'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { loadControlProgramme } from '../controls/controlCloudService'
import { auditChecklistFromControl, auditChecklistFromText, auditCompliance, auditProgramme, checklistTemplates, findingDraftFromRow, pendingFindings } from './qualityAudit'
import { createQualityRecord, saveQualityRecord } from './qualityService'
import { qualityCode, qualityStatusTone } from './qualityVocabulary'

// The controls that are checklists, offered as audit checklists.
function useChecklistTemplates(organizationId) {
  const [templates, setTemplates] = useState([])
  useEffect(() => {
    let active = true
    loadControlProgramme(organizationId).then(controls => { if (active) setTemplates(checklistTemplates(controls)) }).catch(() => { if (active) setTemplates([]) })
    return () => { active = false }
  }, [organizationId])
  return templates
}

// New audit: the checklist from a control that is a checklist, or typed here.
export function AuditChecklistSource({ draft, setDraft, organizationId, language }) {
  const en = language === 'en'
  const templates = useChecklistTemplates(organizationId)
  const [mode, setMode] = useState(draft.checklistSource === 'manual' ? 'manual' : 'template')
  const [text, setText] = useState('')
  const templateId = String(draft.checklistSource || '').startsWith('control:') ? draft.checklistSource.slice(8) : ''
  const options = useMemo(() => templates.map(control => ({ value: String(control.id), label: en ? control.titleEn || control.title : control.title, description: `${control.responseConfig.checklist.length} ${en ? 'items' : 'σημεία'}` })), [templates, en])
  const chooseTemplate = id => {
    const control = templates.find(item => String(item.id) === id)
    setDraft(current => ({ ...current, checklistSource: control ? `control:${control.id}` : '', checklist: control ? auditChecklistFromControl(control) : [] }))
  }
  const typeItems = value => { setText(value); setDraft(current => ({ ...current, checklistSource: 'manual', checklist: auditChecklistFromText(value) })) }
  return <FormCard wide title={en ? 'Checklist' : 'Λίστα ελέγχου'} icon={ListChecks} hint={draft.checklist?.length ? (en ? `${draft.checklist.length} items` : `${draft.checklist.length} σημεία`) : en ? 'Optional; can be added later.' : 'Προαιρετικά· προστίθεται και αργότερα.'}>
    <ChoiceField label={en ? 'Items from' : 'Σημεία από'} value={mode} options={[{ value: 'template', label: en ? 'A checklist in Controls' : 'Λίστα ελέγχου των Ελέγχων' }, { value: 'manual', label: en ? 'Typed here' : 'Τα γράφω εδώ' }]} onChange={value => { setMode(value); setDraft(current => ({ ...current, checklistSource: '', checklist: [] })); setText('') }} />
    {mode === 'template'
      ? <SearchableSelect label={en ? 'Checklist' : 'Λίστα ελέγχου'} value={templateId} options={options} onChange={chooseTemplate} placeholder={templates.length ? (en ? 'Choose a checklist' : 'Επιλέξτε λίστα') : en ? 'No checklist in Controls yet' : 'Δεν υπάρχει ακόμη λίστα ελέγχου στους Ελέγχους'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel={en ? 'Clear' : 'Καθαρισμός'} />
      : <Field label={en ? 'Items, one per line' : 'Σημεία, ένα ανά γραμμή'}><textarea rows={5} value={text} onChange={event => typeItems(event.target.value)} placeholder={en ? 'e.g. Hand rub available at the bedside' : 'π.χ. Διαθέσιμο αντισηπτικό δίπλα στην κλίνη'} /></Field>}
    {draft.checklist?.length > 0 && <ol className="quality-audit-preview">{draft.checklist.slice(0, 6).map(row => <li key={row.id}>{en ? row.itemEn || row.item : row.item}</li>)}{draft.checklist.length > 6 && <li className="is-more">{en ? `and ${draft.checklist.length - 6} more` : `και ${draft.checklist.length - 6} ακόμη`}</li>}</ol>}
  </FormCard>
}

// The audit's checklist tab: answer, save, complete, turn each «No» into a finding.
export function AuditChecklistTab({ record, setRecord, organizationId, canManage, finalized, language, actor, notify, userId }) {
  const en = language === 'en'
  const [rows, setRows] = useState(record.checklist || [])
  const { goTo } = useContextualNavigation('/quality')
  // A «No» shows the finding it became; one click opens it (and «Back» returns here).
  const findingLink = row => row.findingId && <button type="button" className="quality-audit-finding-link" onClick={() => goTo(`/quality/findings/${row.findingId}`, { tab: 'checklist' })}>{en ? 'Finding' : 'Εύρημα'} {row.findingId}<ChevronRight size={13} /></button>
  const [saving, setSaving] = useState(false)
  const [text, setText] = useState('')
  useEffect(() => { setRows(record.checklist || []) }, [record.checklist])
  const editable = canManage && !finalized
  const dirty = JSON.stringify(rows) !== JSON.stringify(record.checklist || [])
  const pending = pendingFindings(rows)
  const complete = rows.length > 0 && rows.every(row => row.required === false || row.answer)
  const setRow = (index, key, value) => setRows(current => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)))

  async function persist(next, message) {
    setSaving(true)
    try {
      const saved = await saveQualityRecord('audits', organizationId, next)
      setRecord(saved)
      notify?.(message, 'success')
      return saved
    } catch (error) {
      console.error(error)
      notify?.(en ? 'The audit could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση της επιθεώρησης.', 'error')
      return null
    } finally { setSaving(false) }
  }
  const history = (action, extra = {}) => [{ at: new Date().toISOString(), action, actor: actor?.name || '', ...extra }, ...(record.history || [])]
  const save = () => persist({ ...record, checklist: rows, status: record.status === 'planned' && rows.some(row => row.answer) ? 'inProgress' : record.status, history: history('recordUpdated') }, en ? 'Checklist saved.' : 'Η λίστα ελέγχου αποθηκεύτηκε.')
  const finish = () => persist({ ...record, checklist: rows, status: 'completed', completedDate: record.completedDate || new Date().toISOString().slice(0, 10), history: history('auditCompleted') }, en ? 'Audit completed.' : 'Η επιθεώρηση ολοκληρώθηκε.')
  const addItems = () => { const added = auditChecklistFromText(text).map((row, index) => ({ ...row, id: `item-${Date.now().toString(36)}-${index}` })); if (added.length) { setRows(current => [...current, ...added]); setText('') } }

  // Each «No» without a finding becomes one; the row keeps its id so it is created once.
  async function createFindings() {
    if (!pending.length || saving) return
    setSaving(true)
    try {
      const created = []
      for (const row of pending) {
        const finding = await createQualityRecord('findings', organizationId, { ...findingDraftFromRow(record, row, language), reportedByLabel: actor?.name || '', history: [{ at: new Date().toISOString(), action: 'findingCreated', actor: actor?.name || '' }] }, userId)
        created.push([row.id, finding?.id || finding?.code])
      }
      const ids = new Map(created)
      const nextRows = rows.map(row => (ids.has(row.id) ? { ...row, findingId: ids.get(row.id) } : row))
      setRows(nextRows)
      const saved = await saveQualityRecord('audits', organizationId, { ...record, checklist: nextRows, history: history('findingCreated') })
      setRecord(saved)
      notify?.(en ? `${created.length} finding(s) created; open them in «Linked records».` : `Δημιουργήθηκαν ${created.length} ευρήματα· θα τα βρείτε στις «Συνδεδεμένες εγγραφές».`, 'success')
    } catch (error) {
      console.error(error)
      notify?.(en ? 'The findings could not be created.' : 'Δεν ήταν δυνατή η δημιουργία των ευρημάτων.', 'error')
    } finally { setSaving(false) }
  }

  if (!rows.length && !editable) return <div className="record-section"><SectionHeader title={en ? 'Checklist' : 'Λίστα ελέγχου'} /><div className="inline-empty">{en ? 'This audit has no checklist.' : 'Η επιθεώρηση δεν έχει λίστα ελέγχου.'}</div></div>
  return <div className="record-section quality-audit-checklist">
    {rows.length > 0 && <ChecklistAnswers rows={rows} rowExtra={findingLink} language={language} disabled={!editable} onRowChange={setRow} onRowsChange={setRows} title={en ? 'Audit checklist' : 'Λίστα ελέγχου επιθεώρησης'} />}
    {editable && <div className="quality-audit-add"><Field label={rows.length ? (en ? 'Add items, one per line' : 'Προσθήκη σημείων, ένα ανά γραμμή') : (en ? 'Items, one per line' : 'Σημεία, ένα ανά γραμμή')}><textarea rows={2} value={text} onChange={event => setText(event.target.value)} /></Field><Button variant="secondary" disabled={!text.trim()} onClick={addItems}><FilePlus2 size={15} /> {en ? 'Add' : 'Προσθήκη'}</Button></div>}
    {(pending.length > 0 || rows.some(row => row.findingId)) && <div className={`governance-banner ${pending.length ? 'warning' : 'success'} quality-audit-findings`}><ClipboardCheck size={17} /><span>{pending.length ? (en ? `«No» answers without a finding: ${pending.length}. Each becomes a finding with its own corrective action.` : `Απαντήσεις «Όχι» χωρίς εύρημα: ${pending.length}. Καθεμία γίνεται εύρημα με τη δική του διορθωτική ενέργεια.`) : (en ? 'Every «No» has its finding.' : 'Κάθε «Όχι» έχει το εύρημά του.')}</span>{canManage && pending.length > 0 && !dirty && <Button disabled={saving} onClick={createFindings}>{en ? 'Create findings' : 'Δημιουργία ευρημάτων'}</Button>}</div>}
    {editable && <div className="inline-edit-footer quality-audit-footer">
      <span className="quality-audit-score">{en ? `${rows.filter(row => row.answer).length} of ${rows.length} answered` : `${rows.filter(row => row.answer).length} από ${rows.length} απαντήθηκαν`}</span>
      <SaveButton loading={saving} disabled={!dirty || saving} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>
      <Button disabled={!complete || saving || dirty} onClick={finish}><CheckCircle2 size={15} /> {en ? 'Complete audit' : 'Ολοκλήρωση επιθεώρησης'}</Button>
    </div>}
  </div>
}

// The year's audits month by month (Quality > Audits > Programme).
export function AuditProgramme({ audits = [], language, t, onOpen }) {
  const en = language === 'en'
  const years = useMemo(() => [...new Set(audits.map(audit => String(audit.plannedDate || audit.completedDate || '').slice(0, 4)).filter(Boolean))].sort(), [audits])
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const months = auditProgramme(audits, Number(year))
  const monthName = month => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long' }).format(new Date(Date.UTC(2026, month, 15)))
  const choices = [...new Set([...years, String(new Date().getFullYear())])].sort()
  return <div className="quality-audit-programme">
    <div className="quality-audit-programme-head"><CalendarDays size={16} /><strong>{en ? 'Audit programme' : 'Πρόγραμμα επιθεωρήσεων'}</strong><ChoiceField label={en ? 'Year' : 'Έτος'} value={year} options={choices.slice(-3).map(value => ({ value, label: value }))} onChange={setYear} /></div>
    <ol className="quality-audit-months">{months.map(({ month, audits: items }) => <li key={month} className={items.length ? '' : 'is-empty'}>
      <span className="quality-audit-month">{monthName(month)}</span>
      {items.length ? items.map(audit => { const score = auditCompliance(audit); return <button type="button" key={audit.id} onClick={() => onOpen?.(audit)}><strong>{en ? audit.titleEn || audit.title : audit.title}</strong><small>{formatDay(audit.plannedDate, language)}{audit.department ? ` · ${en ? audit.departmentEn || audit.department : audit.department}` : ''}{score.rate != null ? ` · ${score.rate}%` : ''}</small><span className="quality-audit-chip-foot"><code>{qualityCode(audit, language)}</code><StatusBadge tone={qualityStatusTone(audit.status)}>{t(audit.status)}</StatusBadge></span></button> }) : <small>{en ? 'No audit' : 'Καμία επιθεώρηση'}</small>}
    </li>)}</ol>
  </div>
}
