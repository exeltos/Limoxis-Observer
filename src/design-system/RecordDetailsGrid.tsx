import { Fragment, type Key, type ReactNode } from 'react'

export interface RecordDetailField {
  id?: string
  label: ReactNode
  value?: ReactNode
  meta?: ReactNode
  className?: string
  hidden?: boolean
  wide?: boolean
}

interface RecordDetailsGridProps { fields?: Array<RecordDetailField | null | false | undefined>; className?: string }

export function RecordDetailsGrid({ fields = [], className = '' }: RecordDetailsGridProps) {
  const visible = fields.filter((field): field is RecordDetailField => !!field && field.hidden !== true)
  return <div className={`detail-grid patient-detail-grid record-details-grid ${className}`.trim()}>
    {visible.map(field => <Fragment key={(field.id || field.label) as Key}>
      <div className={`detail-item ${field.className || ''}`.trim()}>
        <span className="lo-field-label">{field.label}</span>
        <strong>{field.value === 0 ? 0 : (field.value || '—')}</strong>
        {field.meta && <small>{field.meta}</small>}
      </div>
    </Fragment>)}
  </div>
}
