import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Clock3, ShieldCheck } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { loadPublicSurvey, submitPublicSurvey } from './surveyService'
import { SurveyForm, missingAnswers } from './SurveyForm'
import { cleanAnswers } from './surveyModel'

// Public page of a survey's link or QR poster: anyone answers, without an
// account and without giving a name. ?d= fixes the department (one QR per
// ward); ?kiosk=1 is a tablet at the ward: after each answer it starts again.
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
  const [missing, setMissing] = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState('')
  const top = useRef(null)
  const load = useCallback(async () => {
    try { setState({ loading: false, data: await loadPublicSurvey(token), error: null }) } catch (error) { setState({ loading: false, data: null, error }) }
  }, [token])
  useEffect(() => { void load() }, [load])
  // A tablet starts again for the next person a few seconds after thanking.
  useEffect(() => {
    if (!done || !kiosk) return undefined
    const timer = setTimeout(() => { setDone(false); setAnswers({}); setMissing([]); setDepartmentId(fixedDepartment) }, 6000)
    return () => clearTimeout(timer)
  }, [done, kiosk, fixedDepartment])

  if (state.loading) return <Frame><RouteLoading /></Frame>
  if (state.error || !state.data) return <Frame><Status icon={ShieldCheck} title={en ? 'This survey is not available' : 'Η έρευνα δεν είναι διαθέσιμη'} text={en ? 'Check the link, or ask the staff of the department.' : 'Ελέγξτε τον σύνδεσμο ή ρωτήστε το προσωπικό του τμήματος.'} /></Frame>
  const survey = state.data
  const title = en ? survey.titleEn || survey.title : survey.title
  if (!survey.open) return <Frame><Status icon={Clock3} title={en ? 'This survey is closed' : 'Η έρευνα έχει ολοκληρωθεί'} text={en ? `Thank you for your interest. ${survey.organizationName || ''}` : `Ευχαριστούμε για το ενδιαφέρον σας. ${survey.organizationName || ''}`} /></Frame>
  if (done) return <Frame><Status icon={CheckCircle2} title={en ? 'Thank you!' : 'Ευχαριστούμε!'} text={kiosk ? (en ? 'Your answers were recorded. The form starts again for the next person.' : 'Οι απαντήσεις σας καταγράφηκαν. Η φόρμα ξεκινά ξανά για τον επόμενο.') : (en ? 'Your answers were recorded. They help us improve.' : 'Οι απαντήσεις σας καταγράφηκαν. Μας βοηθούν να γινόμαστε καλύτεροι.')} /></Frame>

  const departments = survey.departments || []
  const askDepartment = !fixedDepartment && departments.length > 1
  async function submit() {
    const gaps = missingAnswers(survey.questions, answers, { askDepartment, departmentId })
    setMissing(gaps)
    if (gaps.length) { top.current?.parentElement?.querySelector('.is-missing')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    const kept = cleanAnswers(survey.questions, answers)
    if (!kept) return
    setBusy(true)
    setFailed('')
    try { await submitPublicSurvey(token, departmentId || (departments.length === 1 ? departments[0].id : ''), kept); setDone(true); window.scrollTo?.(0, 0) } catch (error) {
      setFailed(String(error?.message || '').includes('SURVEY_BUSY') ? (en ? 'Many answers are arriving right now. Please try again in a minute.' : 'Έρχονται πολλές απαντήσεις αυτή τη στιγμή. Δοκιμάστε ξανά σε ένα λεπτό.') : (en ? 'Your answers could not be sent. Please try again.' : 'Οι απαντήσεις δεν στάλθηκαν. Δοκιμάστε ξανά.'))
    } finally { setBusy(false) }
  }
  return <Frame>
    <div className="public-flow-card survey-public-card" ref={top}>
      <header className="survey-public-head">
        <div><span className="eyebrow">{survey.organizationName}</span><h1>{title}</h1>{(en ? survey.descriptionEn || survey.description : survey.description) && <p>{en ? survey.descriptionEn || survey.description : survey.description}</p>}</div>
        <button type="button" className="survey-language" onClick={() => setLanguage(en ? 'el' : 'en')}>{en ? 'Ελληνικά' : 'English'}</button>
      </header>
      <p className="survey-anonymous"><ShieldCheck size={15} />{en ? 'Anonymous: we do not ask for your name or any details.' : 'Ανώνυμα: δεν ζητάμε όνομα ούτε στοιχεία σας.'}</p>
      <SurveyForm questions={survey.questions} answers={answers} onChange={setAnswers} language={language} missing={missing} departments={departments} departmentId={departmentId} onDepartment={setDepartmentId} askDepartment={askDepartment} />
      {missing.length > 0 && <p className="survey-missing">{en ? 'Some required questions are not answered yet.' : 'Κάποιες υποχρεωτικές ερωτήσεις δεν έχουν απαντηθεί.'}</p>}
      {failed && <p className="survey-missing">{failed}</p>}
      <div className="survey-public-actions"><Button disabled={busy} onClick={submit}><ClipboardList size={16} />{busy ? (en ? 'Sending…' : 'Αποστολή…') : (en ? 'Send my answers' : 'Αποστολή απαντήσεων')}</Button></div>
    </div>
  </Frame>
}

function Frame({ children }) { return <main className="public-flow-page"><div className="public-flow-shell">{children}</div></main> }
function Status({ title, text, icon: Icon }) { return <div className="public-flow-card public-flow-status"><Icon size={34} /><h1>{title}</h1>{text && <p>{text}</p>}</div> }
