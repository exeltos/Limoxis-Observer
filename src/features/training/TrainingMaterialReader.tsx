import './trainingScreens.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Eye, FileText, PauseCircle, ShieldCheck, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import type { AccessFile } from './trainingMaterialTime'
import type { TrainingMaterial } from './trainingTypes'
import { IDLE_AFTER_SECONDS, SEND_EVERY_SECONDS, createActiveTimer, formatActiveTime, loadAccessFiles, loadMaterialUrl, trackMaterialTime } from './trainingMaterialTime'

// The files of the programme on the participant's personal link, opened inside the page:
// the active time on each file is counted (the tab is visible and the page is in use) and
// sent every few seconds. The participant is told so before opening a file.
// One «Εκπαιδευτικό υλικό» (owner, 20/11/2026): the uploaded files and the programme's listed material (titles and
// links) together. readOnly (after the submission): the files still open, no time is counted.
interface TrainingMaterialReaderProps { token: string | null, language?: string, materials?: TrainingMaterial[], readOnly?: boolean, emptyText?: string }
const linkOf = (url: string | undefined) => (/^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : '')
export function TrainingMaterialReader({ token, language = 'el', materials = [], readOnly = false, emptyText = '' }: TrainingMaterialReaderProps) {
  const en = language === 'en'
  const [files, setFiles] = useState<AccessFile[]>([])
  const [openId, setOpenId] = useState('')
  const [reader, setReader] = useState({ loading: false, url: '', mimeType: '', error: '' })
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof createActiveTimer> | null>(null)

  useEffect(() => {
    let active = true
    if (!token) { setFiles([]); return () => { active = false } }
    loadAccessFiles(token).then(rows => { if (active) setFiles(rows) }).catch(() => { if (active) setFiles([]) })
    return () => { active = false }
  }, [token])

  const flush = useCallback(async (attachmentId: string) => {
    const timer = timerRef.current
    if (!timer || !attachmentId || !token) return
    const seconds = timer.take()
    if (!seconds) return
    try {
      const result = await trackMaterialTime(token, attachmentId, seconds)
      if (result?.activeSeconds != null) setFiles(rows => rows.map(file => (file.id === attachmentId ? { ...file, activeSeconds: result.activeSeconds } : file)))
    } catch { timer.restore(seconds) }
  }, [token])

  // The clock of the open file: one tick a second, a send every SEND_EVERY_SECONDS.
  useEffect(() => {
    if (!openId || readOnly) return undefined
    const timer = createActiveTimer()
    timerRef.current = timer
    const activity = () => timer.activity()
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel']
    events.forEach(name => window.addEventListener(name, activity, { passive: true }))
    let sinceSend = 0
    const interval = window.setInterval(() => {
      const counted = timer.tick(document.visibilityState === 'visible')
      setPaused(!counted)
      sinceSend += 1
      if (sinceSend >= SEND_EVERY_SECONDS) { sinceSend = 0; void flush(openId) }
    }, 1000)
    const hidden = () => { if (document.visibilityState === 'hidden') void flush(openId) }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.clearInterval(interval)
      events.forEach(name => window.removeEventListener(name, activity))
      document.removeEventListener('visibilitychange', hidden)
      void flush(openId)
    }
  }, [openId, flush, readOnly])

  async function open(file: AccessFile) {
    if (!token) return
    setOpenId('')
    setReader({ loading: true, url: '', mimeType: '', error: '' })
    try {
      const data = await loadMaterialUrl(token, file.id)
      setReader({ loading: false, url: data.url, mimeType: data.mimeType || file.mimeType || '', error: '' })
      setOpenId(file.id)
    } catch {
      setReader({ loading: false, url: '', mimeType: '', error: en ? 'The file could not be opened.' : 'Δεν ήταν δυνατό το άνοιγμα του αρχείου.' })
    }
  }
  const close = () => { setOpenId(''); setReader({ loading: false, url: '', mimeType: '', error: '' }); setPaused(false) }

  const listed = materials.filter(item => item?.title || linkOf(item?.url))
  if (!files.length && !listed.length) return emptyText ? <section className="public-flow-section training-public-section training-reader"><h2><FileText size={17} /> {en ? 'Training material' : 'Εκπαιδευτικό υλικό'}</h2><p className="training-reader-empty">{emptyText}</p></section> : null
  const current = files.find(file => file.id === openId)
  return <section className="public-flow-section training-public-section training-reader">
    <h2><FileText size={17} /> {en ? 'Training material' : 'Εκπαιδευτικό υλικό'}</h2>
    {files.length > 0 && !readOnly && <div className="source-truth-note"><ShieldCheck size={16} /><span>{en
      ? `While you read a file here, the time you actively spend on it is recorded for the training record. The time stops when you leave the page or do nothing for ${IDLE_AFTER_SECONDS} seconds.`
      : `Όσο διαβάζετε ένα αρχείο εδώ, ο χρόνος που το παρακολουθείτε ενεργά καταγράφεται στο αρχείο της εκπαίδευσης. Ο χρόνος σταματά όταν φύγετε από τη σελίδα ή δεν κάνετε τίποτα για ${IDLE_AFTER_SECONDS} δευτερόλεπτα.`}</span></div>}
    {files.map(file => <div key={file.id} className="public-flow-row training-reader-row">
      <strong>{file.fileName}</strong>
      <span>{file.activeSeconds ? `${en ? 'Read' : 'Παρακολουθήθηκε'}: ${formatActiveTime(file.activeSeconds, en)}` : (en ? 'Not opened yet' : 'Δεν έχει ανοιχτεί')}</span>
      {openId === file.id ? <Button variant="secondary" onClick={close}><X size={14} />{en ? 'Close' : 'Κλείσιμο'}</Button> : <Button variant="secondary" disabled={reader.loading} onClick={() => open(file)}><Eye size={14} />{en ? 'Open' : 'Άνοιγμα'}</Button>}
    </div>)}
    {listed.map(item => { const href = linkOf(item.url); return <div key={item.id || item.title} className="public-flow-row training-reader-row">
      <strong>{item.title || href}</strong>
      <span>{item.type || ''}</span>
      {href && <a className="button button-secondary" href={href} target="_blank" rel="noreferrer"><ExternalLink size={14} />{en ? 'Open' : 'Άνοιγμα'}</a>}
    </div> })}
    {reader.error && <div className="setup-note" role="alert">{reader.error}</div>}
    {current && reader.url && <div className="training-reader-frame">
      {!readOnly && <div className="training-reader-status">{paused ? <><PauseCircle size={14} />{en ? 'Paused: move the mouse or scroll to continue counting' : 'Σε παύση: κινήστε το ποντίκι ή κυλήστε για να συνεχίσει η καταγραφή'}</> : <>{en ? 'Recording your reading time' : 'Καταγράφεται ο χρόνος παρακολούθησης'}: {formatActiveTime(current.activeSeconds, en)}</>}</div>}
      {/^image\//.test(reader.mimeType) ? <img src={reader.url} alt={current.fileName} /> : <iframe src={reader.url} title={current.fileName} />}
    </div>}
  </section>
}
