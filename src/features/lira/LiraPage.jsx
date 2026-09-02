import { useEffect,useState } from 'react'
import { BrainCircuit,CheckCircle2,Sparkles } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadLiraData } from './liraDataLayer'
import { buildLiraAnalysis,filterLiraData,inferLiraQuestionScope } from './liraAnalysis'

const severityLabels={el:{critical:'Κρίσιμο',high:'Υψηλό',medium:'Μέτριο',low:'Χαμηλό'},en:{critical:'Critical',high:'High',medium:'Medium',low:'Low'}}

export function LiraPage(){
 const {language}=useLanguage();const en=language==='en'
 const {tenant,isDemo}=useTenant()
 const [question,setQuestion]=useState('')
 const [conversation,setConversation]=useState([])
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
  const scopedData=filterLiraData(data,{...inferred,language})
  const analysis=buildLiraAnalysis(scopedData,language)
  const answer=answerQuestion(q,analysis,language,inferred)
  setConversation(items=>[...items,{id:`${Date.now()}-q`,kind:'question',text:q},{id:`${Date.now()}-a`,kind:'answer',answer}])
  setQuestion('')
 }

 return <Page fill title="LIRA AI" subtitle={en?'Ask Limoxis data in natural language.':'Ρωτήστε τα δεδομένα του Limoxis με φυσική γλώσσα.'}>
  <section className="lira-chat-shell lira-question-only">
   <div className="lira-chat-main">
    <div className="lira-chat-scroll" aria-live="polite">
     {!conversation.length&&!loading&&!loadError&&<div className="lira-chat-welcome"><div className="lira-chat-mark"><BrainCircuit size={28}/></div><strong>{en?'What would you like to know?':'Τι θέλετε να μάθετε;'}</strong><span>{en?'Ask LIRA directly. It understands the subject, department and time context from your question and only uses records you are authorized to access.':'Ρωτήστε απευθείας τη LIRA. Καταλαβαίνει το θέμα, το τμήμα και το χρονικό πλαίσιο από την ερώτησή σας και χρησιμοποιεί μόνο εγγραφές στις οποίες έχετε εξουσιοδοτημένη πρόσβαση.'}</span></div>}
     {loading&&<div className="lira-chat-welcome" role="status"><div className="lira-chat-mark"><BrainCircuit size={28}/></div><strong>{en?'Preparing LIRA…':'Προετοιμασία LIRA…'}</strong><span>{en?'Reading the authorized Limoxis sources available to your account.':'Ανάγνωση των εξουσιοδοτημένων πηγών Limoxis που είναι διαθέσιμες στον λογαριασμό σας.'}</span></div>}
     {loadError&&<div className="lira-chat-welcome" role="alert"><strong>{en?'LIRA is temporarily unavailable':'Η LIRA δεν είναι προσωρινά διαθέσιμη'}</strong><span>{en?'No answer will be generated from incomplete data.':'Δεν θα δημιουργηθεί απάντηση από ελλιπή δεδομένα.'}</span><Button variant="secondary" onClick={()=>setReloadKey(x=>x+1)}>{en?'Retry':'Επανάληψη'}</Button></div>}
     {conversation.map(item=>item.kind==='question'?<div key={item.id} className="lira-user-question"><span>{item.text}</span></div>:<LiraAnswer key={item.id} answer={item.answer} language={language}/>)}
    </div>
    <div className="lira-chat-composer-wrap">
     <div className="lira-chat-composer"><textarea rows="1" autoFocus value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask()}}} placeholder={en?'Ask LIRA…':'Ρωτήστε τη LIRA…'} aria-label={en?'Question for LIRA':'Ερώτηση προς τη LIRA'}/><Button onClick={ask} disabled={!question.trim()||loading||Boolean(loadError)}>{en?'Send':'Αποστολή'}</Button></div>
     <div className="lira-chat-hint">{en?'Enter to send · Shift+Enter for a new line · Decision support, not autonomous clinical decision-making.':'Enter για αποστολή · Shift+Enter για νέα γραμμή · Υποστήριξη απόφασης, όχι αυτόνομη κλινική απόφαση.'}</div>
    </div>
   </div>
  </section>
 </Page>
}

