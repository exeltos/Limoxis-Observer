import './CheckboxField.css'

// A yes / no flag (required, active, reviewed…): the house checkbox — one box
// and its label on the 40px control line, never a pair of Yes / No buttons.
export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
  disabled = false,
  className = '',
  ariaLabel,
}) {
  return (
    <label className={`lo-checkbox-field${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={event => onChange?.(event.target.checked)}
      />
      <span className="lo-checkbox-label">{label}</span>
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  )
}
