import { useState } from 'react'
import { FileSignature,Mail } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { EMAIL_PATTERN } from './committeeExternalApprovalService'

// Before the minutes go for approval: each present voting member without an
// account approves through a personal e-mail link or has signed on paper.
export function ExternalApproversDialog({approvers,busy,en,onClose,onSubmit}){
  const [choices,setChoices]=useState(()=>approvers.map(a=>({...a,method:a.email?'email':'paper',email:a.email||''})))
  const set=(memberId,patch)=>setChoices(rows=>rows.map(r=>r.memberId===memberId?{...r,...patch}:r))
  const invalid=choices.some(c=>c.method==='email'&&!EMAIL_PATTERN.test(c.email.trim()))
  const emailCount=choices.filter(c=>c.method==='email').length,paperCount=choices.length-emailCount
  return <ObserverDialog className="external-approvers-dialog" width="wide" eyebrow={en?'Minutes approval':'Έγκριση πρακτικών'} title={en?'Members without an account':'Μέλη χωρίς λογαριασμό'}
    subtitle={en?'These present voting members do not use Limoxis. Choose how each one approves the minutes.':'Τα παρακάτω παρόντα μέλη με ψήφο δεν έχουν λογαριασμό στο Limoxis. Επιλέξτε πώς εγκρίνει το καθένα τα πρακτικά.'}
    onClose={onClose} footer={<DialogActions onCancel={onClose} disabled={busy||invalid} onSave={()=>onSubmit(choices)} saveLabel={busy?(en?'Submitting…':'Υποβολή…'):(en?'Submit for approval':'Υποβολή για έγκριση')}/>}>
    <div className="external-approvers-list">
      {choices.map(c=>{const bad=c.method==='email'&&!EMAIL_PATTERN.test(c.email.trim());return <div className="external-approver-row" key={c.memberId}>
        <strong className="external-approver-name">{c.name}</strong>
        <div className="external-approver-methods" role="radiogroup" aria-label={c.name}>
          <label className={`external-approver-method${c.method==='email'?' selected':''}`}><input type="radio" name={`m-${c.memberId}`} checked={c.method==='email'} onChange={()=>set(c.memberId,{method:'email'})}/><Mail size={15}/><span>{en?'E-mail link':'Σύνδεσμος με email'}</span></label>
          <label className={`external-approver-method${c.method==='paper'?' selected':''}`}><input type="radio" name={`m-${c.memberId}`} checked={c.method==='paper'} onChange={()=>set(c.memberId,{method:'paper'})}/><FileSignature size={15}/><span>{en?'Signed on paper':'Υπέγραψε σε χαρτί'}</span></label>
        </div>
        {c.method==='email'
          ?<label className="field external-approver-email"><span>Email</span><input className={`input${bad&&c.email?' invalid':''}`} type="email" value={c.email} placeholder="name@hospital.gr" onChange={e=>set(c.memberId,{email:e.target.value})}/>{bad&&<small>{c.email?(en?'Check the e-mail address.':'Ελέγξτε τη διεύθυνση email.'):(en?'Add the member’s e-mail or choose paper.':'Συμπληρώστε το email του μέλους ή επιλέξτε χαρτί.')}</small>}</label>
          :<p className="external-approver-note">{en?'Recorded now as approved, with your name, in the committee history.':'Καταγράφεται τώρα ως έγκριση, με το όνομά σας, στο ιστορικό της επιτροπής.'}</p>}
      </div>})}
    </div>
    <div className="source-truth-note"><strong>{en?'What happens next':'Τι θα γίνει'}</strong><p>{en
      ?`${emailCount} member(s) receive a personal link valid for 7 days that needs no account; ${paperCount} signature(s) on paper are recorded now. Members with an account approve inside the platform. The minutes are finalized when everyone has approved.`
      :`${emailCount} μέλη θα λάβουν προσωπικό σύνδεσμο (ισχύει 7 ημέρες, χωρίς λογαριασμό)· ${paperCount} υπογραφές σε χαρτί καταγράφονται τώρα. Τα μέλη με λογαριασμό εγκρίνουν μέσα στην πλατφόρμα. Τα πρακτικά οριστικοποιούνται όταν εγκρίνουν όλοι.`}</p></div>
  </ObserverDialog>
}
