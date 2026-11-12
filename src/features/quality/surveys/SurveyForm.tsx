import { isQuestionShown, scaleOf, sectionLabel, textOf } from './surveyModel'
import './surveys.css'
import type { AnyRecord } from '../../../types/featureTypes'
import type { Survey, SurveyAnswers, SurveyQuestion as SurveyQuestionRow } from './surveyModel'

const isBlank = (value: unknown) => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)

// The sections of a questionnaire as they are answered: each with the questions
// it shows for the answers given so far.
export function formSections(survey: AnyRecord, answers: SurveyAnswers = {}) {
  const questions = (survey?.questions || []).filter((question: SurveyQuestionRow) => isQuestionShown(question, answers))
  const keys: string[] = [...new Set<string>((survey?.questions || []).map((question: AnyRecord) => question.section || ''))]
  return keys.map(key => ({ key, questions: questions.filter((question: AnyRecord) => (question.section || '') === key) })).filter(section => section.questions.length)
}

// The questions of a survey to answer: large targets for a phone or a tablet,
// grouped by section. `only` limits it to one section (the public page goes one
// section at a time). Used by the public link and by entry in the app.
export function SurveyForm({ survey, answers, onChange, language = 'el', missing = [], only = null, departments = [], departmentId = '', onDepartment, askDepartment = false }: { survey: Survey, answers: SurveyAnswers, onChange: (answers: SurveyAnswers) => void, language?: string, missing?: string[], only?: string | null, departments?: AnyRecord[], departmentId?: string, onDepartment?: (id: string) => void, askDepartment?: boolean }) {
  const en = language === 'en'
  const set = (id: string, value: unknown) => onChange({ ...answers, [id]: value })
  const sections = formSections(survey, answers).filter(section => only == null || section.key === only)
  const titles = survey?.sections || []
  return <div className="survey-form">
    {askDepartment && <fieldset className={`survey-question ${missing.includes('department') ? 'is-missing' : ''}`}>
      <legend>{en ? 'Which department were you in?' : 'Σε ποιο τμήμα νοσηλευτήκατε;'}<span className="survey-required" aria-hidden="true">*</span></legend>
      <div className="survey-choices" role="radiogroup" aria-label={en ? 'Department' : 'Τμήμα'}>
        {departments.map(item => <button key={item.id} type="button" role="radio" aria-checked={departmentId === item.id} className={departmentId === item.id ? 'active' : ''} onClick={() => onDepartment?.(item.id)}><i className="survey-mark" aria-hidden="true" /><span>{en ? item.nameEn || item.name : item.name}</span></button>)}
      </div>
      {missing.includes('department') && <small className="survey-missing">{en ? 'Please choose the department.' : 'Επιλέξτε το τμήμα.'}</small>}
    </fieldset>}
    {sections.map(section => <section key={section.key || 'main'} className="survey-section">
      {section.key && only == null && <h2>{sectionLabel(section.key, language, titles)}</h2>}
      {section.questions.map((question: AnyRecord) => <SurveyQuestion key={question.id} question={question} value={answers[question.id]} onChange={value => set(question.id, value)} language={language} missing={missing.includes(question.id)} />)}
    </section>)}
  </div>
}

export function SurveyQuestion({ question, value, onChange, language, missing = false }: { question: SurveyQuestionRow, value: unknown, onChange: (value: unknown) => void, language: string, missing?: boolean }) {
  const en = language === 'en'
  const label = textOf(question, language)
  const choose = (option: unknown) => onChange(value === option && !question.required ? undefined : option)
  return <fieldset className={`survey-question ${missing ? 'is-missing' : ''}`}>
    <legend>{label}{question.required && <span className="survey-required" aria-hidden="true">*</span>}</legend>
    {question.type === 'rating' && <div className="survey-scale" role="radiogroup" aria-label={label}>
      {scaleOf(question).map((words, index) => { const score = index + 1; return <button key={score} type="button" role="radio" aria-checked={value === score} className={`is-${score} ${value === score ? 'active' : ''}`} onClick={() => choose(score)}><i className="survey-mark" aria-hidden="true" /><span>{words[en ? 1 : 0]}</span></button> })}
    </div>}
    {question.type === 'nps' && <><div className="survey-scale survey-scale-nps" role="radiogroup" aria-label={label}>
      {Array.from({ length: 11 }, (_, score) => <button key={score} type="button" role="radio" aria-checked={value === score} className={value === score ? 'active' : ''} onClick={() => choose(score)}><span>{score}</span></button>)}
    </div><p className="survey-scale-ends"><span>{en ? 'Not at all likely' : 'Καθόλου πιθανό'}</span><span>{en ? 'Extremely likely' : 'Εξαιρετικά πιθανό'}</span></p></>}
    {question.type === 'yesno' && <div className="survey-choices survey-choices-pair" role="radiogroup" aria-label={label}>
      {([[true, en ? 'Yes' : 'Ναι'], [false, en ? 'No' : 'Όχι']] as [boolean, string][]).map(([option, text]) => <button key={text} type="button" role="radio" aria-checked={value === option} className={value === option ? 'active' : ''} onClick={() => choose(option)}><i className="survey-mark" aria-hidden="true" /><span>{text}</span></button>)}
    </div>}
    {question.type === 'single' && <div className="survey-choices" role="radiogroup" aria-label={label}>
      {(question.options || []).map((option: AnyRecord) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => choose(option.value)}><i className="survey-mark" aria-hidden="true" /><span>{textOf(option, language)}</span></button>)}
    </div>}
    {question.type === 'multiple' && <div className="survey-choices is-multiple" role="group" aria-label={label}>
      {(question.options || []).map((option: AnyRecord) => { const selected = Array.isArray(value) && value.includes(option.value); return <button key={option.value} type="button" aria-pressed={selected} className={selected ? 'active' : ''} onClick={() => onChange(selected ? value.filter(item => item !== option.value) : [...(Array.isArray(value) ? value : []), option.value])}><i className="survey-mark" aria-hidden="true" /><span>{textOf(option, language)}</span></button> })}
    </div>}
    {question.type === 'text' && <textarea rows={3} maxLength={2000} value={String(value || '')} aria-label={label} placeholder={en ? 'Write here…' : 'Γράψτε εδώ…'} onChange={event => onChange(event.target.value)} />}
    {missing && <small className="survey-missing">{en ? 'Please answer this question.' : 'Απαντήστε σε αυτή την ερώτηση.'}</small>}
  </fieldset>
}

// The required questions left unanswered among those shown (and the department, when asked).
export function missingAnswers(questions: SurveyQuestionRow[] = [], answers: SurveyAnswers = {}, { askDepartment = false, departmentId = '' } = {}) {
  const missing: string[] = questions.filter(question => question.required && isQuestionShown(question, answers) && isBlank(answers[question.id])).map(question => question.id)
  return askDepartment && !departmentId ? ['department', ...missing] : missing
}
