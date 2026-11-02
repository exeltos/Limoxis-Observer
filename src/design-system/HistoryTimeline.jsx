import { RecordTabPanel } from './RecordTabPanel'

// A record's history tab: one timeline look everywhere (patients,
// surveillance, laboratory). Events are { at, title, detail?, meta?: [] },
// newest first; `when` formats the time.
export function HistoryTimeline({title,subtitle,events=[],when,emptyText,className='',card=false}){
  const list=events.length?<div className="patient-history-list">
      {events.map((event,index)=><article className="patient-history-event" key={`${event.at||'event'}-${index}`}>
        <div className="history-rail"><span/></div>
        <div className="history-event-main">
          <div className="history-event-heading"><strong>{event.title}</strong><time>{when(event.at)}</time></div>
          {event.detail&&<p>{event.detail}</p>}
          {event.meta?.filter(Boolean).length>0&&<div className="history-event-meta">{event.meta.filter(Boolean).map(item=><span key={item}>{item}</span>)}</div>}
        </div>
      </article>)}
    </div>:<div className="inline-empty">{emptyText}</div>
  // `card`: the same card as the Documents tab (title, one line saying what it holds, then the list).
  if(card)return <div className={`record-section documents-workspace history-card ${className}`.trim()}>
    <div className="record-section-header lo-section-header"><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div></div>
    {list}
  </div>
  return <RecordTabPanel className={`patient-history-section ${className}`.trim()} title={title} subtitle={subtitle}>
    {list}
  </RecordTabPanel>
}
