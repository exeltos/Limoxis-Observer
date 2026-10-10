import { CalendarDays,CheckCircle2,ClipboardList,Pencil,Plus,ShieldCheck,Target,Trash2,Users,XCircle } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { MetricCard } from '../../design-system/MetricCard'
import { todayIso,fmtDate,statusLabel,workflowStatusLabel,workflowStatusClass,frequencyLabel,quorumLabel } from './committeeRecordFormat'

// Tab sections of the committee record page (CommitteeRecordPage.jsx).
export function Head({title,subtitle,action}){
  return <div className="record-section-header"><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>
}

export function Overview({record,members,en}){
  const meetings=record.meetings||[]
  const decisions=record.decisions||[]
  const plan=(record.annualPlan||[]).filter(x=>x.status!=='cancelled')
  const openDecisions=decisions.filter(x=>x.status!=='completed')
  const completedPlan=plan.filter(x=>x.status==='completed').length
  const next=[...meetings].filter(x=>x.date>=todayIso()&&!['finalized','cancelled'].includes(x.status)).sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0]
  const checks=[
    {ok:members.length>0,label:en?'Committee composition':'Σύνθεση επιτροπής',value:members.length?`${members.length} ${en?'active members':'ενεργά μέλη'}`:(en?'No members yet':'Δεν έχουν οριστεί μέλη')},
    {ok:Boolean(record.decisionNumber),label:en?'Constitution decision':'Πράξη σύστασης',value:record.decisionNumber||(en?'Not recorded':'Δεν έχει καταχωριστεί')},
    {ok:Boolean(record.legalBasis),label:en?'Institutional basis':'Θεσμική βάση',value:record.legalBasis||(en?'Not recorded':'Δεν έχει καταχωριστεί')},
    {ok:Boolean(next),label:en?'Next meeting':'Επόμενη συνεδρίαση',value:next?`${fmtDate(next.date)} · ${next.title}`:(en?'Not scheduled':'Δεν έχει προγραμματιστεί')},
  ]
  return <section className="record-section committee-overview">
    <div className="module-summary-strip"><MetricCard icon={Users} value={members.length} label={en?'Active members':'Ενεργά μέλη'}/><MetricCard icon={CalendarDays} value={meetings.length} label={en?'Meetings':'Συνεδριάσεις'}/><MetricCard icon={ClipboardList} value={openDecisions.length} label={en?'Open actions':'Ανοιχτές ενέργειες'}/><MetricCard icon={Target} value={`${completedPlan}/${plan.length}`} label={en?'Plan objectives':'Στόχοι σχεδίου'}/></div>
    <div className="committee-overview-grid">
      <div className="committee-overview-main">
        <Head title={en?'Committee profile':'Στοιχεία επιτροπής'}/>
        <div className="committee-detail-grid">
          <div className="detail-field"><span>{en?'Chair':'Πρόεδρος / Συντονιστής'}</span><strong>{record.chair||'—'}</strong></div>
          <div className="detail-field"><span>{en?'Secretary':'Γραμματέας'}</span><strong>{record.secretary||'—'}</strong></div>
          <div className="detail-field"><span>{en?'Term':'Θητεία'}</span><strong>{fmtDate(record.termStart)} → {fmtDate(record.termEnd)}</strong></div>
          <div className="detail-field"><span>{en?'Decision no.':'Αρ. απόφασης'}</span><strong>{record.decisionNumber||'—'}</strong></div>
          <div className="detail-field"><span>{en?'Meeting frequency':'Συχνότητα'}</span><strong>{frequencyLabel(record.meetingFrequency,en)}</strong></div>
          <div className="detail-field"><span>{en?'Quorum':'Απαρτία'}</span><strong>{quorumLabel(record.quorumRule,en)}</strong></div>
        </div>
        <div className="source-truth-note"><strong>{en?'Committee role':'Ρόλος επιτροπής'}</strong><p>{record.committeeRole||'—'}</p></div>
        <div className="source-truth-note"><strong>{en?'Responsibilities / mandate':'Αρμοδιότητες / σκοπός'}</strong><p>{record.mandate||'—'}</p></div>
      </div>
      <aside className="committee-governance-watch"><div className="committee-watch-head"><ShieldCheck size={17}/><div><strong>{en?'Governance readiness':'Ετοιμότητα διακυβέρνησης'}</strong><span>{en?'Essential setup checks':'Βασικοί έλεγχοι πληρότητας'}</span></div></div>{checks.map((item,index)=><div className="committee-watch-item" key={index}><span className={item.ok?'ok':'attention'}>{item.ok?<CheckCircle2 size={13}/>:<XCircle size={13}/>}</span><div><small>{item.label}</small><strong>{item.value}</strong></div></div>)}</aside>
    </div>
  </section>
}

