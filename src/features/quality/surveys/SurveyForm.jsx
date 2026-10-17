import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { RATING_LABELS, sectionLabel, textOf } from './surveyModel'
import './surveys.css'

// The questions of a survey to answer: large targets for a phone or a tablet,
// grouped by section. Used by the public link and by entry in the app.
export function SurveyForm({ questions = [], answers, onChange, language = 'el', missing = [], departments = [], departmentId = '', onDepartment, askDepartment = false }) {
  const en = language === 'en'
  const set = (id, value) => onChange({ ...answers, [id]: value })
  const sections = [...new Set(questions.map(question => question.section || ''))]
  return <div className="survey-form">
    {askDepartment && <fieldset className={`survey-question ${missing.includes('department') ? 'is-missing' : ''}`}>
      <legend>{en ? 'Which department is this about?' : 'Για ποιο τμήμα είναι η αξιολόγηση;'} <span aria-hidden="true">*</span></legend>
      <SearchableSelect hideLabel label={en ? 'Department' : 'Τμήμα'} value={departmentId} options={departments.map(item => ({ value: item.id, label: en ? item.nameEn || item.name : item.name }))} onChange={value => onDepartment(value || '')} placeholder={en ? 'Choose…' : 'Επιλέξτε…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel={en ? 'Clear' : 'Καθαρισμός'} />
    </fieldset>}
    {sections.map(section => <section key={section || 'main'} className="survey-section">
      {section && <h2>{sectionLabel(section, language)}</h2>}
      {questions.filter(question => (question.section || '') === section).map(question => <SurveyQuestion key={question.id} question={question} value={answers[question.id]} onChange={value => set(question.id, value)} language={language} missing={missing.includes(question.id)} />)}
    </section>)}
  </div>
}

function SurveyQuestion({ question, value, onChange, language, missing }) {
  const en = language === 'en'
  const label = textOf(question, language)
  return <fieldset className={`survey-question ${missing ? 'is-missing' : ''}`}>
    <legend>{label}{question.required && <span aria-hidden="true"> *</span>}</legend>
    {question.type === 'rating' && <div className="survey-scale" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map(score => <button key={score} type="button" role="radio" aria-checked={value === score} className={value === score ? 'active' : ''} onClick={() => onChange(score)}><strong>{score}</strong><small>{RATING_LABELS[score - 1][en ? 1 : 0]}</small></button>)}
    </div>}
    {question.type === 'nps' && <><div className="survey-scale survey-scale-nps" role="radiogroup" aria-label={label}>
      {Array.from({ length: 11 }, (_, score) => <button key={score} type="button" role="radio" aria-checked={value === score} className={value === score ? 'active' : ''} onClick={() => onChange(score)}><strong>{score}</strong></button>)}
    </div><p className="survey-scale-ends"><span>{en ? 'Not at all likely' : 'Καθόλου πιθανό'}</span><span>{en ? 'Extremely likely' : 'Εξαιρετικά πιθανό'}</span></p></>}
    {question.type === 'yesno' && <div className="survey-choices" role="radiogroup" aria-label={label}>
      {[[true, en ? 'Yes' : 'Ναι'], [false, en ? 'No' : 'Όχι']].map(([option, text]) => <button key={text} type="button" role="radio" aria-checked={value === option} className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{text}</button>)}
    </div>}
    {question.type === 'single' && <div className="survey-choices" role="radiogroup" aria-label={label}>
      {(question.options || []).map(option => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>{textOf(option, language)}</button>)}
    </div>}
    {question.type === 'multiple' && <div className="survey-choices" role="group" aria-label={label}>
      {(question.options || []).map(option => { const selected = Array.isArray(value) && value.includes(option.value); return <button key={option.value} type="button" aria-pressed={selected} className={selected ? 'active' : ''} onClick={() => onChange(selected ? value.filter(item => item !== option.value) : [...(Array.isArray(value) ? value : []), option.value])}>{textOf(option, language)}</button> })}
    </div>}
    {question.type === 'text' && <textarea rows={3} maxLength={2000} value={value || ''} aria-label={label} onChange={event => onChange(event.target.value)} />}
    {missing && <small className="survey-missing">{en ? 'Please answer this question.' : 'Απαντήστε σε αυτή την ερώτηση.'}</small>}
  </fieldset>
}

// The required questions left unanswered (and the department, when asked).
export function missingAnswers(questions = [], answers = {}, { askDepartment = false, departmentId = '' } = {}) {
  const missing = questions.filter(question => question.required && (answers[question.id] === undefined || answers[question.id] === null || answers[question.id] === '' || (Array.isArray(answers[question.id]) && !answers[question.id].length))).map(question => question.id)
  return askDepartment && !departmentId ? ['department', ...missing] : missing
}
