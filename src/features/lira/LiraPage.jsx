import { useEffect,useMemo,useState } from 'react'
import { BrainCircuit,CheckCircle2,Lightbulb,Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadLiraData } from './liraDataLayer'
import { buildLiraAnalysis,filterLiraData,inferLiraQuestionScope } from './liraAnalysis'

const severityLabels={el:{critical:'Κρίσιμο',high:'Υψηλό',medium:'Μέτριο',low:'Χαμηλό'},en:{critical:'Critical',high:'High',medium:'Medium',low:'Low'}}

export function LiraPage(){
 const navigate=useNavigate()
 const {language}=useLanguage();const en=language==='en'
 const {tenant,isDemo}=useTenant()
 const [tab,setTab]=useState('assistant')
 const [question,setQuestion]=useState(en?'Where is immediate attention needed today?':'Πού χρειάζεται άμεση προσοχή σήμερα;')
 const [answer,setAnswer]=useState(null)
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

 const analysis=useMemo(()=>buildLiraAnalysis(data,language),[data,language])

 function ask(){
   const q=question.trim()
   if(!q||loading||loadError||!data)return
   const inferred=inferLiraQuestionScope(q,data,language)
   const scopedData=filterLiraData(data,{...inferred,language})
   const scopedAnalysis=buildLiraAnalysis(scopedData,language)
   setAnswer(answerQuestion(q,scopedAnalysis,language,inferred))
 }

 return <Page fill title="LIRA AI" subtitle={en?'Unified operational view of risk, trends and actions for infection prevention.':'Ενιαία επιχειρησιακή εικόνα κινδύνου, τάσεων και ενεργειών για την πρόληψη λοιμώξεων.'}>
  <div className="lira-safety-note"><BrainCircuit size={17}/><div><strong>{en?'Decision support — not autonomous clinical decision-making':'Υποστήριξη απόφασης — όχι αυτόνομη κλινική απόφαση'}</strong><span>{en?'Ask naturally. LIRA infers department and time context from your question, uses only data you are authorized to access, and highlights findings for professional verification.':'Ρωτήστε φυσικά. Η LIRA καταλαβαίνει από την ερώτηση το τμήμα και το χρονικό πλαίσιο, χρησιμοποιεί μόνο δεδομένα στα οποία έχετε εξουσιοδοτημένη πρόσβαση και επισημαίνει ευρήματα για επαγγελματική επαλήθευση.'}</span></div></div>

  {loading?<section className="surface lira-state-panel" role="status"><BrainCircuit size={22}/><div><strong>{en?'Preparing the authorized briefing…':'Προετοιμασία της εξουσιοδοτημένης ενημέρωσης…'}</strong><span>{en?'LIRA is reading the source modules available to your account.':'Η LIRA διαβάζει τις πρωτογενείς ενότητες που είναι διαθέσιμες στον λογαριασμό σας.'}</span></div></section>:loadError?<section className="surface lira-state-panel" role="alert"><div><strong>{en?'LIRA data could not be loaded':'Δεν ήταν δυνατή η φόρτωση δεδομένων LIRA'}</strong><span>{en?'No analysis was produced from incomplete data. Retry the authorized source read.':'Δεν δημιουργήθηκε ανάλυση από ελλιπή δεδομένα. Επαναλάβετε την εξουσιοδοτημένη ανάγνωση των πηγών.'}</span></div><Button variant="secondary" onClick={()=>setReloadKey(x=>x+1)}>{en?'Retry':'Επανάληψη'}</Button></section>:<>
  <nav className="tabs canonical-module-tabs lira-tabs" aria-label="LIRA">
   <button className={`tab ${tab==='assistant'?'active':''}`} onClick={()=>setTab('assistant')}><Sparkles size={15}/>{en?'Ask LIRA':'Ρώτησε τη LIRA'}</button>
   <button className={`tab ${tab==='briefing'?'active':''}`} onClick={()=>setTab('briefing')}><BrainCircuit size={15}/>LIRA Briefing<b className="tab-count">{analysis.highPriority}</b></button>
  </nav>
  {tab==='assistant'&&<Assistant language={language} question={question} setQuestion={setQuestion} onAsk={ask} answer={answer} navigate={navigate}/>} 
  {tab==='briefing'&&<Briefing language={language} analysis={analysis} navigate={navigate} source={data?.source} generatedAt={data?.generatedAt}/>} </>}
 </Page>
}

