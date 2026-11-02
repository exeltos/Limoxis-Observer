import './FigureCards.css'

// The counts above a list, one small card each: «4 εκπρόθεσμες», «2 ημέρες προς
// επαλήθευση». Each child that holds a number (<b>/<strong>) shows as a card; a
// button child filters the list (`is-active` while it does), `is-late`/`is-alert`
// colour a count that needs action. Other children (a period switch, a note) sit
// beside the cards as they are.
export function FigureCards({children,className='',label}){
  return <div className={`lo-figure-cards ${className}`.trim()} role="group" aria-label={label} aria-live="polite">{children}</div>
}
