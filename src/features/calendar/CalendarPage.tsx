import { useCallback,useEffect,useMemo,useState } from 'react'
import { CalendarDays,ChevronLeft,ChevronRight,ListChecks } from 'lucide-react'
import { useNavigate,useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { RouteLoading } from '../../design-system/RouteLoading'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { SegmentedControl } from '../../design-system/SegmentedControl'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can } from '../../core/permissions/roles'
import { registryMenu } from '../../core/export/registryExports'
import { programmeCalendar } from '../controls/controlCalendar'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { loadControlCalendarMonths } from '../controls/controlCloudService'
import { calendarKindsFor,useCalendarSources } from './useCalendarSources'
import { type CalendarEvent,CALENDAR_KINDS,buildCalendarEvents,calendarFilterLabel,calendarFilterOf,calendarFiltersFor,calendarKindLabel,controlExecutionEvents,monthGrid,parseCalendarFilter } from './calendarEvents'
import { type CalendarGroup,addDay,calendarDayParam,calendarFilterCounts,calendarItemLine,calendarTypeLabel,dayCellGroups,dueInText,eventInDepartment,eventWithinScope,groupCalendarEvents,hasSingleDepartment,monthGlance,nextDaysGroups,overdueDurationText,pendingEvents,personInitials,searchCalendarGroups } from './calendarView'
import { useCalendarScope } from './useCalendarScope'
import type { CalendarMonthCount } from '../controls/controlCloudService'
import './calendar.css'

