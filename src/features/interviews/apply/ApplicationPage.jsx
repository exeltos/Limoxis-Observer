import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Briefcase, Check, CheckCircle2, Clock3, GraduationCap, KeyRound, Languages, Lock, Maximize2, Minimize2, PenLine, Plus, Send, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { readSessionJson, removeSessionValue, writeSessionJson } from '../../../core/storage/browserStorage'
import { EMPLOYMENT_TYPES, GENDERS, LANGUAGES, LANGUAGE_SKILLS, LEVELS, MARITAL, MILITARY, certificateLabel, employmentLabel, genderLabel, levelLabel, maritalLabel, militaryLabel, todayKey, yesNo } from '../interviewsModel'
import { APPLICATION_STEPS, CONSENTS, LIMITS, applicationErrorText, applicationPath, cleanApplication, consentText, demoApplication, draftKey, firstStepWithProblems, formatCode, isDemoToken, maskDay, maskMonth, newApplication, newEducationRow, newEmployerRow, newLanguageRow, normalizeCode, parseMonth, stepKey, stepProblems, stepTitle, validCode } from '../applicationModel'
import { loadApplicationLink, submitApplication } from '../applicationService'
import { SignaturePad } from './SignaturePad'
import './application.css'

const RESET_SECONDS = 20
const L = (en, el, enText) => (en ? enText : el)
const pairs = (map, en) => Object.entries(map).map(([value, labels]) => [value, labels[en ? 1 : 0]])
const shortLevel = (value, language) => levelLabel(value, language).replace(/\s*\(.*\)$/, '')
const TOP_LANGUAGES = ['el', 'en', 'fr', 'de', 'it', 'sq', 'ru']
const SCHOOL_LEVELS = [['Γυμνάσιο', 'Lower secondary'], ['Γενικό Λύκειο', 'General upper secondary'], ['ΕΠΑΛ', 'Vocational upper secondary'], ['ΙΕΚ', 'Vocational training (IEK)'], ['ΑΕΙ', 'University']]
const inPreview = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('helpPreview') === '1'

// Η αίτηση του υποψηφίου στο tablet (/apply/:token): outside the app, no account, one
// step at a time, large touch targets. The form is kept in this tab (sessionStorage)
// until it is sent; after the thank-you the tablet is cleared for the next person.
export function ApplicationPage() {
  const { token = '' } = useParams()
  if (!token) return <CodeEntry />
  return <ApplicationForm key={token} token={token} />
}

