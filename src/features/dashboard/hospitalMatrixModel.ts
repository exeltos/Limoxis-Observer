// «Χάρτης τμημάτων» and «Επισημάνσεις» of the hospital's home (owner, 24/11/2026, «ναι σε όλα»): for the period and its
// comparison, one line per department — positive samples (MDR/XDR), new episodes and isolations, hand hygiene against the
// department's target, late control entries and, now, overdue controls (owner 26/11/2026: «Εκτός χρόνου» split in two;
// hospital_department_period_matrix, 20261231641000) and, today, the overdue
// corrective actions and expired staff certificates (the calendar's, as «Τμήματα με τις περισσότερες εκκρεμότητες»).
// Each cell is green, amber or red, with an arrow when it changed from the comparison period; the departments that need
// attention first. Pure.

import type { DepartmentAttention } from './adminHomeModel'

export interface MatrixDepartment {
  departmentId: string | null
  department: string
  positives: number | null
  positivesMdr: number | null
  comparePositives: number | null
  episodes: number | null
  compareEpisodes: number | null
  handHygienePct: number | null
  handHygieneObservations: number | null
  compareHandHygienePct: number | null
  handHygieneTarget: number
  // Entries done outside ±1 hour in the period (with the comparison) and controls overdue now.
  lateControls: number | null
  compareLateControls: number | null
  overdueControls: number | null
}
export interface HospitalMatrix { hospitalTarget: number, departments: MatrixDepartment[] }

const num = (value: unknown) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
export function normalizeHospitalMatrix(raw: Record<string, unknown> | null | undefined): HospitalMatrix {
  const hospitalTarget = num(raw?.hospitalTarget) ?? 80
  const rows = Array.isArray(raw?.departments) ? raw.departments as Record<string, unknown>[] : []
  return {
    hospitalTarget,
    departments: rows.map(row => ({
      departmentId: row.departmentId ? String(row.departmentId) : null,
      department: String(row.department || ''),
      positives: num(row.positives), positivesMdr: num(row.positivesMdr), comparePositives: num(row.comparePositives),
      episodes: num(row.episodes), compareEpisodes: num(row.compareEpisodes),
      handHygienePct: num(row.handHygienePct), handHygieneObservations: num(row.handHygieneObservations), compareHandHygienePct: num(row.compareHandHygienePct),
      handHygieneTarget: num(row.handHygieneTarget) ?? hospitalTarget,
      lateControls: num(row.lateControls), compareLateControls: num(row.compareLateControls), overdueControls: num(row.overdueControls),
    })).filter(row => row.department),
  }
}

export type MapColumn = 'positives' | 'episodes' | 'handHygiene' | 'overdueControls' | 'lateControls' | 'capa' | 'certificates'
export type CellTone = 'good' | 'warn' | 'bad' | 'none'
// trend: the change from the comparison period; worse: whether that change is for the worse.
export interface MapCell { text: string, tone: CellTone, trend: 'up' | 'down' | null, worse: boolean, title: string }
export interface MapRow { department: string, cells: Partial<Record<MapColumn, MapCell>>, score: number }
// The screen each column opens.
export const MAP_SCREENS: Record<MapColumn, string> = {
  positives: '/laboratory', episodes: '/surveillance?tab=episodes', handHygiene: '/prevention?tab=handHygiene',
  overdueControls: '/controls', lateControls: '/controls', capa: '/quality?tab=actions', certificates: '/training',
}

const trendOf = (now: number | null, before: number | null, comparing: boolean) => !comparing || now == null || before == null || now === before ? null : now > before ? 'up' as const : 'down' as const
// A count where more is worse: 0 green; more than the comparison period red; otherwise amber.
function countCell(value: number | null, before: number | null, comparing: boolean, label: string, text = value == null ? '—' : String(value)): MapCell {
  if (value == null) return { text: '—', tone: 'none', trend: null, worse: false, title: label }
  const trend = trendOf(value, before, comparing)
  const tone: CellTone = value === 0 ? 'good' : trend === 'up' ? 'bad' : 'warn'
  return { text, tone, trend, worse: trend === 'up', title: before != null && comparing ? `${label}: ${value} (${before})` : `${label}: ${value}` }
}

