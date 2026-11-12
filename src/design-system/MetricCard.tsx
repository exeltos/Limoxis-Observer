import type { ReactNode, SyntheticEvent } from 'react'
import { MetricSkeleton } from './LoadingSkeleton'
import type { IconType } from './types'

// textValue: the value is words (a status and a date), shown on one smaller
// line, ellipsised, with the full text on hover.
// loading: the figure is not known yet (first load), so it shows a placeholder, never 0.
interface MetricCardProps {
  icon?: IconType
  value?: ReactNode
  label?: ReactNode
  tone?: string
  className?: string
  // Pressing the card (mouse, Enter or Space).
  onClick?: (event: SyntheticEvent<HTMLDivElement>) => void
  active?: boolean
  textValue?: boolean
  loading?: boolean
}

export function MetricCard({icon:Icon,value,label,tone='neutral',className='',onClick,active,textValue=false,loading=false}: MetricCardProps){
  const interactive=Boolean(onClick)
  return <div
    className={`metric-card canonical-metric-card tone-${tone} ${interactive?'canonical-metric-card-interactive':''} ${textValue?'canonical-metric-card-text':''} ${className}`.trim()}
    onClick={onClick}
    role={interactive?'button':undefined}
    tabIndex={interactive?0:undefined}
    aria-pressed={interactive?Boolean(active):undefined}
    aria-busy={loading||undefined}
    onKeyDown={interactive?(event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onClick?.(event)}}):undefined}
  >
    {Icon&&<span className="canonical-metric-icon"><Icon aria-hidden="true"/></span>}
    <div className="canonical-metric-copy"><strong title={textValue&&typeof value==='string'?value:undefined}>{loading?<MetricSkeleton/>:value}</strong><span>{label}</span></div>
  </div>
}
