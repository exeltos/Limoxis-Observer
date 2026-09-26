import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileWarning, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useLaboratoryRepository } from '../laboratory/hooks/useLaboratoryRepository'
import { loadPatients } from '../patients/patientsService'
import { runDataQualityChecks, SEVERITY_ORDER } from './dataQuality'
import { buildEarsNetRows, earsNetIsolates, EARS_NET_PATHOGENS, firstIsolates, toCsv } from './earsNet'
import { notifiableFindings, notificationStatus } from './notifiableFindings'
import { loadNotificationReports, saveNotificationReport } from './notificationReportsService'
import './ReportingPanel.css'

const fmtDate = value => (value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—')

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
}

function QualityChecks({ checks, tx }) {
  const failing = checks.filter(check => check.items.length).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.items.length - a.items.length)
  const passing = checks.filter(check => !check.items.length)
  return <section className="reporting-card">
    <header><FileWarning size={17} aria-hidden="true"/><div><h2>{tx('Ποιότητα δεδομένων', 'Data quality')}</h2><p>{tx('Ελλείψεις που αλλοιώνουν δείκτες, AMR και δηλώσεις. Επιλέξτε έναν έλεγχο για να δείτε τις εγγραφές.', 'Gaps that distort indicators, AMR and notifications. Open a check to see the records.')}</p></div></header>
    {failing.length === 0 && <p className="reporting-ok"><CheckCircle2 size={15} aria-hidden="true"/>{tx('Όλοι οι έλεγχοι πέρασαν.', 'All checks passed.')}</p>}
    <ul className="reporting-checks">{failing.map(check => <li key={check.id} className={`reporting-check reporting-${check.severity}`}>
      <details>
        <summary><span className="reporting-count">{check.items.length}</span><span className="reporting-check-title">{tx(check.el, check.en)}</span><span className="reporting-severity">{tx({ high: 'Υψηλή', medium: 'Μέτρια', low: 'Χαμηλή' }[check.severity], { high: 'High', medium: 'Medium', low: 'Low' }[check.severity])}</span></summary>
        {check.hintEl && <p className="reporting-hint">{tx(check.hintEl, check.hintEn)}</p>}
        <ul className="reporting-items">{check.items.slice(0, 50).map(item => <li key={`${check.id}-${item.id}`}><Link to={item.to}>{item.label}</Link><span>{item.detail}</span></li>)}</ul>
        {check.items.length > 50 && <p className="reporting-hint">{tx(`και ${check.items.length - 50} ακόμη`, `and ${check.items.length - 50} more`)}</p>}
      </details>
    </li>)}</ul>
    {passing.length > 0 && <p className="reporting-passed">{tx('Χωρίς ευρήματα:', 'No findings:')} {passing.map(check => tx(check.el, check.en)).join(' · ')}</p>}
  </section>
}

function NotificationRow({ finding, tx, en, onSave }) {
  const [draft, setDraft] = useState({ status: notificationStatus(finding), reference: finding.report?.reference || '', notifiedAt: finding.report?.notifiedAt || '' })
  const [saving, setSaving] = useState(false)
  const dirty = draft.status !== notificationStatus(finding) || draft.reference !== (finding.report?.reference || '') || draft.notifiedAt !== (finding.report?.notifiedAt || '')
  const save = async () => { setSaving(true); try { await onSave(finding, draft) } finally { setSaving(false) } }
  const id = finding.findingKey.replace(/[^a-zA-Z0-9]/g, '-')
  return <tr className={`reporting-status-${notificationStatus(finding)}`}>
    <td>{fmtDate(finding.date)}</td>
    <td><Link to={`/laboratory/${encodeURIComponent(finding.sample.id)}`}>{finding.sample.id}</Link><small>{en ? finding.sample.patientEn || finding.sample.patient : finding.sample.patient}</small></td>
    <td><strong>{en ? finding.rule.en : finding.rule.el}</strong><small>{finding.result.organism}</small></td>
    <td><label className="reporting-sr" htmlFor={`${id}-status`}>{tx('Κατάσταση', 'Status')}</label><select id={`${id}-status`} value={draft.status} onChange={event => setDraft(value => ({ ...value, status: event.target.value }))}><option value="pending">{tx('Εκκρεμεί', 'Pending')}</option><option value="notified">{tx('Δηλώθηκε', 'Notified')}</option><option value="not_required">{tx('Δεν απαιτείται', 'Not required')}</option></select></td>
    <td>{draft.status === 'notified' ? <ManualDateField className="reporting-date" label={tx('Ημερομηνία δήλωσης', 'Notification date')} value={draft.notifiedAt} onChange={notifiedAt => setDraft(value => ({ ...value, notifiedAt }))}/> : '—'}</td>
    <td><label className="reporting-sr" htmlFor={`${id}-ref`}>{tx('Αριθμός πρωτοκόλλου', 'Reference number')}</label><input id={`${id}-ref`} value={draft.reference} placeholder={tx('Αρ. πρωτοκόλλου', 'Reference')} onChange={event => setDraft(value => ({ ...value, reference: event.target.value }))}/></td>
    <td><Button variant="secondary" disabled={!dirty} loading={saving} onClick={save}>{tx('Αποθήκευση', 'Save')}</Button></td>
  </tr>
}