function Briefing({analysis,navigate,language,source,generatedAt}){
 const en=language==='en';const sev=severityLabels[language]
 const priority=analysis.signals.slice(0,5)
 const generated=generatedAt?new Intl.DateTimeFormat(en?'en-GB':'el-GR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(generatedAt)):''
 return <section className="lira-briefing-shell">
  <header className="lira-briefing-header"><div><span className="lira-eyebrow">LIRA BRIEFING</span><h2>{en?'What needs your attention':'Τι χρειάζεται την προσοχή σας'}</h2><p>{en?'Concise synthesis of authorized Limoxis data. Select a finding to verify it in the source module.':'Συνοπτική σύνθεση των εξουσιοδοτημένων δεδομένων του Limoxis. Επιλέξτε ένα εύρημα για έλεγχο στην πρωτογενή ενότητα.'}</p></div><div className="lira-briefing-date">{source==='demo'?(en?'Demo data':'Δεδομένα demo'):(en?'Live data':'Ζωντανά δεδομένα')} {generated&&<small>{generated}</small>}</div></header>
  <div className="lira-briefing-layout">
   <section className="surface lira-focus-panel"><div className="lira-section-head"><div><strong>{en?'Priorities':'Προτεραιότητες'}</strong><span>{analysis.highPriority} {en?'high priority':'υψηλής προτεραιότητας'}</span></div></div><div className="lira-focus-list">{priority.length?priority.map((x,i)=><article key={x.id} className="lira-focus-item"><div className={`lira-priority-index ${x.severity}`}>{i+1}</div><div className="lira-focus-copy"><div><strong>{x.title}</strong><span className={`lira-severity-text ${x.severity}`}>{sev[x.severity]}</span></div><p>{x.summary}</p><small>{x.domain}{x.department?` · ${x.department}`:''}{x.evidence?.length?` · ${x.evidence.length} ${en?'source record(s)':'εγγραφή(ές) πηγής'}`:''}</small></div>{x.to&&<button className="lira-open-link" onClick={()=>navigate(x.to)}>{en?'Review →':'Έλεγχος →'}</button>}</article>):<div className="empty-state">{en?'No high-priority signal was identified in the data currently available to you.':'Δεν εντοπίστηκε σήμα υψηλής προτεραιότητας στα δεδομένα που είναι διαθέσιμα σε εσάς.'}</div>}</div></section>
   <aside className="lira-briefing-side"><section className="surface lira-pulse-panel"><div className="lira-section-head"><div><strong>{en?"Today's picture":'Σημερινή εικόνα'}</strong><span>{en?'Key points':'Βασικά σημεία'}</span></div></div><div className="lira-pulse-list"><Pulse label={en?'Active surveillance':'Ενεργές επιτηρήσεις'} value={analysis.activeSurveillance} note={`${analysis.amr} ${en?'records flagged for AMR':'εγγραφές με AMR σήμανση'}`}/><Pulse label="Bundle all-or-none" value={`${analysis.bundleAllOrNone}%`} note={en?'Across available executions':'Στις διαθέσιμες εκτελέσεις'}/><Pulse label={en?'High priorities':'Υψηλές προτεραιότητες'} value={analysis.highPriority} note={en?'Require assessment':'Απαιτούν αξιολόγηση'}/></div></section><section className="surface lira-watch-panel"><div className="lira-section-head"><div><strong>{en?'Monitoring':'Παρακολούθηση'}</strong><span>{en?'Summary by domain':'Σύνθεση ανά τομέα'}</span></div></div><div className="lira-watch-list">{analysis.domains.slice(0,4).map(x=><div key={x.label}><span>{x.label}</span><strong>{x.value}</strong><small>{x.note}</small></div>)}</div></section></aside>
  </div>
  <section className="surface lira-next-panel"><div className="lira-section-head"><div><strong>{en?'Suggested reviews':'Προτεινόμενοι έλεγχοι'}</strong><span>{en?'For assessment by the authorized professional':'Για αξιολόγηση από τον αρμόδιο επαγγελματία'}</span></div></div><div className="lira-next-list">{analysis.actions.map((x,i)=><article key={i}><div><Lightbulb size={15}/></div><section><strong>{x.title}</strong><p>{x.text}</p></section>{x.to&&<button className="lira-open-link" onClick={()=>navigate(x.to)}>{en?'Open →':'Άνοιγμα →'}</button>}</article>)}</div></section>
 </section>
}
function Pulse({label,value,note}){return <div className="lira-pulse-row"><div><span>{label}</span><small>{note}</small></div><strong>{value}</strong></div>}

function Assistant({question,setQuestion,onAsk,answer,navigate,language}){
 const en=language==='en'
 const prompts=en?['What happened in ICU this week?','Any MDR/XDR concern in the last 30 days?','Where is hand-hygiene compliance low?','Which actions are overdue?']:['Τι έγινε στη ΜΕΘ αυτή την εβδομάδα;','Υπάρχει θέμα MDR/XDR τις τελευταίες 30 ημέρες;','Πού έχουμε χαμηλή συμμόρφωση στην υγιεινή χεριών;','Ποιες ενέργειες είναι εκπρόθεσμες;']
 return <section className="lira-chat-shell"><div className="lira-chat-main"><div className="lira-chat-scroll">
  {!answer&&<div className="lira-chat-welcome"><div className="lira-chat-mark"><BrainCircuit size={26}/></div><strong>{en?'Ask naturally — LIRA understands the context':'Ρωτήστε φυσικά — η LIRA καταλαβαίνει το πλαίσιο'}</strong><span>{en?'Mention a department, period, risk or workflow in the question. No filters are required.':'Αναφέρετε μέσα στην ερώτηση τμήμα, χρονικό διάστημα, κίνδυνο ή ροή. Δεν χρειάζονται φίλτρα.'}</span><div className="lira-chat-suggestions">{prompts.map(x=><button key={x} onClick={()=>setQuestion(x)}>{x}</button>)}</div></div>}
  {answer&&<div className="lira-conversation"><div className="lira-user-question"><span>{question}</span></div><article className="lira-ai-response"><div className="lira-ai-avatar"><Sparkles size={16}/></div><div className="lira-ai-content"><div className="lira-ai-response-head"><strong>{answer.title}</strong><small>{answer.subtitle}</small></div>{answer.scopeNote&&<div className="lira-ai-source-note">{answer.scopeNote}</div>}<div className="lira-ai-points">{answer.points.length?answer.points.map((x,i)=><div key={i}><CheckCircle2 size={15}/><span>{x}</span></div>):<div><CheckCircle2 size={15}/><span>{en?'No relevant finding emerged from the inferred scope.':'Δεν προέκυψε σχετικό εύρημα από το πλαίσιο που κατάλαβε η LIRA.'}</span></div>}</div>{answer.links.length>0&&<div className="lira-ai-links">{answer.links.map(x=><Button key={x.to} variant="secondary" onClick={()=>navigate(x.to)}>{x.label}</Button>)}</div>}<div className="lira-ai-source-note">{en?'Source: authorized Limoxis records. Verify each finding in the source module.':'Πηγή: εξουσιοδοτημένες εγγραφές Limoxis. Επιβεβαιώστε κάθε εύρημα στην πρωτογενή ενότητα.'}</div></div></article></div>}
 </div><div className="lira-chat-composer-wrap"><div className="lira-chat-composer"><textarea rows="1" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();onAsk()}}} placeholder={en?'Ask LIRA naturally...':'Ρωτήστε τη LIRA με φυσική γλώσσα...'}/><Button onClick={onAsk}>{en?'Send':'Αποστολή'}</Button></div><div className="lira-chat-hint">{en?'Enter to send · Shift+Enter for a new line · LIRA does not replace clinical judgment.':'Enter για αποστολή · Shift+Enter για νέα γραμμή · Η LIRA δεν αντικαθιστά κλινική κρίση.'}</div></div></div></section>
}

