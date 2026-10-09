import { useState } from 'react'
import { AlertTriangle, Building2, CalendarPlus } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import './platformLifecycle.css'

const addDays=(isoDate,days)=>{const date=new Date(`${isoDate}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
const todayIso=()=>new Date().toISOString().slice(0,10)
const fmtDay=(value,en)=>value?new Intl.DateTimeFormat(en?'en-GB':'el-GR').format(new Date(`${value}T12:00:00`)):'—'

// Demo record: extend by 7/14/30 days or to a date. The days are added to the
// current end date, or to today when the Demo has already ended.
export function DemoExtendControls({validUntil,language,working=false,onExtend}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const base=validUntil&&validUntil>=todayIso()?validUntil:todayIso()
  const [custom,setCustom]=useState('')
  return <div className="demo-extend-controls" aria-label={tx('Παράταση Demo','Extend Demo')}>
    <span className="demo-extend-label"><CalendarPlus size={15}/>{tx('Παράταση','Extend')}</span>
    {[7,14,30].map(days=><Button key={days} variant="secondary" disabled={working} onClick={()=>onExtend?.(addDays(base,days))} title={tx(`Νέα λήξη ${fmtDay(addDays(base,days),en)}`,`New end ${fmtDay(addDays(base,days),en)}`)}>+{days} {tx('ημ.','d')}</Button>)}
    <ManualDateField className="demo-extend-date" value={custom} onChange={setCustom} disabled={working}/>
    <Button variant="secondary" disabled={working||!custom||custom<todayIso()} onClick={()=>onExtend?.(custom)}>{tx('Έως την ημερομηνία','Until the date')}</Button>
  </div>
}

const suggestCode=()=>`HOSP-${Date.now().toString(36).slice(-6).toUpperCase()}`

// Demo → customer. The synthetic clinical data is always cleared; users,
// roles, libraries and settings stay.
export function ConvertDemoDialog({language,defaultName='',working=false,onConvert,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [name,setName]=useState(defaultName)
  const [code,setCode]=useState(suggestCode)
  const [confirmed,setConfirmed]=useState(false)
  const ready=name.trim()&&/^[A-Za-z0-9-]{3,40}$/.test(code.trim())&&confirmed&&!working
  return <ObserverDialog width="standard" className="convert-demo-dialog" eyebrow={tx('Demo → πελάτης','Demo → customer')} title={tx('Μετατροπή Demo σε πραγματικό οργανισμό','Convert the Demo to a real organization')}
    subtitle={tx('Ο οργανισμός, οι χρήστες, οι ρόλοι και οι ρυθμίσεις του κρατιούνται. Η πρόσβαση Demo κλείνει και ο οργανισμός γίνεται κανονικός πελάτης.','The organization, its users, roles and settings are kept. Demo access ends and it becomes a regular customer.')}
    onClose={()=>!working&&onClose?.()} footer={<><Button variant="secondary" disabled={working} onClick={onClose}>{tx('Ακύρωση','Cancel')}</Button><Button loading={working} disabled={!ready} onClick={()=>onConvert?.({name:name.trim(),code:code.trim().toUpperCase()})}><Building2 size={15}/>{tx('Μετατροπή σε οργανισμό','Convert to organization')}</Button></>}>
    <div className="lifecycle-warning"><AlertTriangle size={16}/><div><strong>{tx('Τα δεδομένα επίδειξης διαγράφονται οριστικά','The demonstration data is permanently deleted')}</strong><span>{tx('Ασθενείς, επιτήρηση, εργαστήριο, έλεγχοι, εκπαιδεύσεις, ποιότητα και όσα πρόσθεσε ο αξιολογητής. Ένα πραγματικό νοσοκομείο δεν κρατά ποτέ συνθετικά δεδομένα.','Patients, surveillance, laboratory, controls, training, quality and whatever the evaluator added. A real hospital never keeps synthetic data.')}</span></div></div>
    <div className="lifecycle-form">
      <label className="field"><span>{tx('Επωνυμία οργανισμού','Organization name')} *</span><input value={name} maxLength={200} onChange={e=>setName(e.target.value)} disabled={working}/></label>
      <label className="field"><span>{tx('Κωδικός οργανισμού','Organization code')} *</span><input value={code} maxLength={40} onChange={e=>setCode(e.target.value.toUpperCase())} disabled={working}/></label>
      <label className="lifecycle-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={working}/><span>{tx('Κατανοώ ότι τα δεδομένα επίδειξης θα διαγραφούν.','I understand the demonstration data will be deleted.')}</span></label>
    </div>
  </ObserverDialog>
}
