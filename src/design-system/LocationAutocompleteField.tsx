import { useId, type ReactNode } from 'react'

interface LocationAutocompleteFieldProps {
  label?: ReactNode
  value?: string | null
  onChange: (value: string) => void
  options?: string[]
  disabled?: boolean
  required?: boolean
  className?: string
}

export function LocationAutocompleteField({label,value,onChange,options=[],disabled=false,required=false,className=''}: LocationAutocompleteFieldProps){
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
