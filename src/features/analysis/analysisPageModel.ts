// Constants and pure helpers for the Analysis page: period ranges, infection-site
// labels, tab list and the rows each production tab shows.
import { Activity,BrainCircuit,Gauge,BookOpen,BriefcaseMedical,ChefHat,ClipboardCheck,FileWarning,FlaskConical,GraduationCap,Pill,ShieldCheck,Stethoscope,Users,type LucideIcon } from 'lucide-react'
import type { AnyRecord, Translate } from '../../types/featureTypes'

// Καρτέλα της Ανάλυσης: [id, ελληνικά, English, εικονίδιο].
export type AnalysisTab=[string,string,string,LucideIcon]
// A [key, ...counts] row or a [row, column, count] cell of the metrics; production
// reads them from the RPCs as JSON, so their shape is not known here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows of the analysis RPC JSON
export type MetricRow=any[]
// Καρτέλα των «Δεικτών»: όπως η AnalysisTab, με τις ενότητες της Ανάλυσης που δείχνει.
export type IndicatorTab=[string,string,string,LucideIcon,string[]]

export const COMPACT_QUERY='(max-height: 900px) and (min-width: 981px)'
export const CLINICAL_SITES=['bloodCulture','urineCulture','respiratorySample','woundCulture']
export const SITE_LABELS: Record<string,[string,string]>={bloodCulture:['Αιμοκαλλιέργεια','Blood culture'],urineCulture:['Καλλιέργεια ούρων','Urine culture'],respiratorySample:['Αναπνευστικό δείγμα','Respiratory sample'],woundCulture:['Καλλιέργεια τραύματος','Wound culture'],environmental:['Περιβαλλοντικό δείγμα','Environmental sample'],surveillance:['Επιτήρηση προσωπικού','Staff surveillance'],surface:['Περιβαλλοντικό δείγμα (επιφάνεια)','Environmental sample (surface)'],equipment:['Περιβαλλοντικό δείγμα (εξοπλισμός)','Environmental sample (equipment)'],water:['Περιβαλλοντικό δείγμα (νερό)','Environmental sample (water)'],air:['Περιβαλλοντικό δείγμα (αέρας)','Environmental sample (air)']}
// A sample_type an infection-control clinician can't place (an unrecognized
// code, or a non-clinical environmental/surveillance swab that has no real
// "infection site") must never echo verbatim — that reads as duplicated
// garbage next to the specimen-detail column, which is exactly what it is.
export function siteLabel(value: string,tx: Translate){const pair=SITE_LABELS[value];return pair?tx(pair[0],pair[1]):tx('Λοιπό δείγμα','Other sample')}
// Same (organism, resistance, department, source, site) line list every
// chart on this page summarizes — cross-referencing organism with infection
// site (blood/urine/respiratory/wound) directly, instead of the two only
// being joinable by scanning the full line list by eye. Restricted to the
// four clinical culture types: environmental/surveillance swabs have no
// clinical "infection site" and would just dilute this breakdown.
export function organismBySiteRows(rows: unknown[][]|null|undefined,tx: Translate,limit=12){
 const grouped=new Map<string,number>()
 for(const [organism,,,,count,,sampleType] of (rows||[]) as [string,unknown,unknown,unknown,unknown,unknown,string][]){
  if(!CLINICAL_SITES.includes(sampleType))continue
  const label=`${organism} · ${siteLabel(sampleType,tx)}`
  grouped.set(label,(grouped.get(label)||0)+(Number(count)||0))
 }
 return [...grouped.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit)
}
export const TABS: AnalysisTab[]=[['overview','Σύνοψη','Overview',Activity],['surveillance','Επιτήρηση & ΛΣΦΥ','Surveillance & HAI',Stethoscope],['laboratory','Μικροβιολογία & AMR','Microbiology & AMR',FlaskConical],['antimicrobials','Αντιμικροβιακά','Antimicrobials',Pill],['prevention','Πρόληψη','Prevention',ShieldCheck],['controls','Έλεγχοι','Controls',ClipboardCheck],['occupational','Εργαζόμενοι','Employees',Users],['quality','Ποιότητα','Quality',BriefcaseMedical],['qualityfood','Ποιότητα & ασφάλεια τροφίμων','Quality & food safety',ChefHat],['training','Εκπαίδευση','Training',GraduationCap],['governance','Διακυβέρνηση','Governance',BookOpen],['pps','Μελέτη επιπολασμού','Prevalence survey',Gauge],['lira','Εξάρσεις','Outbreaks',BrainCircuit]]
// Module each tab needs in the organization's operating profile; tabs not listed are always shown.
// The kitchen is not a module of the profile (it is gated by view_kitchen), so
// «Ποιότητα & ασφάλεια τροφίμων» follows the Quality module.
export const TAB_MODULES: Record<string,string[]>={laboratory:['laboratory','national'],reporting:['national','laboratory'],surveillance:['surveillance'],antimicrobials:['surveillance','pharmacy'],prevention:['prevention'],controls:['controls'],quality:['quality'],qualityfood:['quality'],training:['training'],governance:['governance'],occupational:['occupational_health'],pps:['prevalence_survey'],lira:['lira']}
// Organization-level only: data quality, ΕΟΔΥ notifications and EARS-Net export work on sample-level laboratory data.
// Top-level sections of Analysis; each tab belongs to one. A section with a
// single visible tab shows no sub-tabs.
const TAB_GROUPS: [string,string,string,string[]][]=[
 ['summary','Σύνοψη','Overview',['overview']],
 ['clinical','Επιτήρηση & μικροβιολογία','Surveillance & microbiology',['surveillance','laboratory','antimicrobials','pps']],
 ['prevention','Πρόληψη & έλεγχοι','Prevention & controls',['prevention','controls']],
 ['organisation','Οργανισμός','Organisation',['occupational','quality','qualityfood','training','governance']],
 ['reports','Αναφορές & AI','Reports & AI',['reporting','lira']],
]
export function analysisGroups(visibleTabs: AnalysisTab[]){
 const byId=new Map(visibleTabs.map(tab=>[tab[0],tab]))
 const groups=TAB_GROUPS.map(([id,el,en,ids])=>({id,el,en,tabs:ids.map(tabId=>byId.get(tabId)).filter(Boolean) as AnalysisTab[]})).filter(group=>group.tabs.length)
 const grouped=new Set(TAB_GROUPS.flatMap(group=>group[3]))
 const rest=visibleTabs.filter(tab=>!grouped.has(tab[0]))
 if(rest.length)groups.push({id:'other',el:'Λοιπά',en:'Other',tabs:rest})
 return groups
}

