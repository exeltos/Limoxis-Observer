import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, ExternalLink, History, RefreshCcw, ShieldAlert, XCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { changesByRun } from './clinicalContentSourceService'
import './platformUpdateCenter.css'

const DAY=86400000
const copy={
 el:{title:'Κέντρο ενημερώσεων πλατφόρμας',subtitle:'Ελεγχόμενες κλινικές πηγές, αλλαγές που περιμένουν έλεγχο και ιστορικό ελέγχων.',pending:'Προς έλεγχο',lastCheck:'Τελευταίος έλεγχος',sources:'Πηγές ελέγχθηκαν',failures:'Αποτυχίες 30 ημερών',never:'Ποτέ',runNow:'Έλεγχος τώρα',running:'Έλεγχος σε εξέλιξη…',changesTitle:'Αλλαγές προς έλεγχο',changesHint:'Η πηγή άλλαξε από τον προηγούμενο έλεγχο. Ελέγξτε αν επηρεάζει κριτήρια, δείκτες ή κλίμακες πριν τη σημειώσετε ως ελεγμένη.',noChanges:'Όλες οι πηγές είναι ενημερωμένες',noChangesText:'Δεν υπάρχει αλλαγή που να περιμένει έλεγχο.',detected:'Εντοπίστηκε',changedNote:'Το περιεχόμενο της πηγής άλλαξε· απαιτείται κλινικός έλεγχος.',openSource:'Άνοιγμα πηγής',deferredBadge:'Σε αναβολή',defer:'Αναβολή 7 ημερών',reviewed:'Ελέγχθηκε',historyTitle:'Ιστορικό ελέγχων',manual:'Χειροκίνητος',automatic:'Αυτόματος',sourcesN:n=>`${n} ${n===1?'πηγή':'πηγές'}`,changesN:n=>`${n} ${n===1?'αλλαγή':'αλλαγές'}`,completed:'Ολοκληρώθηκε',failed:'Απέτυχε',runningStatus:'Σε εξέλιξη',showAll:n=>`Προβολή όλων (${n})`,showLess:'Λιγότερα',noHistory:'Δεν έχει γίνει ακόμη έλεγχος.',seconds:'δευτ.',failedNote:'Ο έλεγχος διακόπηκε πριν ολοκληρωθεί.',showChanges:'Εμφάνιση αλλαγών',hideChanges:'Απόκρυψη αλλαγών',changesOfRun:'Πηγές που άλλαξαν σε αυτόν τον έλεγχο',noChangeDetails:'Δεν βρέθηκαν λεπτομέρειες για αυτές τις αλλαγές.',reviewedOn:'Ελέγχθηκε',deferredOn:'Σε αναβολή από',pendingReview:'Περιμένει έλεγχο',ago:{now:'μόλις τώρα',min:n=>`πριν ${n} λεπ.`,hour:n=>`πριν ${n} ώρ.`,day:n=>`πριν ${n} ${n===1?'ημέρα':'ημέρες'}`}},
 en:{title:'Platform update center',subtitle:'Governed clinical sources, changes awaiting review and check history.',pending:'To review',lastCheck:'Last check',sources:'Sources checked',failures:'Failures, 30 days',never:'Never',runNow:'Check now',running:'Checking…',changesTitle:'Changes to review',changesHint:'The source changed since the previous check. Review whether it affects criteria, indicators or scales before marking it as reviewed.',noChanges:'All sources are up to date',noChangesText:'No change is waiting for review.',detected:'Detected',changedNote:'Source content changed; clinical review required.',openSource:'Open source',deferredBadge:'Postponed',defer:'Postpone 7 days',reviewed:'Reviewed',historyTitle:'Check history',manual:'Manual',automatic:'Automatic',sourcesN:n=>`${n} ${n===1?'source':'sources'}`,changesN:n=>`${n} ${n===1?'change':'changes'}`,completed:'Completed',failed:'Failed',runningStatus:'Running',showAll:n=>`Show all (${n})`,showLess:'Show less',noHistory:'No check has run yet.',seconds:'s',failedNote:'The check stopped before completing.',showChanges:'Show changes',hideChanges:'Hide changes',changesOfRun:'Sources that changed in this check',noChangeDetails:'No details were found for these changes.',reviewedOn:'Reviewed',deferredOn:'Postponed on',pendingReview:'Awaiting review',ago:{now:'just now',min:n=>`${n} min ago`,hour:n=>`${n} h ago`,day:n=>`${n} ${n===1?'day':'days'} ago`}},
}

