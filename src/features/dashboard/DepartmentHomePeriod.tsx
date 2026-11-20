import './departmentHome.css'
import { useMemo, useState } from 'react'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { PERIODS, optionsOf, periodLength, shiftPeriod } from '../registers/registerEngine'
import { COMPARE_CHOICES, PERIOD_KINDS, departmentHomeWindow, periodRangeLabel, type CompareChoice, type DepartmentHomeWindow, type PeriodKind } from './departmentHomeModel'

// The period of «Το τμήμα μου» (owner, 20/11/2026): the kind (Μήνας | Τρίμηνο | Εξάμηνο | Έτος, the registers' periods),
// a step back and forward, and the comparison (the previous period or the same period last year), on the line of the
// page's title. The current month with the previous one by default; the kind and the comparison are remembered on this
// browser (the period itself starts again from the current one).
const STORAGE_KEY = 'limoxis.departmentHome.period'
function readStored(): { kind: PeriodKind, choice: CompareChoice } {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return { kind: PERIOD_KINDS.includes(stored.kind) ? stored.kind : 'month', choice: COMPARE_CHOICES.includes(stored.choice) ? stored.choice : 'previous' }
  } catch { return { kind: 'month', choice: 'previous' } }
}
function store(value: { kind: PeriodKind, choice: CompareChoice }) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)) } catch { /* a browser without storage forgets the choice */ }
}

export function useDepartmentHomeWindow() {
  const [state, setState] = useState(() => ({ ...readStored(), day: hospitalToday() }))
  const selected = useMemo(() => departmentHomeWindow(state.kind, state.day, state.choice), [state.kind, state.day, state.choice])
  const update = (next: Partial<typeof state>) => setState(current => { const value = { ...current, ...next }; store({ kind: value.kind, choice: value.choice }); return value })
  return {
    window: selected,
    setKind: (kind: PeriodKind) => update({ kind, day: state.day }),
    setChoice: (choice: CompareChoice) => update({ choice }),
    step: (direction: number) => update({ day: shiftPeriod(selected.period, direction * periodLength(selected.period)).from }),
  }
}

interface DepartmentPeriodControlsProps { window: DepartmentHomeWindow, language: string, onKind: (kind: PeriodKind) => void, onChoice: (choice: CompareChoice) => void, onStep: (direction: number) => void }
export function DepartmentPeriodControls({ window, language, onKind, onChoice, onStep }: DepartmentPeriodControlsProps) {
  const en = language === 'en'
  const kinds = optionsOf(PERIODS, language)
  const compareOptions = COMPARE_CHOICES.map(value => ({ value, label: value === 'none' ? (en ? 'No comparison' : 'Χωρίς σύγκριση') : value === 'previous' ? (en ? 'Compare: previous period' : 'Σύγκριση: προηγούμενη περίοδος') : (en ? 'Compare: same period last year' : 'Σύγκριση: ίδια περίοδος πέρσι') }))
  return <div className="dephome-period">
    <ModeSwitch className="dephome-period-kind" ariaLabel={en ? 'Period' : 'Περίοδος'} options={kinds} value={window.kind} onChange={value => onKind(value as PeriodKind)}/>
    <PeriodStepper label={periodRangeLabel(window.period, language)} onPrevious={() => onStep(-1)} onNext={() => onStep(1)} nextDisabled={shiftPeriod(window.period, periodLength(window.period)).from > hospitalToday()}/>
    <SearchableSelect hideLabel className="dephome-period-compare" label={en ? 'Comparison' : 'Σύγκριση'} value={window.choice} onChange={value => value && onChoice(value as CompareChoice)} options={compareOptions}/>
  </div>
}
