import { useState } from 'react'
import { Field } from './Field'
import { FormSubmit, useFormValidation } from './FormValidation'
import { ObserverDialog } from './ObserverDialog'
import { useLanguage } from '../core/i18n/LanguageContext'

// A change that needs a written reason (archive, void…): the shared dialog,
// closed only by its ×, with the confirm action in the footer.
export function GovernedReasonDialog({
  open,
  title,
  description,
  label,
  confirmLabel,
  danger=false,
  onCancel,
  onConfirm,
}){
  const {language}=useLanguage();const en=language==='en'
  const resolvedTitle=title||(en?'Reason for change':'Αιτιολόγηση αλλαγής')
  const resolvedDescription=description||(en?'The change will be recorded in the record history.':'Η αλλαγή θα καταγραφεί στο ιστορικό της εγγραφής.')
  // «*» is drawn by the field itself (shared validation): a trailing « *» in a passed label is dropped.
  const resolvedLabel=(label||(en?'Reason':'Αιτιολογία')).replace(/\s*\*$/,'')
  const resolvedConfirmLabel=confirmLabel||(en?'Continue':'Συνέχεια')
  const [reason,setReason]=useState('')
  const form=useFormValidation([{key:'reason',label:resolvedLabel,valid:Boolean(reason.trim())}])
  if(!open)return null
  const submit=()=>{
    const value=reason.trim()
    if(!value)return
    onConfirm?.(value)
    setReason('')
    form.reset()
  }
  const cancel=()=>{setReason('');form.reset();onCancel?.()}
  return <ObserverDialog width="compact" className="governed-reason-dialog" eyebrow={en?'Governed change':'Ελεγχόμενη αλλαγή'} title={resolvedTitle} subtitle={resolvedDescription} onClose={cancel} footer={<FormSubmit form={form} icon={false} className={danger?'danger':''} onSubmit={submit}>{resolvedConfirmLabel}</FormSubmit>}>
    <div ref={form.scopeRef}><Field label={resolvedLabel} {...form.field('reason')}><textarea autoFocus rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder={en?'Enter the reason for this change...':'Καταγράψτε τον λόγο της αλλαγής...'}/></Field></div>
  </ObserverDialog>
}
