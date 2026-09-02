const severityRank={critical:4,high:3,medium:2,low:1}

export const LIRA_PERIODS=Object.freeze({DAYS_7:7,DAYS_30:30,DAYS_90:90,ALL:0})

const dateOf=(row)=>row?.signalDate||row?.resultedAt||row?.collectedAt||row?.date||row?.startedAt||row?.dueDate||null
const day=(value)=>value?String(value).slice(0,10):null
const inPeriod=(value,days,today)=>{
  if(!days||!value)return true
  const end=new Date(`${today}T23:59:59`)
  const start=new Date(end);start.setDate(start.getDate()-(days-1));start.setHours(0,0,0,0)
  const current=new Date(value)
  return Number.isFinite(current.getTime())&&current>=start&&current<=end
}
const departmentOf=(row,language)=>language==='en'?(row.departmentEn||row.departmentEl||row.department):(row.departmentEl||row.departmentEn||row.department)
const normalize=(value)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR')

export function filterLiraData(data,{department='all',periodDays=0,language='el',today=new Date().toISOString().slice(0,10)}={}){
  if(!data)return data
  const filterRows=(rows=[])=>rows.filter(row=>(department==='all'||departmentOf(row,language)===department)&&inPeriod(dateOf(row),periodDays,today))
  return {...data,surveillance:filterRows(data.surveillance),laboratory:filterRows(data.laboratory),handHygiene:filterRows(data.handHygiene),bundles:filterRows(data.bundles),qualityIncidents:filterRows(data.qualityIncidents),qualityCapas:filterRows(data.qualityCapas)}
}

export function liraDepartments(data,language='el'){
  const values=new Set()
  for(const key of ['surveillance','laboratory','handHygiene','bundles','qualityIncidents','qualityCapas'])for(const row of data?.[key]||[]){const value=departmentOf(row,language);if(value&&value!=='—')values.add(value)}
  return [...values].sort((a,b)=>a.localeCompare(b,language==='en'?'en':'el'))
}

export function inferLiraQuestionScope(question,data,language='el'){
  const text=normalize(question)
  let periodDays=0
  if(/\b(σημερα|today)\b/.test(text))periodDays=1
  else if(/\b(τελευταιες?\s*7|7\s*ημερ|last\s*7|past\s*7|week|εβδομαδ)/.test(text))periodDays=7
  else if(/\b(τελευταιες?\s*30|30\s*ημερ|last\s*30|past\s*30|μηνα|month)/.test(text))periodDays=30
  else if(/\b(τελευταιες?\s*90|90\s*ημερ|last\s*90|past\s*90|τριμην|quarter)/.test(text))periodDays=90

  let department='all'
  const departments=liraDepartments(data,language)
  const aliases=[['ΜΕΘ',['μεθ','icu','intensive care']],['Μονάδα Εντατικής Θεραπείας',['μοναδα εντατικης','εντατικη']]]
  for(const candidate of departments){const n=normalize(candidate);if(n&&text.includes(n)){department=candidate;break}}
  if(department==='all')for(const [canonical,words] of aliases){if(words.some(word=>text.includes(normalize(word)))){department=departments.find(x=>normalize(x).includes(normalize(canonical))||normalize(canonical).includes(normalize(x)))||departments.find(x=>normalize(x).includes('μεθ')||normalize(x).includes('icu'))||'all';break}}
  return {department,periodDays}
}

