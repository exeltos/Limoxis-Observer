// A list printed from its Excel table (headers + rows): the columns that fit a page, in one table or one per value
// of a column (department, category, criticality…). Used by the lists that print what their Excel holds.

// ISO dates printed as dd/mm/yyyy.
const cell = value => (/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value).split('-').reverse().join('/') : value ?? '')

export function groupedListDoc({ title, filename, table, columns, groupBy = null, language = 'el', meta = [] }) {
  const en = language === 'en'
  const keep = (columns || table.headers.map((_, index) => index)).filter(index => index !== groupBy)
  const none = en ? 'Not set' : 'Χωρίς τιμή'
  const groups = new Map()
  for (const row of table.rows) {
    const key = groupBy == null ? '' : String(row[groupBy] ?? '').trim() || none
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const keys = [...groups.keys()].sort((a, b) => (a === none) - (b === none) || a.localeCompare(b, 'el'))
  return {
    language,
    orientation: 'landscape',
    kind: en ? 'Quality' : 'Ποιότητα',
    title,
    filename,
    meta: [[en ? 'Records' : 'Εγγραφές', String(table.rows.length)], ...meta],
    sections: keys.map(key => ({
      title: groupBy == null ? '' : `${key} · ${groups.get(key).length}`,
      table: { columns: keep.map(index => table.headers[index]), rows: groups.get(key).map(row => keep.map(index => cell(row[index]))) },
    })),
  }
}
