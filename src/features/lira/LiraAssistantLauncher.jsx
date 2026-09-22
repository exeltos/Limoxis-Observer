import { useEffect,useMemo,useState } from 'react'
import { BrainCircuit,HelpCircle,Lightbulb,Maximize2,Minimize2,Send,Sparkles,X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { loadLiraData } from './liraDataLayer'
import { buildLiraAnalysis,inferLiraQuestionScope } from './liraAnalysis'
import { interpretLiraQuestion,LIRA_INTENTS,LIRA_TOPICS } from './liraQuestionModel'
import { buildMatchedComparisonSpec,resolveLiraTimeScope } from './liraScope'
import { buildOperationalOverview,compareOperationalOverview,explainOperationalChange } from './liraOperationalOverview'
import { calculateHaiRate,compareHaiRates,inferHaiType } from './liraHaiMetrics'
import { callLiraGateway } from './liraGateway'

export function LiraAssistantLauncher(){
 const {language}=useLanguage();const en=language==='en';const {tenant,isDemo,role,membership}=useTenant();const [open,setOpen]=useState(false);const [expanded,setExpanded]=useState(false);const [question,setQuestion]=useState('');const [messages,setMessages]=useState([]);const [data,setData]=useState(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [conversationContext,setConversationContext]=useState({plan:null,timeWindow:null})
 const allowed=useMemo(()=>Boolean(tenant?.id)&&can(role,CAPABILITIES.VIEW_LIRA,membership?.capabilities??[],membership?.customCapabilities??[]),[tenant?.id,role,membership?.capabilities,membership?.customCapabilities])
 useEffect(()=>{if(!open||data||!allowed)return;let cancelled=false;setLoading(true);setError('');loadLiraData({isDemo,organizationId:tenant?.id}).then(next=>{if(!cancelled)setData(next)}).catch(err=>{if(!cancelled)setError(String(err?.message||err))}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[open,data,allowed,isDemo,tenant?.id])
 useEffect(()=>{if(!open)setExpanded(false)},[open])
 if(!allowed)return null
 async function ask(){const q=question.trim();if(!q||!data||loading||error)return;const deterministic=answerCompact(q,data,language,conversationContext);const stamp=Date.now();setMessages(items=>[...items,{id:`q-${stamp}`,kind:'question',text:q}]);setConversationContext(deterministic.context);setQuestion('');setLoading(true);try{const ai=await callLiraGateway({organizationId:tenant.id,question:q,language,context:deterministic.context,deterministicAnswer:{title:deterministic.title,subtitle:deterministic.subtitle,points:deterministic.points,provenance:deterministic.provenance},aggregateContext:{source:data.source,generatedAt:data.generatedAt}});const answer=ai.mode==='generative'?{...deterministic,title:en?'LIRA AI':'LIRA AI',subtitle:deterministic.title,points:[ai.answer],ai:{provider:ai.provider,model:ai.model},citations:ai.citations||[]}:deterministic;setMessages(items=>[...items,{id:`a-${stamp}`,kind:'answer',...answer}])}catch{setMessages(items=>[...items,{id:`a-${stamp}`,kind:'answer',...deterministic}])}finally{setLoading(false)}}
 return <>
  <button type="button" className={`lira-assistant-fab ${open?'active':''}`} aria-label={en?'Open LIRA assistant':'Άνοιγμα βοηθού LIRA'} title={en?'Ask LIRA':'Ρώτησε τη LIRA'} onClick={()=>setOpen(v=>!v)}>
   <span className="lira-assistant-fab-glow"/><span className="lira-assistant-orbit lira-assistant-orbit-question"><HelpCircle size={13}/></span><span className="lira-assistant-orbit lira-assistant-orbit-bulb"><Lightbulb size={13}/></span><BrainCircuit size={24}/><Sparkles className="lira-assistant-fab-spark" size={12}/>
  </button>
  {open&&<aside className={`lira-assistant-panel ${expanded?'expanded':''}`} aria-label="LIRA AI"><header className="lira-assistant-panel-head"><div className="lira-assistant-identity"><div className="lira-assistant-avatar"><BrainCircuit size={20}/><Sparkles size={10}/></div><div><strong>LIRA AI</strong><span>{en?'Limoxis intelligence assistant':'Βοηθός ανάλυσης Limoxis'}</span></div></div><div className="lira-assistant-head-actions"><button type="button" onClick={()=>setExpanded(v=>!v)} title={expanded?(en?'Reduce LIRA':'Σμίκρυνση LIRA'):(en?'Expand LIRA':'Μεγέθυνση LIRA')} aria-label={expanded?(en?'Reduce LIRA':'Σμίκρυνση LIRA'):(en?'Expand LIRA':'Μεγέθυνση LIRA')}>{expanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button type="button" onClick={()=>setOpen(false)} aria-label={en?'Close':'Κλείσιμο'}><X size={18}/></button></div></header>
   <div className="lira-assistant-body">{!messages.length&&!loading&&!error&&<div className="lira-assistant-welcome"><div className="lira-assistant-welcome-mark"><BrainCircuit size={21}/><span className="lira-welcome-bulb"><Lightbulb size={13}/></span><span className="lira-welcome-question">?</span></div><strong>{en?'What can I check for you?':'Τι θέλετε να ελέγξω;'}</strong><span>{en?'Ask about surveillance, infections, laboratory, prevention, indicators or quality without leaving this screen.':'Ρωτήστε για επιτήρηση, λοιμώξεις, εργαστήριο, πρόληψη, δείκτες ή ποιότητα χωρίς να φύγετε από την οθόνη.'}</span><div className="lira-assistant-suggestions">{(en?['What needs attention today?','Show me AMR signals','How is prevention performing?']:['Τι χρειάζεται προσοχή σήμερα;','Δείξε μου σήματα AMR','Πώς πάει η πρόληψη;']).map(x=><button type="button" key={x} onClick={()=>setQuestion(x)}>{x}</button>)}</div></div>}
    {loading&&<div className="lira-assistant-state"><BrainCircuit size={21}/><strong>{en?'Preparing LIRA…':'Προετοιμασία LIRA…'}</strong><span>{en?'Reading only data authorized for your role.':'Ανάγνωση μόνο των δεδομένων που επιτρέπονται στον ρόλο σας.'}</span></div>}
    {error&&<div className="lira-assistant-state error"><strong>{en?'LIRA is temporarily unavailable':'Η LIRA δεν είναι προσωρινά διαθέσιμη'}</strong><span>{en?'No answer will be generated from incomplete data.':'Δεν θα παραχθεί απάντηση από ελλιπή δεδομένα.'}</span></div>}
    {messages.map(item=>item.kind==='question'?<div className="lira-assistant-question" key={item.id}>{item.text}</div>:<article className="lira-assistant-answer" key={item.id}><div className="lira-assistant-answer-mark"><Sparkles size={14}/></div><div><strong>{item.title}</strong>{item.subtitle&&<small>{item.subtitle}</small>}{item.provenance?.length>0&&<small>{en?'Evidence:':'Τεκμήρια:'} {item.provenance.map(x=>`${x.source}${x.id?` #${x.id}`:''}`).join(' · ')}</small>}{item.citations?.length>0&&<small>{en?'Guidance:':'Τεκμηρίωση:'} {item.citations.map(x=>`${x.authority} · ${x.title}${x.version?` v${x.version}`:''}${x.pageStart?` · p. ${x.pageStart}${x.pageEnd&&x.pageEnd!==x.pageStart?`–${x.pageEnd}`:''}`:''}`).join(' · ')}</small>}<div className="lira-assistant-answer-points">{item.points.map((point,index)=><p key={`${item.id}-${index}`}>{point}</p>)}</div></div></article>)}
   </div>
   <div className="lira-assistant-composer"><textarea rows={expanded?3:2} value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask()}}} placeholder={en?'Ask LIRA…':'Ρωτήστε τη LIRA…'}/><Button onClick={ask} disabled={!question.trim()||loading||Boolean(error)||!data} aria-label={en?'Send':'Αποστολή'}><Send size={16}/></Button><small>{en?'Enter to send · Decision support, not autonomous clinical decision-making.':'Enter για αποστολή · Υποστήριξη απόφασης, όχι αυτόνομη κλινική απόφαση.'}</small></div>
  </aside>}
 </>
}

function answerCompact(question,data,language,previousContext={}) {
 const en=language==='en'
 const today=data.generatedAt?.slice(0,10)||new Date().toISOString().slice(0,10)
 const inferred=inferLiraQuestionScope(question,data,language)
 const plan=interpretLiraQuestion(question,{scope:inferred,previousPlan:previousContext?.plan||null})
 const resolved=resolveLiraTimeScope(question,{data,plan,language,today,previousTimeWindow:previousContext?.timeWindow||null})
 const scoped=resolved.data
 const analysis=buildLiraAnalysis(scoped,language)
 const context={plan,timeWindow:resolved.timeWindow}
 const evidenceFromSignals=signals=>signals.flatMap(x=>x.evidence||[]).filter((item,index,all)=>all.findIndex(other=>other.source===item.source&&other.id===item.id)===index).slice(0,8)
 const signalPoints=(predicate=()=>true)=>analysis.signals.filter(predicate).slice(0,6).map(x=>`${severityLabel(x.severity,language)} — ${x.title}: ${x.summary}`)
 const haiType=inferHaiType(question)

 if(haiType){
  if(plan.comparison||plan.operationalChange){
   const spec=buildMatchedComparisonSpec(resolved.timeWindow,{today,language})
   const answer=compareHaiRates(data,haiType,spec.current,spec.reference,{department:plan.department,today,language})
   return {...answer,context,provenance:[{source:'hai_classifications'},{source:'surveillance_devices'}]}
  }
  const metric=calculateHaiRate(data,haiType,{window:resolved.timeWindow,department:plan.department,today})
  const points=[metric.normalized?`${metric.rate} ${metric.unit} (${metric.events}/${metric.deviceDays}).`:(en?'The rate cannot be calculated because authorized device-day data are unavailable for this scope.':'Ο δείκτης δεν μπορεί να υπολογιστεί επειδή δεν υπάρχουν εξουσιοδοτημένα device-day δεδομένα για αυτό το εύρος.'),en?'Deterministic calculation from validated HAI classifications and device exposure records; formal case validation remains required.':'Ντετερμινιστικός υπολογισμός από ταξινομήσεις HAI και καταγραφές έκθεσης σε συσκευές· εξακολουθεί να απαιτείται επίσημη επικύρωση περιστατικού.']
  return {title:`${haiType.toUpperCase()} · ${en?'incidence':'επίπτωση'}`,subtitle:en?`Per 1,000 ${metric.denominatorLabel}.`:`Ανά 1.000 ${metric.denominatorLabel}.`,points,context,provenance:[{source:'hai_classifications'},{source:'surveillance_devices'}]}
 }

 if(plan.topic===LIRA_TOPICS.GENERAL&&(plan.comparison||plan.operationalChange)){
  const spec=buildMatchedComparisonSpec(resolved.timeWindow,{today,language})
  const answer=plan.intent===LIRA_INTENTS.EXPLANATION?explainOperationalChange(data,spec,{department:plan.department,today,language}):compareOperationalOverview(data,spec,{department:plan.department,today,language})
  return {...answer,context,provenance:[{source:'authorized cross-domain records'}]}
 }
 if(plan.topic===LIRA_TOPICS.GENERAL){const overview=buildOperationalOverview(scoped,{department:plan.department,today,language});return {...overview,context,provenance:[{source:'authorized cross-domain records'}]}}
 if(plan.topic===LIRA_TOPICS.AMR){const signals=analysis.signals.filter(x=>String(x.domain).includes('AMR'));return {title:'AMR / MDR-XDR',subtitle:en?'Resistance findings requiring epidemiological review.':'Ευρήματα αντοχής για επιδημιολογική αξιολόγηση.',points:[en?`${analysis.amr} resistance-flagged records in the understood scope.`:`${analysis.amr} εγγραφές με σήμανση αντοχής στο πλαίσιο της ερώτησης.`,...signalPoints(x=>String(x.domain).includes('AMR'))],context,provenance:evidenceFromSignals(signals)}}
 if(plan.topic===LIRA_TOPICS.HAND_HYGIENE||plan.topic===LIRA_TOPICS.BUNDLES){const signals=analysis.signals.filter(x=>/Prevention|Πρόληψη|Bundle/i.test(String(x.domain)));return {title:en?'Prevention':'Πρόληψη',subtitle:en?'Current prevention signals from authorized records.':'Τρέχοντα σήματα πρόληψης από εξουσιοδοτημένες εγγραφές.',points:signalPoints(x=>/Prevention|Πρόληψη|Bundle/i.test(String(x.domain))),context,provenance:evidenceFromSignals(signals)}}
 if(plan.intent===LIRA_INTENTS.OVERDUE||plan.topic===LIRA_TOPICS.CAPA){const signals=analysis.signals.filter(x=>/pending|overdue|εκκρεμ|εκπρόθεσ/i.test(`${x.title} ${x.summary}`));return {title:en?'Pending actions':'Εκκρεμείς ενέργειες',subtitle:en?'Items that may require follow-up.':'Στοιχεία που ενδέχεται να χρειάζονται follow-up.',points:signalPoints(x=>/pending|overdue|εκκρεμ|εκπρόθεσ/i.test(`${x.title} ${x.summary}`)),context,provenance:evidenceFromSignals(signals)}}
 const signals=analysis.signals.slice(0,6);const points=signalPoints();return {title:en?'LIRA assessment':'Αξιολόγηση LIRA',subtitle:en?'Highest-priority signals in the understood context.':'Τα σημαντικότερα σήματα στο πλαίσιο της ερώτησης.',points:points.length?points:[en?'No relevant signal emerged from the authorized records.':'Δεν προέκυψε σχετικό σήμα από τις εξουσιοδοτημένες εγγραφές.'],context,provenance:evidenceFromSignals(signals)}
}
function severityLabel(value,language){return ({el:{critical:'Κρίσιμο',high:'Υψηλό',medium:'Μέτριο',low:'Χαμηλό'},en:{critical:'Critical',high:'High',medium:'Medium',low:'Low'}}[language]||{})[value]||value}
