import { useEffect, useState } from 'react'
import { ArrowRight, Building2, CalendarClock, Inbox, KeyRound, Lock, Plus, Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { StatusBadge } from '../../design-system/StatusBadge'
import { ACTIVITY_DAYS, loadHospitalHealth } from './platformHealthService'
import { loadOwnerWaitingCounts } from './platformAttentionService'
import { initialsOf, sinceText, statusOf } from './platformOverviewShared'
import './platformDashboard.css'

const DAY=86400000
const daysUntil=value=>Math.ceil((new Date(`${String(value).slice(0,10)}T00:00:00`).getTime()-new Date(new Date().toDateString()).getTime())/DAY)
const shortDate=value=>new Intl.DateTimeFormat('el-GR').format(new Date(value))
const HOSPITAL_ROWS=8

// What the Owner must act on this week: Demos that end and hospitals whose
// deletion date is near or has passed (the same events the reminder e-mails cover).
function ActionList({tx,demos,organizations,demoProgress,onOpenDemo,onNavigate,waiting}){
  const counts=waiting||{}
  const items=[
    counts.locked>0&&{key:'accounts-locked',order:-1,tone:'danger',icon:<Lock size={16}/>,title:tx('Κλειδωμένοι λογαριασμοί','Locked accounts'),go:tx('Νέος κωδικός','New password'),text:tx(`${counts.locked} ${counts.locked===1?'λογαριασμός κλειδώθηκε':'λογαριασμοί κλειδώθηκαν'} επειδή έληξε ο προσωρινός κωδικός`,`${counts.locked} ${counts.locked===1?'account was':'accounts were'} locked because the temporary password expired`),action:()=>onNavigate('/platform#users')},
    counts.waiting>0&&{key:'accounts-waiting',order:40,tone:'warning',icon:<KeyRound size={16}/>,title:tx('Δεν έχουν αλλάξει τον προσωρινό κωδικό','Temporary password not changed yet'),go:tx('Προβολή','View'),text:tx(`${counts.waiting} ${counts.waiting===1?'χρήστης':'χρήστες'}`,`${counts.waiting} ${counts.waiting===1?'user':'users'}`),action:()=>onNavigate('/platform#users')},
    counts.legislation>0&&{key:'legislation-review',order:50,tone:'warning',icon:<Inbox size={16}/>,title:tx('Νομοθεσία προς έλεγχο','Legislation to review'),go:tx('Έλεγχος','Review'),text:tx(`${counts.legislation} ${counts.legislation===1?'πρόταση περιμένει':'προτάσεις περιμένουν'} έλεγχο`,`${counts.legislation} ${counts.legislation===1?'proposal is':'proposals are'} waiting for review`),action:()=>onNavigate('/platform/legislation?view=review')},
    ...organizations.filter(o=>o.deletion_scheduled_at&&daysUntil(o.deletion_scheduled_at)<=7).map(o=>{const days=daysUntil(o.deletion_scheduled_at);return {key:`org-${o.id}`,order:days,tone:'danger',icon:<Trash2 size={16}/>,title:o.name,go:tx('Προβολή','View'),
      text:days<=0?tx('Έφτασε η ημερομηνία οριστικής διαγραφής','The deletion date has been reached'):days===1?tx(`Οριστική διαγραφή αύριο (${shortDate(o.deletion_scheduled_at)})`,`Permanent deletion tomorrow (${shortDate(o.deletion_scheduled_at)})`):tx(`Οριστική διαγραφή σε ${days} ημέρες (${shortDate(o.deletion_scheduled_at)})`,`Permanent deletion in ${days} days (${shortDate(o.deletion_scheduled_at)})`),
      action:()=>onNavigate(`/platform#organizations?organization=${o.id}&tab=offboarding`,{state:{returnTo:'/platform'}})}}),
    ...demos.filter(d=>(demoProgress?demoProgress(d).remaining:daysUntil(d.valid_until))<=7).map(d=>{const days=daysUntil(d.valid_until);return {key:`demo-${d.id}`,order:days+0.5,tone:'warning',icon:<CalendarClock size={16}/>,title:d.label||d.organization?.name||'Demo',go:tx('Παράταση','Extend'),
      text:days<=0?tx('Το Demo λήγει σήμερα','The Demo ends today'):days===1?tx(`Το Demo λήγει αύριο (${shortDate(d.valid_until)})`,`The Demo ends tomorrow (${shortDate(d.valid_until)})`):tx(`Το Demo λήγει σε ${days} ημέρες (${shortDate(d.valid_until)})`,`The Demo ends in ${days} days (${shortDate(d.valid_until)})`),
      action:()=>onOpenDemo?onOpenDemo(d):onNavigate(`/platform#demo?demo=${d.id}`,{state:{returnTo:'/platform'}})}}),
  ].filter(Boolean).sort((a,b)=>a.order-b.order)
  return <section className="platform-dashboard-panel platform-dashboard-actions"><header><h3>{tx('Χρειάζονται ενέργεια','Needs action')}</h3>{items.length>0&&<span className="platform-overview-count">{items.length}</span>}</header>
    {items.length?<div className="platform-action-list">{items.map(i=><button type="button" key={i.key} className={`platform-action-item tone-${i.tone}`} onClick={i.action}><span className="platform-action-icon">{i.icon}</span><span className="platform-action-copy"><strong>{i.title}</strong><small>{i.text}</small></span><span className="platform-action-go">{i.go}<ArrowRight size={14} aria-hidden="true"/></span></button>)}</div>
      :<p className="platform-overview-empty">{tx('Τίποτα δεν περιμένει ενέργεια αυτή τη στιγμή.','Nothing is waiting for action right now.')}</p>}
  </section>
}

// One bar per day of the last 14 (Athens), scaled to the busiest day; a day without activity is a short dash.
function Sparkline({tx,values}){
  if(!values)return <span className="platform-overview-muted">—</span>
  const max=Math.max(...values),total=values.reduce((sum,value)=>sum+value,0)
  const label=tx(`${total} καταγραφές τις τελευταίες ${ACTIVITY_DAYS} ημέρες`,`${total} recorded changes in the last ${ACTIVITY_DAYS} days`)
  return <svg className="platform-overview-spark" viewBox={`0 0 ${values.length*6} 20`} width={values.length*6} height="20" role="img" aria-label={label}><title>{label}</title>{values.map((value,index)=>{const h=value&&max?Math.max(3,Math.round(value/max*18)):2;return <rect key={index} className={value?'':'is-empty'} x={index*6} y={20-h} width="4" height={h} rx="1"/>})}</svg>
}

// The hospitals of the platform: users, the activity of the last 14 days, last use and status; a row opens the organization.
function HospitalsTable({tx,hospitals,members,health,onNavigate,onCreateOrganization}){
  const open=o=>onNavigate(`/platform#organizations?organization=${o.id}&tab=details`,{state:{returnTo:'/platform'}})
  const shown=hospitals.slice(0,HOSPITAL_ROWS)
  return <section className="platform-dashboard-panel platform-overview-hospitals"><header><h3>{tx('Νοσοκομεία','Hospitals')}</h3><button type="button" className="platform-overview-link" onClick={()=>onNavigate('/platform#organizations')}>{hospitals.length>HOSPITAL_ROWS?tx(`Όλοι οι οργανισμοί (${hospitals.length})`,`All organizations (${hospitals.length})`):tx('Όλοι οι οργανισμοί','All organizations')}<ArrowRight size={14} aria-hidden="true"/></button></header>
    {shown.length?<div className="platform-overview-table-wrap"><table className="data-table platform-overview-table">
      <thead><tr><th>{tx('Οργανισμός','Organization')}</th><th>{tx('Χρήστες','Users')}</th><th>{tx(`Δραστηριότητα ${ACTIVITY_DAYS} ημ.`,`Activity, ${ACTIVITY_DAYS} days`)}</th><th>{tx('Τελευταία χρήση','Last use')}</th><th>{tx('Κατάσταση','Status')}</th></tr></thead>
      <tbody>{shown.map(o=>{const people=members.filter(m=>m.organization_id===o.id),active=people.filter(m=>m.status==='active').length,item=health?.[o.id]||{},[tone,label]=statusOf(tx,o,people.find(m=>m.role==='hospital_admin')?.status)
        return <tr key={o.id} className="platform-owner-clickable-row platform-hospital-row" tabIndex={0} onClick={()=>open(o)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(o)}}}>
          <td><div className="platform-overview-org"><span className="platform-overview-avatar" aria-hidden="true">{initialsOf(o.name)}</span><span><strong>{o.name}</strong><small>{[o.code,o.city].filter(Boolean).join(' · ')}</small></span></div></td>
          <td className="platform-overview-num">{active} / {people.length}</td>
          <td>{health==null?<span className="platform-overview-muted">…</span>:<Sparkline tx={tx} values={item.activity||null}/>}</td>
          <td className="platform-overview-since">{health==null?'…':sinceText(item.lastActivityAt,tx)}</td>
          <td><StatusBadge tone={tone}>{label}</StatusBadge></td>
        </tr>})}</tbody>
    </table></div>
    :<div className="platform-overview-empty platform-overview-empty-hospitals"><Building2 size={22} aria-hidden="true"/><p>{tx('Δεν υπάρχει ακόμη οργανισμός στην πλατφόρμα.','There is no organization on the platform yet.')}</p>{onCreateOrganization&&<Button variant="secondary" onClick={onCreateOrganization}><Plus size={15} aria-hidden="true"/>{tx('Νέος οργανισμός','New organization')}</Button>}</div>}
  </section>
}

