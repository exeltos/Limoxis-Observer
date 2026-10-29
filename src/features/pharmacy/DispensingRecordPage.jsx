import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pill } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { EmptyState } from '../../design-system/EmptyState'
import { MonthField } from '../../design-system/MonthField'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { useRecordDelete } from '../recycle-bin/useRecordDelete'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import { loadAntibioticDispensingRecords, loadPharmacySupportData, saveAntibioticDispensingRecord } from './pharmacyCloudService'
import { loadAntibioticDispensingLocal, saveAntibioticDispensingLocal } from './pharmacyStore'

const BACK = '/pharmacy?tab=consumption'
const monthNow = () => new Date().toISOString().slice(0, 7)
const formatPeriod = (period, en) => /^\d{4}-\d{2}$/.test(String(period || '')) ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric' }).format(new Date(`${period}-15T12:00:00`)) : (period || '—')

// A dispensing period (or a new one) is a page of its own, like the other records: Back returns to the list,
// saving or deleting does too.
export function DispensingRecordPage() {
  const { recordId } = useParams()
  const isNew = recordId === 'new'
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { notify, notifyError } = useFeedback()
  const { role, membership, tenant } = useTenant()
  const canRecord = can(role, CAPABILITIES.RECORD_PHARMACY_CONSUMPTION, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const deleteItem = useRecordDelete()
  const [support, setSupport] = useState(null)
  const [initial, setInitial] = useState(null)
  const [missing, setMissing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!tenant?.id) return undefined
    let alive = true
    Promise.all([loadPharmacySupportData(tenant.id), isNew ? Promise.resolve([]) : loadAntibioticDispensingRecords(tenant.id)]).then(([supportData, rows]) => {
      if (!alive) return
      setSupport(supportData)
      if (isNew) {
        setDraft({ period: monthNow(), departmentScope: 'hospital', departmentEl: '', antibioticItemId: supportData.products[0]?.id || '', product: supportData.products[0]?.el || '', quantityGrams: '', method: 'manual', referenceNumber: '', responsible: '', notes: '' })
        return
      }
      const row = rows.find(item => String(item.id) === String(recordId))
      if (!row) return setMissing(true)
      setInitial(row)
      setDraft({ ...row, periodKind: /^\d{4}-\d{2}$/.test(String(row.period || '')) ? 'month' : 'range' })
    }).catch(error => { if (alive) { notifyError(error, 'load', { operation: 'antibiotic_dispensing_load' }); setMissing(true) } })
    return () => { alive = false }
  }, [recordId, isNew, tenant?.id, notifyError])

  const chooseProduct = id => { const item = support.products.find(x => x.id === id); setDraft(d => ({ ...d, antibioticItemId: id, product: item?.el || '' })) }
  const chooseDepartment = value => { if (value === '') { setDraft(d => ({ ...d, departmentScope: 'hospital', departmentEl: '' })); return } setDraft(d => ({ ...d, departmentScope: 'department', departmentEl: value })) }
  const set = key => event => setDraft(d => ({ ...d, [key]: event.target.value }))

  async function save() {
    setBusy(true)
    try {
      await saveAntibioticDispensingRecord(tenant.id, draft, { existingId: initial?.id || null })
      signalDemoStep('antimicrobial_consumption', 'save')
      notify(en ? 'Dispensing period saved.' : 'Η περίοδος χορήγησης αποθηκεύτηκε.', 'success')
      navigate(BACK)
    } catch (error) {
      notifyError(error, 'save', { operation: 'antibiotic_dispensing_save' })
    } finally { setBusy(false) }
  }

  if (missing) return <Page fill><EmptyState title={en ? 'Dispensing period not found' : 'Η εγγραφή δεν βρέθηκε'} description="" /></Page>
  if (!draft || !support) return <RouteLoading />
  const disabled = busy || !canRecord || !draft.period || !draft.antibioticItemId || !draft.quantityGrams
  const remove = initial && canRecord ? deleteItem({
    createdBy: initial.createdById,
    table: 'antibiotic_dispensing_periods',
    id: initial.id,
    label: initial.product,
    detail: formatPeriod(initial.period, en),
    demo: async () => { saveAntibioticDispensingLocal(loadAntibioticDispensingLocal().filter(item => item.id !== initial.id)) },
    onDone: async () => navigate(BACK),
  }) : null
  return (
    <Page fill>
      <EntityRecordShell className="workspace-fill" avatar={<Pill size={19} />} eyebrow={en ? 'Pharmacy' : 'Φαρμακείο'}
        title={initial ? (en ? 'Dispensing period' : 'Περίοδος χορήγησης') : (en ? 'New dispensing period' : 'Νέα περίοδος χορήγησης')}
        subtitle={en ? 'Monthly antibiotic quantity for the consumption indicator (DDD).' : 'Μηνιαία ποσότητα αντιβιοτικού για τον δείκτη κατανάλωσης (DDD).'}
        tabs={[]} activeTab="" onTabChange={() => {}} onBack={() => navigate(BACK)}>
        <section className="record-section">
          <div className="entry-grid">
            {draft.periodKind === 'range'
              ? <label><span>{en ? 'Period' : 'Περίοδος'}</span><input disabled value={`${formatPeriod(String(draft.periodStart || '').slice(0, 7), en)} – ${formatPeriod(String(draft.periodEnd || '').slice(0, 7), en)}`} /></label>
              : <MonthField label={en ? 'Month' : 'Μήνας'} required value={draft.period} onChange={value => setDraft(d => ({ ...d, period: value }))} />}
            <label><span>{en ? 'Department' : 'Τμήμα'}</span><select value={draft.departmentEl} onChange={e => chooseDepartment(e.target.value)}><option value="">{en ? 'Whole hospital' : 'Όλο το νοσοκομείο'}</option>{support.departments.map(x => <option key={x.id} value={x.el}>{en ? x.en : x.el}</option>)}</select></label>
            <label><span>{en ? 'Antibiotic' : 'Αντιβιοτικό'}</span><select value={draft.antibioticItemId} onChange={e => chooseProduct(e.target.value)}>{support.products.map(x => <option key={x.id} value={x.id}>{en ? (x.en || x.el) : x.el}</option>)}</select></label>
            <label><span>{en ? 'Quantity (grams)' : 'Ποσότητα (γραμμάρια)'}</span><input type="number" min="0" step="0.01" value={draft.quantityGrams} onChange={set('quantityGrams')} /></label>
            <label><span>{en ? 'Responsible' : 'Υπεύθυνος'}</span><input value={draft.responsible} onChange={set('responsible')} /></label>
            <label><span>{en ? 'Reference number' : 'Αριθμός αναφοράς'}</span><input value={draft.referenceNumber} onChange={set('referenceNumber')} /></label>
            <label className="entry-span-2"><span>{en ? 'Notes' : 'Σημειώσεις'}</span><textarea rows={3} value={draft.notes} onChange={set('notes')} /></label>
          </div>
          <div className="inline-edit-footer">
            {remove && <Button variant="secondary" disabled={busy} onClick={remove.onClick}>{remove.label}</Button>}
            <Button variant="secondary" onClick={() => navigate(BACK)}>{en ? 'Cancel' : 'Άκυρο'}</Button>
            {canRecord && <Button disabled={disabled} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</Button>}
          </div>
        </section>
      </EntityRecordShell>
    </Page>
  )
}
