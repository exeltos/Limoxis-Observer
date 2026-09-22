import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { IconButton } from '../../design-system/IconButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { deleteHospitalStructureSnapshot, loadHospitalStructureHistory, saveHospitalStructureSnapshot } from './hospitalStructureCloudService'

const todayIso = () => new Date().toISOString().slice(0, 10)
const emptyDraft = { effectiveDate: todayIso(), totalBeds: '', icuBeds: '', singleRooms: '', infectionControlNurses: '', infectiousDiseasePhysicians: '', microbiologists: '', notes: '' }

export function HospitalStructurePanel() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError, confirm } = useFeedback()
  const { role, tenant } = useTenant()
  const isPlatformOwner = role === ROLES.PLATFORM_OWNER
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [editor, setEditor] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)

  useEffect(() => {
    if (!tenant?.id) return
    let active = true
    setLoading(true)
    loadHospitalStructureHistory(tenant.id).then(data => { if (active) setRows(data) }).catch(error => notifyError(error, 'load', { operation: 'hospital_structure_load' })).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tenant?.id, notifyError])

  async function save() {
    if (!draft.effectiveDate) { notify(en ? 'A date is required.' : 'Απαιτείται ημερομηνία.', 'danger'); return }
    try {
      const saved = await saveHospitalStructureSnapshot(tenant.id, draft)
      setRows(current => [saved, ...current])
      setEditor(false)
      setDraft(emptyDraft)
      notify(en ? 'Structural snapshot saved.' : 'Η καταχώριση αποθηκεύτηκε.', 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'hospital_structure_save' })
    }
  }

  async function remove(id) {
    const ok = await confirm({ message: en ? 'Delete this entry? This removes it from the structural change history.' : 'Διαγραφή αυτής της καταχώρισης; Θα αφαιρεθεί από το ιστορικό μεταβολών δομής.', danger: true, confirmLabel: en ? 'Delete' : 'Διαγραφή' })
    if (!ok) return
    try {
      await deleteHospitalStructureSnapshot(tenant.id, id)
      setRows(current => current.filter(row => row.id !== id))
      notify(en ? 'Entry deleted.' : 'Η καταχώριση διαγράφηκε.', 'success')
    } catch (error) {
      notifyError(error, 'delete', { operation: 'hospital_structure_delete' })
    }
  }

  return (
    <section className="management-section management-scroll-section">
      <div className="section-toolbar">
        <div>
          <h2>{en ? 'Structural / staffing indicators' : 'Δομικοί / ποιοτικοί δείκτες'}</h2>
          <p>{en ? 'Total beds, ICU beds, single rooms, and infection-control staffing (ΥΑ 388/2014 §2.8). Every change is recorded as a new dated entry, keeping the full history required by law.' : 'Σύνολο κλινών, κλίνες ΜΕΘ, μονόκλινα δωμάτια και στελέχωση ΕΝΛ (ΥΑ 388/2014 §2.8). Κάθε αλλαγή καταχωρίζεται ως νέα, χρονολογημένη εγγραφή, διατηρώντας το πλήρες ιστορικό που απαιτεί ο νόμος.'}</p>
        </div>
        <Button onClick={() => setEditor(true)}>+ {en ? 'New entry' : 'Νέα καταχώριση'}</Button>
      </div>
      {loading && <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div>}
      {!loading && !rows.length && <div className="inline-empty">{en ? 'No structural entries recorded yet.' : 'Δεν έχουν καταχωριστεί δομικά στοιχεία.'}</div>}
      {!loading && Boolean(rows.length) && (
        <div className="record-table-wrap">
          <table className="record-table">
            <thead><tr><th>{en ? 'Effective date' : 'Ημερομηνία ισχύος'}</th><th>{en ? 'Total beds' : 'Σύνολο κλινών'}</th><th>{en ? 'ICU beds' : 'Κλίνες ΜΕΘ'}</th><th>{en ? 'Single rooms' : 'Μονόκλινα'}</th><th>{en ? 'IC nurses' : 'ΝΕΛ'}</th><th>{en ? 'ID physicians' : 'Λοιμωξιολόγοι'}</th><th>{en ? 'Microbiologists' : 'Μικροβιολόγοι'}</th>{isPlatformOwner && <th/>}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <td>{row.effectiveDate}</td><td>{row.totalBeds ?? '—'}</td><td>{row.icuBeds ?? '—'}</td><td>{row.singleRooms ?? '—'}</td><td>{row.infectionControlNurses ?? '—'}</td><td>{row.infectiousDiseasePhysicians ?? '—'}</td><td>{row.microbiologists ?? '—'}</td>
              {isPlatformOwner && <td><IconButton tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => remove(row.id)}><Trash2 size={16} /></IconButton></td>}
            </tr>)}</tbody>
          </table>
        </div>
      )}
      {editor && <StructureDialog en={en} draft={draft} setDraft={setDraft} onClose={() => setEditor(false)} onSave={save} />}
    </section>
  )
}

function StructureDialog({ en, draft, setDraft, onClose, onSave }) {
  const field = (key, label) => (
    <label><span>{label}</span><input type="number" min="0" value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} /></label>
  )
  return (
    <div className="modal-backdrop">
      <div className="entry-card">
        <header><h3>{en ? 'New structural entry' : 'Νέα δομική καταχώριση'}</h3><button className="icon-close" onClick={onClose}>×</button></header>
        <div className="entry-grid">
          <ManualDateField label={en ? 'Effective date' : 'Ημερομηνία ισχύος'} value={draft.effectiveDate} onChange={value => setDraft(d => ({ ...d, effectiveDate: value }))} />
          {field('totalBeds', en ? 'Total beds' : 'Σύνολο κλινών')}
          {field('icuBeds', en ? 'ICU beds' : 'Κλίνες ΜΕΘ')}
          {field('singleRooms', en ? 'Single rooms' : 'Μονόκλινα δωμάτια')}
          {field('infectionControlNurses', en ? 'Infection control nurses' : 'Νοσηλευτές ΕΝΛ (ΝΕΛ)')}
          {field('infectiousDiseasePhysicians', en ? 'Infectious disease physicians' : 'Λοιμωξιολόγοι')}
          {field('microbiologists', en ? 'Microbiologists' : 'Μικροβιολόγοι')}
          <label className="entry-span-2"><span>{en ? 'Notes' : 'Σημειώσεις'}</span><textarea rows={3} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></label>
        </div>
        <footer><Button variant="secondary" onClick={onClose}>{en ? 'Cancel' : 'Ακύρωση'}</Button><SaveButton disabled={!draft.effectiveDate} onClick={onSave}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></footer>
      </div>
    </div>
  )
}
