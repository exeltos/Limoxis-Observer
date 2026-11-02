// How a register's definition and data map to the database
// (20261105100000_department_registers.sql): the definition is one row per
// section / field / option / sheet row / indicator / filter, and the data is
// the register's own table (table_name) with one column per field, its
// identity table beside it. The screens keep one shape for a register and an
// entry; this module translates between that shape and the rows.

import { dailyStart } from './registerEngine'

const TYPE_TO_DB = { yesNo: 'yes_no', multiChoice: 'multi_choice' }
const TYPE_FROM_DB = { yes_no: 'yesNo', multi_choice: 'multiChoice' }
const COMPUTED_TO_DB = { ageDays: 'age_days', ageYears: 'age_years', apacheII: 'apache_ii' }
const COMPUTED_FROM_DB = { age_days: 'ageDays', age_years: 'ageYears', apache_ii: 'apacheII' }
const blank = value => value === undefined || value === null || value === ''
const num = value => (blank(value) ? null : Number(value))
const orNull = value => (blank(value) ? null : value)

export const sheetColumn = (rowKey, measureKey) => `${rowKey}__${measureKey}`

// --- Definition: rows → register -------------------------------------------------

export function registerFromRows({ register, sections = [], fields = [], options = [], axes = [], indicators = [], filters = [] }) {
  const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0)
  const optionsOf = fieldId => options.filter(row => row.field_id === fieldId && !row.archived).sort(byPosition).map(row => ({ value: row.value, label: row.label_el, labelEn: row.label_en || row.label_el, ...(row.match?.length ? { match: row.match } : {}) }))
  const filtersOf = (indicatorId, part) => filters.filter(row => row.indicator_id === indicatorId && row.part === part).sort(byPosition).map(row => ({ field: row.field_key, op: row.op, ...(row.value == null ? {} : { value: ['gt', 'lt'].includes(row.op) ? Number(row.value) : row.value }) }))
  const axis = name => axes.filter(row => row.axis === name && !row.archived).sort(byPosition).map(row => ({ key: row.key, label: row.label_el, labelEn: row.label_en || row.label_el, ...(row.help_el ? { help: row.help_el, helpEn: row.help_en || row.help_el } : {}), ...(row.group_key ? { group: row.group_key } : {}), ...(row.aliases?.length ? { aliases: row.aliases } : {}) }))
  const department = register.departments || {}
  return {
    id: register.id,
    code: register.code,
    name: register.name_el,
    nameEn: register.name_en || register.name_el,
    kind: register.kind,
    status: register.status,
    version: register.version,
    templateKey: register.template_key || '',
    tableName: register.table_name || '',
    departmentId: register.department_id || '',
    department: department.name || '',
    departmentEn: department.name || '',
    history: register.history || [],
    updatedAt: register.updated_at,
    fields: fields.filter(row => !row.archived).sort(byPosition).map(row => fieldFromRow(row, optionsOf(row.id))),
    sheet: register.kind === 'sheet' ? { period: register.sheet_period || 'month', ...(register.daily_from ? { dailyFrom: String(register.daily_from).slice(0, 10) } : {}), rows: axis('row'), measures: axis('measure'), groups: axis('group') } : {},
    indicators: indicators.filter(row => !row.archived).sort(byPosition).map(row => indicatorFromRow(row, filtersOf(row.id, 'numerator'), filtersOf(row.id, 'denominator'))),
    settings: {
      sections: sections.sort(byPosition).map(row => ({ key: row.key, label: row.label_el, labelEn: row.label_en || row.label_el })),
      identity: register.kind === 'case' && (register.identity_case_number || register.identity_patient_name) ? { caseNumber: register.identity_case_number, patientName: register.identity_patient_name } : null,
      entryDateField: register.entry_date_field || '',
      breakdowns: fields.filter(row => row.in_breakdown && !row.archived).map(row => row.key),
      description: register.description_el || '',
      descriptionEn: register.description_en || '',
    },
  }
}

