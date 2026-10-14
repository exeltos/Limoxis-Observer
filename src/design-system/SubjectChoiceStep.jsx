import './SubjectChoiceStep.css'

// Numbered question + icon cards ("Where does the sample come from?",
// "Who is this surveillance about?"). choices: [id, Icon, title, text].
// step=null leaves the number out, for a single question with no steps after it.
export function SubjectChoiceStep({ step = 1, title, hint, choices = [], value = '', onChoose }) {
  return <>
    <div className="subject-choice-step-heading">{step != null && <span>{step}</span>}<div><strong>{title}</strong>{hint && <small>{hint}</small>}</div></div>
    <div className="subject-choice-cards">{choices.map(([id, Icon, label, text]) => <button key={id} type="button" className={`subject-choice-card ${value === id ? 'active' : ''}`.trim()} onClick={() => onChoose?.(id)}><Icon size={20}/><span><strong>{label}</strong><small>{text}</small></span></button>)}</div>
  </>
}
