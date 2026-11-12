// The totals of a registry list, beside its search and filters (FilterBar `end`): a few counts of what the list
// shows, each one a shortcut to the matching filter. Takes no height of its own.
import type { ReactNode } from 'react'

export interface RegistryTotal {
  key: string
  value?: number | string | null
  display?: ReactNode
  label?: ReactNode
  always?: boolean
  onClick?: () => void
  active?: boolean
  tone?: string
  title?: string
}

interface RegistryTotalsProps { items?: Array<RegistryTotal | null | false | undefined>; label?: string }

export function RegistryTotals({ items = [], label }: RegistryTotalsProps) {
  // item.display (optional) replaces the formatted number, e.g. «9%»; item.tone ('good' | 'warning' | 'danger') colours
  // the number; item.title is the tooltip (the period, the target).
  const shown = items.filter((item): item is RegistryTotal => !!item && (Boolean(item.always) || Number(item.value) > 0))
  if (!shown.length) return null
  return (
    <div className="registry-totals" role="group" aria-label={label}>
      {shown.map(item => {
        const content = <><strong>{item.display ?? Number(item.value || 0).toLocaleString('el-GR')}</strong><span>{item.label}</span></>
        return item.onClick
          ? <button key={item.key} type="button" title={item.title} className={`registry-total${item.active ? ' is-active' : ''}${item.tone ? ` is-${item.tone}` : ''}`} aria-pressed={Boolean(item.active)} onClick={item.onClick}>{content}</button>
          : <span key={item.key} title={item.title} className={`registry-total${item.tone ? ` is-${item.tone}` : ''}`}>{content}</span>
      })}
    </div>
  )
}
