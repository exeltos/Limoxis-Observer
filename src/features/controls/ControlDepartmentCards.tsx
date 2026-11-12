import { CheckSquare, ChevronRight, ListChecks, Square } from 'lucide-react'
import { formatDay } from '../../core/i18n/formatDay'
import { RateMeter } from './ControlAdherencePanel'
import { DEFAULT_PERIOD, isToday, periodShort } from './controlAdherence'
import type { AnyRecord } from '../../types/featureTypes'

// The adherence a card shows under its numbers: of the chosen period, or done today.
// The missed executions, with their dates, are in «Adherence».
function CardFigures({ figures, period, language }: { figures: AnyRecord, period: string, language: string }) {
  const en = language === 'en'
  return <>
    <span className="control-department-card-rate"><span>{isToday(period) ? (en ? 'Done today' : 'Έγιναν σήμερα') : `${en ? 'Adherence' : 'Τήρηση'} · ${periodShort(period, language)}`}</span><RateMeter rate={figures.rate} /></span>
  </>
}

const todayText = (done: number, required: number) => (required ? `${done}/${required}` : '—')

// The «Departments» tab: a card per department (more departments simply add
// rows of cards). The first card opens the whole list; any other opens the
// list of that department's controls. `single`: the one card of a department
// above its own list (a department manager), wide and not a link.
interface ControlDepartmentCardsProps { cards?: AnyRecord[], total?: number, overdue?: number, totals?: AnyRecord | null, period?: string, loading?: boolean, language?: string, onOpen?: (department: string | null) => void, single?: boolean, picking?: boolean, hidden?: Set<string> | null, onToggle?: (department: string) => void, hiddenCount?: number, onShowAll?: () => void, closedCount?: number }
export function ControlDepartmentCards({ cards = [], total = 0, overdue = 0, totals = null, period = DEFAULT_PERIOD, loading = false, language = 'el', onOpen, single = false, picking = false, hidden = null, onToggle, hiddenCount = 0, onShowAll, closedCount = 0 }: ControlDepartmentCardsProps) {
  const en = language === 'en'
  const numbers = (card: AnyRecord) => <span className="control-department-card-numbers">
    <span><b>{card.controls}</b>{en ? 'controls' : 'έλεγχοι'}</span>
    <span className={card.overdue ? 'is-late' : ''}><b>{card.overdue}</b>{en ? 'overdue' : 'εκπρόθεσμοι'}</span>
    <span><b>{todayText(card.todayDone, card.todayRequired)}</b>{en ? 'today' : 'σήμερα'}</span>
  </span>
  const foot = (card: AnyRecord) => <span className="control-department-card-foot">{card.lastAt ? `${en ? 'Last entry' : 'Τελευταία καταγραφή'}: ${formatDay(card.lastAt, language)}` : en ? 'No entry yet' : 'Καμία καταγραφή ακόμη'}</span>
  if (single) {
    const card = cards[0]
    if (!card) return null
    return <div className={`control-department-card is-single${card.overdue ? ' has-late' : ''}`}>
      <span className="control-department-card-head"><strong>{card.department}</strong></span>
      {numbers(card)}
      <span className="control-department-card-figures"><CardFigures figures={card} period={period} language={language} /></span>
      {foot(card)}
    </div>
  }
  if (loading) return <div className="control-department-cards" aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="control-department-card is-loading" />)}</div>
  const todayDone = cards.reduce((sum, card) => sum + card.todayDone, 0), todayRequired = cards.reduce((sum, card) => sum + card.todayRequired, 0)
  // «Departments I see»: while choosing, every department's card carries a tick; a card without one is hidden.
  if (picking) return <div className="control-department-cards is-picking">
    {cards.map((card) => { const shown = !hidden?.has(card.department); return <button key={card.department} type="button" aria-pressed={shown} className={`control-department-card${shown ? '' : ' is-hidden'}`} onClick={() => onToggle?.(card.department)}>
      <span className="control-department-card-head">{shown ? <CheckSquare size={18} aria-hidden="true" className="control-department-pick" /> : <Square size={18} aria-hidden="true" className="control-department-pick" />}<strong>{card.department}</strong></span>
      {numbers(card)}
      <CardFigures figures={card} period={period} language={language} />
      {foot(card)}
    </button> })}
  </div>
  const hiddenLine = hiddenCount > 0 && <p className="control-department-hidden-line">{en ? `${hiddenCount} hidden ${hiddenCount === 1 ? 'department' : 'departments'}` : `${hiddenCount} ${hiddenCount === 1 ? 'κρυμμένο τμήμα' : 'κρυμμένα τμήματα'}`} · <button type="button" onClick={onShowAll}>{en ? 'Show' : 'Εμφάνιση'}</button></p>
  return <div className="control-department-cards">
    <button type="button" className="control-department-card is-all" onClick={() => onOpen?.('all')}>
      <span className="control-department-card-head"><ListChecks size={18} aria-hidden="true" /><strong>{en ? 'All controls' : 'Όλοι οι έλεγχοι'}</strong><ChevronRight size={18} aria-hidden="true" /></span>
      <span className="control-department-card-numbers">
        <span><b>{total}</b>{en ? 'controls' : 'έλεγχοι'}</span>
        <span className={overdue ? 'is-late' : ''}><b>{overdue}</b>{en ? 'overdue' : 'εκπρόθεσμοι'}</span>
        <span><b>{todayText(todayDone, todayRequired)}</b>{en ? 'today' : 'σήμερα'}</span>
      </span>
      {totals && <CardFigures figures={totals} period={period} language={language} />}
      <span className="control-department-card-foot">{en ? `The whole list · ${cards.length} departments` : `Όλη η λίστα · ${cards.length} τμήματα`}</span>
    </button>
    {cards.map((card) => <button key={card.department} type="button" className={`control-department-card${card.overdue ? ' has-late' : ''}`} onClick={() => onOpen?.(card.department)}>
      <span className="control-department-card-head"><strong>{card.department}</strong><ChevronRight size={18} aria-hidden="true" /></span>
      {numbers(card)}
      <CardFigures figures={card} period={period} language={language} />
      {foot(card)}
    </button>)}
    {!cards.length && <div className="inline-empty">{en ? 'No departments with controls.' : 'Δεν υπάρχουν τμήματα με ελέγχους.'}</div>}
    {hiddenLine}
    {closedCount > 0 && <p className="control-department-hidden-line">{en ? `${closedCount} ${closedCount === 1 ? 'department works' : 'departments work'} Monday–Friday: not shown today` : `${closedCount} ${closedCount === 1 ? 'τμήμα λειτουργεί' : 'τμήματα λειτουργούν'} Δευτέρα–Παρασκευή: δεν εμφανίζονται σήμερα`}</p>}
  </div>
}