function fieldFromRow(row, options) {
  const type = TYPE_FROM_DB[row.field_type] || row.field_type
  const field = { key: row.key, section: row.section_key || '', type, label: row.label_el, labelEn: row.label_en || row.label_el }
  const add = (key, value) => { if (!blank(value) && !(Array.isArray(value) && !value.length)) field[key] = value }
  add('unit', row.unit_el); add('unitEn', row.unit_en)
  add('min', num(row.min_value)); add('max', num(row.max_value)); add('usualMin', num(row.usual_min)); add('usualMax', num(row.usual_max))
  if (row.required) field.required = true
  add('requiredFrom', row.required_from)
  if (row.in_list) field.list = true
  if (row.provisional) field.provisional = true
  add('help', row.help_el); add('helpEn', row.help_en)
  add('notBefore', row.not_before_key)
  if (row.show_when_key) field.showWhen = row.show_when_value == null ? { field: row.show_when_key } : { field: row.show_when_key, value: row.show_when_value === 'true' ? true : row.show_when_value === 'false' ? false : row.show_when_value }
  if (type === 'computed') { field.computed = COMPUTED_FROM_DB[row.computed_kind] || row.computed_kind; field.from = row.computed_from; field.to = row.computed_to }
  add('aliases', row.aliases)
  if (['choice', 'multiChoice'].includes(type)) field.options = options
  return field
}

function indicatorFromRow(row, filters, denominatorFilters) {
  const indicator = { id: row.key, title: row.title_el, titleEn: row.title_en || row.title_el, aggregation: row.aggregation, filters, denominatorFilters, direction: row.direction || 'context' }
  const add = (key, value) => { if (!blank(value) && !(Array.isArray(value) && !value.length)) indicator[key] = value }
  add('field', row.field_key); add('dateField', row.date_field_key); add('denominatorField', row.denominator_field_key); add('multiplier', num(row.multiplier))
  add('rows', row.sheet_rows); add('measure', row.sheet_measure); add('denominatorRows', row.denominator_rows); add('denominatorMeasure', row.denominator_measure)
  add('unit', row.unit_el); add('unitEn', row.unit_en); add('target', num(row.target)); add('threshold', num(row.threshold)); add('note', row.note_el); add('noteEn', row.note_en)
  if (row.daily_only) indicator.dailyOnly = true
  if (!indicator.rows) indicator.rows = []
  return indicator
}

// --- Definition: register → rows -------------------------------------------------

export function registerRow(register, organizationId) {
  return {
    organization_id: organizationId,
    department_id: /^[0-9a-f-]{36}$/i.test(String(register.departmentId || '')) ? register.departmentId : null,
    code: register.code,
    name_el: String(register.name || register.nameEn || '').trim(),
    name_en: String(register.nameEn || register.name || '').trim(),
    description_el: register.settings?.description || null,
    description_en: register.settings?.descriptionEn || null,
    kind: register.kind,
    status: register.status || 'active',
    version: Number(register.version) || 1,
    template_key: register.templateKey || null,
    entry_date_field: register.kind === 'case' ? register.settings?.entryDateField || null : null,
    daily_from: register.kind === 'sheet' && register.sheet?.dailyFrom ? dailyStart(register.sheet.dailyFrom) : null,
    identity_case_number: Boolean(register.settings?.identity?.caseNumber),
    identity_patient_name: Boolean(register.settings?.identity?.patientName),
    history: register.history || [],
  }
}

