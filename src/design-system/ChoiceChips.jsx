import { Check } from 'lucide-react'
import './ChoiceChips.css'

// Several options that can be switched on together (screening types, requested
// materials): toggle chips with a tick, instead of checkboxes in pills.
export function ChoiceChips({label,options=[],selected=[],onToggle,className=''}){
  return <div className={`lo-choice-chips ${className}`.trim()} role="group" aria-label={label}>
    {label&&<span className="lo-field-label">{label}</span>}
    <div className="lo-choice-chips-list">
      {options.map(option=>{
        const on=selected.includes(option.value)
        return <button key={option.value} type="button" aria-pressed={on} className={on?'selected':''} onClick={()=>onToggle?.(option.value)}>
          {on&&<Check size={14} aria-hidden="true"/>}
          <span>{option.label}</span>
        </button>
      })}
    </div>
  </div>
}
