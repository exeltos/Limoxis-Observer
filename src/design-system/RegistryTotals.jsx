// The totals of a registry list, beside its search and filters (FilterBar `end`): a few counts of what the list
// shows, each one a shortcut to the matching filter. Takes no height of its own.
export function RegistryTotals({ items = [], label }) {
  const shown = items.filter(item => item && (item.always || Number(item.value) > 0))
  if (!shown.length) return null
  return (
    <div className="registry-totals" role="group" aria-label={label}>
      {shown.map(item => {
        const content = <><strong>{Number(item.value || 0).toLocaleString('el-GR')}</strong><span>{item.label}</span></>
        return item.onClick
          ? <button key={item.key} type="button" className={`registry-total${item.active ? ' is-active' : ''}`} aria-pressed={Boolean(item.active)} onClick={item.onClick}>{content}</button>
          : <span key={item.key} className="registry-total">{content}</span>
      })}
    </div>
  )
}
