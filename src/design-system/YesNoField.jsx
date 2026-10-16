import { ModeSwitch } from './ModeSwitch'
import { useLanguage } from '../core/i18n/LanguageContext'

// A yes/no answer: the shared mode switch (as ChoiceField), never a checkbox in a box.
export function YesNoField({label,value,onChange,hint,className=''}){
  const {language}=useLanguage();const en=language==='en'
  return <div className={`field yes-no-field ${className}`.trim()}>
    <span className="lo-field-label">{label}</span>
    <ModeSwitch ariaLabel={label} value={value?'yes':'no'} onChange={next=>onChange?.(next==='yes')} options={[{value:'no',label:en?'No':'Όχι'},{value:'yes',label:en?'Yes':'Ναι'}]}/>
    {hint&&<small className="field-hint">{hint}</small>}
  </div>
}
