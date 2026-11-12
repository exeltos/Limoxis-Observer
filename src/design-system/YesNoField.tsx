import type { ReactNode } from 'react'
import { CheckboxField } from './CheckboxField'

// A yes / no flag is a checkbox (the house CheckboxField), never a pair of buttons.
interface YesNoFieldProps { label?: ReactNode; value?: unknown; onChange?: (checked: boolean) => void; hint?: ReactNode; disabled?: boolean; className?: string }

export function YesNoField({ label, value, onChange, hint, disabled = false, className = '' }: YesNoFieldProps) {
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
