const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR')
const rowDate=row=>row?.signalDate||row?.resultedAt||row?.collectedAt||row?.date||row?.startedAt||row?.dueDate||null
const rowDepartment=row=>row?.department||row?.departmentEl||row?.departmentEn||'—'
const validDate=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date:null}
const iso=date=>date.toISOString().slice(0,10)
const range=(start,end,label)=>({start:iso(start),end:iso(end),label})
const startOfMonth=date=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1))
const endOfMonth=date=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,23,59,59,999))
const startOfYear=date=>new Date(Date.UTC(date.getUTCFullYear(),0,1))
const endOfYear=date=>new Date(Date.UTC(date.getUTCFullYear(),11,31,23,59,59,999))
const shiftMonth=(date,delta)=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+delta,1))
const inRange=(value,window)=>{const date=validDate(value);return date&&date>=new Date(`${window.start}T00:00:00Z`)&&date<=new Date(`${window.end}T23:59:59Z`)}
const MONTHS=[['january','ιανουαρ',0],['february','φεβρουαρ',1],['march','μαρτ',2],['april','απριλ',3],['may','μαι',4],['june','ιουν',5],['july','ιουλ',6],['august','αυγουστ',7],['september','σεπτεμβρ',8],['october','οκτωβρ',9],['november','νοεμβρ',10],['december','δεκεμβρ',11]]
const explicitYears=text=>[...text.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1])).slice(0,2)
const explicitMonths=text=>MONTHS.filter(([en,el])=>text.includes(en)||text.includes(el)).map(([, ,index])=>index).slice(0,2)
const departmentsFrom=data=>{const values=new Set();for(const key of ['surveillance','laboratory','handHygiene','bundles','qualityIncidents','qualityCapas'])for(const row of data?.[key]||[]){const value=rowDepartment(row);if(value&&value!=='—')values.add(value)}return [...values]}
const departmentsInQuestion=(text,data)=>departmentsFrom(data).filter(name=>text.includes(normalize(name))).slice(0,2)

export function inferComparisonSpec(question,{today=new Date().toISOString().slice(0,10),data=null}={}){
 const text=normalize(question);const now=new Date(`${today}T12:00:00Z`);const years=explicitYears(text);const months=explicitMonths(text);const namedDepartments=departmentsInQuestion(text,data)
 const comparisonWords=/(συγκρι|σε σχεση|εναντι|versus|\bvs\b|compare|compared|προηγουμεν|περυσι|last year|last month)/.test(text)
 const ranking=/(ποιο τμημα|ποια μοναδα|ανα τμημα|κατα τμημα|department|unit|χειροτερ|καλυτερ|περισσοτερ|λιγοτερ|ranking|rank)/.test(text)
 if(namedDepartments.length>=2&&comparisonWords)return {mode:'department_pair',departments:namedDepartments}
 if(years.length>=2){const [a,b]=years;return {mode:'period',current:range(startOfYear(new Date(Date.UTC(a,0,1))),endOfYear(new Date(Date.UTC(a,0,1))),String(a)),reference:range(startOfYear(new Date(Date.UTC(b,0,1))),endOfYear(new Date(Date.UTC(b,0,1))),String(b))}}
 if(years.length===1&&months.length===2){const y=years[0];const [a,b]=months;return {mode:'period',current:range(new Date(Date.UTC(y,a,1)),endOfMonth(new Date(Date.UTC(y,a,1))),`${a+1}/${y}`),reference:range(new Date(Date.UTC(y,b,1)),endOfMonth(new Date(Date.UTC(y,b,1))),`${b+1}/${y}`)}}
 if(/(φετος|αυτο το ετος|αυτη τη χρονια|this year|current year)/.test(text)&&comparisonWords){const previous=now.getUTCFullYear()-1;const refEnd=new Date(Date.UTC(previous,now.getUTCMonth(),now.getUTCDate()));return {mode:'period',current:range(startOfYear(now),now,`${now.getUTCFullYear()} YTD`),reference:range(new Date(Date.UTC(previous,0,1)),refEnd,`${previous} YTD`)}}
 if(/(μηνα|month)/.test(text)&&comparisonWords){const current=startOfMonth(now);const previous=shiftMonth(current,-1);const previousMonthLast=endOfMonth(previous).getUTCDate();const matchedDay=Math.min(now.getUTCDate(),previousMonthLast);const refEnd=new Date(Date.UTC(previous.getUTCFullYear(),previous.getUTCMonth(),matchedDay));return {mode:'period',current:range(current,now,`${current.getUTCMonth()+1}/${current.getUTCFullYear()} MTD`),reference:range(previous,refEnd,`${previous.getUTCMonth()+1}/${previous.getUTCFullYear()} MTD`)}}
 if(/(εβδομαδ|week)/.test(text)&&comparisonWords){const end=new Date(now);const start=new Date(now);start.setUTCDate(start.getUTCDate()-6);const refEnd=new Date(start);refEnd.setUTCDate(refEnd.getUTCDate()-1);const refStart=new Date(refEnd);refStart.setUTCDate(refStart.getUTCDate()-6);return {mode:'period',current:range(start,end,'last 7 days'),reference:range(refStart,refEnd,'previous 7 days')}}
 if(ranking)return {mode:'department'}
 return null
}