function LiraAnswer({answer,language}){
 const en=language==='en'
 return <article className="lira-ai-response"><div className="lira-ai-avatar"><Sparkles size={16}/></div><div className="lira-ai-content"><div className="lira-ai-response-head"><strong>{answer.title}</strong><small>{answer.subtitle}</small></div>{answer.scopeNote&&<div className="lira-ai-source-note">{answer.scopeNote}</div>}<div className="lira-ai-points">{answer.points.length?answer.points.map((point,index)=><div key={`${point}-${index}`}><CheckCircle2 size={15}/><span>{point}</span></div>):<div><CheckCircle2 size={15}/><span>{en?'No relevant finding emerged from the context of your question.':'Δεν προέκυψε σχετικό εύρημα από το πλαίσιο της ερώτησής σας.'}</span></div>}</div><div className="lira-ai-source-note">{en?'Based only on authorized Limoxis records. Findings require professional verification in the source record.':'Βασίζεται μόνο σε εξουσιοδοτημένες εγγραφές Limoxis. Τα ευρήματα απαιτούν επαγγελματική επιβεβαίωση στην πρωτογενή εγγραφή.'}</div></div></article>
}

function answerQuestion(q,analysis,language='el',scope={department:'all',periodDays:0}){
 const en=language==='en';const text=q.toLowerCase();const sev=severityLabels[language]
 const periodLabel=scope.periodDays===1?(en?'today':'σήμερα'):scope.periodDays?`${scope.periodDays} ${en?'days':'ημέρες'}`:(en?'all available time':'όλο το διαθέσιμο χρονικό διάστημα')
 const scopeNote=scope.department!=='all'?(en?`Understood: ${scope.department} · ${periodLabel}`:`Κατάλαβα: ${scope.department} · ${periodLabel}`):(en?`Understood period: ${periodLabel}`:`Κατάλαβα χρονικό πλαίσιο: ${periodLabel}`)
 if(text.includes('μεθ')||text.includes('icu'))return {title:en?'ICU picture':'Εικόνα ΜΕΘ',subtitle:en?'Synthesis from the authorized surveillance, prevention, laboratory and quality records.':'Σύνθεση από τις εξουσιοδοτημένες εγγραφές επιτήρησης, πρόληψης, εργαστηρίου και ποιότητας.',scopeNote,points:analysis.signals.slice(0,8).map(x=>`${sev[x.severity]}: ${x.title} — ${x.summary}`)}
 if(text.includes('mdr')||text.includes('xdr')||text.includes('ανθεκ')||text.includes('resistan')||text.includes('amr'))return {title:'AMR / MDR-XDR',subtitle:en?'A cluster is a signal for epidemiological assessment, not an automatic outbreak diagnosis.':'Η συσσώρευση αποτελεί σήμα για επιδημιολογική αξιολόγηση και όχι αυτόματη διάγνωση έξαρσης.',scopeNote,points:[en?`There are ${analysis.amr} records flagged for resistance in the inferred scope.`:`Υπάρχουν ${analysis.amr} εγγραφές με σήμανση ανθεκτικότητας στο πλαίσιο της ερώτησης.`,...analysis.signals.filter(x=>x.domain.includes('AMR')||x.summary.includes('MDR')||x.summary.includes('XDR')).map(x=>x.summary)]}
 if(text.includes('υγιει')||text.includes('συμμόρφ')||text.includes('πρόλη')||text.includes('hygiene')||text.includes('compliance')||text.includes('prevention'))return {title:en?'Prevention compliance':'Συμμόρφωση πρόληψης',subtitle:en?'Signals from hand hygiene and prevention bundle records.':'Σήματα από εγγραφές υγιεινής χεριών και bundles πρόληψης.',scopeNote,points:analysis.signals.filter(x=>x.domain==='Πρόληψη'||x.domain==='Prevention'||x.domain.includes('Bundle')||x.domain.includes('bundle')).map(x=>`${x.title}: ${x.summary}`)}
 if(text.includes('εκπρόθεσ')||text.includes('overdue')||text.includes('εκκρεμ'))return {title:en?'Pending and overdue actions':'Εκκρεμείς και εκπρόθεσμες ενέργειες',subtitle:en?'Items requiring follow-up in the inferred context.':'Στοιχεία που απαιτούν follow-up στο πλαίσιο της ερώτησης.',scopeNote,points:analysis.signals.filter(x=>x.title.includes('Εκκρεμεί')||x.title.includes('Εκπρόθεσμη')||x.title.includes('pending')||x.title.includes('Overdue')).map(x=>`${x.title}: ${x.summary}`)}
 return {title:en?'LIRA assessment':'Αξιολόγηση LIRA',subtitle:en?'Highest-priority findings in the context inferred from your question.':'Τα σημαντικότερα ευρήματα στο πλαίσιο που κατάλαβε η LIRA από την ερώτησή σας.',scopeNote,points:analysis.signals.slice(0,8).map(x=>`${sev[x.severity]} — ${x.title}: ${x.summary}`)}
}
