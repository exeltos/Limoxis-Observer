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

// A register made from a template keeps a copy of its fields; FileMaker names
// and value beginnings learned later live in the template. The import reads
// both: the template's aliases, option beginnings, repairs and date fallbacks
// are added to the register's own (matched by field key, option value, row key).
export function withTemplateHints(register) {
  const template = templateByKey(register?.templateKey)
  if (!template) return register
  const union = (a = [], b = []) => [...new Set([...(a || []), ...(b || [])])]
  // A FileMaker name the template moved to another field (or retired) leaves the register's copy.
  const owner = new Map((template.fields || []).flatMap(item => (item.aliases || []).map(alias => [normalize(alias), item.key])))
  const retired = new Set((template.retiredAliases || []).map(normalize))
  const own = field => (field.aliases || []).filter(alias => !retired.has(normalize(alias)) && (owner.get(normalize(alias)) ?? field.key) === field.key)
  const fields = (register.fields || []).map(field => {
    const hint = (template.fields || []).find(item => item.key === field.key)
    if (!hint) return { ...field, aliases: own(field) }
    const options = (field.options || []).map(option => { const known = (hint.options || []).find(item => item.value === option.value); return known?.match ? { ...option, match: union(option.match, known.match) } : option })
    // Options the template gained after this register was made come along, marked so the import can add them to the register.
    if (['choice', 'multiChoice'].includes(field.type)) for (const option of hint.options || []) if (!options.some(item => item.value === option.value)) options.push({ ...option, fromTemplate: true })
    return { ...field, aliases: union(own(field), hint.aliases), options, repair: field.repair || template.importRepairs?.[field.key] }
  })
  const sheet = register.sheet?.rows ? { ...register.sheet, rows: register.sheet.rows.map(row => { const hint = (template.sheet?.rows || []).find(item => item.key === row.key); return hint ? { ...row, aliases: union(row.aliases, hint.aliases) } : row }), measures: (register.sheet.measures || []).map(measure => { const hint = (template.sheet?.measures || []).find(item => item.key === measure.key); return hint ? { ...measure, aliases: union(measure.aliases, hint.aliases) } : measure }) } : register.sheet
  // Fields the template gained since (a physician column) are offered too, marked, and join the register only when a column goes to them.
  if (register.kind === 'case') for (const hint of template.fields || []) if (!fields.some(field => field.key === hint.key)) fields.push({ ...structuredClone(hint), fromTemplate: true })
  return { ...register, fields, sheet, entryDateFallbacks: register.entryDateFallbacks || template.entryDateFallbacks || [], undatedImport: register.undatedImport ?? Boolean(template.undatedImport) }
}

// The value a list column shows for its empty cells, when they matter (a line without its shift).
export const EMPTY_VALUE = '(κενό)'

export const IGNORED_COLUMN = /^REPORTING::|::|ΑΜΚΑ|AMKA|^STATUS$/i
export const isAmka = header => /ΑΜΚΑ|AMKA/i.test(String(header))

