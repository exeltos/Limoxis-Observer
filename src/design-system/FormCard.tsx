import type { ReactNode } from 'react'
import type { IconType } from './types'
import './FormCard.css'

// A titled group of fields in a form page (New control, New report…): cards sit
// two to a row on a laptop and one per row on a portrait tablet.
interface FormCardProps { title?: ReactNode; hint?: ReactNode; icon?: IconType; wide?: boolean; className?: string; children?: ReactNode }

export function FormCard({ title, hint, icon: Icon, wide = false, className = '', children }: FormCardProps) {
  return (
    <section className={`lo-form-card ${wide ? 'is-wide' : ''} ${className}`.trim()}>
      {(title || hint) && <header><strong>{Icon && <Icon size={15} aria-hidden="true" />}{title}</strong>{hint && <span>{hint}</span>}</header>}
      {children}
    </section>
  )
}

interface FormGridProps { columns?: number; className?: string; children?: ReactNode }

export function FormGrid({ columns, className = '', children }: FormGridProps) {
  return <div className={`lo-form-grid ${columns ? `cols-${columns}` : ''} ${className}`.trim()}>{children}</div>
}
