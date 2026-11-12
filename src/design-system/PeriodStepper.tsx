import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'

// The period a report shows, read as one label, with a step back and a step
// forward («‹ September 2026 ›»). It replaces month + year dropdowns: the
// usual move is to the previous or next period, not a jump.
interface PeriodStepperProps { label?: ReactNode; onPrevious?: () => void; onNext?: () => void; nextDisabled?: boolean; className?: string }

export function PeriodStepper({ label, onPrevious, onNext, nextDisabled = false, className = '' }: PeriodStepperProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  return <div className={`lo-period-stepper ${className}`.trim()} role="group" aria-label={en ? 'Period' : 'Περίοδος'}>
    <button type="button" onClick={onPrevious} aria-label={en ? 'Previous period' : 'Προηγούμενη περίοδος'} title={en ? 'Previous period' : 'Προηγούμενη περίοδος'}><ChevronLeft size={16} /></button>
    <strong aria-live="polite">{label}</strong>
    <button type="button" onClick={onNext} disabled={nextDisabled} aria-label={en ? 'Next period' : 'Επόμενη περίοδος'} title={en ? 'Next period' : 'Επόμενη περίοδος'}><ChevronRight size={16} /></button>
  </div>
}
