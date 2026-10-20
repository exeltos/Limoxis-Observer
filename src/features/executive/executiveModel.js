// «Πίνακας Διοίκησης»: pure helpers — the period of each preset and the one
// before it, the filters in the URL, the headline measures with their change
// and traffic light, the control ranking by department and the list of what
// needs attention. The snapshot shape is the Analysis one
// ({domains, microbiology, clusters}), so production and demo read the same.

export const PERIOD_PRESETS=['month','3m','6m','12m','year','custom']
// The current calendar year by default, as Analysis (sharedPeriod.js).
export const DEFAULT_FILTERS=Object.freeze({period:'year',from:'',to:'',department:'',compare:true})
const MONTHS_BACK={month:0,'3m':2,'6m':5,'12m':11}
const MONTH_SHIFT={month:1,'3m':3,'6m':6,'12m':12,year:12}

const pad=value=>String(value).padStart(2,'0')
export const isoDay=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const parse=value=>{const [y,m,d]=String(value||'').slice(0,10).split('-').map(Number);return y&&m&&d?new Date(y,m-1,d):null}
const validDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&Boolean(parse(value))
const daysIn=(year,month)=>new Date(year,month+1,0).getDate()
// The same day `months` earlier; the 31st of a shorter month becomes its last day.
export function shiftMonths(value,months){const date=parse(value);if(!date)return '';const target=new Date(date.getFullYear(),date.getMonth()-months,1);return isoDay(new Date(target.getFullYear(),target.getMonth(),Math.min(date.getDate(),daysIn(target.getFullYear(),target.getMonth()))))}
const addDays=(value,days)=>{const date=parse(value);date.setDate(date.getDate()+days);return isoDay(date)}
const dayCount=(from,to)=>Math.round((parse(to)-parse(from))/86400000)+1

// {from,to} of a preset up to today; «custom» takes the given dates (swapped if reversed).
export function periodRange(filters=DEFAULT_FILTERS,today=new Date()){
 const end=isoDay(today)
 const period=PERIOD_PRESETS.includes(filters.period)?filters.period:DEFAULT_FILTERS.period
 if(period==='custom'){
  const from=validDay(filters.from)?filters.from:shiftMonths(end,1),to=validDay(filters.to)?filters.to:end
  return from<=to?{from,to}:{from:to,to:from}
 }
 if(period==='year')return {from:`${today.getFullYear()}-01-01`,to:end}
 const start=new Date(today.getFullYear(),today.getMonth()-MONTHS_BACK[period],1)
 return {from:isoDay(start),to:end}
}

// The comparable period before: the same calendar span one shift earlier
// (a month for «this month», a year for «this year»), or for custom dates the
// same number of days just before.
export function previousRange(range,period='custom'){
 if(!range?.from||!range?.to)return null
 const shift=MONTH_SHIFT[period]
 if(shift)return {from:shiftMonths(range.from,shift),to:shiftMonths(range.to,shift)}
 const days=dayCount(range.from,range.to),to=addDays(range.from,-1)
 return {from:addDays(to,-(days-1)),to}
}

// A URL without a period opens on `fallback` (the period shared with Analysis).
export function parseFilters(search='',fallback=null){
 const query=new URLSearchParams(search)
 const base=!query.get('period')&&fallback&&PERIOD_PRESETS.includes(fallback.period)?fallback:null
 const period=base?base.period:PERIOD_PRESETS.includes(query.get('period'))?query.get('period'):DEFAULT_FILTERS.period
 const from=base?base.from:query.get('from'),to=base?base.to:query.get('to')
 return {period,from:period==='custom'&&validDay(from)?from:'',to:period==='custom'&&validDay(to)?to:'',department:query.get('department')||'',compare:query.get('compare')!=='0'}
}
// Only what differs from the defaults goes in the URL.
export function filtersToQuery(filters){
 const query=new URLSearchParams()
 if(filters.period&&filters.period!==DEFAULT_FILTERS.period)query.set('period',filters.period)
 if(filters.period==='custom'){if(filters.from)query.set('from',filters.from);if(filters.to)query.set('to',filters.to)}
 if(filters.department)query.set('department',filters.department)
 if(!filters.compare)query.set('compare','0')
 const text=query.toString()
 return text?`?${text}`:''
}

