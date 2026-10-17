import { useMemo, useRef } from 'react'
import qrcode from 'qrcode-generator'
import { Copy, ExternalLink, Printer, Tablet } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { printElement } from '../../../design-system/printElement'
import { isSurveyOpen, textOf } from './surveyModel'

// The public address of a survey; ?d= fixes the department, ?kiosk=1 a tablet.
export function surveyLink(survey, { departmentId = '', kiosk = false } = {}) {
  const base = `${window.location.origin}/survey/${encodeURIComponent(survey.publicToken || '')}`
  const query = new URLSearchParams()
  if (departmentId) query.set('d', departmentId)
  if (kiosk) query.set('kiosk', '1')
  return query.toString() ? `${base}?${query}` : base
}

// A QR code drawn in the browser (the link is never sent elsewhere to draw it).
export function QrCode({ text, size = 180, label }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text, 'Byte')
    qr.make()
    const count = qr.getModuleCount()
    let d = ''
    for (let row = 0; row < count; row += 1) for (let col = 0; col < count; col += 1) if (qr.isDark(row, col)) d += `M${col + 4},${row + 4}h1v1h-1z`
    return { d, count: count + 8 }
  }, [text])
  return <svg className="survey-qr" viewBox={`0 0 ${path.count} ${path.count}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges"><rect width={path.count} height={path.count} fill="#fff" /><path d={path.d} fill="#0f2233" /></svg>
}

// Where a survey's answers come from: its link, a poster with the QR code for
// the whole hospital or each department, and a tablet left at the ward.
export function SurveyCollect({ survey, departments = [], language = 'el' }) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const posters = useRef(null)
  const covered = survey.departmentIds?.length ? departments.filter(item => survey.departmentIds.includes(item.id || item.name)) : departments
  const title = textOf(survey, language)
  const open = isSurveyOpen(survey)
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); notify(en ? 'Link copied.' : 'Ο σύνδεσμος αντιγράφηκε.', 'success') } catch { notify(text, 'info') }
  }
  const targets = [{ id: '', name: en ? 'Whole hospital' : 'Όλο το νοσοκομείο', hint: en ? 'The respondent chooses the department' : 'Ο ερωτώμενος επιλέγει το τμήμα' }, ...covered.map(item => ({ id: item.id || item.name, name: en ? item.nameEn || item.name : item.name, hint: en ? 'The department is filled in' : 'Το τμήμα συμπληρώνεται μόνο του' }))]
  return <div className="survey-collect">
    {!open && <div className="governance-banner"><span>{survey.status === 'draft' ? (en ? 'The survey is a draft: open it to start collecting answers. The links work once it is open.' : 'Η έρευνα είναι προσχέδιο: ανοίξτε τη για να ξεκινήσει η συλλογή. Οι σύνδεσμοι λειτουργούν όταν είναι ανοιχτή.') : (en ? 'The survey does not take answers now (closed or outside its dates).' : 'Η έρευνα δεν δέχεται απαντήσεις τώρα (έκλεισε ή είναι εκτός ημερομηνιών).')}</span></div>}
    <div className="survey-collect-actions">
      <Button variant="secondary" onClick={() => printElement(posters.current, { title: `${survey.code} ${title}` })}><Printer size={15} />{en ? 'Print the posters' : 'Εκτύπωση αφισών'}</Button>
      <Button variant="secondary" onClick={() => window.open(surveyLink(survey, { kiosk: true }), '_blank', 'noopener')}><Tablet size={15} />{en ? 'Open on a tablet' : 'Άνοιγμα σε tablet'}</Button>
    </div>
    <div className="survey-posters" ref={posters}>
      {targets.map(target => { const link = surveyLink(survey, { departmentId: target.id }); return <article key={target.id || 'all'} className="survey-poster">
        <header><span>{target.name}</span><strong>{title}</strong></header>
        <QrCode text={link} label={en ? `QR code: ${target.name}` : `Κωδικός QR: ${target.name}`} />
        <p>{en ? 'Scan with your phone camera. Anonymous, about 3 minutes.' : 'Σκανάρετε με την κάμερα του κινητού. Ανώνυμα, περίπου 3 λεπτά.'}</p>
        <small className="survey-poster-link">{link}</small>
        <footer className="survey-poster-tools">
          <small>{target.hint}</small>
          <button type="button" className="quality-panel-all" onClick={() => copy(link)}><Copy size={12} /> {en ? 'Copy link' : 'Αντιγραφή'}</button>
          <button type="button" className="quality-panel-all" onClick={() => window.open(link, '_blank', 'noopener')}><ExternalLink size={12} /> {en ? 'Open' : 'Άνοιγμα'}</button>
        </footer>
      </article> })}
    </div>
  </div>
}
