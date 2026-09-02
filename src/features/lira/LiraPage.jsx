import { useEffect,useState } from 'react'
import { BrainCircuit,CheckCircle2,Sparkles } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadLiraData } from './liraDataLayer'
import { buildLiraAnalysis,filterLiraData,inferLiraQuestionScope } from './liraAnalysis'
import { describeLiraPlan,interpretLiraQuestion,LIRA_INTENTS,LIRA_TOPICS } from './liraQuestionModel'

const severityLabels={el:{critical:'Κρίσιμο',high:'Υψηλό',medium:'Μέτριο',low:'Χαμηλό'},en:{critical:'Critical',high:'High',medium:'Medium',low:'Low'}}

export function LiraPage(){
 const {language}=useLanguage();const en=language==='en'
 const {tenant,isDemo}=useTenant()
 const [question,setQuestion]=useState('')
 const [conversation,setConversation]=useState([])
 const [previousPlan,setPreviousPlan]=useState(null)
 const [data,setData]=useState(null)
 const [loading,setLoading]=useState(true)
 const [loadError,setLoadError]=useState('')
 const [reloadKey,setReloadKey]=useState(0)

 useEffect(()=>{
  let cancelled=false
  setLoading(true);setLoadError('')
  loadLiraData({isDemo,organizationId:tenant?.id}).then(next=>{if(!cancelled)setData(next)}).catch(error=>{if(!cancelled){setData(null);setLoadError(String(error?.message||error))}}).finally(()=>{if(!cancelled)setLoading(false)})
  return()=>{cancelled=true}
 },[isDemo,tenant?.id,reloadKey])

 function ask(){
  const q=question.trim()
  if(!q||loading||loadError||!data)return
  const inferred=inferLiraQuestionScope(q,data,language)
  const plan=interpretLiraQuestion(q,{scope:inferred,previousPlan})
  const scopedData=filterLiraData(data,{department:plan.department,periodDays:plan.periodDays,language})
  const analysis=buildLiraAnalysis(scopedData,language)
  const answer=answerQuestion(plan,analysis,language)
  setPreviousPlan(plan)
  setConversation(items=>[...items,{id:`${Date.now()}-q`,kind:'question',text:q},{id:`${Date.now()}-a`,kind:'answer',answer}])
  setQuestion('')
 }

 return <Page fill title="LIRA AI" subtitle={en?'Ask Limoxis data in natural language.':'Ρωτήστε τα δεδομένα του Limoxis με φυσική γλώσσα.'}>
  <section className="lira-chat-shell lira-question-only">
   <div className="lira-chat-main">
    <div className="lira-chat-scroll" aria-live="polite">
     {!conversation.length&&!loading&&!loadError&&<div className="lira-chat-welcome"><div className="lira-chat-mark"><BrainCircuit size={28}/></div><strong>{en?'What would you like to know?':'Τι θέλετε να μάθετε;'}</strong><span>{en?'Ask LIRA directly about infections, surveillance, laboratory, prevention or quality. Follow-up questions keep the previous context.':'Ρωτήστε απευθείας τη LIRA για λοιμώξεις, επιτήρηση, εργαστήριο, πρόληψη ή ποιότητα. Οι επόμενες σύντομες ερωτήσεις διατηρούν το προηγούμενο πλαίσιο.'}</span></div>}
     {loading&&<div className="lira-chat-welcome" role="status"><div className="lira-chat-mark"><BrainCircuit size={28}/></div><strong>{en?'Preparing LIRA…':'Προετοιμασία LIRA…'}</strong><span>{en?'Reading the authorized Limoxis sources available to your account.':'Ανάγνωση των εξουσιοδοτημένων πηγών Limoxis που είναι διαθέσιμες στον λογαριασμό σας.'}</span></div>}
     {loadError&&<div className="lira-chat-welcome" role="alert"><strong>{en?'LIRA is temporarily unavailable':'Η LIRA δεν είναι προσωρινά διαθέσιμη'}</strong><span>{en?'No answer will be generated from incomplete data.':'Δεν θα δημιουργηθεί απάντηση από ελλιπή δεδομένα.'}</span><Button variant="secondary" onClick={()=>setReloadKey(x=>x+1)}>{en?'Retry':'Επανάληψη'}</Button></div>}
     {conversation.map(item=>item.kind==='question'?<div key={item.id} className="lira-user-question"><span>{item.text}</span></div>:<LiraAnswer key={item.id} answer={item.answer} language={language}/>)}
    </div>
    <div className="lira-chat-composer-wrap"><div className="lira-chat-composer"><textarea rows="1" autoFocus value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask()}}} placeholder={en?'Ask LIRA…':'Ρωτήστε τη LIRA…'} aria-label={en?'Question for LIRA':'Ερώτηση προς τη LIRA'}/><Button onClick={ask} disabled={!question.trim()||loading||Boolean(loadError)}>{en?'Send':'Αποστολή'}</Button></div><div className="lira-chat-hint">{en?'Enter to send · Shift+Enter for a new line · Decision support, not autonomous clinical decision-making.':'Enter για αποστολή · Shift+Enter για νέα γραμμή · Υποστήριξη απόφασης, όχι αυτόνομη κλινική απόφαση.'}</div></div>
   </div>
  </section>
 </Page>
}

