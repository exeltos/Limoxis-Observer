import { useState } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import './demoEvaluation.css'

// "I want the application": the evaluator's contact details and a message,
// sent to the Platform Owner (notification and e-mail).
export function DemoApplicationDialog({language,organizationName='',defaultName='',email='',working=false,sentAt=null,error='',onSubmit,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [name,setName]=useState(defaultName)
  const [phone,setPhone]=useState('')
  const [message,setMessage]=useState('')
  const ready=name.trim().length>0&&!working
  if(sentAt)return <ObserverDialog width="compact" className="demo-application-dialog" title={tx('Το αίτημα στάλθηκε','Request sent')} onClose={onClose} footer={<Button onClick={onClose}>{tx('Κλείσιμο','Close')}</Button>}>
    <div className="demo-application-sent"><CheckCircle2 size={34}/><p>{tx('Ευχαριστούμε για το ενδιαφέρον σας. Θα επικοινωνήσουμε μαζί σας σύντομα για την ενεργοποίηση της εφαρμογής στο νοσοκομείο σας.','Thank you for your interest. We will contact you shortly about setting up the application for your hospital.')}</p></div>
  </ObserverDialog>
  return <ObserverDialog width="standard" className="demo-application-dialog" eyebrow={organizationName} title={tx('Θέλω την εφαρμογή','I want the application')}
    subtitle={tx('Αφήστε μας τα στοιχεία σας και θα επικοινωνήσουμε μαζί σας για την ενεργοποίηση στο νοσοκομείο σας.','Leave your details and we will contact you about setting it up for your hospital.')}
    onClose={()=>!working&&onClose?.()} footer={<><Button variant="secondary" disabled={working} onClick={onClose}>{tx('Ακύρωση','Cancel')}</Button><Button loading={working} disabled={!ready} onClick={()=>onSubmit?.({contactName:name.trim(),contactPhone:phone.trim(),message:message.trim()})}><Send size={15}/>{tx('Αποστολή αιτήματος','Send request')}</Button></>}>
    <div className="form-grid demo-application-form">
      <label className="field"><span>{tx('Ονοματεπώνυμο','Full name')}</span><input value={name} maxLength={200} onChange={e=>setName(e.target.value)} disabled={working} autoComplete="name"/></label>
      <label className="field"><span>{tx('Τηλέφωνο','Phone')}</span><input value={phone} maxLength={60} onChange={e=>setPhone(e.target.value)} disabled={working} autoComplete="tel" inputMode="tel"/></label>
      <label className="field demo-application-wide"><span>Email</span><input value={email} disabled readOnly/></label>
      <label className="field demo-application-wide"><span>{tx('Μήνυμα (προαιρετικό)','Message (optional)')}</span><textarea rows={4} value={message} maxLength={2000} onChange={e=>setMessage(e.target.value)} disabled={working} placeholder={tx('π.χ. αριθμός κλινών, ενότητες που σας ενδιαφέρουν, χρονοδιάγραμμα','e.g. number of beds, modules you are interested in, timeline')}/></label>
    </div>
    {error&&<div className="demo-application-error" role="alert">{error}</div>}
  </ObserverDialog>
}
