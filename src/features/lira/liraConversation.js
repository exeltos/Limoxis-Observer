const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const has=(text,terms)=>terms.some(term=>text.includes(normalize(term)))

export function resolveConversationContext(question,{plan,comparisonSpec,haiType,previousContext=null}={}){
 const text=normalize(question)
 const asksWhy=has(text,['γιατι','why','πως εξηγειται','how come'])
 const asksOtherDepartment=has(text,['και στη','και στο','και στην','what about','and in'])
 const shortFollowUp=text.split(/\s+/).filter(Boolean).length<=8
 const inheritedComparison=!comparisonSpec&&shortFollowUp?previousContext?.comparisonSpec||null:comparisonSpec
 const inheritedHai=haiType||(shortFollowUp?previousContext?.haiType||null:null)
 const effectivePlan={...plan}
 if(asksWhy&&previousContext?.plan){
  effectivePlan.intent='explanation'
  if(effectivePlan.topic==='general'&&!effectivePlan.operationalChange)effectivePlan.topic=previousContext.plan.topic
  if(!effectivePlan.entity)effectivePlan.entity=previousContext.plan.entity||null
 }
 if(asksOtherDepartment&&previousContext?.plan){
  if(effectivePlan.topic==='general'&&!effectivePlan.operationalChange)effectivePlan.topic=previousContext.plan.topic
  if(!effectivePlan.entity)effectivePlan.entity=previousContext.plan.entity||null
 }
 return {plan:effectivePlan,comparisonSpec:inheritedComparison,haiType:inheritedHai,asksWhy,contextInherited:Boolean(previousContext&&(inheritedComparison||inheritedHai||asksWhy||asksOtherDepartment))}
}

export function createConversationContext({plan,comparisonSpec,haiType,answer}={}){
 return {plan,comparisonSpec:comparisonSpec||null,haiType:haiType||null,answerTitle:answer?.title||null,createdAt:Date.now()}
}
