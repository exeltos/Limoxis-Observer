import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { FieldLabelText, FieldMessage } from './FormValidation'

// Always 24-hour HH:MM, whatever the browser's locale: the native time input
// shows AM/PM on some systems. Digits are typed, the colon is added.
const formatTyped = raw => {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}
const validTime = text => /^([01]\d|2[0-3]):[0-5]\d$/.test(text)

export function TimeField({label,value,onChange,disabled=false,required=false,error='',hint='',fieldKey,className=''}){
  const {language}=useLanguage()
  const [text,setText]=useState(value||'')
  useEffect(()=>{setText(value||'')},[value])
  const change=raw=>{
    const next=formatTyped(raw)
    setText(next)
    if(!next)onChange?.('')
    else if(validTime(next))onChange?.(next)
  }
  const caption=label&&<span className="field-label lo-field-label"><FieldLabelText label={label} required={required}/></span>
  const control=<div className="time-field-control">
      <input type="text" aria-invalid={error?true:undefined} aria-required={required||undefined} inputMode="numeric" autoComplete="off" maxLength={5} placeholder={language==='en'?'hh:mm':'ωω:λλ'} disabled={disabled} value={text} onChange={e=>change(e.target.value)} onBlur={()=>{if(text&&!validTime(text))setText(value||'')}}/>
      <Clock3 size={15} aria-hidden="true"/>
    </div>
  // A message goes under the field, outside the <label>, so the field's name stays its label.
  if(!hint&&!error&&!fieldKey)return <label className={`time-field field ${className}`.trim()}>{caption}{control}</label>
  return <div className={`time-field field field-with-message ${className}`.trim()} data-field-key={fieldKey} data-invalid={error?'true':undefined}>
    <label className="field-with-message-label">{caption}{control}</label>
    <FieldMessage error={error} hint={hint}/>
  </div>
}
