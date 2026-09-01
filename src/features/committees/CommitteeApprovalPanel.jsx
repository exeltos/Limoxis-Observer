import { useMemo,useState } from 'react'
import { CheckCircle2,Clock3,MessageSquareWarning,XCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'

const statusText=(status,en)=>({pending:en?'Pending':'Εκκρεμεί',approved:en?'Approved':'Εγκρίθηκε',rejected:en?'Changes requested':'Ζητήθηκαν διορθώσεις',cancelled:en?'Superseded':'Αντικαταστάθηκε'}[status]||status)
const fmt=value=>value?new Date(value).toLocaleString('el-GR'):'—'

export function CommitteeApprovalPanel({approvals=[],actorId,busy=false,onApprove,onRequestChanges,en=false}){
  const [changesOpen,setChangesOpen]=useState(false)
  const [comment,setComment]=useState('')
  const mine=useMemo(()=>approvals.find(x=>x.approverId===actorId&&x.status==='pending')||null,[approvals,actorId])
  const active=approvals.filter(x=>x.status!=='cancelled')
  const approved=active.filter(x=>x.status==='approved').length
  const rejected=active.filter(x=>x.status==='rejected').length
  const pending=active.filter(x=>x.status==='pending').length
  if(!active.length)return null
  return <div className="source-truth-note committee-approval-panel">
    <strong>{en?'Minutes approval':'Έγκριση πρακτικών'}</strong>
    <p>{en?`${approved} approved · ${pending} pending${rejected?` · ${rejected} requested changes`:''}`:`${approved} εγκρίσεις · ${pending} εκκρεμούν${rejected?` · ${rejected} αιτήματα διορθώσεων`:''}`}</p>
    <div className="scroll-table"><table className="data-table"><thead><tr><th>{en?'Approver':'Εγκριτής'}</th><th>{en?'Status':'Κατάσταση'}</th><th>{en?'Decision':'Απόφαση'}</th><th>{en?'Comment':'Σχόλιο'}</th></tr></thead><tbody>{active.map((item,index)=><tr key={item.id}><td>{item.approverName||`${en?'Approver':'Εγκριτής'} ${index+1}`}</td><td><span className={`status-badge ${item.status==='approved'?'active':item.status==='pending'?'temporary':''}`}>{item.status==='approved'?<CheckCircle2 size={13}/>:item.status==='rejected'?<XCircle size={13}/>:<Clock3 size={13}/>} {statusText(item.status,en)}</span></td><td>{fmt(item.decidedAt||item.requestedAt)}</td><td>{item.comment||'—'}</td></tr>)}</tbody></table></div>
    {mine&&<div className="observer-form-section"><div className="source-truth-note"><strong>{en?'Your decision is required':'Απαιτείται η απόφασή σας'}</strong><p>{en?'Review the minutes above. Approval is recorded with your account and cannot be changed afterwards.':'Ελέγξτε τα πρακτικά παραπάνω. Η απόφασή σας καταγράφεται με τον λογαριασμό σας και δεν μπορεί να αλλάξει εκ των υστέρων.'}</p></div><div className="dialog-actions"><Button variant="secondary" disabled={busy} onClick={()=>setChangesOpen(true)}><MessageSquareWarning size={15}/>{en?' Request changes':' Αίτημα διορθώσεων'}</Button><Button disabled={busy} onClick={()=>onApprove(mine.id)}><CheckCircle2 size={15}/>{en?' Approve minutes':' Έγκριση πρακτικών'}</Button></div></div>}
    {changesOpen&&<RequestChangesDialog busy={busy} en={en} onClose={()=>{setChangesOpen(false);setComment('')}} comment={comment} onComment={setComment} onSave={async()=>{if(!comment.trim())return;await onRequestChanges(mine.id,comment.trim());setChangesOpen(false);setComment('')}}/>}
  </div>
}

function RequestChangesDialog({busy,en,onClose,comment,onComment,onSave}){return <ObserverDialog width="standard" eyebrow={en?'Minutes approval':'Έγκριση πρακτικών'} title={en?'Request changes':'Αίτημα διορθώσεων'} subtitle={en?'Describe clearly what must be corrected before the minutes are submitted again.':'Περιγράψτε με σαφήνεια τι πρέπει να διορθωθεί πριν τα πρακτικά υποβληθούν ξανά.'} onClose={onClose} footer={<DialogActions onCancel={onClose} disabled={busy||!comment.trim()} onSave={onSave} saveLabel={busy?(en?'Saving…':'Αποθήκευση…'):(en?'Send request':'Αποστολή αιτήματος')}/>}><label className="field"><span>{en?'Required changes':'Απαιτούμενες διορθώσεις'} *</span><textarea autoFocus rows="5" value={comment} onChange={e=>onComment(e.target.value)} placeholder={en?'Explain the required corrections…':'Περιγράψτε τις απαιτούμενες διορθώσεις…'}/></label></ObserverDialog>}
