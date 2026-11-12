import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import type { IconType } from './types'

interface CardProps extends HTMLAttributes<HTMLElement> {
  size?: string
  tone?: string
  // The element the card is drawn as (default <section>).
  as?: ElementType
}

export function Card({children,className='',size='standard',tone='default',as:Tag='section',...props}: CardProps){
  return <Tag className={`lo-card lo-card-${size} ${tone!=='default'?`lo-card-${tone}`:''} ${className}`.trim()} {...props}>{children}</Tag>
}

interface CardHeaderProps { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: IconType; className?: string }

export function CardHeader({title,subtitle,actions,icon:Icon,className=''}: CardHeaderProps) {
  return <header className={`lo-card-header ${className}`.trim()}>
    {Icon&&<span className="lo-card-icon"><Icon size={17}/></span>}
    <div className="lo-card-heading"><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</div>
    {actions&&<div className="lo-card-actions">{actions}</div>}
  </header>
}
