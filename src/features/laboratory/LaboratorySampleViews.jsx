import { AlertTriangle,Microscope } from 'lucide-react'
import { methodLabel } from './laboratorySampleFormat'

// Read-only views of the laboratory sample record: the result card and the history.

export function ResultCard({t,tx,language,result,organisms,isEnvironmental,standard,menu}){
 const hasLimit=standard?.limitCfu!=null&&standard?.limitCfu!==''
 const title=isEnvironmental?t('laboratoryRecords.environmentalResult'):t('laboratoryRecords.resultAndOrganism')
 return <section className="lab-record-card lab-result-card">
  <div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.microbiologyResult')}</span><h3><Microscope size={15}/> {title}</h3></div>{menu}</div>
  {isEnvironmental&&<div className={`smart-protocol-strip ${hasLimit?'configured':'missing'}`}><div><strong>{standard?.protocolCode||tx('noProtocol')}</strong>{hasLimit&&<span> · {standard.limitCfu} {standard.unit||'CFU'}</span>}</div><span className="smart-lock-chip">🔒 {tx('protocol')}</span></div>}
  {result?<div className="lab-result-band">
   <div className={`lab-result-primary is-${result.result||'none'}`}><span>{t('result')}</span><strong>{result.result?t(result.result):'—'}</strong>{result.critical&&<small><AlertTriangle size={12}/> {tx('critical')}</small>}</div>
   <div><span>{tx('organisms')}</span><strong>{organisms.length?organisms.join(', '):'—'}</strong></div>
   <div><span>{tx('method')}</span><strong>{methodLabel(result.method,language)}</strong></div>
   <div><span>{tx('status')}</span><strong><span className={`status-badge ${result.resultStatus==='draft'?'temporary':'active'}`}>{tx(result.resultStatus)}</span></strong></div>
   {isEnvironmental&&<><div><span>{tx('cfu')}</span><strong>{result.result==='negative'?'0':result.cfuCount??'—'}</strong></div><div><span>{tx('assessment')}</span><strong>{result.withinLimit===true?tx('within'):result.withinLimit===false?tx('outside'):tx('noLimit')}</strong></div></>}
  </div>:<div className="lab-table-empty lab-result-empty">{tx('noResult')}</div>}
 </section>
}

export function LabHistory({sample,t,tx,fmt}){
 const events=[
  sample.requestedAt&&{at:sample.requestedAt,title:t('requested')},
  sample.collectedAt&&{at:sample.collectedAt,title:t('collectedLabel')},
  sample.receivedAt&&{at:sample.receivedAt,title:t('received')},
  ...(sample.microbiologyResults||[]).flatMap(item=>[
   item.resultedAt&&{at:item.resultedAt,title:`${t('laboratoryRecords.microbiologyResult')} · ${tx(item.resultStatus)}`},
   ...(item.communications||[]).map(row=>row.at&&{at:row.at,title:tx('communicationTitle'),by:row.to||row.recipientName}),
  ]),
  sample.documentsReviewedAt&&{at:sample.documentsReviewedAt,title:tx('documentsDone')},
  sample.rejectedAt&&{at:sample.rejectedAt,title:`${tx('reject')} · ${sample.rejectionReason||'—'}`},
  sample.finalizedAt&&{at:sample.finalizedAt,title:tx('finalized')},
 ].filter(Boolean).sort((a,b)=>new Date(b.at)-new Date(a.at))
 if(!events.length)return <div className="inline-empty">{t('noData')}</div>
 return <div className="lab-history-list">{events.map((event,index)=><div className="lab-history-row" key={`${event.at}-${index}`}><time>{fmt(event.at)}</time><strong>{event.title}</strong><span>{event.by||''}</span></div>)}</div>
}

