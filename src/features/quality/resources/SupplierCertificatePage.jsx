import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock3, Eye, FileText, FileUp, Info, Lock, Mail, Phone, ShieldCheck, UploadCloud, X } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { FILE_ACCEPT, FILE_TYPES, MAX_FILE_BYTES, SUBMISSION_PROBLEMS, accessComplete, pendingItems, submissionProblemText, submissionProblems, submitErrorMessage } from './supplierRenewalModel'
import { loadSupplierCertificateAccess, submitSupplierCertificate } from './supplierRenewalService'
import './resources.css'

const asDate = value => new Date(String(value).length === 10 ? `${value}T12:00:00` : value)
const day = (value, en) => (value ? asDate(value).toLocaleDateString(en ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const dayTime = (value, en) => (value ? asDate(value).toLocaleString(en ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const size = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const certificateName = item => [item.type, item.title && item.title !== item.type ? item.title : ''].filter(Boolean).join(' · ') || '—'
const isExpired = item => Boolean(item.expiresOn) && String(item.expiresOn).slice(0, 10) <= new Date().toISOString().slice(0, 10)
// The hospital's initials when it has no logo (as in the e-mail).
export const hospitalInitials = name => (String(name || '').replace(/\([^)]*\)/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u).filter(word => word && !['και', 'του', 'της', 'των', 'το', 'η', 'ο', 'of', 'the', 'and'].includes(word.toLowerCase())).slice(0, 3).map(word => word[0]).join('') || 'LO').toLocaleUpperCase('el')
// A file the supplier picked or dropped: what is wrong with it, before the form is sent.
const fileProblem = file => (file.size > MAX_FILE_BYTES ? 'fileSize' : file.type && !FILE_TYPES.includes(file.type) ? 'fileType' : '')

// Public page of the e-mailed link (no account): the hospital (logo or initials, name,
// Quality Office), what is asked and why, the progress, and every certificate of the
// request as a card with its own form and file; submitted ones fold into a summary.
// The supplier sends them now or later from the same link, until it expires or nothing
// is left. The hospital reviews them in Limoxis. /supplier-certificate/demo shows an
// invented sample and sends nothing.
export function SupplierCertificatePage() {
  const { token } = useParams()
  const { language, setLanguage } = useLanguage()
  const en = language === 'en'
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [done, setDone] = useState({})
  const load = useCallback(async () => {
    setState(current => ({ ...current, loading: true }))
    try { setState({ loading: false, data: await loadSupplierCertificateAccess(token), error: null }) } catch (error) { setState({ loading: false, data: null, error }) }
  }, [token])
  useEffect(() => { void load() }, [load])
  const toggle = <button type="button" className="supplier-portal-language" onClick={() => setLanguage(en ? 'el' : 'en')} aria-label={en ? 'Αλλαγή σε Ελληνικά' : 'Switch to English'}>{en ? 'ΕΛ' : 'EN'}</button>

  if (state.loading && !state.data) return <Frame><RouteLoading /></Frame>
  if (state.error || !state.data) return <Frame band={<HospitalBand info={{}} en={en} toggle={toggle} />}><Status icon={ShieldCheck} title={en ? 'This link is not available' : 'Ο σύνδεσμος δεν είναι διαθέσιμος'} text={en ? 'The link may have been cut when it was copied, or a newer e-mail replaced it. Paste the whole link from the e-mail below, or contact the hospital’s quality office.' : 'Ο σύνδεσμος μπορεί να κόπηκε στην αντιγραφή ή να τον αντικατέστησε νεότερο email. Επικολλήστε παρακάτω ολόκληρο τον σύνδεσμο του email ή επικοινωνήστε με το Γραφείο Ποιότητας του νοσοκομείου.'} /><PasteLink en={en} /></Frame>
  // The demo keeps its submissions on the page.
  const info = { ...state.data, items: (state.data.items || []).map(item => (done[item.id] ? { ...item, status: 'submitted', submittedAt: done[item.id] } : item)) }
  const band = <HospitalBand info={info} en={en} toggle={toggle} />
  if (info.status === 'expired') return <Frame band={band}><Status icon={Clock3} title={en ? 'The link has expired' : 'Ο σύνδεσμος έληξε'} text={en ? 'Ask the hospital’s quality office to send it again.' : 'Ζητήστε από το Γραφείο Ποιότητας του νοσοκομείου να τον στείλει ξανά.'} /></Frame>
  if (info.status !== 'sent' && info.status !== 'closed') return <Frame band={band}><Status icon={ShieldCheck} title={en ? 'This link is no longer valid' : 'Ο σύνδεσμος δεν ισχύει πια'} text={en ? 'The request was withdrawn by the hospital.' : 'Το αίτημα αποσύρθηκε από το νοσοκομείο.'} /></Frame>
  const pending = pendingItems(info)
  const complete = accessComplete(info)
  const total = info.items.length
  const submitted = total - pending.length
  const percent = total ? Math.round((submitted / total) * 100) : 0
  const hospital = info.organizationName || 'Limoxis Observer'
  const onSubmitted = async item => { if (info.demo) setDone(current => ({ ...current, [item.id]: new Date().toISOString() })); else await load() }

  return <Frame band={band}><div className="supplier-portal-card">
    {info.demo && <div className="source-truth-note supplier-certificate-demo"><Eye size={16} /><span>{en ? 'Preview with sample data: nothing is sent or stored.' : 'Προεπισκόπηση με δείγμα: τίποτα δεν αποστέλλεται ούτε αποθηκεύεται.'}</span></div>}
    <div className="supplier-portal-intro"><h1>{en ? 'Renewal of supplier certificates' : 'Ανανέωση πιστοποιητικών προμηθευτή'}</h1><p className="supplier-portal-to">{en ? `For: ${info.supplierName || ''}` : `Προς: ${info.supplierName || ''}`}</p></div>
    {complete
      ? <div className="supplier-portal-thanks" role="status"><CheckCircle2 size={34} aria-hidden="true" /><h2>{en ? 'Thank you' : 'Ευχαριστούμε'}</h2><p>{en ? `All ${total} certificates were submitted. Thank you, the hospital will review them.` : `Υποβλήθηκαν και τα ${total} πιστοποιητικά. Ευχαριστούμε, το νοσοκομείο θα τα ελέγξει.`}</p><p>{en ? 'If something needs correcting, the Quality Office will ask you again with a comment.' : 'Αν κάτι χρειάζεται διόρθωση, το Γραφείο Ποιότητας θα σας το ζητήσει ξανά με σχόλιο.'}</p></div>
      : <>
        <div className="supplier-portal-explain"><Info size={18} aria-hidden="true" /><div>
          <p>{en ? `The Quality Office of ${hospital} keeps its suppliers’ certificates on file, as its quality and food-safety system requires (e.g. ISO 22000 / HACCP, supplier evaluation). The certificates below have expired or expire soon.` : `Το Γραφείο Ποιότητας του νοσοκομείου «${hospital}» τηρεί τα πιστοποιητικά των προμηθευτών του, όπως απαιτεί το σύστημα ποιότητας και ασφάλειας τροφίμων (π.χ. ISO 22000 / HACCP, αξιολόγηση προμηθευτών). Τα παρακάτω έχουν λήξει ή λήγουν σύντομα.`}</p>
          <p>{en ? 'For each one, fill in its details, attach the renewed file and submit. You can send some now and the rest later from the same link.' : 'Για το καθένα συμπληρώστε τα στοιχεία, επισυνάψτε το ανανεωμένο αρχείο και πατήστε «Υποβολή». Μπορείτε να στείλετε κάποια τώρα και τα υπόλοιπα αργότερα από τον ίδιο σύνδεσμο.'}</p>
        </div></div>
        <div className="supplier-portal-progress">
          <div className="supplier-portal-progress-head"><strong className="supplier-certificate-progress">{en ? `${submitted} of ${total} submitted` : `Υποβλήθηκαν ${submitted} από ${total}`}</strong>{info.expiresAt && <span><Clock3 size={14} aria-hidden="true" />{en ? `Link valid until ${day(info.expiresAt, en)}` : `Ο σύνδεσμος ισχύει έως ${day(info.expiresAt, en)}`}</span>}</div>
          <div className="supplier-portal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={submitted} aria-label={en ? 'Certificates submitted' : 'Πιστοποιητικά που υποβλήθηκαν'}><span style={{ width: `${percent}%` }} /></div>
        </div>
      </>}
    <div className="supplier-portal-items">
      {info.items.map((item, index) => <CertificateItem key={item.id} item={item} index={index} total={total} token={token} language={language} disabled={info.status !== 'sent'} onSubmitted={() => onSubmitted(item)} onStale={load} />)}
    </div>
    <footer className="supplier-portal-footer">
      <p><Lock size={15} aria-hidden="true" /><span>{en ? `Personal link, no account or password needed${info.expiresAt && !complete ? `, valid until ${day(info.expiresAt, en)}` : ''}. Do not forward it. The files go only to the hospital’s supplier records.` : `Προσωπικός σύνδεσμος, χωρίς λογαριασμό ή κωδικό${info.expiresAt && !complete ? ` (ισχύει έως ${day(info.expiresAt, en)})` : ''}. Μην τον προωθήσετε. Τα αρχεία καταχωρίζονται μόνο στο αρχείο προμηθευτών του νοσοκομείου.`}</span></p>
      <p>{info.organizationEmail || info.organizationPhone ? <><Mail size={15} aria-hidden="true" /><span>{en ? 'Questions: ' : 'Για απορίες: '}{info.organizationEmail && <a href={`mailto:${info.organizationEmail}`}>{info.organizationEmail}</a>}{info.organizationEmail && info.organizationPhone && ' · '}{info.organizationPhone && <span className="supplier-portal-phone"><Phone size={13} aria-hidden="true" />{info.organizationPhone}</span>}</span></> : <><Mail size={15} aria-hidden="true" /><span>{en ? 'Questions: contact the hospital’s Quality Office.' : 'Για απορίες επικοινωνήστε με το Γραφείο Ποιότητας του νοσοκομείου.'}</span></>}</p>
      <p className="supplier-portal-powered">Limoxis Observer</p>
    </footer>
  </div></Frame>
}

// The hospital at the top: its logo (organizations.branding) or initials, its name and
// the Quality Office.
function HospitalBand({ info, en, toggle }) {
  const name = info.organizationName || 'Limoxis Observer'
  return <header className="supplier-portal-band">
    {info.organizationLogo ? <img className="supplier-portal-logo" src={info.organizationLogo} alt="" /> : <span className="supplier-portal-monogram" aria-hidden="true">{hospitalInitials(name)}</span>}
    <div><strong className="supplier-portal-hospital">{name}</strong><span>{en ? 'Quality Office · supplier certificates' : 'Γραφείο Ποιότητας · πιστοποιητικά προμηθευτών'}</span></div>
    {toggle}
  </header>
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

// One certificate: what is on file and, while it is awaited, its own form and file;
// once sent, a short green summary.
function CertificateItem({ item, index, total, token, language, disabled, onSubmitted, onStale }) {
  const en = language === 'en'
  const [form, setForm] = useState({ type: item.type || '', number: '', issuer: item.issuer || '', issuedOn: '', expiresOn: '', note: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState([])
  const [failure, setFailure] = useState('')
  const set = next => setForm(current => ({ ...current, ...next }))
  const open = item.status === 'pending' && !disabled
  const expired = isExpired(item)
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
  const counter = en ? `Certificate ${index + 1} of ${total}` : `Πιστοποιητικό ${index + 1} από ${total}`
  if (item.status !== 'pending') {
    const stateText = item.status === 'accepted' ? (en ? 'Accepted' : 'Έγινε αποδεκτό') : item.status === 'rejected' ? (en ? 'Not accepted' : 'Δεν έγινε αποδεκτό') : (en ? `Submitted on ${dayTime(item.submittedAt, en)}` : `Υποβλήθηκε στις ${dayTime(item.submittedAt, en)}`)
    return <section className={`supplier-certificate-item is-done${item.status === 'rejected' ? ' is-rejected' : ''}`} aria-label={`${counter}: ${certificateName(item)}`}>
      <CheckCircle2 size={20} aria-hidden="true" /><div><strong>{certificateName(item)}</strong>{item.number && <small>{en ? 'No. on file ' : 'Αρ. στο αρχείο '}{item.number}</small>}</div><span className="supplier-certificate-state">{stateText}</span>
    </section>
  }
  return <section className="supplier-certificate-item" aria-labelledby={`supplier-item-${item.id}`}>
    <header className="supplier-certificate-head">
      <span className="supplier-certificate-counter">{counter}</span>
      <h2 id={`supplier-item-${item.id}`}><FileText size={18} aria-hidden="true" />{certificateName(item)}</h2>
      <span className={`supplier-certificate-pill ${expired ? 'is-expired' : 'is-expiring'}`}>{expired ? (en ? 'Expired' : 'Έληξε') : (en ? 'Expires soon' : 'Λήγει')}</span>
    </header>
    <dl className="supplier-certificate-facts">
      <div><dt>{en ? 'Number on file' : 'Αριθμός στο αρχείο'}</dt><dd>{item.number || '—'}</dd></div>
      <div><dt>{en ? 'Issued by' : 'Φορέας'}</dt><dd>{item.issuer || '—'}</dd></div>
      <div><dt>{expired ? (en ? 'Expired on' : 'Έληξε στις') : (en ? 'Expires on' : 'Λήγει στις')}</dt><dd className={expired ? 'is-expired' : 'is-expiring'}>{day(item.expiresOn, en)}</dd></div>
    </dl>
    {item.reviewComment && <p className="supplier-certificate-comment">{en ? 'Note from the hospital: ' : 'Σημείωση του νοσοκομείου: '}{item.reviewComment}</p>}
    {open && <div className="supplier-certificate-form">
      <h3>{en ? 'The renewed certificate' : 'Το ανανεωμένο πιστοποιητικό'}</h3>
      <FormGrid columns={2}>
        <Field label={en ? 'Certificate type *' : 'Τύπος πιστοποιητικού *'}><input value={form.type} maxLength={200} onChange={e => set({ type: e.target.value })} aria-invalid={problems.includes('type') || undefined} /></Field>
        <Field label={en ? 'Certificate number *' : 'Αριθμός πιστοποιητικού *'}><input value={form.number} maxLength={200} onChange={e => set({ number: e.target.value })} aria-invalid={problems.includes('number') || undefined} /></Field>
        <div className="supplier-certificate-wide"><Field label={en ? 'Issued by' : 'Φορέας έκδοσης'}><input value={form.issuer} maxLength={200} onChange={e => set({ issuer: e.target.value })} /></Field></div>
        <ManualDateField label={en ? 'Issue date' : 'Ημερομηνία έκδοσης'} optional value={form.issuedOn} onChange={value => set({ issuedOn: value })} />
        <ManualDateField label={en ? 'Expiry date *' : 'Ημερομηνία λήξης *'} value={form.expiresOn} onChange={value => set({ expiresOn: value })} />
      </FormGrid>
      <FileDrop file={file} en={en} invalid={problems.some(code => code.startsWith('file'))} onChange={next => { setFile(next); setProblems(current => current.filter(code => !code.startsWith('file'))) }} />
      <Field label={en ? 'Note' : 'Σημείωση'}><textarea rows={2} maxLength={2000} value={form.note} onChange={e => set({ note: e.target.value })} /></Field>
      <div aria-live="polite">
        {problems.length > 0 && <p className="field-error supplier-certificate-error" role="alert">{en ? 'Please check: ' : 'Ελέγξτε: '}{submissionProblemText(problems, language).join(' · ')}</p>}
        {failure && <p className="field-error supplier-certificate-error" role="alert">{failure}</p>}
      </div>
      <div className="supplier-certificate-actions"><Button loading={busy} onClick={submit}>{!busy && <FileUp size={16} aria-hidden="true" />}{busy ? (en ? ' Uploading…' : ' Αποστολή…') : (en ? ' Submit certificate' : ' Υποβολή πιστοποιητικού')}</Button></div>
    </div>}
  </section>
}

// The certificate file: click or drop, shows name, size and type; PDF or image up to 10 MB.
function FileDrop({ file, en, invalid, onChange }) {
  const id = useId()
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState('')
  const take = picked => {
    if (!picked) return
    const problem = fileProblem(picked)
    if (problem) { setError(SUBMISSION_PROBLEMS[problem][en ? 1 : 0]); onChange(null); return }
    setError('')
    onChange(picked)
  }
  const clear = () => { onChange(null); setError(''); if (input.current) input.current.value = '' }
  return <div className="supplier-file">
    <span className="lo-field-label" id={`${id}-label`}>{en ? 'File (PDF or image, up to 10 MB) *' : 'Αρχείο (PDF ή εικόνα, έως 10 MB) *'}</span>
    <input ref={input} id={`${id}-input`} className="supplier-file-input" type="file" accept={FILE_ACCEPT} aria-labelledby={`${id}-label`} onChange={e => take(e.target.files?.[0] || null)} />
    {file
      ? <div className="supplier-file-chosen"><FileText size={22} aria-hidden="true" /><div><strong>{file.name}</strong><small>{size(file.size)} · {(file.type || '').replace('application/', '').replace('image/', '').toUpperCase() || (en ? 'file' : 'αρχείο')}</small></div><button type="button" className="supplier-file-remove" onClick={clear} aria-label={en ? `Remove file ${file.name}` : `Αφαίρεση αρχείου ${file.name}`}><X size={16} aria-hidden="true" /></button></div>
      : <label htmlFor={`${id}-input`} className={`supplier-file-zone${over ? ' is-over' : ''}${invalid || error ? ' is-invalid' : ''}`} onDragOver={event => { event.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={event => { event.preventDefault(); setOver(false); take(event.dataTransfer?.files?.[0]) }}>
        <UploadCloud size={26} aria-hidden="true" /><strong>{en ? 'Drag the file here or click to choose' : 'Σύρετε εδώ το αρχείο ή πατήστε για επιλογή'}</strong><small>PDF, JPG, PNG, WebP · {en ? 'up to' : 'έως'} 10 MB</small>
      </label>}
    {error && <p className="field-error supplier-certificate-error" role="alert">{error}</p>}
  </div>
}

function Frame({ band, children }) { return <main className="public-flow-page supplier-portal"><div className="supplier-portal-shell">{band}{children}</div></main> }
function Status({ title, text, icon: Icon }) { return <div className="public-flow-card public-flow-status"><Icon size={34} /><h1>{title}</h1>{text && <p>{text}</p>}</div> }