function relative(value,c){if(!value)return c.never;const diff=Date.now()-new Date(value).getTime();if(diff<60000)return c.ago.now;if(diff<3600000)return c.ago.min(Math.round(diff/60000));if(diff<DAY)return c.ago.hour(Math.round(diff/3600000));return c.ago.day(Math.round(diff/DAY))}

export function PlatformUpdateCenter({language='el',pending=[],history=[],changes=[],reviewingId=null,onReview,onRun,running=null,onClose}){
 const en=language==='en',c=copy[en?'en':'el'],locale=en?'en-GB':'el-GR'
 const [showAll,setShowAll]=useState(false),[openRun,setOpenRun]=useState(null)
 const runChanges=changesByRun(history,changes)
 const fmt=value=>value?new Date(value).toLocaleString(locale,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'
 const last=history[0]||null
 const failures=history.filter(run=>run.status==='failed'&&Date.now()-new Date(run.started_at).getTime()<30*DAY).length
 const visibleHistory=showAll?history:history.slice(0,6)
 const runStatus=run=>run.status==='completed'?['ok',c.completed,CheckCircle2]:run.status==='failed'?['fail',c.failed,XCircle]:['run',c.runningStatus,Clock3]
 const duration=run=>run.completed_at&&run.started_at?Math.max(1,Math.round((new Date(run.completed_at)-new Date(run.started_at))/1000)):null
 return <ObserverDialog className="platform-update-center-dialog" width="wide" title={c.title} subtitle={c.subtitle} onClose={onClose}>
  <div className="puc">
   <div className="puc-toolbar"><span>{last?`${c.lastCheck}: ${fmt(last.started_at)}`:c.noHistory}</span><Button onClick={onRun} disabled={Boolean(running)} loading={Boolean(running)}><RefreshCcw size={15}/>{running?c.running:c.runNow}</Button></div>
   <div className="puc-summary">
    <div className={`puc-tile ${pending.length?'is-warning':'is-ok'}`}><ShieldAlert size={18}/><div><strong>{pending.length}</strong><span>{c.pending}</span></div></div>
    <div className="puc-tile"><History size={18}/><div><strong>{relative(last?.started_at,c)}</strong><span>{c.lastCheck}</span></div></div>
    <div className="puc-tile"><CheckCircle2 size={18}/><div><strong>{last?.checked_count??'—'}</strong><span>{c.sources}</span></div></div>
    <div className={`puc-tile ${failures?'is-danger':''}`}><AlertTriangle size={18}/><div><strong>{failures}</strong><span>{c.failures}</span></div></div>
   </div>
   {running&&<div className="puc-progress"><div><strong>{running.label}</strong>{running.detail&&<small>{running.detail}</small>}</div><progress max={running.total} value={running.current}/></div>}

   <section className="puc-section">
    <header><h4>{c.changesTitle}</h4>{pending.length>0&&<p>{c.changesHint}</p>}</header>
    {pending.length?<div className="puc-changes">{pending.map(item=>{const source=item.source||{};const deferred=item.review_status==='deferred';return <article key={item.id} className={`puc-change${deferred?' is-deferred':''}`}>
     <div className="puc-change-main">
      <div className="puc-change-title"><strong>{source.name||source.authority||'—'}</strong>{deferred&&<span className="puc-badge">{c.deferredBadge}</span>}</div>
      <div className="puc-change-meta">{source.authority&&<span className="puc-chip">{source.authority}</span>}{source.current_version&&<span className="puc-chip">{source.current_version}</span>}<span>{c.detected}: {fmt(item.checked_at)}</span></div>
      {item.note&&<p className="puc-note">{/^source content changed/i.test(item.note)?c.changedNote:(en||/[α-ωά-ώ]/i.test(item.note)?item.note:c.changedNote)}</p>}
      {source.source_url&&<a className="puc-link" href={source.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>{c.openSource}</a>}
     </div>
     <div className="puc-change-actions"><Button variant="secondary" loading={reviewingId===`${item.id}:deferred`} disabled={Boolean(reviewingId)} onClick={()=>onReview(item,'deferred')}>{c.defer}</Button><Button loading={reviewingId===`${item.id}:approved`} disabled={Boolean(reviewingId)} onClick={()=>onReview(item,'approved')}><CheckCircle2 size={15}/>{c.reviewed}</Button></div>
    </article>})}</div>:<div className="puc-empty"><CheckCircle2 size={22}/><div><strong>{c.noChanges}</strong><span>{c.noChangesText}</span></div></div>}
   </section>

   <section className="puc-section">
    <header><h4>{c.historyTitle}</h4></header>
    {history.length?<ol className="puc-history">{visibleHistory.map(run=>{const [tone,label,Icon]=runStatus(run);const seconds=duration(run);const error=run.summary?.error;const open=openRun===run.id;const found=runChanges.get(run.id)||[];return <li key={run.id} className={`puc-run-row is-${tone}`}>
     <Icon size={17} className="puc-run-icon"/>
     <div className="puc-run-main"><strong>{fmt(run.started_at)}</strong><span>{run.trigger==='scheduled'?c.automatic:c.manual}{seconds?` · ${seconds} ${c.seconds}`:''}</span>{tone==='fail'&&<small title={error||undefined}>{c.failedNote}</small>}</div>
     <div className="puc-run-counts"><span>{c.sourcesN(run.checked_count||0)}</span>{run.changed_count?<button type="button" className="has-changes" aria-expanded={open} aria-controls={`puc-run-changes-${run.id}`} title={open?c.hideChanges:c.showChanges} onClick={()=>setOpenRun(open?null:run.id)}>{c.changesN(run.changed_count)}<ChevronDown size={13} aria-hidden="true"/></button>:<span>{c.changesN(0)}</span>}</div>
     <span className={`puc-status is-${tone}`}>{label}</span>
     {open&&<div className="puc-run-changes" id={`puc-run-changes-${run.id}`}><strong>{c.changesOfRun}</strong>{found.length?<ul>{found.map(item=>{const source=item.source||{};const state=item.review_status==='approved'?['ok',`${c.reviewedOn} ${fmt(item.reviewed_at)}`]:item.review_status==='deferred'?['deferred',`${c.deferredOn} ${fmt(item.reviewed_at)}`]:['pending',c.pendingReview];return <li key={item.id}>
      <div><span className="puc-run-change-name">{source.name||source.authority||'—'}</span>{source.authority&&source.name&&<small>{source.authority}</small>}</div>
      <span className={`puc-review is-${state[0]}`}>{state[1]}</span>
      {source.source_url&&<a className="puc-link" href={source.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>{c.openSource}</a>}
     </li>})}</ul>:<p>{c.noChangeDetails}</p>}</div>}
    </li>})}</ol>:<div className="puc-empty"><History size={20}/><div><strong>{c.noHistory}</strong></div></div>}
    {history.length>6&&<button type="button" className="puc-more" onClick={()=>setShowAll(v=>!v)}>{showAll?c.showLess:c.showAll(history.length)}</button>}
   </section>
  </div>
 </ObserverDialog>
}
