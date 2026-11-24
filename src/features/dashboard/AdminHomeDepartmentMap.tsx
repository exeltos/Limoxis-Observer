import { ArrowRight, Building2 } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useFittingRows } from './useFittingRows'
import { MAP_SCREENS, type MapColumn, type MapRow } from './hospitalMatrixModel'

// «Χάρτης τμημάτων» (owner, 24/11/2026): one line per department, one column per subject, each cell green, amber or red
// with an arrow for the change from the comparison period; the departments that need attention first, as many as fit.
// A cell opens the screen of its column.
const ROW = 28
const LABELS: Record<MapColumn, [string, string]> = {
  positives: ['Θετικά (MDR)', 'Positives (MDR)'],
  episodes: ['Επεισόδια', 'Episodes'],
  handHygiene: ['Υγιεινή χεριών', 'Hand hygiene'],
  lateControls: ['Εκτός χρόνου', 'Out of time'],
  capa: ['Διορθωτικές', 'Corrective'],
  certificates: ['Ληγμένα πιστοπ.', 'Expired certs'],
}

export function DepartmentMapCard({ rows, columns, loading, error, language, canOpen, onOpen }: { rows: MapRow[], columns: MapColumn[], loading: boolean, error: boolean, language: string, canOpen: (to: string) => boolean, onOpen: (to: string) => void }) {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const [boxRef, fit] = useFittingRows(ROW)
  // The header line takes one line of the box.
  const shown = rows.slice(0, Math.max(1, fit - 1))
  const all = canOpen('/controls') && <button type="button" className="text-button" onClick={() => onOpen('/controls')}>{tr('Όλα τα τμήματα', 'All departments')}<ArrowRight size={14}/></button>
  return <Card className="dashboard-card adminhome-map">
    <CardHeader icon={Building2} title={tr('Χάρτης τμημάτων', 'Department map')} subtitle={tr('πρώτα όσα θέλουν προσοχή', 'those that need attention first')} actions={all}/>
    <div className="adminhome-map-box" ref={boxRef}>
      {loading ? <TableSkeleton/> : error ? <div className="inline-empty" role="status">{tr('Ο χάρτης δεν φορτώθηκε. Δοκιμάστε ξανά σε λίγο.', 'The map did not load. Please try again shortly.')}</div> : shown.length ? <table className="adminhome-map-table" style={{ '--map-columns': columns.length }}>
        <thead><tr><th scope="col"><span className="lo-visually-hidden">{tr('Τμήμα', 'Department')}</span></th>{columns.map(column => <th key={column} scope="col">{LABELS[column][en ? 1 : 0]}</th>)}</tr></thead>
        <tbody>{shown.map(row => <tr key={row.department}>
          <th scope="row" title={row.department}>{row.department}</th>
          {columns.map(column => {
            const cell = row.cells[column]
            if (!cell) return <td key={column}/>
            const to = MAP_SCREENS[column]
            const open = canOpen(to)
            return <td key={column}><button type="button" className={`adminhome-map-cell is-${cell.tone}`} disabled={!open} onClick={() => open && onOpen(to)} title={`${row.department} · ${cell.title}`} aria-label={`${row.department} · ${cell.title}`}>
              {cell.text}{cell.trend && <i className={cell.worse ? 'is-worse' : 'is-better'} aria-hidden="true">{cell.trend === 'up' ? '▲' : '▼'}</i>}
            </button></td>
          })}
        </tr>)}</tbody>
      </table> : <div className="inline-empty">{tr('Δεν υπάρχουν τμήματα.', 'No departments.')}</div>}
    </div>
  </Card>
}
