import { CalendarClock, Plus, X } from 'lucide-react'
import { TimeField } from '../../design-system/TimeField'
import { IconButton } from '../../design-system/IconButton'

export const MAX_TIMES = 12

// The next time offered by «+ Time»: 4 hours after the last one, at most 23:00.
export function nextTime(times) {
  const last = String(times[times.length - 1] || '04:00')
  const hour = Math.min(23, (Number(last.slice(0, 2)) || 0) + 4)
  return `${String(hour).padStart(2, '0')}:${last.slice(3, 5) || '00'}`
}

// The times of a daily control: only the list of times, the number per day follows from it.
export function ControlTimesList({ times, onChange, language, className = 'control-editor-times' }) {
  const en = language === 'en'
  const replace = (index, value) => onChange(times.map((time, i) => (i === index ? value : time)))
  return <div className={className}>
    <span className="lo-field-label"><CalendarClock size={13} /> {en ? 'Execution times *' : 'Ώρες εκτέλεσης *'}</span>
    <div className="control-time-grid">
      {times.map((time, index) => <div key={index} className="control-time-item">
        <TimeField className="control-time-field" label="" value={time} onChange={(value) => replace(index, value)} />
        {times.length > 1 && <IconButton size="sm" className="control-time-remove" label={en ? `Remove ${time}` : `Αφαίρεση ${time}`} onClick={() => onChange(times.filter((_, i) => i !== index))}><X size={13} aria-hidden="true" /></IconButton>}
      </div>)}
      {times.length < MAX_TIMES && <button type="button" className="control-editor-link control-time-add" onClick={() => onChange([...times, nextTime(times)])}><Plus size={13} aria-hidden="true" /> {en ? 'Time' : 'Ώρα'}</button>}
    </div>
  </div>
}
