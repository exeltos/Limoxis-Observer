import type { ReportDoc } from '../../core/export/reportDocument'
import type { GroupedListSpec } from './qualityTypes'
// A list printed from its Excel table (headers + rows): the columns that fit a page, in one table or one per value
// of a column (department, category, criticality…). Used by the lists that print what their Excel holds.

// ISO dates printed as dd/mm/yyyy.
const cell = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value).split('-').reverse().join('/') : value ?? '')

export function groupedListDoc({ title, filename, table, columns, groupBy = null, language = 'el', meta = [] }: GroupedListSpec): ReportDoc {
  const en = language === 'en'
  const keep = (columns || table.headers.map((_: unknown, index: number) => index)).filter((index: number) => index !== groupBy)
  const none = en ? 'Not set' : 'Χωρίς τιμή'
  const groups = new Map<string, unknown[][]>()
  for (const row of table.rows) {
    const key = groupBy == null ? '' : String(row[groupBy] ?? '').trim() || none
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)?.push(row)
  }
  const keys = [...groups.keys()].sort((a, b) => Number(a === none) - Number(b === none) || a.localeCompare(b, 'el'))
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Quality' : 'Ποιότητα',
    title,
    filename,
    meta: [[en ? 'Records' : 'Εγγραφές', String(table.rows.length)], ...meta],
    sections: keys.map(key => ({
      title: groupBy == null ? '' : `${key} · ${groups.get(key)?.length}`,
      table: { columns: keep.map((index: number) => table.headers[index]), rows: (groups.get(key) || []).map((row: unknown[]) => keep.map((index: number) => cell(row[index]))) },
    })),
  }
}
