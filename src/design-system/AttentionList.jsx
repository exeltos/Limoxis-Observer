import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import './AttentionList.css'

// «Χρειάζεται προσοχή»: what a record still needs, the most urgent first, one look
// everywhere. items: [{ id, text, tone: 'danger'|'warning'|'info', action?, onClick? }]
// — with `action` the row ends in a link («Μετάβαση …»), without it the whole row opens.
// limit: how many rows show before «και N ακόμη».
export function AttentionList({ title, items = [], limit = null, moreLabel = count => `+${count}`, className = '' }) {
  const [all, setAll] = useState(false)
  if (!items.length) return null
  const shown = all || !limit ? items : items.slice(0, limit)
  const urgent = items.some(item => item.tone === 'danger')
  return <div className={`lo-attention ${className}`.trim()} role={urgent ? 'alert' : 'status'}>
    <div className="lo-attention-title"><AlertTriangle size={15} aria-hidden="true" /><strong>{title}</strong><span>{items.length}</span></div>
    <ul>
      {shown.map((item, index) => {
        const tone = item.tone === 'danger' ? 'danger' : item.tone === 'info' ? 'info' : 'warning'
        return <li key={`${item.id}-${index}`} className={`tone-${tone}`}>
          {item.onClick && !item.action
            ? <button type="button" className="lo-attention-row" onClick={item.onClick}><span>{item.text}</span><b aria-hidden="true">→</b></button>
            : <>
              <span>{item.text}</span>
              {item.onClick && <button type="button" className="lo-attention-link" aria-label={`${item.action}: ${item.text}`} onClick={item.onClick}>{item.action} →</button>}
            </>}
        </li>
      })}
    </ul>
    {!all && limit && items.length > limit && <button type="button" className="lo-attention-link lo-attention-more" onClick={() => setAll(true)}>{moreLabel(items.length - limit)}</button>}
  </div>
}