export function definitionRows(register, organizationId, registerId) {
  const base = { organization_id: organizationId, register_id: registerId }
  const breakdowns = new Set(register.settings?.breakdowns || [])
  const sections = (register.settings?.sections || []).map((section, position) => ({ ...base, key: section.key, label_el: section.label, label_en: section.labelEn || section.label, position }))
  const fields = (register.fields || []).map((field, position) => ({
    ...base,
    key: field.key,
    section_key: field.section || null,
    position,
    field_type: TYPE_TO_DB[field.type] || field.type,
    label_el: field.label,
    label_en: field.labelEn || field.label,
    unit_el: orNull(field.unit),
    unit_en: orNull(field.unitEn),
    min_value: num(field.min),
    max_value: num(field.max),
    usual_min: num(field.usualMin),
    usual_max: num(field.usualMax),
    required: Boolean(field.required),
    required_from: field.required ? orNull(field.requiredFrom) : null,
    in_list: Boolean(field.list),
    in_breakdown: breakdowns.has(field.key),
    provisional: Boolean(field.provisional),
    help_el: orNull(field.help),
    help_en: orNull(field.helpEn),
    not_before_key: orNull(field.notBefore),
    show_when_key: field.showWhen?.field || null,
    show_when_value: field.showWhen && field.showWhen.value !== undefined ? String(field.showWhen.value) : null,
    computed_kind: field.type === 'computed' ? COMPUTED_TO_DB[field.computed] || field.computed : null,
    computed_from: field.type === 'computed' ? field.from : null,
    computed_to: field.type === 'computed' ? field.to : null,
    aliases: field.aliases || [],
    archived: false,
  }))
  const options = (register.fields || []).flatMap(field => (field.options || []).map((option, position) => ({ ...base, fieldKey: field.key, value: option.value, label_el: option.label, label_en: option.labelEn || option.label, position, match: option.match || [], archived: false })))
  const sheet = register.sheet || {}
  const axis = (name, items = []) => items.map((item, position) => ({ ...base, axis: name, key: item.key, label_el: item.label, label_en: item.labelEn || item.label, help_el: orNull(item.help), help_en: orNull(item.helpEn), group_key: orNull(item.group), position, aliases: item.aliases || [], archived: false }))
  const axes = register.kind === 'sheet' ? [...axis('row', sheet.rows), ...axis('measure', sheet.measures), ...axis('group', sheet.groups)] : []
  const indicators = (register.indicators || []).map((indicator, position) => ({
    ...base,
    key: indicator.id,
    position,
    title_el: indicator.title,
    title_en: indicator.titleEn || indicator.title,
    aggregation: indicator.aggregation,
    field_key: orNull(indicator.field),
    date_field_key: orNull(indicator.dateField),
    denominator_field_key: orNull(indicator.denominatorField),
    multiplier: num(indicator.multiplier),
    sheet_rows: indicator.rows || [],
    sheet_measure: orNull(indicator.measure),
    denominator_rows: indicator.denominatorRows || [],
    denominator_measure: orNull(indicator.denominatorMeasure),
    daily_only: Boolean(indicator.dailyOnly),
    unit_el: orNull(indicator.unit),
    unit_en: orNull(indicator.unitEn),
    target: num(indicator.target),
    threshold: num(indicator.threshold),
    direction: indicator.direction || 'context',
    note_el: orNull(indicator.note),
    note_en: orNull(indicator.noteEn),
    archived: false,
  }))
  const filters = (register.indicators || []).flatMap(indicator => [...(indicator.filters || []).map((filter, position) => ({ part: 'numerator', filter, position })), ...(indicator.denominatorFilters || []).map((filter, position) => ({ part: 'denominator', filter, position }))].map(({ part, filter, position }) => ({ ...base, indicatorKey: indicator.id, part, position, field_key: filter.field, op: filter.op, value: filter.value === undefined || filter.value === null ? null : String(filter.value) })))
  return { sections, fields, options, axes, indicators, filters }
}

// --- Data: table rows ↔ entries ---------------------------------------------------

export function entryFromRow(register, row, identity = null) {
  let values
  if (register.kind === 'sheet') {
    values = {}
    for (const sheetRow of register.sheet?.rows || []) for (const measure of register.sheet?.measures || []) {
      const cell = row[sheetColumn(sheetRow.key, measure.key)]
      if (cell !== null && cell !== undefined) values[sheetRow.key] = { ...(values[sheetRow.key] || {}), [measure.key]: Number(cell) }
    }
  } else {
    values = {}
    for (const field of register.fields || []) {
      const cell = row[field.key]
      if (cell === null || cell === undefined) continue
      values[field.key] = ['number', 'computed', 'gestation'].includes(field.type) ? Number(cell) : cell
    }
  }
  return { id: row.id, registerId: register.id, entryDate: row.entry_date, periodStart: row.period_start, version: row.definition_version, values, status: row.status, locked: row.locked, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, identity }
}

// The columns an entry writes (computed columns are filled by the database).
export function rowFromEntry(register, entry, organizationId) {
  const row = { organization_id: organizationId, status: entry.status || 'complete' }
  if (register.kind === 'sheet') {
    row.period_start = entry.periodStart
    row.entry_date = entry.periodStart
    for (const sheetRow of register.sheet?.rows || []) for (const measure of register.sheet?.measures || []) {
      const cell = entry.values?.[sheetRow.key]?.[measure.key]
      row[sheetColumn(sheetRow.key, measure.key)] = blank(cell) ? null : Number(cell)
    }
    return row
  }
  for (const field of register.fields || []) {
    if (field.type === 'computed') continue
    const value = entry.values?.[field.key]
    if (field.type === 'multiChoice') row[field.key] = Array.isArray(value) && value.length ? value : null
    else if (field.type === 'yesNo') row[field.key] = value === true || value === false ? value : null
    else if (['number', 'gestation'].includes(field.type)) row[field.key] = blank(value) || !Number.isFinite(Number(value)) ? null : Number(value)
    else row[field.key] = blank(value) ? null : value
  }
  if (entry.entryDate) row.entry_date = entry.entryDate
  return row
}
