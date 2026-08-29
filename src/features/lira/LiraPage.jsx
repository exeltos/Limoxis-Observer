import { useMemo,useState } from 'react'
import { BrainCircuit,CheckCircle2,Lightbulb,Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { handHygieneRows,bundleRows } from '../prevention/preventionDemoData'
import { qualityIncidents,qualityCapas } from '../quality/qualityDemoData'

const severityLabels={critical:'Κρίσιμο',high:'Υψηλό',medium:'Μέτριο',low:'Χαμηλό'}
const severityRank={critical:4,high:3,medium:2,low:1}

export function LiraPage(){
 const navigate=useNavigate()
 const [tab,setTab]=useState('assistant')
 const [question,setQuestion]=useState('Πού χρειάζεται άμεση προσοχή σήμερα;')
 const [answer,setAnswer]=useState(null)

 const analysis=useMemo(()=>buildAnalysis(),[])

 function ask(){
   const q=question.trim()
   if(!q)return
   setAnswer(answerQuestion(q,analysis))
 }

 return <Page fill title="LIRA AI" subtitle="Ενιαία επιχειρησιακή εικόνα κινδύνου, τάσεων και ενεργειών για την πρόληψη λοιμώξεων.">
  <div className="lira-safety-note"><BrainCircuit size={17}/><div><strong>Υποστήριξη απόφασης — όχι αυτόνομη κλινική απόφαση</strong><span>Η LIRA συνθέτει δεδομένα που υπάρχουν ήδη στο Limoxis και επισημαίνει μοτίβα προς επαλήθευση από αρμόδιο επαγγελματία. Στο τοπικό/demo περιβάλλον η ανάλυση είναι κανόνων και όχι εξωτερικό generative AI.</span></div></div>

  <nav className="tabs canonical-module-tabs lira-tabs" aria-label="LIRA">
   <button className={`tab ${tab==='assistant'?'active':''}`} onClick={()=>setTab('assistant')}><Sparkles size={15}/>Ρώτησε τη LIRA</button>
   <button className={`tab ${tab==='briefing'?'active':''}`} onClick={()=>setTab('briefing')}><BrainCircuit size={15}/>LIRA Briefing<b className="tab-count">{analysis.highPriority}</b></button>
  </nav>

  {tab==='assistant'&&<Assistant question={question} setQuestion={setQuestion} onAsk={ask} answer={answer} analysis={analysis} navigate={navigate}/>}
  {tab==='briefing'&&<Briefing analysis={analysis} navigate={navigate}/>}
 </Page>
}

function Briefing({analysis,navigate}){
 const priority=analysis.signals.slice(0,5)
 return <section className="lira-briefing-shell">
  <header className="lira-briefing-header"><div><span className="lira-eyebrow">LIRA BRIEFING</span><h2>Τι χρειάζεται την προσοχή σας</h2><p>Συνοπτική σύνθεση των διαθέσιμων δεδομένων του Limoxis. Επιλέξτε ένα εύρημα για έλεγχο στην πρωτογενή ενότητα.</p></div><div className="lira-briefing-date">Σήμερα</div></header>
  <div className="lira-briefing-layout">
   <section className="surface lira-focus-panel"><div className="lira-section-head"><div><strong>Προτεραιότητες</strong><span>{analysis.highPriority} υψηλής προτεραιότητας</span></div></div><div className="lira-focus-list">{priority.map((x,i)=><article key={x.id} className="lira-focus-item"><div className={`lira-priority-index ${x.severity}`}>{i+1}</div><div className="lira-focus-copy"><div><strong>{x.title}</strong><span className={`lira-severity-text ${x.severity}`}>{severityLabels[x.severity]}</span></div><p>{x.summary}</p><small>{x.domain}{x.department?` · ${x.department}`:''} · {x.evidence}</small></div>{x.to&&<button className="lira-open-link" onClick={()=>navigate(x.to)}>Έλεγχος →</button>}</article>)}</div></section>
   <aside className="lira-briefing-side">
    <section className="surface lira-pulse-panel"><div className="lira-section-head"><div><strong>Σημερινή εικόνα</strong><span>Βασικά σημεία</span></div></div><div className="lira-pulse-list"><Pulse label="Ενεργές επιτηρήσεις" value={analysis.activeSurveillance} note={`${analysis.amr} εγγραφές με AMR σήμανση`}/><Pulse label="Bundle all-or-none" value={`${analysis.bundleAllOrNone}%`} note="Στις διαθέσιμες εκτελέσεις"/><Pulse label="Υψηλές προτεραιότητες" value={analysis.highPriority} note="Απαιτούν αξιολόγηση"/></div></section>
    <section className="surface lira-watch-panel"><div className="lira-section-head"><div><strong>Παρακολούθηση</strong><span>Σύνθεση ανά τομέα</span></div></div><div className="lira-watch-list">{analysis.domains.slice(0,4).map(x=><div key={x.label}><span>{x.label}</span><strong>{x.value}</strong><small>{x.note}</small></div>)}</div></section>
   </aside>
  </div>
  <section className="surface lira-next-panel"><div className="lira-section-head"><div><strong>Προτεινόμενοι έλεγχοι</strong><span>Για αξιολόγηση από τον αρμόδιο επαγγελματία</span></div></div><div className="lira-next-list">{analysis.actions.map((x,i)=><article key={i}><div><Lightbulb size={15}/></div><section><strong>{x.title}</strong><p>{x.text}</p></section>{x.to&&<button className="lira-open-link" onClick={()=>navigate(x.to)}>Άνοιγμα →</button>}</article>)}</div></section>
 </section>
}
function Pulse({label,value,note}){return <div className="lira-pulse-row"><div><span>{label}</span><small>{note}</small></div><strong>{value}</strong></div>}

function Assistant({question,setQuestion,onAsk,answer,navigate}){
 const prompts=['Πού χρειάζεται άμεση προσοχή σήμερα;','Τι συμβαίνει στη ΜΕΘ;','Υπάρχει θέμα με MDR/XDR;','Πού έχουμε χαμηλή συμμόρφωση πρόληψης;','Ποιες ενέργειες είναι εκπρόθεσμες;']
 return <section className="lira-chat-shell">
  <div className="lira-chat-main">
   <div className="lira-chat-scroll">
    {!answer&&<div className="lira-chat-welcome">
      <div className="lira-chat-mark"><BrainCircuit size={26}/></div>
      <strong>Τι θέλετε να μάθετε από τα δεδομένα του Limoxis;</strong>
      <span>Ρωτήστε για επιτήρηση, εργαστήριο, πρόληψη, ποιότητα ή τάσεις. Η LIRA απαντά πάνω στα διαθέσιμα δεδομένα και σας οδηγεί στις πρωτογενείς εγγραφές.</span>
      <div className="lira-chat-suggestions">{prompts.map(x=><button key={x} onClick={()=>setQuestion(x)}>{x}</button>)}</div>
    </div>}

    {answer&&<div className="lira-conversation">
      <div className="lira-user-question"><span>{question}</span></div>
      <article className="lira-ai-response">
       <div className="lira-ai-avatar"><Sparkles size={16}/></div>
       <div className="lira-ai-content">
        <div className="lira-ai-response-head"><strong>{answer.title}</strong><small>{answer.subtitle}</small></div>
        <div className="lira-ai-points">{answer.points.length?answer.points.map((x,i)=><div key={i}><CheckCircle2 size={15}/><span>{x}</span></div>):<div><CheckCircle2 size={15}/><span>Δεν προέκυψε σχετικό εύρημα από τα διαθέσιμα δεδομένα.</span></div>}</div>
        {answer.links.length>0&&<div className="lira-ai-links">{answer.links.map(x=><Button key={x.to} variant="secondary" onClick={()=>navigate(x.to)}>{x.label}</Button>)}</div>}
        <div className="lira-ai-source-note">Πηγή: δεδομένα Limoxis που είναι διαθέσιμα στον συνδεδεμένο χρήστη. Επιβεβαιώστε κάθε εύρημα στην πρωτογενή ενότητα.</div>
       </div>
      </article>
    </div>}
   </div>

   <div className="lira-chat-composer-wrap">
    <div className="lira-chat-composer">
     <textarea rows="1" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();onAsk()}}} placeholder="Ρωτήστε τη LIRA για τα δεδομένα του Limoxis..."/>
     <Button onClick={onAsk}>Αποστολή</Button>
    </div>
    <div className="lira-chat-hint">Enter για αποστολή · Shift+Enter για νέα γραμμή · Η LIRA δεν αντικαθιστά κλινική κρίση.</div>
   </div>
  </div>
 </section>
}

