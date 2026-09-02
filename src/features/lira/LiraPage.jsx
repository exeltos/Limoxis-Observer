import { useEffect,useMemo,useState } from 'react'
import { BrainCircuit,CheckCircle2,Lightbulb,Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadLiraData } from './liraDataLayer'

const severityLabels={el:{critical:'Κρίσιμο',high:'Υψηλό',medium:'Μέτριο',low:'Χαμηλό'},en:{critical:'Critical',high:'High',medium:'Medium',low:'Low'}}
const severityRank={critical:4,high:3,medium:2,low:1}

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

 const analysis=useMemo(()=>buildAnalysis(data,language),[data,language])

 function ask(){
   const q=question.trim()
   if(!q||loading||loadError)return
   setAnswer(answerQuestion(q,analysis,language))
 }

 return <Page fill title="LIRA AI" subtitle={en?'Unified operational view of risk, trends and actions for infection prevention.':'Ενιαία επιχειρησιακή εικόνα κινδύνου, τάσεων και ενεργειών για την πρόληψη λοιμώξεων.'}>
  <div className="lira-safety-note"><BrainCircuit size={17}/><div><strong>{en?'Decision support — not autonomous clinical decision-making':'Υποστήριξη απόφασης — όχι αυτόνομη κλινική απόφαση'}</strong><span>{en?'LIRA synthesizes only data the signed-in user is already authorized to access and highlights patterns for professional verification. Current analysis is deterministic and rule-based; it does not send clinical data to an external generative-AI service.':'Η LIRA συνθέτει μόνο δεδομένα στα οποία ο συνδεδεμένος χρήστης έχει ήδη εξουσιοδοτημένη πρόσβαση και επισημαίνει μοτίβα για επαγγελματική επαλήθευση. Η τρέχουσα ανάλυση είναι ντετερμινιστική και βασισμένη σε κανόνες· δεν αποστέλλει κλινικά δεδομένα σε εξωτερική υπηρεσία generative AI.'}</span></div></div>

  {loading?<section className="surface lira-state-panel" role="status"><BrainCircuit size={22}/><div><strong>{en?'Preparing the authorized briefing…':'Προετοιμασία της εξουσιοδοτημένης ενημέρωσης…'}</strong><span>{en?'LIRA is reading the source modules available to your account.':'Η LIRA διαβάζει τις πρωτογενείς ενότητες που είναι διαθέσιμες στον λογαριασμό σας.'}</span></div></section>:loadError?<section className="surface lira-state-panel" role="alert"><div><strong>{en?'LIRA data could not be loaded':'Δεν ήταν δυνατή η φόρτωση δεδομένων LIRA'}</strong><span>{en?'No analysis was produced from incomplete data. Retry the authorized source read.':'Δεν δημιουργήθηκε ανάλυση από ελλιπή δεδομένα. Επαναλάβετε την εξουσιοδοτημένη ανάγνωση των πηγών.'}</span></div><Button variant="secondary" onClick={()=>setReloadKey(x=>x+1)}>{en?'Retry':'Επανάληψη'}</Button></section>:<>
  <nav className="tabs canonical-module-tabs lira-tabs" aria-label="LIRA">
   <button className={`tab ${tab==='assistant'?'active':''}`} onClick={()=>setTab('assistant')}><Sparkles size={15}/>{en?'Ask LIRA':'Ρώτησε τη LIRA'}</button>
   <button className={`tab ${tab==='briefing'?'active':''}`} onClick={()=>setTab('briefing')}><BrainCircuit size={15}/>LIRA Briefing<b className="tab-count">{analysis.highPriority}</b></button>
  </nav>

  {tab==='assistant'&&<Assistant language={language} question={question} setQuestion={setQuestion} onAsk={ask} answer={answer} analysis={analysis} navigate={navigate}/>}
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
   <section className="surface lira-focus-panel"><div className="lira-section-head"><div><strong>{en?'Priorities':'Προτεραιότητες'}</strong><span>{analysis.highPriority} {en?'high priority':'υψηλής προτεραιότητας'}</span></div></div><div className="lira-focus-list">{priority.length?priority.map((x,i)=><article key={x.id} className="lira-focus-item"><div className={`lira-priority-index ${x.severity}`}>{i+1}</div><div className="lira-focus-copy"><div><strong>{x.title}</strong><span className={`lira-severity-text ${x.severity}`}>{sev[x.severity]}</span></div><p>{x.summary}</p><small>{x.domain}{x.department?` · ${x.department}`:''} · {x.evidence}</small></div>{x.to&&<button className="lira-open-link" onClick={()=>navigate(x.to)}>{en?'Review →':'Έλεγχος →'}</button>}</article>):<div className="empty-state">{en?'No high-priority signal was identified in the data currently available to you.':'Δεν εντοπίστηκε σήμα υψηλής προτεραιότητας στα δεδομένα που είναι διαθέσιμα σε εσάς.'}</div>}</div></section>
   <aside className="lira-briefing-side">
    <section className="surface lira-pulse-panel"><div className="lira-section-head"><div><strong>{en?"Today's picture":'Σημερινή εικόνα'}</strong><span>{en?'Key points':'Βασικά σημεία'}</span></div></div><div className="lira-pulse-list"><Pulse label={en?'Active surveillance':'Ενεργές επιτηρήσεις'} value={analysis.activeSurveillance} note={`${analysis.amr} ${en?'records flagged for AMR':'εγγραφές με AMR σήμανση'}`}/><Pulse label="Bundle all-or-none" value={`${analysis.bundleAllOrNone}%`} note={en?'Across available executions':'Στις διαθέσιμες εκτελέσεις'}/><Pulse label={en?'High priorities':'Υψηλές προτεραιότητες'} value={analysis.highPriority} note={en?'Require assessment':'Απαιτούν αξιολόγηση'}/></div></section>
    <section className="surface lira-watch-panel"><div className="lira-section-head"><div><strong>{en?'Monitoring':'Παρακολούθηση'}</strong><span>{en?'Summary by domain':'Σύνθεση ανά τομέα'}</span></div></div><div className="lira-watch-list">{analysis.domains.slice(0,4).map(x=><div key={x.label}><span>{x.label}</span><strong>{x.value}</strong><small>{x.note}</small></div>)}</div></section>
   </aside>
  </div>
  <section className="surface lira-next-panel"><div className="lira-section-head"><div><strong>{en?'Suggested reviews':'Προτεινόμενοι έλεγχοι'}</strong><span>{en?'For assessment by the authorized professional':'Για αξιολόγηση από τον αρμόδιο επαγγελματία'}</span></div></div><div className="lira-next-list">{analysis.actions.map((x,i)=><article key={i}><div><Lightbulb size={15}/></div><section><strong>{x.title}</strong><p>{x.text}</p></section>{x.to&&<button className="lira-open-link" onClick={()=>navigate(x.to)}>{en?'Open →':'Άνοιγμα →'}</button>}</article>)}</div></section>
 </section>
}
function Pulse({label,value,note}){return <div className="lira-pulse-row"><div><span>{label}</span><small>{note}</small></div><strong>{value}</strong></div>}

