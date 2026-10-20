import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock3, Eye, FileUp, ShieldCheck } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { FILE_ACCEPT, accessComplete, pendingItems, submissionProblemText, submissionProblems, submitErrorMessage } from './supplierRenewalModel'
import { loadSupplierCertificateAccess, submitSupplierCertificate } from './supplierRenewalService'
import './resources.css'

const day = (value, en) => (value ? new Date(String(value).length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(en ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const size = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const certificateName = item => [item.type, item.title && item.title !== item.type ? item.title : ''].filter(Boolean).join(' · ') || '—'

// Public page of the e-mailed link (no account): the supplier sees every certificate
// of the request and uploads each renewed one with its own form, now or later from
// the same link, until it expires or nothing is left. The hospital reviews them in
// Limoxis. /supplier-certificate/demo shows an invented sample and sends nothing.
export function SupplierCertificatePage() {
  const { token } = useParams()
  const { language } = useLanguage()
  const en = language === 'en'
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [done, setDone] = useState({})
  const load = useCallback(async () => {
    setState(current => ({ ...current, loading: true }))
    try { setState({ loading: false, data: await loadSupplierCertificateAccess(token), error: null }) } catch (error) { setState({ loading: false, data: null, error }) }
  }, [token])
  useEffect(() => { void load() }, [load])

  if (state.loading && !state.data) return <Frame><RouteLoading /></Frame>
  if (state.error || !state.data) return <Frame><Status icon={ShieldCheck} title={en ? 'This link is not available' : 'Ο σύνδεσμος δεν είναι διαθέσιμος'} text={en ? 'The link may have been cut when it was copied, or a newer e-mail replaced it. Paste the whole link from the e-mail below, or contact the hospital’s quality office.' : 'Ο σύνδεσμος μπορεί να κόπηκε στην αντιγραφή ή να τον αντικατέστησε νεότερο email. Επικολλήστε παρακάτω ολόκληρο τον σύνδεσμο του email ή επικοινωνήστε με το Γραφείο Ποιότητας του νοσοκομείου.'} /><PasteLink en={en} /></Frame>
  // The demo keeps its submissions on the page.
  const info = { ...state.data, items: (state.data.items || []).map(item => (done[item.id] ? { ...item, status: 'submitted', submittedAt: done[item.id] } : item)) }
  if (info.status === 'expired') return <Frame><Status icon={Clock3} title={en ? 'The link has expired' : 'Ο σύνδεσμος έληξε'} text={en ? 'Ask the hospital’s quality office to send it again.' : 'Ζητήστε από το Γραφείο Ποιότητας του νοσοκομείου να τον στείλει ξανά.'} /></Frame>
  if (info.status !== 'sent' && info.status !== 'closed') return <Frame><Status icon={ShieldCheck} title={en ? 'This link is no longer valid' : 'Ο σύνδεσμος δεν ισχύει πια'} text={en ? 'The request was withdrawn by the hospital.' : 'Το αίτημα αποσύρθηκε από το νοσοκομείο.'} /></Frame>
  const pending = pendingItems(info)
  const complete = accessComplete(info)
  const total = info.items.length
  const submitted = total - pending.length
  const onSubmitted = async item => { if (info.demo) setDone(current => ({ ...current, [item.id]: new Date().toISOString() })); else await load() }

  return <Frame><div className="public-flow-card public-flow-wide">
    {info.demo && <div className="source-truth-note supplier-certificate-demo"><Eye size={16} /><span>{en ? 'Preview with sample data: nothing is sent or stored.' : 'Προεπισκόπηση με δείγμα: τίποτα δεν αποστέλλεται ούτε αποθηκεύεται.'}</span></div>}
    <div><span className="eyebrow">{info.organizationName || 'Limoxis Observer'}</span><h1>{en ? 'Renewal of expired certificates' : 'Ανανέωση ληγμένων πιστοποιητικών'}</h1><p>{en ? `For: ${info.supplierName || ''}` : `Προς: ${info.supplierName || ''}`}</p>
      <p className="supplier-certificate-progress">{complete ? (en ? `All ${total} certificates were submitted. Thank you, the hospital will review them.` : `Υποβλήθηκαν και τα ${total} πιστοποιητικά. Ευχαριστούμε, το νοσοκομείο θα τα ελέγξει.`) : (en ? `${submitted} of ${total} submitted. Upload each renewed certificate below; you can send some now and the rest later from the same link.` : `Υποβλήθηκαν ${submitted} από ${total}. Ανεβάστε κάθε ανανεωμένο πιστοποιητικό παρακάτω· μπορείτε να στείλετε κάποια τώρα και τα υπόλοιπα αργότερα από τον ίδιο σύνδεσμο.`)}</p></div>
    {info.items.map((item, index) => <CertificateItem key={item.id} item={item} index={index} total={total} token={token} language={language} disabled={info.status !== 'sent'} onSubmitted={() => onSubmitted(item)} onStale={load} />)}
    <div className="source-truth-note"><ShieldCheck size={16} /><span>{en ? `Personal link, no account needed${info.expiresAt && !complete ? `, valid until ${day(info.expiresAt, en)}` : ''}. The files go only to the hospital’s supplier records.` : `Προσωπικός σύνδεσμος, χωρίς λογαριασμό${info.expiresAt && !complete ? ` (ισχύει έως ${day(info.expiresAt, en)})` : ''}. Τα αρχεία καταχωρίζονται μόνο στο αρχείο προμηθευτών του νοσοκομείου.`}</span></div>
  </div></Frame>
}

// A link that arrived cut (long e-mail links wrap or lose their end): the supplier
// pastes the whole link or its code, and the page opens it.
function PasteLink({ en }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const code = value.match(/SCR-[0-9a-f]{20,}/i)?.[0] || ''
  return <form className="public-flow-card supplier-certificate-paste" onSubmit={event => { event.preventDefault(); if (code) navigate(`/supplier-certificate/${code}`) }}>
    <Field label={en ? 'Link or code from the e-mail' : 'Σύνδεσμος ή κωδικός από το email'}><input value={value} onChange={event => setValue(event.target.value)} autoComplete="off" /></Field>
    <Button type="submit" disabled={!code}>{en ? 'Open' : 'Άνοιγμα'}</Button>
  </form>
}

// One certificate: what is on file and, while it is awaited, its own form and file.
function CertificateItem({ item, index, total, token, language, disabled, onSubmitted, onStale }) {
  const en = language === 'en'
  const [form, setForm] = useState({ type: item.type || '', number: '', issuer: item.issuer || '', issuedOn: '', expiresOn: '', note: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState([])
  const [failure, setFailure] = useState('')
  const set = next => setForm(current => ({ ...current, ...next }))
  const open = item.status === 'pending' && !disabled
  async function submit() {
    if (busy) return
    const found = submissionProblems(form, file)
    setProblems(found)
    setFailure('')
    if (found.length) return
    setBusy(true)
    try { await submitSupplierCertificate(token, item.id, form, file); await onSubmitted() }
    catch (error) { setFailure(submitErrorMessage(error?.code, language)); if (['SUPPLIER_CERTIFICATE_ALREADY_SUBMITTED', 'SUPPLIER_CERTIFICATE_ACCESS_EXPIRED', 'SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE', 'SUPPLIER_CERTIFICATE_ITEM_NOT_AVAILABLE'].includes(error?.code)) await onStale() }
    finally { setBusy(false) }
  }
  const stateText = item.status === 'pending' ? '' : item.status === 'accepted' ? (en ? 'Accepted' : 'Έγινε αποδεκτό') : item.status === 'rejected' ? (en ? 'Not accepted' : 'Δεν έγινε αποδεκτό') : (en ? `Submitted ${day(item.submittedAt, en)}` : `Υποβλήθηκε ${day(item.submittedAt, en)}`)
  return <section className={`public-flow-section supplier-certificate-item${open ? '' : ' is-done'}`}>
    <h2>{open ? <FileUp size={17} /> : <CheckCircle2 size={17} />}{en ? `Certificate ${index + 1} of ${total}: ` : `Πιστοποιητικό ${index + 1} από ${total}: `}{certificateName(item)}{stateText && <span className="supplier-certificate-state">{stateText}</span>}</h2>
    <div className="public-flow-row"><span>{en ? 'Number on file' : 'Αριθμός στο αρχείο'}</span><strong>{item.number || '—'}</strong></div>
    {item.issuer && <div className="public-flow-row"><span>{en ? 'Issued by' : 'Φορέας'}</span><strong>{item.issuer}</strong></div>}
    <div className="public-flow-row"><span>{en ? 'Expired on' : 'Έληξε στις'}</span><strong>{day(item.expiresOn, en)}</strong></div>
    {item.reviewComment && <p>{en ? 'Note from the hospital: ' : 'Σημείωση του νοσοκομείου: '}{item.reviewComment}</p>}
    {open && <>
      <FormGrid columns={2}>
        <Field label={en ? 'Certificate type *' : 'Τύπος πιστοποιητικού *'}><input value={form.type} maxLength={200} onChange={e => set({ type: e.target.value })} /></Field>
        <Field label={en ? 'Certificate number *' : 'Αριθμός πιστοποιητικού *'}><input value={form.number} maxLength={200} onChange={e => set({ number: e.target.value })} /></Field>
        <Field label={en ? 'Issued by' : 'Φορέας έκδοσης'}><input value={form.issuer} maxLength={200} onChange={e => set({ issuer: e.target.value })} /></Field>
        <ManualDateField label={en ? 'Issue date' : 'Ημερομηνία έκδοσης'} optional value={form.issuedOn} onChange={value => set({ issuedOn: value })} />
        <ManualDateField label={en ? 'Expiry date *' : 'Ημερομηνία λήξης *'} value={form.expiresOn} onChange={value => set({ expiresOn: value })} />
        <Field label={en ? 'File (PDF or image, up to 10 MB) *' : 'Αρχείο (PDF ή εικόνα, έως 10 MB) *'} hint={file ? `${file.name} · ${size(file.size)}` : ''}><input type="file" accept={FILE_ACCEPT} onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
      </FormGrid>
      <Field label={en ? 'Note' : 'Σημείωση'}><textarea rows={2} maxLength={2000} value={form.note} onChange={e => set({ note: e.target.value })} /></Field>
      {problems.length > 0 && <p className="field-error" role="alert">{en ? 'Please check: ' : 'Ελέγξτε: '}{submissionProblemText(problems, language).join(' · ')}</p>}
      {failure && <p className="field-error" role="alert">{failure}</p>}
      <div className="row-actions"><Button disabled={busy} onClick={submit}><FileUp size={15} />{busy ? (en ? ' Uploading…' : ' Αποστολή…') : (en ? ' Submit certificate' : ' Υποβολή πιστοποιητικού')}</Button></div>
    </>}
  </section>
}

function Frame({ children }) { return <main className="public-flow-page"><div className="public-flow-shell">{children}</div></main> }
function Status({ title, text, icon: Icon }) { return <div className="public-flow-card public-flow-status"><Icon size={34} /><h1>{title}</h1>{text && <p>{text}</p>}</div> }
