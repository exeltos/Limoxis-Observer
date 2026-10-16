import { computeValues, parseGestation, textOf, validateEntry } from './registerEngine'
import { templateByKey } from './registerTemplates'

// Importing a register's history from a FileMaker export (.xlsx / .csv):
// 1. columns are matched to the register's fields by the FileMaker names the
//    templates know (aliases) or by label;
// 2. list values are matched to the register's options by how they begin
//    (ΔΙΑΚΟΜΙΔΗ ΣΤΟ ΠΓΝΛ → transfer to another hospital);
// 3. a dry run reports what would go in and what not (out of limits, unknown
//    values, test rows, duplicates, summary rows in a daily sheet);
// 4. daily or per-shift sheets are added up per month.
// AMKA columns are never imported.

// Text compared without case, accents, spaces or punctuation, and with the
// Latin letters FileMaker users type for Greek ones (E, A, K…) as Greek.
const LATIN_TO_GREEK = { A: 'Α', B: 'Β', E: 'Ε', Z: 'Ζ', H: 'Η', I: 'Ι', K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ', Y: 'Υ', X: 'Χ' }
export function normalize(value) {
  const text = String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const greekish = /[Ͱ-Ͽ]/.test(text)
  return (greekish ? text.replace(/[ABEZHIKMNOPTYX]/g, char => LATIN_TO_GREEK[char]) : text).replace(/[\s.\-/_:&,()'"]+/g, '')
}

export const IGNORED_COLUMN = /^REPORTING::|::|ΑΜΚΑ|AMKA|^STATUS$/i
export const isAmka = header => /ΑΜΚΑ|AMKA/i.test(String(header))

// Which target each column of the file goes to: identity.caseNumber,
// identity.patientName, a field key, or (sheet) date / measure / a row key.
export function suggestMapping(register, headers = []) {
  const template = templateByKey(register.templateKey) || {}
  const identity = { ...(template.identity || {}), ...(register.settings?.identity || {}) }
  const candidates = []
  const push = (target, names) => candidates.push({ target, names: names.filter(Boolean).map(normalize) })
  if (register.kind === 'case') {
    if (identity.caseNumber) push('identity.caseNumber', [...(identity.caseNumberAliases || []), 'ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ', 'ΑΡ. ΠΕΡΙΣΤΑΤΙΚΟΥ'])
    if (identity.patientName) push('identity.patientName', [...(identity.patientNameAliases || []), 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ'])
    for (const field of register.fields) if (field.type !== 'computed') push(field.key, [...(field.aliases || []), field.label, field.labelEn])
  } else {
    push('sheet.date', ['Ημερομηνία', 'ΗΜΕΡΟΜΗΝΙΑ', 'Date'])
    if ((register.sheet?.measures || []).length > 1) push('sheet.measure', [...(register.sheet.measureColumn || templateByKey(register.templateKey)?.sheet?.measureColumn || []), 'ΒΑΡΔΙΑ'])
    for (const row of register.sheet?.rows || []) push(`row.${row.key}`, [...(row.aliases || []), row.label, row.labelEn])
  }
  const used = new Set()
  return headers.map(header => {
    if (!header || IGNORED_COLUMN.test(String(header))) return ''
    const name = normalize(header)
    // Exact names first, then a field label the column begins with.
    let match = candidates.find(candidate => !used.has(candidate.target) && candidate.names.includes(name))
    if (!match) match = candidates.find(candidate => !used.has(candidate.target) && candidate.names.some(other => other.length > 3 && name.startsWith(other)))
    if (!match && register.kind === 'case' && identity.patientName && /ΟΝΟΜΑ|ΕΠΩΝΥΜΟ/.test(name)) return 'identity.patientName'
    if (!match) return ''
    if (match.target !== 'identity.patientName') used.add(match.target)
    return match.target
  })
}

// The option a FileMaker value takes: the longest beginning (match) or label
// it starts with.
export function suggestOption(field, value) {
  const text = normalize(value)
  if (!text) return ''
  let best = '', length = 0
  for (const option of field.options || []) {
    for (const start of [...(option.match || []), option.label, option.labelEn].filter(Boolean).map(normalize)) {
      if (start && text.startsWith(start) && start.length > length) { best = option.value; length = start.length }
    }
  }
  return best
}

// Several procedures in one cell: «ΣΤΕΦΑΝΙΟΓΡΑΦΙΑ & ΑΓΓΕΙΟΠΛΑΣΤΙΚΗ».
export const splitMulti = value => String(value ?? '').split(/\s*(?:&|,|\+|\/|\sΚΑΙ\s)\s*/i).map(part => part.trim()).filter(Boolean)

// The distinct values of every list column, with the suggested option.
export function valueMappings(register, headers, rows, mapping) {
  const result = {}
  mapping.forEach((target, column) => {
    const field = register.fields?.find(item => item.key === target)
    if (!field || !['choice', 'multiChoice'].includes(field.type)) return
    const counts = new Map()
    for (const row of rows) {
      const cell = row[column]
      if (cell === undefined || cell === null || String(cell).trim() === '') continue
      for (const part of field.type === 'multiChoice' ? splitMulti(cell) : [String(cell).trim()]) counts.set(part, (counts.get(part) || 0) + 1)
    }
    result[field.key] = { field, values: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count, option: suggestOption(field, value) })) }
  })
  if (register.kind === 'sheet') {
    const column = mapping.indexOf('sheet.measure')
    if (column >= 0) {
      const counts = new Map()
      for (const row of rows) { const cell = String(row[column] ?? '').trim(); if (cell) counts.set(cell, (counts.get(cell) || 0) + 1) }
      const measures = { options: (register.sheet?.measures || []).map(measure => ({ value: measure.key, label: measure.label, labelEn: measure.labelEn, match: measure.aliases || [] })) }
      result['sheet.measure'] = { field: { key: 'sheet.measure', label: 'Στήλη', labelEn: 'Measure', ...measures }, values: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count, option: suggestOption(measures, value) })) }
    }
  }
  return result
}

