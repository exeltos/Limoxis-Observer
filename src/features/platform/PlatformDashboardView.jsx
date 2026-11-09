import { useEffect, useState } from 'react'
import { ArrowRight, Building2, CalendarClock, FlaskConical, Megaphone, Plus, Trash2, Users } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { StatusBadge } from '../../design-system/StatusBadge'
import { ACTIVITY_DAYS, loadHospitalHealth } from './platformHealthService'
import './platformDashboard.css'

const DAY=86400000
const daysUntil=value=>Math.ceil((new Date(`${String(value).slice(0,10)}T00:00:00`).getTime()-new Date(new Date().toDateString()).getTime())/DAY)
const shortDate=value=>new Intl.DateTimeFormat('el-GR').format(new Date(value))
const HOSPITAL_ROWS=8

// The greeting of the Overview: by the time of day, with the owner's first name (the Greek vocative of the
// common endings: Άρης → Άρη, Νίκος → Νίκο, Κώστας → Κώστα).
function greetingOf(tx,fullName,now=new Date()){
  const hour=now.getHours()
  const hello=hour>=5&&hour<12?tx('Καλημέρα','Good morning'):hour>=12&&hour<18?tx('Καλησπέρα','Good afternoon'):tx('Καλησπέρα','Good evening')
  const first=String(fullName||'').trim().split(/\s+/)[0]||''
  if(!first||first.includes('@'))return hello
  const greek=/[Ͱ-Ͽἀ-῿]/.test(first)
  const name=!greek||tx('el','en')==='en'?first:first.replace(/ος$/,'ο').replace(/ός$/,'ό').replace(/(η|ή|α|ά|ου)ς$/,'$1')
  return `${hello}, ${name}`
}
// Two letters per organization: an abbreviation (Γ.Ν.) counts as one word, so «Γ.Ν. Κομοτηνής» is ΓΚ.
const initialsOf=name=>String(name||'').split(/\s+/).map(word=>word.replace(/[^\p{L}]/gu,'')).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toLocaleUpperCase('el-GR')||'—'

// What the Owner must act on this week: Demos that end and hospitals whose
// deletion date is near or has passed (the same events the reminder e-mails cover).
function ActionList({tx,demos,organizations,demoProgress,onOpenDemo,onNavigate}){
  const items=[
    ...organizations.filter(o=>o.deletion_scheduled_at&&daysUntil(o.deletion_scheduled_at)<=7).map(o=>{const days=daysUntil(o.deletion_scheduled_at);return {key:`org-${o.id}`,order:days,tone:'danger',icon:<Trash2 size={16}/>,title:o.name,go:tx('Προβολή','View'),
      text:days<=0?tx('Έφτασε η ημερομηνία οριστικής διαγραφής','The deletion date has been reached'):days===1?tx(`Οριστική διαγραφή αύριο (${shortDate(o.deletion_scheduled_at)})`,`Permanent deletion tomorrow (${shortDate(o.deletion_scheduled_at)})`):tx(`Οριστική διαγραφή σε ${days} ημέρες (${shortDate(o.deletion_scheduled_at)})`,`Permanent deletion in ${days} days (${shortDate(o.deletion_scheduled_at)})`),
      action:()=>onNavigate(`/platform#organizations?organization=${o.id}&tab=offboarding`)}}),
    ...demos.filter(d=>(demoProgress?demoProgress(d).remaining:daysUntil(d.valid_until))<=7).map(d=>{const days=daysUntil(d.valid_until);return {key:`demo-${d.id}`,order:days+0.5,tone:'warning',icon:<CalendarClock size={16}/>,title:d.label||d.organization?.name||'Demo',go:tx('Παράταση','Extend'),
      text:days<=0?tx('Το Demo λήγει σήμερα','The Demo ends today'):days===1?tx(`Το Demo λήγει αύριο (${shortDate(d.valid_until)})`,`The Demo ends tomorrow (${shortDate(d.valid_until)})`):tx(`Το Demo λήγει σε ${days} ημέρες (${shortDate(d.valid_until)})`,`The Demo ends in ${days} days (${shortDate(d.valid_until)})`),
      action:()=>onOpenDemo?onOpenDemo(d):onNavigate(`/platform#demo?demo=${d.id}`)}}),
  ].sort((a,b)=>a.order-b.order)
  return <section className="platform-dashboard-panel platform-dashboard-actions"><header><h3>{tx('Χρειάζονται ενέργεια','Needs action')}</h3>{items.length>0&&<span className="platform-overview-count">{items.length}</span>}</header>
    {items.length?<div className="platform-action-list">{items.map(i=><button type="button" key={i.key} className={`platform-action-item tone-${i.tone}`} onClick={i.action}><span className="platform-action-icon">{i.icon}</span><span className="platform-action-copy"><strong>{i.title}</strong><small>{i.text}</small></span><span className="platform-action-go">{i.go}<ArrowRight size={14} aria-hidden="true"/></span></button>)}</div>
      :<p className="platform-overview-empty">{tx('Καμία λήξη Demo ή διαγραφή οργανισμού τις επόμενες 7 ημέρες.','No Demo endings or organization deletions in the next 7 days.')}</p>}
  </section>
}