// hiddenControls: the departments the user hid on the Controls screen (controls.hiddenDepartments): «—» in the controls columns.
export interface MapOptions { columns: MapColumn[], comparing: boolean, language?: string, hiddenControls?: ReadonlySet<string> | null }
// The departments' lines: the period's figures by department (matrix) with today's overdue corrective actions and expired
// staff certificates by department name (attention), the ones that need attention first (red ×3, amber ×1), then by name.
export function departmentMap(matrix: HospitalMatrix | null, attention: DepartmentAttention[] | null, { columns, comparing, language = 'el', hiddenControls = null }: MapOptions): MapRow[] {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const today = new Map((attention || []).map(row => [row.department, row]))
  const names = [...new Set([...(matrix?.departments || []).map(row => row.department), ...today.keys()])]
  const byName = new Map((matrix?.departments || []).map(row => [row.department, row]))
  const rows = names.map(name => {
    const row = byName.get(name)
    const now = today.get(name)
    const cells: Partial<Record<MapColumn, MapCell>> = {}
    for (const column of columns) {
      if (column === 'positives') {
        const value = row?.positives ?? null
        const mdr = row?.positivesMdr ?? 0
        const cell = countCell(value, row?.comparePositives ?? null, comparing, tr('Θετικά δείγματα', 'Positive samples'), value == null ? '—' : mdr > 0 ? `${value} (${mdr})` : String(value))
        // MDR/XDR in the period: red whatever the trend.
        cells.positives = value != null && mdr > 0 ? { ...cell, tone: 'bad', title: `${cell.title} · MDR/XDR ${mdr}` } : cell
      } else if (column === 'episodes') {
        cells.episodes = countCell(row?.episodes ?? null, row?.compareEpisodes ?? null, comparing, tr('Νέα επεισόδια / απομονώσεις', 'New episodes / isolations'))
      } else if (column === 'handHygiene') {
        const pct = row?.handHygienePct ?? null
        const target = row?.handHygieneTarget ?? matrix?.hospitalTarget ?? 80
        if (pct == null) cells.handHygiene = { text: '—', tone: 'none', trend: null, worse: false, title: tr('Υγιεινή χεριών: καμία παρατήρηση', 'Hand hygiene: no observations') }
        else {
          const trend = trendOf(Math.round(pct), row?.compareHandHygienePct == null ? null : Math.round(row.compareHandHygienePct), comparing)
          cells.handHygiene = { text: `${Math.round(pct)}%`, tone: pct >= target ? 'good' : pct >= target - 10 ? 'warn' : 'bad', trend, worse: trend === 'down',
            title: `${tr('Υγιεινή χεριών', 'Hand hygiene')}: ${Math.round(pct)}% · ${tr('στόχος', 'target')} ${target}%` }
        }
      } else if (column === 'overdueControls' || column === 'lateControls') {
        const hidden = hiddenControls?.has(name) ?? false
        cells[column] = column === 'overdueControls'
          ? countCell(hidden ? null : row?.overdueControls ?? null, null, false, tr('Εκπρόθεσμοι έλεγχοι τώρα', 'Overdue controls now'))
          : countCell(hidden ? null : row?.lateControls ?? null, row?.compareLateControls ?? null, comparing, tr('Καθυστερημένες καταχωρίσεις (εκτός ±1 ώρας)', 'Late entries (outside ±1 hour)'))
      } else {
        // Today's overdue corrective actions and expired staff certificates: any is red.
        const value = now ? now[column] : 0
        cells[column] = { text: String(value), tone: value > 0 ? 'bad' : 'good', trend: null, worse: false,
          title: `${column === 'capa' ? tr('Εκπρόθεσμες διορθωτικές', 'Overdue corrective actions') : tr('Ληγμένα πιστοποιητικά προσωπικού', 'Expired staff certificates')}: ${value}` }
      }
    }
    const score = Object.values(cells).reduce((sum, cell) => sum + (cell.tone === 'bad' ? 3 : cell.tone === 'warn' ? 1 : 0), 0)
    return { department: name, cells, score }
  })
  return rows.sort((a, b) => b.score - a.score || a.department.localeCompare(b.department, 'el'))
}

// «Επισημάνσεις»: what the home found that needs a decision — possible clusters, departments under their hand hygiene
// target — before the decisions the figures do not show.
export interface HomeAlert { key: string, title: string, detail?: string, count?: number | null, to: string | null, tone: 'danger' | 'warning' }
export interface ClusterLike { department?: string | null, organism: string, count: number, windowDays?: number }
export function homeAlerts({ clusters, matrix, decisions, canOpen = () => true, language = 'el' }: {
  clusters: ClusterLike[] | null, matrix: HospitalMatrix | null, decisions: Array<{ key: string, title: string, count: number, to: string, urgent: boolean }> | null,
  canOpen?: (to: string) => boolean, language?: string,
}): HomeAlert[] {
  const en = language === 'en'
  const tr = (el: string, enText: string) => en ? enText : el
  const alerts: HomeAlert[] = []
  const outbreaks = canOpen('/surveillance?tab=outbreaks') ? '/surveillance?tab=outbreaks' : canOpen('/surveillance') ? '/surveillance' : null
  for (const cluster of (clusters || []).slice(0, 3)) {
    const days = cluster.windowDays || 14
    alerts.push({ key: `cluster:${cluster.department}:${cluster.organism}`, title: tr(`Πιθανή συρροή: ${cluster.organism}`, `Possible cluster: ${cluster.organism}`),
      detail: [cluster.department, en ? `${cluster.count} patients in ${days} days` : `${cluster.count} ασθενείς σε ${days} ημέρες`].filter(Boolean).join(' · '), to: outbreaks, tone: 'danger' })
  }
  const below = (matrix?.departments || [])
    .filter(row => row.handHygienePct != null && Number(row.handHygieneObservations) > 0 && row.handHygienePct < row.handHygieneTarget)
    .sort((a, b) => (a.handHygienePct as number) - (b.handHygienePct as number))
  if (below.length) {
    const target = below.every(row => row.handHygieneTarget === below[0].handHygieneTarget) ? ` (${tr('στόχος', 'target')} ${below[0].handHygieneTarget}%)` : ''
    alerts.push({ key: 'handHygieneBelow', title: tr('Υγιεινή χεριών κάτω από τον στόχο', 'Hand hygiene below target'),
      detail: below.slice(0, 3).map(row => `${row.department} ${Math.round(row.handHygienePct as number)}%`).join(' · ') + target, count: below.length,
      to: canOpen('/prevention?tab=handHygiene') ? '/prevention?tab=handHygiene' : null, tone: 'danger' })
  }
  for (const item of decisions || []) alerts.push({ key: item.key, title: item.title, count: item.count, to: item.to, tone: item.urgent ? 'danger' : 'warning' })
  return alerts
}
