// What the Calendar screen shows of its events: the counts of the chips, the month at a glance,
// the next seven days, the lines of a day cell and the to-do list (one row for the same item of many people).
import { foldSearch, matchesSearch } from '../../core/i18n/searchMatch'
import { uxPolicyFor } from '../../core/permissions/roleUxPolicy'
import { SCOPES } from '../../core/permissions/accessModel'
import { type CalendarEvent, calendarFilterOf, calendarKindLabel } from './calendarEvents'

const pad=(n: number)=>String(n).padStart(2,'0')
const DONE=['done','late','missed']
// Days between two YYYY-MM-DD days (to - from), at noon so summer time never shifts a day.
export function daysBetween(from: string,to: string){return Math.round((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86400000)}
export function addDay(key: string,days: number){const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
const isOpen=(event: CalendarEvent)=>!DONE.includes(event.state)

// The kind of an item in one word: the chip's name in the singular (a control, a training, an expiry), else the module's.
const FILTER_ONE: Record<'el' | 'en', Record<string, string>>={
 el:{controls:'Έλεγχος',cultures:'Καλλιέργεια',training:'Εκπαίδευση',meetings:'Συνεδρίαση',expiries:'Λήξη'},
 en:{controls:'Control',cultures:'Culture',training:'Training',meetings:'Meeting',expiries:'Expiry'},
}
const KIND_ONE: Record<'el' | 'en', Record<string, string>>={
 el:{capa:'Διορθωτική ενέργεια',audits:'Επιθεώρηση',documents:'Έγγραφο',suppliers:'Αξιολόγηση προμηθευτή',kitchen:'Κουζίνα'},
 en:{capa:'Corrective action',audits:'Audit',documents:'Document',suppliers:'Supplier evaluation',kitchen:'Kitchen'},
}
export function calendarTypeLabel(event: CalendarEvent,language='el'){
 const lang=language==='en'?'en':'el'
 const filter=calendarFilterOf(event)
 return FILTER_ONE[lang][filter]||KIND_ONE[lang][event.kind]||calendarKindLabel(event.kind,language)
}
// «Εκπαίδευση: Υγιεινή χεριών»; a title that already starts with its kind («Έλεγχος ψυγείου») is not repeated.
export function calendarItemLine(event: CalendarEvent,language='el'){
 const type=calendarTypeLabel(event,language)
 const title=String(event.title||'')
 const word=foldSearch(type).split(' ')[0]
 return foldSearch(title).startsWith(word)?title:`${type}: ${title}`
}

// How many items each chip has (in the events given: the chips' own filter is not applied, so a chip turned off keeps its number).
export function calendarFilterCounts(events: CalendarEvent[]){
 const counts: Record<string, number>={}
 for(const event of events){const filter=calendarFilterOf(event);counts[filter]=(counts[filter]||0)+1}
 return counts
}

// The month at a glance: overdue in the month, still to do this week (Monday to Sunday), trainings and expiries of the month.
export function monthGlance(events: CalendarEvent[],{monthKey,today}: { monthKey: string, today: string }){
 const weekday=(new Date(`${today}T12:00:00`).getDay()+6)%7
 const monday=addDay(today,-weekday),sunday=addDay(monday,6)
 const month=events.filter(e=>e.date.startsWith(monthKey))
 return {
  overdue:month.filter(e=>e.state==='overdue').length,
  week:events.filter(e=>isOpen(e)&&e.date>=monday&&e.date<=sunday&&(e.state==='overdue'||e.date>=today)).length,
  training:month.filter(e=>calendarFilterOf(e)==='training').length,
  expiries:month.filter(e=>calendarFilterOf(e)==='expiries').length,
 }
}

// What a group is made of: the same kind, title and action (a certificate of many people, a control in many departments).
const groupKey=(event: CalendarEvent)=>[event.kind,event.title,event.action??event.detail??'',event.path??''].join('|')
export interface CalendarGroup { key: string, date: string, first: CalendarEvent, items: CalendarEvent[], people: string[], departments: string[] }
export function groupCalendarEvents(events: CalendarEvent[]): CalendarGroup[]{
 const map=new Map<string, CalendarGroup>()
 for(const event of events){
  const key=groupKey(event)
  const group=map.get(key)||{key,date:event.date,first:event,items:[],people:[],departments:[]}
  group.items.push(event)
  if(event.date<group.date){group.date=event.date;group.first=event}
  if(event.person&&!group.people.includes(event.person))group.people.push(event.person)
  if(event.department&&!group.departments.includes(event.department))group.departments.push(event.department)
  map.set(key,group)
 }
 return [...map.values()].map(group=>({...group,items:[...group.items].sort((a,b)=>a.date.localeCompare(b.date))})).sort((a,b)=>a.date.localeCompare(b.date)||a.first.title.localeCompare(b.first.title))
}

// The to-do list: the overdue items, or those of the next 30 days (from today), as groups.
export function pendingEvents(events: CalendarEvent[],{today,scope}: { today: string, scope: 'overdue' | 'upcoming' }){
 const until=addDay(today,30)
 return events.filter(e=>scope==='overdue'?e.state==='overdue':(isOpen(e)&&e.state!=='overdue'&&e.date>=today&&e.date<=until))
}
export function searchCalendarGroups(groups: CalendarGroup[],query: string,language='el'){
 return groups.filter(group=>matchesSearch(query,[group.first.title,group.first.action??group.first.detail,calendarTypeLabel(group.first,language),...group.people,...group.departments,...group.items.map(e=>e.owner),group.date.split('-').reverse().join('/')]))
}

// «11 μήνες», «18 ημέρες», «1 ημέρα»: how long an item has been overdue (months from 60 days, years from 2 years).
export function overdueDurationText(from: string,today: string,language='el'){
 const en=language==='en'
 const days=Math.max(0,daysBetween(from,today))
 if(days<60)return en?`${days} day${days===1?'':'s'}`:`${days} ${days===1?'ημέρα':'ημέρες'}`
 const months=Math.round(days/30.44)
 if(months<24)return en?`${months} months`:`${months} μήνες`
 const years=Math.floor(months/12)
 return en?`${years} years`:`${years} έτη`
}
// «σήμερα», «αύριο», «σε 5 ημέρες»: how soon an item is due.
export function dueInText(date: string,today: string,language='el'){
 const en=language==='en'
 const days=daysBetween(today,date)
 if(days<=0)return en?'today':'σήμερα'
 if(days===1)return en?'tomorrow':'αύριο'
 return en?`in ${days} days`:`σε ${days} ημέρες`
}

// The next seven days from today: what is still to be done, one line per item (the same item of many people once).
export function nextDaysGroups(events: CalendarEvent[],today: string,days=7){
 const last=addDay(today,days-1)
 return groupCalendarEvents(events.filter(e=>isOpen(e)&&e.state!=='overdue'&&e.date>=today&&e.date<=last))
}
// The lines of a day cell: overdue first, then by the order of the modules; the same item of many people once.
export function dayCellGroups(events: CalendarEvent[],kindOrder: readonly string[]){
 const rank=(e: CalendarEvent)=>(e.state==='overdue'?0:100)+Math.max(0,kindOrder.indexOf(e.kind))
 const groups=new Map<string, CalendarGroup>()
 for(const event of [...events].sort((a,b)=>rank(a)-rank(b))){
  const key=groupKey(event)
  const group=groups.get(key)||{key,date:event.date,first:event,items:[],people:[],departments:[]}
  group.items.push(event)
  groups.set(key,group)
 }
 return [...groups.values()]
}

// Initials for the small round avatars: «Νικόλαος Πετρόπουλος» → «ΝΠ».
export function personInitials(name: string){
 return String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(word=>word.charAt(0).toLocaleUpperCase('el')).join('')
}

// A department role with one department (or a preview of one) has nothing to choose in «Department».
export function hasSingleDepartment(role: string | null | undefined,membership: object | null | undefined){
 const scope=membership as { previewDepartments?: unknown, previewDepartment?: unknown, departmentIds?: unknown[], departmentId?: unknown } | null | undefined
 if(uxPolicyFor(role).scope!==SCOPES.DEPARTMENT)return false
 const previewDepartments=scope?.previewDepartments
 if(Array.isArray(previewDepartments))return previewDepartments.length<=1
 if(scope?.previewDepartment)return true
 const ids=[...(scope?.departmentIds||[]),scope?.departmentId].filter(Boolean)
 return new Set(ids).size<=1
}
