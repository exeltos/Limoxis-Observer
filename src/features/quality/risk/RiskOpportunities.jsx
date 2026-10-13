import { useState } from 'react'
import { Pencil,Plus,Trash2 } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../../design-system/ObserverDialog'
import { ActionButton } from '../../../design-system/ActionButton'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { L } from './riskUi'

const FIELDS=[['activity','Δραστηριότητα','Activity',2],['opportunity','Ευκαιρίες','Opportunities',2],['rating','Χαρακτηρισμός (υψηλής / χαμηλής απόδοσης)','Rating (high / low yield)',0],['actionPlan','Σχέδια δράσης – πρόσθετα μέτρα αξιοποίησης','Action plan – measures to seize it',3],['timeframe','Χρόνος υλοποίησης','Timeframe',0],['owner','Υπεύθυνος υλοποίησης','Owner',0],['effectiveness','Αποτελεσματικότητα σχεδίου δράσης','Effectiveness of the action plan',2]]

// Opportunities (ISO 9001 §6.1 risks and opportunities) of the assessment.
export function RiskOpportunities({items,en,canEdit,onSave,onDelete}){
 const [editing,setEditing]=useState(null)
 return <div className="risk-opportunities">
  <div className="risk-toolbar"><p className="risk-hint">{L(en,'Θετικές ευκαιρίες που μπορούν να αξιοποιηθούν, με το σχέδιο δράσης και την αποτελεσματικότητά του.','Positive opportunities to seize, with their action plan and its effectiveness.')}</p>{canEdit&&<ActionButton label={L(en,'Νέα ευκαιρία','New opportunity')} tone="primary" onClick={()=>setEditing({})}><Plus size={16}/><span>{L(en,'Νέα ευκαιρία','New opportunity')}</span></ActionButton>}</div>
  <div className="scroll-table"><table className="data-table risk-table"><thead><tr>{FIELDS.map(([key,el,enLabel])=><th key={key}>{en?enLabel:el}</th>)}<th aria-label={L(en,'Ενέργειες','Actions')}/></tr></thead><tbody>
   {items.map(item=><tr key={item.id} onClick={()=>setEditing(item)}>{FIELDS.map(([key])=><td key={key} className="risk-pre">{item[key]||'—'}</td>)}<td onClick={e=>e.stopPropagation()}><OverflowMenu label={L(en,'Ενέργειες','Actions')} items={[{id:'edit',label:canEdit?L(en,'Επεξεργασία','Edit'):L(en,'Προβολή','View'),icon:Pencil,onClick:()=>setEditing(item)},...(canEdit?[{id:'delete',label:L(en,'Διαγραφή','Delete'),icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>onDelete(item)}]:[])]}/></td></tr>)}
  </tbody></table>{!items.length&&<div className="registry-empty-state"><strong>{L(en,'Δεν έχουν καταγραφεί ευκαιρίες','No opportunities recorded')}</strong><span>{L(en,'Καταγράψτε τις ευκαιρίες που μπορεί να αξιοποιήσει ο οργανισμός.','Record the opportunities the organization can seize.')}</span></div>}</div>
  {editing&&<OpportunityDialog item={editing} en={en} readOnly={!canEdit} onClose={()=>setEditing(null)} onSave={async item=>{await onSave(item);setEditing(null)}}/>}
 </div>
}

function OpportunityDialog({item,en,readOnly,onClose,onSave}){
 const [draft,setDraft]=useState(item)
 return <ObserverDialog width="standard" title={L(en,'Ευκαιρία','Opportunity')} onClose={onClose} footer={<DialogActions onCancel={onClose} showCancel onSave={readOnly?undefined:()=>onSave(draft)} disabled={!String(draft.activity||'').trim()}/>}>
  <div className="risk-editor-grid risk-editor-grid-single">{FIELDS.map(([key,el,enLabel,rows])=><label key={key} className="risk-field risk-field-wide"><span>{en?enLabel:el}</span>{rows?<textarea rows={rows} value={draft[key]||''} disabled={readOnly} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/>:<input value={draft[key]||''} disabled={readOnly} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/>}</label>)}</div>
 </ObserverDialog>
}
