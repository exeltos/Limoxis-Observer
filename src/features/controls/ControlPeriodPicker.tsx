import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FilterSelect } from '../../design-system/FilterBar'
import { IconButton } from '../../design-system/IconButton'
import { ADHERENCE_PERIODS, parsePeriod, periodKey, periodShort, periodUnitLabel, stepPeriod } from './controlAdherence'

// The period of the controls' reports (owner, 2/11/2026): day, month, quarter, half-year or year, and ‹ › to step back to
// earlier ones (never past the current one). The label says which period it is: «Σήμερα», «Οκτ 2026», «3ο τρίμ. 2026».
interface ControlPeriodPickerProps { value: string, onChange: (period: string) => void, language?: string, label?: string, className?: string }
export function ControlPeriodPicker({ value, onChange, language = 'el', label, className = '' }: ControlPeriodPickerProps) {
  const en = language === 'en'
  const { unit, offset } = parsePeriod(value)
  return <div className={`control-period-picker ${className}`.trim()}>
    <FilterSelect className="controls-period-select" label={label || (en ? 'Period' : 'Περίοδος')} value={unit} onChange={next => onChange(periodKey(next, 0))}>
      {ADHERENCE_PERIODS.map(key => <option key={key} value={key}>{periodUnitLabel(key, language)}</option>)}
    </FilterSelect>
    <span className="control-period-step">
      <IconButton size="sm" label={en ? 'Previous period' : 'Προηγούμενη περίοδος'} onClick={() => onChange(stepPeriod(value, -1))}><ChevronLeft size={16} /></IconButton>
      <strong aria-live="polite">{periodShort(periodKey(unit, offset), language)}</strong>
      <IconButton size="sm" label={en ? 'Next period' : 'Επόμενη περίοδος'} disabled={offset >= 0} onClick={() => onChange(stepPeriod(value, 1))}><ChevronRight size={16} /></IconButton>
    </span>
  </div>
}
