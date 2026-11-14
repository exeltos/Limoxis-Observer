import { useCallback,useEffect,useMemo,useState } from 'react'
import { CalendarDays,ChevronLeft,ChevronRight,ListChecks } from 'lucide-react'
import { useNavigate,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { RouteLoading } from '../../design-system/RouteLoading'
import { FilterSelect } from '../../design-system/FilterBar'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can } from '../../core/permissions/roles'
import { registryMenu } from '../../core/export/registryExports'
import { programmeCalendar } from '../controls/controlCalendar'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { loadControlCalendarMonths } from '../controls/controlCloudService'
import { calendarKindsFor,useCalendarSources } from './useCalendarSources'
import { type CalendarEvent,CALENDAR_KINDS,buildCalendarEvents,calendarFilterLabel,calendarFilterOf,calendarFiltersFor,calendarKindLabel,controlExecutionEvents,dayKey,monthGrid,parseCalendarFilter } from './calendarEvents'
import type { CalendarMonthCount } from '../controls/controlCloudService'
import './calendar.css'

const WEEKDAYS={el:['Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ','Κυρ'],en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
// A day cell shows one line per module: its dot, the count and the name (singular / plural).
const KIND_COUNT: Record<string, string[]>={controls:['έλεγχος','έλεγχοι','control','controls'],cultures:['καλλιέργεια','καλλιέργειες','culture','cultures'],capa:['διορθωτική ενέργεια','διορθωτικές ενέργειες','corrective action','corrective actions'],audits:['επιθεώρηση','επιθεωρήσεις','audit','audits'],training:['εκπαίδευση','εκπαιδεύσεις','training','trainings'],documents:['έγγραφο','έγγραφα','document','documents'],committees:['επιτροπή','επιτροπές','committee item','committee items'],suppliers:['αξιολόγηση προμηθευτή','αξιολογήσεις προμηθευτών','supplier evaluation','supplier evaluations'],kitchen:['εκκρεμότητα κουζίνας','εκκρεμότητες κουζίνας','kitchen item','kitchen items']}
// Short module names for narrow day cells (the full name stays in the tooltip).
const KIND_SHORT: Array<Record<string, string>>=[{controls:'Έλεγχοι',cultures:'Καλλιέργ.',capa:'CAPA',audits:'Επιθ.',training:'Εκπαίδ.',documents:'Έγγρ.',committees:'Επιτρ.',suppliers:'Προμ.',kitchen:'Κουζ.'},{controls:'Controls',cultures:'Cultures',capa:'CAPA',audits:'Audits',training:'Training',documents:'Docs',committees:'Comm.',suppliers:'Suppl.',kitchen:'Kitchen'}]
const countLabel=(kind: string,n: number,en: boolean)=>{const forms=KIND_COUNT[kind]||['','','','' ];const word=en?(n===1?forms[2]:forms[3]):(n===1?forms[0]:forms[1]);return word.charAt(0).toLocaleUpperCase(en?'en':'el')+word.slice(1)}
const overdueLabel=(n: number,en: boolean)=>en?`${n} overdue`:`${n} εκπρόθεσμ${n===1?'ο':'α'}`

// One calendar of what has to be done across the hospital: control due dates,
// CAPA and step deadlines, effectiveness reviews, planned audits, training
// deadlines and certificate expiries, document reviews, committee meetings
// and decisions. Each source is loaded only when the user may see it.
// departmentOnly: the department's own calendar (My department › Calendar): the same days, with the culture sampling first and
// the next sampling on top.
export function CalendarPage({departmentOnly=false}: { departmentOnly?: boolean }={}){
 const {language,locale}=useLanguage();const en=language==='en'
 const {notify}=useFeedback()
 const {tenant,role,membership,canAccessRecord,isDemo}=useTenant()
 const userId=useAuditActor()?.id||null
 const navigate=useNavigate()
 const mayDo=(capability: string)=>can(role,capability,membership?.capabilities??[],membership?.customCapabilities??[])
 // The culture calendar is for whoever sees the Quality Center (or the controls): it shows that one source only.
 const allowedKey=calendarKindsFor(mayDo).join(',')
 const allowedKinds=useMemo(()=>allowedKey?allowedKey.split(','):[],[allowedKey])
 const [cursor,setCursor]=useState(()=>{const d=new Date();return {year:d.getFullYear(),month:d.getMonth()}})
 const [selected,setSelected]=useState(()=>dayKey(new Date()))
 const [view,setView]=useState('month')
 // The chips (controls, trainings, meetings, expiries, other) live in the address: ?filter=controls opens only the controls.
 const [searchParams,setSearchParams]=useSearchParams()
 const filterKinds=useMemo(()=>calendarFiltersFor(allowedKinds),[allowedKinds])
 const filterParam=searchParams.get('filter')||''
 const picked=useMemo(()=>parseCalendarFilter(filterParam),[filterParam])
 const isOn=useCallback((filter: string)=>!picked||picked.has(filter),[picked])
 // The controls' done, late and missed executions of the shown year (counted in the database; null in the demo).
 const [controlMonths,setControlMonths]=useState<{ year: number | null, months: Map<string, CalendarMonthCount[]> | null }>({year:null,months:null})
 const [department,setDepartment]=useState('all')
 // A module line in a day cell narrows that day's panel to the module.
 const [panelKind,setPanelKind]=useState<string|null>(null)

 const sources=useCalendarSources(tenant?.id,allowedKinds,language)

 const controlsAllowed=allowedKinds.includes('controls')||allowedKinds.includes('cultures')
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
 const byDay=useMemo(()=>{const map=new Map<string, CalendarEvent[]>();for(const e of events){const list=map.get(e.date)||[];list.push(e);map.set(e.date,list)}return map},[events])
 const overdue=events.filter(e=>e.state==='overdue')
 const monthKey=`${cursor.year}-${String(cursor.month+1).padStart(2,'0')}`
 const monthEvents=events.filter(e=>e.date.startsWith(monthKey))
 // Modules switched off or a department chosen, and nothing left this month: say it is the filters.
 const filtered=Boolean(picked)||department!=='all'
 const upcoming=events.filter(e=>!['done','late','missed'].includes(e.state)&&(e.state==='overdue'||e.date>=today)).slice(0,200)
 const monthTitle=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date(cursor.year,cursor.month,1))
 const fmtDay=(key: string)=>new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${key}T12:00:00`))
 const fmtShort=(key: string)=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short'}).format(new Date(`${key}T12:00:00`))

 function moveMonth(step: number){setCursor(c=>{const d=new Date(c.year,c.month+step,1);return {year:d.getFullYear(),month:d.getMonth()}})}
 function openDay(key: string){setCursor({year:Number(key.slice(0,4)),month:Number(key.slice(5,7))-1});setSelected(key);setPanelKind(null)}
 function goToday(){const d=new Date();setCursor({year:d.getFullYear(),month:d.getMonth()});setSelected(dayKey(d));setPanelKind(null)}
 function setFilter(next: Set<string> | null){setSearchParams(current=>{const params=new URLSearchParams(current);if(!next||filterKinds.every(filter=>next.has(filter)))params.delete('filter');else params.set('filter',[...next].join(',')||'none');return params},{replace:true})}
 function clearFilters(){setFilter(null);setDepartment('all')}
 function toggleFilter(filter: string){const next=new Set(filterKinds.filter(isOn));if(next.has(filter))next.delete(filter);else next.add(filter);setFilter(next)}
 function monthExport(){
  return ({name:en?`calendar-${monthKey}`:`imerologio-${monthKey}`,
   headers:en?['Date','Time','Module','Item','Detail','Department','Status']:['Ημερομηνία','Ώρα','Ενότητα','Θέμα','Λεπτομέρεια','Τμήμα','Κατάσταση'],
   rows:[...overdue.filter(e=>!e.date.startsWith(monthKey)),...monthEvents].map(e=>[new Intl.DateTimeFormat(locale).format(new Date(`${e.date}T12:00:00`)),e.time||'',calendarKindLabel(e.kind,language),e.title,e.detail||'',e.department||'',stateLabel(e.state,en)])})
 }

 const filtersHideAll=filtered&&(view==='month'?!monthEvents.length:!upcoming.length)
 if(!sources)return <RouteLoading/>
 // In the department's calendar the culture sampling comes first in every day, and the next one is on top of the page.
 const dayKinds=departmentOnly?['cultures',...CALENDAR_KINDS.filter(kind=>kind!=='cultures')]:CALENDAR_KINDS
 const dayEvents=byDay.get(selected)||[]
 const selectedEvents=panelKind?dayEvents.filter(e=>e.kind===panelKind):dayEvents
 // An empty day points to the next day that has something, so a quiet day is never a dead end.
 const nextDay=dayEvents.length?null:[...byDay.keys()].filter(key=>key>selected).sort()[0]||null
 return <Page fill className="calendar-page" title={departmentOnly?(en?'Department calendar':'Ημερολόγιο τμήματος'):(en?'Calendar':'Ημερολόγιο')} subtitle={departmentOnly?(en?'What concerns your department by date: the culture samples that will be taken, controls, trainings and deadlines.':'Ό,τι αφορά το τμήμα σας ανά ημερομηνία: οι καλλιέργειες που θα παρθούν, έλεγχοι, εκπαιδεύσεις και προθεσμίες.'):(en?'Everything that has to be done, from every module, by date.':'Όλα όσα πρέπει να γίνουν, από όλες τις ενότητες, ανά ημερομηνία.')} actions={<ExportMenu disabled={!monthEvents.length&&!overdue.length} {...registryMenu(monthExport,{language,kind:en?'Calendar':'Ημερολόγιο',title:`${en?'Calendar':'Ημερολόγιο'} ${monthKey}`,onBlocked:()=>notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')})}/>}>
  <CanonicalTabs value={view} onChange={setView} ariaLabel={en?'Calendar view':'Προβολή ημερολογίου'} items={[{value:'month',label:en?'Month':'Μήνας',icon:CalendarDays},{value:'list',label:`${en?'To do':'Εκκρεμότητες'}${overdue.length?` · ${overdueLabel(overdue.length,en)}`:''}`,icon:ListChecks}]}/>
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
       {dayKinds.map(kind=>{const items=list.filter(e=>e.kind===kind);if(!items.length)return null;const late=items.filter(e=>e.state==='overdue').length;const name=countLabel(kind,items.length,en);const full=`${items.length} ${name}${late?` · ${overdueLabel(late,en)}`:''}`
        return <button type="button" key={kind} className={`calendar-kind-line kind-${kind}${late?' overdue':''}${key===selected&&panelKind===kind?' active':''}`} title={full} aria-label={full} onClick={event=>{event.stopPropagation();setSelected(key);setPanelKind(kind)}}><span className="calendar-dot"/><b>{items.length}</b><span className="calendar-kind-name full">{name}</span><span className="calendar-kind-name short" aria-hidden="true">{KIND_SHORT[en?1:0][kind]||name}</span>{late>0&&<small className="calendar-kind-late">{overdueLabel(late,en)}</small>}</button>})}
      </div>})}
     </div>
    </div>
    <aside className="calendar-day-panel" aria-live="polite">
     <div className="calendar-day-panel-head"><h4>{fmtDay(selected)}</h4>{panelKind&&<span className="calendar-panel-kind"><span className={`calendar-dot kind-${panelKind}`}/>{calendarKindLabel(panelKind,language)}</span>}</div>
     {selectedEvents.length?<ul className="calendar-agenda">{selectedEvents.map(e=><EventRow key={e.id} event={e} language={language} onOpen={()=>navigate(e.path as string)}/>)}</ul>:<div className="inline-empty">{en?'Nothing scheduled.':'Δεν υπάρχει κάτι προγραμματισμένο.'}{nextDay&&<button type="button" className="calendar-next-day" onClick={()=>openDay(nextDay)}>{en?'Next':'Επόμενο'}: <strong>{fmtShort(nextDay)}</strong> · {byDay.get(nextDay)?.[0].title}<ChevronRight size={14} aria-hidden="true"/></button>}</div>}
    </aside>
   </div>:<div className="calendar-list scroll-panel">
    {overdue.length>0&&<section><h4 className="calendar-list-heading danger">{en?'Overdue':'Εκπρόθεσμα'} · {overdue.length}</h4><ul className="calendar-agenda">{overdue.map(e=><EventRow key={e.id} event={e} language={language} date={fmtShort(e.date)} onOpen={()=>navigate(e.path as string)}/>)}</ul></section>}
    {groupByDate(upcoming.filter(e=>e.state!=='overdue')).map(([key,list])=><section key={key}><h4 className={`calendar-list-heading ${key===today?'today':''}`}>{key===today?(en?'Today':'Σήμερα'):fmtDay(key)}</h4><ul className="calendar-agenda">{list.map(e=><EventRow key={e.id} event={e} language={language} onOpen={()=>navigate(e.path as string)}/>)}</ul></section>)}
    {!upcoming.length&&!filtersHideAll&&<div className="registry-empty-state"><strong>{en?'Nothing pending':'Δεν υπάρχουν εκκρεμότητες'}</strong></div>}
   </div>}
  </section>
 </Page>
}

function EventRow({event,language,date,onOpen}: { event: CalendarEvent, language: string, date?: string, onOpen: () => void }){
 const en=language==='en'
 return <li><button type="button" className={`calendar-event kind-${event.kind} ${event.state}`} onClick={onOpen}>
  <span className="calendar-event-when">{date||event.time||''}</span>
  <span className="calendar-event-main"><strong title={event.title}>{event.title}</strong><small>{[calendarKindLabel(event.kind,language),event.detail,event.department].filter(Boolean).join(' · ')}</small></span>
  {event.state==='overdue'&&<span className="status-badge danger">{en?'Overdue':'Εκπρόθεσμο'}</span>}
  {/* The controls' executions keep the colours of their own calendar: done, late, missed, planned. */}
  {['controls','cultures'].includes(event.kind)&&['done','late','missed','planned'].includes(event.state)&&<span className={`status-badge calendar-execution ${event.state}`}>{event.detail||stateLabel(event.state,en)}</span>}
  {event.criticality==='high'&&<span className="status-badge danger">{en?'High':'Υψηλή'}</span>}
  <ChevronRight size={16} aria-hidden="true"/>
 </button></li>
}

function groupByDate(events: CalendarEvent[]){const map=new Map<string, CalendarEvent[]>();for(const e of events){const list=map.get(e.date)||[];list.push(e);map.set(e.date,list)}return [...map.entries()].slice(0,45)}
function stateLabel(state: string | undefined,en: boolean){return ({overdue:en?'Overdue':'Εκπρόθεσμο',due:en?'Due':'Προς εκτέλεση',planned:en?'Planned':'Προγραμματισμένο',done:en?'Done':'Ολοκληρώθηκε',late:en?'Done late':'Έγινε με καθυστέρηση',missed:en?'Missed':'Χάθηκε'} as Record<string, string>)[state||'']||state}