function answerQuestion(q,analysis,language='el',scope={department:'all',periodDays:0}){
 const en=language==='en';const text=q.toLowerCase();const sev=severityLabels[language]
 const periodLabel=scope.periodDays===1?(en?'today':'σήμερα'):scope.periodDays?`${scope.periodDays} ${en?'days':'ημέρες'}`:(en?'all available time':'όλο το διαθέσιμο χρονικό διάστημα')
 const scopeNote=scope.department!=='all'?(en?`Understood scope: ${scope.department} · ${periodLabel}`:`Κατάλαβα: ${scope.department} · ${periodLabel}`):(en?`Understood period: ${periodLabel}`:`Κατάλαβα χρονικό πλαίσιο: ${periodLabel}`)
 const isIcu=text.includes('μεθ')||text.includes('icu')
 if(isIcu)return {title:en?'ICU picture':'Εικόνα ΜΕΘ',subtitle:en?'Synthesis from surveillance, prevention, laboratory and quality.':'Σύνθεση από επιτήρηση, πρόληψη, εργαστήριο και ποιότητα.',scopeNote,points:analysis.signals.slice(0,6).map(x=>`${sev[x.severity]}: ${x.title} — ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'},{label:en?'Prevention':'Πρόληψη',to:'/prevention'}]}
 if(text.includes('mdr')||text.includes('xdr')||text.includes('ανθεκ')||text.includes('resistan'))return {title:'AMR / MDR-XDR',subtitle:en?'A cluster is a signal for epidemiological assessment, not an automatic outbreak diagnosis.':'Η συσσώρευση αποτελεί σήμα για επιδημιολογική αξιολόγηση και όχι αυτόματη διάγνωση έξαρσης.',scopeNote,points:[en?`There are ${analysis.amr} records flagged for resistance in the inferred scope.`:`Υπάρχουν ${analysis.amr} εγγραφές με σήμανση ανθεκτικότητας στο πλαίσιο που κατάλαβε η LIRA.`,...analysis.signals.filter(x=>x.domain.includes('AMR')||x.summary.includes('MDR')||x.summary.includes('XDR')).map(x=>x.summary)],links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'}]}
 if(text.includes('υγιει')||text.includes('συμμόρφ')||text.includes('πρόλη')||text.includes('hygiene')||text.includes('compliance')||text.includes('prevention'))return {title:en?'Prevention compliance':'Συμμόρφωση πρόληψης',subtitle:en?'Signals from hand hygiene and bundle executions.':'Σήματα από υγιεινή χεριών και bundle executions.',scopeNote,points:analysis.signals.filter(x=>x.domain==='Πρόληψη'||x.domain==='Prevention'||x.domain.includes('Bundle')||x.domain.includes('bundle')).map(x=>`${x.title}: ${x.summary}`),links:[{label:en?'Prevention':'Πρόληψη',to:'/prevention'}]}
 if(text.includes('εκπρόθεσ')||text.includes('overdue'))return {title:en?'Overdue actions':'Εκπρόθεσμες ενέργειες',subtitle:en?'Surveillance reviews and corrective actions requiring follow-up.':'Επιτηρήσεις και διορθωτικές ενέργειες που απαιτούν follow-up.',scopeNote,points:analysis.signals.filter(x=>x.title.includes('Εκκρεμεί')||x.title.includes('Εκπρόθεσμη')||x.title.includes('pending')||x.title.includes('Overdue')).map(x=>`${x.title}: ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Quality':'Ποιότητα',to:'/quality'}]}
 return {title:en?'Immediate priorities':'Άμεσες προτεραιότητες',subtitle:en?'Highest-priority signals in the context inferred from your question.':'Τα υψηλότερης προτεραιότητας σήματα στο πλαίσιο που κατάλαβε η LIRA από την ερώτησή σας.',scopeNote,points:analysis.signals.slice(0,5).map(x=>`${sev[x.severity]} — ${x.title}: ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'},{label:en?'Prevention':'Πρόληψη',to:'/prevention'},{label:en?'Quality':'Ποιότητα',to:'/quality'}]}
}
