import { ModeSwitch } from '../../design-system/ModeSwitch'

// Two or three exclusive answers in a form row: the field title and the shared
// mode switch, as tall as the inputs beside it (the yes-no-field row geometry).
export function ChoiceField({ label, value, options = [], onChange, className = '' }) {
  return (
    <div className={`field yes-no-field ${className}`.trim()}>
      <span className="lo-field-label">{label}</span>
      <ModeSwitch ariaLabel={label} value={value} onChange={onChange} options={options} />
    </div>
  )
}
