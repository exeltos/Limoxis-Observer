import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { RegistryTable } from '../../design-system/RegistryTable'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
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
  const fmt = value => value ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR').format(new Date(`${value}T12:00:00`)) : '—'
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
          <p>{en ? 'Total beds, ICU beds, single rooms, and infection-control staffing (Ministerial Decision 388/2014 §2.8). Every change is recorded as a new dated entry, keeping the full history required by law.' : 'Σύνολο κλινών, κλίνες ΜΕΘ, μονόκλινα δωμάτια και στελέχωση ΕΝΛ (ΥΑ 388/2014 §2.8). Κάθε αλλαγή καταχωρίζεται ως νέα, χρονολογημένη εγγραφή, διατηρώντας το πλήρες ιστορικό που απαιτεί ο νόμος.'}</p>
        </div>
        <Button onClick={() => setEditor(true)}><Plus size={15} />{en ? 'New entry' : 'Νέα καταχώρηση'}</Button>
      </div>
      {loading && <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div>}
      {!loading && <RegistryTable
        wrapperClassName="table-wrap scroll-table"
        columns={[{ key: 'date', label: en ? 'Effective date' : 'Ημερομηνία ισχύος' }, { key: 'beds', label: en ? 'Total beds' : 'Σύνολο κλινών' }, { key: 'icu', label: en ? 'ICU beds' : 'Κλίνες ΜΕΘ' }, { key: 'single', label: en ? 'Single rooms' : 'Μονόκλινα' }, { key: 'nurses', label: en ? 'IC nurses' : 'ΝΕΛ' }, { key: 'id', label: en ? 'ID physicians' : 'Λοιμωξιολόγοι' }, { key: 'micro', label: en ? 'Microbiologists' : 'Μικροβιολόγοι' }, ...(isPlatformOwner ? [{ key: 'actions', label: '' }] : [])]}
        rows={rows}
        rowKey={row => row.id}
        renderRow={row => <>
          <td><strong>{fmt(row.effectiveDate)}</strong></td><td>{row.totalBeds ?? '—'}</td><td>{row.icuBeds ?? '—'}</td><td>{row.singleRooms ?? '—'}</td><td>{row.infectionControlNurses ?? '—'}</td><td>{row.infectiousDiseasePhysicians ?? '—'}</td><td>{row.microbiologists ?? '—'}</td>
          {isPlatformOwner && <td><OverflowMenu items={[{ id: 'delete', label: en ? 'Delete' : 'Διαγραφή', icon: Trash2, tone: 'danger', onClick: () => remove(row.id) }]} /></td>}
        </>}
        emptyTitle={en ? 'No structural entries recorded yet.' : 'Δεν έχουν καταχωριστεί δομικά στοιχεία.'}
      />}
      {editor && <StructureDialog en={en} draft={draft} setDraft={setDraft} onClose={() => setEditor(false)} onSave={save} />}
    </section>
  )
}

function StructureDialog({ en, draft, setDraft, onClose, onSave }) {
  const field = (key, label) => (
    <label><span>{label}</span><input type="number" min="0" value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} /></label>
  )
  return (
    <ObserverDialog width="standard" title={en ? 'New structural entry' : 'Νέα δομική καταχώρηση'} onClose={onClose} footer={<DialogActions showCancel onCancel={onClose} onSave={onSave} disabled={!draft.effectiveDate} />}>
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
    </ObserverDialog>
  )
}
