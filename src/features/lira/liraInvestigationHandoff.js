export function buildInvestigationHandoff(signal,{from=null,to=null}={}){
 if(!signal)return null
 const organism=signal.organism||null,department=signal.department&&signal.department!=='—'?signal.department:null
 return {title:[organism||'AMR',department].filter(Boolean).join(' · '),organism,department,from:signal.from||from||null,to:signal.to||to||null,source:{type:'lira_signal',method:signal.method||'descriptive_spatial_concentration',evidence:signal.evidence||[],guardrails:{outbreakDeclared:false,transmissionInferred:false,humanInitiationRequired:true}}}
}