function Assistant({question,setQuestion,onAsk,answer,navigate,language}){
 const en=language==='en'
 const prompts=en?['Where is immediate attention needed today?','What is happening in the ICU?','Is there an MDR/XDR concern?','Where is prevention compliance low?','Which actions are overdue?']:['Πού χρειάζεται άμεση προσοχή σήμερα;','Τι συμβαίνει στη ΜΕΘ;','Υπάρχει θέμα με MDR/XDR;','Πού έχουμε χαμηλή συμμόρφωση πρόληψης;','Ποιες ενέργειες είναι εκπρόθεσμες;']
 return <section className="lira-chat-shell">
  <div className="lira-chat-main">
   <div className="lira-chat-scroll">
    {!answer&&<div className="lira-chat-welcome">
      <div className="lira-chat-mark"><BrainCircuit size={26}/></div>
      <strong>{en?'What would you like to learn from Limoxis data?':'Τι θέλετε να μάθετε από τα δεδομένα του Limoxis;'}</strong>
      <span>{en?'Ask about surveillance, laboratory, prevention, quality or trends. LIRA answers from authorized data and guides you to the source records.':'Ρωτήστε για επιτήρηση, εργαστήριο, πρόληψη, ποιότητα ή τάσεις. Η LIRA απαντά πάνω στα εξουσιοδοτημένα δεδομένα και σας οδηγεί στις πρωτογενείς εγγραφές.'}</span>
      <div className="lira-chat-suggestions">{prompts.map(x=><button key={x} onClick={()=>setQuestion(x)}>{x}</button>)}</div>
    </div>}

    {answer&&<div className="lira-conversation">
      <div className="lira-user-question"><span>{question}</span></div>
      <article className="lira-ai-response">
       <div className="lira-ai-avatar"><Sparkles size={16}/></div>
       <div className="lira-ai-content">
        <div className="lira-ai-response-head"><strong>{answer.title}</strong><small>{answer.subtitle}</small></div>
        <div className="lira-ai-points">{answer.points.length?answer.points.map((x,i)=><div key={i}><CheckCircle2 size={15}/><span>{x}</span></div>):<div><CheckCircle2 size={15}/><span>{en?'No relevant finding emerged from the available data.':'Δεν προέκυψε σχετικό εύρημα από τα διαθέσιμα δεδομένα.'}</span></div>}</div>
        {answer.links.length>0&&<div className="lira-ai-links">{answer.links.map(x=><Button key={x.to} variant="secondary" onClick={()=>navigate(x.to)}>{x.label}</Button>)}</div>}
        <div className="lira-ai-source-note">{en?'Source: Limoxis data available to the signed-in user. Verify each finding in the source module.':'Πηγή: δεδομένα Limoxis που είναι διαθέσιμα στον συνδεδεμένο χρήστη. Επιβεβαιώστε κάθε εύρημα στην πρωτογενή ενότητα.'}</div>
       </div>
      </article>
    </div>}
   </div>

   <div className="lira-chat-composer-wrap">
    <div className="lira-chat-composer">
     <textarea rows="1" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();onAsk()}}} placeholder={en?'Ask LIRA about Limoxis data...':'Ρωτήστε τη LIRA για τα δεδομένα του Limoxis...'}/>
     <Button onClick={onAsk}>{en?'Send':'Αποστολή'}</Button>
    </div>
    <div className="lira-chat-hint">{en?'Enter to send · Shift+Enter for a new line · LIRA does not replace clinical judgment.':'Enter για αποστολή · Shift+Enter για νέα γραμμή · Η LIRA δεν αντικαθιστά κλινική κρίση.'}</div>
   </div>
  </div>
 </section>
}

