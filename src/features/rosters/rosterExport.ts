// The roster as a document (owner, 9/11/2026: «θέλω καλή εξαγωγή»): one A4 landscape sheet as the hospital prints it
// (hospital band, title and period, the grid with the weekends shaded and every shift in its colour, each person's
// totals, the people on each shift per day, the legend and the signatures), and the same sheet as an Excel file.
import { escapeHtml } from '../../core/export/reportDocument'
import { XLSX_STYLE } from '../../core/export/xlsxExport'
import { isShift, kindOf, type RosterDay } from './rosterEngine'
import type { ReportDoc } from '../../core/export/reportDocument'
import type { XlsxSheet } from '../../core/export/xlsxExport'
import type { AnyRecord } from '../../types/featureTypes'

// What the page hands to the export (see the comment below).
export interface RosterExportInput {
  en: boolean
  department?: AnyRecord | null
  period: { start: string, end: string }
  status?: string
  days: RosterDay[]
  members: { employeeId: string, name: string, head?: boolean, extra?: boolean }[]
  codeAt: (id: string, date: string) => string
  shortOf: (code: string) => string
  kinds: string[]
  kindLabel: (kind: string) => string
  need: (day: RosterDay, kind: string) => number
  targets?: Record<string, number> | null
  hours: number
  legend?: string[][]
}

const LEAVE = new Set(['L', 'S', 'H', 'U'])
const kindClass = (code: string) => (!code ? '' : LEAVE.has(code) ? 'lv' : code === 'R' ? 'r' : ({ M: 'm', I: 'i', A: 'a', N: 'n' } as Record<string, string>)[kindOf(code)] || '')

// input: { en, department, period: { start, end }, status, days, members: [{ employeeId, name, head, extra }],
//          codeAt(id, date), shortOf(code), kinds: ['M', 'A', 'N'], kindLabel(kind), need(day, kind), targets, hours,
//          legend: [[short, label]] }
export function rosterSummary({ days, members, codeAt, kinds, targets, hours }: Pick<RosterExportInput, 'days' | 'members' | 'codeAt' | 'kinds' | 'targets' | 'hours'>) {
  return members.map(m => {
    const codes = days.map(d => codeAt(m.employeeId, d.date))
    const shifts = codes.filter(isShift).length
    return {
      member: m,
      codes,
      perKind: kinds.map(kind => codes.filter(code => isShift(code) && kindOf(code) === kind).length),
      rests: codes.filter(code => code === 'R').length,
      shifts,
      target: targets?.[m.employeeId] ?? '',
      hours: shifts * hours,
    }
  })
}

