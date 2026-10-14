import { Archive,ArrowRight,CheckCircle2,Clock3,FilePlus2,FileUp,Pencil,RotateCcw,Send } from 'lucide-react'
import { ActionButton } from '../../../design-system/ActionButton'
import { L,PERIOD_KINDS,defaultFrame,fmtDate,txt } from './riskUi'

const FLOW=[
 ['draft','Πρόχειρο','Draft',['riskAssessmentCreated','riskAssessmentImported','riskAssessmentReopened']],
 ['under_review','Σε έλεγχο','Under review',['riskAssessmentSubmitted']],
 ['approved','Εγκεκριμένη','Approved',['riskAssessmentApproved']],
 ['archived','Αρχειοθετημένη','Archived',['riskAssessmentArchived']],
]
export const HISTORY={riskAssessmentCreated:['Δημιουργία εκτίμησης','Assessment created',FilePlus2],riskAssessmentImported:['Εισαγωγή από Excel','Imported from Excel',FileUp],riskAssessmentSubmitted:['Υποβολή για έλεγχο','Submitted for review',Send],riskAssessmentApproved:['Έγκριση','Approved',CheckCircle2],riskAssessmentReopened:['Επαναφορά σε πρόχειρο','Back to draft',RotateCcw],riskAssessmentArchived:['Αρχειοθέτηση','Archived',Archive],riskAssessmentUpdated:['Αλλαγή στοιχείων','Details changed',Pencil]}
const DAY=86400000
const daysUntil=date=>date?Math.round((new Date(`${date}T00:00:00`)-new Date(new Date().toDateString()))/DAY):null

// The «Στοιχεία» tab: who and what the assessment is, where it stands in its
// approval, when it is due again, the periods before and after it, and its history.
export function RiskAssessmentDetails({assessment,assessments=[],en,locale,actions=null,nextStep=null,onOpenAssessment,onCreateNext,frame=defaultFrame}){
 const history=assessment.history||[]
 const lastOf=ids=>[...history].reverse().find(h=>ids.includes(h.action))
 const at=FLOW.findIndex(([id])=>id===assessment.status)
 const days=daysUntil(assessment.nextReviewOn)
 const previous=assessments.find(a=>a.id===assessment.sourceAssessmentId)
 const following=assessments.filter(a=>a.sourceAssessmentId===assessment.id).sort((a,b)=>String(a.assessedOn).localeCompare(String(b.assessedOn)))
 // Three rows of two: form and period, the dates (the next one counting down), who and where.
 const fields=[
  [L(en,'Κωδικός εντύπου','Form code'),assessment.formCode],
  [L(en,'Περίοδος','Period'),[assessment.periodLabel,PERIOD_KINDS[assessment.periodKind]?.[en?1:0]].filter(Boolean).join(' · ')],
  [L(en,'Ημερομηνία αξιολόγησης','Assessment date'),fmtDate(assessment.assessedOn,locale)],
  [L(en,'Επόμενη αξιολόγηση','Next assessment'),assessment.nextReviewOn?<span className={`risk-next-review${days<0?' is-overdue':days<=30?' is-soon':''}`}><Clock3 size={16}/><strong>{fmtDate(assessment.nextReviewOn,locale)}</strong><span>{days<0?L(en,`εκπρόθεσμη κατά ${-days} ημέρες`,`${-days} days overdue`):days===0?L(en,'σήμερα','today'):L(en,`σε ${days} ημέρες`,`in ${days} days`)}</span></span>:<span className="risk-empty-note">{L(en,'Δεν έχει οριστεί ημερομηνία.','No date set.')}</span>],
  [L(en,'Υπεύθυνος αξιολόγησης','Assessed by'),assessment.assessorLabel],
  [L(en,'Πεδίο εφαρμογής / σημειώσεις','Scope / notes'),assessment.scopeNote],
 ]
 const link=(a,label)=><button type="button" className="risk-lineage-link" onClick={()=>onOpenAssessment?.(a.code)}><small>{label}</small><strong>{txt(a,'title',en)}</strong><span>{a.periodLabel} · {fmtDate(a.assessedOn,locale)}</span><ArrowRight size={14}/></button>
 return frame(null,<div className="risk-details">
  <div className="risk-details-columns">
   <section className="risk-panel"><header><h3>{L(en,'Ταυτότητα εκτίμησης','Assessment identity')}</h3><span className="risk-panel-actions">{actions}</span></header>
    <dl className="risk-identity">{fields.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'—'}</dd></div>)}</dl>
   </section>
   <div className="risk-details-side">
    <section className="risk-panel"><header><h3>{L(en,'Περίοδοι','Periods')}</h3></header>
     <div className="risk-lineage">
      {previous?link(previous,L(en,'Μεταφέρθηκε από','Carried over from')):<p className="risk-empty-note">{L(en,'Πρώτη εκτίμηση της σειράς.','First assessment of the series.')}</p>}
      {following.map(a=><div key={a.id}>{link(a,L(en,'Συνεχίζεται στην','Continued in'))}</div>)}
      {!following.length&&onCreateNext&&<ActionButton label={L(en,'Δημιουργία επόμενης εκτίμησης','Create the next assessment')} tone="neutral" onClick={onCreateNext}><FilePlus2 size={14}/><span>{L(en,'Δημιουργία επόμενης εκτίμησης','Create the next assessment')}</span></ActionButton>}
     </div>
    </section>
   </div>
  </div>
  <section className="risk-panel"><header><h3>{L(en,'Κύκλος έγκρισης','Approval cycle')}</h3>{nextStep&&<span className="risk-panel-actions"><ActionButton label={nextStep.label} tone="primary" onClick={nextStep.onClick}>{nextStep.icon&&<nextStep.icon size={15}/>}<span>{nextStep.label}</span></ActionButton></span>}</header>
   <ol className="risk-approval">{FLOW.map(([id,el,enLabel,events],i)=>{const done=i<at||(i===at&&id!=='draft'),current=i===at,event=i<=at?lastOf(events):null
    const by=id==='approved'&&assessment.approvedByLabel?`${assessment.approvedByLabel} · ${fmtDate(assessment.approvedOn,locale)}`:event?`${event.actor||''} · ${fmtDate(String(event.at).slice(0,10),locale)}`:''
    return <li key={id} className={`${done?'is-done':''}${current?' is-current':''}`.trim()||undefined}><span className="risk-approval-dot">{done&&!current?<CheckCircle2 size={14}/>:i+1}</span><strong>{en?enLabel:el}</strong>{by&&<small>{by}</small>}</li>})}</ol>
  </section>
  <section className="risk-panel"><header><h3>{L(en,'Ιστορικό','History')}</h3></header>
   <ol className="risk-timeline">
    {[...history].reverse().map(h=>{const [el,enLabel,Icon]=HISTORY[h.action]||[h.action,h.action,Pencil];return <li key={h.id}><span className="risk-timeline-icon"><Icon size={14}/></span><strong>{en?enLabel:el}</strong><small>{[h.actor,new Date(h.at).toLocaleString(locale)].filter(Boolean).join(' · ')}</small></li>})}
    {assessment.updatedAt&&<li className="is-muted"><span className="risk-timeline-icon"><Clock3 size={14}/></span><strong>{L(en,'Τελευταία αλλαγή','Last change')}</strong><small>{new Date(assessment.updatedAt).toLocaleString(locale)}</small></li>}
   </ol>
   {!history.length&&<p className="risk-empty-note">{L(en,'Δεν έχουν καταγραφεί ακόμη ενέργειες στην εκτίμηση.','No actions recorded on the assessment yet.')}</p>}
  </section>
 </div>)
}