export function Members({rows,canManage,onAdd,onEdit,onEnd,en}){
  return <section className="record-section"><Head title={en?'Committee members':'Μέλη επιτροπής'} subtitle={en?'Membership is ended, not deleted, preserving history.':'Η συμμετοχή λήγει αντί να διαγράφεται, ώστε να διατηρείται ιστορικότητα.'} action={canManage&&<ActionButton tone="primary" label={en?'Add member':'Προσθήκη μέλους'} onClick={onAdd}><Plus size={15}/><span>{en?'Add member':'Προσθήκη μέλους'}</span></ActionButton>}/><div className="scroll-table"><table className="data-table"><thead><tr><th>{en?'Member':'Μέλος'}</th><th>{en?'Role':'Ιδιότητα'}</th><th>{en?'Responsibilities':'Αρμοδιότητες'}</th><th>{en?'Vote':'Ψήφος'}</th><th>{en?'Period':'Περίοδος'}</th>{canManage&&<th/>}</tr></thead><tbody>{rows.map(m=><tr key={m.id} className={m.active===false?'committee-member-inactive':''}><td><strong>{m.name}</strong><small>{[m.profession,m.department].filter(Boolean).join(' · ')||'—'}</small></td><td>{m.committeeTitle||'—'}</td><td>{m.responsibilities||'—'}</td><td>{m.voting?(en?'Yes':'Ναι'):(en?'No':'Όχι')}</td><td>{fmtDate(m.startedAt)} → {m.endedAt?fmtDate(m.endedAt):(en?'today':'σήμερα')}</td>{canManage&&<td>{m.active!==false&&<OverflowMenu label={en?'Member actions':'Ενέργειες μέλους'} items={[{id:'edit',label:en?'Edit member':'Επεξεργασία μέλους',icon:Pencil,onClick:()=>onEdit(m)},{id:'end',label:en?'End membership':'Λήξη συμμετοχής',icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>onEnd(m)}]}/>}</td>}</tr>)}</tbody></table>{!rows.length&&<div className="inline-empty">{en?'No members yet. Add the committee composition from here.':'Δεν υπάρχουν ακόμη μέλη. Προσθέστε τη σύνθεση της επιτροπής από εδώ.'}</div>}</div></section>
}

export function Meetings({rows,canCreate,canCancel,onAdd,onOpen,onCancel,en}){
  return <section className="record-section"><Head title={en?'Meetings & minutes':'Συνεδριάσεις & πρακτικά'} subtitle={en?'Attendance, quorum, agenda, minutes and governed approvals.':'Παρουσίες, απαρτία, θέματα, πρακτικά και ελεγχόμενες εγκρίσεις.'} action={canCreate&&<ActionButton tone="primary" label={en?'New meeting':'Νέα συνεδρίαση'} onClick={onAdd}><Plus size={15}/><span>{en?'New meeting':'Νέα συνεδρίαση'}</span></ActionButton>}/><div className="scroll-table"><table className="data-table record-table-clickable"><thead><tr><th>{en?'Date':'Ημερομηνία'}</th><th>{en?'Meeting':'Συνεδρίαση'}</th><th>{en?'Minutes no.':'Αρ. πρακτικού'}</th><th>{en?'Quorum':'Απαρτία'}</th><th>{en?'Status':'Κατάσταση'}</th>{canCancel&&<th/>}</tr></thead><tbody>{rows.map(x=><tr key={x.id} onClick={()=>onOpen(x)}><td>{fmtDate(x.date)}<small>{x.time||''}</small></td><td><strong>{x.title}</strong><small>{x.meetingType==='extraordinary'?(en?'Extraordinary':'Έκτακτη'):(en?'Regular':'Τακτική')}{x.location?` · ${x.location}`:''}</small>{x.status==='cancelled'&&x.cancellationReason&&<small>{en?'Reason':'Αιτιολογία'}: {x.cancellationReason}</small>}</td><td>{x.minutesNo||'—'}</td><td>{x.quorum===true?(en?'Yes':'Ναι'):x.quorum===false?(en?'No':'Όχι'):'—'}</td><td><span className={`status-badge ${x.status==='finalized'?'active':x.status==='approval_pending'?'temporary':''}`}>{statusLabel(x.status,en)}</span></td>{canCancel&&<td>{['draft','planned','in_progress'].includes(x.status)&&<OverflowMenu label={en?'Meeting actions':'Ενέργειες συνεδρίασης'} items={[{id:'cancel',label:en?'Cancel meeting':'Ακύρωση συνεδρίασης',icon:XCircle,tone:'danger',onClick:()=>onCancel(x)}]}/>}</td>}</tr>)}</tbody></table>{!rows.length&&<div className="inline-empty">{en?'No meetings yet.':'Δεν υπάρχουν ακόμη συνεδριάσεις.'}</div>}</div></section>
}

