import { assignmentResponse } from './controlResponse'
import type { AnyRecord } from '../../types/featureTypes'

// Criticality, required evidence and deviation instructions live in the
// control's response_config, so they need no schema change.
export const CRITICALITY_LEVELS=['high','medium','low']
const LABELS:Record<string,Record<string,string>>={el:{high:'Υψηλή',medium:'Μέτρια',low:'Χαμηλή'},en:{high:'High',medium:'Medium',low:'Low'}}
const RANK:Record<string,number>={high:0,medium:1,low:2}

export function controlCriticality(record:AnyRecord|null|undefined){
 const value=record?.responseConfig?.criticality
 return CRITICALITY_LEVELS.includes(value)?value:'medium'
}
export function criticalityLabel(level:string,language='el'){
 return (LABELS[language==='en'?'en':'el'])[CRITICALITY_LEVELS.includes(level)?level:'medium']
}
function criticalityRank(record:AnyRecord){return RANK[controlCriticality(record)]}
export function requiresEvidence(record:AnyRecord|null|undefined){return Boolean(record?.responseConfig?.requiresEvidence)}
export function deviationActions(record:AnyRecord,department:string){return String(assignmentResponse(record,department).deviationActions||'').trim()}

// Registry order: overdue first, then due soon; within each, high criticality first.
export function compareControlPriority(a:AnyRecord,b:AnyRecord){
 const state:Record<string,number>={overdue:0,dueSoon:1,scheduled:2}
 const sa=state[a.state]??2,sb=state[b.state]??2
 if(sa!==sb)return sa-sb
 return criticalityRank(a.item)-criticalityRank(b.item)
}

export function evidenceSummary(file:{name:string,size?:number,type?:string}){
 return {name:file.name,size:file.size||0,type:file.type||''}
}