function ApplicationForm({ token }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { language, setLanguage } = useLanguage()
  const en = language === 'en'
  const demo = isDemoToken(token)
  const preview = demo && inPreview()
  const key = draftKey(token)
  const [link, setLink] = useState({ loading: true, data: null, error: null })
  const [step, setStep] = useState(() => (preview && Number(params.get('step')) >= 0 ? Math.min(Number(params.get('step')) || 0, APPLICATION_STEPS.length - 1) : readSessionJson(key)?.step || 0))
  const [draft, setDraft] = useState(() => (preview ? demoApplication() : readSessionJson(key)?.draft || newApplication()))
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [done, setDone] = useState(false)
  const sheet = useRef(null)

  useEffect(() => {
    let live = true
    loadApplicationLink(token).then(data => { if (live) setLink({ loading: false, data, error: null }) }).catch(error => { if (live) setLink({ loading: false, data: null, error }) })
    return () => { live = false }
  }, [token])
  // The form stays in this tab only, and only until it is sent.
  useEffect(() => { if (!preview && !done) writeSessionJson(key, { step, draft, savedAt: new Date().toISOString() }) }, [key, step, draft, preview, done])
  const reset = useCallback(() => {
    removeSessionValue(key)
    if (demo) { setDraft(newApplication()); setStep(0); setDone(false); setTried(false); return }
    navigate('/apply', { replace: true })
  }, [demo, key, navigate])

  const today = todayKey()
  const problems = useMemo(() => (tried ? stepProblems(stepKey(step), draft, language, today) : []), [tried, step, draft, language, today])
  const errorOf = field => problems.find(([name]) => name === field)?.[1] || ''
  const set = change => setDraft(current => ({ ...current, ...change }))
  const setRow = (list, index, change) => setDraft(current => ({ ...current, [list]: current[list].map((row, i) => (i === index ? { ...row, ...change } : row)) }))
  const addRow = (list, row) => setDraft(current => ({ ...current, [list]: [...current[list], row] }))
  const removeRow = (list, index) => setDraft(current => ({ ...current, [list]: current[list].filter((_, i) => i !== index) }))
  const toTop = () => document.querySelector('.apply-progress')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  const goTo = index => { setTried(false); setFailed(''); setStep(index); toTop() }
  function next() {
    const gaps = stepProblems(stepKey(step), draft, language, today)
    if (gaps.length) { setTried(true); setTimeout(() => sheet.current?.querySelector('.has-error')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 0); return }
    goTo(step + 1)
  }
  async function send() {
    const first = firstStepWithProblems(draft, language, today)
    if (first >= 0) { goTo(first); setTried(true); return }
    setBusy(true); setFailed('')
    try { await submitApplication(token, cleanApplication(draft, { language })); removeSessionValue(key); setDone(true); toTop() } catch (error) { setFailed(applicationErrorText(error, language)) } finally { setBusy(false) }
  }

  const info = link.data
  const frame = children => <Frame info={info} en={en} onLanguage={() => setLanguage(en ? 'el' : 'en')}>{children}</Frame>
  if (link.loading) return frame(<section className="apply-sheet apply-status"><Clock3 size={44} /><h1>{L(en, 'Φόρτωση…', 'Loading…')}</h1></section>)
  if (link.error || !info) return frame(<section className="apply-sheet apply-status"><Lock size={44} /><h1>{L(en, 'Η αίτηση δεν είναι διαθέσιμη', 'The application is not available')}</h1><p>{applicationErrorText(link.error, language)}</p>
    <button type="button" className="apply-button is-secondary" onClick={() => navigate('/apply', { replace: true })}><KeyRound size={20} />{L(en, 'Πληκτρολόγηση κωδικού', 'Type a code')}</button></section>)
  if (done) return frame(<ThankYou en={en} name={draft.firstName} onReset={reset} />)

  const position = info.position || ''
  const current = stepKey(step)
  const last = APPLICATION_STEPS.length - 1
  const progress = Math.round((step / last) * 100)
  const common = { draft, set, setRow, addRow, removeRow, errorOf, en, language }
  return frame(<>
    <nav className="apply-progress" aria-label={L(en, `Βήμα ${step + 1} από ${last + 1}`, `Step ${step + 1} of ${last + 1}`)}>
      <div><strong>{stepTitle(step, language)}</strong><small>{L(en, `Βήμα ${step + 1} από ${last + 1}`, `Step ${step + 1} of ${last + 1}`)}</small></div>
      <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${Math.max(4, progress)}%` }} /></span>
      <ol>{APPLICATION_STEPS.map(([id], index) => <li key={id} className={index === step ? 'is-current' : index < step ? 'is-done' : ''} title={stepTitle(index, language)} />)}</ol>
    </nav>
    <form className="apply-sheet" ref={sheet} autoComplete="off" noValidate onSubmit={event => { event.preventDefault(); if (step < last) next(); else void send() }}>
      {current === 'welcome' && <WelcomeStep {...common} info={info} position={position} />}
      {current === 'personal' && <PersonalStep {...common} />}
      {current === 'contact' && <ContactStep {...common} />}
      {current === 'education' && <EducationStep {...common} />}
      {current === 'languages' && <LanguagesStep {...common} />}
      {current === 'experience' && <ExperienceStep {...common} />}
      {current === 'about' && <AboutStep {...common} />}
      {current === 'consents' && <ConsentsStep {...common} server={info.consents} today={today} />}
      {current === 'review' && <ReviewStep {...common} position={position} onEdit={goTo} today={today} />}
      {tried && problems.length > 0 && <p className="apply-alert" role="alert">{L(en, 'Συμπληρώστε ό,τι σημειώνεται με κόκκινο για να συνεχίσετε.', 'Complete what is marked in red to continue.')}</p>}
      {failed && <p className="apply-alert" role="alert">{failed}</p>}
      <footer className="apply-actions">
        {step > 0 ? <button type="button" className="apply-button is-secondary" disabled={busy} onClick={() => goTo(step - 1)}><ArrowLeft size={22} />{L(en, 'Πίσω', 'Back')}</button> : <span />}
        {step < last ? <button type="submit" className="apply-button">{step === 0 ? L(en, 'Ξεκινάμε', 'Start') : L(en, 'Επόμενο', 'Next')}<ArrowRight size={22} /></button>
          : <button type="submit" className="apply-button is-send" disabled={busy}><Send size={22} />{busy ? L(en, 'Αποστολή…', 'Sending…') : L(en, 'Υποβολή αίτησης', 'Submit application')}</button>}
      </footer>
    </form>
  </>)
}

// The page around the form: the hospital (logo, name) and the language; nothing leads
// into the rest of the application.
function Frame({ info, en, onLanguage, children }) {
  const [full, setFull] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement))
  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  // Opened with «Άνοιγμα σε αυτή τη συσκευή» (?fs=1): the first touch goes full screen.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('fs') !== '1' || !document.documentElement?.requestFullscreen) return undefined
    const once = () => { void document.documentElement.requestFullscreen().catch(() => {}) }
    window.addEventListener('pointerdown', once, { once: true })
    return () => window.removeEventListener('pointerdown', once)
  }, [])
  const canFull = typeof document !== 'undefined' && Boolean(document.documentElement?.requestFullscreen)
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen?.(); else void document.documentElement.requestFullscreen?.().catch(() => {}) }
  return <main className="apply-page">
    <header className="apply-top">
      <div className="apply-brand">{info?.logo ? <img src={info.logo} alt="" /> : <span className="apply-brand-mark"><Briefcase size={22} /></span>}<div><strong>{info?.organizationName || L(en, 'Αίτηση εργασίας', 'Job application')}</strong><small>{L(en, 'Αίτηση εργασίας', 'Job application')}</small></div></div>
      <div className="apply-top-actions">
        {onLanguage && <button type="button" className="apply-chip-button" onClick={onLanguage}><Languages size={18} />{en ? 'Ελληνικά' : 'English'}</button>}
        {canFull && <button type="button" className="apply-icon-button" onClick={toggleFull} aria-label={full ? L(en, 'Έξοδος από πλήρη οθόνη', 'Exit full screen') : L(en, 'Πλήρης οθόνη', 'Full screen')}>{full ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>}
      </div>
    </header>
    <div className="apply-shell">{children}</div>
    <p className="apply-foot"><ShieldCheck size={15} />{L(en, 'Τα στοιχεία σας τα βλέπει μόνο το Γραφείο Προσωπικού του νοσοκομείου.', 'Only the hospital\'s HR office sees your details.')}</p>
  </main>
}

// --- Fields -------------------------------------------------------------------------------

function Field({ label, error, hint, wide, required, children }) {
  return <label className={`apply-field ${wide ? 'is-wide' : ''} ${error ? 'has-error' : ''}`.trim()}>
    <span className="apply-label">{label}{required && <b aria-hidden="true"> *</b>}</span>
    {children}
    {error ? <em>{error}</em> : hint ? <small>{hint}</small> : null}
  </label>
}
function Text({ value, onChange, multiline, max = LIMITS.short, mask, ...props }) {
  const shared = { className: multiline ? 'apply-input apply-textarea' : 'apply-input', value: value ?? '', maxLength: max, autoComplete: 'off', autoCorrect: 'off', spellCheck: false, onChange: event => onChange(mask ? mask(event.target.value) : event.target.value), ...props }
  return multiline ? <textarea rows={4} {...shared} /> : <input type="text" {...shared} />
}
// A choice as large chips (one tap); tapping the chosen one again clears it.
function Chips({ label, value, options, onChange, error, wide, required, compact }) {
  return <div className={`apply-field ${wide ? 'is-wide' : ''} ${error ? 'has-error' : ''}`.trim()} role="radiogroup" aria-label={label}>
    {label && <span className="apply-label">{label}{required && <b aria-hidden="true"> *</b>}</span>}
    <div className={`apply-chips ${compact ? 'is-compact' : ''}`.trim()}>{options.map(([option, text]) => <button type="button" key={String(option)} role="radio" aria-checked={value === option} className={value === option ? 'is-on' : ''} onClick={() => onChange(value === option ? (option === true || option === false ? null : '') : option)}>{value === option && <Check size={18} />}{text}</button>)}</div>
    {error && <em>{error}</em>}
  </div>
}
const yesNoOptions = en => [[true, L(en, 'Ναι', 'Yes')], [false, L(en, 'Όχι', 'No')]]
function StepHead({ icon: Icon, title, text }) {
  return <header className="apply-step-head">{Icon && <span><Icon size={26} /></span>}<div><h1>{title}</h1>{text && <p>{text}</p>}</div></header>
}
function RowCard({ title, onRemove, removeLabel, children }) {
  return <section className="apply-row"><header><strong>{title}</strong>{onRemove && <button type="button" className="apply-link-button is-danger" onClick={onRemove}><Trash2 size={18} />{removeLabel}</button>}</header><div className="apply-grid">{children}</div></section>
}
function AddButton({ onClick, children, disabled }) { return <button type="button" className="apply-add" onClick={onClick} disabled={disabled}><Plus size={22} />{children}</button> }

// --- Steps --------------------------------------------------------------------------------

function WelcomeStep({ draft, set, en, info, position }) {
  return <>
    <div className="apply-welcome">
      {info.logo ? <img className="apply-welcome-logo" src={info.logo} alt="" /> : <span className="apply-welcome-mark"><Briefcase size={40} /></span>}
      <h1>{L(en, 'Καλώς ήρθατε', 'Welcome')}</h1>
      <p>{L(en, `Αίτηση εργασίας στο ${info.organizationName || 'Νοσοκομείο'}`, `Job application at ${info.organizationName || 'the Hospital'}`)}</p>
      {position && <span className="apply-position"><Briefcase size={18} />{position}</span>}
    </div>
    <ul className="apply-welcome-list">
      <li><Clock3 size={22} /><span>{L(en, 'Χρειάζονται περίπου 10 λεπτά. Τα βήματα φαίνονται στην μπάρα πάνω.', 'It takes about 10 minutes. The bar at the top shows the steps.')}</span></li>
      <li><ShieldCheck size={22} /><span>{L(en, 'Τα στοιχεία σας τα βλέπει μόνο το Γραφείο Προσωπικού. Μη γράψετε στοιχεία υγείας.', 'Only the HR office sees your details. Do not enter health details.')}</span></li>
      <li><PenLine size={22} /><span>{L(en, 'Στο τέλος διαβάζετε τις συναινέσεις και υπογράφετε με το δάχτυλο.', 'At the end you read the consents and sign with your finger.')}</span></li>
    </ul>
    <div className="apply-grid">
      {!position && <Field wide label={L(en, 'Θέση που σας ενδιαφέρει', 'Position you are interested in')}><Text value={draft.requestedPosition} onChange={value => set({ requestedPosition: value })} placeholder={L(en, 'π.χ. Νοσηλευτής/τρια', 'e.g. Nurse')} /></Field>}
      <Chips wide label={L(en, 'Είδος απασχόλησης', 'Type of employment')} value={draft.employmentType} options={pairs(EMPLOYMENT_TYPES, en)} onChange={value => set({ employmentType: value })} />
    </div>
  </>
}

function PersonalStep({ draft, set, errorOf, en }) {
  return <>
    <StepHead icon={UserRound} title={L(en, 'Προσωπικά στοιχεία', 'Personal details')} text={L(en, 'Όπως στην ταυτότητα. Με αστερίσκο τα υποχρεωτικά.', 'As on your ID. Required fields have an asterisk.')} />
    <div className="apply-grid">
      <Field required label={L(en, 'Επώνυμο', 'Surname')} error={errorOf('lastName')}><Text value={draft.lastName} onChange={value => set({ lastName: value })} autoCapitalize="words" /></Field>
      <Field required label={L(en, 'Όνομα', 'First name')} error={errorOf('firstName')}><Text value={draft.firstName} onChange={value => set({ firstName: value })} autoCapitalize="words" /></Field>
      <Field label={L(en, 'Όνομα πατέρα', 'Father\'s name')}><Text value={draft.fatherName} onChange={value => set({ fatherName: value })} /></Field>
      <Field label={L(en, 'Όνομα μητέρας', 'Mother\'s name')}><Text value={draft.motherName} onChange={value => set({ motherName: value })} /></Field>
      <Field label={L(en, 'Ημερομηνία γέννησης', 'Date of birth')} hint={L(en, 'ΗΗ/ΜΜ/ΕΕΕΕ', 'DD/MM/YYYY')} error={errorOf('birthDate')}><Text value={draft.birthDate} onChange={value => set({ birthDate: value })} mask={maskDay} inputMode="numeric" placeholder={L(en, 'ΗΗ/ΜΜ/ΕΕΕΕ', 'DD/MM/YYYY')} max={10} /></Field>
      <Field label={L(en, 'Τόπος γέννησης', 'Place of birth')}><Text value={draft.birthPlace} onChange={value => set({ birthPlace: value })} /></Field>
      <Field label={L(en, 'Υπηκοότητα', 'Nationality')}><Text value={draft.nationality} onChange={value => set({ nationality: value })} placeholder={L(en, 'π.χ. Ελληνική', 'e.g. Greek')} /></Field>
      <Field label={L(en, 'Αριθμός παιδιών', 'Number of children')} error={errorOf('children')}><Text value={draft.children} onChange={value => set({ children: value.replace(/\D/g, '') })} inputMode="numeric" max={2} /></Field>
      <Chips wide label={L(en, 'Φύλο', 'Gender')} value={draft.gender} options={pairs(GENDERS, en)} onChange={value => set({ gender: value })} />
      <Chips wide label={L(en, 'Οικογενειακή κατάσταση', 'Marital status')} value={draft.maritalStatus} options={pairs(MARITAL, en)} onChange={value => set({ maritalStatus: value })} />
      <Chips wide label={L(en, 'Στρατιωτικές υποχρεώσεις', 'Military service')} value={draft.militaryService} options={pairs(MILITARY, en)} onChange={value => set({ militaryService: value })} />
      <Chips label={L(en, 'Άδεια εργασίας στην Ελλάδα', 'Work permit in Greece')} value={draft.workPermit} options={yesNoOptions(en)} onChange={value => set({ workPermit: value })} />
      <Chips label={L(en, 'Άδεια άσκησης επαγγέλματος', 'Licence to practise')} value={draft.practiceLicence} options={yesNoOptions(en)} onChange={value => set({ practiceLicence: value })} />
    </div>
  </>
}

function ContactStep({ draft, set, errorOf, en }) {
  return <>
    <StepHead icon={UserRound} title={L(en, 'Επικοινωνία', 'Contact')} text={L(en, 'Πού θα σας βρούμε για τη συνέντευξη.', 'Where we can reach you for the interview.')} />
    <div className="apply-grid">
      <Field required label={L(en, 'Κινητό τηλέφωνο', 'Mobile phone')} error={errorOf('phoneMobile')}><Text type="tel" inputMode="tel" value={draft.phoneMobile} onChange={value => set({ phoneMobile: value })} placeholder="69…" max={20} /></Field>
      <Field label={L(en, 'Σταθερό τηλέφωνο', 'Landline')}><Text type="tel" inputMode="tel" value={draft.phoneLandline} onChange={value => set({ phoneLandline: value })} max={20} /></Field>
      <Field wide label="Email" error={errorOf('email')}><Text type="email" inputMode="email" autoCapitalize="none" value={draft.email} onChange={value => set({ email: value.trim() })} placeholder="name@example.com" max={160} /></Field>
      <Field wide label={L(en, 'Διεύθυνση (οδός, αριθμός)', 'Address (street, number)')}><Text value={draft.address} onChange={value => set({ address: value })} max={200} /></Field>
      <Field label={L(en, 'Περιοχή / πόλη', 'Area / town')}><Text value={draft.area} onChange={value => set({ area: value })} /></Field>
      <Field label={L(en, 'Ταχυδρομικός κώδικας', 'Postcode')} error={errorOf('postcode')}><Text inputMode="numeric" value={draft.postcode} onChange={value => set({ postcode: value.replace(/[^\d ]/g, '') })} max={6} /></Field>
    </div>
  </>
}

function EducationStep({ draft, set, setRow, addRow, removeRow, errorOf, en }) {
  return <>
    <StepHead icon={GraduationCap} title={L(en, 'Εκπαίδευση', 'Education')} text={L(en, 'Η βασική εκπαίδευση και τα πτυχία, τα διπλώματα ή οι πιστοποιήσεις σας.', 'Your schooling and your degrees, diplomas or certifications.')} />
    <Chips wide label={L(en, 'Βασική εκπαίδευση', 'Schooling')} value={draft.educationLevel} options={SCHOOL_LEVELS.map(([el, enText]) => [el, en ? enText : el])} onChange={value => set({ educationLevel: value })} />
    <div className="apply-rows">
      {draft.education.map((row, index) => <RowCard key={index} title={L(en, `Τίτλος σπουδών ${index + 1}`, `Qualification ${index + 1}`)} removeLabel={L(en, 'Αφαίρεση', 'Remove')} onRemove={() => removeRow('education', index)}>
        <Field wide label={L(en, 'Τίτλος (πτυχίο, δίπλωμα)', 'Title (degree, diploma)')} error={errorOf(`education.${index}.title`)}><Text value={row.title} onChange={value => setRow('education', index, { title: value })} max={160} /></Field>
        <Field label={L(en, 'Σχολή / ίδρυμα', 'School / institution')}><Text value={row.school} onChange={value => setRow('education', index, { school: value })} max={160} /></Field>
        <Field label={L(en, 'Έτος αποφοίτησης', 'Year of graduation')} error={errorOf(`education.${index}.year`)}><Text inputMode="numeric" value={row.year} onChange={value => setRow('education', index, { year: value.replace(/\D/g, '') })} max={4} placeholder={L(en, 'ΕΕΕΕ', 'YYYY')} /></Field>
      </RowCard>)}
      <AddButton disabled={draft.education.length >= LIMITS.education} onClick={() => addRow('education', newEducationRow())}>{L(en, 'Προσθήκη τίτλου σπουδών', 'Add a qualification')}</AddButton>
    </div>
  </>
}

function LanguagesStep({ draft, setRow, addRow, removeRow, errorOf, en, language }) {
  const levels = Object.keys(LEVELS).map(value => [value, shortLevel(value, language)])
  return <>
    <StepHead icon={Languages} title={L(en, 'Γλώσσες', 'Languages')} text={L(en, 'Για κάθε γλώσσα, πόσο καλά τη μιλάτε, τη διαβάζετε και τη γράφετε.', 'For each language, how well you speak, read and write it.')} />
    <div className="apply-rows">
      {draft.languages.map((row, index) => {
        const other = row.language && !TOP_LANGUAGES.includes(row.language)
        return <RowCard key={index} title={row.language && !other ? LANGUAGES[row.language][en ? 1 : 0] : L(en, `Γλώσσα ${index + 1}`, `Language ${index + 1}`)} removeLabel={L(en, 'Αφαίρεση', 'Remove')} onRemove={() => removeRow('languages', index)}>
          <Chips wide label={L(en, 'Γλώσσα', 'Language')} error={errorOf(`languages.${index}.language`)} value={other ? '__other' : row.language}
            options={[...TOP_LANGUAGES.map(code => [code, LANGUAGES[code][en ? 1 : 0]]), ['__other', L(en, 'Άλλη', 'Other')]]} onChange={value => setRow('languages', index, { language: value === '__other' ? ' ' : value })} />
          {other && <Field wide label={L(en, 'Ποια γλώσσα;', 'Which language?')}><Text value={row.language.trim()} onChange={value => setRow('languages', index, { language: value || ' ' })} max={40} /></Field>}
          <div className={`apply-skills ${errorOf(`languages.${index}.levels`) ? 'has-error' : ''}`.trim()}>
            {LANGUAGE_SKILLS.map(([skill, el, enText]) => <Chips key={skill} compact label={en ? enText : el} value={row[skill]} options={levels} onChange={value => setRow('languages', index, { [skill]: value })} />)}
            {errorOf(`languages.${index}.levels`) && <em>{errorOf(`languages.${index}.levels`)}</em>}
          </div>
          <Chips label={L(en, 'Πιστοποιητικό γλωσσομάθειας', 'Language certificate')} value={row.certificate} options={yesNoOptions(en)} onChange={value => setRow('languages', index, { certificate: value === true, certificateName: value === true ? row.certificateName : '' })} />
          {row.certificate && <Field label={L(en, 'Ποιο πιστοποιητικό; (επίπεδο)', 'Which certificate? (level)')}><Text value={row.certificateName} onChange={value => setRow('languages', index, { certificateName: value })} placeholder={L(en, 'π.χ. B2, Proficiency', 'e.g. B2, Proficiency')} /></Field>}
        </RowCard>
      })}
      <AddButton disabled={draft.languages.length >= LIMITS.languages} onClick={() => addRow('languages', newLanguageRow())}>{L(en, 'Προσθήκη γλώσσας', 'Add a language')}</AddButton>
    </div>
  </>
}

function ExperienceStep({ draft, setRow, addRow, removeRow, errorOf, en }) {
  return <>
    <StepHead icon={Briefcase} title={L(en, 'Προϋπηρεσία', 'Work experience')} text={L(en, 'Οι προηγούμενοι εργοδότες σας, από τον πιο πρόσφατο. Αν δεν έχετε, συνεχίστε.', 'Your previous employers, most recent first. If you have none, continue.')} />
    <div className="apply-rows">
      {!draft.employers.length && <p className="apply-empty">{L(en, 'Δεν έχετε προσθέσει εργοδότη.', 'No employer added.')}</p>}
      {draft.employers.map((row, index) => <RowCard key={index} title={row.employer || L(en, `Εργοδότης ${index + 1}`, `Employer ${index + 1}`)} removeLabel={L(en, 'Αφαίρεση', 'Remove')} onRemove={() => removeRow('employers', index)}>
        <Field wide required label={L(en, 'Εργοδότης', 'Employer')} error={errorOf(`employers.${index}.employer`)}><Text value={row.employer} onChange={value => setRow('employers', index, { employer: value })} max={160} /></Field>
        <Field label={L(en, 'Από (μήνας/έτος)', 'From (month/year)')} error={errorOf(`employers.${index}.from`)}><Text inputMode="numeric" value={row.from} onChange={value => setRow('employers', index, { from: value })} mask={maskMonth} placeholder={L(en, 'ΜΜ/ΕΕΕΕ', 'MM/YYYY')} max={7} /></Field>
        {row.current ? <Field label={L(en, 'Έως', 'To')}><span className="apply-input is-static">{L(en, 'Σήμερα', 'Today')}</span></Field>
          : <Field label={L(en, 'Έως (μήνας/έτος)', 'To (month/year)')} error={errorOf(`employers.${index}.to`)}><Text inputMode="numeric" value={row.to} onChange={value => setRow('employers', index, { to: value })} mask={maskMonth} placeholder={L(en, 'ΜΜ/ΕΕΕΕ', 'MM/YYYY')} max={7} /></Field>}
        <Chips wide label={L(en, 'Εργάζομαι ακόμη εκεί', 'I still work there')} value={row.current} options={yesNoOptions(en)} onChange={value => setRow('employers', index, { current: value === true, to: value === true ? '' : row.to })} />
        <Field label={L(en, 'Θέση / ειδικότητα', 'Position / role')}><Text value={row.jobTitle} onChange={value => setRow('employers', index, { jobTitle: value })} /></Field>
        <Field label={L(en, 'Λόγος αποχώρησης', 'Reason for leaving')}><Text value={row.leavingReason} onChange={value => setRow('employers', index, { leavingReason: value })} max={300} /></Field>
      </RowCard>)}
      <AddButton disabled={draft.employers.length >= LIMITS.employers} onClick={() => addRow('employers', newEmployerRow())}>{L(en, 'Προσθήκη εργοδότη', 'Add an employer')}</AddButton>
    </div>
  </>
}

function AboutStep({ draft, set, en }) {
  const count = value => `${String(value || '').length}/${LIMITS.long}`
  return <>
    <StepHead icon={PenLine} title={L(en, 'Δεξιότητες & «Γιατί εμάς»', 'Skills & why us')} text={L(en, 'Λίγα λόγια για εσάς. Όλα προαιρετικά.', 'A few words about you. All optional.')} />
    <div className="apply-grid">
      <Field wide label={L(en, 'Γνώσεις πληροφορικής', 'Computer skills')} hint={count(draft.itSkills)}><Text multiline max={LIMITS.long} value={draft.itSkills} onChange={value => set({ itSkills: value })} placeholder={L(en, 'π.χ. Office, ηλεκτρονικός φάκελος ασθενούς', 'e.g. Office, electronic patient record')} /></Field>
      <Field wide label={L(en, 'Δραστηριότητες και ενδιαφέροντα', 'Activities and interests')} hint={count(draft.activities)}><Text multiline max={LIMITS.long} value={draft.activities} onChange={value => set({ activities: value })} /></Field>
      <Field wide label={L(en, 'Γιατί θέλετε να εργαστείτε σε εμάς;', 'Why would you like to work with us?')} hint={count(draft.whyUs)}><Text multiline max={LIMITS.long} value={draft.whyUs} onChange={value => set({ whyUs: value })} /></Field>
    </div>
  </>
}

function ConsentsStep({ draft, set, errorOf, en, language, server, today }) {
  const setConsent = (consentKey, value) => set({ consents: { ...draft.consents, [consentKey]: value } })
  const name = `${draft.lastName} ${draft.firstName}`.trim()
  return <>
    <StepHead icon={ShieldCheck} title={L(en, 'Συναινέσεις', 'Consents')} text={L(en, 'Διαβάστε κάθε κείμενο και πατήστε για να συμφωνήσετε. Τα υποχρεωτικά χρειάζονται για να εξεταστεί η αίτηση.', 'Read each text and tap to agree. The required ones are needed for the application to be considered.')} />
    <div className="apply-consents">
      {CONSENTS.map(consent => {
        const on = draft.consents?.[consent.key] === true
        return <button type="button" key={consent.key} role="checkbox" aria-checked={on} className={`apply-consent ${on ? 'is-on' : ''} ${errorOf(`consents.${consent.key}`) ? 'has-error' : ''}`.trim()} onClick={() => setConsent(consent.key, !on)}>
          <span className="apply-consent-box">{on && <Check size={26} strokeWidth={3} />}</span>
          <span className="apply-consent-body"><strong>{consent.title[en ? 1 : 0]}<i className={consent.required ? 'is-required' : ''}>{consent.required ? L(en, 'Υποχρεωτικό', 'Required') : L(en, 'Προαιρετικό', 'Optional')}</i></strong>
            <span>{consentText(consent, language, server)}</span>
            {errorOf(`consents.${consent.key}`) && <em>{errorOf(`consents.${consent.key}`)}</em>}</span>
        </button>
      })}
    </div>
    <section className={`apply-sign ${errorOf('signature') ? 'has-error' : ''}`.trim()}>
      <header><strong>{L(en, 'Υπογραφή', 'Signature')}</strong><span>{name || '—'} · {today.split('-').reverse().join('/')}</span></header>
      <SignaturePad value={draft.signature} onChange={value => set({ signature: value })} label={L(en, 'Πλαίσιο υπογραφής', 'Signature box')} clearLabel={L(en, 'Καθαρισμός', 'Clear')} emptyText={L(en, 'Υπογράψτε εδώ με το δάχτυλο', 'Sign here with your finger')} />
      {errorOf('signature') && <em>{errorOf('signature')}</em>}
    </section>
  </>
}

function ReviewStep({ draft, en, language, position, onEdit, today }) {
  const pending = stepProblems('review', draft, language, today)
  const join = (...values) => values.filter(value => String(value ?? '').trim()).join(' · ')
  const section = (index, title, rows) => <section className="apply-review-block" key={index}>
    <header><strong>{title}</strong><button type="button" className="apply-link-button" onClick={() => onEdit(index)}><PenLine size={18} />{L(en, 'Αλλαγή', 'Change')}</button></header>
    <dl>{rows.filter(([, value]) => String(value ?? '').trim()).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </section>
  const month = value => { const iso = parseMonth(value); return iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '' }
  return <>
    <StepHead icon={CheckCircle2} title={L(en, 'Επισκόπηση & υποβολή', 'Review & submit')} text={L(en, 'Ελέγξτε τα στοιχεία σας. Με «Αλλαγή» επιστρέφετε στο βήμα.', 'Check your details. «Change» takes you back to the step.')} />
    {pending.length > 0 && <p className="apply-alert" role="alert">{L(en, 'Λείπουν ακόμη:', 'Still missing:')} {pending.map(([, message]) => message).join(' ')}</p>}
    <div className="apply-review">
      {section(0, L(en, 'Θέση', 'Position'), [[L(en, 'Θέση', 'Position'), position || draft.requestedPosition], [L(en, 'Απασχόληση', 'Employment'), employmentLabel(draft.employmentType, language)]])}
      {section(1, L(en, 'Προσωπικά στοιχεία', 'Personal details'), [[L(en, 'Ονοματεπώνυμο', 'Full name'), join(draft.lastName, draft.firstName)], [L(en, 'Γονείς', 'Parents'), join(draft.fatherName, draft.motherName)], [L(en, 'Γέννηση', 'Birth'), join(draft.birthDate, draft.birthPlace)],
        [L(en, 'Φύλο', 'Gender'), genderLabel(draft.gender, language)], [L(en, 'Υπηκοότητα', 'Nationality'), draft.nationality], [L(en, 'Οικογένεια', 'Family'), join(maritalLabel(draft.maritalStatus, language), draft.children !== '' ? `${draft.children} ${L(en, 'παιδιά', 'children')}` : '')],
        [L(en, 'Στρατιωτικές υποχρεώσεις', 'Military service'), militaryLabel(draft.militaryService, language)], [L(en, 'Άδεια εργασίας', 'Work permit'), draft.workPermit == null ? '' : yesNo(draft.workPermit, language)], [L(en, 'Άδεια άσκησης', 'Licence to practise'), draft.practiceLicence == null ? '' : yesNo(draft.practiceLicence, language)]])}
      {section(2, L(en, 'Επικοινωνία', 'Contact'), [[L(en, 'Τηλέφωνα', 'Phones'), join(draft.phoneMobile, draft.phoneLandline)], ['Email', draft.email], [L(en, 'Διεύθυνση', 'Address'), join(draft.address, draft.area, draft.postcode)]])}
      {section(3, L(en, 'Εκπαίδευση', 'Education'), [[L(en, 'Βασική', 'Schooling'), draft.educationLevel], ...draft.education.filter(row => row.title || row.school).map((row, index) => [`${L(en, 'Τίτλος', 'Title')} ${index + 1}`, join(row.title, row.school, row.year)])])}
      {section(4, L(en, 'Γλώσσες', 'Languages'), draft.languages.filter(row => row.language.trim()).map(row => [LANGUAGES[row.language]?.[en ? 1 : 0] || row.language,
        join(...LANGUAGE_SKILLS.filter(([skill]) => row[skill]).map(([skill, el, enText]) => `${en ? enText : el}: ${shortLevel(row[skill], language)}`), certificateLabel(row, language))]))}
      {section(5, L(en, 'Προϋπηρεσία', 'Work experience'), draft.employers.filter(row => row.employer).map(row => [row.employer, join(`${month(row.from) || '…'} – ${row.current ? L(en, 'σήμερα', 'today') : month(row.to) || '…'}`, row.jobTitle, row.leavingReason)]))}
      {section(6, L(en, 'Δεξιότητες & «Γιατί εμάς»', 'Skills & why us'), [[L(en, 'Πληροφορική', 'Computer skills'), draft.itSkills], [L(en, 'Δραστηριότητες', 'Activities'), draft.activities], [L(en, 'Γιατί εμάς', 'Why us'), draft.whyUs]])}
      <section className="apply-review-block">
        <header><strong>{L(en, 'Συναινέσεις και υπογραφή', 'Consents and signature')}</strong><button type="button" className="apply-link-button" onClick={() => onEdit(7)}><PenLine size={18} />{L(en, 'Αλλαγή', 'Change')}</button></header>
        <ul className="apply-review-consents">{CONSENTS.map(consent => <li key={consent.key} className={draft.consents?.[consent.key] ? 'is-on' : ''}>{draft.consents?.[consent.key] ? <Check size={18} /> : <span>—</span>}{consent.title[en ? 1 : 0]}</li>)}</ul>
        {draft.signature ? <img className="apply-review-signature" src={draft.signature} alt={L(en, 'Υπογραφή', 'Signature')} /> : <p className="apply-empty">{L(en, 'Χωρίς υπογραφή', 'Not signed')}</p>}
      </section>
    </div>
  </>
}

// After sending: thank the candidate, then clear the tablet for the next person.
function ThankYou({ en, name, onReset }) {
  const [left, setLeft] = useState(RESET_SECONDS)
  useEffect(() => {
    if (left <= 0) { onReset(); return undefined }
    const timer = setTimeout(() => setLeft(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [left, onReset])
  return <section className="apply-sheet apply-status is-done">
    <CheckCircle2 size={64} />
    <h1>{name ? L(en, `Ευχαριστούμε, ${name}!`, `Thank you, ${name}!`) : L(en, 'Ευχαριστούμε!', 'Thank you!')}</h1>
    <p>{L(en, 'Η αίτησή σας στάλθηκε στο Γραφείο Προσωπικού. Θα επικοινωνήσουμε μαζί σας για τη συνέντευξη.', 'Your application was sent to the HR office. We will contact you about the interview.')}</p>
    <p className="apply-countdown">{L(en, `Η οθόνη καθαρίζει σε ${left}″. Παραδώστε το tablet στο Γραφείο Προσωπικού.`, `The screen clears in ${left}″. Please hand the tablet back to the HR office.`)}</p>
    <button type="button" className="apply-button" onClick={onReset}><Check size={22} />{L(en, 'Τέλος', 'Done')}</button>
  </section>
}

// /apply without a code: the candidate (or HR) types the code shown on the HR screen.
function CodeEntry() {
  const navigate = useNavigate()
  const { language, setLanguage } = useLanguage()
  const en = language === 'en'
  const [code, setCode] = useState('')
  const [tried, setTried] = useState(false)
  const ok = validCode(code)
  return <Frame info={null} en={en} onLanguage={() => setLanguage(en ? 'el' : 'en')}>
    <form className="apply-sheet apply-status" autoComplete="off" onSubmit={event => { event.preventDefault(); setTried(true); if (ok) navigate(applicationPath(code)) }}>
      <KeyRound size={44} />
      <h1>{L(en, 'Αίτηση εργασίας', 'Job application')}</h1>
      <p>{L(en, 'Γράψτε τον κωδικό που σας έδωσε το Γραφείο Προσωπικού.', 'Enter the code the HR office gave you.')}</p>
      <label className={`apply-field apply-code ${tried && !ok ? 'has-error' : ''}`.trim()}><span className="apply-label">{L(en, 'Κωδικός', 'Code')}</span>
        <input className="apply-input" value={code} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={14} placeholder="XXXX-XXXX-XXXX" onChange={event => setCode(formatCode(normalizeCode(event.target.value).slice(0, 12)))} />
        {tried && !ok && <em>{L(en, 'Ο κωδικός έχει 12 χαρακτήρες.', 'The code has 12 characters.')}</em>}</label>
      <button type="submit" className="apply-button"><ArrowRight size={22} />{L(en, 'Συνέχεια', 'Continue')}</button>
    </form>
  </Frame>
}
