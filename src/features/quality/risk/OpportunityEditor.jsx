import { useState } from 'react'
import { Lightbulb,Save } from 'lucide-react'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { Button } from '../../../design-system/Button'
import { EFFECTIVENESS,OPPORTUNITY_RATINGS,normalizeOpportunity,ratingLabel } from './riskModel'
import { L,recordActions } from './riskUi'
import { MeasureList,Step } from './RiskEditor'
import { RatingBadge } from './RiskOpportunities'

// One opportunity of an assessment, on its own page.
export function OpportunityEditor({item,code,en,readOnly=false,saving=false,assessmentLabel='',onClose,onSave,onDelete=null}){
 const [draft,setDraft]=useState(()=>normalizeOpportunity(item))
 const isNew=!item?.id
 const [editing,setEditing]=useState(isNew&&!readOnly)
 const locked=readOnly||!editing
 // Cancel remounts the fields, so lists with their own state (the measures) drop the edits too.
 const [version,setVersion]=useState(0)
 const cancel=()=>{if(isNew){onClose();return};setDraft(normalizeOpportunity(item));setEditing(false);setVersion(v=>v+1)}
 const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
 const field=(key,label,props={})=><label className="risk-field"><span>{label}</span><input value={draft[key]??''} disabled={locked} onChange={e=>set(key,e.target.value)} {...props}/></label>
 const area=(key,label,rows=2,hint='')=><label className="risk-field risk-field-wide"><span>{label}{hint&&<small>{hint}</small>}</span><textarea rows={rows} value={draft[key]??''} disabled={locked} onChange={e=>set(key,e.target.value)}/></label>
 const short=String(draft.activity||'').trim()
 const title=short?(short.length>90?`${short.slice(0,88)}…`:short):L(en,'Νέα ευκαιρία','New opportunity')
 const choice=(list,key)=><div className="risk-choice" role="radiogroup">{list.map(x=><button key={x.id} type="button" role="radio" aria-checked={draft[key]===x.id} className={draft[key]===x.id?'active':''} disabled={locked} onClick={()=>set(key,draft[key]===x.id?'':x.id)}>{en?x.en:x.el}</button>)}</div>
 return <EntityRecordShell className="quality-record-shell risk-editor-shell workspace-fill" avatar={<Lightbulb size={19}/>}
  eyebrow={[code||L(en,'Νέα ευκαιρία','New opportunity'),L(en,'Ευκαιρία','Opportunity'),assessmentLabel].filter(Boolean).join(' · ')}
  title={title} subtitle={draft.opportunity?String(draft.opportunity).slice(0,140):undefined}
  status={<RatingBadge id={draft.ratingId} en={en}/>}
  headerActions={recordActions({en,canEdit:!readOnly,editing,isNew,onEdit:()=>setEditing(true),onDelete})}
  onBack={onClose} backLabel={L(en,'Πίσω στις ευκαιρίες','Back to the opportunities')}>
  <div className="risk-editor" key={version}>
   <Step n={1} title={L(en,'Περιγραφή','Description')}>
    {area('activity',L(en,'Δραστηριότητα','Activity'),2)}
    {area('opportunity',L(en,'Ευκαιρία','Opportunity'),2,L(en,'τι κερδίζει ο οργανισμός','what the organization gains'))}
    <div className="risk-field risk-field-wide"><span>{L(en,'Απόδοση','Yield')}</span>{choice(OPPORTUNITY_RATINGS,'ratingId')}</div>
   </Step>
   <Step n={2} title={L(en,'Σχέδιο δράσης','Action plan')}>
    <MeasureList title={L(en,'Πρόσθετα μέτρα αξιοποίησης','Measures to seize it')} hint={L(en,'ένα μέτρο ανά γραμμή','one measure per line')} value={draft.actionPlan} onChange={v=>set('actionPlan',v)} en={en} disabled={locked}/>
    <div className="risk-editor-grid risk-editor-grid-description">
     <div className="risk-span-3">{field('owner',L(en,'Υπεύθυνος υλοποίησης','Owner'))}</div>
     <div className="risk-span-3">{field('timeframe',L(en,'Χρόνος υλοποίησης','Timeframe'),{placeholder:L(en,'π.χ. Ετησίως, 30/11/2026','e.g. Yearly, 30/11/2026')})}</div>
    </div>
   </Step>
   <Step n={3} title={L(en,'Αποτελεσματικότητα σχεδίου δράσης','Effectiveness of the action plan')}>
    <div className="risk-field risk-field-wide"><span>{L(en,'Αξιολόγηση','Assessment')}</span>{choice(EFFECTIVENESS,'effectivenessStatus')}</div>
    {area('effectiveness',L(en,'Τεκμηρίωση / μέτρηση','Evidence / measure'),3,L(en,'π.χ. ποσοστό προσωπικού που εκπαιδεύτηκε','e.g. share of staff trained'))}
   </Step>
  </div>
  <div className="risk-editor-actions">
   {!locked&&!isNew&&<Button variant="secondary" onClick={cancel}>{L(en,'Ακύρωση','Cancel')}</Button>}
   {!locked&&<Button onClick={()=>{const {ratingId,...rest}=draft;onSave({...rest,rating:ratingLabel(ratingId)})}} disabled={!String(draft.activity||'').trim()||saving}><Save size={15}/>{L(en,'Αποθήκευση ευκαιρίας','Save opportunity')}</Button>}
  </div>
 </EntityRecordShell>
}
