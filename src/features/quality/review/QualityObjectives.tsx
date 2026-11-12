import { useCallback, useEffect, useMemo, useState } from 'react'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { useTableSort } from '../../../design-system/useTableSort'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { Meter } from '../../../design-system/MiniCharts'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { loadEntries, loadRegisters } from '../../registers/registerService'
import { computeIndicator, periodOf, textOf } from '../../registers/registerEngine'
import { loadObjectiveValues, loadObjectives, loadReviews } from './reviewService'
import { OBJECTIVE_LEVELS, levelLabel, planStatusLabel, loadCommitteeTargets, loadIndicatorDefinitions, loadLevelNames, monthlyMean, objectiveLevel, objectiveSource, platformValuesForYears } from './objectiveSources'
import { formatObjectiveValue, objectiveState, objectiveValueText, reviewStatusLabel, toNumber } from './reviewTemplate'
import { roleTitleText } from '../../../core/i18n/roleTitles'
import { QualityPersonField } from '../QualityFields'
import type { AnyRecord } from '../../../types/featureTypes'

const selectText = (en: boolean) => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

// The objectives with their value today: from the linked register indicator (the year so far), from the
// platform's indicator (the hospital's data for the year so far) or the mean of the months the owner entered.
export function useObjectives(organizationId: string | null | undefined, { enabled = true } = {}) {
  const [objectives, setObjectives] = useState<AnyRecord[]>([])
  const [registers, setRegisters] = useState<AnyRecord[]>([])
  const [definitions, setDefinitions] = useState<AnyRecord[]>([])
  const [values, setValues] = useState<AnyRecord[]>([])
  const [levels, setLevels] = useState<{ departments: AnyRecord[], committees: AnyRecord[] }>({ departments: [], committees: [] })
  const [committeeTargets, setCommitteeTargets] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const reload = useCallback(async () => {
    if (!enabled) { setLoading(false); return }
    setLoading(true)
    try {
      setError(false)
      const [rows, allRegisters, allDefinitions, allValues, names, plans] = await Promise.all([loadObjectives(organizationId), loadRegisters(organizationId).catch(() => []), loadIndicatorDefinitions(organizationId), loadObjectiveValues(organizationId).catch(() => []), loadLevelNames(organizationId).catch(() => ({ departments: [], committees: [] })), loadCommitteeTargets(organizationId).catch(() => [])])
      setRegisters(allRegisters)
      setDefinitions(allDefinitions)
      setValues(allValues)
      setLevels(names)
      setCommitteeTargets(plans)
      // The registers the objectives read, together; the platform's indicators once per year.
      const linked = [...new Set(rows.map((row: AnyRecord) => row.registerId).filter(Boolean))].map(id => allRegisters.find(item => item.id === id)).filter(Boolean) as AnyRecord[]
      const entriesBy = new Map(await Promise.all(linked.map(async register => [register.id, await loadEntries(organizationId, register.id, { register }).catch(() => [])] as [string, AnyRecord[]])))
      const platformYears = [...new Set<number>(rows.filter((row: AnyRecord) => !row.registerId && row.platformIndicatorKey).map((row: AnyRecord) => Number(row.year)))]
      const platform = await platformValuesForYears(organizationId, allDefinitions, platformYears)
      setObjectives(rows.map((objective: AnyRecord) => {
        const register = allRegisters.find(item => item.id === objective.registerId)
        const indicator = register?.indicators.find(item => item.id === objective.indicatorKey)
        const platformIndicator = !register && objective.platformIndicatorKey ? allDefinitions.find(def => def.id === objective.platformIndicatorKey) || null : null
        const months = allValues.filter((row: AnyRecord) => row.objectiveId === objective.id && row.month.startsWith(`${objective.year}-`)).sort((a: AnyRecord, b: AnyRecord) => a.month.localeCompare(b.month))
        const value = indicator ? computeIndicator(register as AnyRecord, indicator, entriesBy.get((register as AnyRecord).id) || [], periodOf('year', `${objective.year}-06-01`)).value
          : platformIndicator ? platform.get(Number(objective.year))?.get(platformIndicator.id) ?? null
            : months.length ? monthlyMean(months) : toNumber(objective.reportedValue)
        // Without a target of its own, a linked objective takes the target set in the indicator's definition.
        const source = indicator || platformIndicator
        const fromIndicator = (objective.target === '' || objective.target == null) && source && source.target != null && source.target !== ''
        const effective = fromIndicator ? { ...objective, target: Number(source.target), direction: ['higher', 'lower'].includes(source.direction) ? source.direction : objective.direction, targetFromIndicator: true } : objective
        const department = names.departments.find(item => item.id === objective.departmentId)
        const committee = names.committees.find(item => item.id === objective.committeeId)
        return { ...effective, register, indicator, platformIndicator, months, department, committee, level: objectiveLevel(objective), current: { value, status: objectiveState(effective, value) } }
      }))
    } catch (failure) { console.error(failure); setObjectives([]); setError(true) } finally { setLoading(false) }
  }, [organizationId, enabled])
  useEffect(() => { void reload() }, [reload])
  return { objectives, registers, definitions, values, levels, committeeTargets, loading, error, reload }
}