// The words of a column name or a label, each cut to its first five letters
// (ΧΟΡΗΓΗΣΗ / ΧΟΡΗΓΗΣΗΣ), without the small words, and with the words
// FileMaker uses for the same thing read as one (ΔΙΑΡΚΕΙΑ = ΗΜΕΡΕΣ).
const SMALL_WORDS = new Set(['ΣΤΟ', 'ΣΤΗ', 'ΣΤΗΝ', 'ΣΤΑ', 'ΣΤΟΝ', 'ΣΤΙΣ', 'ΣΕ', 'ΜΕ', 'ΤΟ', 'ΤΗ', 'ΤΗΝ', 'ΤΗΣ', 'ΤΟΥ', 'ΤΩΝ', 'ΤΑ', 'ΟΙ', 'Ο', 'Η', 'ΚΑΙ', 'ΑΠΟ', 'ΓΙΑ', 'ΑΝΑ', 'ΤΙΣ'])
const SAME_WORD = { ΔΙΑΡΚ: 'ΗΜΕΡΕ', ΑΡΙΘΜ: 'ΑΡ', ΗΜΝΙΑ: 'ΗΜΕΡΟ', ΗΜΕΡΟ: 'ΗΜΕΡΟ', ΤΟΚΕΤ: 'ΤΟΚΕΤ', ΤΕΚΕΤ: 'ΤΟΚΕΤ' }
export function wordsOf(text) {
  // «Κ.Τ» and «Φ.Τ» are one word (ΚΤ, ΦΤ), as FileMaker also writes them.
  const plain = String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\b([Α-ΩA-Z])\.(?=[Α-ΩA-Z]\b)/g, '$1').replace(/\b([Α-ΩA-Z])\/([Α-ΩA-Z])\b/g, '$1$2')
  return [...new Set(plain.split(/[^0-9A-ZΑ-Ω]+/).filter(word => word && !SMALL_WORDS.has(word)).map(word => { const stem = word.slice(0, 5); return SAME_WORD[stem] || stem }))]
}
// Two words are the same when they are, or share their first four letters
// (ΚΥΗΣΗ / ΚΥΗΣΕΙΣ, ΠΟΛΥΔ / ΠΟΛΥΔΥΜΕΣ); dates and days are kept apart above.
const sameWord = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4) && !['ΗΜΕΡΟ', 'ΗΜΕΡΕ'].includes(a) && !['ΗΜΕΡΟ', 'ΗΜΕΡΕ'].includes(b))
// The candidate whose words the column shares best: at least two thirds of
// both, and better than any other.
function bestByWords(header, candidates) {
  const words = wordsOf(header)
  if (!words.length) return null
  let best = null, score = 0, tie = false
  for (const candidate of candidates) {
    for (const other of candidate.words || []) {
      if (!other.length) continue
      const shared = words.filter(word => other.some(item => sameWord(word, item))).length
      const value = Math.min(shared / words.length, shared / other.length)
      if (value > score) { best = candidate; score = value; tie = false } else if (value === score && best && best.target !== candidate.target) tie = true
    }
  }
  return score >= 2 / 3 && !tie ? best : null
}

// Which target each column of the file goes to: identity.caseNumber,
// identity.patientName, a field key, or (sheet) date / measure / a row key.
export function suggestMapping(source, headers = []) {
  const register = withTemplateHints(source)
  const template = templateByKey(register.templateKey) || {}
  const identity = { ...(template.identity || {}), ...(register.settings?.identity || {}) }
  const candidates = []
  const push = (target, names) => candidates.push({ target, names: names.filter(Boolean).map(normalize), words: names.filter(Boolean).map(wordsOf) })
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
    // Then the same words, in any order and form: «ΔΙΑΡΚΕΙΑ ΣΤΟ CPAP» is «Ημέρες σε CPAP».
    if (!match) match = bestByWords(header, candidates.filter(candidate => !used.has(candidate.target)))
    if (!match && register.kind === 'case' && identity.patientName && /ΟΝΟΜΑ|ΕΠΩΝΥΜΟ/.test(name)) return 'identity.patientName'
    if (!match) return ''
    if (match.target !== 'identity.patientName') used.add(match.target)
    return match.target
  })
}

// The option a FileMaker value takes: the longest beginning (match) or label
// it starts with.
// Latin letters typed with the keyboard left on English (DEN TO GNVRIZE),
// read as the Greek letters on the same keys.
const GREEK_KEYBOARD = { A: 'Α', B: 'Β', C: 'Ψ', D: 'Δ', E: 'Ε', F: 'Φ', G: 'Γ', H: 'Η', I: 'Ι', J: 'Ξ', K: 'Κ', L: 'Λ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Π', R: 'Ρ', S: 'Σ', T: 'Τ', U: 'Θ', V: 'Ω', W: 'Σ', X: 'Χ', Y: 'Υ', Z: 'Ζ' }
const asGreekKeyboard = text => (/^[A-Z0-9]+$/.test(text) && /[A-Z]/.test(text) ? text.replace(/[A-Z]/g, char => GREEK_KEYBOARD[char] || char) : null)
// Latin capitals that look Greek (OXI, NAI, K.T), read as the Greek ones.
const asLookalike = text => (/^[A-Z0-9]+$/.test(text) && /^[ABEZHIKMNOPTYX0-9]+$/.test(text) ? text.replace(/[A-Z]/g, char => LATIN_TO_GREEK[char] || char) : null)
const collapse = text => text.replace(/(.)\1+/g, '$1')
// Edits between two short texts (insert, delete, change one letter).
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]; row[0] = i
    for (let j = 1; j <= b.length; j++) { const kept = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = kept }
  }
  return row[b.length]
}