// --- Cells → values ---------------------------------------------------------------

const pad = n => String(n).padStart(2, '0')
// An Excel serial day, a d/m/yyyy text or an ISO date → YYYY-MM-DD.
export function toIsoDate(cell) {
  if (cell === undefined || cell === null || cell === '') return null
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell.toISOString().slice(0, 10)
  if (typeof cell === 'number') {
    if (cell < 20000 || cell > 80000) return null
    return new Date(Math.round((cell - 25569) * 86400000)).toISOString().slice(0, 10)
  }
  const text = String(cell).trim()
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text)
  if (match) return `${match[1]}-${pad(match[2])}-${pad(match[3])}`
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text)
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3]
    const day = Number(match[1]), month = Number(match[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${pad(month)}-${pad(day)}`
  }
  if (/^\d+(\.\d+)?$/.test(text)) return toIsoDate(Number(text))
  return null
}

// «3320 Kg» → 3320, «44 ετών» → 44, «7,5» → 7.5.
export function toNumber(cell) {
  if (cell === undefined || cell === null || cell === '') return null
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
  const match = /-?\d+(?:[.,]\d+)?/.exec(String(cell))
  return match ? Number(match[0].replace(',', '.')) : null
}

const YES = new Set(['ΝΑΙ', 'NAI', 'YES', 'Y', 'TRUE', '1', 'X', 'Χ', '✓'])
const NO = new Set(['ΟΧΙ', 'OXI', 'NO', 'N', 'FALSE', '0'])
export function toYesNo(cell, emptyIsNo) {
  if (cell === true || cell === false) return cell
  const text = normalize(cell)
  if (!text) return emptyIsNo ? false : null
  if (YES.has(text) || YES.has(String(cell).trim().toUpperCase())) return true
  if (NO.has(text) || NO.has(String(cell).trim().toUpperCase())) return false
  return undefined
}

// «37,4 w» (FileMaker wrote weeks,days) or «37+4» → days.
export function toGestation(cell) {
  if (cell === undefined || cell === null || cell === '') return null
  const text = String(cell).replace(/[^\d.,+]/g, '')
  const parsed = parseGestation(text.replace(/[.,]/, '+'))
  return parsed
}

const isTestName = name => /\b(ΤΕΣΤ|TEST|ΔΟΚΙΜΗ)\b/i.test(String(name || ''))

// --- Dry run ----------------------------------------------------------------------

// What the file becomes: { items: [{ entry, identity }], issues: [{ row, field, text }], skipped, counts }.
// options: { valueMap: { fieldKey: { sourceValue: optionValue|'' } }, emptyIsNo, fallbackDate, existing: entries }
export function planImport(register, headers, rows, mapping, options = {}) {
  return register.kind === 'sheet' ? planSheet(register, headers, rows, mapping, options) : planCases(register, headers, rows, mapping, options)
}

function planCases(register, headers, rows, mapping, { valueMap = {}, emptyIsNo = true, fallbackDate = '', existing = [], language = 'el' }) {
  const en = language === 'en'
  const items = [], issues = []
  const skipped = { noDate: 0, test: 0, duplicate: 0 }
  const dateField = register.settings?.entryDateField
  const seen = new Set(existing.map(entry => `${entry.identity?.caseNumber || ''}|${entry.entryDate}`).filter(key => !key.startsWith('|')))
  const columnsOf = target => mapping.map((value, index) => (value === target ? index : -1)).filter(index => index >= 0)
  const nameColumns = columnsOf('identity.patientName')
  const caseColumn = columnsOf('identity.caseNumber')[0]
  const mappedFields = register.fields.filter(field => field.type !== 'computed').map(field => ({ field, column: mapping.indexOf(field.key) })).filter(item => item.column >= 0)
  rows.forEach((row, index) => {
    const line = index + 2
    const values = {}
    const note = (field, text) => issues.push({ row: line, field: field ? textOf(field, language) : '', text })
    for (const { field, column } of mappedFields) {
      const cell = row[column]
      if (field.type === 'date') {
        const day = toIsoDate(cell)
        if (cell != null && cell !== '' && !day) note(field, en ? `«${cell}» is not a date: left empty` : `«${cell}» δεν είναι ημερομηνία: μένει κενό`)
        if (day) values[field.key] = day
      } else if (field.type === 'number') {
        const number = toNumber(cell)
        if (cell != null && cell !== '' && number == null) note(field, en ? `«${cell}» is not a number: left empty` : `«${cell}» δεν είναι αριθμός: μένει κενό`)
        if (number != null) values[field.key] = number
      } else if (field.type === 'gestation') {
        const days = toGestation(cell)
        if (cell != null && cell !== '' && days == null) note(field, en ? `«${cell}» is not weeks+days: left empty` : `«${cell}» δεν είναι εβδομάδες+ημέρες: μένει κενό`)
        if (days != null) values[field.key] = days
      } else if (field.type === 'yesNo') {
        const answer = toYesNo(cell, emptyIsNo)
        if (answer === undefined) note(field, en ? `«${cell}» is not yes/no: left empty` : `«${cell}» δεν είναι ναι/όχι: μένει κενό`)
        else if (answer !== null) values[field.key] = answer
      } else if (field.type === 'choice') {
        const text = String(cell ?? '').trim()
        if (text) {
          const option = valueMap[field.key]?.[text] ?? suggestOption(field, text)
          if (option) values[field.key] = option
          else note(field, en ? `«${text}» matches no value: left empty` : `«${text}» δεν αντιστοιχεί σε τιμή: μένει κενό`)
        }
      } else if (field.type === 'multiChoice') {
        const chosen = [...new Set(splitMulti(cell).map(part => valueMap[field.key]?.[part] ?? suggestOption(field, part)).filter(Boolean))]
        if (chosen.length) values[field.key] = chosen
      } else {
        const text = String(cell ?? '').trim()
        if (text) values[field.key] = text
      }
    }
    const patientName = nameColumns.map(column => String(row[column] ?? '').trim()).filter(Boolean).join(' ')
    const caseNumber = caseColumn === undefined ? '' : String(row[caseColumn] ?? '').trim()
    if (isTestName(patientName)) { skipped.test += 1; return }
    if (dateField && !values[dateField]) {
      if (fallbackDate) values[dateField] = fallbackDate
      else { skipped.noDate += 1; return }
    }
    // Limits: an impossible value is not imported (the rest of the case is).
    const check = validateEntry(register.fields, values, language)
    for (const [key, text] of Object.entries(check.errors)) {
      const field = register.fields.find(item => item.key === key)
      if (text === (en ? 'Required' : 'Υποχρεωτικό')) continue
      note(field, en ? `${values[key] ?? ''} — ${text}: left empty` : `${values[key] ?? ''} — ${text}: μένει κενό`)
      delete values[key]
    }
    const entryDate = values[dateField] || fallbackDate
    const key = caseNumber ? `${caseNumber}|${entryDate}` : ''
    if (key && seen.has(key)) { skipped.duplicate += 1; return }
    if (key) seen.add(key)
    items.push({ entry: { values: computeValues(register.fields, values), status: 'complete' }, identity: caseNumber || patientName ? { caseNumber, patientName } : null, line })
  })
  return { items, issues, skipped, counts: { rows: rows.length, ready: items.length } }
}

function planSheet(register, headers, rows, mapping, { valueMap = {}, existing = [], language = 'el' }) {
  const en = language === 'en'
  const issues = []
  const skipped = { noDate: 0, summary: 0, existing: 0, noMeasure: 0 }
  const dateColumn = mapping.indexOf('sheet.date')
  const measureColumn = mapping.indexOf('sheet.measure')
  const measures = register.sheet?.measures || []
  const rowColumns = mapping.map((target, column) => (String(target).startsWith('row.') ? { row: target.slice(4), column } : null)).filter(Boolean)
  // A daily value far above the usual is a summary row FileMaker kept among the days.
  const limits = new Map(rowColumns.map(({ row, column }) => {
    const numbers = rows.map(cells => toNumber(cells[column])).filter(value => value != null && value > 0).sort((a, b) => a - b)
    const median = numbers.length ? numbers[Math.floor(numbers.length / 2)] : 0
    return [row, Math.max(30, median * 10)]
  }))
  const months = new Map()
  rows.forEach((cells, index) => {
    const line = index + 2
    const day = toIsoDate(cells[dateColumn])
    const numbers = rowColumns.map(({ row, column }) => ({ row, value: toNumber(cells[column]) })).filter(item => item.value != null)
    if (!numbers.length) return
    if (!day) { skipped.noDate += 1; issues.push({ row: line, field: '', text: en ? 'No date: not counted' : 'Χωρίς ημερομηνία: δεν μετράει' }); return }
    let measure = measures[0]?.key
    if (measureColumn >= 0) {
      const text = String(cells[measureColumn] ?? '').trim()
      measure = valueMap['sheet.measure']?.[text] ?? suggestOption({ options: measures.map(item => ({ value: item.key, label: item.label, labelEn: item.labelEn, match: item.aliases || [] })) }, text)
      if (!measure) { skipped.noMeasure += 1; issues.push({ row: line, field: '', text: en ? `Shift «${text}» unknown: not counted` : `Βάρδια «${text}» άγνωστη: δεν μετράει` }); return }
    }
    const outliers = numbers.filter(item => item.value > limits.get(item.row))
    if (outliers.length) {
      skipped.summary += 1
      const row = register.sheet.rows.find(item => item.key === outliers[0].row)
      issues.push({ row: line, field: textOf(row, language), text: en ? `${outliers[0].value} on ${day}: looks like a summary row, not counted` : `${outliers[0].value} στις ${day}: μοιάζει με γραμμή συνόλου, δεν μετράει` })
      return
    }
    const periodStart = `${day.slice(0, 7)}-01`
    const month = months.get(periodStart) || {}
    for (const { row, value } of numbers) {
      if (value < 0) continue
      month[row] = { ...(month[row] || {}), [measure]: (month[row]?.[measure] || 0) + Math.round(value) }
    }
    months.set(periodStart, month)
  })
  const taken = new Set(existing.map(entry => entry.periodStart))
  const items = []
  for (const [periodStart, values] of [...months.entries()].sort()) {
    if (taken.has(periodStart)) { skipped.existing += 1; issues.push({ row: '', field: '', text: en ? `${periodStart.slice(0, 7)} already recorded: kept as is` : `${periodStart.slice(0, 7)} υπάρχει ήδη: μένει ως έχει` }); continue }
    items.push({ entry: { periodStart, values, status: 'complete' }, identity: null })
  }
  return { items, issues, skipped, counts: { rows: rows.length, ready: items.length } }
}