function Notifications({ findings, tx, en, onSave, unavailable }) {
  const pending = findings.filter(finding => notificationStatus(finding) === 'pending').length
  return <section className="reporting-card">
    <header><Megaphone size={17} aria-hidden="true"/><div><h2>{tx('Υποχρεωτικές δηλώσεις ΕΟΔΥ', 'Mandatory ΕΟΔΥ notifications')}</h2><p>{tx('Επικυρωμένα θετικά αποτελέσματα που αντιστοιχούν σε νόσημα υποχρεωτικής δήλωσης. Καταγράψτε πότε δηλώθηκαν και με ποιον αριθμό πρωτοκόλλου.', 'Validated positive results that match a notifiable disease. Record when they were notified and the reference number.')}</p></div>{pending > 0 && <span className="reporting-badge">{tx(`${pending} εκκρεμούν`, `${pending} pending`)}</span>}</header>
    {unavailable && <p className="reporting-warning"><AlertTriangle size={15} aria-hidden="true"/>{tx('Η καταγραφή δηλώσεων δεν είναι ακόμη ενεργή στη βάση του οργανισμού· τα ευρήματα εμφανίζονται, η αποθήκευση όχι.', 'Notification tracking is not yet enabled in the organization database; findings are shown but cannot be saved.')}</p>}
    {findings.length === 0 ? <p className="reporting-ok"><CheckCircle2 size={15} aria-hidden="true"/>{tx('Δεν υπάρχουν ευρήματα προς δήλωση.', 'No findings to notify.')}</p> :
      <div className="reporting-table-wrap"><table className="reporting-table">
        <thead><tr><th scope="col">{tx('Λήψη', 'Collected')}</th><th scope="col">{tx('Δείγμα', 'Sample')}</th><th scope="col">{tx('Νόσημα', 'Disease')}</th><th scope="col">{tx('Κατάσταση', 'Status')}</th><th scope="col">{tx('Δηλώθηκε', 'Notified on')}</th><th scope="col">{tx('Αρ. πρωτοκόλλου', 'Reference')}</th><th scope="col"><span className="reporting-sr">{tx('Ενέργεια', 'Action')}</span></th></tr></thead>
        <tbody>{findings.map(finding => <NotificationRow key={`${finding.findingKey}|${finding.report?.updatedAt || ''}`} finding={finding} tx={tx} en={en} onSave={onSave}/>)}</tbody>
      </table></div>}
  </section>
}

