import './ModeSwitch.css'

// Two or three mutually exclusive ways to fill in a form (single / bulk,
// existing / new). One look for every «New …» dialog.
export function ModeSwitch({options=[],value,onChange,ariaLabel,disabled=false,className=''}){
  return <div className={`lo-mode-switch ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>
    {options.map(({value:optionValue,label,icon:Icon})=>{
      const active=optionValue===value
      return <button key={optionValue} type="button" role="radio" aria-checked={active} className={active?'active':''} disabled={disabled} onClick={()=>onChange?.(optionValue)}>
        {Icon&&<Icon size={15} aria-hidden="true"/>}
        <span>{label}</span>
      </button>
    })}
  </div>
}
