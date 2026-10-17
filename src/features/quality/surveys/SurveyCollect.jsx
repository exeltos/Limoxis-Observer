import { useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Copy, ExternalLink, Play, Printer, Smartphone, Tablet } from 'lucide-react'
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

// How a survey's answers come in: one QR code for the survey, which patients
// scan with their phone; optionally one poster per department, so the answer
// is recorded for that department without asking; and a tablet at the ward.
export function SurveyCollect({ survey, departments = [], language = 'el', canOpen = false, onOpen }) {
  const en = language === 'en'
  const { notify } = useFeedback()
  const sheet = useRef(null)
  const [printing, setPrinting] = useState(null)
  const title = textOf(survey, language)
  const open = isSurveyOpen(survey)
  const covered = survey.departmentIds?.length ? departments.filter(item => survey.departmentIds.includes(item.id || item.name)) : []
  const nameOf = item => (en ? item.nameEn || item.name : item.name)
  const main = surveyLink(survey)
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); notify(en ? 'Link copied.' : 'Ο σύνδεσμος αντιγράφηκε.', 'success') } catch { notify(text, 'info') }
  }
  // The posters are drawn off screen, then printed on their own.
  useEffect(() => {
    if (!printing || !sheet.current) return
    printElement(sheet.current, { title: `${survey.code} ${title}` })
    setPrinting(null)
  }, [printing, survey.code, title])
  const hospitalPoster = { id: '', name: en ? 'Whole hospital' : 'Όλο το νοσοκομείο' }
  return <div className="survey-collect">
    {!open && <div className="survey-collect-closed">
      <div><strong>{survey.status === 'draft' ? (en ? 'The survey is a draft: the QR code does not work yet' : 'Η έρευνα είναι προσχέδιο: ο κωδικός QR δεν λειτουργεί ακόμη') : (en ? 'The survey does not take answers now' : 'Η έρευνα δεν δέχεται απαντήσεις τώρα')}</strong>
        <span>{survey.status === 'draft' ? (en ? 'A phone that scans it sees “not available”. Open the survey and the same code starts working; you can print the posters now.' : 'Όποιος το σκανάρει βλέπει «δεν είναι διαθέσιμη». Μόλις ανοίξετε την έρευνα, ο ίδιος κωδικός λειτουργεί· τις αφίσες μπορείτε να τις τυπώσετε από τώρα.') : (en ? 'It is closed or outside its dates.' : 'Έκλεισε ή είναι εκτός ημερομηνιών.')}</span></div>
      {canOpen && survey.status === 'draft' && <Button onClick={onOpen}><Play size={15} />{en ? 'Open the survey' : 'Άνοιγμα έρευνας'}</Button>}
    </div>}
    <section className="survey-collect-main">
      <div className={`survey-collect-code ${open ? '' : 'is-off'}`}><QrCode text={main} size={200} label={en ? `QR code of ${title}` : `Κωδικός QR: ${title}`} /></div>
      <div className="survey-collect-how">
        <h3>{en ? 'The survey’s QR code' : 'Ο κωδικός QR της έρευνας'}</h3>
        <ol>
          <li>{en ? 'Print the poster and put it where patients see it (room, reception, discharge).' : 'Τυπώστε την αφίσα και βάλτε τη εκεί που τη βλέπουν οι ασθενείς (δωμάτιο, υποδοχή, εξιτήριο).'}</li>
          <li>{en ? 'The patient scans it with the phone camera: the questionnaire opens, without an account or a password.' : 'Ο ασθενής τη σκανάρει με την κάμερα του κινητού: ανοίγει το ερωτηματολόγιο, χωρίς λογαριασμό και κωδικούς.'}</li>
          <li>{en ? 'Answers are anonymous and appear at once under Responses and Results.' : 'Οι απαντήσεις είναι ανώνυμες και εμφανίζονται αμέσως στις Απαντήσεις και στα Αποτελέσματα.'}</li>
        </ol>
        <div className="survey-collect-buttons">
          <Button onClick={() => setPrinting([hospitalPoster])}><Printer size={15} />{en ? 'Print the poster' : 'Εκτύπωση αφίσας'}</Button>
          <Button variant="secondary" onClick={() => copy(main)}><Copy size={15} />{en ? 'Copy the link' : 'Αντιγραφή συνδέσμου'}</Button>
          <Button variant="secondary" onClick={() => window.open(main, '_blank', 'noopener')}><Smartphone size={15} />{en ? 'Try it' : 'Δοκιμή'}</Button>
          <Button variant="secondary" onClick={() => window.open(surveyLink(survey, { kiosk: true }), '_blank', 'noopener')} title={en ? 'For a tablet at the ward: the form starts again after each answer.' : 'Για tablet στο τμήμα: η φόρμα ξαναρχίζει μετά από κάθε απάντηση.'}><Tablet size={15} />{en ? 'Tablet mode' : 'Λειτουργία tablet'}</Button>
        </div>
        <small>{covered.length > 1 ? (en ? 'With this code the patient chooses the department.' : 'Με αυτόν τον κωδικό ο ασθενής διαλέγει το τμήμα.') : covered.length === 1 ? (en ? `Answers are recorded for ${nameOf(covered[0])}.` : `Οι απαντήσεις καταγράφονται στο τμήμα ${nameOf(covered[0])}.`) : (en ? 'The survey covers every department: the patient chooses one.' : 'Η έρευνα αφορά όλα τα τμήματα: ο ασθενής διαλέγει ένα.')}</small>
      </div>
    </section>
    <section className="survey-collect-departments">
      <header><div><h3>{en ? 'A poster per department' : 'Αφίσα ανά τμήμα'}</h3><p>{en ? 'Optional: a department’s poster records the answer for that department, without asking the patient.' : 'Προαιρετικά: με την αφίσα ενός τμήματος η απάντηση καταγράφεται σε αυτό, χωρίς να ρωτηθεί ο ασθενής.'}</p></div>
        {covered.length > 1 && <Button variant="secondary" onClick={() => setPrinting(covered.map(item => ({ id: item.id || item.name, name: nameOf(item) })))}><Printer size={15} />{en ? `Print all ${covered.length}` : `Εκτύπωση όλων (${covered.length})`}</Button>}
      </header>
      {covered.length > 1 ? <ul>{covered.map(item => { const id = item.id || item.name; const link = surveyLink(survey, { departmentId: id }); return <li key={id}>
        <strong>{nameOf(item)}</strong>
        <span className="row-actions">
          <button type="button" className="quality-panel-all" onClick={() => setPrinting([{ id, name: nameOf(item) }])}><Printer size={13} /> {en ? 'Poster' : 'Αφίσα'}</button>
          <button type="button" className="quality-panel-all" onClick={() => copy(link)}><Copy size={13} /> {en ? 'Link' : 'Σύνδεσμος'}</button>
          <button type="button" className="quality-panel-all" onClick={() => window.open(link, '_blank', 'noopener')}><ExternalLink size={13} /> {en ? 'Try' : 'Δοκιμή'}</button>
        </span>
      </li> })}</ul> : <p className="survey-collect-note">{covered.length === 1 ? (en ? 'The survey covers one department, so its QR code above already records it.' : 'Η έρευνα αφορά ένα τμήμα, οπότε ο κωδικός παραπάνω το καταγράφει ήδη.') : (en ? 'To print one poster per department, choose the survey’s departments under Questionnaire.' : 'Για αφίσα ανά τμήμα, επιλέξτε τα τμήματα της έρευνας στο Ερωτηματολόγιο.')}</p>}
    </section>
    {printing && <div className="survey-print-stage" aria-hidden="true"><div className="survey-posters" ref={sheet}>
      {printing.map(target => <article key={target.id || 'all'} className="survey-poster">
        <header>{target.id && <span>{target.name}</span>}<strong>{title}</strong></header>
        <QrCode text={surveyLink(survey, { departmentId: target.id })} size={260} label={target.name} />
        <p>{en ? 'Scan with your phone camera. Anonymous, about 3 minutes.' : 'Σκανάρετε με την κάμερα του κινητού σας. Ανώνυμα, περίπου 3 λεπτά.'}</p>
      </article>)}
    </div></div>}
  </div>
}
