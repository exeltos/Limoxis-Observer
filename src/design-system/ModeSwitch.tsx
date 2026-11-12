import type { ReactNode } from 'react'
import type { IconType } from './types'
import './ModeSwitch.css'

// Two or three mutually exclusive ways to fill in a form (single / bulk,
// existing / new). One look for every «New …» dialog.
export interface ModeSwitchOption { value: string; label: ReactNode; icon?: IconType; title?: string; ariaLabel?: string }

interface ModeSwitchProps {
  options?: ModeSwitchOption[]
  value?: string | null
  onChange?: (value: string) => void
  ariaLabel?: string
  disabled?: boolean
  className?: string
}

export function ModeSwitch({options=[],value,onChange,ariaLabel,disabled=false,className=''}: ModeSwitchProps){
  return <div className={`lo-mode-switch ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>
    {options.map(({value:optionValue,label,icon:Icon,title,ariaLabel:optionLabel})=>{
      const active=optionValue===value
      return <button key={optionValue} type="button" role="radio" aria-checked={active} title={title} aria-label={optionLabel} className={active?'active':''} disabled={disabled} onClick={()=>onChange?.(optionValue)}>
        {Icon&&<Icon size={15} aria-hidden="true"/>}
        <span>{label}</span>
      </button>
    })}
  </div>
}
