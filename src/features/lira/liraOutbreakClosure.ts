import { hospitalToday } from '../../core/dates/hospitalDate'
import type { AnyRecord } from '../../types/featureTypes'
// Τα τεκμήρια μιας διερεύνησης: γραμμική λίστα, αξιολογήσεις, διορθωτικές ενέργειες, ιστορικό.
export interface OutbreakEvidence { lineList?: AnyRecord|null; caseReviews?: AnyRecord[]; actions?: AnyRecord[]; events?: AnyRecord[] }
export function latestCaseReviews(reviews: AnyRecord[]=[]){const map=new Map<string,AnyRecord>();for(const review of reviews){const prev=map.get(review.record_key);if(!prev||String(review.reviewed_at||'')>=String(prev.reviewed_at||''))map.set(review.record_key,review)}return [...map.values()]}
export function buildOutbreakClosureReadiness({lineList,caseReviews=[],actions=[],events=[],today=hospitalToday()}: OutbreakEvidence&{today?: string}={}){
 const rows=lineList?.rows||[],latest=latestCaseReviews(caseReviews),reviewed=new Set(latest.map(x=>x.record_key)),unreviewed=rows.filter((x: AnyRecord)=>!reviewed.has(x.recordKey)).length
 const openActions=actions.filter(x=>x.status!=='closed'),overdueActions=openActions.filter(x=>x.due_date&&x.due_date<today)
 const hypotheses=events.filter(x=>x.event_type==='hypothesis'),decisions=events.filter(x=>x.event_type==='decision')
 const unresolvedHypotheses=hypotheses.filter(h=>!decisions.some(d=>d.created_at>=h.created_at))
 const blockers=[];if(unreviewed)blockers.push({code:'unreviewed_candidates',count:unreviewed});if(openActions.length)blockers.push({code:'open_actions',count:openActions.length});if(unresolvedHypotheses.length)blockers.push({code:'unresolved_hypotheses',count:unresolvedHypotheses.length})
 return {ready:blockers.length===0,counts:{candidates:rows.length,reviewed:latest.length,confirmed:latest.filter(x=>x.classification==='confirmed').length,excluded:latest.filter(x=>x.classification==='excluded').length,openActions:openActions.length,overdueActions:overdueActions.length,unresolvedHypotheses:unresolvedHypotheses.length,evidenceEvents:events.length},blockers,guardrails:{humanClosureRequired:true,automaticClosure:false}}
}
