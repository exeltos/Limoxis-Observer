import {latestCaseReviews} from './liraOutbreakClosure'
export function buildInvestigationCopilot({investigation,lineList,caseReviews=[],actions=[],events=[],closure,language='el'}={}){
 const en=language==='en',latest=latestCaseReviews(caseReviews),reviewed=new Set(latest.map(x=>x.record_key)),pending=(lineList?.rows||[]).filter(x=>!reviewed.has(x.recordKey)),openActions=actions.filter(x=>x.status!=='closed'),overdue=openActions.filter(x=>x.due_date&&x.due_date<new Date().toISOString().slice(0,10))
 const suggestions=[]
 if(pending.length)suggestions.push({id:'review_cases',label:en?'Review '+pending.length+' candidate case(s)':'Αξιολόγηση '+pending.length+' candidate περιστατικών',target:'line-list'})
 if(overdue.length)suggestions.push({id:'overdue_capa',label:en?overdue.length+' overdue CAPA require follow-up':overdue.length+' εκπρόθεσμα CAPA χρειάζονται follow-up',target:'capa'})
 else if(openActions.length)suggestions.push({id:'open_capa',label:en?openActions.length+' open CAPA action(s)':openActions.length+' ανοικτές ενέργειες CAPA',target:'capa'})
 if(closure?.blockers?.some(x=>x.code==='unresolved_hypotheses'))suggestions.push({id:'hypotheses',label:en?'Resolve documented hypotheses':'Επίλυση καταγεγραμμένων υποθέσεων',target:'hypotheses'})
 if(closure?.ready&&investigation?.status==='active')suggestions.push({id:'closure',label:en?'Review investigation closure':'Έλεγχος κλεισίματος διερεύνησης',target:'closure'})
 if(!suggestions.length)suggestions.push({id:'summary',label:en?'Review current investigation evidence':'Έλεγχος τρέχουσας τεκμηρίωσης',target:'evidence'})
 return {summary:en?(lineList?.summary?.uniquePatients||0)+' patient(s) · '+latest.length+' reviewed · '+openActions.length+' open CAPA.':(lineList?.summary?.uniquePatients||0)+' ασθενείς · '+latest.length+' αξιολογημένα · '+openActions.length+' ανοικτά CAPA.',suggestions,guardrails:{contextBound:true,noAutonomousAction:true,noGenerativePatientContext:true},evidenceEvents:events.length}
}