function buildAnalysis(){
 const active=surveillanceDemoData.filter(x=>x.state==='active')
 const amrSurv=active.filter(x=>x.resistance)
 const criticalLab=laboratorySamples.filter(x=>x.critical&&!(x.communications?.length))
 const amrLab=laboratorySamples.filter(x=>x.resistance)
 const overdueReview=active.filter(x=>x.reviewDue&&x.reviewDue<'2026-08-29')
 const lowHand=handHygieneRows.filter(x=>Number(x.rate)<80)
 const failedBundles=bundleRows.filter(x=>x.allOrNone===false)
 const highIncidents=qualityIncidents.filter(x=>x.severity==='high'&&x.status!=='closed')
 const overdueCapa=qualityCapas.filter(x=>x.status!=='completed'&&x.dueDate&&x.dueDate<'2026-08-29')
 const signals=[]

 if(amrSurv.length>=2)signals.push({id:'amr-cluster',severity:'high',domain:'Επιτήρηση / AMR',department:'ΜΕΘ',title:'Συσσώρευση ενεργών MDR/XDR επιτηρήσεων στη ΜΕΘ',summary:`${amrSurv.filter(x=>x.department==='ΜΕΘ').length} ενεργές επιτηρήσεις με ανθεκτικότητα εμφανίζονται στη ΜΕΘ.`,evidence:'Ενεργές επιτηρήσεις',to:'/surveillance'})
 criticalLab.forEach(x=>signals.push({id:`critical-${x.id}`,severity:'critical',domain:'Εργαστήριο',department:x.department,title:'Κρίσιμο αποτέλεσμα χωρίς κλειστό κύκλο επικοινωνίας',summary:`${x.patient} · ${x.organism||'κρίσιμο εργαστηριακό αποτέλεσμα'}`,evidence:x.id,to:`/laboratory/${x.id}`}))
 overdueReview.forEach(x=>signals.push({id:`review-${x.id}`,severity:'high',domain:'Επιτήρηση',department:x.department,title:'Εκκρεμεί επανεκτίμηση ενεργής επιτήρησης',summary:`${x.patient} · ${x.organism||'χωρίς μικροοργανισμό'}`,evidence:`Review ${x.reviewDue}`,to:`/surveillance/${x.id}`}))
 lowHand.forEach(x=>signals.push({id:`hh-${x.id}`,severity:x.rate<70?'high':'medium',domain:'Πρόληψη',department:x.departmentEl,title:'Χαμηλή συμμόρφωση υγιεινής χεριών',summary:`Καταγράφηκε συμμόρφωση ${x.rate}% σε ${x.observations} ευκαιρίες.`,evidence:x.id,to:'/prevention'}))
 failedBundles.forEach(x=>signals.push({id:`bundle-${x.id}`,severity:x.score<85?'high':'medium',domain:'Bundles πρόληψης',department:x.departmentEl,title:`Bundle ${x.bundle} χωρίς all-or-none συμμόρφωση`,summary:`Βαθμολογία ${x.score}% · ${x.failedCount} μη συμμορφούμενο στοιχείο.`,evidence:x.id,to:'/prevention'}))
 highIncidents.forEach(x=>signals.push({id:`incident-${x.id}`,severity:'high',domain:'Ποιότητα',department:x.department,title:'Ανοιχτό σοβαρό συμβάν',summary:x.title,evidence:x.id,to:`/quality/incidents/${x.id}`}))
 overdueCapa.forEach(x=>signals.push({id:`capa-${x.id}`,severity:'medium',domain:'Ποιότητα / CAPA',department:x.department,title:'Εκπρόθεσμη διορθωτική ενέργεια',summary:x.title,evidence:x.id,to:`/quality/capas/${x.id}`}))
 signals.sort((a,b)=>severityRank[b.severity]-severityRank[a.severity])

 const bundleRate=bundleRows.length?Math.round(bundleRows.filter(x=>x.allOrNone).length/bundleRows.length*100):0
 return {
  signals,
  highPriority:signals.filter(x=>['critical','high'].includes(x.severity)).length,
  activeSurveillance:active.length,
  amr:new Set([...amrSurv.map(x=>x.id),...amrLab.map(x=>x.id)]).size,
  bundleAllOrNone:bundleRate,
  domains:[
   {label:'Επιτήρηση',value:`${active.length} ενεργές`,note:`${amrSurv.length} με MDR/XDR/PDR`},
   {label:'Εργαστήριο',value:`${laboratorySamples.filter(x=>x.result==='positive').length} θετικά`,note:`${criticalLab.length} κρίσιμα χωρίς τεκμηριωμένη επικοινωνία`},
   {label:'Υγιεινή χεριών',value:`${Math.round(handHygieneRows.reduce((s,x)=>s+x.rate,0)/(handHygieneRows.length||1))}%`,note:'Μέση συμμόρφωση στις διαθέσιμες συνεδρίες'},
   {label:'Bundles',value:`${bundleRate}%`,note:'All-or-none στις διαθέσιμες εκτελέσεις'},
   {label:'Ποιότητα',value:`${highIncidents.length} σοβαρά ανοικτά`,note:`${qualityCapas.filter(x=>x.status!=='completed').length} ενεργές CAPA`}
  ],
  actions:[
   {title:'Επανεκτίμηση ενεργών MDR/XDR στη ΜΕΘ',text:'Ελέγξτε χρονική/χωρική συσχέτιση, απομόνωση και μικροβιολογικά δεδομένα πριν θεωρηθεί πιθανή έξαρση.',to:'/surveillance'},
   {title:'Κλείσιμο κρίσιμων επικοινωνιών',text:'Τα κρίσιμα εργαστηριακά αποτελέσματα χρειάζονται τεκμηριωμένο closed-loop communication.',to:'/laboratory'},
   {title:'Στοχευμένη παρατήρηση υγιεινής χεριών',text:'Οι χαμηλές συνεδρίες συμμόρφωσης χρειάζονται περισσότερες παρατηρήσεις πριν εξαχθεί ασφαλές συμπέρασμα.',to:'/prevention'}
  ]
 }
}