function buildAnalysis(data,language='el'){
 const en=language==='en'
 const {surveillance=[],laboratory=[],handHygiene=[],bundles=[],qualityIncidents=[],qualityCapas=[]}=data||{}
 const today=new Date().toISOString().slice(0,10)
 const active=surveillance.filter(x=>x.state==='active')
 const amrSurv=active.filter(x=>x.resistance)
 const criticalLab=laboratory.filter(x=>x.critical&&!(x.communications?.length))
 const amrLab=laboratory.filter(x=>x.resistance)
 const overdueReview=active.filter(x=>x.reviewDue&&String(x.reviewDue).slice(0,10)<today)
 const lowHand=handHygiene.filter(x=>Number(x.rate)<80)
 const failedBundles=bundles.filter(x=>x.allOrNone===false)
 const highIncidents=qualityIncidents.filter(x=>['high','critical'].includes(x.severity)&&x.status!=='closed')
 const overdueCapa=qualityCapas.filter(x=>x.status!=='completed'&&x.dueDate&&String(x.dueDate).slice(0,10)<today)
 const signals=[]
 const icu=en?'ICU':'ΜΕΘ'

 const icuAmr=amrSurv.filter(x=>String(x.department||'').toLocaleLowerCase('el-GR').includes('μεθ')||String(x.department||'').toLowerCase().includes('icu'))
 if(icuAmr.length>=2)signals.push({id:'amr-cluster',severity:'high',domain:en?'Surveillance / AMR':'Επιτήρηση / AMR',department:icu,title:en?'Cluster of active MDR/XDR surveillance in ICU':'Συσσώρευση ενεργών MDR/XDR επιτηρήσεων στη ΜΕΘ',summary:en?`${icuAmr.length} active surveillance records with resistance are present in ICU.`:`${icuAmr.length} ενεργές επιτηρήσεις με ανθεκτικότητα εμφανίζονται στη ΜΕΘ.`,evidence:en?'Active surveillance':'Ενεργές επιτηρήσεις',to:'/surveillance'})
 criticalLab.forEach(x=>signals.push({id:`critical-${x.resultId||x.id}`,severity:'critical',domain:en?'Laboratory':'Εργαστήριο',department:x.department,title:en?'Critical result without closed-loop communication':'Κρίσιμο αποτέλεσμα χωρίς κλειστό κύκλο επικοινωνίας',summary:`${x.patient} · ${x.organism||(en?'critical laboratory result':'κρίσιμο εργαστηριακό αποτέλεσμα')}`,evidence:x.id,to:`/laboratory/${x.id}`}))
 overdueReview.forEach(x=>signals.push({id:`review-${x.id}`,severity:'high',domain:en?'Surveillance':'Επιτήρηση',department:x.department,title:en?'Active surveillance reassessment is pending':'Εκκρεμεί επανεκτίμηση ενεργής επιτήρησης',summary:`${x.patient} · ${x.organism||(en?'no microorganism':'χωρίς μικροοργανισμό')}`,evidence:`Review ${String(x.reviewDue).slice(0,10)}`,to:`/surveillance/${x.id}`}))
 lowHand.forEach(x=>signals.push({id:`hh-${x.id}`,severity:x.rate<70?'high':'medium',domain:en?'Prevention':'Πρόληψη',department:en?(x.departmentEn||x.departmentEl):x.departmentEl,title:en?'Low hand-hygiene compliance':'Χαμηλή συμμόρφωση υγιεινής χεριών',summary:en?`Compliance was ${x.rate}% across ${x.observations} opportunities.`:`Καταγράφηκε συμμόρφωση ${x.rate}% σε ${x.observations} ευκαιρίες.`,evidence:x.id,to:'/prevention'}))
 failedBundles.forEach(x=>signals.push({id:`bundle-${x.id}`,severity:x.score<85?'high':'medium',domain:en?'Prevention bundles':'Bundles πρόληψης',department:en?(x.departmentEn||x.departmentEl):x.departmentEl,title:en?`Bundle ${x.bundle} without all-or-none compliance`:`Bundle ${x.bundle} χωρίς all-or-none συμμόρφωση`,summary:en?`Score ${x.score}% · ${x.failedCount} non-compliant item(s).`:`Βαθμολογία ${x.score}% · ${x.failedCount} μη συμμορφούμενο στοιχείο.`,evidence:x.id,to:'/prevention'}))
 highIncidents.forEach(x=>signals.push({id:`incident-${x.id}`,severity:x.severity==='critical'?'critical':'high',domain:en?'Quality':'Ποιότητα',department:x.department,title:en?'Open serious incident':'Ανοιχτό σοβαρό συμβάν',summary:x.title,evidence:x.id,to:`/quality/incidents/${x.id}`}))
 overdueCapa.forEach(x=>signals.push({id:`capa-${x.id}`,severity:x.priority==='high'?'high':'medium',domain:en?'Quality / CAPA':'Ποιότητα / CAPA',department:x.department,title:en?'Overdue corrective action':'Εκπρόθεσμη διορθωτική ενέργεια',summary:x.title,evidence:x.id,to:`/quality/capas/${x.id}`}))
 signals.sort((a,b)=>severityRank[b.severity]-severityRank[a.severity])

 const bundleRate=bundles.length?Math.round(bundles.filter(x=>x.allOrNone).length/bundles.length*100):0
 return {
  signals,
  highPriority:signals.filter(x=>['critical','high'].includes(x.severity)).length,
  activeSurveillance:active.length,
  amr:new Set([...amrSurv.map(x=>x.id),...amrLab.map(x=>x.resultId||x.id)]).size,
  bundleAllOrNone:bundleRate,
  domains:[
   {label:en?'Surveillance':'Επιτήρηση',value:en?`${active.length} active`:`${active.length} ενεργές`,note:`${amrSurv.length} ${en?'with':'με'} MDR/XDR/PDR`},
   {label:en?'Laboratory':'Εργαστήριο',value:en?`${laboratory.filter(x=>x.result==='positive').length} positive`:`${laboratory.filter(x=>x.result==='positive').length} θετικά`,note:en?`${criticalLab.length} critical without documented communication`:`${criticalLab.length} κρίσιμα χωρίς τεκμηριωμένη επικοινωνία`},
   {label:en?'Hand hygiene':'Υγιεινή χεριών',value:`${Math.round(handHygiene.reduce((sum,x)=>sum+Number(x.rate||0),0)/(handHygiene.length||1))}%`,note:en?'Average compliance across available sessions':'Μέση συμμόρφωση στις διαθέσιμες συνεδρίες'},
   {label:'Bundles',value:`${bundleRate}%`,note:en?'All-or-none across available executions':'All-or-none στις διαθέσιμες εκτελέσεις'},
   {label:en?'Quality':'Ποιότητα',value:en?`${highIncidents.length} serious open`:`${highIncidents.length} σοβαρά ανοικτά`,note:en?`${qualityCapas.filter(x=>x.status!=='completed').length} active CAPA`:`${qualityCapas.filter(x=>x.status!=='completed').length} ενεργές CAPA`}
  ],
  actions:[
   {title:en?'Reassess active MDR/XDR in ICU':'Επανεκτίμηση ενεργών MDR/XDR στη ΜΕΘ',text:en?'Review temporal/spatial correlation, isolation and microbiology data before considering a possible outbreak.':'Ελέγξτε χρονική/χωρική συσχέτιση, απομόνωση και μικροβιολογικά δεδομένα πριν θεωρηθεί πιθανή έξαρση.',to:'/surveillance'},
   {title:en?'Close critical communications':'Κλείσιμο κρίσιμων επικοινωνιών',text:en?'Critical laboratory results require documented closed-loop communication.':'Τα κρίσιμα εργαστηριακά αποτελέσματα χρειάζονται τεκμηριωμένο closed-loop communication.',to:'/laboratory'},
   {title:en?'Targeted hand-hygiene observation':'Στοχευμένη παρατήρηση υγιεινής χεριών',text:en?'Low-compliance sessions require additional observations before drawing a reliable conclusion.':'Οι χαμηλές συνεδρίες συμμόρφωσης χρειάζονται περισσότερες παρατηρήσεις πριν εξαχθεί ασφαλές συμπέρασμα.',to:'/prevention'}
  ]
 }
}