function LiraAnswer({answer,language}){
 const en=language==='en'
 return <article className="lira-ai-response"><div className="lira-ai-avatar"><Sparkles size={16}/></div><div className="lira-ai-content"><div className="lira-ai-response-head"><strong>{answer.title}</strong><small>{answer.subtitle}</small></div>{answer.scopeNote&&<div className="lira-ai-source-note">{answer.scopeNote}</div>}<div className="lira-ai-points">{answer.points.length?answer.points.map((point,index)=><div key={`${point}-${index}`}><CheckCircle2 size={15}/><span>{point}</span></div>):<div><CheckCircle2 size={15}/><span>{en?'No relevant finding emerged from the context of your question.':'Δεν προέκυψε σχετικό εύρημα από το πλαίσιο της ερώτησής σας.'}</span></div>}</div><div className="lira-ai-source-note">{en?'Based only on authorized Limoxis records. Signals require professional verification and do not by themselves establish causality or an outbreak.':'Βασίζεται μόνο σε εξουσιοδοτημένες εγγραφές Limoxis. Τα σήματα απαιτούν επαγγελματική επιβεβαίωση και δεν τεκμηριώνουν από μόνα τους αιτιότητα ή έξαρση.'}</div></div></article>
}

function answerQuestion(plan,analysis,language='el'){
 const en=language==='en';const sev=severityLabels[language];const scopeNote=describeLiraPlan(plan,language)
 const signalPoints=(rows=analysis.signals.slice(0,8))=>rows.map(x=>`${sev[x.severity]} — ${x.title}: ${x.summary}`)
 if(plan.intent===LIRA_INTENTS.COUNT)return {title:en?'Count':'Πλήθος',subtitle:en?'Count derived from the authorized records in the understood context.':'Πλήθος από τις εξουσιοδοτημένες εγγραφές στο πλαίσιο που καταλάβαμε.',scopeNote,points:[plan.topic===LIRA_TOPICS.AMR?(en?`${analysis.amr} resistance-flagged records.`:`${analysis.amr} εγγραφές με σήμανση ανθεκτικότητας.`):(en?`${analysis.activeSurveillance} active surveillance records.`:`${analysis.activeSurveillance} ενεργές επιτηρήσεις.`)]}
 if(plan.intent===LIRA_INTENTS.CLUSTER)return {title:en?'Possible cluster signal':'Πιθανό σήμα συρροής',subtitle:en?'A cluster signal requires epidemiological assessment; LIRA does not diagnose an outbreak.':'Το σήμα συρροής απαιτεί επιδημιολογική αξιολόγηση· η LIRA δεν διαγιγνώσκει έξαρση.',scopeNote,points:signalPoints(analysis.signals.filter(x=>x.domain.includes('AMR')||x.domain.includes('Surveillance')||x.domain.includes('Επιτήρηση')))}
 if(plan.topic===LIRA_TOPICS.AMR)return {title:'AMR / MDR-XDR',subtitle:en?'Resistance findings are summarized for epidemiological review.':'Τα ευρήματα ανθεκτικότητας συνοψίζονται για επιδημιολογική αξιολόγηση.',scopeNote,points:[en?`${analysis.amr} records are flagged for resistance in this context.`:`${analysis.amr} εγγραφές έχουν σήμανση ανθεκτικότητας σε αυτό το πλαίσιο.`,...signalPoints(analysis.signals.filter(x=>x.domain.includes('AMR')))]}
 if(plan.topic===LIRA_TOPICS.HAND_HYGIENE||plan.topic===LIRA_TOPICS.BUNDLES)return {title:en?'Prevention compliance':'Συμμόρφωση πρόληψης',subtitle:en?'Hand-hygiene and bundle signals in the understood context.':'Σήματα υγιεινής χεριών και bundles στο πλαίσιο της ερώτησης.',scopeNote,points:signalPoints(analysis.signals.filter(x=>x.domain.includes('Prevention')||x.domain.includes('Πρόληψη')||x.domain.includes('Bundle')))}
 if(plan.intent===LIRA_INTENTS.OVERDUE||plan.topic===LIRA_TOPICS.CAPA)return {title:en?'Pending and overdue actions':'Εκκρεμείς και εκπρόθεσμες ενέργειες',subtitle:en?'Items requiring follow-up in the understood context.':'Στοιχεία που απαιτούν follow-up στο πλαίσιο της ερώτησης.',scopeNote,points:signalPoints(analysis.signals.filter(x=>x.title.includes('Εκκρεμεί')||x.title.includes('Εκπρόθεσμη')||x.title.includes('pending')||x.title.includes('Overdue')))}
 if(plan.intent===LIRA_INTENTS.EXPLANATION)return {title:en?'Why this signal appears':'Γιατί εμφανίζεται αυτό το σήμα',subtitle:en?'LIRA shows the source patterns supporting the signal, without claiming causality.':'Η LIRA παρουσιάζει τα μοτίβα που στηρίζουν το σήμα, χωρίς να αποδίδει αιτιότητα.',scopeNote,points:signalPoints()}
 if(plan.intent===LIRA_INTENTS.TREND||plan.intent===LIRA_INTENTS.COMPARISON)return {title:en?'Trend assessment':'Αξιολόγηση τάσης',subtitle:en?'Current authorized data are summarized for temporal assessment. Formal comparison needs matched periods and sufficient observations.':'Τα τρέχοντα εξουσιοδοτημένα δεδομένα συνοψίζονται για χρονική αξιολόγηση. Η επίσημη σύγκριση απαιτεί αντίστοιχες περιόδους και επαρκείς παρατηρήσεις.',scopeNote,points:signalPoints()}
 return {title:en?'LIRA assessment':'Αξιολόγηση LIRA',subtitle:en?'Highest-priority findings in the context understood from your question.':'Τα σημαντικότερα ευρήματα στο πλαίσιο που κατάλαβε η LIRA από την ερώτησή σας.',scopeNote,points:signalPoints()}
}
