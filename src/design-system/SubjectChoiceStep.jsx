import './SubjectChoiceStep.css'

// Numbered question + icon cards ("Where does the sample come from?",
// "Who is this surveillance about?"). choices: [id, Icon, title, text].
// step=null leaves the number out, for a single question with no steps after it.
// compact: one short line per card (the help text moves into the tooltip), for dialogs that
// should stay as tall as their fields.
export function SubjectChoiceStep({ step = 1, title, hint, choices = [], value = '', onChoose, compact = false }) {
  return <>
    <div className="subject-choice-step-heading">{step != null && <span>{step}</span>}<div><strong>{title}</strong>{hint && <small>{hint}</small>}</div></div>
    <div className={`subject-choice-cards${compact ? ' is-compact' : ''}`}>{choices.map(([id, Icon, label, text]) => <button key={id} type="button" title={compact ? text : undefined} aria-pressed={compact ? value === id : undefined} className={`subject-choice-card ${value === id ? 'active' : ''}`.trim()} onClick={() => onChoose?.(id)}><Icon size={compact ? 17 : 20}/><span><strong>{label}</strong>{!compact && <small>{text}</small>}</span></button>)}</div>
  </>
}
