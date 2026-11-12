import { useId } from 'react'

export function LocationAutocompleteField({label,value,onChange,options=[],disabled=false,required=false,className=''}){
  const id=useId().replace(/:/g,'')
  return <label className={`field ${className}`.trim()}>
    <span>{label}{required?' *':''}</span>
    <input
      value={value||''}
      onChange={event=>onChange(event.target.value)}
      list={`location-options-${id}`}
      disabled={disabled}
      autoComplete="off"
    />
    <datalist id={`location-options-${id}`}>
      {options.map(option=><option key={option} value={option}/>) }
    </datalist>
  </label>
}
