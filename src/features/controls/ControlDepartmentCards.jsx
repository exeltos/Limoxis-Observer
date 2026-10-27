import { ChevronRight, ListChecks } from 'lucide-react'
import { formatDay } from '../../core/i18n/formatDay'
import { RateMeter } from './ControlAdherencePanel'
import { periodShort } from './controlAdherence'

// The numbers a card shows under its head: today's entries done of those due,
// the adherence of the chosen period and how many entries it missed.
function CardFigures({ figures, period, language }) {
  const en = language === 'en'
  return <>
    <span className="control-department-card-rate"><span>{period === 'today' ? (en ? 'Done today' : 'Έγιναν σήμερα') : `${en ? 'Adherence' : 'Τήρηση'} · ${periodShort(period, language)}`}</span><RateMeter rate={figures.rate} /></span>
    {period !== 'today' && figures.expected > 0 && <span className={`control-department-card-missed${figures.missed ? ' is-late' : ''}`}>{en ? `Missed: ${figures.missed} of ${figures.expected}` : `Χάθηκαν: ${figures.missed} από ${figures.expected}`}</span>}
  </>
}

const todayText = (done, required) => (required ? `${done}/${required}` : '—')

// The «Departments» tab: a card per department (more departments simply add
// rows of cards). The first card opens the whole list; any other opens the
// list of that department's controls. `single`: the one card of a department
// above its own list (a department manager), wide and not a link.
export function ControlDepartmentCards({ cards = [], total = 0, overdue = 0, totals = null, period = '30d', loading = false, language = 'el', onOpen, single = false }) {
  const en = language === 'en'
  const numbers = (card) => <span className="control-department-card-numbers">
    <span><b>{card.controls}</b>{en ? 'controls' : 'έλεγχοι'}</span>
    <span className={card.overdue ? 'is-late' : ''}><b>{card.overdue}</b>{en ? 'overdue' : 'εκπρόθεσμοι'}</span>
    <span><b>{todayText(card.todayDone, card.todayRequired)}</b>{en ? 'today' : 'σήμερα'}</span>
  </span>
  const foot = (card) => <span className="control-department-card-foot">{card.lastAt ? `${en ? 'Last entry' : 'Τελευταία καταγραφή'}: ${formatDay(card.lastAt, language)}` : en ? 'No entry yet' : 'Καμία καταγραφή ακόμη'}</span>
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
  </div>
}