const fmt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export function rosterDocument(input: RosterExportInput): ReportDoc {
  const { en, department, period, status, days, kinds, kindLabel, need, shortOf, legend = [] } = input
  const L = (el: string, english: string) => (en ? english : el)
  const weekdays = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['Κ', 'Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ']
  const rows = rosterSummary(input)
  const we = (d: RosterDay) => (d.weekend ? ' we' : '')
  const head = `<tr><th class="nm" rowspan="2">${L('Ονοματεπώνυμο', 'Name')}</th>${days.map(d => `<th class="dw${we(d)}">${weekdays[d.weekday]}</th>`).join('')}${kinds.map(k => `<th class="tt" rowspan="2">${escapeHtml(shortOf(k))}</th>`).join('')}<th class="tt" rowspan="2">${escapeHtml(shortOf('R'))}</th><th class="tw" rowspan="2">${L('Βάρδιες', 'Shifts')}</th><th class="tw" rowspan="2">${L('Ώρες', 'Hours')}</th></tr><tr>${days.map(d => `<th class="dn${we(d)}">${d.date.slice(8, 10)}</th>`).join('')}</tr>`
  const body = rows.map(({ member, codes, perKind, rests, shifts, target, hours }) => {
    const tag = member.head ? ` <em>${L('Προϊστ.', 'Head')}</em>` : ''
    const cells = codes.map((code, i) => `<td class="c ${kindClass(code)}${we(days[i])}">${escapeHtml(shortOf(code))}</td>`).join('')
    return `<tr><td class="nm">${escapeHtml(member.name)}${tag}</td>${cells}${perKind.map(v => `<td class="t">${v}</td>`).join('')}<td class="t">${rests}</td><td class="t">${shifts}${target !== '' ? `/${target}` : ''}</td><td class="t">${hours}</td></tr>`
  }).join('')
  const extra = kinds.length + 3
  const foot = kinds.map(kind => `<tr class="cov"><td class="nm">${escapeHtml(kindLabel(kind))}</td>${days.map(d => {
    const have = rows.filter(r => { const code = r.codes[days.indexOf(d)]; return isShift(code) && kindOf(code) === kind }).length
    const n = need(d, kind)
    return `<td class="${we(d).trim()}${n && have < n && kind !== 'I' ? ' short' : ''}">${have}</td>`
  }).join('')}<td colspan="${extra}"></td></tr>`).join('')
  const legendHtml = legend.length ? `<p class="lg">${legend.map(([code, label, kind]) => `<span><i class="${kind}">${escapeHtml(code)}</i>${escapeHtml(label)}</span>`).join('')}</p>` : ''
  const css = `<style>
.rs{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.4pt;margin-top:6px}
.rs th,.rs td{border:1px solid #c9d4de;padding:2px 1px;text-align:center;line-height:1.15}
.rs th{background:#17324a;color:#fff;font-weight:700}
.rs th.we,.rs td.we{background:#fde9c8}
.rs th.we{color:#7a3d00}
.rs .nm{width:150px;text-align:left;padding-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs td.nm em{font-style:normal;font-size:6.2pt;color:#1d5f9c}
.rs .tt{width:20px}
.rs .tw{width:38px;font-size:6.6pt}
.rs td.t{background:#f2f5f8;font-weight:700}
.rs td.c{font-weight:700}
.rs td.m{background:#fff}.rs td.a{background:#fff4dc}.rs td.n{background:#e8eaff;color:#2d2f8f}.rs td.i{background:#ededed}
.rs td.r{background:#dff3e6;color:#1f6b3a}.rs td.lv{background:#fbe0e0;color:#a32121}
.rs tr.cov td{font-size:6.8pt;color:#5d7083;background:#fafbfc}
.rs tr.cov td.we{background:#fdf1dc}
.rs tr.cov td.short{color:#c0262d;font-weight:700}
.rs tr.cov td.nm{font-weight:700;color:#17324a}
.lg{display:flex;flex-wrap:wrap;gap:4px 14px;margin:6px 0 0;font-size:7.6pt;color:#3b5166}
.lg span{display:inline-flex;align-items:center;gap:4px}
.lg i{display:inline-block;min-width:18px;padding:0 3px;border:1px solid #c9d4de;font-style:normal;font-weight:700;text-align:center}
.lg i.a{background:#fff4dc}.lg i.n{background:#e8eaff}.lg i.r{background:#dff3e6}.lg i.lv{background:#fbe0e0}.lg i.i{background:#ededed}
.rd-signatures{margin-top:10px}
</style>`
  const statusText = status === 'published' ? L('Δημοσιευμένο', 'Published') : L('Πρόχειρο', 'Draft')
  return {
    language: en ? 'en' : 'el',
    kind: L('Πρόγραμμα βαρδιών', 'Shift roster'),
    title: `${L('Πρόγραμμα βαρδιών', 'Shift roster')} · ${department?.name || ''}`,
    orientation: 'landscape',
    filename: `${L('Programma_bardion', 'Shift_roster')}_${department?.name || ''}_${period.start}`,
    footer: `${L('Πρόγραμμα βαρδιών', 'Shift roster')} · ${department?.name || ''} · ${fmt(period.start)} – ${fmt(period.end)}`,
    body: `${css}<h1 class="rd-title">${escapeHtml(`${L('Πρόγραμμα βαρδιών', 'Shift roster')} · ${department?.name || ''}`)}</h1><p class="rd-subtitle">${escapeHtml(`${L('Περίοδος', 'Period')} ${fmt(period.start)} – ${fmt(period.end)} · ${rows.length} ${L('άτομα', 'people')} · ${statusText}`)}</p><table class="rs">${head}${body}${foot}</table>${legendHtml}`,
    signatures: [L('Ο/Η Προϊστάμενος/η του τμήματος', 'Head of the department'), L('Διεύθυνση Νοσηλευτικής Υπηρεσίας', 'Nursing Directorate')],
  }
}

