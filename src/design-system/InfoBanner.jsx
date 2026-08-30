import { Info } from 'lucide-react'

export function InfoBanner({ icon: Icon = Info, title, children, className = '' }) {
  return (
    <div className={`info-banner ${className}`.trim()}>
      <Icon size={14} />
      <div>
        {title && <strong>{title}</strong>}
        <span>{children}</span>
      </div>
    </div>
  )
}