function answerQuestion(q,analysis){
 const text=q.toLowerCase()
 if(text.includes('μεθ'))return {title:'Εικόνα ΜΕΘ',subtitle:'Σύνθεση από επιτήρηση, πρόληψη, εργαστήριο και ποιότητα.',points:analysis.signals.filter(x=>x.department==='ΜΕΘ').slice(0,6).map(x=>`${severityLabels[x.severity]}: ${x.title} — ${x.summary}`),links:[{label:'Επιτήρηση',to:'/surveillance'},{label:'Εργαστήριο',to:'/laboratory'},{label:'Πρόληψη',to:'/prevention'}]}
 if(text.includes('mdr')||text.includes('xdr')||text.includes('ανθεκ'))return {title:'AMR / MDR-XDR',subtitle:'Δεν χαρακτηρίζεται έξαρση χωρίς επιδημιολογική επιβεβαίωση.',points:[`Υπάρχουν ${analysis.amr} εγγραφές με σήμανση ανθεκτικότητας στα διαθέσιμα δεδομένα.`,...analysis.signals.filter(x=>x.domain.includes('AMR')||x.summary.includes('MDR')||x.summary.includes('XDR')).map(x=>x.summary)],links:[{label:'Επιτήρηση',to:'/surveillance'},{label:'Εργαστήριο',to:'/laboratory'}]}
 if(text.includes('υγιει')||text.includes('συμμόρφ')||text.includes('πρόλη'))return {title:'Συμμόρφωση πρόληψης',subtitle:'Σήματα από WHO hand hygiene και bundle executions.',points:analysis.signals.filter(x=>x.domain==='Πρόληψη'||x.domain.includes('Bundle')).map(x=>`${x.title}: ${x.summary}`),links:[{label:'Πρόληψη',to:'/prevention'}]}
 if(text.includes('εκπρόθεσ'))return {title:'Εκπρόθεσμες ενέργειες',subtitle:'Επιτηρήσεις και διορθωτικές ενέργειες που απαιτούν follow-up.',points:analysis.signals.filter(x=>x.title.includes('Εκκρεμεί')||x.title.includes('Εκπρόθεσμη')).map(x=>`${x.title}: ${x.summary}`),links:[{label:'Επιτήρηση',to:'/surveillance'},{label:'Ποιότητα',to:'/quality'}]}
 return {title:'Άμεσες προτεραιότητες',subtitle:'Τα υψηλότερης προτεραιότητας σήματα με βάση τα διαθέσιμα δεδομένα.',points:analysis.signals.slice(0,5).map(x=>`${severityLabels[x.severity]} — ${x.title}: ${x.summary}`),links:[{label:'Επιτήρηση',to:'/surveillance'},{label:'Εργαστήριο',to:'/laboratory'},{label:'Πρόληψη',to:'/prevention'},{label:'Ποιότητα',to:'/quality'}]}
}
