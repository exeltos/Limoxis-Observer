import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { IconButton } from '../../design-system/IconButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { RegistryTable } from '../../design-system/RegistryTable'
import { formatDay } from '../../core/i18n/formatDay'
import { addCapaProgress, removeCapaProgress } from './qualityService'

const today = () => new Date().toISOString().slice(0, 10)

// CAPA tab «Progress»: dated notes on how the action is going (quality_capa_progress), newest first.
export function QualityCapaProgress({ record, setRecord, canManage, finalized, organizationId, actor, notify, language }) {
  const en = language === 'en'
  const entries = record.progress || []
  // The note is written in a dialog, like every other record tab.
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const editable = canManage && !finalized

  async function run(action, message) {
    setSaving(true)
    try {
      setRecord({ ...(await action()) })
      notify(message, 'success')
      return true
    } catch (error) {
      console.error(error)
      notify(en ? 'The progress note could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση της σημείωσης προόδου.', 'error')
      return false
    } finally { setSaving(false) }
  }
  async function add() {
    if (!draft?.note?.trim() || !draft.date) return
    if (await run(() => addCapaProgress(organizationId, record, { ...draft, author: actor?.name || '' }), en ? 'Progress noted.' : 'Η πρόοδος καταγράφηκε.')) setDraft(null)
  }
  const remove = entry => void run(() => removeCapaProgress(organizationId, record, entry.id), en ? 'Note removed.' : 'Η σημείωση αφαιρέθηκε.')

  return <RecordTabPanel className="quality-capa-panel" title={en ? 'Progress' : 'Πρόοδος'} subtitle={en ? 'Dated notes on how the action is going: what was done, what is holding it up.' : 'Σημειώσεις με ημερομηνία για την πορεία της ενέργειας: τι έγινε, τι την καθυστερεί.'}
    actions={editable && <Button onClick={() => setDraft({ date: today(), note: '' })}><Plus size={15} />{en ? 'Add note' : 'Προσθήκη σημείωσης'}</Button>}>
    {entries.length > 0 && <RegistryTable bare className="quality-steps-table" rows={entries} rowKey={entry => entry.id}
      columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'note', label: en ? 'Note' : 'Σημείωση' }, { key: 'author', label: en ? 'By' : 'Από' }, { key: 'menu', label: '', className: 'quality-step-menu-col' }]}
      renderRow={entry => <tr>
        <td>{formatDay(entry.date, language)}</td>
        <td>{entry.note}</td>
        <td>{entry.author || '—'}</td>
        <td className="quality-step-menu-col">{editable && <IconButton size="sm" tone="danger" label={en ? 'Remove note' : 'Αφαίρεση σημείωσης'} disabled={saving} onClick={() => remove(entry)}><Trash2 size={14} /></IconButton>}</td>
      </tr>} />}
    {!entries.length && <div className="inline-empty">{en ? 'No progress notes yet.' : 'Δεν υπάρχουν ακόμη σημειώσεις προόδου.'}</div>}
    {draft && <ObserverDialog title={en ? 'Progress note' : 'Σημείωση προόδου'} onClose={() => setDraft(null)} footer={<DialogActions onCancel={() => setDraft(null)} onSave={add} disabled={saving || !draft.note.trim() || !draft.date} saveLabel={en ? 'Save' : 'Αποθήκευση'} />}>
      <ManualDateField label={en ? 'Date' : 'Ημερομηνία'} value={draft.date} onChange={value => setDraft(current => ({ ...current, date: value }))} />
      <Field label={`${en ? 'Progress note' : 'Σημείωση προόδου'} *`}><textarea rows={3} autoFocus value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} placeholder={en ? 'e.g. Training done for 2 of 3 shifts' : 'π.χ. Ολοκληρώθηκε η εκπαίδευση σε 2 από 3 βάρδιες'} /></Field>
    </ObserverDialog>}
  </RecordTabPanel>
}