function filterRows(rows,window,department,entity){return (rows||[]).filter(row=>(!department||department==='all'||rowDepartment(row)===department)&&(!window||inRange(rowDate(row),window))&&(!entity||normalize(row.organism).includes(normalize(entity))))}
function weightedHand(rows){let observations=0,compliant=0;for(const row of rows){const n=Number(row.observations)||0;observations+=n;compliant+=n*(Number(row.rate)||0)/100}return observations?Math.round(compliant/observations*100):null}
function bundleRate(rows){return rows.length?Math.round(rows.filter(x=>x.allOrNone).length/rows.length*100):null}

export function metricForLira(data,topic,{window=null,department='all',entity=null,today=new Date().toISOString().slice(0,10)}={}){
 const surveillance=filterRows(data?.surveillance,window,department,entity);const laboratory=filterRows(data?.laboratory,window,department,entity);const hand=filterRows(data?.handHygiene,window,department,null);const bundles=filterRows(data?.bundles,window,department,null);const incidents=filterRows(data?.qualityIncidents,window,department,null);const capas=filterRows(data?.qualityCapas,window,department,null)
 switch(topic){case 'amr':return {value:laboratory.filter(x=>x.resistance).length,label:'AMR'};case 'laboratory':return {value:laboratory.filter(x=>x.result==='positive').length,label:'positive laboratory results'};case 'hand_hygiene':return {value:weightedHand(hand),label:'hand-hygiene compliance',unit:'%'};case 'bundles':return {value:bundleRate(bundles),label:'bundle all-or-none',unit:'%'};case 'surveillance':return {value:surveillance.filter(x=>x.state==='active').length,label:'active surveillance records'};case 'quality':case 'incidents':return {value:incidents.filter(x=>x.status!=='closed').length,label:'open quality incidents'};case 'capa':return {value:capas.filter(x=>x.status!=='completed'&&x.dueDate&&String(x.dueDate).slice(0,10)<today).length,label:'overdue CAPA'};case 'infections':return {value:laboratory.filter(x=>x.result==='positive').length,label:entity?`${entity} positive microbiology results`:'positive microbiology results'};default:return {value:surveillance.filter(x=>x.state==='active').length,label:'active surveillance records'}}
}

const delta=(a,b)=>a==null||b==null?null:a-b
const percentChange=(a,b)=>a==null||b==null||b===0?null:Math.round((a-b)/Math.abs(b)*100)
const comparisonPoints=(a,b,aLabel,bLabel,unit,language)=>{const en=language==='en';const d=delta(a,b);const pct=percentChange(a,b);const direction=d==null||d===0?(en?'no change':'χωρίς μεταβολή'):d>0?(en?'increase':'αύξηση'):(en?'decrease':'μείωση');const points=[`${aLabel}: ${a??'—'}${unit} · ${bLabel}: ${b??'—'}${unit}.`];if(d!=null)points.push(en?`Observed ${direction}: ${d>0?'+':''}${d}${unit}${pct==null?'':` (${pct>0?'+':''}${pct}%)`}.`:`Παρατηρούμενη ${direction}: ${d>0?'+':''}${d}${unit}${pct==null?'':` (${pct>0?'+':''}${pct}%)`}.`);return points}

export function compareLiraPeriods(data,plan,spec,language='el'){
 const en=language==='en';const current=metricForLira(data,plan.topic,{window:spec.current,department:plan.department,entity:plan.entity});const reference=metricForLira(data,plan.topic,{window:spec.reference,department:plan.department,entity:plan.entity});const points=comparisonPoints(current.value,reference.value,spec.current.label,spec.reference.label,current.unit||'',language);points.push(en?'Matched periods are used when comparing an ongoing month or year. This is descriptive and does not establish statistical significance or causality.':'Για τρέχοντα μήνα ή έτος χρησιμοποιούνται αντίστοιχες χρονικά περίοδοι. Η σύγκριση είναι περιγραφική και δεν τεκμηριώνει στατιστική σημαντικότητα ή αιτιότητα.');return {title:en?'Comparison':'Σύγκριση',subtitle:en?`${current.label}: matched-period comparison.`:`${current.label}: σύγκριση αντίστοιχων περιόδων.`,points}
}

export function compareLiraDepartments(data,plan,spec,language='el'){
 const en=language==='en';const [a,b]=spec.departments;const first=metricForLira(data,plan.topic,{department:a,entity:plan.entity});const second=metricForLira(data,plan.topic,{department:b,entity:plan.entity});const points=comparisonPoints(first.value,second.value,a,b,first.unit||'',language);points.push(en?'Department comparison is descriptive and should be interpreted with denominator, case-mix and observation-volume context where relevant.':'Η σύγκριση τμημάτων είναι περιγραφική και όπου απαιτείται πρέπει να συνεκτιμώνται παρονομαστές, case-mix και όγκος παρατηρήσεων.');return {title:en?'Department comparison':'Σύγκριση τμημάτων',subtitle:first.label,points}
}

export function rankLiraDepartments(data,plan,language='el'){
 const en=language==='en';const rows=departmentsFrom(data).map(department=>({department,...metricForLira(data,plan.topic,{department,entity:plan.entity})})).filter(x=>x.value!=null);const lowerIsWorse=plan.topic==='hand_hygiene'||plan.topic==='bundles';rows.sort((a,b)=>lowerIsWorse?a.value-b.value:b.value-a.value);return {title:en?'Department comparison':'Σύγκριση τμημάτων',subtitle:en?'Descriptive ranking from authorized records.':'Περιγραφική κατάταξη από εξουσιοδοτημένες εγγραφές.',points:rows.slice(0,8).map((x,index)=>`${index+1}. ${x.department}: ${x.value}${x.unit||''}`)}
}