function EarsNetExport({ samples, patients, tenant, year, tx }) {
  const [hospitalId, setHospitalId] = useState(''), [laboratoryCode, setLaboratoryCode] = useState('')
  const all = useMemo(() => earsNetIsolates(samples).filter(isolate => isolate.year === String(year)), [samples, year])
  const first = useMemo(() => firstIsolates(all), [all])
  const built = useMemo(() => buildEarsNetRows(samples, { patients, year, hospitalId, laboratoryCode, salt: tenant?.id || 'demo' }), [samples, patients, year, hospitalId, laboratoryCode, tenant?.id])
  const byPathogen = EARS_NET_PATHOGENS.map(([code, , label]) => [label, first.filter(isolate => isolate.pathogen === code).length]).filter(([, count]) => count)
  const exportCsv = () => download(`EARS-Net_${year}_${(tenant?.code || tenant?.slug || 'organization').replace(/[^a-zA-Z0-9-]/g, '')}.csv`, toCsv(built.rows))
  return <section className="reporting-card">
    <header><Download size={17} aria-hidden="true"/><div><h2>{tx('Αναφορά EARS-Net (ECDC / TESSy)', 'EARS-Net report (ECDC / TESSy)')}</h2><p>{tx('Διεισδυτικά στελέχη (αίμα, ΕΝΥ) των 8 παθογόνων του EARS-Net για το έτος', 'Invasive isolates (blood, CSF) of the 8 EARS-Net pathogens for')} {year}. {tx('Μετράει μόνο το πρώτο στέλεχος ανά ασθενή, παθογόνο και έτος.', 'Only the first isolate per patient, pathogen and year counts.')}</p></div></header>
    <div className="reporting-stats">
      <div><span>{tx('Στελέχη', 'Isolates')}</span><strong>{all.length}</strong></div>
      <div><span>{tx('Διπλοεγγραφές που αφαιρέθηκαν', 'Duplicates removed')}</span><strong>{all.length - first.length}</strong></div>
      <div><span>{tx('Πρώτα στελέχη', 'First isolates')}</span><strong>{first.length}</strong></div>
      <div><span>{tx('Γραμμές αρχείου', 'File rows')}</span><strong>{built.rows.length}</strong></div>
    </div>
    {byPathogen.length > 0 && <p className="reporting-passed">{byPathogen.map(([label, count]) => `${label}: ${count}`).join(' · ')}</p>}
    {built.withoutAst > 0 && <p className="reporting-warning"><AlertTriangle size={15} aria-hidden="true"/>{tx(`${built.withoutAst} πρώτα στελέχη δεν έχουν αντιβιόγραμμα και δεν περιλαμβάνονται.`, `${built.withoutAst} first isolates have no susceptibility tests and are not included.`)}</p>}
    {built.unmapped.length > 0 && <p className="reporting-warning"><AlertTriangle size={15} aria-hidden="true"/>{tx('Αντιβιοτικά χωρίς κωδικό EARS-Net (παραλείπονται):', 'Antibiotics without an EARS-Net code (left out):')} {built.unmapped.map(([name, count]) => `${name} (${count})`).join(', ')}</p>}
    <div className="reporting-form">
      <label><span>{tx('Κωδικός νοσοκομείου (HospitalId)', 'Hospital code (HospitalId)')}</span><input value={hospitalId} onChange={event => setHospitalId(event.target.value)}/></label>
      <label><span>{tx('Κωδικός εργαστηρίου (LaboratoryCode)', 'Laboratory code (LaboratoryCode)')}</span><input value={laboratoryCode} onChange={event => setLaboratoryCode(event.target.value)}/></label>
      <Button onClick={exportCsv} disabled={!built.rows.length}><Download size={15} aria-hidden="true"/>{tx('Λήψη CSV', 'Download CSV')}</Button>
    </div>
    <p className="reporting-hint">{tx('Ο ασθενής εμφανίζεται μόνο με ψευδώνυμο κωδικό (PatientCounter). Πριν την υποβολή ελέγξτε τις μεταβλητές με την τρέχουσα έκδοση του πρωτοκόλλου αναφοράς EARS-Net.', 'Patients appear only as a pseudonymous counter (PatientCounter). Before submitting, check the variables against the current EARS-Net reporting protocol.')}</p>
  </section>
}

export function ReportingPanel({ tenant, isDemo, year, tx, en }) {
  const repository = useLaboratoryRepository()
  const { notify } = useFeedback()
  const [state, setState] = useState({ loading: true, error: '', samples: [], patients: [], reports: [], reportsUnavailable: false })
  const load = useCallback(async () => {
    setState(value => ({ ...value, loading: true, error: '' }))
    try {
      const [listed, patients, reports] = await Promise.all([
        repository.list(),
        loadPatients(tenant?.id, { isDemo }).catch(() => []),
        loadNotificationReports(tenant?.id, { isDemo }).then(rows => ({ rows }), () => ({ rows: [], unavailable: true })),
      ])
      const samples = Array.isArray(listed) ? listed : (listed?.data || listed?.rows || [])
      setState({ loading: false, error: '', samples, patients, reports: reports.rows, reportsUnavailable: Boolean(reports.unavailable) })
    } catch (error) {
      setState(value => ({ ...value, loading: false, error: error?.message || 'LOAD_FAILED' }))
    }
  }, [repository, tenant?.id, isDemo])
  useEffect(() => { load() }, [load])
  const checks = useMemo(() => runDataQualityChecks({ samples: state.samples, patients: state.patients }), [state.samples, state.patients])
  const findings = useMemo(() => notifiableFindings(state.samples, state.reports), [state.samples, state.reports])
  const onSave = async (finding, draft) => {
    try {
      const saved = await saveNotificationReport(tenant?.id, finding, draft, { isDemo })
      setState(value => ({ ...value, reports: [...value.reports.filter(report => report.findingKey !== saved.findingKey), saved] }))
      notify(tx('Η δήλωση αποθηκεύτηκε.', 'Notification saved.'), 'success')
    } catch (error) {
      notify(error?.message || tx('Η δήλωση δεν αποθηκεύτηκε.', 'Notification could not be saved.'), 'danger')
    }
  }
  if (state.loading) return <div className="analysis-chart-empty">{tx('Φόρτωση εργαστηριακών δεδομένων…', 'Loading laboratory data…')}</div>
  if (state.error) return <p className="reporting-warning"><AlertTriangle size={15} aria-hidden="true"/>{tx('Δεν ήταν δυνατή η φόρτωση των εργαστηριακών δεδομένων.', 'Laboratory data could not be loaded.')} {state.error}</p>
  return <div className="reporting-panel">
    <QualityChecks checks={checks} tx={tx}/>
    <Notifications findings={findings} tx={tx} en={en} onSave={onSave} unavailable={state.reportsUnavailable && !isDemo}/>
    <EarsNetExport samples={state.samples} patients={state.patients} tenant={tenant} year={year} tx={tx}/>
  </div>
}
