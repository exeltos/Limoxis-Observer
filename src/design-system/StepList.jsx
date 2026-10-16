import { Check } from 'lucide-react'
import './StepList.css'

// The numbered steps of a short wizard (New Demo, New incident report). A step
// opens only once the steps before it are valid; done steps show a tick.
export function StepList({ steps = [], current = 0, valid = [], onSelect, disabled = false, ariaLabel, className = '' }) {
  return (
    <ol className={`lo-step-list ${className}`.trim()} style={{ '--lo-step-count': steps.length }} aria-label={ariaLabel}>
      {steps.map((label, index) => (
        <li key={label} className={index === current ? 'is-current' : index < current ? 'is-done' : ''}>
          <button type="button" aria-current={index === current ? 'step' : undefined} disabled={disabled || (index > current && !valid.slice(0, index).every(Boolean))} onClick={() => onSelect?.(index)}>
            <span className="lo-step-number">{index < current ? <Check size={13} /> : index + 1}</span>
            <span>{label}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