export function buildLiraAnalysis(data,language='el',{today=new Date().toISOString().slice(0,10)}={}){
 const en=language==='en'
 const {surveillance=[],laboratory=[],handHygiene=[],bundles=[],qualityIncidents=[],qualityCapas=[]}=data||{}
 const active=surveillance.filter(x=>x.state==='active')
 const amrSurv=active.filter(x=>x.resistance)
 const criticalLab=laboratory.filter(x=>x.critical&&!(x.communications?.length))
 const amrLab=laboratory.filter(x=>x.resistance)
 const overdueReview=active.filter(x=>x.reviewDue&&day(x.reviewDue)<today)
 const lowHand=handHygiene.filter(x=>Number(x.rate)<80)
 const failedBundles=bundles.filter(x=>x.allOrNone===false)
 const highIncidents=qualityIncidents.filter(x=>['high','critical'].includes(x.severity)&&x.status!=='closed')
 const overdueCapa=qualityCapas.filter(x=>x.status!=='completed'&&x.dueDate&&day(x.dueDate)<today)
 const signals=[]
 const evidence=(source,id,date)=>({source,id,date:day(date)})
 const icu=en?'ICU':'ΜΕΘ'
 const icuAmr=amrSurv.filter(x=>String(x.department||'').toLocaleLowerCase('el-GR').includes('μεθ')||String(x.department||'').toLowerCase().includes('icu'))
 if(icuAmr.length>=2)signals.push({id:'amr-cluster',severity:'high',domain:en?'Surveillance / AMR':'Επιτήρηση / AMR',department:icu,title:en?'Cluster of active resistant-organism surveillance in ICU':'Συσσώρευση ενεργών επιτηρήσεων ανθεκτικών μικροοργανισμών στη ΜΕΘ',summary:en?`${icuAmr.length} active surveillance records with resistance are present in ICU.`:`${icuAmr.length} ενεργές επιτηρήσεις με ανθεκτικότητα εμφανίζονται στη ΜΕΘ.`,evidence:icuAmr.map(x=>evidence('surveillance_cases',x.id,x.startedAt)),to:'/surveillance'})
 criticalLab.forEach(x=>signals.push({id:`critical-${x.resultId||x.id}`,severity:'critical',domain:en?'Laboratory':'Εργαστήριο',department:x.department,title:en?'Critical result without closed-loop communication':'Κρίσιμο αποτέλεσμα χωρίς κλειστό κύκλο επικοινωνίας',summary:`${x.patient} · ${x.organism||(en?'critical laboratory result':'κρίσιμο εργαστηριακό αποτέλεσμα')}`,evidence:[evidence('microbiology_results',x.resultId||x.id,x.resultedAt)],to:`/laboratory/${x.id}`}))
 overdueReview.forEach(x=>signals.push({id:`review-${x.id}`,severity:'high',domain:en?'Surveillance':'Επιτήρηση',department:x.department,title:en?'Active surveillance reassessment is pending':'Εκκρεμεί επανεκτίμηση ενεργής επιτήρησης',summary:`${x.patient} · ${x.organism||(en?'no microorganism':'χωρίς μικροοργανισμό')}`,evidence:[evidence('surveillance_cases',x.id,x.reviewDue)],to:`/surveillance/${x.id}`}))
 lowHand.forEach(x=>signals.push({id:`hh-${x.id}`,severity:x.rate<70?'high':'medium',domain:en?'Prevention':'Πρόληψη',department:departmentOf(x,language),title:en?'Low hand-hygiene compliance':'Χαμηλή συμμόρφωση υγιεινής χεριών',summary:en?`Compliance was ${x.rate}% across ${x.observations} opportunities.`:`Καταγράφηκε συμμόρφωση ${x.rate}% σε ${x.observations} ευκαιρίες.`,evidence:[evidence('hand_hygiene_sessions',x.id,x.date)],to:'/prevention'}))
 failedBundles.forEach(x=>signals.push({id:`bundle-${x.id}`,severity:x.score<85?'high':'medium',domain:en?'Prevention bundles':'Bundles πρόληψης',department:departmentOf(x,language),title:en?`Bundle ${x.bundle} without all-or-none compliance`:`Bundle ${x.bundle} χωρίς all-or-none συμμόρφωση`,summary:en?`Score ${x.score}% · ${x.failedCount} non-compliant item(s).`:`Βαθμολογία ${x.score}% · ${x.failedCount} μη συμμορφούμενο στοιχείο.`,evidence:[evidence('prevention_bundle_assessments',x.id,x.date)],to:'/prevention'}))
 highIncidents.forEach(x=>signals.push({id:`incident-${x.id}`,severity:x.severity==='critical'?'critical':'high',domain:en?'Quality':'Ποιότητα',department:x.department,title:en?'Open serious incident':'Ανοιχτό σοβαρό συμβάν',summary:x.title,evidence:[evidence('quality_incidents',x.id,x.date)],to:`/quality/incidents/${x.id}`}))
 overdueCapa.forEach(x=>signals.push({id:`capa-${x.id}`,severity:x.priority==='high'?'high':'medium',domain:en?'Quality / CAPA':'Ποιότητα / CAPA',department:x.department,title:en?'Overdue corrective action':'Εκπρόθεσμη διορθωτική ενέργεια',summary:x.title,evidence:[evidence('quality_capa_actions',x.id,x.dueDate)],to:`/quality/capas/${x.id}`}))
 signals.sort((a,b)=>severityRank[b.severity]-severityRank[a.severity])
 const bundleRate=bundles.length?Math.round(bundles.filter(x=>x.allOrNone).length/bundles.length*100):0
 const hhAverage=handHygiene.length?Math.round(handHygiene.reduce((sum,x)=>sum+Number(x.rate||0),0)/handHygiene.length):0
 return {signals,highPriority:signals.filter(x=>['critical','high'].includes(x.severity)).length,activeSurveillance:active.length,amr:new Set([...amrSurv.map(x=>x.id),...amrLab.map(x=>x.resultId||x.id)]).size,bundleAllOrNone:bundleRate,domains:[{label:en?'Surveillance':'Επιτήρηση',value:en?`${active.length} active`:`${active.length} ενεργές`,note:`${amrSurv.length} ${en?'with':'με'} MDR/XDR/PDR`},{label:en?'Laboratory':'Εργαστήριο',value:en?`${laboratory.filter(x=>x.result==='positive').length} positive`:`${laboratory.filter(x=>x.result==='positive').length} θετικά`,note:en?`${criticalLab.length} critical without documented communication`:`${criticalLab.length} κρίσιμα χωρίς τεκμηριωμένη επικοινωνία`},{label:en?'Hand hygiene':'Υγιεινή χεριών',value:`${hhAverage}%`,note:en?'Average compliance in inferred scope':'Μέση συμμόρφωση στο εύρος που κατάλαβε η LIRA'},{label:'Bundles',value:`${bundleRate}%`,note:en?'All-or-none in inferred scope':'All-or-none στο εύρος που κατάλαβε η LIRA'},{label:en?'Quality':'Ποιότητα',value:en?`${highIncidents.length} serious open`:`${highIncidents.length} σοβαρά ανοικτά`,note:en?`${qualityCapas.filter(x=>x.status!=='completed').length} active CAPA`:`${qualityCapas.filter(x=>x.status!=='completed').length} ενεργές CAPA`}],actions:[{title:en?'Review resistant-organism signals':'Επανεκτίμηση σημάτων ανθεκτικών μικροοργανισμών',text:en?'Review temporal and spatial correlation, isolation and microbiology data before considering a possible outbreak.':'Ελέγξτε χρονική και χωρική συσχέτιση, απομόνωση και μικροβιολογικά δεδομένα πριν θεωρηθεί πιθανή έξαρση.',to:'/surveillance'},{title:en?'Close critical communications':'Κλείσιμο κρίσιμων επικοινωνιών',text:en?'Critical laboratory results require documented closed-loop communication.':'Τα κρίσιμα εργαστηριακά αποτελέσματα χρειάζονται τεκμηριωμένη επικοινωνία κλειστού κύκλου.',to:'/laboratory'},{title:en?'Targeted hand-hygiene observation':'Στοχευμένη παρατήρηση υγιεινής χεριών',text:en?'Low-compliance sessions require additional observations before drawing a reliable conclusion.':'Οι χαμηλές συνεδρίες συμμόρφωσης χρειάζονται περισσότερες παρατηρήσεις πριν εξαχθεί ασφαλές συμπέρασμα.',to:'/prevention'}]}
}
