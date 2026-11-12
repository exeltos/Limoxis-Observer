import { Check } from 'lucide-react'
import { FieldLabelText, FieldMessage } from './FormValidation'
import './ChoiceChips.css'

// Several options that can be switched on together (screening types, requested
// materials): toggle chips with a tick, instead of checkboxes in pills.
export function ChoiceChips({label,options=[],selected=[],onToggle,className='',required=false,error='',hint='',fieldKey}){
  return <div className={`lo-choice-chips ${className}`.trim()} role="group" aria-label={label} data-field-key={fieldKey} data-invalid={error?'true':undefined}>
    {label&&<span className="lo-field-label"><FieldLabelText label={label} required={required}/></span>}
    <div className="lo-choice-chips-list">
      {options.map(option=>{
        const on=selected.includes(option.value)
        return <button key={option.value} type="button" aria-pressed={on} className={on?'selected':''} onClick={()=>onToggle?.(option.value)}>
          {on&&<Check size={14} aria-hidden="true"/>}
          <span>{option.label}</span>
        </button>
      })}
    </div>
    <FieldMessage error={error} hint={hint}/>
  </div>
}
