export function MetricCard({icon:Icon,value,label,tone='neutral',className='',onClick,active}){
  const interactive=Boolean(onClick)
  return <div
    className={`metric-card canonical-metric-card tone-${tone} ${interactive?'canonical-metric-card-interactive':''} ${className}`.trim()}
    onClick={onClick}
    role={interactive?'button':undefined}
    tabIndex={interactive?0:undefined}
    aria-pressed={interactive?Boolean(active):undefined}
    onKeyDown={interactive?(event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onClick(event)}}):undefined}
  >
    {Icon&&<span className="canonical-metric-icon"><Icon aria-hidden="true"/></span>}
    <div className="canonical-metric-copy"><strong>{value}</strong><span>{label}</span></div>
  </div>
}