function answerQuestion(q,analysis,language='el'){
 const en=language==='en'
 const text=q.toLowerCase()
 const sev=severityLabels[language]
 const isIcu=text.includes('μεθ')||text.includes('icu')
 if(isIcu)return {title:en?'ICU picture':'Εικόνα ΜΕΘ',subtitle:en?'Synthesis from surveillance, prevention, laboratory and quality.':'Σύνθεση από επιτήρηση, πρόληψη, εργαστήριο και ποιότητα.',points:analysis.signals.filter(x=>String(x.department||'').toLocaleLowerCase('el-GR').includes('μεθ')||String(x.department||'').toLowerCase().includes('icu')).slice(0,6).map(x=>`${sev[x.severity]}: ${x.title} — ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'},{label:en?'Prevention':'Πρόληψη',to:'/prevention'}]}
 if(text.includes('mdr')||text.includes('xdr')||text.includes('ανθεκ')||text.includes('resistan'))return {title:'AMR / MDR-XDR',subtitle:en?'An outbreak is not characterized without epidemiological confirmation.':'Δεν χαρακτηρίζεται έξαρση χωρίς επιδημιολογική επιβεβαίωση.',points:[en?`There are ${analysis.amr} records flagged for resistance in the available data.`:`Υπάρχουν ${analysis.amr} εγγραφές με σήμανση ανθεκτικότητας στα διαθέσιμα δεδομένα.`,...analysis.signals.filter(x=>x.domain.includes('AMR')||x.summary.includes('MDR')||x.summary.includes('XDR')).map(x=>x.summary)],links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'}]}
 if(text.includes('υγιει')||text.includes('συμμόρφ')||text.includes('πρόλη')||text.includes('hygiene')||text.includes('compliance')||text.includes('prevention'))return {title:en?'Prevention compliance':'Συμμόρφωση πρόληψης',subtitle:en?'Signals from WHO hand hygiene and bundle executions.':'Σήματα από WHO hand hygiene και bundle executions.',points:analysis.signals.filter(x=>x.domain==='Πρόληψη'||x.domain==='Prevention'||x.domain.includes('Bundle')||x.domain.includes('bundle')).map(x=>`${x.title}: ${x.summary}`),links:[{label:en?'Prevention':'Πρόληψη',to:'/prevention'}]}
 if(text.includes('εκπρόθεσ')||text.includes('overdue'))return {title:en?'Overdue actions':'Εκπρόθεσμες ενέργειες',subtitle:en?'Surveillance reviews and corrective actions requiring follow-up.':'Επιτηρήσεις και διορθωτικές ενέργειες που απαιτούν follow-up.',points:analysis.signals.filter(x=>x.title.includes('Εκκρεμεί')||x.title.includes('Εκπρόθεσμη')||x.title.includes('pending')||x.title.includes('Overdue')).map(x=>`${x.title}: ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Quality':'Ποιότητα',to:'/quality'}]}
 return {title:en?'Immediate priorities':'Άμεσες προτεραιότητες',subtitle:en?'Highest-priority signals based on available data.':'Τα υψηλότερης προτεραιότητας σήματα με βάση τα διαθέσιμα δεδομένα.',points:analysis.signals.slice(0,5).map(x=>`${sev[x.severity]} — ${x.title}: ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'},{label:en?'Prevention':'Πρόληψη',to:'/prevention'},{label:en?'Quality':'Ποιότητα',to:'/quality'}]}
}