export function PlatformDashboardView({tx,organizations,members=[],users=[],activeDemos,expiringDemos=[],loadingStats,demoProgress,onOpenDemo,onNavigate,onCreateOrganization,onCreateDemo,liveSessions=null}) {
  const [health,setHealth]=useState(null),[waiting,setWaiting]=useState(null)
  useEffect(()=>{let active=true;loadOwnerWaitingCounts().then(data=>{if(active)setWaiting(data)}).catch(()=>{});return()=>{active=false}},[])
  useEffect(()=>{let active=true;loadHospitalHealth().then(data=>{if(active)setHealth(data||{})}).catch(()=>{if(active)setHealth({})});return()=>{active=false}},[])
  const hospitals=(organizations||[]).filter(o=>!o.is_demo&&o.status!=='archived')
  const activeCount=hospitals.filter(o=>o.status==='active'&&!o.paused_at).length,pausedCount=hospitals.filter(o=>o.status==='suspended'||o.paused_at).length
  const people=new Map(users.filter(u=>u.kind!=='platform'&&u.userId).map(u=>[u.userId,u])),weekAgo=Date.now()-7*DAY,newThisWeek=[...people.values()].filter(u=>u.createdAt&&new Date(u.createdAt).getTime()>=weekAgo).length
  const nearest=activeDemos.length?Math.min(...activeDemos.map(d=>demoProgress?demoProgress(d).remaining:daysUntil(d.valid_until))):null
  const errors=health?Object.values(health).reduce((sum,item)=>sum+(item?.errors24h||0),0):null
  const totals=[
    {id:'organizations',label:tx('Οργανισμοί','Organizations'),value:hospitals.length,note:tx(`${activeCount} ενεργοί · ${pausedCount} σε παύση`,`${activeCount} active · ${pausedCount} paused`),to:'/platform#organizations'},
    {id:'users',label:tx('Χρήστες','Users'),value:loadingStats&&!users.length?'—':people.size,note:newThisWeek?tx(`+${newThisWeek} αυτή την εβδομάδα`,`+${newThisWeek} this week`):tx('Κανένας νέος αυτή την εβδομάδα','None new this week'),tone:newThisWeek?'success':'',to:'/platform#users'},
    {id:'demo',label:'Demo',value:loadingStats?'—':activeDemos.length,note:nearest==null?tx('Κανένα ενεργό Demo','No active Demo'):nearest<=1?tx('Το πρώτο λήγει αύριο','The first ends tomorrow'):tx(`Το πρώτο λήγει σε ${nearest} ημέρες`,`The first ends in ${nearest} days`),tone:nearest!=null&&nearest<=7?'warning':'',to:'/platform#demo'},
    {id:'errors',label:tx('Σφάλματα 24ώρου','Errors, 24 h'),value:errors==null?'—':errors,note:errors==null?'…':errors?tx('Δείτε το Ιστορικό & Υγεία','See History & Health'):tx('Καμία αποτυχία','No failures'),tone:errors==null?'':errors?'danger':'success',to:'/platform/audit'},
  ]
  // The Overview (owner, 9/11/2026): one strip of totals (each opens its registry), the hospitals with their activity,
  // and on the right what needs action and the quick actions.
  return <Page title={tx('Επισκόπηση','Overview')} actions={<div className="platform-overview-actions">{onCreateDemo&&<Button variant="secondary" onClick={onCreateDemo}><Plus size={15} aria-hidden="true"/>{tx('Νέο Demo','New Demo')}</Button>}{onCreateOrganization&&<Button onClick={onCreateOrganization}><Plus size={15} aria-hidden="true"/>{tx('Νέος οργανισμός','New organization')}</Button>}</div>}>
    <div className="platform-dashboard platform-overview">
      <div className="platform-overview-totals">{totals.map(item=><button type="button" key={item.id} className="platform-overview-total" onClick={()=>onNavigate(item.to)}><span>{item.label}</span><strong>{item.value}</strong><small className={item.tone?`tone-${item.tone}`:undefined}>{item.note}</small></button>)}</div>
      <div className="platform-overview-grid">
        <HospitalsTable tx={tx} hospitals={hospitals} members={members} health={health} onNavigate={onNavigate} onCreateOrganization={onCreateOrganization}/>
        <div className="platform-overview-side">
          <div className="platform-overview-attention">
            {/* Slot: «Συνδεδεμένοι τώρα» (connected now), supplied by the caller. */}
            {liveSessions}
            <ActionList tx={tx} waiting={waiting} demos={expiringDemos} organizations={organizations} demoProgress={demoProgress} onOpenDemo={onOpenDemo} onNavigate={onNavigate}/>
          </div>
        </div>
      </div>
    </div>
  </Page>
}
