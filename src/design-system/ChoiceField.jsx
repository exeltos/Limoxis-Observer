import { ModeSwitch } from './ModeSwitch'

// Two or three exclusive answers under a field title (priority, sex, yes /
// no / unknown, S / I / R): the shared mode switch, never a select or radios.
export function ChoiceField({
  label,
  value,
  options = [],
  onChange,
  disabled = false,
  className = '',
}) {
  return (
    <div className={`field yes-no-field ${className}`.trim()}>
      <span className="lo-field-label">{label}</span>
      <ModeSwitch
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
      />
    </div>
  )
}
