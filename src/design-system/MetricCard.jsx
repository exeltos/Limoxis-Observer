export function MetricCard({icon:Icon,value,label,tone='neutral',className=''}){
  return <div className={`metric-card canonical-metric-card tone-${tone} ${className}`.trim()}>
    {Icon&&<span className="canonical-metric-icon"><Icon aria-hidden="true"/></span>}
    <div className="canonical-metric-copy"><strong>{value}</strong><span>{label}</span></div>
  </div>
}
