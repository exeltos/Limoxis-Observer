import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Clock3, FileUp, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { FILE_ACCEPT, submissionProblemText, submissionProblems, submitErrorMessage } from './supplierRenewalModel'
import { loadSupplierCertificateAccess, submitSupplierCertificate } from './supplierRenewalService'

const day = (value, en) => (value ? new Date(String(value).length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(en ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const size = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// Public page of the e-mailed link (no account): the supplier sees which certificate
// expired and uploads the renewed one, once. The hospital reviews it in Limoxis.
export function SupplierCertificatePage() {
  const { token } = useParams()
  const { language } = useLanguage()
  const en = language === 'en'
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [form, setForm] = useState({ type: '', number: '', issuer: '', issuedOn: '', expiresOn: '', note: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState([])
  const [failure, setFailure] = useState('')
  const [done, setDone] = useState(false)
  const load = useCallback(async () => {
    setState(current => ({ ...current, loading: true }))
    try {
      const data = await loadSupplierCertificateAccess(token)
      setState({ loading: false, data, error: null })
      setForm(current => ({ ...current, type: current.type || data?.certificate?.type || '', issuer: current.issuer || data?.certificate?.issuer || '' }))
    } catch (error) { setState({ loading: false, data: null, error }) }
  }, [token])
  useEffect(() => { void load() }, [load])
  const set = next => setForm(current => ({ ...current, ...next }))

  if (state.loading) return <Frame><RouteLoading /></Frame>
  if (state.error || !state.data) return <Frame><Status icon={ShieldCheck} title={en ? 'This link is not available' : 'Ο σύνδεσμος δεν είναι διαθέσιμος'} text={en ? 'A newer e-mail may have replaced it. Contact the hospital’s quality office.' : 'Μπορεί να τον αντικατέστησε νεότερο email. Επικοινωνήστε με το Γραφείο Ποιότητας του νοσοκομείου.'} /></Frame>
  const info = state.data
  const cert = info.certificate || {}
  if (done || info.status === 'submitted') return <Frame><Status icon={CheckCircle2} title={en ? 'Thank you, the certificate was submitted' : 'Ευχαριστούμε, το πιστοποιητικό υποβλήθηκε'} text={en ? `${info.organizationName || 'The hospital'} will review it. You can close this page.` : `Το ${info.organizationName || 'νοσοκομείο'} θα το ελέγξει. Μπορείτε να κλείσετε τη σελίδα.`} /></Frame>
  if (info.status === 'accepted') return <Frame><Status icon={CheckCircle2} title={en ? 'The renewed certificate has been accepted' : 'Το ανανεωμένο πιστοποιητικό έγινε αποδεκτό'} text={info.organizationName || ''} /></Frame>
  if (info.status === 'rejected') return <Frame><Status icon={XCircle} title={en ? 'The submitted certificate was not accepted' : 'Το πιστοποιητικό που υποβλήθηκε δεν έγινε αποδεκτό'} text={info.reviewComment || (en ? 'The hospital will contact you.' : 'Το νοσοκομείο θα επικοινωνήσει μαζί σας.')} /></Frame>
  if (info.status === 'expired') return <Frame><Status icon={Clock3} title={en ? 'The link has expired' : 'Ο σύνδεσμος έληξε'} text={en ? 'Ask the hospital’s quality office to send it again.' : 'Ζητήστε από το Γραφείο Ποιότητας του νοσοκομείου να τον στείλει ξανά.'} /></Frame>
  if (info.status !== 'sent') return <Frame><Status icon={ShieldCheck} title={en ? 'This link is no longer valid' : 'Ο σύνδεσμος δεν ισχύει πια'} text={en ? 'The request was withdrawn by the hospital.' : 'Το αίτημα αποσύρθηκε από το νοσοκομείο.'} /></Frame>

  async function submit() {
    if (busy) return
    const found = submissionProblems(form, file)
    setProblems(found)
    setFailure('')
    if (found.length) return
    setBusy(true)
    try { await submitSupplierCertificate(token, form, file); setDone(true) }
    catch (error) { setFailure(submitErrorMessage(error?.code, language)); if (['SUPPLIER_CERTIFICATE_ALREADY_SUBMITTED', 'SUPPLIER_CERTIFICATE_ACCESS_EXPIRED', 'SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE'].includes(error?.code)) await load() }
    finally { setBusy(false) }
  }
  return <Frame><div className="public-flow-card public-flow-wide">
    <div><span className="eyebrow">{info.organizationName || 'Limoxis Observer'}</span><h1>{en ? 'Renewal of an expired certificate' : 'Ανανέωση ληγμένου πιστοποιητικού'}</h1><p>{en ? `For: ${info.supplierName || ''}` : `Προς: ${info.supplierName || ''}`}</p></div>
    <section className="public-flow-section"><h2><ShieldCheck size={17} />{en ? 'Certificate on file' : 'Πιστοποιητικό στο αρχείο'}</h2>
      <div className="public-flow-row"><span>{en ? 'Certificate' : 'Πιστοποιητικό'}</span><strong>{[cert.type, cert.title && cert.title !== cert.type ? cert.title : ''].filter(Boolean).join(' · ') || '—'}</strong></div>
      <div className="public-flow-row"><span>{en ? 'Number' : 'Αριθμός'}</span><strong>{cert.number || '—'}</strong></div>
      {cert.issuer && <div className="public-flow-row"><span>{en ? 'Issued by' : 'Φορέας'}</span><strong>{cert.issuer}</strong></div>}
      <div className="public-flow-row"><span>{en ? 'Expired on' : 'Έληξε στις'}</span><strong>{day(cert.expiresOn, en)}</strong></div>
      {info.reviewComment && <p>{en ? 'Note from the hospital: ' : 'Σημείωση του νοσοκομείου: '}{info.reviewComment}</p>}
    </section>
    <section className="public-flow-section"><h2><FileUp size={17} />{en ? 'The renewed certificate' : 'Το ανανεωμένο πιστοποιητικό'}</h2>
      <FormGrid columns={2}>
        <Field label={en ? 'Certificate type *' : 'Τύπος πιστοποιητικού *'}><input value={form.type} maxLength={200} onChange={e => set({ type: e.target.value })} /></Field>
        <Field label={en ? 'Certificate number *' : 'Αριθμός πιστοποιητικού *'}><input value={form.number} maxLength={200} onChange={e => set({ number: e.target.value })} /></Field>
        <Field label={en ? 'Issued by' : 'Φορέας έκδοσης'}><input value={form.issuer} maxLength={200} onChange={e => set({ issuer: e.target.value })} /></Field>
        <ManualDateField label={en ? 'Issue date' : 'Ημερομηνία έκδοσης'} optional value={form.issuedOn} onChange={value => set({ issuedOn: value })} />
        <ManualDateField label={en ? 'Expiry date *' : 'Ημερομηνία λήξης *'} value={form.expiresOn} onChange={value => set({ expiresOn: value })} />
        <Field label={en ? 'File (PDF or image, up to 10 MB) *' : 'Αρχείο (PDF ή εικόνα, έως 10 MB) *'} hint={file ? `${file.name} · ${size(file.size)}` : ''}><input type="file" accept={FILE_ACCEPT} onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
      </FormGrid>
      <Field label={en ? 'Note' : 'Σημείωση'}><textarea rows={3} maxLength={2000} value={form.note} onChange={e => set({ note: e.target.value })} /></Field>
      {problems.length > 0 && <p className="field-error" role="alert">{en ? 'Please check: ' : 'Ελέγξτε: '}{submissionProblemText(problems, language).join(' · ')}</p>}
      {failure && <p className="field-error" role="alert">{failure}</p>}
      <div className="row-actions"><Button disabled={busy} onClick={submit}><FileUp size={15} />{busy ? (en ? ' Uploading…' : ' Αποστολή…') : (en ? ' Submit certificate' : ' Υποβολή πιστοποιητικού')}</Button></div>
    </section>
    <div className="source-truth-note"><ShieldCheck size={16} /><span>{en ? `Personal single-use link, no account needed${info.expiresAt ? `, valid until ${day(info.expiresAt, en)}` : ''}. The file goes only to the hospital’s supplier records.` : `Προσωπικός σύνδεσμος μίας χρήσης, χωρίς λογαριασμό${info.expiresAt ? ` (ισχύει έως ${day(info.expiresAt, en)})` : ''}. Το αρχείο καταχωρίζεται μόνο στο αρχείο προμηθευτών του νοσοκομείου.`}</span></div>
  </div></Frame>
}

function Frame({ children }) { return <main className="public-flow-page"><div className="public-flow-shell">{children}</div></main> }
function Status({ title, text, icon: Icon }) { return <div className="public-flow-card public-flow-status"><Icon size={34} /><h1>{title}</h1>{text && <p>{text}</p>}</div> }