const sinceText=(value,tx)=>{if(!value)return tx('Καμία καταγραφή','No activity recorded');const minutes=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/60000));if(minutes<60)return tx(`πριν από ${minutes} λεπτά`,`${minutes} min ago`);const hours=Math.round(minutes/60);if(hours<24)return tx(`πριν από ${hours} ώρες`,`${hours} h ago`);const days=Math.round(hours/24);if(days===1)return tx('χθες','yesterday');return tx(`πριν από ${days} ημέρες`,`${days} days ago`)}

// One bar per day of the last 14 (Athens), scaled to the busiest day; a day without activity is a short dash.
function Sparkline({tx,values}){
  if(!values)return <span className="platform-overview-muted">—</span>
  const max=Math.max(...values),total=values.reduce((sum,value)=>sum+value,0)
  const label=tx(`${total} καταγραφές τις τελευταίες ${ACTIVITY_DAYS} ημέρες`,`${total} recorded changes in the last ${ACTIVITY_DAYS} days`)
  return <svg className="platform-overview-spark" viewBox={`0 0 ${values.length*6} 20`} width={values.length*6} height="20" role="img" aria-label={label}><title>{label}</title>{values.map((value,index)=>{const h=value&&max?Math.max(3,Math.round(value/max*18)):2;return <rect key={index} className={value?'':'is-empty'} x={index*6} y={20-h} width="4" height={h} rx="1"/>})}</svg>
}

