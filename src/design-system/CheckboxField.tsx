import type { ReactNode } from 'react'
import './CheckboxField.css'

// A yes / no flag (required, active, reviewed…): the house checkbox — one box
// and its label on the 40px control line, never a pair of Yes / No buttons.
interface CheckboxFieldProps {
  label?: ReactNode
  checked?: unknown
  onChange?: (checked: boolean) => void
  hint?: ReactNode
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
  disabled = false,
  className = '',
  ariaLabel,
}: CheckboxFieldProps) {
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
