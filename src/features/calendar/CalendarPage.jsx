import { useCallback,useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CalendarDays,ChevronLeft,ChevronRight,ClipboardCheck,GraduationCap,ListChecks,Plus } from 'lucide-react'
import { useNavigate,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { MetricCard } from '../../design-system/MetricCard'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RouteLoading } from '../../design-system/RouteLoading'
import { FilterSelect } from '../../design-system/FilterBar'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { exportRegistry } from '../../core/export/registryExports'
import { loadControlCalendarMonths,loadControlProgramme } from '../controls/controlCloudService'
import { programmeCalendar } from '../controls/controlCalendar'
import { loadQualityRecords } from '../quality/qualityService'
import { loadTrainingCalendarAsync } from '../training/trainingService'
import { groupDocumentFamilies,loadDocumentsAsync } from '../documents/documentService'
import { loadCommitteesAsync } from '../committees/committeeService'
import { loadProtocolSuggestionsAsync } from '../documents/protocolReview/protocolReviewService'
import { loadSupplierSchedule } from '../quality/resources/resourceService'
import { withSupplierStatus } from '../quality/resources/resourceModel'
import { loadKitchen } from '../kitchen/kitchenService'
import { addDays, kitchenCalendarItems, todayKey } from '../kitchen/kitchenModel'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { CALENDAR_KINDS,buildCalendarEvents,calendarFilterLabel,calendarFilterOf,calendarFiltersFor,calendarKindLabel,controlExecutionEvents,dayKey,monthGrid,parseCalendarFilter } from './calendarEvents'
import './calendar.css'

