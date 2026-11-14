// «Πίνακας Διοίκησης»: pure helpers — the period of each preset and the one
// before it, the filters in the URL, the headline measures with their change
// and traffic light, the control ranking by department and the list of what
// needs attention. The snapshot shape is the Analysis one
// ({domains, microbiology, clusters}), so production and demo read the same.
// The snapshot: each domain's figures (counts, and lists of [label, count, …] rows), the
// microbiology figures and the active clusters. The Analysis assembles it from many reads.
export type ExecFigures = Record<string, unknown>
export type ExecSnapshot = { domains?: Record<string, ExecFigures>, microbiology?: ExecFigures, clusters?: unknown[] }
// A headline measure (id, label, value, unit, target, tone, hint…) as measures() builds it.
export interface ExecKpi {
 id: string
 label: [string, string]
 hint?: [string, string]
 missing?: [string, string] | null
 value: number | null
 unit?: string
 target?: string
 tone: string
 alert?: string | null
 status?: string
 modules?: string[]
 parts?: string[]
 pointInTime?: boolean
 better?: string
 tab?: string
 delta?: ReturnType<typeof delta>
 separate?: boolean
}
export interface ExecFilters { period: string, from: string, to: string, department: string, compare: boolean }
export interface DayRange { from: string, to: string }
type Counted = [string, unknown]

export const PERIOD_PRESETS: string[]=['month','3m','6m','12m','year','custom']
// The current calendar year by default, as Analysis (sharedPeriod.js).
export const DEFAULT_FILTERS: Readonly<ExecFilters>=Object.freeze({period:'year',from:'',to:'',department:'',compare:true})
const MONTHS_BACK: Record<string, number>={month:0,'3m':2,'6m':5,'12m':11}
const MONTH_SHIFT: Record<string, number>={month:1,'3m':3,'6m':6,'12m':12,year:12}

