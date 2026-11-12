import { CheckboxField } from './CheckboxField'

// A yes / no flag is a checkbox (the house CheckboxField), never a pair of buttons.
export function YesNoField({ label, value, onChange, hint, disabled = false, className = '' }) {
  return (
    <CheckboxField
      className={className}
      label={label}
      checked={Boolean(value)}
      onChange={onChange}
      hint={hint}
      disabled={disabled}
    />
  )
}
