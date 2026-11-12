import { useState,type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface RailItem { id: string, label: string, icon: LucideIcon, tone?: string, render: () => ReactNode }

// A group of settings screens as one list on the left and the chosen screen on the right (the same look as the
// reference lists). items: [{ id, label, icon, tone, render }].
export function ManagementRail({ items = [], initial = null, ariaLabel = '' }: { items?: RailItem[], initial?: string | null, ariaLabel?: string }) {
  const [active, setActive] = useState(() => (items.some(item => item.id === initial) ? initial : items[0]?.id))
  const current = items.find(item => item.id === active) || items[0]
  if (!current) return null
  return <section className="management-section management-scroll-section library-section">
    <div className="library-layout workspace-fill">
      <aside className="library-categories library-categories-v2 scroll-list" aria-label={ariaLabel}>{items.map(({ id, label, icon: Icon, tone = 'slate' }) => <button key={id} type="button" className={current.id === id ? 'active' : ''} aria-current={current.id === id ? 'true' : undefined} onClick={() => setActive(id)}><span className={`library-category-icon tone-${tone}`}><Icon size={16} /></span><span className="library-category-copy"><strong>{label}</strong></span></button>)}</aside>
      <div className="library-content workspace-column"><div className="library-extra-scroll">{current.render()}</div></div>
    </div>
  </section>
}
