import { useCallback, useEffect, useMemo, useState } from 'react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { loadAntibioticDispensingRecords, loadPharmacySupportData, saveAntibioticDispensingRecord } from './pharmacyCloudService'
import { awareCategoryFor, awareCategoryLabel } from './whoAwareClassification'

const monthNow = () => new Date().toISOString().slice(0, 7)

export function PharmacyPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError } = useFeedback()
  const { role, membership, tenant } = useTenant()
  const addOns = useMemo(() => membership?.capabilities ?? [], [membership?.capabilities])
  const custom = useMemo(() => membership?.customCapabilities ?? [], [membership?.customCapabilities])
  const canRecord = can(role, CAPABILITIES.RECORD_PHARMACY_CONSUMPTION, addOns, custom)
  const [rows, setRows] = useState([])
  const [support, setSupport] = useState({ departments: [], products: [] })
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState(false)

  const reload = useCallback(async () => {
    if (!tenant?.id || !canRecord) { setRows([]); setSupport({ departments: [], products: [] }); return }
    setLoading(true)
    try {
      const [records, supportData] = await Promise.all([loadAntibioticDispensingRecords(tenant.id), loadPharmacySupportData(tenant.id)])
      setRows(records)
      setSupport(supportData)
    } catch (error) {
      notifyError(error, 'load', { operation: 'antibiotic_dispensing_load' })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, canRecord, notifyError])

  useEffect(() => { void reload() }, [reload])

  async function save(draft) {
    try {
      await saveAntibioticDispensingRecord(tenant.id, draft)
      setDialog(false)
      await reload()
      notify(en ? 'Dispensing period saved.' : 'Η περίοδος χορήγησης αποθηκεύτηκε.', 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'antibiotic_dispensing_save' })
    }
  }

  return (
    <Page title={en ? 'Pharmacy' : 'Φαρμακείο'} subtitle={en ? 'Antimicrobial stewardship, advanced antibiotics, approvals and consumption / DDD.' : 'Αντιμικροβιακή επιτήρηση, προωθημένα αντιβιοτικά, εγκρίσεις και κατανάλωση / DDD.'}
      actions={canRecord && <Button onClick={() => setDialog(true)}>+ {en ? 'Dispensing period' : 'Περίοδος χορήγησης'}</Button>}>
      {!canRecord && <div className="surface"><div className="inline-empty">{en ? 'You do not have access to record antibiotic consumption.' : 'Δεν έχετε πρόσβαση καταχώρισης κατανάλωσης αντιβιοτικών.'}</div></div>}
      {canRecord && (
        <div className="surface">
          <div className="inline-empty" style={{ marginBottom: 12 }}>
            {en
              ? 'Records here feed the ΥΑ 388/2014 antibiotic consumption indicator (DDD per 100 patient-days). DDD reference values per antibiotic must be verified by pharmacy staff against the current WHO ATC/DDD Index before this indicator is relied on for ΕΟΔΥ reporting.'
              : 'Οι καταχωρίσεις εδώ τροφοδοτούν τον δείκτη κατανάλωσης αντιβιοτικών της ΥΑ 388/2014 (DDD ανά 100 ασθενοημέρες). Οι τιμές αναφοράς DDD ανά αντιβιοτικό πρέπει να επαληθευτούν από το φαρμακείο έναντι του τρέχοντος επίσημου δείκτη WHO ATC/DDD πριν χρησιμοποιηθεί ο δείκτης για αναφορά στον ΕΟΔΥ.'}
          </div>
          {loading && <div className="registry-empty-state"><strong>{en ? 'Loading…' : 'Φόρτωση…'}</strong></div>}
          {!loading && !rows.length && <div className="inline-empty">{en ? 'No dispensing periods recorded yet.' : 'Δεν έχουν καταχωριστεί περίοδοι χορήγησης.'}</div>}
          {!loading && Boolean(rows.length) && (
            <div className="record-table-wrap">
              <table className="record-table">
                <thead><tr><th>{en ? 'Period' : 'Περίοδος'}</th><th>{en ? 'Department' : 'Τμήμα'}</th><th>{en ? 'Antibiotic' : 'Αντιβιοτικό'}</th><th>{en ? 'WHO AWaRe' : 'WHO AWaRe'}</th><th>{en ? 'Quantity' : 'Ποσότητα'}</th><th>{en ? 'Responsible' : 'Υπεύθυνος'}</th></tr></thead>
                <tbody>{rows.map(row => { const category = awareCategoryFor(row.productEn || row.product); return <tr key={row.id}><td>{row.period}</td><td>{en ? row.departmentEn : row.departmentEl}</td><td>{en ? (row.productEn || row.product) : row.product}</td><td>{category ? <span className={`status-badge aware-${category}`}>{awareCategoryLabel(category, language)}</span> : '—'}</td><td>{row.quantityGrams} g</td><td>{row.responsible || '—'}</td></tr> })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {dialog && <DispensingDialog en={en} support={support} onClose={() => setDialog(false)} onSave={save} />}
    </Page>
  )
}

function DispensingDialog({ en, support, onClose, onSave }) {
  const [draft, setDraft] = useState({ period: monthNow(), departmentScope: 'hospital', departmentEl: '', antibioticItemId: support.products[0]?.id || '', product: support.products[0]?.el || '', quantityGrams: '', method: 'manual', referenceNumber: '', responsible: '', notes: '' })
  const chooseProduct = id => { const item = support.products.find(x => x.id === id); setDraft(d => ({ ...d, antibioticItemId: id, product: item?.el || '' })) }
  const chooseDepartment = value => { if (value === '') { setDraft(d => ({ ...d, departmentScope: 'hospital', departmentEl: '' })); return } setDraft(d => ({ ...d, departmentScope: 'department', departmentEl: value })) }
  const disabled = !draft.period || !draft.antibioticItemId || !draft.quantityGrams
  return (
    <div className="modal-backdrop">
      <div className="entry-card">
        <header><h3>{en ? 'New dispensing period' : 'Νέα περίοδος χορήγησης'}</h3><button className="icon-close" onClick={onClose}>×</button></header>
        <div className="entry-grid">
          <label><span>{en ? 'Month' : 'Μήνας'}</span><input type="month" value={draft.period} onChange={e => setDraft(d => ({ ...d, period: e.target.value }))} /></label>
          <label><span>{en ? 'Department' : 'Τμήμα'}</span><select value={draft.departmentEl} onChange={e => chooseDepartment(e.target.value)}><option value="">{en ? 'Whole hospital' : 'Όλο το νοσοκομείο'}</option>{support.departments.map(x => <option key={x.id} value={x.el}>{en ? x.en : x.el}</option>)}</select></label>
          <label><span>{en ? 'Antibiotic' : 'Αντιβιοτικό'}</span><select value={draft.antibioticItemId} onChange={e => chooseProduct(e.target.value)}>{support.products.map(x => <option key={x.id} value={x.id}>{en ? (x.en || x.el) : x.el}</option>)}</select></label>
          <label><span>{en ? 'Quantity (grams)' : 'Ποσότητα (γραμμάρια)'}</span><input type="number" min="0" step="0.01" value={draft.quantityGrams} onChange={e => setDraft(d => ({ ...d, quantityGrams: e.target.value }))} /></label>
          <label><span>{en ? 'Responsible' : 'Υπεύθυνος'}</span><input value={draft.responsible} onChange={e => setDraft(d => ({ ...d, responsible: e.target.value }))} /></label>
          <label><span>{en ? 'Reference number' : 'Αριθμός αναφοράς'}</span><input value={draft.referenceNumber} onChange={e => setDraft(d => ({ ...d, referenceNumber: e.target.value }))} /></label>
          <label className="entry-span-2"><span>{en ? 'Notes' : 'Σημειώσεις'}</span><textarea rows={3} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></label>
        </div>
        <footer><Button variant="secondary" onClick={onClose}>{en ? 'Cancel' : 'Ακύρωση'}</Button><SaveButton disabled={disabled} onClick={() => onSave(draft)}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></footer>
      </div>
    </div>
  )
}
