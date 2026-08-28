import { Clock3 } from 'lucide-react'

export function TimeField({label,value,onChange,disabled=false,required=false,className=''}){
  return <label className={`time-field field ${className}`.trim()}>
    {label&&<span className="field-label">{label}{required?' *':''}</span>}
    <div className="time-field-control">
      <input type="time" lang="en-GB" step="60" disabled={disabled} value={value||''} onChange={e=>onChange?.(e.target.value)}/><Clock3 size={16} aria-hidden="true"/>
    </div>
  </label>
}
