// textValue: the value is words (a status and a date), shown on one smaller
// line, ellipsised, with the full text on hover.
export function MetricCard({icon:Icon,value,label,tone='neutral',className='',onClick,active,textValue=false}){
  const interactive=Boolean(onClick)
  return <div
    className={`metric-card canonical-metric-card tone-${tone} ${interactive?'canonical-metric-card-interactive':''} ${textValue?'canonical-metric-card-text':''} ${className}`.trim()}
    onClick={onClick}
    role={interactive?'button':undefined}
    tabIndex={interactive?0:undefined}
    aria-pressed={interactive?Boolean(active):undefined}
    onKeyDown={interactive?(event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onClick(event)}}):undefined}
  >
    {Icon&&<span className="canonical-metric-icon"><Icon aria-hidden="true"/></span>}
    <div className="canonical-metric-copy"><strong title={textValue&&typeof value==='string'?value:undefined}>{value}</strong><span>{label}</span></div>
  </div>
}