// The option a FileMaker value takes: the longest beginning (match) or label
// it starts with; failing that, the same with the keyboard left on English,
// doubled letters collapsed (ΓΝΩΡΙΙΖΕ) or one letter wrong or missing (ΝΩΡΙΖΕ).
export function suggestOption(field, value) {
  const text = normalize(value)
  if (!text) return ''
  const starts = (field.options || []).flatMap(option => [...(option.match || []), option.label, option.labelEn].filter(Boolean).map(normalize).filter(Boolean).map(start => ({ value: option.value, start })))
  const longest = candidate => { let best = '', length = 0; for (const { value: option, start } of starts) if (candidate.startsWith(start) && start.length > length) { best = option; length = start.length } return best }
  const exact = longest(text) || (asLookalike(text) && longest(asLookalike(text))) || (asGreekKeyboard(text) && longest(asGreekKeyboard(text))) || longest(collapse(text))
  if (exact) return exact
  // One edit per five letters of the beginning, never on a beginning shorter than five.
  let best = '', score = Infinity
  for (const candidate of [text, asLookalike(text), asGreekKeyboard(text)].filter(Boolean)) {
    for (const { value: option, start } of starts) {
      if (start.length < 5) continue
      const allowed = Math.floor(start.length / 5)
      for (const size of [start.length - 1, start.length, start.length + 1]) {
        const edits = distance(collapse(candidate.slice(0, size)), collapse(start))
        if (edits <= allowed && edits < score) { best = option; score = edits }
      }
    }
  }
  return best
}

// Several procedures in one cell: «ΣΤΕΦΑΝΙΟΓΡΑΦΙΑ & ΑΓΓΕΙΟΠΛΑΣΤΙΚΗ».
export const splitMulti = value => String(value ?? '').split(/\s*(?:&|,|\+|\/|\sΚΑΙ\s)\s*/i).map(part => part.trim()).filter(Boolean)

// The distinct values of every list column, with the suggested option.
export function valueMappings(source, headers, rows, mapping) {
  const register = withTemplateHints(source)
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
      // Lines with numbers but no shift appear as «(empty)», to be given a shift or left out.
      const filled = row => (register.sheet?.rows || []).some(item => { const index = mapping.indexOf(`row.${item.key}`); return index >= 0 && toNumber(row[index]) != null })
      for (const row of rows) { const cell = String(row[column] ?? '').trim() || (filled(row) ? EMPTY_VALUE : ''); if (cell) counts.set(cell, (counts.get(cell) || 0) + 1) }
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
  // «ΝΑΙ (ΔΩΡΕΑ ΩΑΡΙΩΝ)»: a yes with a note.
  if (/^(ΝΑΙ|NAI|YES)\b/.test(String(cell).trim().toUpperCase()) || text.startsWith('ΝΑΙ')) return true
  // A count where a yes/no is asked (FileMaker kept «days of oxygen after 36w»): above 0 is Yes.
  const number = typeof cell === 'number' ? cell : /^\d+([.,]\d+)?$/.test(String(cell).trim()) ? Number(String(cell).trim().replace(',', '.')) : null
  if (number != null) return number > 0
  // A date where a yes/no is asked (FileMaker kept the day it started): Yes.
  if (cell instanceof Date || /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/.test(String(cell).trim())) return true
  return undefined
}

