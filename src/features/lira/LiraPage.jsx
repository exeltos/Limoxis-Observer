import { useMemo,useState } from 'react'
import { BrainCircuit,CheckCircle2,Lightbulb,Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { handHygieneRows,bundleRows } from '../prevention/preventionDemoData'
import { qualityIncidents,qualityCapas } from '../quality/qualityDemoData'
import { useLanguage } from '../../core/i18n/LanguageContext'

const severityLabels={el:{critical:'Κρίσιμο',high:'Υψηλό',medium:'Μέτριο',low:'Χαμηλό'},en:{critical:'Critical',high:'High',medium:'Medium',low:'Low'}}
const severityRank={critical:4,high:3,medium:2,low:1}

export function LiraPage(){
 const navigate=useNavigate()
 const {language}=useLanguage();const en=language==='en'
 const [tab,setTab]=useState('assistant')
 const [question,setQuestion]=useState(en?'Where is immediate attention needed today?':'Πού χρειάζεται άμεση προσοχή σήμερα;')
 const [answer,setAnswer]=useState(null)

 const analysis=useMemo(()=>buildAnalysis(language),[language])

 function ask(){
   const q=question.trim()
   if(!q)return
   setAnswer(answerQuestion(q,analysis,language))
 }

 return <Page fill title="LIRA AI" subtitle={en?'Unified operational view of risk, trends and actions for infection prevention.':'Ενιαία επιχειρησιακή εικόνα κινδύνου, τάσεων και ενεργειών για την πρόληψη λοιμώξεων.'}>
  <div className="lira-safety-note"><BrainCircuit size={17}/><div><strong>{en?'Decision support — not autonomous clinical decision-making':'Υποστήριξη απόφασης — όχι αυτόνομη κλινική απόφαση'}</strong><span>{en?'LIRA synthesizes data already available in Limoxis and highlights patterns for verification by an authorized professional. In the local/demo environment, analysis is rule-based rather than external generative AI.':'Η LIRA συνθέτει δεδομένα που υπάρχουν ήδη στο Limoxis και επισημαίνει μοτίβα προς επαλήθευση από αρμόδιο επαγγελματία. Στο τοπικό/demo περιβάλλον η ανάλυση είναι κανόνων και όχι εξωτερικό generative AI.'}</span></div></div>

  <nav className="tabs canonical-module-tabs lira-tabs" aria-label="LIRA">
   <button className={`tab ${tab==='assistant'?'active':''}`} onClick={()=>setTab('assistant')}><Sparkles size={15}/>{en?'Ask LIRA':'Ρώτησε τη LIRA'}</button>
   <button className={`tab ${tab==='briefing'?'active':''}`} onClick={()=>setTab('briefing')}><BrainCircuit size={15}/>LIRA Briefing<b className="tab-count">{analysis.highPriority}</b></button>
  </nav>

  {tab==='assistant'&&<Assistant language={language} question={question} setQuestion={setQuestion} onAsk={ask} answer={answer} analysis={analysis} navigate={navigate}/>}
  {tab==='briefing'&&<Briefing language={language} analysis={analysis} navigate={navigate}/>}
 </Page>
}

function Briefing({analysis,navigate,language}){
 const en=language==='en';const sev=severityLabels[language]
 const priority=analysis.signals.slice(0,5)
 return <section className="lira-briefing-shell">
  <header className="lira-briefing-header"><div><span className="lira-eyebrow">LIRA BRIEFING</span><h2>{en?'What needs your attention':'Τι χρειάζεται την προσοχή σας'}</h2><p>{en?'Concise synthesis of available Limoxis data. Select a finding to verify it in the source module.':'Συνοπτική σύνθεση των διαθέσιμων δεδομένων του Limoxis. Επιλέξτε ένα εύρημα για έλεγχο στην πρωτογενή ενότητα.'}</p></div><div className="lira-briefing-date">{en?'Today':'Σήμερα'}</div></header>
  <div className="lira-briefing-layout">
   <section className="surface lira-focus-panel"><div className="lira-section-head"><div><strong>{en?'Priorities':'Προτεραιότητες'}</strong><span>{analysis.highPriority} {en?'high priority':'υψηλής προτεραιότητας'}</span></div></div><div className="lira-focus-list">{priority.map((x,i)=><article key={x.id} className="lira-focus-item"><div className={`lira-priority-index ${x.severity}`}>{i+1}</div><div className="lira-focus-copy"><div><strong>{x.title}</strong><span className={`lira-severity-text ${x.severity}`}>{sev[x.severity]}</span></div><p>{x.summary}</p><small>{x.domain}{x.department?` · ${x.department}`:''} · {x.evidence}</small></div>{x.to&&<button className="lira-open-link" onClick={()=>navigate(x.to)}>{en?'Review →':'Έλεγχος →'}</button>}</article>)}</div></section>
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
      <span>{en?'Ask about surveillance, laboratory, prevention, quality or trends. LIRA answers from available data and guides you to the source records.':'Ρωτήστε για επιτήρηση, εργαστήριο, πρόληψη, ποιότητα ή τάσεις. Η LIRA απαντά πάνω στα διαθέσιμα δεδομένα και σας οδηγεί στις πρωτογενείς εγγραφές.'}</span>
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

function buildAnalysis(language='el'){
 const en=language==='en'
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
 const icu=en?'ICU':'ΜΕΘ'

 if(amrSurv.length>=2)signals.push({id:'amr-cluster',severity:'high',domain:en?'Surveillance / AMR':'Επιτήρηση / AMR',department:icu,title:en?'Cluster of active MDR/XDR surveillance in ICU':'Συσσώρευση ενεργών MDR/XDR επιτηρήσεων στη ΜΕΘ',summary:en?`${amrSurv.filter(x=>x.department==='ΜΕΘ').length} active surveillance records with resistance are present in ICU.`:`${amrSurv.filter(x=>x.department==='ΜΕΘ').length} ενεργές επιτηρήσεις με ανθεκτικότητα εμφανίζονται στη ΜΕΘ.`,evidence:en?'Active surveillance':'Ενεργές επιτηρήσεις',to:'/surveillance'})
 criticalLab.forEach(x=>signals.push({id:`critical-${x.id}`,severity:'critical',domain:en?'Laboratory':'Εργαστήριο',department:x.department,title:en?'Critical result without closed-loop communication':'Κρίσιμο αποτέλεσμα χωρίς κλειστό κύκλο επικοινωνίας',summary:`${x.patient} · ${x.organism||(en?'critical laboratory result':'κρίσιμο εργαστηριακό αποτέλεσμα')}`,evidence:x.id,to:`/laboratory/${x.id}`}))
 overdueReview.forEach(x=>signals.push({id:`review-${x.id}`,severity:'high',domain:en?'Surveillance':'Επιτήρηση',department:x.department,title:en?'Active surveillance reassessment is pending':'Εκκρεμεί επανεκτίμηση ενεργής επιτήρησης',summary:`${x.patient} · ${x.organism||(en?'no microorganism':'χωρίς μικροοργανισμό')}`,evidence:`Review ${x.reviewDue}`,to:`/surveillance/${x.id}`}))
 lowHand.forEach(x=>signals.push({id:`hh-${x.id}`,severity:x.rate<70?'high':'medium',domain:en?'Prevention':'Πρόληψη',department:en?(x.departmentEn||x.departmentEl):x.departmentEl,title:en?'Low hand-hygiene compliance':'Χαμηλή συμμόρφωση υγιεινής χεριών',summary:en?`Compliance was ${x.rate}% across ${x.observations} opportunities.`:`Καταγράφηκε συμμόρφωση ${x.rate}% σε ${x.observations} ευκαιρίες.`,evidence:x.id,to:'/prevention'}))
 failedBundles.forEach(x=>signals.push({id:`bundle-${x.id}`,severity:x.score<85?'high':'medium',domain:en?'Prevention bundles':'Bundles πρόληψης',department:en?(x.departmentEn||x.departmentEl):x.departmentEl,title:en?`Bundle ${x.bundle} without all-or-none compliance`:`Bundle ${x.bundle} χωρίς all-or-none συμμόρφωση`,summary:en?`Score ${x.score}% · ${x.failedCount} non-compliant item(s).`:`Βαθμολογία ${x.score}% · ${x.failedCount} μη συμμορφούμενο στοιχείο.`,evidence:x.id,to:'/prevention'}))
 highIncidents.forEach(x=>signals.push({id:`incident-${x.id}`,severity:'high',domain:en?'Quality':'Ποιότητα',department:x.department,title:en?'Open serious incident':'Ανοιχτό σοβαρό συμβάν',summary:x.title,evidence:x.id,to:`/quality/incidents/${x.id}`}))
 overdueCapa.forEach(x=>signals.push({id:`capa-${x.id}`,severity:'medium',domain:en?'Quality / CAPA':'Ποιότητα / CAPA',department:x.department,title:en?'Overdue corrective action':'Εκπρόθεσμη διορθωτική ενέργεια',summary:x.title,evidence:x.id,to:`/quality/capas/${x.id}`}))
 signals.sort((a,b)=>severityRank[b.severity]-severityRank[a.severity])

 const bundleRate=bundleRows.length?Math.round(bundleRows.filter(x=>x.allOrNone).length/bundleRows.length*100):0
 return {
  signals,
  highPriority:signals.filter(x=>['critical','high'].includes(x.severity)).length,
  activeSurveillance:active.length,
  amr:new Set([...amrSurv.map(x=>x.id),...amrLab.map(x=>x.id)]).size,
  bundleAllOrNone:bundleRate,
  domains:[
   {label:en?'Surveillance':'Επιτήρηση',value:en?`${active.length} active`:`${active.length} ενεργές`,note:`${amrSurv.length} ${en?'with':'με'} MDR/XDR/PDR`},
   {label:en?'Laboratory':'Εργαστήριο',value:en?`${laboratorySamples.filter(x=>x.result==='positive').length} positive`:`${laboratorySamples.filter(x=>x.result==='positive').length} θετικά`,note:en?`${criticalLab.length} critical without documented communication`:`${criticalLab.length} κρίσιμα χωρίς τεκμηριωμένη επικοινωνία`},
   {label:en?'Hand hygiene':'Υγιεινή χεριών',value:`${Math.round(handHygieneRows.reduce((sum,x)=>sum+x.rate,0)/(handHygieneRows.length||1))}%`,note:en?'Average compliance across available sessions':'Μέση συμμόρφωση στις διαθέσιμες συνεδρίες'},
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
 if(isIcu)return {title:en?'ICU picture':'Εικόνα ΜΕΘ',subtitle:en?'Synthesis from surveillance, prevention, laboratory and quality.':'Σύνθεση από επιτήρηση, πρόληψη, εργαστήριο και ποιότητα.',points:analysis.signals.filter(x=>x.department==='ΜΕΘ'||x.department==='ICU').slice(0,6).map(x=>`${sev[x.severity]}: ${x.title} — ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'},{label:en?'Prevention':'Πρόληψη',to:'/prevention'}]}
 if(text.includes('mdr')||text.includes('xdr')||text.includes('ανθεκ')||text.includes('resistan'))return {title:'AMR / MDR-XDR',subtitle:en?'An outbreak is not characterized without epidemiological confirmation.':'Δεν χαρακτηρίζεται έξαρση χωρίς επιδημιολογική επιβεβαίωση.',points:[en?`There are ${analysis.amr} records flagged for resistance in the available data.`:`Υπάρχουν ${analysis.amr} εγγραφές με σήμανση ανθεκτικότητας στα διαθέσιμα δεδομένα.`,...analysis.signals.filter(x=>x.domain.includes('AMR')||x.summary.includes('MDR')||x.summary.includes('XDR')).map(x=>x.summary)],links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'}]}
 if(text.includes('υγιει')||text.includes('συμμόρφ')||text.includes('πρόλη')||text.includes('hygiene')||text.includes('compliance')||text.includes('prevention'))return {title:en?'Prevention compliance':'Συμμόρφωση πρόληψης',subtitle:en?'Signals from WHO hand hygiene and bundle executions.':'Σήματα από WHO hand hygiene και bundle executions.',points:analysis.signals.filter(x=>x.domain==='Πρόληψη'||x.domain==='Prevention'||x.domain.includes('Bundle')||x.domain.includes('bundle')).map(x=>`${x.title}: ${x.summary}`),links:[{label:en?'Prevention':'Πρόληψη',to:'/prevention'}]}
 if(text.includes('εκπρόθεσ')||text.includes('overdue'))return {title:en?'Overdue actions':'Εκπρόθεσμες ενέργειες',subtitle:en?'Surveillance reviews and corrective actions requiring follow-up.':'Επιτηρήσεις και διορθωτικές ενέργειες που απαιτούν follow-up.',points:analysis.signals.filter(x=>x.title.includes('Εκκρεμεί')||x.title.includes('Εκπρόθεσμη')||x.title.includes('pending')||x.title.includes('Overdue')).map(x=>`${x.title}: ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Quality':'Ποιότητα',to:'/quality'}]}
 return {title:en?'Immediate priorities':'Άμεσες προτεραιότητες',subtitle:en?'Highest-priority signals based on available data.':'Τα υψηλότερης προτεραιότητας σήματα με βάση τα διαθέσιμα δεδομένα.',points:analysis.signals.slice(0,5).map(x=>`${sev[x.severity]} — ${x.title}: ${x.summary}`),links:[{label:en?'Surveillance':'Επιτήρηση',to:'/surveillance'},{label:en?'Laboratory':'Εργαστήριο',to:'/laboratory'},{label:en?'Prevention':'Πρόληψη',to:'/prevention'},{label:en?'Quality':'Ποιότητα',to:'/quality'}]}
}
