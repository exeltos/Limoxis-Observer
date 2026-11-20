import './SegmentedControl.css'

// One choice out of a few, as one strip of buttons (owner, 20/11/2026): the period of «Το τμήμα μου» and the
// «Εκπρόθεσμα | Επόμενες 30 ημέρες» of the calendar look the same.
interface SegmentedOption { value: string, label: string }
interface SegmentedControlProps { options: SegmentedOption[], value: string, onChange: (value: string) => void, ariaLabel: string, className?: string }
export function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }: SegmentedControlProps) {
  return <div className={`segmented-control ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>
    {options.map(option => <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className={option.value === value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
}
