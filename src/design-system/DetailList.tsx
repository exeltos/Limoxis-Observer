import { useState, type Key, type ReactNode } from 'react'
import './DetailList.css'
import { useOptionalLanguage } from '../core/i18n/LanguageContext'
import type { RecordDetailField } from './RecordDetailsGrid'

// The one look for the field values of a record (instead of a grid of boxed
// cells): sections with a short heading, each a two-column list of label /
// value pairs. The label is small and muted above its value, rows are
// separated by a thin line, nothing is boxed, values wrap (never truncated),
// a missing value reads «—» in muted text.
//
//   <DetailList sections={[
//     { title: 'Στοιχεία ασθενούς', items: [{ label: 'Επώνυμο', value: 'Ιωαννίδη' }, { label: 'Σημειώσεις', value: '…', wide: true }] },
//   ]} />
//
// `collapseMissing` on a section moves its empty items into one muted line
// «Δεν έχουν καταχωριστεί: Πατρώνυμο, Φύλο» (with `onEditMissing` as a link).
export const isBlankValue = (value: unknown) => value == null || value === false || (typeof value === 'string' && !value.trim()) || value === '—'

const LONG_TEXT = 600

export interface DetailItemProps { label?: ReactNode; value?: ReactNode; wide?: boolean; className?: string }
export interface DetailItemData extends DetailItemProps { key?: string }

export function DetailItem({ label, value, wide = false, className = '' }: DetailItemProps) {
  const blank = isBlankValue(value)
  const en = useOptionalLanguage()?.language === 'en'
  const [open, setOpen] = useState(false)
  const long = wide && typeof value === 'string' && value.length > LONG_TEXT
  return (
    <div className={`lo-detail-item${wide ? ' is-wide' : ''}${blank ? ' is-empty' : ''} ${className}`.trim()}>
      <dt>{label}</dt>
      <dd className={long && !open ? 'is-clamped' : undefined}>{blank ? '—' : value}</dd>
      {long && <button type="button" className="lo-detail-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? (en ? 'Show less' : 'Λιγότερα') : (en ? 'Show more' : 'Περισσότερα')}</button>}
    </div>
  )
}

export interface DetailSectionProps {
  title?: ReactNode
  items?: Array<DetailItemData | null | false | undefined>
  collapseMissing?: boolean
  onEditMissing?: () => void
  editLabel?: ReactNode
  className?: string
}

export function DetailSection({ title, items = [], collapseMissing = false, onEditMissing, editLabel, className = '' }: DetailSectionProps) {
  const en = useOptionalLanguage()?.language === 'en'
  const visible = items.filter(Boolean)
  const shown = collapseMissing ? visible.filter(item => !isBlankValue(item.value)) : visible
  const missing = collapseMissing ? visible.filter(item => isBlankValue(item.value)) : []
  if (!shown.length && !missing.length) return null
  return (
    <section className={`lo-detail-section ${className}`.trim()}>
      {title && <h4 className="lo-detail-heading">{title}</h4>}
      {shown.length > 0 && (
        <dl className="lo-detail-list">
          {shown.map(item => <DetailItem key={(item.key || item.label) as Key} {...item} />)}
        </dl>
      )}
      {missing.length > 0 && (
        <p className="lo-detail-missing">
          <span>{en ? 'Not recorded:' : 'Δεν έχουν καταχωριστεί:'} {missing.map(item => item.label).join(', ')}</span>
          {onEditMissing && <button type="button" className="lo-detail-missing-link" onClick={onEditMissing}>{editLabel || (en ? 'Edit' : 'Επεξεργασία')}</button>}
        </p>
      )}
    </section>
  )
}

export function DetailList({ sections = [], className = '' }: { sections?: Array<(DetailSectionProps & { key?: string }) | null | false | undefined>; className?: string }) {
  return (
    <div className={`lo-detail-sections ${className}`.trim()}>
      {sections.filter(Boolean).map((section, index) => <DetailSection key={(section.key || section.title || index) as Key} {...section} />)}
    </div>
  )
}

// The same list from RecordDetailsGrid-style fields ({ id, label, value, meta, hidden }),
// so a record can move to the one look without reshaping its fields.
export function DetailFields({ fields = [], className = '' }: { fields?: Array<RecordDetailField | null | false | undefined>; className?: string }) {
  const items = fields
    .filter((field): field is RecordDetailField => !!field && field.hidden !== true)
    .map(field => ({ label: field.label, wide: field.wide === true, value: field.meta ? <>{field.value === 0 ? 0 : field.value || '—'} <small className="lo-detail-meta">{field.meta}</small></> : field.value }))
  return <DetailList className={className} sections={[{ items }]} />
}
