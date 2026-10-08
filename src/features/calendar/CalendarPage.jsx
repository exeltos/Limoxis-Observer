import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CalendarDays,ChevronLeft,ChevronRight,ClipboardCheck,ListChecks } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { MetricCard } from '../../design-system/MetricCard'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES,can } from '../../core/permissions/roles'
import { exportRegistry } from '../../core/export/registryExports'
import { loadControlProgramme } from '../controls/controlCloudService'
import { loadQualityRecords } from '../quality/qualityService'
import { loadTrainingStateAsync } from '../training/trainingService'
import { groupDocumentFamilies,loadDocumentsAsync } from '../documents/documentService'
import { loadCommitteesAsync } from '../committees/committeeService'
import { CALENDAR_KINDS,buildCalendarEvents,calendarKindLabel,dayKey,monthGrid } from './calendarEvents'
import './calendar.css'

const KIND_CAPABILITY={controls:CAPABILITIES.VIEW_CONTROLS,capa:CAPABILITIES.VIEW_QUALITY,audits:CAPABILITIES.VIEW_QUALITY,training:CAPABILITIES.VIEW_TRAINING,documents:CAPABILITIES.VIEW_DOCUMENTS,committees:CAPABILITIES.VIEW_COMMITTEES}
const WEEKDAYS={el:['Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ','Κυρ'],en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
const MAX_CHIPS=3

// One calendar of what has to be done across the hospital: control due dates,
// CAPA and step deadlines, effectiveness reviews, planned audits, training
// deadlines and certificate expiries, document reviews, committee meetings
// and decisions. Each source is loaded only when the user may see it.
export function CalendarPage(){
 const {language,locale}=useLanguage();const en=language==='en'
 const {tenant,role,membership,canAccessRecord}=useTenant()
 const navigate=useNavigate()
 const allowedKey=CALENDAR_KINDS.filter(kind=>can(role,KIND_CAPABILITY[kind],membership?.capabilities??[],membership?.customCapabilities??[])).join(',')
 const allowedKinds=useMemo(()=>allowedKey?allowedKey.split(','):[],[allowedKey])
 const [sources,setSources]=useState(null)
 const [cursor,setCursor]=useState(()=>{const d=new Date();return {year:d.getFullYear(),month:d.getMonth()}})
 const [selected,setSelected]=useState(()=>dayKey(new Date()))
 const [view,setView]=useState('month')
 const [hidden,setHidden]=useState(()=>new Set())
 const [department,setDepartment]=useState('all')

 useEffect(()=>{
  let active=true
  const organizationId=tenant?.id
  const allowed=new Set(allowedKinds)
  const safe=(kind,load,fallback)=>allowed.has(kind)?load().catch(()=>fallback):Promise.resolve(fallback)
  Promise.all([
   safe('controls',()=>loadControlProgramme(organizationId),[]),
   safe('capa',()=>loadQualityRecords('capas',organizationId),[]),
   safe('audits',()=>loadQualityRecords('audits',organizationId),[]),
   safe('training',()=>loadTrainingStateAsync(organizationId),null),
   safe('documents',()=>loadDocumentsAsync(organizationId),[]),
   safe('committees',()=>loadCommitteesAsync(organizationId),[]),
  ]).then(([controls,capas,audits,training,documents,committees])=>{
   if(active)setSources({controls,capas,audits,training,documentFamilies:groupDocumentFamilies(documents),committees})
  })
  return()=>{active=false}
 },[tenant?.id,allowedKinds])

 const weeks=useMemo(()=>monthGrid(cursor.year,cursor.month),[cursor])
 const today=dayKey(new Date())
 const range=useMemo(()=>{const from=weeks[0][0],last=weeks[weeks.length-1][6];const horizon=dayKey(new Date(Date.now()+60*24*60*60*1000));return {from:from<today?from:today,to:last>horizon?last:horizon}},[weeks,today])
 const allEvents=useMemo(()=>sources?buildCalendarEvents(sources,{...range,today,language}):[],[sources,range,today,language])
 const departments=useMemo(()=>[...new Set(allEvents.map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[allEvents,language])
 const events=useMemo(()=>allEvents.filter(e=>allowedKinds.includes(e.kind)&&!hidden.has(e.kind)&&(department==='all'||e.department===department)&&(!e.department||canAccessRecord({department:e.department}))),[allEvents,allowedKinds,hidden,department,canAccessRecord])
 const byDay=useMemo(()=>{const map=new Map();for(const e of events){const list=map.get(e.date)||[];list.push(e);map.set(e.date,list)}return map},[events])
 const overdue=events.filter(e=>e.state==='overdue')
 const weekEnd=dayKey(new Date(Date.now()+7*24*60*60*1000))
 const thisWeek=events.filter(e=>e.state!=='overdue'&&e.state!=='done'&&e.date>=today&&e.date<=weekEnd)
 const monthKey=`${cursor.year}-${String(cursor.month+1).padStart(2,'0')}`
 const monthEvents=events.filter(e=>e.date.startsWith(monthKey))
 const upcoming=events.filter(e=>e.state!=='done'&&(e.state==='overdue'||e.date>=today)).slice(0,200)
 const monthTitle=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date(cursor.year,cursor.month,1))
 const fmtDay=key=>new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${key}T12:00:00`))
 const fmtShort=key=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short'}).format(new Date(`${key}T12:00:00`))

 function moveMonth(step){setCursor(c=>{const d=new Date(c.year,c.month+step,1);return {year:d.getFullYear(),month:d.getMonth()}})}
 function goToday(){const d=new Date();setCursor({year:d.getFullYear(),month:d.getMonth()});setSelected(dayKey(d))}
 function toggleKind(kind){setHidden(current=>{const next=new Set(current);if(next.has(kind))next.delete(kind);else next.add(kind);return next})}
 function exportMonth(){
  exportRegistry({name:en?`calendar-${monthKey}`:`imerologio-${monthKey}`,
   headers:en?['Date','Time','Module','Item','Detail','Department','Status']:['Ημερομηνία','Ώρα','Ενότητα','Θέμα','Λεπτομέρεια','Τμήμα','Κατάσταση'],
   rows:[...overdue.filter(e=>!e.date.startsWith(monthKey)),...monthEvents].map(e=>[new Intl.DateTimeFormat(locale).format(new Date(`${e.date}T12:00:00`)),e.time||'',calendarKindLabel(e.kind,language),e.title,e.detail||'',e.department||'',stateLabel(e.state,en)])})
 }

 if(!sources)return <RouteLoading/>
 const selectedEvents=byDay.get(selected)||[]
 return <Page fill className="calendar-page" title={en?'Calendar':'Ημερολόγιο'} subtitle={en?'Everything that has to be done, from every module, by date.':'Όλα όσα πρέπει να γίνουν, από όλες τις ενότητες, ανά ημερομηνία.'} actions={<DownloadMenu disabled={!monthEvents.length&&!overdue.length} onExcel={exportMonth}/>}>
  <div className="module-summary-strip">
   <MetricCard icon={AlertTriangle} value={overdue.length} label={en?'Overdue':'Εκπρόθεσμα'} tone={overdue.length?'warning':'neutral'} onClick={()=>setView('list')}/>
   <MetricCard icon={ClipboardCheck} value={thisWeek.length} label={en?'Next 7 days':'Επόμενες 7 ημέρες'} onClick={()=>setView('list')}/>
   <MetricCard icon={CalendarDays} value={monthEvents.length} label={en?`In ${monthTitle}`:`Τον μήνα (${monthTitle})`} onClick={()=>setView('month')}/>
  </div>
  <section className="surface registry-workspace workspace-column workspace-fill calendar-workspace">
   <ModuleTabs activeId={view} onChange={setView} ariaLabel={en?'Calendar view':'Προβολή ημερολογίου'} tabs={[{id:'month',label:en?'Month':'Μήνας',icon:CalendarDays},{id:'list',label:en?'To do':'Εκκρεμότητες',icon:ListChecks}]}/>
   <div className="calendar-toolbar">
    <div className="calendar-kinds" role="group" aria-label={en?'Modules':'Ενότητες'}>{allowedKinds.map(kind=><button key={kind} type="button" className={`calendar-kind-toggle kind-${kind} ${hidden.has(kind)?'off':''}`} aria-pressed={!hidden.has(kind)} onClick={()=>toggleKind(kind)}><span className="calendar-dot"/>{calendarKindLabel(kind,language)}</button>)}</div>
    <label className="calendar-department"><span>{en?'Department':'Τμήμα'}</span><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">{en?'All':'Όλα'}</option>{departments.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
   </div>
   {view==='month'?<div className="calendar-month-layout">
    <div className="calendar-month">
     <div className="calendar-month-head"><IconButton label={en?'Previous month':'Προηγούμενος μήνας'} onClick={()=>moveMonth(-1)}><ChevronLeft size={18}/></IconButton><h3>{monthTitle}</h3><IconButton label={en?'Next month':'Επόμενος μήνας'} onClick={()=>moveMonth(1)}><ChevronRight size={18}/></IconButton><Button variant="secondary" onClick={goToday}>{en?'Today':'Σήμερα'}</Button></div>
     <div className="calendar-grid" role="grid" aria-label={monthTitle}>
      {WEEKDAYS[en?'en':'el'].map(d=><div key={d} className="calendar-weekday" role="columnheader">{d}</div>)}
      {weeks.flat().map(key=>{const list=byDay.get(key)||[];const outside=!key.startsWith(monthKey);const late=list.some(e=>e.state==='overdue');return <button key={key} type="button" role="gridcell" className={`calendar-day ${outside?'outside':''} ${key===today?'today':''} ${key===selected?'selected':''} ${late?'has-overdue':''}`} onClick={()=>setSelected(key)} aria-label={`${fmtDay(key)}: ${list.length}`}>
       <span className="calendar-day-number">{Number(key.slice(8))}</span>
       {list.slice(0,MAX_CHIPS).map(e=><span key={e.id} className={`calendar-chip kind-${e.kind} ${e.state}`}><span className="calendar-dot"/>{e.time&&<b>{e.time}</b>}{e.title}</span>)}
       {list.length>MAX_CHIPS&&<span className="calendar-more">+{list.length-MAX_CHIPS} {en?'more':'ακόμη'}</span>}
      </button>})}
     </div>
    </div>
    <aside className="calendar-day-panel" aria-live="polite">
     <h4>{fmtDay(selected)}</h4>
     {selectedEvents.length?<ul className="calendar-agenda">{selectedEvents.map(e=><EventRow key={e.id} event={e} language={language} onOpen={()=>navigate(e.path)}/>)}</ul>:<div className="inline-empty">{en?'Nothing scheduled.':'Δεν υπάρχει κάτι προγραμματισμένο.'}</div>}
    </aside>
   </div>:<div className="calendar-list scroll-panel">
    {overdue.length>0&&<section><h4 className="calendar-list-heading danger">{en?'Overdue':'Εκπρόθεσμα'} · {overdue.length}</h4><ul className="calendar-agenda">{overdue.map(e=><EventRow key={e.id} event={e} language={language} date={fmtShort(e.date)} onOpen={()=>navigate(e.path)}/>)}</ul></section>}
    {groupByDate(upcoming.filter(e=>e.state!=='overdue')).map(([key,list])=><section key={key}><h4 className={`calendar-list-heading ${key===today?'today':''}`}>{key===today?(en?'Today':'Σήμερα'):fmtDay(key)}</h4><ul className="calendar-agenda">{list.map(e=><EventRow key={e.id} event={e} language={language} onOpen={()=>navigate(e.path)}/>)}</ul></section>)}
    {!upcoming.length&&<div className="registry-empty-state"><strong>{en?'Nothing pending':'Δεν υπάρχουν εκκρεμότητες'}</strong></div>}
   </div>}
  </section>
 </Page>
}

function EventRow({event,language,date,onOpen}){
 const en=language==='en'
 return <li><button type="button" className={`calendar-event kind-${event.kind} ${event.state}`} onClick={onOpen}>
  <span className="calendar-event-when">{date||event.time||''}</span>
  <span className="calendar-event-main"><strong>{event.title}</strong><small>{[calendarKindLabel(event.kind,language),event.detail,event.department].filter(Boolean).join(' · ')}</small></span>
  {event.state==='overdue'&&<span className="status-badge danger">{en?'Overdue':'Εκπρόθεσμο'}</span>}
  {event.criticality==='high'&&<span className="status-badge danger">{en?'High':'Υψηλή'}</span>}
  <ChevronRight size={16} aria-hidden="true"/>
 </button></li>
}

function groupByDate(events){const map=new Map();for(const e of events){const list=map.get(e.date)||[];list.push(e);map.set(e.date,list)}return [...map.entries()].slice(0,45)}
function stateLabel(state,en){return ({overdue:en?'Overdue':'Εκπρόθεσμο',due:en?'Due':'Προς εκτέλεση',planned:en?'Planned':'Προγραμματισμένο',done:en?'Done':'Ολοκληρώθηκε'})[state]||state}