const pad=(value: number)=>String(value).padStart(2,'0')
export const isoDay=(date: Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const parse=(value: unknown)=>{const [y,m,d]=String(value||'').slice(0,10).split('-').map(Number);return y&&m&&d?new Date(y,m-1,d):null}
const validDay=(value: unknown): value is string=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&Boolean(parse(value))
const daysIn=(year: number,month: number)=>new Date(year,month+1,0).getDate()
// The same day `months` earlier; the 31st of a shorter month becomes its last day.
export function shiftMonths(value: string,months: number){const date=parse(value);if(!date)return '';const target=new Date(date.getFullYear(),date.getMonth()-months,1);return isoDay(new Date(target.getFullYear(),target.getMonth(),Math.min(date.getDate(),daysIn(target.getFullYear(),target.getMonth()))))}
const addDays=(value: string,days: number)=>{const date=parse(value) as Date;date.setDate(date.getDate()+days);return isoDay(date)}
const dayCount=(from: string,to: string)=>Math.round((Number(parse(to))-Number(parse(from)))/86400000)+1

// {from,to} of a preset up to today; «custom» takes the given dates (swapped if reversed).
export function periodRange(filters: Partial<ExecFilters>=DEFAULT_FILTERS,today=new Date()): DayRange{
 const end=isoDay(today)
 const period=PERIOD_PRESETS.includes(filters.period||'')?filters.period||'':DEFAULT_FILTERS.period
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
export function previousRange(range: DayRange|null|undefined,period='custom'): DayRange|null{
 if(!range?.from||!range?.to)return null
 const shift=MONTH_SHIFT[period]
 if(shift)return {from:shiftMonths(range.from,shift),to:shiftMonths(range.to,shift)}
 const days=dayCount(range.from,range.to),to=addDays(range.from,-1)
 return {from:addDays(to,-(days-1)),to}
}

// A URL without a period opens on `fallback` (the period shared with Analysis).
export function parseFilters(search='',fallback: Partial<ExecFilters>|null=null): ExecFilters{
 const query=new URLSearchParams(search)
 const base=!query.get('period')&&fallback&&PERIOD_PRESETS.includes(fallback.period||'')?fallback:null
 const period=(base?base.period:PERIOD_PRESETS.includes(query.get('period')||'')?query.get('period'):DEFAULT_FILTERS.period) as string
 const from=base?base.from:query.get('from'),to=base?base.to:query.get('to')
 return {period,from:period==='custom'&&validDay(from)?from:'',to:period==='custom'&&validDay(to)?to:'',department:query.get('department')||'',compare:query.get('compare')!=='0'}
}
// Only what differs from the defaults goes in the URL.
export function filtersToQuery(filters: Partial<ExecFilters>){
 const query=new URLSearchParams()
 if(filters.period&&filters.period!==DEFAULT_FILTERS.period)query.set('period',filters.period)
 if(filters.period==='custom'){if(filters.from)query.set('from',filters.from);if(filters.to)query.set('to',filters.to)}
 if(filters.department)query.set('department',filters.department)
 if(!filters.compare)query.set('compare','0')
 const text=query.toString()
 return text?`?${text}`:''
}

const num=(value: unknown): number|null=>{if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null}
export const pct=(part: unknown,whole: unknown)=>{const p=num(part),w=num(whole);return w?Math.round(Number(p)/w*1000)/10:null}
const mdro=(micro: ExecFigures|null|undefined)=>((micro?.resistance||[]) as Counted[]).filter(([key])=>['MDR','XDR','PDR'].includes(key)).reduce((sum,[,n])=>sum+(Number(n)||0),0)
// The one MDR count of every screen: patients with a multidrug-resistant isolate (the results where the patients are not known).
export const mdroPatients=(micro: ExecFigures|null|undefined)=>Number.isFinite(Number(micro?.mdrPatients))&&micro?.mdrPatients!=null?Number(micro.mdrPatients):mdro(micro)
const severe=(quality: ExecFigures|null|undefined)=>((quality?.bySeverity||[]) as Counted[]).filter(([key])=>['critical','high'].includes(key)).reduce((sum,[,n])=>sum+(Number(n)||0),0)

// Change against the previous period. better: 'up' | 'down' — which way is good.
export function delta(current: unknown,previous: unknown,better='up'){
 const c=num(current),p=num(previous)
 if(c==null||p==null)return null
 const diff=Math.round((c-p)*10)/10
 const change=p?Math.round((c-p)/Math.abs(p)*1000)/10:null
 const trend=diff===0?'flat':diff>0?'up':'down'
 return {diff,change,trend,good:trend==='flat'?null:trend===better,previous:p}
}

// Traffic light: 'good' | 'warning' | 'danger' | 'neutral'. Rates by target
// band; counts by threshold (0 is good where any is a problem).
export function rateTone(value: unknown,good: number,warning: number){const n=num(value);if(n==null)return 'neutral';return n>=good?'good':n>=warning?'warning':'danger'}
export function countTone(value: unknown,{warning=1,danger=Infinity}: {warning?: number,danger?: number}={}){const n=num(value);if(n==null)return 'neutral';return n>=danger?'danger':n>=warning?'warning':'good'}

export type ExecTargets = { [measure: string]: number }
export const TARGETS: Readonly<ExecTargets>=Object.freeze({handHygiene:80,bundles:90,training:90,controlsCompleted:95})
// The three rates are the platform's indicators («Δείκτες & Στόχοι»), with the same value on both screens; the
// hospital sets their targets as objectives on them. The values above stand while it has none.
// (The demo's definitions use other keys than the hospital's.)
export const TARGET_INDICATORS: Readonly<Record<string, string[]>>=Object.freeze({handHygiene:['hh-compliance','who-hh'],bundles:['bundle-compliance','bundle-all-or-none'],training:['training-completion','training']})
export function targetsFromObjectives(objectives: { platformIndicatorKey?: string|null, year?: number|string|null, status?: string|null, target?: unknown }[]|null|undefined,year=new Date().getFullYear()): ExecTargets{
 const targets: ExecTargets={...TARGETS}
 for(const [key,indicators] of Object.entries(TARGET_INDICATORS)){
  const objective=(objectives||[]).find(item=>indicators.includes(item.platformIndicatorKey as string)&&Number(item.year)===Number(year)&&(item.status||'active')==='active'&&item.target!==''&&item.target!=null&&Number.isFinite(Number(item.target)))
  if(objective)targets[key]=Number(objective.target)
 }
 return targets
}
// The value of each of the three from the platform's indicators (null where the hospital has no such indicator).
// The overview's table: the measures by area, in this order.
export const EXEC_AREAS: readonly [string, [string, string], string[]][]=Object.freeze([
 ['infections',['Λοιμώξεις & μικροβιολογία','Infections & microbiology'],['hai','haiRate','mdro','mdroRate']],
 ['prevention',['Πρόληψη & έλεγχοι','Prevention & controls'],['handHygiene','bundles','overdueControls']],
 ['quality',['Ποιότητα','Quality'],['incidents','capaOverdue']],
 ['people',['Προσωπικό & εκπαίδευση','Workforce & training'],['training']],
 ['food',['Ασφάλεια τροφίμων','Food safety'],['certificates','temperature']],
 ['governance',['Διακυβέρνηση','Governance'],['decisions']],
])
const TONE_RANK: Record<string, number>={danger:0,warning:1,good:2,neutral:3}
// The areas with their measures: within an area the measures off target first; the areas with one off target first.
export function measuresByArea(kpis: ExecKpi[]){
 const rank=(item: ExecKpi)=>TONE_RANK[item.value==null?'neutral':item.tone]??3
 return EXEC_AREAS.map(([id,label,ids])=>({id,label,rows:ids.map(key=>kpis.find(item=>item.id===key)).filter(Boolean).sort((a,b)=>rank(a)-rank(b))}))
  .filter(area=>area.rows.length)
  .sort((a,b)=>rank(a.rows[0])-rank(b.rows[0]))
}
export function indicatorRates<T extends { id: string }>(definitions: T[]|null|undefined,calculate: (def: T)=>unknown){
 const rates: Record<string, unknown>={}
 for(const [key,indicators] of Object.entries(TARGET_INDICATORS)){const def=(definitions||[]).find(item=>indicators.includes(item.id));rates[key]=def?calculate(def):null}
 return rates
}
export function executiveKpis(snapshot: ExecSnapshot|null={},governance: ExecFigures|null=null,targets: Readonly<ExecTargets>=TARGETS,rates: Record<string, unknown>={}): ExecKpi[]{return judgedByTarget(measures(snapshot,governance,targets,rates))}
// The status is judged only against a target that is shown: a measure without one keeps its alert level (for «what needs
// attention») but reads «Χωρίς στόχο»; a measure without data says so.
export function judgedByTarget(items: ExecKpi[]): ExecKpi[]{return items.map(item=>item.value==null?{...item,tone:'neutral',alert:null,status:'missing'}:item.target?{...item,alert:item.tone,status:'judged'}:{...item,alert:item.tone,tone:'neutral',status:'noTarget'})}
function measures(snapshot: ExecSnapshot|null={},governance: ExecFigures|null=null,targets: Readonly<ExecTargets>=TARGETS,rates: Record<string, unknown>={}): ExecKpi[]{
 const TARGET=targets,rate=(key: string,own: number|null)=>Number.isFinite(rates?.[key])?rates[key] as number:own
 const d=snapshot?.domains||{},s=d.surveillance||{},hh=d.handHygiene||{},b=d.bundles||{},c=d.controls||{},q=d.quality||{},t=d.training||{},g=d.governance||{},f=d.qualityFood||{}
 const micro=snapshot?.microbiology||{}
 const hand=rate('handHygiene',pct(hh.compliant,hh.observations)),done=pct(c.completed,c.executions),trained=rate('training',pct(t.completed,t.assignments)),bundle=rate('bundles',num(b.averageScore))
 const temperature=(num(f.thermalOut)??0)+(num(f.receiptsOut)??0)
 // Surveillance with no HAI classification at all: a 0 would read as «no infections».
 const classified=((s.byCaseStatus||[]) as Counted[]).reduce((sum,[,n])=>sum+(Number(n)||0),0),unclassified=Number(num(s.total))>0&&classified===0
 return [
  {id:'hai',modules:['surveillance'],parts:['domains'],label:['Επιβεβαιωμένες ΛΣΦΥ','Confirmed HAI'],value:unclassified?null:num(s.haiConfirmed),missing:unclassified?['Δεν γίνεται ταξινόμηση','Not classified']:null,hint:[`${s.active??0} ενεργές επιτηρήσεις · ${s.total??0} στην περίοδο`,`${s.active??0} active surveillance · ${s.total??0} in period`],tone:countTone(s.haiConfirmed,{warning:1,danger:5}),better:'down',tab:'surveillance'},
  {id:'mdro',modules:['laboratory'],parts:['microbiology'],label:['Ασθενείς με πολυανθεκτικό στέλεχος','Patients with a multidrug-resistant isolate'],value:micro.totalPositive==null?null:mdroPatients(micro),hint:[`MDR/XDR/PDR · ${micro.totalPositive??0} θετικές καλλιέργειες`,`MDR/XDR/PDR · ${micro.totalPositive??0} positive cultures`],tone:countTone(mdroPatients(micro),{warning:1,danger:10}),better:'down',tab:'laboratory'},
  {id:'handHygiene',modules:['prevention'],parts:['domains'],label:['Συμμόρφωση στην υγιεινή χεριών','Hand hygiene compliance'],value:hand,unit:'%',target:`≥ ${TARGET.handHygiene}%`,hint:[`στόχος ≥ ${TARGET.handHygiene}% · ${hh.observations??0} ευκαιρίες`,`target ≥ ${TARGET.handHygiene}% · ${hh.observations??0} opportunities`],tone:rateTone(hand,TARGET.handHygiene,70),better:'up',tab:'prevention'},
  {id:'bundles',modules:['prevention'],parts:['domains'],label:['Τήρηση δεσμών μέτρων','Bundle compliance'],value:bundle,unit:'%',target:`≥ ${TARGET.bundles}%`,hint:[`στόχος ≥ ${TARGET.bundles}% · ${b.assessments??0} αξιολογήσεις`,`target ≥ ${TARGET.bundles}% · ${b.assessments??0} assessments`],tone:rateTone(bundle,TARGET.bundles,80),better:'up',tab:'prevention'},
  {id:'overdueControls',modules:['controls'],parts:['domains'],pointInTime:true,label:['Εκπρόθεσμοι έλεγχοι','Overdue controls'],target:'0',value:num(c.overdueAssignments),hint:[`${done==null?'—':`${done}%`} ολοκληρωμένες · ${c.executions??0} εκτελέσεις`,`${done==null?'—':`${done}%`} completed · ${c.executions??0} executions`],tone:countTone(c.overdueAssignments,{warning:1,danger:10}),better:'down',tab:'controls'},
  {id:'incidents',modules:['quality'],parts:['domains'],label:['Ανοιχτά συμβάντα','Open incidents'],value:num(q.openIncidents),hint:[`${severe(q)} σοβαρά / κρίσιμα · ${q.incidents??0} στην περίοδο`,`${severe(q)} severe / critical · ${q.incidents??0} in period`],tone:severe(q)?'danger':countTone(q.openIncidents),better:'down',tab:'quality'},
  {id:'capaOverdue',modules:['quality'],parts:['domains'],pointInTime:true,label:['Εκπρόθεσμες διορθωτικές ενέργειες','Overdue corrective actions'],target:'0',value:num(q.capaOverdue),hint:[`${q.capaOpen??0} ανοιχτές διορθωτικές ενέργειες`,`${q.capaOpen??0} open corrective actions`],tone:countTone(q.capaOverdue,{warning:1,danger:5}),better:'down',tab:'quality'},
  {id:'training',modules:['training'],parts:['people'],label:['Ολοκλήρωση υποχρεωτικής εκπαίδευσης','Mandatory training completion'],value:trained,unit:'%',target:`≥ ${TARGET.training}%`,hint:[`${t.overdue??0} εκπρόθεσμες · ${t.assignments??0} αναθέσεις`,`${t.overdue??0} overdue · ${t.assignments??0} assignments`],tone:rateTone(trained,TARGET.training,70),better:'up',tab:'training'},
  {id:'certificates',modules:['suppliers','kitchen'],parts:['qualityFood'],pointInTime:true,label:['Ληγμένα πιστοποιητικά προμηθευτών','Expired supplier certificates'],target:'0',value:num(f.certificatesExpired),hint:[`${f.certificatesExpiredSuppliers!=null?`σε ${f.certificatesExpiredSuppliers} προμηθευτές`:'προμηθευτών'} · ${f.certificatesExpiring??0} λήγουν σε 60 ημέρες`,`${f.certificatesExpiredSuppliers!=null?`at ${f.certificatesExpiredSuppliers} suppliers`:`suppliers'`} · ${f.certificatesExpiring??0} expire within 60 days`],tone:countTone(f.certificatesExpired,{warning:1,danger:10}),better:'down',tab:'qualityfood'},
  {id:'temperature',modules:['kitchen'],parts:['qualityFood'],label:['Μη συμμορφώσεις θερμοκρασίας','Temperature non-conformities'],value:f.thermalMeasured==null&&f.receipts==null?null:temperature,hint:[`${f.thermalMeasured??0} θερμικές μετρήσεις · ${f.receipts??0} παραλαβές`,`${f.thermalMeasured??0} thermal checks · ${f.receipts??0} receipts`],tone:countTone(temperature,{warning:1,danger:5}),better:'down',tab:'qualityfood'},
  {id:'decisions',modules:['governance'],parts:['governance'],pointInTime:true,label:['Ανοιχτές αποφάσεις επιτροπών','Open committee decisions'],value:num(governance?.openDecisions),hint:[`${governance?.overdueDecisions??0} εκπρόθεσμες · ${g.committees??0} επιτροπές`,`${governance?.overdueDecisions??0} overdue · ${g.committees??0} committees`],tone:countTone(governance?.overdueDecisions,{warning:1,danger:5}),better:'down',tab:'governance'},
 ]
}

// Visible measures: of the modules that are on, with the change against the
// previous period where the measure depends on the period.
export function withDeltas(kpis: ExecKpi[],previousKpis: ExecKpi[]|null=null): ExecKpi[]{
 const before=new Map((previousKpis||[]).map(item=>[item.id,item.value]))
 return kpis.map(item=>({...item,delta:previousKpis&&!item.pointInTime?delta(item.value,before.get(item.id),item.better):null}))
}
export const visibleFor=(items: ExecKpi[],moduleEnabled: (module: string)=>boolean=()=>true)=>items.filter(item=>!item.modules?.length||item.modules.some((module: string)=>moduleEnabled(module)))

// Controls by department ([name, executions, withFinding]): finding rate, the
// five with the fewest and the five with the most (departments with fewer than
// `minimum` executions are left out of the ranking).
export interface RankedDepartment { name: string, executions: number, findings: number, rate: number }
export function controlRanking(rows: unknown[][]|null=[],{limit=5,minimum=5}: {limit?: number,minimum?: number}={}): {best: RankedDepartment[],worst: RankedDepartment[]}{
 const ranked=(rows||[]).map(([name,executions,withFinding])=>({name:(typeof name==='object'?(name as {name?: string}|null)?.name:name) as string,executions:Number(executions)||0,findings:Number(withFinding)||0})).filter(row=>row.name&&row.name!=='—'&&row.executions>=minimum).map(row=>({...row,rate:pct(row.findings,row.executions) as number}))
 const asc=[...ranked].sort((a,b)=>a.rate-b.rate||b.executions-a.executions)
 const best=asc.slice(0,limit),bestNames=new Set(best.map(row=>row.name))
 const worst=[...ranked].sort((a,b)=>b.rate-a.rate||b.executions-a.executions).filter(row=>!bestNames.has(row.name)&&row.rate>0).slice(0,limit)
 return {best,worst}
}

// «Τι χρειάζεται προσοχή»: every red / amber measure plus what the strip does
// not show (outbreak clusters, overdue isolation reviews, document reviews,
// major audit findings, high risks), the most serious first.
export interface RedFlag { id: string, severity: string, text: [string, string], detail: unknown, tab?: string }
export function redFlags(kpis: ExecKpi[]=[],snapshot: ExecSnapshot|null={},moduleEnabled: (module: string)=>boolean=()=>true): RedFlag[]{
 const d=snapshot?.domains||{},s=d.surveillance||{},g=d.governance||{},f=d.qualityFood||{},t=d.training||{}
 const on=(modules: string[])=>!modules.length||modules.some(module=>moduleEnabled(module))
 const fmt=(item: ExecKpi)=>item.value==null?'—':`${String(item.value).replace('.',',')}${item.unit||''}`
 const flags: RedFlag[]=visibleFor(kpis,moduleEnabled).filter(item=>item.value!=null&&((item.alert??item.tone)==='danger'||(item.alert??item.tone)==='warning')).map(item=>({id:item.id,severity:item.alert??item.tone,text:[`${item.label[0]}: ${fmt(item)}`,`${item.label[1]}: ${fmt(item)}`],detail:item.hint,tab:item.tab}))
 const extra=(id: string,modules: string[],count: unknown,severity: string,el: string,en: string,tab: string)=>{const n=Number(count)||0;if(n>0&&on(modules))flags.push({id,severity,text:[`${el}: ${n}`,`${en}: ${n}`],detail:null,tab})}
 extra('clusters',['laboratory','surveillance'],(snapshot?.clusters||[]).length,'danger','Ενεργές συρροές μικροοργανισμών','Active organism clusters','laboratory')
 extra('isolationReviews',['surveillance'],s.isolationReviewOverdue,'warning','Εκπρόθεσμες επανεκτιμήσεις απομόνωσης','Overdue isolation reviews','surveillance')
 extra('trainingOverdue',['training'],t.overdue,'warning','Εκπρόθεσμες εκπαιδεύσεις','Overdue training','training')
 extra('documentReviews',['governance'],g.reviewOverdue,'warning','Έγγραφα με εκπρόθεσμη αναθεώρηση','Documents past review date','governance')
 extra('minutesPending',['governance'],g.minutesPending,'warning','Πρακτικά σε εκκρεμότητα','Minutes pending','governance')
 extra('majorFindings',['quality'],f.findingsMajor,'danger','Ανοιχτά σοβαρά ευρήματα επιθεωρήσεων','Open major audit findings','qualityfood')
 extra('risksHigh',['quality'],f.risksHigh,'warning','Υψηλοί κίνδυνοι','High risks','qualityfood')
 const rank: Record<string, number>={danger:0,warning:1}
 return flags.sort((a,b)=>rank[a.severity]-rank[b.severity])
}

// Monthly hand-hygiene compliance ([month, observations, compliant] → %).
export const monthlyRate=(rows: unknown[][]|null|undefined)=>(rows||[]).filter(([,total])=>Number(total)>0).map(([month,total,part])=>[month,pct(part,total)])

// Cache key of one load: organization, period and department.
export const cacheKey=({organizationId='',from='',to='',departmentId=''}: {organizationId?: string|null,from?: string,to?: string,departmentId?: string|null}={})=>[organizationId,from,to,departmentId||''].join('|')
