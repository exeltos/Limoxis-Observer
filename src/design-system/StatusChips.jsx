// The counts above a registry as one row of filter chips: pressing a chip filters the list by it,
// pressing it again shows everything. items: [{ key, label, value, active, onToggle, tone? }].
export function StatusChips({ items = [], label, loading = false }) {
  return (
    <div className="status-chips" role="group" aria-label={label}>
      {items.map(item => (
        <button key={item.key} type="button" className={`status-chip ${item.tone ? `tone-${item.tone}` : ''} ${item.active ? 'is-active' : ''}`.replace(/\s+/g, ' ').trim()} aria-pressed={item.active} onClick={item.onToggle}>
          {item.label}
          <strong>{loading ? '…' : item.value}</strong>
        </button>
      ))}
    </div>
  )
}
