import { MetricCard } from './MetricCard'

// The counts above a registry, as one row of cards: pressing a card filters the list by it, pressing it
// again shows everything. items: [{ key, icon, label, value, active, onToggle, tone? }]. A card without
// onToggle is only a count.
export function StatusCards({ items = [], label, loading = false }) {
  return (
    <div className="workspace-summary status-cards" role="group" aria-label={label}>
      <div className="module-summary-strip">
        {items.map(item => (
          <MetricCard key={item.key} className="summary-metric" loading={loading} icon={item.icon} value={item.value} label={item.label} tone={item.tone || 'neutral'} active={Boolean(item.active)} onClick={item.onToggle} />
        ))}
      </div>
    </div>
  )
}
