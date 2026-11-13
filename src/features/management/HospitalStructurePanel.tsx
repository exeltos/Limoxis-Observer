import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { HospitalStructureSnapshot } from './managementTypes'
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
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { hospitalToday } from '../../core/dates/hospitalDate'

const todayIso = () => hospitalToday()
type StructureDraft = Record<'effectiveDate' | 'totalBeds' | 'icuBeds' | 'singleRooms' | 'infectionControlNurses' | 'infectiousDiseasePhysicians' | 'microbiologists' | 'notes', string>
const emptyDraft: StructureDraft = { effectiveDate: todayIso(), totalBeds: '', icuBeds: '', singleRooms: '', infectionControlNurses: '', infectiousDiseasePhysicians: '', microbiologists: '', notes: '' }

export function HospitalStructurePanel() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError, confirm } = useFeedback()
  const { role, tenant } = useTenant()
  const fmt = (value: string | null | undefined) => value ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR').format(new Date(`${value}T12:00:00`)) : '—'
  const isPlatformOwner = role === ROLES.PLATFORM_OWNER
  const [rows, setRows] = useState<HospitalStructureSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [editor, setEditor] = useState(false)
  const [draft, setDraft] = useState<StructureDraft>(emptyDraft)

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
      const saved = await saveHospitalStructureSnapshot(tenant?.id, draft)
      setRows(current => [saved, ...current])
      setEditor(false)
      setDraft(emptyDraft)
      notify(en ? 'Structural snapshot saved.' : 'Η καταχώριση αποθηκεύτηκε.', 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'hospital_structure_save' })
    }
  }

  async function remove(id: string) {
    const ok = await confirm({ message: en ? 'Delete this entry? This removes it from the structural change history.' : 'Διαγραφή αυτής της καταχώρισης; Θα αφαιρεθεί από το ιστορικό μεταβολών δομής.', danger: true, confirmLabel: en ? 'Delete' : 'Διαγραφή' })
    if (!ok) return
    try {
      await deleteHospitalStructureSnapshot(tenant?.id, id)
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
          <p>{en ? 'Beds and infection-control staffing (Ministerial Decision 388/2014). Every change is kept as a new dated entry.' : 'Κλίνες και στελέχωση ΕΝΛ (ΥΑ 388/2014). Κάθε αλλαγή κρατιέται ως νέα, χρονολογημένη εγγραφή.'}</p>
        </div>
        <Button onClick={() => setEditor(true)}><Plus size={15} />{en ? 'New entry' : 'Νέα καταχώρηση'}</Button>
      </div>
      {loading && <TableSkeleton/>}
      {!loading && <RegistryTable
        wrapperClassName="table-wrap scroll-table"
        columns={[{ key: 'date', label: en ? 'Effective date' : 'Ημερομηνία ισχύος' }, { key: 'beds', label: en ? 'Total beds' : 'Σύνολο κλινών' }, { key: 'icu', label: en ? 'ICU beds' : 'Κλίνες ΜΕΘ' }, { key: 'single', label: en ? 'Single rooms' : 'Μονόκλινα' }, { key: 'nurses', label: en ? 'IC nurses' : 'ΝΕΛ' }, { key: 'id', label: en ? 'ID physicians' : 'Λοιμωξιολόγοι' }, { key: 'micro', label: en ? 'Microbiologists' : 'Μικροβιολόγοι' }, ...(isPlatformOwner ? [{ key: 'actions', label: '' }] : [])]}
        rows={rows}
        rowKey={row => row.id}
        renderRow={row => <>
          <td><strong>{fmt(row.effectiveDate)}</strong></td><td>{row.totalBeds ?? '—'}</td><td>{row.icuBeds ?? '—'}<ShareOf part={row.icuBeds} whole={row.totalBeds} en={en} /></td><td>{row.singleRooms ?? '—'}<ShareOf part={row.singleRooms} whole={row.totalBeds} en={en} /></td><td>{row.infectionControlNurses ?? '—'}<BedsPerNurse beds={row.totalBeds} nurses={row.infectionControlNurses} en={en} /></td><td>{row.infectiousDiseasePhysicians ?? '—'}</td><td>{row.microbiologists ?? '—'}</td>
          {isPlatformOwner && <td><OverflowMenu items={[{ id: 'delete', label: en ? 'Delete' : 'Διαγραφή', icon: Trash2, tone: 'danger', onClick: () => remove(row.id) }]} /></td>}
        </>}
        emptyTitle={en ? 'No structural entries recorded yet.' : 'Δεν έχουν καταχωριστεί δομικά στοιχεία.'}
      />}
      {editor && <StructureDialog en={en} draft={draft} setDraft={setDraft} onClose={() => setEditor(false)} onSave={save} />}
    </section>
  )
}

// What the figures say: the share of the beds, and the beds per infection-control nurse against the WHO minimum
// (at least one full-time IPC nurse per 250 beds, WHO core components of IPC programmes).
export const WHO_BEDS_PER_IPC_NURSE = 250
const number = (value: unknown) => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value))
export function ShareOf({ part, whole, en }: { part: unknown, whole: unknown, en: boolean }) {
  const a = number(part), b = number(whole)
  if (a == null || !b) return null
  return <small className="structure-derived">{`${String(Math.round((a / b) * 1000) / 10).replace('.', en ? '.' : ',')}%`}</small>
}
export function BedsPerNurse({ beds, nurses, en }: { beds: unknown, nurses: unknown, en: boolean }) {
  const b = number(beds), n = number(nurses)
  if (!b || n == null) return null
  if (n === 0) return <small className="structure-derived is-bad">{en ? 'no IPC nurse' : 'χωρίς ΝΕΛ'}</small>
  const per = Math.round(b / n)
  return <small className={`structure-derived${per > WHO_BEDS_PER_IPC_NURSE ? ' is-bad' : ''}`} title={en ? 'WHO minimum: 1 IPC nurse per 250 beds' : 'Ελάχιστο ΠΟΥ: 1 ΝΕΛ ανά 250 κλίνες'}>{en ? `1 per ${per} beds` : `1 ανά ${per} κλίνες`}</small>
}

function StructureDialog({ en, draft, setDraft, onClose, onSave }: { en: boolean, draft: StructureDraft, setDraft: Dispatch<SetStateAction<StructureDraft>>, onClose: () => void, onSave: () => void }) {
  const field = (key: keyof StructureDraft, label: string) => (
    <label><span>{label}</span><input type="number" min="0" value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} /></label>
  )
  return (
    <ObserverDialog width="standard" title={en ? 'New structural entry' : 'Νέα δομική καταχώρηση'} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={onSave} disabled={!draft.effectiveDate} />}>
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
