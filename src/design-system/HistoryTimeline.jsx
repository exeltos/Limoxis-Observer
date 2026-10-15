import { RecordTabPanel } from './RecordTabPanel'

// A record's history tab: one timeline look everywhere (patients,
// surveillance, laboratory). Events are { at, title, detail?, meta?: [] },
// newest first; `when` formats the time.
export function HistoryTimeline({title,subtitle,events=[],when,emptyText,className=''}){
  return <RecordTabPanel className={`patient-history-section ${className}`.trim()} title={title} subtitle={subtitle}>
    {events.length?<div className="patient-history-list">
      {events.map((event,index)=><article className="patient-history-event" key={`${event.at||'event'}-${index}`}>
        <div className="history-rail"><span/></div>
        <div className="history-event-main">
          <div className="history-event-heading"><strong>{event.title}</strong><time>{when(event.at)}</time></div>
          {event.detail&&<p>{event.detail}</p>}
          {event.meta?.filter(Boolean).length>0&&<div className="history-event-meta">{event.meta.filter(Boolean).map(item=><span key={item}>{item}</span>)}</div>}
        </div>
      </article>)}
    </div>:<div className="inline-empty">{emptyText}</div>}
  </RecordTabPanel>
}