export function Decisions({rows,canManage,onAdd,onEdit,onStatus,en}){
  return <section className="record-section committee-decisions"><Head title={en?'Decisions & actions':'Αποφάσεις & ενέργειες'} action={canManage&&<ActionButton tone="primary" label={en?'New decision':'Νέα απόφαση'} onClick={onAdd}><Plus size={15}/><span>{en?'New decision':'Νέα απόφαση'}</span></ActionButton>}/><div className="scroll-table"><table className="data-table"><thead><tr><th>{en?'Decision':'Απόφαση'}</th><th>{en?'Owner':'Υπεύθυνος'}</th><th>{en?'Due':'Προθεσμία'}</th><th>{en?'Status':'Κατάσταση'}</th>{canManage&&<th/>}</tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{x.title}</strong><small>{x.action||'—'}</small></td><td>{x.owner||'—'}</td><td>{fmtDate(x.dueDate)}</td><td><span className={`status-badge ${workflowStatusClass(x.status)}`}>{workflowStatusLabel(x.status,en)}</span></td>{canManage&&<td><OverflowMenu label={en?'Decision actions':'Ενέργειες απόφασης'} items={[{id:'edit',label:en?'Edit decision':'Επεξεργασία απόφασης',icon:Pencil,onClick:()=>onEdit(x)},x.status!=='completed'&&{id:'complete',label:en?'Mark completed':'Σήμανση ως ολοκληρωμένη',icon:CheckCircle2,onClick:()=>onStatus(x,'completed')}].filter(Boolean)}/></td>}</tr>)}</tbody></table>{!rows.length&&<div className="inline-empty">{en?'No decisions or actions yet.':'Δεν υπάρχουν ακόμη αποφάσεις ή ενέργειες.'}</div>}</div></section>
}

export function Plan({rows,canManage,onAdd,onEdit,onDelete,en}){
  return <section className="record-section"><Head title={en?'Annual action plan':'Ετήσιο σχέδιο δράσης'} action={canManage&&<ActionButton tone="primary" label={en?'New objective':'Νέος στόχος'} onClick={onAdd}><Plus size={15}/><span>{en?'New objective':'Νέος στόχος'}</span></ActionButton>}/><div className="scroll-table"><table className="data-table"><thead><tr><th>{en?'Objective':'Στόχος'}</th><th>{en?'Indicator':'Δείκτης'}</th><th>{en?'Baseline → target':'Baseline → στόχος'}</th><th>{en?'Owner':'Υπεύθυνος'}</th><th>{en?'Due':'Προθεσμία'}</th><th>{en?'Status':'Κατάσταση'}</th>{canManage&&<th/>}</tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{x.title}</strong></td><td>{x.indicator||'—'}</td><td>{x.baseline||'—'} → {x.target||'—'}</td><td>{x.owner||'—'}</td><td>{fmtDate(x.dueDate)}</td><td><span className={`status-badge ${workflowStatusClass(x.status)}`}>{workflowStatusLabel(x.status,en)}</span></td>{canManage&&<td><OverflowMenu label={en?'Objective actions':'Ενέργειες στόχου'} items={[{id:'edit',label:en?'Edit objective':'Επεξεργασία στόχου',icon:Pencil,onClick:()=>onEdit(x)},{id:'delete',label:en?'Delete objective':'Διαγραφή στόχου',icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>onDelete(x)}]}/></td>}</tr>)}</tbody></table>{!rows.length&&<div className="inline-empty">{en?'No annual-plan objectives yet.':'Δεν υπάρχουν ακόμη στόχοι ετήσιου σχεδίου.'}</div>}</div></section>
}

export function Framework({record,canManage,onEdit,en}){
  return <section className="record-section"><Head title={en?'Role & institutional framework':'Ρόλος & θεσμικό πλαίσιο'} action={canManage&&<OverflowMenu label={en?'Framework actions':'Ενέργειες θεσμικού πλαισίου'} items={[{id:'edit',label:en?'Edit institutional framework':'Επεξεργασία θεσμικού πλαισίου',icon:Pencil,onClick:onEdit}]}/>}/><div className="details-grid"><div><span>{en?'Decision number':'Αρ. πράξης σύστασης'}</span><strong>{record.decisionNumber||'—'}</strong></div><div><span>{en?'Meeting frequency':'Συχνότητα συνεδριάσεων'}</span><strong>{frequencyLabel(record.meetingFrequency,en)}</strong></div></div><div className="source-truth-note"><strong>{en?'Committee role':'Ρόλος επιτροπής'}</strong><p>{record.committeeRole||'—'}</p></div><div className="source-truth-note"><strong>{en?'Legal basis':'Νομική / θεσμική βάση'}</strong><p>{record.legalBasis||'—'}</p></div><div className="source-truth-note"><strong>{en?'Mandate':'Αρμοδιότητα / σκοπός'}</strong><p>{record.mandate||'—'}</p></div></section>
}

export function History({rows,en}){
  return <section className="record-section"><Head title={en?'Committee history':'Ιστορικό επιτροπής'}/><div className="scroll-table"><table className="data-table"><thead><tr><th>{en?'Date / time':'Ημερομηνία / ώρα'}</th><th>{en?'Action':'Ενέργεια'}</th><th>{en?'Details':'Στοιχεία'}</th></tr></thead><tbody>{rows.map((x,i)=><tr key={x.id||i}><td>{x.at?new Date(x.at).toLocaleString(en?'en-GB':'el-GR'):'—'}</td><td><strong>{x.action}</strong></td><td>{x.reason||'—'}</td></tr>)}</tbody></table>{!rows.length&&<div className="inline-empty">{en?'No history yet.':'Δεν υπάρχει ακόμη ιστορικό.'}</div>}</div></section>
}
