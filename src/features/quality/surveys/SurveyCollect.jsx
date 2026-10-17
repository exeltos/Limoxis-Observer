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
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); notify(en ? 'Link copied.' : 'Ο σύνδεσμος αντιγράφηκε.', 'success') } catch { notify(text, 'info') }
  }
  // The posters are drawn off screen, then printed on their own.
  useEffect(() => {
    if (!printing || !sheet.current) return
    printElement(sheet.current, { title: `${survey.code} ${title}` })
    setPrinting(null)
  }, [printing, survey.code, title])
  const posterOf = item => ({ id: item.id || item.name, name: nameOf(item) })
  const single = covered.length === 1 ? covered[0] : null
  const steps = <ol>
    <li>{en ? 'Print the poster and put it where patients see it (room, nursing station, discharge).' : 'Τυπώστε την αφίσα και βάλτε τη εκεί που τη βλέπουν οι ασθενείς (δωμάτιο, στάση νοσηλευτών, εξιτήριο).'}</li>
    <li>{en ? 'The patient scans it with the phone camera: the questionnaire of the department opens, without an account or a password.' : 'Ο ασθενής τη σκανάρει με την κάμερα του κινητού: ανοίγει το ερωτηματολόγιο του τμήματος, χωρίς λογαριασμό και κωδικούς.'}</li>
    <li>{en ? 'Answers are anonymous and appear at once under Responses and Results.' : 'Οι απαντήσεις είναι ανώνυμες και εμφανίζονται αμέσως στις Απαντήσεις και στα Αποτελέσματα.'}</li>
  </ol>
  return <div className="survey-collect">
    {!open && <div className="survey-collect-closed">
      <div><strong>{survey.status === 'draft' ? (en ? 'The survey is a draft: its QR codes do not work yet' : 'Η έρευνα είναι προσχέδιο: οι κωδικοί QR δεν λειτουργούν ακόμη') : (en ? 'The survey does not take answers now' : 'Η έρευνα δεν δέχεται απαντήσεις τώρα')}</strong>
        <span>{survey.status === 'draft' ? (en ? 'A phone that scans one sees “not available”. Open the survey and the same codes start working; you can print the posters now.' : 'Όποιος σκανάρει βλέπει «δεν είναι διαθέσιμη». Μόλις ανοίξετε την έρευνα, οι ίδιοι κωδικοί λειτουργούν· τις αφίσες μπορείτε να τις τυπώσετε από τώρα.') : (en ? 'It is closed or outside its dates.' : 'Έκλεισε ή είναι εκτός ημερομηνιών.')}</span></div>
      {canOpen && survey.status === 'draft' && covered.length > 0 && <Button onClick={onOpen}><Play size={15} />{en ? 'Open the survey' : 'Άνοιγμα έρευνας'}</Button>}
    </div>}
    {!covered.length && <p className="survey-collect-note survey-collect-empty">{en ? 'Choose first the department the survey is about, under Questionnaire: each department gets its own QR code and its own form.' : 'Επιλέξτε πρώτα το τμήμα που αφορά η έρευνα, στην καρτέλα Ερωτηματολόγιο: κάθε τμήμα έχει δικό του κωδικό QR και δική του φόρμα.'}</p>}
    {single && <section className="survey-collect-main">
      <div className={`survey-collect-code ${open ? '' : 'is-off'}`}><QrCode text={surveyLink(survey, { departmentId: posterOf(single).id })} size={200} label={en ? `QR code: ${nameOf(single)}` : `Κωδικός QR: ${nameOf(single)}`} /></div>
      <div className="survey-collect-how">
        <h3>{en ? `QR code · ${nameOf(single)}` : `Κωδικός QR · ${nameOf(single)}`}</h3>
        {steps}
        <div className="survey-collect-buttons">
          <Button onClick={() => setPrinting([posterOf(single)])}><Printer size={15} />{en ? 'Print the poster' : 'Εκτύπωση αφίσας'}</Button>
          <Button variant="secondary" onClick={() => copy(surveyLink(survey, { departmentId: posterOf(single).id }))}><Copy size={15} />{en ? 'Copy the link' : 'Αντιγραφή συνδέσμου'}</Button>
          <Button variant="secondary" onClick={() => window.open(surveyLink(survey, { departmentId: posterOf(single).id }), '_blank', 'noopener')}><Smartphone size={15} />{en ? 'Try it' : 'Δοκιμή'}</Button>
          <Button variant="secondary" onClick={() => window.open(surveyLink(survey, { departmentId: posterOf(single).id, kiosk: true }), '_blank', 'noopener')} title={en ? 'For a tablet at the ward: the form starts again after each answer.' : 'Για tablet στο τμήμα: η φόρμα ξαναρχίζει μετά από κάθε απάντηση.'}><Tablet size={15} />{en ? 'Tablet mode' : 'Λειτουργία tablet'}</Button>
        </div>
      </div>
    </section>}
    {covered.length > 1 && <section className="survey-collect-departments">
      <header><div><h3>{en ? `One QR code per department (${covered.length})` : `Ένας κωδικός QR ανά τμήμα (${covered.length})`}</h3><p>{en ? 'Each department has its own poster and form: the answer is recorded for that department.' : 'Κάθε τμήμα έχει τη δική του αφίσα και φόρμα: η απάντηση καταγράφεται σε αυτό.'}</p></div>
        <Button onClick={() => setPrinting(covered.map(posterOf))}><Printer size={15} />{en ? 'Print all' : 'Εκτύπωση όλων'}</Button>
      </header>
      <div className="survey-collect-how">{steps}</div>
      <ul>{covered.map(item => { const { id } = posterOf(item); const link = surveyLink(survey, { departmentId: id }); return <li key={id}>
        <strong>{nameOf(item)}</strong>
        <span className="row-actions">
          <button type="button" className="quality-panel-all" onClick={() => setPrinting([posterOf(item)])}><Printer size={13} /> {en ? 'Poster' : 'Αφίσα'}</button>
          <button type="button" className="quality-panel-all" onClick={() => copy(link)}><Copy size={13} /> {en ? 'Link' : 'Σύνδεσμος'}</button>
          <button type="button" className="quality-panel-all" onClick={() => window.open(link, '_blank', 'noopener')}><ExternalLink size={13} /> {en ? 'Try' : 'Δοκιμή'}</button>
          <button type="button" className="quality-panel-all" onClick={() => window.open(surveyLink(survey, { departmentId: id, kiosk: true }), '_blank', 'noopener')}><Tablet size={13} /> Tablet</button>
        </span>
      </li> })}</ul>
    </section>}
    {printing && <div className="survey-print-stage" aria-hidden="true"><div className="survey-posters" ref={sheet}>
      {printing.map(target => <article key={target.id || 'all'} className="survey-poster">
        <header><span>{target.name}</span><strong>{title}</strong></header>
        <QrCode text={surveyLink(survey, { departmentId: target.id })} size={260} label={target.name} />
        <p>{en ? 'Scan with your phone camera. Anonymous, about 3 minutes.' : 'Σκανάρετε με την κάμερα του κινητού σας. Ανώνυμα, περίπου 3 λεπτά.'}</p>
      </article>)}
    </div></div>}
  </div>
}
