import { Meter } from './MiniCharts'

// A record's key figures in one bordered row (compliance, totals, indicator):
// the same look in every module. `primary` highlights the headline figure,
// `tone` ('danger', 'warning', 'success') colours the figure by its state;
// `meter` (0–100) draws a thin progress bar under it.
export function RecordMetricStrip({items=[],className=''}){
  const visible=items.filter(item=>item&&item.hidden!==true)
  return <div className={`record-metric-strip ${className}`.trim()} style={{'--metric-count':visible.length}}>
    {visible.map(item=><div key={item.id||item.label} className={`record-metric ${item.primary?'is-primary':''} ${item.tone?`is-${item.tone}`:''}`.trim()}>
      <span className="lo-field-label">{item.label}</span>
      <strong>{item.value===0?0:(item.value??'—')}{item.unit&&<small>{item.unit}</small>}</strong>
      {item.meter!=null&&<Meter value={item.meter} tone={item.tone||'neutral'} label={`${item.label}: ${Math.round(item.meter)}%`}/>}
      {item.note&&<em>{item.note}</em>}
    </div>)}
  </div>
}