const WEEKDAYS={el:['Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ','Κυρ'],en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
const overdueLabel=(n: number,en: boolean)=>en?`${n} overdue`:`${n} εκπρόθεσμ${n===1?'ο':'α'}`
const numericDate=(key: string)=>key.split('-').reverse().join('/')
// The height of an element (the month grid, a card's list), so the lines shown fit it without a scroll bar.
function useHeight<T extends HTMLElement>(){
 const [node,setNode]=useState<T|null>(null)
 const [height,setHeight]=useState(0)
 useEffect(()=>{
  if(!node||typeof ResizeObserver==='undefined')return undefined
  const observer=new ResizeObserver(([entry])=>setHeight(entry.contentRect.height))
  observer.observe(node)
  return()=>observer.disconnect()
 },[node])
 return [setNode,height] as const
}

// One calendar of what has to be done across the hospital: control due dates,
// CAPA and step deadlines, effectiveness reviews, planned audits, training
// deadlines and certificate expiries, document reviews, committee meetings
// and decisions. Each source is loaded only when the user may see it.
// departmentOnly: the department's own calendar (My department › Calendar): the same days, with the culture sampling first.
// Month: the weeks share the page's height (no scrolling) and the right column has the month at a glance, the chosen day
// and the next 7 days. To do: the overdue items or those of the next 30 days, one row for the same item of many people.
export function CalendarPage({departmentOnly=false}: { departmentOnly?: boolean }={}){
 const {language,locale}=useLanguage();const en=language==='en'
 const {notify}=useFeedback()
 const {tenant,role,membership,isDemo}=useTenant()
 const calendarScope=useCalendarScope()
 const userId=useAuditActor()?.id||null
 const navigate=useNavigate()
 const mayDo=(capability: string)=>can(role,capability,membership?.capabilities??[],membership?.customCapabilities??[])
 // The culture calendar is for whoever sees the Quality Center (or the controls): it shows that one source only.
 const allowedKey=calendarKindsFor(mayDo).join(',')
 const allowedKinds=useMemo(()=>allowedKey?allowedKey.split(','):[],[allowedKey])
 const today=hospitalToday()
 // The chips (controls, trainings, meetings, expiries, other) live in the address: ?filter=controls opens only the controls.
 const [searchParams,setSearchParams]=useSearchParams()
 // ?day=YYYY-MM-DD (a day of the administrator's «Η εβδομάδα») opens that day's month with the day chosen.
 const startDay=calendarDayParam(searchParams.get('day'))||today
 const [cursor,setCursor]=useState(()=>({year:Number(startDay.slice(0,4)),month:Number(startDay.slice(5,7))-1}))
 const [selected,setSelected]=useState(startDay)
 const [dayOpen,setDayOpen]=useState(false)
 // To do: the overdue items or the next 30 days, a search, the page of the table and the rows opened to their people.
 const [scope,setScope]=useState<'overdue'|'upcoming'|null>(null)
 const [query,setQuery]=useState('')
 const [page,setPage]=useState(1)
 const [pageSize,setPageSize]=useState(15)
 const [expanded,setExpanded]=useState<Set<string>>(()=>new Set())
 // ?view=list opens «Εκκρεμότητες» (the user's home links its overdue figure there).
 const [view,setView]=useState(()=>searchParams.get('view')==='list'?'list':'month')
 const filterKinds=useMemo(()=>calendarFiltersFor(allowedKinds),[allowedKinds])
 const filterParam=searchParams.get('filter')||''
 const picked=useMemo(()=>parseCalendarFilter(filterParam),[filterParam])
 const isOn=useCallback((filter: string)=>!picked||picked.has(filter),[picked])
 // The controls' done, late and missed executions of the shown year (counted in the database; null in the demo).
 const [controlMonths,setControlMonths]=useState<{ year: number | null, months: Map<string, CalendarMonthCount[]> | null }>({year:null,months:null})
 const [department,setDepartment]=useState('all')
 // A department role with one department has nothing to choose: no «Department» select, and the title names the department.
 const singleDepartment=hasSingleDepartment(role,membership)
 const departmentName=String(membership?.previewDepartment||membership?.departmentName||'')
 const departmentView=departmentOnly||singleDepartment
 const [gridRef,gridHeight]=useHeight<HTMLDivElement>()
 const [nextRef,nextHeight]=useHeight<HTMLUListElement>()
 const [sideRef,sideHeight]=useHeight<HTMLElement>()

 const sources=useCalendarSources(tenant?.id,allowedKinds,language)

 const controlsAllowed=allowedKinds.includes('controls')||allowedKinds.includes('cultures')
 useEffect(()=>{
  if(!controlsAllowed||!tenant?.id){setControlMonths({year:cursor.year,months:null});return undefined}
  let active=true
  loadControlCalendarMonths(tenant.id,cursor.year).then(months=>{if(active)setControlMonths({year:cursor.year,months})}).catch(()=>{if(active)setControlMonths({year:cursor.year,months:null})})
  return()=>{active=false}
 },[controlsAllowed,tenant?.id,cursor.year])
 const weeks=useMemo(()=>monthGrid(cursor.year,cursor.month),[cursor])
 const range=useMemo(()=>{const from=weeks[0][0],last=weeks[weeks.length-1][6];const horizon=addDay(today,60);return {from:from<today?from:today,to:last>horizon?last:horizon}},[weeks,today])
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
 const departments=useMemo(()=>[...new Set(allEvents.filter(e=>eventWithinScope(e,calendarScope)).map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[allEvents,language,calendarScope])
 // scoped: what the user may see (eventWithinScope) in the chosen department; the chips' counts are taken from it, so a chip turned off keeps its number.
 const scoped=useMemo(()=>allEvents.filter(e=>allowedKinds.includes(e.kind)&&(department==='all'||eventInDepartment(e,department))&&eventWithinScope(e,calendarScope)),[allEvents,allowedKinds,department,calendarScope])
 const events=useMemo(()=>scoped.filter(e=>isOn(calendarFilterOf(e))),[scoped,isOn])
 const byDay=useMemo(()=>{const map=new Map<string, CalendarEvent[]>();for(const e of events){const list=map.get(e.date)||[];list.push(e);map.set(e.date,list)}return map},[events])
 const overdue=events.filter(e=>e.state==='overdue')
 const monthKey=`${cursor.year}-${String(cursor.month+1).padStart(2,'0')}`
 const monthEvents=events.filter(e=>e.date.startsWith(monthKey))
 // Modules switched off or a department chosen, and nothing left this month: say it is the filters.
 const filtered=Boolean(picked)||department!=='all'
 const upcomingList=pendingEvents(events,{today,scope:'upcoming'})
 const activeScope=scope||(overdue.length||!upcomingList.length?'overdue':'upcoming')
 const scopeEvents=activeScope==='overdue'?overdue:upcomingList
 const groups=useMemo(()=>searchCalendarGroups(groupCalendarEvents(scopeEvents),query,language),[scopeEvents,query,language])
 const totalPages=Math.max(1,Math.ceil(groups.length/pageSize)),safePage=Math.min(page,totalPages)
 const pageGroups=groups.slice((safePage-1)*pageSize,safePage*pageSize)
 const monthTitle=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date(cursor.year,cursor.month,1))
 const fmtDay=(key: string)=>new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${key}T12:00:00`))
 const fmtShort=(key: string)=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short'}).format(new Date(`${key}T12:00:00`))
 const fmtWeekday=(key: string)=>new Intl.DateTimeFormat(locale,{weekday:'short'}).format(new Date(`${key}T12:00:00`)).replace('.','')

 function moveMonth(step: number){setCursor(c=>{const d=new Date(c.year,c.month+step,1);return {year:d.getFullYear(),month:d.getMonth()}})}
 function openDay(key: string){setCursor({year:Number(key.slice(0,4)),month:Number(key.slice(5,7))-1});setSelected(key)}
 function goToday(){setCursor({year:Number(today.slice(0,4)),month:Number(today.slice(5,7))-1});setSelected(today)}
 function setFilter(next: Set<string> | null){setPage(1);setSearchParams(current=>{const params=new URLSearchParams(current);if(!next||filterKinds.every(filter=>next.has(filter)))params.delete('filter');else params.set('filter',[...next].join(',')||'none');return params},{replace:true})}
 function clearFilters(){setFilter(null);setDepartment('all');setQuery('')}
 function toggleFilter(filter: string){const next=new Set(filterKinds.filter(isOn));if(next.has(filter))next.delete(filter);else next.add(filter);setFilter(next)}
 function toggleGroup(key: string){setExpanded(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next})}
 // A row of many people (or departments) opens to them; a single item opens its record.
 function openGroup(group: CalendarGroup){if(group.items.length>1)toggleGroup(group.key);else navigate(group.first.path as string)}
 function openPending(){setView('list');setScope('upcoming');setPage(1)}
 function monthExport(){
  return ({name:en?`calendar-${monthKey}`:`imerologio-${monthKey}`,
   headers:en?['Date','Time','Module','Item','Detail','Department','Status']:['Ημερομηνία','Ώρα','Ενότητα','Θέμα','Λεπτομέρεια','Τμήμα','Κατάσταση'],
   rows:[...overdue.filter(e=>!e.date.startsWith(monthKey)),...monthEvents].map(e=>[new Intl.DateTimeFormat(locale).format(new Date(`${e.date}T12:00:00`)),e.time||'',calendarKindLabel(e.kind,language),e.title,e.detail||'',e.department||e.audience||'',stateLabel(e.state,en)])})
 }

 const filtersHideAll=filtered&&view==='month'&&!monthEvents.length
 if(!sources)return <RouteLoading/>
 // In the department's calendar the culture sampling comes first in every day.
 const dayKinds=departmentOnly?['cultures',...CALENDAR_KINDS.filter(kind=>kind!=='cultures')]:CALENDAR_KINDS
 const dayEvents=byDay.get(selected)||[]
 // An empty day points to the next day that has something, so a quiet day is never a dead end.
 const nextDay=dayEvents.length?null:[...byDay.keys()].filter(key=>key>selected).sort()[0]||null
 // The lines a day cell has room for (up to 3; the rest as «+N» beside the day's number), from the height of the weeks.
 const rowHeight=gridHeight?(gridHeight-24-5*weeks.length)/weeks.length:0
 const dayLines=rowHeight?Math.max(1,Math.min(3,Math.floor((rowHeight-30)/20))):3
 const glance=monthGlance(events,{monthKey,today})
 const nextGroups=nextDaysGroups(events,today)
 const nextFit=nextHeight?Math.max(1,Math.floor(nextHeight/40)):6
 const nextShown=nextGroups.slice(0,nextFit)
 // The chosen day keeps up to 3 items; a short screen (a tablet) leaves the rest of the column to the next 7 days.
 const dayShown=dayEvents.slice(0,sideHeight&&sideHeight<420?1:sideHeight&&sideHeight<560?2:3)
 const chipCounts=calendarFilterCounts(view==='month'?scoped.filter(e=>e.date.startsWith(monthKey)):pendingEvents(scoped,{today,scope:activeScope}))
 const chips=<div className="calendar-kinds" role="group" aria-label={en?'Show':'Εμφάνιση'}>{filterKinds.filter(filter=>view==='month'||chipCounts[filter]||!isOn(filter)).map(filter=><button key={filter} type="button" className={`calendar-kind-toggle filter-${filter} ${isOn(filter)?'':'off'}`} aria-pressed={isOn(filter)} onClick={()=>toggleFilter(filter)}><span className="calendar-dot"/>{calendarFilterLabel(filter,language,departmentView)}<b className="calendar-kind-count">{chipCounts[filter]||0}</b></button>)}</div>
 const departmentSelect=singleDepartment?null:<div className="calendar-department"><FilterSelect label={en?'Department':'Τμήμα'} value={department} onChange={value=>{setDepartment(value);setPage(1)}}><option value="all">{en?'All':'Όλα'}</option>{departments.map(d=><option key={d} value={d}>{d}</option>)}</FilterSelect></div>
 const title=departmentView?`${en?'Department calendar':'Ημερολόγιο τμήματος'}${departmentName?` · ${departmentName}`:''}`:(en?'Calendar':'Ημερολόγιο')
 const subtitle=departmentView?(en?'Controls, cultures, trainings, department meetings and expiries, by date.':'Έλεγχοι, καλλιέργειες, εκπαιδεύσεις, συναντήσεις και λήξεις του τμήματος, ανά ημερομηνία.'):(en?'Everything that has to be done, from every module, by date.':'Όλα όσα πρέπει να γίνουν, από όλες τις ενότητες, ανά ημερομηνία.')
 const lateColumn=activeScope==='overdue'?(en?'Overdue by':'Καθυστέρηση'):(en?'Due':'Προθεσμία')
 return <Page fill className="calendar-page" title={title} subtitle={subtitle} actions={<ExportMenu disabled={!monthEvents.length&&!overdue.length} {...registryMenu(monthExport,{language,kind:en?'Calendar':'Ημερολόγιο',title:`${en?'Calendar':'Ημερολόγιο'} ${monthKey}`,onBlocked:()=>notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')})}/>}>
  <CanonicalTabs value={view} onChange={setView} ariaLabel={en?'Calendar view':'Προβολή ημερολογίου'} items={[{value:'month',label:en?'Month':'Μήνας',icon:CalendarDays},{value:'list',label:`${en?'To do':'Εκκρεμότητες'}${overdue.length?` · ${overdueLabel(overdue.length,en)}`:''}`,icon:ListChecks}]}/>
  {view==='month'?<div className="calendar-month-view">
   <div className="calendar-toolbar">
    <div className="calendar-month-head"><IconButton label={en?'Previous month':'Προηγούμενος μήνας'} onClick={()=>moveMonth(-1)}><ChevronLeft size={18}/></IconButton><h3>{monthTitle}</h3><IconButton label={en?'Next month':'Επόμενος μήνας'} onClick={()=>moveMonth(1)}><ChevronRight size={18}/></IconButton></div>
    <Button variant="secondary" onClick={goToday}>{en?'Today':'Σήμερα'}</Button>
    {chips}
    {departmentSelect}
   </div>
   {filtersHideAll&&<div className="calendar-filter-empty"><RegistryEmptyState filtered title={en?'Nothing pending with the selected filters':'Δεν υπάρχουν εκκρεμότητες με τα επιλεγμένα φίλτρα'} text={en?'Turn a module back on or choose another department.':'Ενεργοποιήστε ξανά μια ενότητα ή επιλέξτε άλλο τμήμα.'} onClearFilters={clearFilters}/></div>}
   <div className="calendar-month-layout">
    <div className="calendar-month surface">
     <div ref={gridRef} className="calendar-grid" role="grid" aria-label={monthTitle}>
      {WEEKDAYS[en?'en':'el'].map(d=><div key={d} className="calendar-weekday" role="columnheader">{d}</div>)}
      {weeks.flat().map((key,index)=>{const list=byDay.get(key)||[];const outside=!key.startsWith(monthKey);const late=list.some(e=>e.state==='overdue');const lines=dayCellGroups(list,dayKinds);const shown=lines.slice(0,dayLines);const more=lines.length-shown.length
       // The day selects its agenda in the right column; an item there opens its record.
       return <div key={key} role="gridcell" tabIndex={0} className={`calendar-day ${outside?'outside':''} ${index%7>4?'weekend':''} ${key===today?'today':''} ${key===selected?'selected':''} ${late?'has-overdue':''}`} onClick={()=>setSelected(key)} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();setSelected(key)}}} aria-label={`${fmtDay(key)}: ${list.length}`} aria-selected={key===selected}>
       <span className="calendar-day-head"><span className="calendar-day-number">{Number(key.slice(8))}</span>{more>0&&<small className="calendar-day-more">+{more}</small>}</span>
       {shown.map(group=>{const line=calendarItemLine(group.first,language);const text=group.items.length>1?`${line} · ${group.items.length}`:line
        return <span key={group.key} className={`calendar-item filter-${calendarFilterOf(group.first)}${group.first.state==='overdue'?' overdue':''}`} title={text}><span className="calendar-dot"/><span className="calendar-item-text">{text}</span></span>})}
      </div>})}
     </div>
    </div>
    <aside ref={sideRef} className="calendar-side" aria-live="polite">
     <section className="calendar-card calendar-glance"><h4>{en?'The month at a glance':'Ο μήνας με μια ματιά'}</h4>
      <div className="calendar-glance-grid">
       <div className={glance.overdue?'danger':''}><strong>{glance.overdue}</strong><span>{en?'overdue':'εκπρόθεσμα'}</span></div>
       <div><strong>{glance.week}</strong><span>{en?'this week':'αυτή την εβδομάδα'}</span></div>
       <div><strong>{glance.training}</strong><span>{en?'trainings':'εκπαιδεύσεις'}</span></div>
       <div><strong>{glance.expiries}</strong><span>{en?'expiries':'λήξεις'}</span></div>
      </div>
     </section>
     <section className="calendar-card calendar-day-card"><div className="calendar-card-head"><h4>{fmtDay(selected)}</h4>{dayEvents.length>dayShown.length&&<button type="button" className="calendar-card-more" onClick={()=>setDayOpen(true)}>+{dayEvents.length-dayShown.length} {en?'more':'ακόμη'}</button>}</div>
      {dayShown.length?<ul className="calendar-agenda">{dayShown.map(e=><EventRow key={e.id} event={e} language={language} onOpen={()=>navigate(e.path as string)}/>)}</ul>:<div className="calendar-card-empty">{selected===today?(en?'Nothing scheduled today.':'Τίποτα προγραμματισμένο σήμερα.'):(en?'Nothing scheduled.':'Δεν υπάρχει κάτι προγραμματισμένο.')}{nextDay&&<button type="button" className="calendar-next-day" onClick={()=>openDay(nextDay)}>{en?'Next':'Επόμενο'}: <strong>{fmtShort(nextDay)}</strong> · {byDay.get(nextDay)?.[0].title}<ChevronRight size={14} aria-hidden="true"/></button>}</div>}
     </section>
     <section className="calendar-card calendar-next-card"><div className="calendar-card-head"><h4>{en?'Next 7 days':'Επόμενες 7 ημέρες'}</h4>{nextGroups.length>nextShown.length&&<button type="button" className="calendar-card-more" onClick={openPending}>+{nextGroups.length-nextShown.length} {en?'more':'ακόμη'}</button>}</div>
      <ul ref={nextRef} className="calendar-next-list">{nextShown.map(group=>{const filter=calendarFilterOf(group.first)
       return <li key={group.key}><button type="button" className={`calendar-next-item filter-${filter}`} onClick={()=>navigate(group.first.path as string)}>
        <span className="calendar-next-date"><small>{fmtWeekday(group.date)}</small><b>{Number(group.date.slice(8))}</b></span>
        <span className="calendar-dot"/><span className="calendar-next-title" title={group.first.title}>{calendarItemLine(group.first,language)}{group.items.length>1?` · ${group.items.length}`:''}</span>
        {filter==='expiries'&&<span className="calendar-expiry-badge">{en?'expires':'λήγει'}</span>}
       </button></li>})}
       {!nextGroups.length&&<li className="calendar-card-empty">{en?'Nothing in the next 7 days.':'Τίποτα τις επόμενες 7 ημέρες.'}</li>}
      </ul>
     </section>
    </aside>
   </div>
  </div>:<section className="surface registry-workspace workspace-column workspace-fill calendar-pending">
   <FilterBar query={query} onQueryChange={value=>{setQuery(value);setPage(1)}} placeholder={en?'Search…':'Αναζήτηση…'} end={<>
    <SegmentedControl className="calendar-scope" ariaLabel={en?'Which items':'Ποιες εκκρεμότητες'} value={activeScope} onChange={value=>{setScope(value as 'overdue'|'upcoming');setPage(1)}} options={[{value:'overdue',label:`${en?'Overdue':'Εκπρόθεσμα'} (${overdue.length})`},{value:'upcoming',label:`${en?'Next 30 days':'Επόμενες 30 ημέρες'} (${upcomingList.length})`}]}/>
    {chips}
    {departmentSelect}
   </>}/>
   <RegistryTable className="calendar-pending-table" sortable={false} columns={[{key:'date',label:en?'From':'Από'},{key:'what',label:en?'What':'Τι'},{key:'kind',label:en?'Kind':'Είδος'},{key:'who',label:en?'Who':'Ποιοι'},{key:'late',label:lateColumn}]}
    rows={pageGroups.flatMap(group=>expanded.has(group.key)&&group.items.length>1?[{group,people:false},{group,people:true}]:[{group,people:false}])}
    rowKey={row=>`${row.group.key}${row.people?'|people':''}`}
    rowProps={row=>row.people?{className:'calendar-pending-people-row'}:{className:`clickable-row${expanded.has(row.group.key)?' is-expanded':''}`,tabIndex:0,'aria-expanded':row.group.items.length>1?expanded.has(row.group.key):undefined,onClick:()=>openGroup(row.group),onKeyDown:event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openGroup(row.group)}}}}
    renderRow={row=>row.people?<td colSpan={5}><ul className="calendar-pending-people">{row.group.items.map(item=><li key={item.id}><button type="button" onClick={()=>navigate(item.path as string)}>{item.person&&<span className="calendar-avatar" aria-hidden="true">{personInitials(item.person)}</span>}<strong>{item.person||item.owner||item.department||item.title}</strong><small>{numericDate(item.date)}</small><small className={item.state==='overdue'?'danger':''}>{item.state==='overdue'?overdueDurationText(item.date,today,language):dueInText(item.date,today,language)}</small></button></li>)}</ul></td>:<PendingCells group={row.group} language={language} today={today} showDepartment={!singleDepartment&&department==='all'}/>}
    emptyTitle={activeScope==='overdue'?(en?'Nothing overdue':'Δεν υπάρχουν εκπρόθεσμα'):(en?'Nothing in the next 30 days':'Τίποτα τις επόμενες 30 ημέρες')} emptyFiltered={Boolean(query)||filtered} onClearFilters={clearFilters}/>
   <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={groups.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>
  </section>}
  {/* The whole chosen day, when the column has room for only some of its items. */}
  {dayOpen&&<ObserverDialog title={fmtDay(selected)} subtitle={`${dayEvents.length} ${en?'items':'εγγραφές'}`} onClose={()=>setDayOpen(false)}><ul className="calendar-agenda">{dayEvents.map(e=><EventRow key={e.id} event={e} language={language} onOpen={()=>navigate(e.path as string)}/>)}</ul></ObserverDialog>}
 </Page>
}

// The cells of a to-do row: from (with the year), what, kind, who, how late.
function PendingCells({group,language,today,showDepartment}: { group: CalendarGroup, language: string, today: string, showDepartment: boolean }){
 const en=language==='en'
 const first=group.first
 const filter=calendarFilterOf(first)
 const owners=[...new Set(group.items.map(e=>e.owner).filter(Boolean))]
 const sub=[first.action??first.detail,showDepartment&&group.departments.length===1?group.departments[0]:'',showDepartment&&!group.departments.length?first.audience:''].filter(Boolean).join(' · ')
 const overdue=first.state==='overdue'
 const who=group.people.length>1?<><span className="calendar-avatars" aria-hidden="true">{group.people.slice(0,3).map(name=><span key={name} className="calendar-avatar">{personInitials(name)}</span>)}</span>{`${group.people.length} ${en?'employees':'εργαζόμενοι'}`}</>
  :group.people.length===1?<><span className="calendar-avatar" aria-hidden="true">{personInitials(group.people[0])}</span>{group.people[0]}</>
  :group.departments.length>1&&group.items.length>1?`${group.departments.length} ${en?'departments':'τμήματα'}`
  :owners.length?owners.join(', '):'—'
 return <>
  <td className="calendar-pending-date">{numericDate(group.date)}</td>
  <td className="calendar-pending-what"><strong>{first.title}</strong>{sub&&<small>{sub}</small>}</td>
  <td><span className={`calendar-pending-kind filter-${filter}`}><span className="calendar-dot"/>{calendarTypeLabel(first,language)}</span></td>
  <td><span className="calendar-pending-who">{who}</span></td>
  <td className="calendar-pending-late"><span className={overdue?'danger':''}>{overdue?overdueDurationText(group.date,today,language):dueInText(group.date,today,language)}</span></td>
 </>
}

// An item of the chosen day: its time, title and detail; it opens its record.
function EventRow({event,language,onOpen}: { event: CalendarEvent, language: string, onOpen: () => void }){
 const en=language==='en'
 return <li><button type="button" className={`calendar-event filter-${calendarFilterOf(event)} ${event.state}`} onClick={onOpen}>
  {event.time&&<span className="calendar-event-when">{event.time}</span>}
  <span className="calendar-event-main"><strong title={event.title}>{calendarItemLine(event,language)}</strong><small>{[event.detail,event.department||event.audience].filter(Boolean).join(' · ')||calendarKindLabel(event.kind,language)}</small></span>
  {/* The controls' executions keep the colours of their own calendar: done, late, missed. */}
  {['controls','cultures'].includes(event.kind)&&['done','late','missed'].includes(event.state)&&<span className={`status-badge calendar-execution ${event.state}`}>{stateLabel(event.state,en)}</span>}
  {event.state==='overdue'&&<span className="status-badge danger">{en?'Overdue':'Εκπρόθεσμο'}</span>}
 </button></li>
}

function stateLabel(state: string | undefined,en: boolean){return ({overdue:en?'Overdue':'Εκπρόθεσμο',due:en?'Due':'Προς εκτέλεση',planned:en?'Planned':'Προγραμματισμένο',done:en?'Done':'Ολοκληρώθηκε',late:en?'Done late':'Έγινε με καθυστέρηση',missed:en?'Missed':'Χάθηκε'} as Record<string, string>)[state||'']||state}