// The same sheet for Excel: title lines, the two header rows (weekday, day), coloured shifts, totals and coverage.
export function rosterSheet(input: RosterExportInput): XlsxSheet {
  const { en, department, period, status, days, kinds, kindLabel, need, shortOf } = input
  const L = (el: string, english: string) => (en ? english : el)
  const S = XLSX_STYLE
  const weekdays = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['Κ', 'Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ']
  const rows = rosterSummary(input)
  const styleOf = (code: string, day: RosterDay) => {
    if (!code) return day.weekend ? S.weekend : S.center
    if (LEAVE.has(code)) return S.leave
    if (code === 'R') return S.rest
    const kind = kindOf(code)
    if (kind === 'A') return S.afternoon
    if (kind === 'N') return S.night
    if (kind === 'I') return S.intermediate
    return day.weekend ? S.weekend : S.morning
  }
  const tail = [...kinds.map(k => shortOf(k)), shortOf('R'), L('Βάρδιες', 'Shifts'), L('Στόχος', 'Target'), L('Ώρες', 'Hours')]
  const statusText = status === 'published' ? L('Δημοσιευμένο', 'Published') : L('Πρόχειρο', 'Draft')
  const top = [
    [{ v: `${L('Πρόγραμμα βαρδιών', 'Shift roster')} · ${department?.name || ''}`, s: S.title }],
    [{ v: `${L('Περίοδος', 'Period')} ${fmt(period.start)} – ${fmt(period.end)} · ${statusText}`, s: S.subtitle }],
    [{ v: '', s: S.dayHead }, ...days.map(d => ({ v: weekdays[d.weekday], s: d.weekend ? S.weekendHead : S.dayHead })), ...tail.map(() => ({ v: '', s: S.dayHead }))],
  ]
  const headers = [{ v: L('Ονοματεπώνυμο', 'Name'), s: S.dayHead }, ...days.map(d => ({ v: Number(d.date.slice(8, 10)), s: d.weekend ? S.weekendHead : S.dayHead })), ...tail.map(v => ({ v, s: S.dayHead }))]
  const body = rows.map(({ member, codes, perKind, rests, shifts, target, hours }) => [
    { v: member.head ? `${member.name} (${L('Προϊστ.', 'Head')})` : member.name, s: S.name },
    ...codes.map((code, i) => ({ v: shortOf(code), s: styleOf(code, days[i]) })),
    ...perKind.map(v => ({ v, s: S.total })),
    { v: rests, s: S.total },
    { v: shifts, s: S.total },
    { v: target === '' ? '' : Number(target), s: S.total },
    { v: hours, s: S.total },
  ])
  const coverage = kinds.map(kind => [
    { v: kindLabel(kind), s: S.total },
    ...days.map((d, i) => {
      const have = rows.filter(r => isShift(r.codes[i]) && kindOf(r.codes[i]) === kind).length
      return { v: `${have}/${need(d, kind)}`, s: d.weekend ? S.weekend : S.center }
    }),
  ])
  return {
    name: department?.name || 'Roster',
    top,
    headers,
    rows: [...body, ...coverage],
    widths: [30, ...days.map(() => 4.6), ...tail.map(() => 7.5)],
    freezeColumns: 1,
    filter: false,
    fit: true,
  }
}
