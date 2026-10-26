import { ChevronRight, ListChecks } from 'lucide-react'
import { formatDateTime } from '../../core/i18n/formatDay'
import { RateMeter } from './ControlAdherencePanel'

// The «Departments» tab: a card per department (more departments simply add
// rows of cards). The first card opens the whole list; any other opens the
// list of that department's controls.
export function ControlDepartmentCards({ cards = [], total = 0, overdue = 0, loading = false, language = 'el', onOpen }) {
  const en = language === 'en'
  if (loading) return <div className="control-department-cards" aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="control-department-card is-loading" />)}</div>
  return <div className="control-department-cards">
    <button type="button" className="control-department-card is-all" onClick={() => onOpen?.('all')}>
      <span className="control-department-card-head"><ListChecks size={18} aria-hidden="true" /><strong>{en ? 'All controls' : 'Όλοι οι έλεγχοι'}</strong><ChevronRight size={18} aria-hidden="true" /></span>
      <span className="control-department-card-numbers">
        <span><b>{total}</b>{en ? 'controls' : 'έλεγχοι'}</span>
        <span className={overdue ? 'is-late' : ''}><b>{overdue}</b>{en ? 'overdue' : 'εκπρόθεσμοι'}</span>
        <span><b>{cards.length}</b>{en ? 'departments' : 'τμήματα'}</span>
      </span>
      <span className="control-department-card-foot">{en ? 'The whole list of controls' : 'Όλη η λίστα των ελέγχων'}</span>
    </button>
    {cards.map((card) => <button key={card.department} type="button" className={`control-department-card${card.overdue ? ' has-late' : ''}`} onClick={() => onOpen?.(card.department)}>
      <span className="control-department-card-head"><strong>{card.department}</strong><ChevronRight size={18} aria-hidden="true" /></span>
      <span className="control-department-card-numbers">
        <span><b>{card.controls}</b>{en ? 'controls' : 'έλεγχοι'}</span>
        <span className={card.overdue ? 'is-late' : ''}><b>{card.overdue}</b>{en ? 'overdue' : 'εκπρόθεσμοι'}</span>
        <span><b>{card.dueToday}</b>{en ? 'due today' : 'για σήμερα'}</span>
      </span>
      <span className="control-department-card-rate"><span>{en ? 'Adherence · 30 days' : 'Τήρηση · 30 ημ.'}</span><RateMeter rate={card.rate} /></span>
      <span className="control-department-card-foot">{card.lastAt ? `${en ? 'Last entry' : 'Τελευταία καταγραφή'}: ${formatDateTime(card.lastAt, language)}` : en ? 'No entry yet' : 'Καμία καταγραφή ακόμη'}</span>
    </button>)}
    {!cards.length && <div className="inline-empty">{en ? 'No departments with controls.' : 'Δεν υπάρχουν τμήματα με ελέγχους.'}</div>}
  </div>
}