const num=value=>{if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null}
export const pct=(part,whole)=>{const p=num(part),w=num(whole);return w?Math.round(p/w*1000)/10:null}
const mdro=micro=>(micro?.resistance||[]).filter(([key])=>['MDR','XDR','PDR'].includes(key)).reduce((sum,[,n])=>sum+(Number(n)||0),0)
const severe=quality=>(quality?.bySeverity||[]).filter(([key])=>['critical','high'].includes(key)).reduce((sum,[,n])=>sum+(Number(n)||0),0)

// Change against the previous period. better: 'up' | 'down' — which way is good.
export function delta(current,previous,better='up'){
 const c=num(current),p=num(previous)
 if(c==null||p==null)return null
 const diff=Math.round((c-p)*10)/10
 const change=p?Math.round((c-p)/Math.abs(p)*1000)/10:null
 const trend=diff===0?'flat':diff>0?'up':'down'
 return {diff,change,trend,good:trend==='flat'?null:trend===better}
}

// Traffic light: 'good' | 'warning' | 'danger' | 'neutral'. Rates by target
// band; counts by threshold (0 is good where any is a problem).
export function rateTone(value,good,warning){const n=num(value);if(n==null)return 'neutral';return n>=good?'good':n>=warning?'warning':'danger'}
export function countTone(value,{warning=1,danger=Infinity}={}){const n=num(value);if(n==null)return 'neutral';return n>=danger?'danger':n>=warning?'warning':'good'}

export const TARGETS=Object.freeze({handHygiene:80,bundles:90,training:90,controlsCompleted:95})

