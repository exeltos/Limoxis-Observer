import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Send, ShieldCheck } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { loadPublicSurvey, submitPublicSurvey } from './surveyService'
import { SurveyForm, formSections, missingAnswers } from './SurveyForm'
import { cleanAnswers, sectionLabel } from './surveyModel'

// Public page of a survey's link or QR poster: anyone answers from a phone,
// without an account and without giving a name, one section at a time. ?d=
// fixes the department (one QR per ward); ?kiosk=1 is a tablet at the ward:
// after each answer it starts again for the next person.
export function SurveyRespondPage() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const { language, setLanguage } = useLanguage()
  const en = language === 'en'
  const kiosk = params.get('kiosk') === '1'
  const fixedDepartment = params.get('d') || ''
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [answers, setAnswers] = useState({})
  const [departmentId, setDepartmentId] = useState(fixedDepartment)
  const [step, setStep] = useState(0)
  const [missing, setMissing] = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState('')
  const top = useRef(null)
  const load = useCallback(async () => {
    try { setState({ loading: false, data: await loadPublicSurvey(token), error: null }) } catch (error) { setState({ loading: false, data: null, error }) }
  }, [token])
  useEffect(() => { void load() }, [load])
  const restart = useCallback(() => { setDone(false); setAnswers({}); setMissing([]); setStep(0); setDepartmentId(fixedDepartment) }, [fixedDepartment])
  // A tablet starts again for the next person a few seconds after thanking.
  useEffect(() => {
    if (!done || !kiosk) return undefined
    const timer = setTimeout(restart, 6000)
    return () => clearTimeout(timer)
  }, [done, kiosk, restart])
  const survey = state.data
  const sections = useMemo(() => formSections(survey, answers), [survey, answers])

  if (state.loading) return <Frame><RouteLoading /></Frame>
  if (state.error || !survey) return <Frame><Status icon={ShieldCheck} title={en ? 'This survey is not available' : 'Η έρευνα δεν είναι διαθέσιμη'} text={en ? 'It may not have opened yet. Check the link, or ask the staff of the department.' : 'Ίσως δεν έχει ανοίξει ακόμη. Ελέγξτε τον σύνδεσμο ή ρωτήστε το προσωπικό του τμήματος.'} /></Frame>
  const title = en ? survey.titleEn || survey.title : survey.title
  const intro = en ? survey.descriptionEn || survey.description : survey.description
  if (!survey.open) return <Frame organization={survey.organizationName}><Status icon={Clock3} title={en ? 'This survey is closed' : 'Η έρευνα έχει ολοκληρωθεί'} text={en ? `Thank you for your interest. ${survey.organizationName || ''}` : `Ευχαριστούμε για το ενδιαφέρον σας. ${survey.organizationName || ''}`} /></Frame>
  if (done) return <Frame organization={survey.organizationName}><Status icon={CheckCircle2} title={en ? 'Thank you!' : 'Ευχαριστούμε!'} text={kiosk ? (en ? 'Your answers were recorded. The form starts again for the next person.' : 'Οι απαντήσεις σας καταγράφηκαν. Η φόρμα ξεκινά ξανά για τον επόμενο.') : (en ? 'Your answers were recorded. They help us improve.' : 'Οι απαντήσεις σας καταγράφηκαν. Μας βοηθούν να γινόμαστε καλύτεροι.')} /></Frame>

  const departments = survey.departments || []
  const askDepartment = !fixedDepartment && departments.length > 1
  const last = Math.max(0, sections.length - 1)
  const current = sections[Math.min(step, last)]
  const fixed = departments.find(item => item.id === fixedDepartment)
  const scrollTop = () => top.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  // A step goes on only when its required questions (and the department, on the first) are answered.
  function check(questions, withDepartment) {
    const gaps = missingAnswers(questions, answers, { askDepartment: withDepartment && askDepartment, departmentId })
    setMissing(gaps)
    if (gaps.length) setTimeout(() => top.current?.parentElement?.querySelector('.is-missing')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
    return !gaps.length
  }
  function next() { if (!check(current?.questions || [], step === 0)) return; setStep(step + 1); scrollTop() }
  async function submit() {
    if (!check(survey.questions, true)) { const first = sections.findIndex(section => section.questions.some(question => missingAnswers([question], answers).length)); if (first >= 0) setStep(first); return }
    const kept = cleanAnswers(survey.questions, answers)
    if (!kept) return
    setBusy(true)
    setFailed('')
    try { await submitPublicSurvey(token, departmentId || (departments.length === 1 ? departments[0].id : ''), kept); setDone(true); window.scrollTo?.(0, 0) } catch (error) {
      setFailed(String(error?.message || '').includes('SURVEY_BUSY') ? (en ? 'Many answers are arriving right now. Please try again in a minute.' : 'Έρχονται πολλές απαντήσεις αυτή τη στιγμή. Δοκιμάστε ξανά σε ένα λεπτό.') : (en ? 'Your answers could not be sent. Please try again.' : 'Οι απαντήσεις δεν στάλθηκαν. Δοκιμάστε ξανά.'))
    } finally { setBusy(false) }
  }
  const progress = sections.length ? Math.round(((Math.min(step, last) + 1) / sections.length) * 100) : 100
  // The department the form is about: fixed by the poster, the survey's only one, or the one chosen.
  const department = fixed || (departments.length === 1 ? departments[0] : departments.find(item => item.id === departmentId))
  return <Frame organization={survey.organizationName} language={language} onLanguage={() => setLanguage(en ? 'el' : 'en')} footer={en ? 'Anonymous: we do not ask for your name or any details.' : 'Ανώνυμα: δεν ζητάμε όνομα ούτε στοιχεία σας.'}>
    <article className="survey-sheet" ref={top}>
      <header className="survey-sheet-head">
        {department && <span className="survey-department">{en ? department.nameEn || department.name : department.name}</span>}
        <h1>{title}</h1>
        {step === 0 && intro && <p>{intro}</p>}
      </header>
      {sections.length > 1 && <div className="survey-progress" aria-label={en ? `Section ${Math.min(step, last) + 1} of ${sections.length}` : `Ενότητα ${Math.min(step, last) + 1} από ${sections.length}`}>
        <div><strong>{current?.key ? sectionLabel(current.key, language, survey.sections || []) : ''}</strong><small>{en ? `Section ${Math.min(step, last) + 1} of ${sections.length}` : `Ενότητα ${Math.min(step, last) + 1} από ${sections.length}`}</small></div>
        <span><i style={{ width: `${progress}%` }} /></span>
      </div>}
      <SurveyForm survey={survey} only={sections.length > 1 ? current?.key ?? '' : null} answers={answers} onChange={next => { setAnswers(next); if (missing.length) setMissing([]) }} language={language} missing={missing} departments={departments} departmentId={departmentId} onDepartment={value => { setDepartmentId(value); if (missing.length) setMissing([]) }} askDepartment={askDepartment && step === 0} />
      {missing.length > 0 && <p className="survey-missing">{en ? 'Some required questions are not answered yet.' : 'Κάποιες υποχρεωτικές ερωτήσεις δεν έχουν απαντηθεί.'}</p>}
      {failed && <p className="survey-missing">{failed}</p>}
      <footer className="survey-sheet-actions">
        {step > 0 ? <Button variant="secondary" disabled={busy} onClick={() => { setStep(step - 1); setMissing([]); scrollTop() }}><ArrowLeft size={16} />{en ? 'Back' : 'Πίσω'}</Button> : <span />}
        {step < last ? <Button onClick={next}>{en ? 'Next' : 'Επόμενο'}<ArrowRight size={16} /></Button> : <Button disabled={busy} onClick={submit}><Send size={16} />{busy ? (en ? 'Sending…' : 'Αποστολή…') : (en ? 'Send my answers' : 'Αποστολή απαντήσεων')}</Button>}
      </footer>
    </article>
  </Frame>
}

// The page around the questionnaire: the hospital's name on a coloured band,
// the sheet in the middle, the promise of anonymity under it.
function Frame({ children, organization = '', language = 'el', onLanguage, footer = '' }) {
  return <main className="survey-page">
    <div className="survey-page-shell">
      <div className="survey-page-top">
        <span className="survey-page-brand">{organization}</span>
        {onLanguage && <button type="button" className="survey-language" onClick={onLanguage}>{language === 'en' ? 'Ελληνικά' : 'English'}</button>}
      </div>
      {children}
      {footer && <p className="survey-page-foot"><ShieldCheck size={14} />{footer}</p>}
    </div>
  </main>
}
function Status({ title, text, icon: Icon }) { return <article className="survey-sheet survey-sheet-status"><Icon size={40} /><h1>{title}</h1>{text && <p>{text}</p>}</article> }