export const REPORTING_TAB: AnalysisTab=['reporting','Αναφορές & ποιότητα δεδομένων','Reporting & data quality',FileWarning]
const MONTHS_EL=['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος']
const MONTHS_EN=['January','February','March','April','May','June','July','August','September','October','November','December']

export function hashOrganization(hash=''){const query=hash.includes('?')?hash.split('?')[1]:'';return new URLSearchParams(query).get('organization')||'all'}
export function fmtDate(value: string|null|undefined){if(!value)return '—';const [y,m,d]=String(value).slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:value}
// An AMR row's value can be a "resistant/tested" ratio string (e.g. '3/12');
// stripping the '/' without splitting first would concatenate both numbers
// into one (numberValue('1/1') -> 11). Take the resistant count (numerator).
export function numberValue(value: unknown){const raw=String(value??'');const primary=raw.includes('/')?raw.split('/')[0]:raw;const normalized=primary.replaceAll('.','').replace(',','.').replace(/[^0-9.-]/g,'');const n=Number(normalized);return Number.isFinite(n)?n:0}
export function isoDate(year: number|string,month: number|string,day: number|string){return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
function daysInMonth(year: number|string,month: number|string){return new Date(Number(year),Number(month),0).getDate()}
export function calendarRange(year: number|string,periodType: string,slot: number|string){const y=Number(year);if(periodType==='month'){const m=Number(slot)||1;return {from:isoDate(y,m,1),to:isoDate(y,m,daysInMonth(y,m))}}if(periodType==='quarter'){const q=Number(slot)||1,start=(q-1)*3+1,end=start+2;return {from:isoDate(y,start,1),to:isoDate(y,end,daysInMonth(y,end))}}if(periodType==='half'){const h=Number(slot)||1,start=h===1?1:7,end=h===1?6:12;return {from:isoDate(y,start,1),to:isoDate(y,end,daysInMonth(y,end))}}return {from:isoDate(y,1,1),to:isoDate(y,12,31)}}
export function periodSlotOptions(type: string,en: boolean){if(type==='month')return (en?MONTHS_EN:MONTHS_EL).map((label,index)=>[String(index+1),label]);if(type==='quarter')return [['1','Q1'],['2','Q2'],['3','Q3'],['4','Q4']];if(type==='half')return [['1',en?'1st half':'Α΄ εξάμηνο'],['2',en?'2nd half':'Β΄ εξάμηνο']];return []}
// Months without records are shown as 0 so the time axis stays evenly spaced.
export function continuousMonths(points: [string,number][]=[]){if(points.length<2)return points;const values=new Map(points);const [fy,fm]=points[0][0].split('-').map(Number),[ly,lm]=points[points.length-1][0].split('-').map(Number);const out: [string,number][]=[];for(let y=fy,m=fm;y<ly||(y===ly&&m<=lm);m===12?(y++,m=1):m++){const key=`${y}-${String(m).padStart(2,'0')}`;out.push([key,values.get(key)??0])}return out}
export const chartLanguage=(tx: Translate)=>tx('el','en')==='en'
export function buildProductionRows(tab: string,snapshot: AnyRecord|null|undefined,tx: Translate){const summary=snapshot?.summary||{},micro=snapshot?.microbiology||{};const antimicrobial=summary.antimicrobial&&typeof summary.antimicrobial==='object'?summary.antimicrobial:null;const antimicrobialRows=antimicrobial?[[tx('Αντιμικροβιακές αγωγές','Antimicrobial therapies'),antimicrobial.total??0,'—','up'],[tx('Σε αναμονή έγκρισης','Pending approval'),antimicrobial.pending??0,'—','up'],[tx('Χορηγήσεις','Administrations recorded'),antimicrobial.administrations??0,'—','up']]:[[tx('Αντιμικροβιακές αγωγές','Antimicrobial therapies'),'—','—','up']];const amrRows=(snapshot?.amrSusceptibility||[]).length?snapshot!.amrSusceptibility.map(([organism,tested,resistant]: [string,number,number])=>[organism,`${resistant}/${tested}`,'—','down']):[[tx('Ο υπολογισμός ευαισθησίας δεν έχει ξεκινήσει','Susceptibility not calculated yet'),'—','—','up']];const map: Record<string,unknown[][]>={overview:[[tx('Επιτήρηση','Surveillance'),summary.surveillance??0,'—','up'],[tx('Εργαστήριο','Laboratory'),summary.laboratory??0,'—','up'],[tx('Πρόληψη','Prevention'),summary.prevention??0,'—','up'],[tx('Έλεγχοι','Controls'),summary.controls??0,'—','up'],[tx('Ποιότητα','Quality'),summary.quality??0,'—','up'],[tx('Εκπαίδευση','Training'),summary.training??0,'—','up']],national:[[tx('Θετικές καλλιέργειες','Positive cultures'),micro.totalPositive??0,'—','up'],['MDR/XDR/PDR',(micro.resistance||[]).reduce((sum: number,row: unknown[])=>sum+Number(row[1]||0),0),'—','down'],[tx('Τμήματα με ≥1 εύρημα','Departments with ≥1 finding'),micro.departmentCount??0,'—','up'],[tx('Κρίσιμα αποτελέσματα','Critical results'),micro.totalCritical??0,'—','down']],surveillance:[[tx('Καταγραφές επιτήρησης','Surveillance records'),summary.surveillance??0,'—','up']],laboratory:[[tx('Εργαστηριακές καταγραφές','Laboratory records'),summary.laboratory??0,'—','up'],[tx('Θετικές καλλιέργειες','Positive cultures'),micro.totalPositive??0,'—','up'],[tx('Κρίσιμα αποτελέσματα','Critical results'),micro.totalCritical??0,'—','down']],amr:amrRows,antimicrobials:antimicrobialRows,prevention:[[tx('Πρόληψη','Prevention'),summary.prevention??0,'—','up'],[tx('Υγιεινή χεριών','Hand hygiene'),summary.handHygiene??0,'—','up'],[tx('Απόβλητα','Waste'),summary.waste??0,'—','up']],hand:[[tx('Υγιεινή χεριών','Hand hygiene'),summary.handHygiene??0,'—','up']],controls:[[tx('Έλεγχοι','Controls'),summary.controls??0,'—','up']],occupational:[[tx('Επισκέψεις εργαζομένων','Employee visits'),summary.occupationalHealth??'—','—','up']],quality:[[tx('Ποιότητα','Quality'),summary.quality??0,'—','up']],qualityfood:[[tx('Ποιότητα & ασφάλεια τροφίμων','Quality & food safety'),'—','—','up']],training:[[tx('Εκπαίδευση','Training'),summary.training??0,'—','up']],governance:[[tx('Έγγραφα','Documents'),summary.documents??0,'—','up'],[tx('Επιτροπές','Committees'),summary.committees??'—','—','up']]};return map[tab]||map.overview}

// «Δείκτες» (the Executive dashboard): one row of tabs. Each tab shows its Analysis
// sections one under the other; the prevalence survey, reporting and LIRA sit in
// «Περισσότερα» at the end of the strip.
export const INDICATOR_TABS: IndicatorTab[]=[
 ['summary','Σύνοψη','Overview',Gauge,[]],
 // Infections and the microbiology (AMR) in one tab: the episodes and the cultures behind them.
 ['infections','Λοιμώξεις & μικροβιολογία','Infections & microbiology',Stethoscope,['surveillance','laboratory','pps','lira']],
 ['antimicrobials','Αντιμικροβιακά','Antimicrobials',Pill,['antimicrobials']],
 ['prevention','Πρόληψη & έλεγχοι','Prevention & controls',ShieldCheck,['prevention','controls']],
 ['organisation','Οργανισμός','Organisation',Users,['occupational','quality','qualityfood','training','governance']],
]
// No «More» (owner, 2/11/2026): the prevalence survey and the outbreaks are small tabs of «Infections & microbiology»; the data
// quality checks and the EARS-Net export are the laboratory's (Laboratory › Notifiable diseases).
export const INDICATOR_MORE_TABS: IndicatorTab[]=[]
// The «Δείκτες» tab that shows an Analysis tab (old links: /analysis?tab=…, ?view=analysis&tab=…).
export function indicatorTabOf(analysisTab: string|null|undefined){
 if(!analysisTab||analysisTab==='overview')return 'summary'
 return [...INDICATOR_TABS,...INDICATOR_MORE_TABS].find(([id,,,,sections])=>id===analysisTab||sections.includes(analysisTab))?.[0]||'summary'
}