// The headline measures. Each: id, module(s) it belongs to (shown if any is on),
// the parts it needs, value (number or null), unit, hint, tone, better, and
// pointInTime (counts of "now" that do not change with the period: no delta).
export function executiveKpis(snapshot={},governance=null){
 const d=snapshot?.domains||{},s=d.surveillance||{},hh=d.handHygiene||{},b=d.bundles||{},c=d.controls||{},q=d.quality||{},t=d.training||{},w=d.workforce||{},g=d.governance||{},f=d.qualityFood||{}
 const micro=snapshot?.microbiology||{}
 const hand=pct(hh.compliant,hh.observations),done=pct(c.completed,c.executions),trained=pct(t.completed,t.assignments)
 const temperature=(num(f.thermalOut)??0)+(num(f.receiptsOut)??0)
 return [
  {id:'hai',modules:['surveillance'],parts:['domains'],label:['Επιβεβαιωμένες HAI','Confirmed HAI'],value:num(s.haiConfirmed),hint:[`${s.active??0} ενεργές επιτηρήσεις · ${s.total??0} στην περίοδο`,`${s.active??0} active surveillance · ${s.total??0} in period`],tone:countTone(s.haiConfirmed,{warning:1,danger:5}),better:'down',tab:'surveillance'},
  {id:'mdro',modules:['laboratory'],parts:['microbiology'],label:['Πολυανθεκτικά στελέχη','MDR isolates'],value:micro.totalPositive==null?null:mdro(micro),hint:[`MDR/XDR/PDR · ${micro.totalPositive??0} θετικές καλλιέργειες`,`MDR/XDR/PDR · ${micro.totalPositive??0} positive cultures`],tone:countTone(mdro(micro),{warning:1,danger:10}),better:'down',tab:'laboratory'},
  {id:'handHygiene',modules:['prevention'],parts:['domains'],label:['Υγιεινή χεριών','Hand hygiene'],value:hand,unit:'%',hint:[`στόχος ≥ ${TARGETS.handHygiene}% · ${hh.observations??0} ευκαιρίες`,`target ≥ ${TARGETS.handHygiene}% · ${hh.observations??0} opportunities`],tone:rateTone(hand,TARGETS.handHygiene,70),better:'up',tab:'prevention'},
  {id:'bundles',modules:['prevention'],parts:['domains'],label:['Δέσμες μέτρων','Bundle score'],value:num(b.averageScore),unit:'%',hint:[`στόχος ≥ ${TARGETS.bundles}% · ${b.assessments??0} αξιολογήσεις`,`target ≥ ${TARGETS.bundles}% · ${b.assessments??0} assessments`],tone:rateTone(b.averageScore,TARGETS.bundles,80),better:'up',tab:'prevention'},
  {id:'overdueControls',modules:['controls'],parts:['domains'],pointInTime:true,label:['Εκπρόθεσμοι έλεγχοι','Overdue controls'],value:num(c.overdueAssignments),hint:[`${done==null?'—':`${done}%`} ολοκληρωμένες · ${c.executions??0} εκτελέσεις`,`${done==null?'—':`${done}%`} completed · ${c.executions??0} executions`],tone:countTone(c.overdueAssignments,{warning:1,danger:10}),better:'down',tab:'controls'},
  {id:'incidents',modules:['quality'],parts:['domains'],label:['Ανοιχτά συμβάντα','Open incidents'],value:num(q.openIncidents),hint:[`${severe(q)} σοβαρά / κρίσιμα · ${q.incidents??0} στην περίοδο`,`${severe(q)} severe / critical · ${q.incidents??0} in period`],tone:severe(q)?'danger':countTone(q.openIncidents),better:'down',tab:'quality'},
  {id:'capaOverdue',modules:['quality'],parts:['domains'],pointInTime:true,label:['Εκπρόθεσμες διορθωτικές','Overdue CAPA'],value:num(q.capaOverdue),hint:[`${q.capaOpen??0} ανοιχτές διορθωτικές ενέργειες`,`${q.capaOpen??0} open corrective actions`],tone:countTone(q.capaOverdue,{warning:1,danger:5}),better:'down',tab:'quality'},
  {id:'training',modules:['training'],parts:['people'],label:['Ολοκλήρωση εκπαίδευσης','Training completion'],value:trained,unit:'%',hint:[`${t.overdue??0} εκπρόθεσμες · ${t.assignments??0} αναθέσεις`,`${t.overdue??0} overdue · ${t.assignments??0} assignments`],tone:rateTone(trained,TARGETS.training,70),better:'up',tab:'training'},
  {id:'certificates',modules:['suppliers','kitchen'],parts:['qualityFood'],pointInTime:true,label:['Ληγμένα πιστοποιητικά','Expired certificates'],value:num(f.certificatesExpired),hint:[`προμηθευτών · ${f.certificatesExpiring??0} λήγουν σε 30 ημέρες`,`suppliers' · ${f.certificatesExpiring??0} expire within 30 days`],tone:countTone(f.certificatesExpired,{warning:1,danger:10}),better:'down',tab:'qualityfood'},
  {id:'temperature',modules:['kitchen'],parts:['qualityFood'],label:['Μη συμμορφώσεις θερμοκρασίας','Temperature non-conformities'],value:f.thermalMeasured==null&&f.receipts==null?null:temperature,hint:[`${f.thermalMeasured??0} θερμικές μετρήσεις · ${f.receipts??0} παραλαβές`,`${f.thermalMeasured??0} thermal checks · ${f.receipts??0} receipts`],tone:countTone(temperature,{warning:1,danger:5}),better:'down',tab:'qualityfood'},
  {id:'decisions',modules:['governance'],parts:['governance'],pointInTime:true,label:['Ανοιχτές αποφάσεις επιτροπών','Open committee decisions'],value:num(governance?.openDecisions),hint:[`${governance?.overdueDecisions??0} εκπρόθεσμες · ${g.committees??0} επιτροπές`,`${governance?.overdueDecisions??0} overdue · ${g.committees??0} committees`],tone:countTone(governance?.overdueDecisions,{warning:1,danger:5}),better:'down',tab:'governance'},
  {id:'staff',modules:[],parts:['people'],pointInTime:true,label:['Προσωπικό','Staff'],value:num(w.activeEmployees),hint:['ενεργοί εργαζόμενοι','active employees'],tone:'neutral',better:'up',tab:'occupational'},
 ]
}