function statusOf(tx,organization,adminStatus){
  if(organization.deletion_scheduled_at)return ['danger',tx('Προς διαγραφή','Deletion scheduled')]
  if(organization.status==='suspended'||organization.paused_at)return ['danger',tx('Σε παύση','Paused')]
  if(organization.status!=='active')return ['neutral',tx('Ανενεργός','Inactive')]
  if(adminStatus==='invited')return ['warning',tx('Εκκρεμεί διαχειριστής','Admin pending')]
  return ['success',tx('Ενεργός','Active')]
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

function QuickActions({tx,onNavigate,onEnterDemo}){
  const tiles=[
    {id:'users',icon:Users,label:tx('Ενεργοί χρήστες','Active users'),run:()=>onNavigate('/platform#users')},
    {id:'announcement',icon:Megaphone,label:tx('Νέα ανακοίνωση','New announcement'),run:()=>onNavigate('/platform/announcements',{state:{newAnnouncement:true}})},
    onEnterDemo&&{id:'demo',icon:FlaskConical,label:tx('Είσοδος Demo','Enter Demo'),run:onEnterDemo},
  ].filter(Boolean)
  return <section className="platform-dashboard-panel platform-overview-quick"><header><h3>{tx('Γρήγορες ενέργειες','Quick actions')}</h3></header>
    <div className="platform-overview-tiles">{tiles.map(({id,icon:Icon,label,run})=><button type="button" key={id} className="platform-overview-tile" onClick={run}><span className="platform-overview-tile-icon" aria-hidden="true"><Icon size={16}/></span>{label}</button>)}</div>
  </section>
}

export function PlatformDashboardView({tx,organizations,members=[],users=[],activeDemos,expiringDemos=[],loadingStats,demoProgress,onOpenDemo,onNavigate,ownerName='',onCreateOrganization,onCreateDemo,onEnterDemo,liveSessions=null}) {
  const [health,setHealth]=useState(null)
  useEffect(()=>{let active=true;loadHospitalHealth().then(data=>{if(active)setHealth(data||{})}).catch(()=>{if(active)setHealth({})});return()=>{active=false}},[])
  const now=new Date(),locale=tx('el-GR','en-GB')
  const hospitals=(organizations||[]).filter(o=>!o.is_demo&&o.status!=='archived')
  const activeCount=hospitals.filter(o=>o.status==='active'&&!o.paused_at).length,pausedCount=hospitals.filter(o=>o.status==='suspended'||o.paused_at).length
  const people=new Map(users.filter(u=>u.kind!=='platform'&&u.userId).map(u=>[u.userId,u])),weekAgo=Date.now()-7*DAY,newThisWeek=[...people.values()].filter(u=>u.createdAt&&new Date(u.createdAt).getTime()>=weekAgo).length
  const nearest=activeDemos.length?Math.min(...activeDemos.map(d=>demoProgress?demoProgress(d).remaining:daysUntil(d.valid_until))):null
  const errors=health?Object.values(health).reduce((sum,item)=>sum+(item?.errors24h||0),0):null
  const dateText=new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long'}).format(now)
  const totals=[
    {id:'organizations',label:tx('Οργανισμοί','Organizations'),value:hospitals.length,note:tx(`${activeCount} ενεργοί · ${pausedCount} σε παύση`,`${activeCount} active · ${pausedCount} paused`),to:'/platform#organizations'},
    {id:'users',label:tx('Χρήστες','Users'),value:loadingStats&&!users.length?'—':people.size,note:newThisWeek?tx(`+${newThisWeek} αυτή την εβδομάδα`,`+${newThisWeek} this week`):tx('Κανένας νέος αυτή την εβδομάδα','None new this week'),tone:newThisWeek?'success':'',to:'/platform#users'},
    {id:'demo',label:'Demo',value:loadingStats?'—':activeDemos.length,note:nearest==null?tx('Κανένα ενεργό Demo','No active Demo'):nearest<=1?tx('Το πρώτο λήγει αύριο','The first ends tomorrow'):tx(`Το πρώτο λήγει σε ${nearest} ημέρες`,`The first ends in ${nearest} days`),tone:nearest!=null&&nearest<=7?'warning':'',to:'/platform#demo'},
    {id:'errors',label:tx('Σφάλματα 24ώρου','Errors, 24 h'),value:errors==null?'—':errors,note:errors==null?'…':errors?tx('Δείτε το Ιστορικό & Υγεία','See History & Health'):tx('Καμία αποτυχία','No failures'),tone:errors==null?'':errors?'danger':'success',to:'/platform/audit'},
  ]
  const subtitle=`${dateText.charAt(0).toLocaleUpperCase(locale)}${dateText.slice(1)} · ${errors==null?tx('έλεγχος συστημάτων…','checking systems…'):errors?tx(`${errors} σφάλματα το τελευταίο 24ωρο`,`${errors} errors in the last 24 hours`):tx('χωρίς σφάλματα το τελευταίο 24ωρο','no errors in the last 24 hours')}`
  // The Overview (owner, 9/11/2026): one strip of totals (each opens its registry), the hospitals with their activity,
  // and on the right what needs action and the quick actions.
  return <Page title={greetingOf(tx,ownerName,now)} subtitle={subtitle} actions={<div className="platform-overview-actions">{onCreateDemo&&<Button variant="secondary" onClick={onCreateDemo}><Plus size={15} aria-hidden="true"/>{tx('Νέο Demo','New Demo')}</Button>}{onCreateOrganization&&<Button onClick={onCreateOrganization}><Plus size={15} aria-hidden="true"/>{tx('Νέος οργανισμός','New organization')}</Button>}</div>}>
    <div className="platform-dashboard platform-overview">
      <div className="platform-overview-totals">{totals.map(item=><button type="button" key={item.id} className="platform-overview-total" onClick={()=>onNavigate(item.to)}><span>{item.label}</span><strong>{item.value}</strong><small className={item.tone?`tone-${item.tone}`:undefined}>{item.note}</small></button>)}</div>
      <div className="platform-overview-grid">
        <HospitalsTable tx={tx} hospitals={hospitals} members={members} health={health} onNavigate={onNavigate} onCreateOrganization={onCreateOrganization}/>
        <div className="platform-overview-side">
          {/* Slot: «Συνδεδεμένοι τώρα» (connected now), supplied by the caller. */}
          {liveSessions}
          <ActionList tx={tx} demos={expiringDemos} organizations={organizations} demoProgress={demoProgress} onOpenDemo={onOpenDemo} onNavigate={onNavigate}/>
          <QuickActions tx={tx} onNavigate={onNavigate} onEnterDemo={onEnterDemo}/>
        </div>
      </div>
    </div>
  </Page>
}
