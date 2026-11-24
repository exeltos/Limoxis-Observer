import type { DepartmentHomeOverview } from './departmentHomeModel'
import { delta } from './departmentHomeModel'

// The figures of a period with their change from the comparison period: «Το τμήμα μου» of the Department Manager and,
// for the whole hospital, the administrator's home (owner, 24/11/2026). A figure of a module the hospital has locked is
// not shown. Split out of DepartmentHome (24/11/2026).
export type TileTone = 'danger' | 'warning' | 'success' | null
// The change of a tile: its value and whether more is worse (positives, episodes, late controls) or better (hand hygiene).
export interface TileChangeValue { value: number | null, worseUp: boolean, percentOf?: number | null, points?: boolean }
export interface PeriodTile { key: string, label: string, value: string, detail: string, tone: TileTone, to: string, change: TileChangeValue | null }

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
export const numberText = (value: number | null | undefined, en: boolean) => value == null ? '—' : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)
export const percentText = (value: number | null | undefined, en: boolean) => value == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 0 }).format(Math.round(value))}%`

export function periodTiles(o: DepartmentHomeOverview | null, { language, moduleEnabled }: { language: string, moduleEnabled: (module: string) => boolean }): PeriodTile[] {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const c = o?.compare
  const n = (value: number | null | undefined) => Number(value) || 0
  const sum = (a: number | null | undefined, b: number | null | undefined) => a == null && b == null ? null : n(a) + n(b)
  const tiles: PeriodTile[] = []
  // No inpatients tile (owner, 20/11/2026): the figures that need attention only, for the period chosen.
  if (moduleEnabled('laboratory')) tiles.push({
    key: 'positives', label: tr('Θετικά δείγματα', 'Positive samples'), value: numberText(o?.positives, en), tone: n(o?.positivesMdr) > 0 ? 'danger' : null, to: '/laboratory',
    detail: `${n(o?.positivesMdr)} MDR/XDR · ${tr(`${n(o?.positivesAwaiting)} προς έλεγχο`, `${n(o?.positivesAwaiting)} to review`)}`,
    change: { value: delta(o?.positives, c?.positives), worseUp: true, percentOf: c?.positives },
  })
  if (moduleEnabled('surveillance')) tiles.push({
    key: 'surveillance', label: tr('Νέα επεισόδια / απομονώσεις', 'New episodes / isolations'), value: `${numberText(o?.newSurveillance, en)} / ${numberText(o?.newIsolation, en)}`, tone: null, to: '/surveillance?tab=episodes',
    detail: en ? plural(n(o?.reassessmentsDueToday), 'reassessment today', 'reassessments today') : plural(n(o?.reassessmentsDueToday), 'επανεκτίμηση σήμερα', 'επανεκτιμήσεις σήμερα'),
    change: { value: delta(sum(o?.newSurveillance, o?.newIsolation), sum(c?.newSurveillance, c?.newIsolation)), worseUp: true },
  })
  const target = o?.handHygieneTarget ?? 80
  if (moduleEnabled('prevention')) tiles.push({
    key: 'handHygiene', label: tr('Υγιεινή χεριών', 'Hand hygiene'), value: percentText(o?.handHygienePct, en), to: '/prevention?tab=handHygiene',
    tone: o?.handHygienePct == null ? null : o.handHygienePct >= target ? 'success' : 'warning',
    detail: `${tr('στόχος', 'target')} ${target}% · ${en ? plural(n(o?.handHygieneObservations), 'observation', 'observations') : plural(n(o?.handHygieneObservations), 'παρατήρηση', 'παρατηρήσεις')}`,
    change: { value: delta(o?.handHygienePct == null ? null : Math.round(o.handHygienePct), c?.handHygienePct == null ? null : Math.round(c.handHygienePct)), worseUp: false, points: true },
  })
  // «Έλεγχοι εκτός χρόνου»: entries of the period done outside their window and assignments fallen overdue in it (not
  // done yet); the small line keeps today's overdue controls.
  if (moduleEnabled('controls')) tiles.push({
    key: 'controls', label: tr('Έλεγχοι εκτός χρόνου', 'Controls out of time'), value: numberText(o?.lateControls, en), tone: n(o?.lateControls) > 0 ? 'danger' : null, to: '/controls',
    detail: tr(`σήμερα: ${n(o?.overdueControls)} ${n(o?.overdueControls) === 1 ? 'εκπρόθεσμος' : 'εκπρόθεσμοι'}`, `today: ${n(o?.overdueControls)} overdue`),
    change: { value: delta(o?.lateControls, c?.lateControls), worseUp: true },
  })
  return tiles
}

// The row of figures: each opens its screen when the user may open it; «…» while the period loads.
export function PeriodTiles({ tiles, loading, comparing, language, compareText, canOpen, onOpen }: { tiles: PeriodTile[], loading: boolean, comparing: boolean, language: string, compareText: string, canOpen: (to: string) => boolean, onOpen: (to: string) => void }) {
  const en = language === 'en'
  return <div className="dephome-tiles" style={{ '--dephome-tiles': tiles.length }}>
    {tiles.map(tile => <button type="button" key={tile.key} className={`dephome-tile${tile.tone ? ` is-${tile.tone}` : ''}`} disabled={!canOpen(tile.to)} onClick={() => canOpen(tile.to) && onOpen(tile.to)} aria-busy={loading || undefined}>
      <span className="dephome-tile-label">{tile.label}</span>
      <span className="dephome-tile-figure"><strong className="dephome-tile-value">{loading ? '…' : tile.value}</strong>{!loading && comparing && tile.change && <TileChange change={tile.change} en={en} compareText={compareText}/>}</span>
      <small className="dephome-tile-detail">{loading ? '' : tile.detail}</small>
    </button>)}
  </div>
}

// «▲ +3 (+38%)», «▼ −1», «▲ +5 μον.»: the change from the comparison period, red when worse and green when better.
export function TileChange({ change, en, compareText }: { change: TileChangeValue, en: boolean, compareText: string }) {
  const { value, worseUp, percentOf, points } = change
  if (value == null) return null
  const format = (number: number) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(number)
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±'
  const share = percentOf && value ? ` (${sign}${format(Math.round(Math.abs(value) / percentOf * 100))}%)` : ''
  const tone = value === 0 ? '' : (value > 0) === worseUp ? ' is-worse' : ' is-better'
  return <span className={`dephome-tile-change${tone}`} title={en ? `Compared with ${compareText}` : `Σε σύγκριση με ${compareText}`}>
    {value > 0 ? '▲ ' : value < 0 ? '▼ ' : ''}{sign}{format(Math.abs(value))}{points ? (en ? ' pts' : ' μον.') : ''}{share}
  </span>
}