// Visible measures: of the modules that are on, with the change against the
// previous period where the measure depends on the period.
export function withDeltas(kpis,previousKpis=null){
 const before=new Map((previousKpis||[]).map(item=>[item.id,item.value]))
 return kpis.map(item=>({...item,delta:previousKpis&&!item.pointInTime?delta(item.value,before.get(item.id),item.better):null}))
}
export const visibleFor=(items,moduleEnabled=()=>true)=>items.filter(item=>!item.modules?.length||item.modules.some(module=>moduleEnabled(module)))

// Controls by department ([name, executions, withFinding]): finding rate, the
// five with the fewest and the five with the most (departments with fewer than
// `minimum` executions are left out of the ranking).
export function controlRanking(rows=[],{limit=5,minimum=5}={}){
 const ranked=(rows||[]).map(([name,executions,withFinding])=>({name:typeof name==='object'?name?.name:name,executions:Number(executions)||0,findings:Number(withFinding)||0})).filter(row=>row.name&&row.name!=='—'&&row.executions>=minimum).map(row=>({...row,rate:pct(row.findings,row.executions)}))
 const asc=[...ranked].sort((a,b)=>a.rate-b.rate||b.executions-a.executions)
 const best=asc.slice(0,limit),bestNames=new Set(best.map(row=>row.name))
 const worst=[...ranked].sort((a,b)=>b.rate-a.rate||b.executions-a.executions).filter(row=>!bestNames.has(row.name)&&row.rate>0).slice(0,limit)
 return {best,worst}
}

// «Τι χρειάζεται προσοχή»: every red / amber measure plus what the strip does
// not show (outbreak clusters, overdue isolation reviews, document reviews,
// major audit findings, high risks), the most serious first.
export function redFlags(kpis=[],snapshot={},moduleEnabled=()=>true){
 const d=snapshot?.domains||{},s=d.surveillance||{},g=d.governance||{},f=d.qualityFood||{},t=d.training||{}
 const on=modules=>!modules.length||modules.some(module=>moduleEnabled(module))
 const fmt=item=>item.value==null?'—':`${String(item.value).replace('.',',')}${item.unit||''}`
 const flags=visibleFor(kpis,moduleEnabled).filter(item=>item.value!=null&&(item.tone==='danger'||item.tone==='warning')).map(item=>({id:item.id,severity:item.tone,text:[`${item.label[0]}: ${fmt(item)}`,`${item.label[1]}: ${fmt(item)}`],detail:item.hint,tab:item.tab}))
 const extra=(id,modules,count,severity,el,en,tab)=>{const n=Number(count)||0;if(n>0&&on(modules))flags.push({id,severity,text:[`${el}: ${n}`,`${en}: ${n}`],detail:null,tab})}
 extra('clusters',['laboratory','surveillance'],(snapshot?.clusters||[]).length,'danger','Ενεργές συρροές μικροοργανισμών','Active organism clusters','laboratory')
 extra('isolationReviews',['surveillance'],s.isolationReviewOverdue,'warning','Εκπρόθεσμες επανεκτιμήσεις απομόνωσης','Overdue isolation reviews','surveillance')
 extra('trainingOverdue',['training'],t.overdue,'warning','Εκπρόθεσμες εκπαιδεύσεις','Overdue training','training')
 extra('documentReviews',['governance'],g.reviewOverdue,'warning','Έγγραφα με εκπρόθεσμη αναθεώρηση','Documents past review date','governance')
 extra('minutesPending',['governance'],g.minutesPending,'warning','Πρακτικά σε εκκρεμότητα','Minutes pending','governance')
 extra('majorFindings',['quality'],f.findingsMajor,'danger','Ανοιχτά σοβαρά ευρήματα επιθεωρήσεων','Open major audit findings','qualityfood')
 extra('risksHigh',['quality'],f.risksHigh,'warning','Υψηλοί κίνδυνοι','High risks','qualityfood')
 const rank={danger:0,warning:1}
 return flags.sort((a,b)=>rank[a.severity]-rank[b.severity])
}

// Monthly hand-hygiene compliance ([month, observations, compliant] → %).
export const monthlyRate=rows=>(rows||[]).filter(([,total])=>Number(total)>0).map(([month,total,part])=>[month,pct(part,total)])

// Cache key of one load: organization, period and department.
export const cacheKey=({organizationId='',from='',to='',departmentId=''}={})=>[organizationId,from,to,departmentId||''].join('|')