// Where an objective sits: the hospital, its department (from the department or the register) or its committee.
export function objectiveLevelText(objective: AnyRecord, language: string) {
  const en = language === 'en'
  if (objective.level === 'department') return (objective.department && (en ? objective.department.nameEn : objective.department.name)) || (objective.register && (en ? objective.register.departmentEn || objective.register.department : objective.register.department)) || levelLabel('department', en)
  if (objective.level === 'committee') return objective.committee?.name || levelLabel('committee', en)
  return levelLabel('hospital', en)
}
// How it is measured, in words.
export function objectiveMeasureText(objective: AnyRecord, language: string) {
  const en = language === 'en'
  if (objective.indicator) return textOf(objective.indicator, language)
  if (objective.platformIndicator) return en ? objective.platformIndicator.titleEn || objective.platformIndicator.titleEl : objective.platformIndicator.titleEl
  return en ? 'Value per month' : 'Τιμή ανά μήνα'
}
export function objectiveMeasureSource(objective: AnyRecord, language: string) {
  const en = language === 'en'
  if (objective.indicator) return en ? objective.register.nameEn : objective.register.name
  if (objective.platformIndicator) return en ? 'Platform indicator' : 'Δείκτης πλατφόρμας'
  return objective.months?.length ? (en ? `${objective.months.length} months entered` : `${objective.months.length} μήνες καταχωρημένοι`) : (en ? 'Entered by the owner' : 'Από τον υπεύθυνο')
}