const KIND_CAPABILITY={controls:CAPABILITIES.VIEW_CONTROLS,capa:CAPABILITIES.VIEW_QUALITY,audits:CAPABILITIES.VIEW_QUALITY,training:CAPABILITIES.VIEW_TRAINING,documents:CAPABILITIES.VIEW_DOCUMENTS,committees:CAPABILITIES.VIEW_COMMITTEES,suppliers:CAPABILITIES.VIEW_QUALITY,kitchen:CAPABILITIES.VIEW_KITCHEN}
const WEEKDAYS={el:['Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ','Κυρ'],en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
// A day cell shows one line per module: its dot, the count and the name (singular / plural).
const KIND_COUNT={controls:['έλεγχος','έλεγχοι','control','controls'],capa:['διορθωτική ενέργεια','διορθωτικές ενέργειες','corrective action','corrective actions'],audits:['επιθεώρηση','επιθεωρήσεις','audit','audits'],training:['εκπαίδευση','εκπαιδεύσεις','training','trainings'],documents:['έγγραφο','έγγραφα','document','documents'],committees:['επιτροπή','επιτροπές','committee item','committee items'],suppliers:['αξιολόγηση προμηθευτή','αξιολογήσεις προμηθευτών','supplier evaluation','supplier evaluations'],kitchen:['εκκρεμότητα κουζίνας','εκκρεμότητες κουζίνας','kitchen item','kitchen items']}
// Short module names for narrow day cells (the full name stays in the tooltip).
const KIND_SHORT=[{controls:'Έλεγχοι',capa:'CAPA',audits:'Επιθ.',training:'Εκπαίδ.',documents:'Έγγρ.',committees:'Επιτρ.',suppliers:'Προμ.',kitchen:'Κουζ.'},{controls:'Controls',capa:'CAPA',audits:'Audits',training:'Training',documents:'Docs',committees:'Comm.',suppliers:'Suppl.',kitchen:'Kitchen'}]
const countLabel=(kind,n,en)=>{const forms=KIND_COUNT[kind]||['','','','' ];const word=en?(n===1?forms[2]:forms[3]):(n===1?forms[0]:forms[1]);return word.charAt(0).toLocaleUpperCase(en?'en':'el')+word.slice(1)}
const overdueLabel=(n,en)=>en?`${n} overdue`:`${n} εκπρόθεσμ${n===1?'ο':'α'}`

// One calendar of what has to be done across the hospital: control due dates,
// CAPA and step deadlines, effectiveness reviews, planned audits, training
// deadlines and certificate expiries, document reviews, committee meetings
// and decisions. Each source is loaded only when the user may see it.
export function CalendarPage(){
 const {language,locale}=useLanguage();const en=language==='en'
 const {tenant,role,membership,canAccessRecord,isDemo}=useTenant()
 const userId=useAuditActor()?.id||null
 const navigate=useNavigate()
 const allowedKey=CALENDAR_KINDS.filter(kind=>can(role,KIND_CAPABILITY[kind],membership?.capabilities??[],membership?.customCapabilities??[])).join(',')
 const allowedKinds=useMemo(()=>allowedKey?allowedKey.split(','):[],[allowedKey])
 const [sources,setSources]=useState(null)
 const [cursor,setCursor]=useState(()=>{const d=new Date();return {year:d.getFullYear(),month:d.getMonth()}})
 const [selected,setSelected]=useState(()=>dayKey(new Date()))
 const [view,setView]=useState('month')
 // The chips (controls, trainings, meetings, expiries, other) live in the address: ?filter=controls opens only the controls.
 const [searchParams,setSearchParams]=useSearchParams()
 const filterKinds=useMemo(()=>calendarFiltersFor(allowedKinds),[allowedKinds])
 const filterParam=searchParams.get('filter')||''
 const picked=useMemo(()=>parseCalendarFilter(filterParam),[filterParam])
 const isOn=useCallback(filter=>!picked||picked.has(filter),[picked])
 // The controls' done, late and missed executions of the shown year (counted in the database; null in the demo).
 const [controlMonths,setControlMonths]=useState({year:null,months:null})
 const [department,setDepartment]=useState('all')
 // A module line in a day cell narrows that day's panel to the module.
 const [panelKind,setPanelKind]=useState(null)

 useEffect(()=>{
  let active=true
  const organizationId=tenant?.id
  const allowed=new Set(allowedKinds)
  const safe=(kind,load,fallback)=>allowed.has(kind)?load().catch(()=>fallback):Promise.resolve(fallback)
  Promise.all([
   safe('controls',()=>loadControlProgramme(organizationId),[]),
   safe('capa',()=>loadQualityRecords('capas',organizationId),[]),
   safe('audits',()=>loadQualityRecords('audits',organizationId),[]),
   safe('training',()=>loadTrainingCalendarAsync(organizationId),null),
   safe('documents',()=>loadDocumentsAsync(organizationId),[]),
   safe('committees',()=>loadCommitteesAsync(organizationId),[]),
   safe('documents',()=>loadProtocolSuggestionsAsync(organizationId),[]),
   safe('suppliers',()=>loadSupplierSchedule(organizationId).then(({suppliers,templates})=>withSupplierStatus(suppliers,[],undefined,templates)),[]),
   // The kitchen's calendar items reach back 30 days (verification, out of limits) and forward (plan, expiry): only that window is read.
   safe('kitchen',()=>loadKitchen(organizationId,{since:addDays(todayKey(),-30)}).then(state=>kitchenCalendarItems(state,{language})),[]),
  ]).then(([controls,capas,audits,training,documents,committees,protocolSuggestions,suppliers,kitchen])=>{
   if(active)setSources({controls,capas,audits,training,documentFamilies:groupDocumentFamilies(documents),committees,protocolSuggestions,suppliers,kitchen})
  })
  return()=>{active=false}
 },[tenant?.id,allowedKinds,language])

 const controlsAllowed=allowedKinds.includes('controls')
 useEffect(()=>{
  if(!controlsAllowed||!tenant?.id){setControlMonths({year:cursor.year,months:null});return undefined}
  let active=true
  loadControlCalendarMonths(tenant.id,cursor.year).then(months=>{if(active)setControlMonths({year:cursor.year,months})}).catch(()=>{if(active)setControlMonths({year:cursor.year,months:null})})
  return()=>{active=false}
 },[controlsAllowed,tenant?.id,cursor.year])
 const weeks=useMemo(()=>monthGrid(cursor.year,cursor.month),[cursor])
 const today=dayKey(new Date())
 const range=useMemo(()=>{const from=weeks[0][0],last=weeks[weeks.length-1][6];const horizon=dayKey(new Date(Date.now()+60*24*60*60*1000));return {from:from<today?from:today,to:last>horizon?last:horizon}},[weeks,today])
 const executions=useMemo(()=>{
  if(!sources?.controls?.length||controlMonths.year!==cursor.year)return []
  const lines=programmeCalendar(sources.controls.map(item=>({item,departments:Object.keys(item.assignments||{})})),cursor.year,new Date(),controlMonths.months)
  return controlExecutionEvents(lines,{year:cursor.year,month:cursor.month,today,language})
 },[sources,controlMonths,cursor,today,language])
 const allEvents=useMemo(()=>{
  if(!sources)return []
  const planned=buildCalendarEvents(sources,{...range,today,language,ownerId:isDemo?undefined:userId})
  // A missed due date already listed as overdue is not repeated.
  const overdueKeys=new Set(planned.filter(e=>e.kind==='controls'&&e.state==='overdue').map(e=>`${e.path}|${e.department}|${e.date}`))
  return [...planned,...executions.filter(e=>e.state!=='missed'||!overdueKeys.has(`${e.path}|${e.department}|${e.date}`))].sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99').localeCompare(b.time||'99'))
 },[sources,range,today,language,isDemo,userId,executions])
 const departments=useMemo(()=>[...new Set(allEvents.map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[allEvents,language])
 const events=useMemo(()=>allEvents.filter(e=>allowedKinds.includes(e.kind)&&isOn(calendarFilterOf(e))&&(department==='all'||e.department===department)&&(!e.department||canAccessRecord({department:e.department}))),[allEvents,allowedKinds,isOn,department,canAccessRecord])
 const byDay=useMemo(()=>{const map=new Map();for(const e of events){const list=map.get(e.date)||[];list.push(e);map.set(e.date,list)}return map},[events])
 const overdue=events.filter(e=>e.state==='overdue')
 const weekEnd=dayKey(new Date(Date.now()+7*24*60*60*1000))
 const thisWeek=events.filter(e=>e.state!=='overdue'&&e.state!=='done'&&e.date>=today&&e.date<=weekEnd)
 const monthKey=`${cursor.year}-${String(cursor.month+1).padStart(2,'0')}`
 const monthEvents=events.filter(e=>e.date.startsWith(monthKey))
 // Modules switched off or a department chosen, and nothing left this month: say it is the filters.
 const filtered=Boolean(picked)||department!=='all'
 const upcoming=events.filter(e=>!['done','late','missed'].includes(e.state)&&(e.state==='overdue'||e.date>=today)).slice(0,200)
 const monthTitle=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date(cursor.year,cursor.month,1))
 const fmtDay=key=>new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${key}T12:00:00`))
 const fmtShort=key=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short'}).format(new Date(`${key}T12:00:00`))

 function moveMonth(step){setCursor(c=>{const d=new Date(c.year,c.month+step,1);return {year:d.getFullYear(),month:d.getMonth()}})}
 function openDay(key){setCursor({year:Number(key.slice(0,4)),month:Number(key.slice(5,7))-1});setSelected(key);setPanelKind(null)}
 function goToday(){const d=new Date();setCursor({year:d.getFullYear(),month:d.getMonth()});setSelected(dayKey(d));setPanelKind(null)}
 function setFilter(next){setSearchParams(current=>{const params=new URLSearchParams(current);if(!next||filterKinds.every(filter=>next.has(filter)))params.delete('filter');else params.set('filter',[...next].join(',')||'none');return params},{replace:true})}
 function clearFilters(){setFilter(null);setDepartment('all')}
 function toggleFilter(filter){const next=new Set(filterKinds.filter(isOn));if(next.has(filter))next.delete(filter);else next.add(filter);setFilter(next)}
 function exportMonth(){
  exportRegistry({name:en?`calendar-${monthKey}`:`imerologio-${monthKey}`,
   headers:en?['Date','Time','Module','Item','Detail','Department','Status']:['Ημερομηνία','Ώρα','Ενότητα','Θέμα','Λεπτομέρεια','Τμήμα','Κατάσταση'],
   rows:[...overdue.filter(e=>!e.date.startsWith(monthKey)),...monthEvents].map(e=>[new Intl.DateTimeFormat(locale).format(new Date(`${e.date}T12:00:00`)),e.time||'',calendarKindLabel(e.kind,language),e.title,e.detail||'',e.department||'',stateLabel(e.state,en)])})
 }

 const canManageQuality=can(role,CAPABILITIES.MANAGE_QUALITY,membership?.capabilities??[],membership?.customCapabilities??[])
 const canManageTraining=can(role,CAPABILITIES.MANAGE_TRAINING,membership?.capabilities??[],membership?.customCapabilities??[])
 const from={limoxisFrom:{path:'/calendar',label:en?'Calendar':'Ημερολόγιο'}}
 const addItems=[
  canManageQuality&&{id:'capa',label:en?'New CAPA (due this day)':'Νέα διορθωτική ενέργεια (προθεσμία)',icon:ClipboardCheck,onClick:()=>navigate('/quality/capas/new',{state:{...from,qualitySource:{dueDate:selected}}})},
  canManageQuality&&{id:'audit',label:en?'New audit':'Νέα επιθεώρηση',icon:ListChecks,onClick:()=>navigate('/quality/audits/new',{state:{...from,qualitySource:{plannedDate:selected}}})},
  canManageTraining&&{id:'training',label:en?'New training':'Νέα εκπαίδευση',icon:GraduationCap,onClick:()=>navigate('/training/new',{state:{...from,calendarDate:selected}})},
 ].filter(Boolean)
 const filtersHideAll=filtered&&(view==='month'?!monthEvents.length:!upcoming.length)
 if(!sources)return <RouteLoading/>
 const dayEvents=byDay.get(selected)||[]
 const selectedEvents=panelKind?dayEvents.filter(e=>e.kind===panelKind):dayEvents
 // An empty day points to the next day that has something, so a quiet day is never a dead end.
 const nextDay=dayEvents.length?null:[...byDay.keys()].filter(key=>key>selected).sort()[0]||null
 return <Page fill className="calendar-page" title={en?'Calendar':'Ημερολόγιο'} subtitle={en?'Everything that has to be done, from every module, by date.':'Όλα όσα πρέπει να γίνουν, από όλες τις ενότητες, ανά ημερομηνία.'} actions={<ExportMenu disabled={!monthEvents.length&&!overdue.length} onExcel={exportMonth}/>}>
  <CanonicalTabs value={view} onChange={setView} ariaLabel={en?'Calendar view':'Προβολή ημερολογίου'} items={[{value:'month',label:en?'Month':'Μήνας',icon:CalendarDays},{value:'list',label:en?'To do':'Εκκρεμότητες',icon:ListChecks}]}/>
  <div className="module-summary-strip">
   <MetricCard icon={AlertTriangle} value={overdue.length} label={en?'Overdue':'Εκπρόθεσμα'} tone={overdue.length?'warning':'neutral'} onClick={()=>setView('list')}/>
   <MetricCard icon={ClipboardCheck} value={thisWeek.length} label={en?'Next 7 days':'Επόμενες 7 ημέρες'} onClick={()=>setView('list')}/>
   <MetricCard icon={CalendarDays} value={monthEvents.length} label={en?`In ${monthTitle}`:`Τον μήνα (${monthTitle})`} onClick={()=>setView('month')}/>
  </div>
  <section className="surface registry-workspace workspace-column workspace-fill calendar-workspace">
   <div className="calendar-toolbar">
    <div className="calendar-kinds" role="group" aria-label={en?'Show':'Εμφάνιση'}>{filterKinds.map(filter=><button key={filter} type="button" className={`calendar-kind-toggle filter-${filter} ${isOn(filter)?'':'off'}`} aria-pressed={isOn(filter)} onClick={()=>toggleFilter(filter)}><span className="calendar-dot"/>{calendarFilterLabel(filter,language)}</button>)}</div>
    <div className="calendar-department"><FilterSelect label={en?'Department':'Τμήμα'} value={department} onChange={setDepartment}><option value="all">{en?'All':'Όλα'}</option>{departments.map(d=><option key={d} value={d}>{d}</option>)}</FilterSelect></div>
   </div>
   {filtersHideAll&&<div className="calendar-filter-empty"><RegistryEmptyState filtered title={en?'Nothing pending with the selected filters':'Δεν υπάρχουν εκκρεμότητες με τα επιλεγμένα φίλτρα'} text={en?'Turn a module back on or choose another department.':'Ενεργοποιήστε ξανά μια ενότητα ή επιλέξτε άλλο τμήμα.'} onClearFilters={clearFilters}/></div>}
   {view==='month'?<div className="calendar-month-layout">
    <div className="calendar-month">
     <div className="calendar-month-head"><IconButton label={en?'Previous month':'Προηγούμενος μήνας'} onClick={()=>moveMonth(-1)}><ChevronLeft size={18}/></IconButton><h3>{monthTitle}</h3><IconButton label={en?'Next month':'Επόμενος μήνας'} onClick={()=>moveMonth(1)}><ChevronRight size={18}/></IconButton><Button variant="secondary" onClick={goToday}>{en?'Today':'Σήμερα'}</Button></div>
     <div className="calendar-grid" role="grid" aria-label={monthTitle}>
      {WEEKDAYS[en?'en':'el'].map(d=><div key={d} className="calendar-weekday" role="columnheader">{d}</div>)}
      {weeks.flat().map(key=>{const list=byDay.get(key)||[];const outside=!key.startsWith(monthKey);const late=list.some(e=>e.state==='overdue');// The day selects its agenda; an item in it opens its record.
       return <div key={key} role="gridcell" tabIndex={0} className={`calendar-day ${outside?'outside':''} ${key===today?'today':''} ${key===selected?'selected':''} ${late?'has-overdue':''}`} onClick={()=>{setSelected(key);setPanelKind(null)}} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();setSelected(key);setPanelKind(null)}}} aria-label={`${fmtDay(key)}: ${list.length}`} aria-selected={key===selected}>
       <span className="calendar-day-number">{Number(key.slice(8))}</span>
       {CALENDAR_KINDS.map(kind=>{const items=list.filter(e=>e.kind===kind);if(!items.length)return null;const late=items.filter(e=>e.state==='overdue').length;const name=countLabel(kind,items.length,en);const full=`${items.length} ${name}${late?` · ${overdueLabel(late,en)}`:''}`
        return <button type="button" key={kind} className={`calendar-kind-line kind-${kind}${late?' overdue':''}${key===selected&&panelKind===kind?' active':''}`} title={full} aria-label={full} onClick={event=>{event.stopPropagation();setSelected(key);setPanelKind(kind)}}><span className="calendar-dot"/><b>{items.length}</b><span className="calendar-kind-name full">{name}</span><span className="calendar-kind-name short" aria-hidden="true">{KIND_SHORT[en?1:0][kind]||name}</span>{late>0&&<small className="calendar-kind-late">{overdueLabel(late,en)}</small>}</button>})}
      </div>})}
     </div>
    </div>
    <aside className="calendar-day-panel" aria-live="polite">
     <div className="calendar-day-panel-head"><h4>{fmtDay(selected)}</h4>{panelKind&&<button type="button" className="calendar-panel-filter" onClick={()=>setPanelKind(null)} title={en?'Show every module':'Όλες οι ενότητες'}><span className={`calendar-dot kind-${panelKind}`}/>{calendarKindLabel(panelKind,language)} ×</button>}{addItems.length>0&&<OverflowMenu label={en?'Add':'Προσθήκη'} trigger={<><Plus size={15} aria-hidden="true"/>{en?'Add':'Προσθήκη'}</>} items={addItems}/>}</div>
     {selectedEvents.length?<ul className="calendar-agenda">{selectedEvents.map(e=><EventRow key={e.id} event={e} language={language} onOpen={()=>navigate(e.path)}/>)}</ul>:<div className="inline-empty">{en?'Nothing scheduled.':'Δεν υπάρχει κάτι προγραμματισμένο.'}{nextDay&&<button type="button" className="calendar-next-day" onClick={()=>openDay(nextDay)}>{en?'Next':'Επόμενο'}: <strong>{fmtShort(nextDay)}</strong> · {byDay.get(nextDay)[0].title}<ChevronRight size={14} aria-hidden="true"/></button>}</div>}
    </aside>
   </div>:<div className="calendar-list scroll-panel">
    {overdue.length>0&&<section><h4 className="calendar-list-heading danger">{en?'Overdue':'Εκπρόθεσμα'} · {overdue.length}</h4><ul className="calendar-agenda">{overdue.map(e=><EventRow key={e.id} event={e} language={language} date={fmtShort(e.date)} onOpen={()=>navigate(e.path)}/>)}</ul></section>}
    {groupByDate(upcoming.filter(e=>e.state!=='overdue')).map(([key,list])=><section key={key}><h4 className={`calendar-list-heading ${key===today?'today':''}`}>{key===today?(en?'Today':'Σήμερα'):fmtDay(key)}</h4><ul className="calendar-agenda">{list.map(e=><EventRow key={e.id} event={e} language={language} onOpen={()=>navigate(e.path)}/>)}</ul></section>)}
    {!upcoming.length&&!filtersHideAll&&<div className="registry-empty-state"><strong>{en?'Nothing pending':'Δεν υπάρχουν εκκρεμότητες'}</strong></div>}
   </div>}
  </section>
 </Page>
}

function EventRow({event,language,date,onOpen}){
 const en=language==='en'
 return <li><button type="button" className={`calendar-event kind-${event.kind} ${event.state}`} onClick={onOpen}>
  <span className="calendar-event-when">{date||event.time||''}</span>
  <span className="calendar-event-main"><strong title={event.title}>{event.title}</strong><small>{[calendarKindLabel(event.kind,language),event.detail,event.department].filter(Boolean).join(' · ')}</small></span>
  {event.state==='overdue'&&<span className="status-badge danger">{en?'Overdue':'Εκπρόθεσμο'}</span>}
  {/* The controls' executions keep the colours of their own calendar: done, late, missed, planned. */}
  {event.kind==='controls'&&['done','late','missed','planned'].includes(event.state)&&<span className={`status-badge calendar-execution ${event.state}`}>{event.detail||stateLabel(event.state,en)}</span>}
  {event.criticality==='high'&&<span className="status-badge danger">{en?'High':'Υψηλή'}</span>}
  <ChevronRight size={16} aria-hidden="true"/>
 </button></li>
}

function groupByDate(events){const map=new Map();for(const e of events){const list=map.get(e.date)||[];list.push(e);map.set(e.date,list)}return [...map.entries()].slice(0,45)}
function stateLabel(state,en){return ({overdue:en?'Overdue':'Εκπρόθεσμο',due:en?'Due':'Προς εκτέλεση',planned:en?'Planned':'Προγραμματισμένο',done:en?'Done':'Ολοκληρώθηκε',late:en?'Done late':'Έγινε με καθυστέρηση',missed:en?'Missed':'Χάθηκε'})[state]||state}