// «37,4 w» (FileMaker wrote weeks,days) or «37+4» → days.
export function toGestation(cell) {
  if (cell === undefined || cell === null || cell === '') return null
  // «375»: FileMaker lost the point of 37.5 (weeks 22–44, days 0–6).
  if (/^\s*(2[2-9]|3\d|4[0-4])[0-6]\s*$/.test(String(cell))) return toGestation(`${String(cell).trim().slice(0, 2)}+${String(cell).trim().slice(2)}`)
  const text = String(cell).replace(/[^\d.,+]/g, '')
  const parsed = parseGestation(text.replace(/[.,]/, '+'))
  return parsed
}

// A value past the field's limits that FileMaker wrote twice (850850 → 850),
// or, on a field marked repair: 'decimal', that lost its decimal point
// (EuroSCORE 242 → 2.42). Anything else is returned as it is.
export function repairNumber(field, value) {
  const fits = number => (field.min == null || number >= field.min) && (field.max == null || number <= field.max)
  if (fits(value)) return value
  const digits = String(Math.abs(value))
  if (Number.isInteger(value) && digits.length % 2 === 0 && digits.slice(0, digits.length / 2) === digits.slice(digits.length / 2)) {
    const half = Number(digits.slice(0, digits.length / 2)) * Math.sign(value)
    if (fits(half)) return half
  }
  if (field.repair === 'decimal' && Number.isInteger(value) && field.max != null) {
    // FileMaker kept «2,42» as 242: two decimals first, then one or three.
    for (const divisor of [100, 10, 1000]) { const scaled = value / divisor; if (fits(scaled)) return Number(scaled.toFixed(2)) }
  }
  return value
}

const isTestName = name => /\b(ΤΕΣΤ|TEST|ΔΟΚΙΜΗ)\b/i.test(String(name || ''))

// --- Dry run ----------------------------------------------------------------------

// What the file becomes: { items: [{ entry, identity }], issues: [{ row, field, text }], skipped, counts }.
// options: { valueMap: { fieldKey: { sourceValue: optionValue|'' } }, emptyIsNo, fallbackDate, existing: entries }
export function planImport(source, headers, rows, mapping, options = {}) {
  const register = withTemplateHints(source)
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
        const repaired = number == null ? null : repairNumber(field, number)
        if (repaired != null && repaired !== number) note(field, en ? `${number} read as ${repaired}: check it` : `${number} διαβάστηκε ως ${String(repaired).replace('.', ',')}: ελέγξτε το`)
        if (repaired != null) values[field.key] = repaired
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
      // A case without its date takes the first other date it has (a neonate's discharge), noted.
      const stand = (register.entryDateFallbacks || []).find(key => values[key])
      if (stand) { values[dateField] = values[stand]; note(register.fields.find(item => item.key === dateField), en ? `No date: ${textOf(register.fields.find(item => item.key === stand), 'en')} used` : `Χωρίς ημερομηνία: χρησιμοποιήθηκε η «${textOf(register.fields.find(item => item.key === stand), 'el')}»`) }
      // Registers kept without dates (active patients) count on the day recorded and leave their own date empty.
      else if (fallbackDate && !register.undatedImport) values[dateField] = fallbackDate
      else if (!fallbackDate) { skipped.noDate += 1; return }
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
    items.push({ entry: { values: computeValues(register.fields, values), status: 'complete', ...(values[dateField] ? {} : { entryDate }) }, identity: caseNumber || patientName ? { caseNumber, patientName } : null, line })
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
      // A line without its shift goes where the user put «(empty)» in «Values».
      const text = String(cells[measureColumn] ?? '').trim() || EMPTY_VALUE
      measure = valueMap['sheet.measure']?.[text] ?? suggestOption({ options: measures.map(item => ({ value: item.key, label: item.label, labelEn: item.labelEn, match: item.aliases || [] })) }, text)
      if (!measure) { skipped.noMeasure += 1; issues.push({ row: line, field: '', text: text === EMPTY_VALUE ? (en ? 'No shift: not counted (choose one for «(empty)» in Values)' : 'Χωρίς βάρδια: δεν μετράει (επιλέξτε βάρδια για το «(κενό)» στις Τιμές)') : (en ? `Shift «${text}» unknown: not counted` : `Βάρδια «${text}» άγνωστη: δεν μετράει`) }); return }
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