export function useReviews(organizationId: string | null | undefined) {
  const [reviews, setReviews] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    loadReviews(organizationId).then(rows => { if (active) setReviews(rows) }).catch(() => { if (active) setReviews([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [organizationId])
  return { reviews, loading }
}

export const objectiveStateLabel = (state: string, en: boolean) => (en ? { met: 'Met', missed: 'Not met', pending: 'Not measured yet' } as Record<string, string> : { met: 'Επιτυγχάνεται', missed: 'Δεν επιτυγχάνεται', pending: 'Δεν μετριέται ακόμα' } as Record<string, string>)[state]
// How close the value is to the target (100 = met): value / target when more is
// better, target / value when less is better.
export function targetReach(objective: AnyRecord) {
  const value = objective.current?.value, target = toNumber(objective.target)
  if (value == null || target == null || Number.isNaN(target)) return null
  if (objective.direction === 'lower') return value <= target ? 100 : target <= 0 ? 0 : (target / value) * 100
  return target <= 0 ? 100 : Math.min(100, (value / target) * 100)
}
const objectiveStateTone = (state: string) => ({ met: 'success', missed: 'danger' } as Record<string, string>)[state] || 'info'

export const objectiveTitle = (objective: AnyRecord, language: string) => (language === 'en' && objective.titleEn) || objective.title

export function objectivesExport(rows: AnyRecord[], language: string) {
  const en = language === 'en'
  return {
    name: en ? 'quality-objectives' : 'stoxoi-poiotitas',
    headers: en ? ['Code', 'Year', 'Level', 'Objective', 'Measured by', 'Value', 'Target', 'Owner', 'Due', 'Status'] : ['Κωδικός', 'Έτος', 'Επίπεδο', 'Στόχος', 'Μετριέται με', 'Τιμή', 'Στόχος (τιμή)', 'Υπεύθυνος', 'Προθεσμία', 'Κατάσταση'],
    rows: rows.map((objective: AnyRecord) => objective.kind === 'plan'
      ? [objective.committeeCode, objective.year, objective.committeeName, objective.title, objective.indicator, objective.baseline, objective.target, objective.ownerLabel, formatDay(objective.dueDate, language), planStatusLabel(objective.status, en)]
      : [objective.code, objective.year, objectiveLevelText(objective, language), objectiveTitle(objective, language), objectiveMeasureText(objective, language), objectiveValueText(objective.current.value, objective.unit, language), `${objective.direction === 'lower' ? '≤' : '≥'} ${formatObjectiveValue(objective.target, objective.unit, language)}`, objective.ownerLabel || '', formatDay(objective.dueDate, language), objectiveStateLabel(objective.current.status, en)]),
  }
}

export function reviewsExport(rows: AnyRecord[], language: string) {
  const en = language === 'en'
  return {
    name: en ? 'management-reviews' : 'anaskopiseis-dioikisis',
    headers: en ? ['Code', 'Date', 'From', 'To', 'Decisions', 'Open decisions', 'Next review', 'Status'] : ['Κωδικός', 'Ημερομηνία', 'Από', 'Έως', 'Αποφάσεις', 'Ανοιχτές αποφάσεις', 'Επόμενη', 'Κατάσταση'],
    rows: rows.map((review: AnyRecord) => [review.code, formatDay(review.reviewDate, language), formatDay(review.periodFrom, language), formatDay(review.periodTo, language), review.actions.length, review.actions.filter((action: AnyRecord) => action.status === 'open').length, formatDay(review.nextReviewDate, language), reviewStatusLabel(review.status, language)]),
  }
}

// The year's objectives with their value today (Indicators & objectives › Objectives): the hospital's, the departments'
// and the committees' (those of the committees' annual plans open the committee).
export function ObjectivesTable({ rows, loading, error = false, onRetry, onOpen }: { rows: AnyRecord[], loading: boolean, error?: boolean, onRetry: () => Promise<void>, onOpen: (objective: AnyRecord) => void }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const plan = (row: AnyRecord) => row.kind === 'plan'
  // The whole list is sorted by the header arrows, then cut into pages.
  const { sorted, sort, onSort } = useTableSort(rows, {
    title: row => (plan(row) ? row.title : objectiveTitle(row, language)),
    source: row => (plan(row) ? row.indicator : objectiveMeasureText(row, language)),
    value: row => (plan(row) ? null : targetReach(row)),
    owner: row => roleTitleText(row.ownerLabel, language),
    state: row => (plan(row) ? row.status : row.current.status),
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  useEffect(() => setPage(1), [rows.length, pageSize, sort])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  return <><RegistryTable className="quality-table" rows={paged} sort={sort} onSort={onSort} error={error} onRetry={onRetry} columns={[{ key: 'title', label: en ? 'Objective' : 'Στόχος', sortable: true }, { key: 'source', label: en ? 'Measured by' : 'Μετριέται με', sortable: true }, { key: 'value', label: en ? 'Value / target' : 'Τιμή / στόχος', sortable: true }, { key: 'owner', label: en ? 'Owner' : 'Υπεύθυνος', sortable: true }, { key: 'state', label: en ? 'Status' : 'Κατάσταση', sortable: true }]}
    rowKey={row => (plan(row) ? `plan-${row.id}` : row.id)}
    rowProps={row => ({ className: 'registry-row-clickable', onClick: () => onOpen?.(row) })}
    renderRow={row => plan(row) ? <>
      <td><strong>{row.title}</strong><small>{row.committeeName} · {en ? 'annual plan' : 'ετήσιο σχέδιο'}</small></td>
      <td>{row.indicator || '—'}<small>{en ? 'Committee' : 'Επιτροπή'}</small></td>
      <td><strong>{row.target || '—'}</strong>{row.baseline ? <small>{en ? 'from' : 'από'} {row.baseline}</small> : null}</td>
      <td>{String(roleTitleText(row.ownerLabel, language) || '—')}<small>{formatDay(row.dueDate, language)}</small></td>
      <td><StatusBadge tone={row.status === 'completed' ? 'success' : row.status === 'cancelled' ? 'neutral' : 'info'}>{planStatusLabel(row.status, en)}</StatusBadge></td>
    </> : <>
      <td><strong>{objectiveTitle(row, language)}</strong><small>{objectiveLevelText(row, language)} · {row.code}</small></td>
      <td>{objectiveMeasureText(row, language)}<small>{objectiveMeasureSource(row, language)}</small></td>
      <td><strong>{objectiveValueText(row.current.value, row.unit, language)}</strong><small>{row.direction === 'lower' ? '≤' : '≥'} {formatObjectiveValue(row.target, row.unit, language)}</small><Meter value={targetReach(row)} tone={objectiveStateTone(row.current.status)} label={en ? 'How close to the target' : 'Πόσο κοντά στον στόχο'} /></td>
      <td>{String(roleTitleText(row.ownerLabel, language) || '—')}<small>{formatDay(row.dueDate, language)}</small></td>
      <td><StatusBadge tone={objectiveStateTone(row.current.status)}>{objectiveStateLabel(row.current.status, en)}</StatusBadge></td>
    </>}
    emptyTitle={!loading && !rows.length ? (en ? 'No objectives' : 'Δεν υπάρχουν στόχοι') : ''} emptyText={en ? 'Set the year’s objectives of the hospital, the departments and the committees.' : 'Ορίστε τους στόχους του έτους για το νοσοκομείο, τα τμήματα και τις επιτροπές.'} />
    <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={sorted.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} /></>
}

// The management reviews (ISO 9001 §9.3).
export function ReviewsTable({ rows, loading, onOpen }: { rows: AnyRecord[], loading: boolean, onOpen: (review: AnyRecord) => void }) {
  const { language } = useLanguage()
  const en = language === 'en'
  return <RegistryTable className="quality-table" rows={rows} columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'period', label: en ? 'Period' : 'Περίοδος' }, { key: 'actions', label: en ? 'Decisions' : 'Αποφάσεις' }, { key: 'next', label: en ? 'Next review' : 'Επόμενη' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
    rowProps={review => ({ className: 'registry-row-clickable', tabIndex: 0, onClick: () => onOpen?.(review), onKeyDown: event => { if (event.key === 'Enter') onOpen?.(review) } })}
    renderRow={review => <>
      <td><strong>{review.code}</strong></td>
      <td>{formatDay(review.reviewDate, language)}</td>
      <td>{formatDay(review.periodFrom, language) || '—'} – {formatDay(review.periodTo, language) || '—'}</td>
      <td>{review.actions.length}<small>{review.actions.filter((action: AnyRecord) => action.status === 'open').length} {en ? 'open' : 'ανοιχτές'}</small></td>
      <td>{formatDay(review.nextReviewDate, language) || '—'}</td>
      <td><StatusBadge tone={review.status === 'approved' ? 'success' : 'info'}>{reviewStatusLabel(review.status, language)}</StatusBadge></td>
    </>}
    emptyTitle={!loading && !rows.length ? (en ? 'No management reviews' : 'Δεν υπάρχουν ανασκοπήσεις') : ''} emptyText={en ? 'A new review starts from the facts Limoxis holds for the period.' : 'Η νέα ανασκόπηση ξεκινά με τα στοιχεία της περιόδου από το Limoxis.'} />
}

// The objectives as bars, for the review's «Achievement of objectives»: each
// one's value against its target, read in a line.
export function ObjectiveBars({ objectives }: { objectives: AnyRecord[] }) {
  const { language } = useLanguage()
  const en = language === 'en'
  if (!objectives.length) return null
  return <ul className="objective-bars">{objectives.map((objective: AnyRecord) => <li key={objective.id || objective.code}>
    <span className="objective-bars-title">{objectiveTitle(objective, language)}</span>
    <Meter value={targetReach(objective)} tone={objectiveStateTone(objective.current.status)} label={`${objectiveTitle(objective, language)}: ${formatObjectiveValue(objective.current.value, objective.unit, language)}`} />
    <span className="objective-bars-value"><strong>{formatObjectiveValue(objective.current.value, objective.unit, language)}</strong> {objective.direction === 'lower' ? '≤' : '≥'} {formatObjectiveValue(objective.target, objective.unit, language)}</span>
    <StatusBadge tone={objectiveStateTone(objective.current.status)}>{objectiveStateLabel(objective.current.status, en)}</StatusBadge>
  </li>)}</ul>
}

// The target set in the definition of the indicator an objective is linked to (null when none): the register's indicator
// or the platform's.
export function linkedTarget(registers: AnyRecord[], objective: AnyRecord, definitions: AnyRecord[] = []) {
  const indicator = objective.registerId ? registers.find((item: AnyRecord) => item.id === objective.registerId)?.indicators.find((item: AnyRecord) => item.id === objective.indicatorKey) : objective.platformIndicatorKey ? definitions.find(item => item.id === objective.platformIndicatorKey) : null
  return indicator && indicator.target != null && indicator.target !== '' ? Number(indicator.target) : null
}

export const newObjective = () => ({ year: new Date().getFullYear(), level: 'hospital', title: '', direction: 'higher', target: '', status: 'active' })

// The fields of an objective, shared by the new-objective page and the edit page: where it sits (the hospital,
// a department or a committee) and how it is measured (a register's indicator, a platform indicator or a value per month).
export function ObjectiveFields({ objective, set, registers, definitions = [], levels = { departments: [], committees: [] } }: { objective: AnyRecord, set: (patch: AnyRecord) => void, registers: AnyRecord[], definitions?: AnyRecord[], levels?: AnyRecord }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const level = objective.level || objectiveLevel(objective)
  const measure = objective.measure || objectiveSource(objective)
  const register = registers.find((item: AnyRecord) => item.id === objective.registerId)
  const indicatorOptions = useMemo(() => (register?.indicators || []).map((item: AnyRecord) => ({ value: item.id, label: textOf(item, language) })), [register, language])
  const definitionOptions = useMemo(() => definitions.map(def => ({ value: def.id, label: en ? def.titleEn || def.titleEl : def.titleEl, description: def.unit || '' })), [definitions, en])
  const indicatorTarget = linkedTarget(registers, objective, definitions)
  const setMeasure = (value: string) => set(value === 'register' ? { measure: value, platformIndicatorKey: '' } : value === 'indicator' ? { measure: value, registerId: '', indicatorKey: '' } : { measure: value, registerId: '', indicatorKey: '', platformIndicatorKey: '' })
  return <>
    <div className="lo-form-cards"><FormCard wide>
      <Field label={`${en ? 'Objective' : 'Στόχος'} *`}><input value={objective.title || ''} onChange={event => set({ title: event.target.value })} /></Field>
      <FormGrid columns={3}>
        <ChoiceField label={en ? 'Level' : 'Επίπεδο'} value={level} options={OBJECTIVE_LEVELS.map(value => ({ value, label: levelLabel(value, en) }))} onChange={value => set({ level: value, departmentId: value === 'department' ? objective.departmentId : '', committeeId: value === 'committee' ? objective.committeeId : '' })} />
        {level === 'department' && <SearchableSelect label={en ? 'Department' : 'Τμήμα'} value={objective.departmentId || ''} options={levels.departments.map(item => ({ value: item.id, label: en ? item.nameEn || item.name : item.name }))} onChange={value => set({ departmentId: value || '' })} placeholder={en ? 'From the register' : 'Από το μητρώο'} {...selectText(en)} />}
        {level === 'committee' && <SearchableSelect label={en ? 'Committee' : 'Επιτροπή'} value={objective.committeeId || ''} options={levels.committees.map(item => ({ value: item.id, label: item.name }))} onChange={value => set({ committeeId: value || '' })} {...selectText(en)} />}
      </FormGrid>
      <FormGrid columns={3}>
        <ChoiceField label={en ? 'Measured by' : 'Μετριέται με'} value={measure} options={[{ value: 'register', label: en ? 'Department register' : 'Μητρώο τμήματος' }, { value: 'indicator', label: en ? 'Platform indicator' : 'Δείκτης πλατφόρμας' }, { value: 'monthly', label: en ? 'Value per month' : 'Τιμή ανά μήνα' }]} onChange={setMeasure} />
        {measure === 'register' && <SearchableSelect label={en ? 'Register' : 'Μητρώο'} value={objective.registerId || ''} options={registers.map((item: AnyRecord) => ({ value: item.id, label: en ? item.nameEn : item.name, description: en ? item.departmentEn : item.department }))} onChange={value => set({ registerId: value || '', indicatorKey: '' })} {...selectText(en)} />}
        {measure === 'register' && register && <SearchableSelect label={en ? 'Indicator' : 'Δείκτης'} value={objective.indicatorKey || ''} options={indicatorOptions} onChange={value => { const indicator = register.indicators.find((item: AnyRecord) => item.id === value); set({ indicatorKey: value || '', unit: indicator?.unit || objective.unit, direction: ['higher', 'lower'].includes(indicator?.direction) ? indicator.direction : objective.direction }) }} {...selectText(en)} />}
        {measure === 'indicator' && <SearchableSelect label={en ? 'Indicator' : 'Δείκτης'} value={objective.platformIndicatorKey || ''} options={definitionOptions} onChange={value => { const def = definitions.find(item => item.id === value); set({ platformIndicatorKey: value || '', unit: def?.unit || objective.unit, direction: ['higher', 'lower'].includes(def?.direction) ? def.direction : objective.direction }) }} {...selectText(en)} />}
        {measure === 'monthly' && <Field label={en ? 'Unit' : 'Μονάδα'}><input value={objective.unit || ''} onChange={event => set({ unit: event.target.value })} /></Field>}
      </FormGrid>
      <FormGrid columns={3}>
        <ChoiceField label={en ? 'Met when the value is' : 'Επιτυγχάνεται όταν η τιμή είναι'} value={objective.direction} options={[{ value: 'higher', label: en ? 'At least' : 'Τουλάχιστον' }, { value: 'lower', label: en ? 'At most' : 'Το πολύ' }]} onChange={value => set({ direction: value })} />
        <Field label={`${en ? 'Target' : 'Στόχος (τιμή)'}${indicatorTarget == null ? ' *' : ''}`} hint={indicatorTarget != null ? (en ? `Empty = the indicator's target (${indicatorTarget})` : `Κενό = ο στόχος του δείκτη (${indicatorTarget})`) : ''}><input inputMode="decimal" value={objective.target ?? ''} placeholder={indicatorTarget != null ? String(indicatorTarget) : ''} onChange={event => set({ target: event.target.value })} /></Field>
        <Field label={en ? 'Year' : 'Έτος'}><input inputMode="numeric" value={objective.year || ''} onChange={event => set({ year: Number(event.target.value) || '' })} /></Field>
      </FormGrid>
      <FormGrid columns={3}>
        <QualityPersonField label={en ? 'Owner' : 'Υπεύθυνος'} name={objective.ownerLabel || ''} onChange={({ name }: AnyRecord) => set({ ownerLabel: name })} />
        <ManualDateField label={en ? 'Due' : 'Προθεσμία'} value={objective.dueDate || ''} onChange={value => set({ dueDate: value })} />
      </FormGrid>
      {measure === 'monthly' && <p className="field-hint">{en ? 'The owner enters the value of each month on the objective’s page; the year’s value is their mean.' : 'Ο υπεύθυνος περνά την τιμή κάθε μήνα στη σελίδα του στόχου· η τιμή του έτους είναι ο μέσος όρος τους.'}</p>}
    </FormCard></div>
  </>
}
