import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

export function GovernedReasonDialog({
  open,
  title='Αιτιολόγηση αλλαγής',
  description='Η αλλαγή θα καταγραφεί στο ιστορικό της εγγραφής.',
  label='Αιτιολογία *',
  confirmLabel='Συνέχεια',
  danger=false,
  onCancel,
  onConfirm,
}){
  const [reason,setReason]=useState('')
  if(!open)return null
  const submit=()=>{
    const value=reason.trim()
    if(!value)return
    onConfirm?.(value)
    setReason('')
  }
  const cancel=()=>{setReason('');onCancel?.()}
  return <div className="modal-backdrop">
    <div className="governed-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="governed-reason-title">
      <header><div><span className="eyebrow">GOVERNED CHANGE</span><h3 id="governed-reason-title">{title}</h3><p>{description}</p></div><button className="icon-button" onClick={cancel} aria-label="Κλείσιμο"><X size={16}/></button></header>
      <label><span>{label}</span><textarea autoFocus rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Καταγράψτε τον λόγο της αλλαγής..."/></label>
      <footer><Button variant="secondary" onClick={cancel}>Ακύρωση</Button><Button className={danger?'danger':''} disabled={!reason.trim()} onClick={submit}>{confirmLabel}</Button></footer>
    </div>
  </div>
}
