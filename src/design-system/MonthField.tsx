import { useLanguage } from '../core/i18n/LanguageContext'

const MONTHS={
  el:['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December'],
}

// A reporting month (value "YYYY-MM") as month + year selects in the user's
// language, instead of the browser's month input (English on most systems).
export function MonthField({label,value,onChange,required=false,disabled=false,years=6,className=''}){
  const {language}=useLanguage();const en=language==='en'
  const [year,month]=String(value||'').slice(0,7).split('-')
  const thisYear=new Date().getFullYear()
  const yearOptions=Array.from({length:years},(_,i)=>String(thisYear-i))
  if(year&&!yearOptions.includes(year))yearOptions.push(year)
  const emit=(nextYear,nextMonth)=>onChange?.(nextYear&&nextMonth?`${nextYear}-${nextMonth}`:'')
  return <div className={`month-field field ${className}`.trim()}>
    {label&&<span className="field-label lo-field-label">{label}{required?' *':''}</span>}
    <div className="month-field-controls">
      <select aria-label={en?'Month':'Μήνας'} value={month||''} disabled={disabled} onChange={event=>emit(year||String(thisYear),event.target.value)}>
        <option value="">{en?'Month':'Μήνας'}</option>
        {MONTHS[en?'en':'el'].map((name,index)=><option key={name} value={String(index+1).padStart(2,'0')}>{name}</option>)}
      </select>
      <select aria-label={en?'Year':'Έτος'} value={year||''} disabled={disabled} onChange={event=>emit(event.target.value,month||'01')}>
        <option value="">{en?'Year':'Έτος'}</option>
        {yearOptions.map(item=><option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  </div>
}
