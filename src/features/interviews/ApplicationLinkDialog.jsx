import { useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Copy, QrCode, RefreshCw, Tablet, XCircle } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { applicationPath, formatCode } from './applicationModel'
import { cancelApplicationLink, createApplicationLink, interviewsErrorMessage } from './interviewsService'
import { fmtStamp } from './interviewsModel'

// The QR code is drawn in the browser: the link is never sent elsewhere to draw it.
function LinkQr({ text, label }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text, 'Byte')
    qr.make()
    const count = qr.getModuleCount()
    let d = ''
    for (let row = 0; row < count; row += 1) for (let col = 0; col < count; col += 1) if (qr.isDark(row, col)) d += `M${col + 4},${row + 4}h1v1h-1z`
    return { d, count: count + 8 }
  }, [text])
  return <svg className="interviews-apply-qr" viewBox={`0 0 ${path.count} ${path.count}`} role="img" aria-label={label} shapeRendering="crispEdges"><rect width={path.count} height={path.count} fill="#fff" /><path d={path.d} fill="#0f2233" /></svg>
}

// «Αίτηση από tablet»: HR picks the position (optional) and gets a single-use link for one
// candidate, valid 24 hours, as a QR code to scan with the tablet, a short code to type at
// /apply, or opened full screen on this device.
export function ApplicationLinkDialog({ organizationId, positions = [], onClose }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const [position, setPosition] = useState('')
  const [link, setLink] = useState(null)
  const [busy, setBusy] = useState(false)
  const url = link ? `${window.location.origin}${applicationPath(link.token)}` : ''
  async function create() {
    setBusy(true)
    try { setLink(await createApplicationLink(organizationId, position)) } catch (error) { notify(interviewsErrorMessage(error, language), 'error') } finally { setBusy(false) }
  }
  async function cancel() {
    try { await cancelApplicationLink(link.id); notify(en ? 'The link no longer works.' : 'Ο σύνδεσμος δεν λειτουργεί πια.', 'success'); setLink(null) } catch (error) { notify(interviewsErrorMessage(error, language), 'error') }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(url); notify(en ? 'Link copied.' : 'Ο σύνδεσμος αντιγράφηκε.', 'success') } catch { notify(url, 'info') } }
  return <ObserverDialog width="wide" title={en ? 'Application from a tablet' : 'Αίτηση από tablet'} subtitle={en ? 'The candidate fills in the application, gives the consents and signs on the tablet; it appears here as a new application.' : 'Ο υποψήφιος συμπληρώνει την αίτηση, δίνει τις συναινέσεις και υπογράφει στο tablet· εμφανίζεται εδώ ως νέα αίτηση.'} onClose={onClose}>
    {!link ? <div className="interviews-apply-start">
      <SearchableSelect label={en ? 'Position (optional)' : 'Θέση (προαιρετικά)'} value={position} allowCustom options={positions.map(item => ({ value: item, label: item }))} onChange={value => setPosition(value || '')} placeholder={en ? 'Any position: the candidate writes it' : 'Χωρίς θέση: τη γράφει ο υποψήφιος'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel={en ? 'Clear' : 'Καθαρισμός'} />
      <ul className="interviews-apply-steps">
        <li>{en ? 'One link is one application: it works once and for 24 hours.' : 'Ένας σύνδεσμος για μία αίτηση: λειτουργεί μία φορά και για 24 ώρες.'}</li>
        <li>{en ? 'The tablet needs no account; the candidate sees only the form, never the rest of the application.' : 'Το tablet δεν χρειάζεται λογαριασμό· ο υποψήφιος βλέπει μόνο τη φόρμα, ποτέ την υπόλοιπη εφαρμογή.'}</li>
        <li>{en ? 'After sending, the tablet thanks and clears itself for the next person.' : 'Μετά την υποβολή, το tablet ευχαριστεί και καθαρίζει για τον επόμενο.'}</li>
      </ul>
      <div className="interviews-apply-actions"><Button disabled={busy} onClick={create}><QrCode size={15} />{busy ? (en ? 'Creating…' : 'Δημιουργία…') : (en ? 'Create the link' : 'Δημιουργία συνδέσμου')}</Button></div>
    </div> : <div className="interviews-apply-ready">
      <LinkQr text={url} label={en ? 'QR code of the application link' : 'Κωδικός QR του συνδέσμου αίτησης'} />
      <div className="interviews-apply-info">
        {link.position && <span className="interviews-apply-position">{link.position}</span>}
        <span className="interviews-apply-label">{en ? 'Code' : 'Κωδικός'}</span>
        <strong className="interviews-apply-code">{formatCode(link.token)}</strong>
        <span className="interviews-apply-url">{url}</span>
        <ol className="interviews-apply-steps">
          <li>{en ? 'Scan the QR code with the tablet camera, or type the code at' : 'Σκανάρετε τον κωδικό QR με την κάμερα του tablet ή πληκτρολογήστε τον κωδικό στο'} <b>{`${window.location.host}/apply`}</b>.</li>
          <li>{en ? 'Hand the tablet to the candidate.' : 'Δώστε το tablet στον υποψήφιο.'}</li>
        </ol>
        <small>{en ? 'Valid until' : 'Ισχύει έως'} {fmtStamp(link.expiresAt, language)} · {en ? 'single use' : 'μίας χρήσης'}</small>
        <div className="interviews-apply-actions">
          <Button onClick={() => window.open(`${url}?fs=1`, '_blank', 'noopener')}><Tablet size={15} />{en ? 'Open on this device' : 'Άνοιγμα σε αυτή τη συσκευή'}</Button>
          <Button variant="secondary" onClick={copy}><Copy size={15} />{en ? 'Copy the link' : 'Αντιγραφή συνδέσμου'}</Button>
          <Button variant="secondary" onClick={() => setLink(null)}><RefreshCw size={15} />{en ? 'New link' : 'Νέος σύνδεσμος'}</Button>
          {link.id && <Button variant="secondary" onClick={cancel}><XCircle size={15} />{en ? 'Cancel the link' : 'Ακύρωση συνδέσμου'}</Button>}
        </div>
      </div>
    </div>}
  </ObserverDialog>
}
