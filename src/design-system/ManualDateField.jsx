import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'

function isoToDisplay(value){
  if(!value)return ''
  const m=String(value).slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m?`${m[3]}/${m[2]}/${m[1]}`:String(value)
}
function displayToIso(value){
  const text=String(value||'').trim()
  if(!text)return ''
  let m=text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if(m){
    const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3])
    const date=new Date(Date.UTC(y,mo-1,d))
    if(date.getUTCFullYear()===y&&date.getUTCMonth()===mo-1&&date.getUTCDate()===d)return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }
  m=text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m?text:''
}

export function ManualDateField({label,value,onChange,optional=false,disabled=false,className=''}){
  const {t,language}=useLanguage();const en=language==='en'
  const [text,setText]=useState(()=>isoToDisplay(value))
  const pickerRef=useRef(null)
  useEffect(()=>setText(isoToDisplay(value)),[value])
  function commit(next=text){
    if(!next.trim()){onChange('');return}
    const iso=displayToIso(next)
    if(iso){onChange(iso);setText(isoToDisplay(iso))}
  }
  function openPicker(){
    if(disabled)return
    const el=pickerRef.current
    if(el?.showPicker)el.showPicker(); else el?.click()
  }
  return <label className={`manual-date-field ${className}`.trim()}>
    {label&&<span>{label}{optional&&<small> · {t('optional')}</small>}</span>}
    <div className="manual-date-control">
      <input disabled={disabled} inputMode="numeric" placeholder={en?'dd/mm/yyyy':'ηη/μμ/εεεε'} value={text} onChange={e=>setText(e.target.value)} onBlur={()=>commit()} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit()}}}/>
      <button type="button" disabled={disabled} onClick={openPicker} aria-label="calendar"><CalendarDays size={16}/></button>
      <input ref={pickerRef} className="manual-date-native" tabIndex={-1} type="date" value={value||''} onChange={e=>{onChange(e.target.value);setText(isoToDisplay(e.target.value))}}/>
    </div>
  </label>
}
