import { useCallback, useEffect, useMemo, useState } from 'react'
import { RegistryTable } from '../../../design-system/RegistryTable'
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
import { loadObjectives, loadReviews } from './reviewService'
import { formatObjectiveValue, objectiveState, reviewStatusLabel, toNumber } from './reviewTemplate'
import { roleTitleText } from '../../../core/i18n/roleTitles'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

// The objectives with their value today: from the linked register indicator
// (the year so far) or the value the owner reported.
export function useObjectives(organizationId) {
  const [objectives, setObjectives] = useState([])
  const [registers, setRegisters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setError(false)
      const [rows, allRegisters] = await Promise.all([loadObjectives(organizationId), loadRegisters(organizationId).catch(() => [])])
      setRegisters(allRegisters)
      // The registers the objectives read, together.
      const linked = [...new Set(rows.map(row => row.registerId).filter(Boolean))].map(id => allRegisters.find(item => item.id === id)).filter(Boolean)
      const entriesBy = new Map(await Promise.all(linked.map(async register => [register.id, await loadEntries(organizationId, register.id, { register }).catch(() => [])])))
      setObjectives(rows.map(objective => {
        const register = allRegisters.find(item => item.id === objective.registerId)
        const indicator = register?.indicators.find(item => item.id === objective.indicatorKey)
        const value = indicator ? computeIndicator(register, indicator, entriesBy.get(register.id) || [], periodOf('year', `${objective.year}-06-01`)).value : toNumber(objective.reportedValue)
        // Without a target of its own, a linked objective takes the target set in the indicator's definition.
        const fromIndicator = (objective.target === '' || objective.target == null) && indicator && indicator.target != null && indicator.target !== ''
        const effective = fromIndicator ? { ...objective, target: Number(indicator.target), direction: ['higher', 'lower'].includes(indicator.direction) ? indicator.direction : objective.direction, targetFromIndicator: true } : objective
        return { ...effective, register, indicator, current: { value, status: objectiveState(effective, value) } }
      }))
    } catch (failure) { console.error(failure); setObjectives([]); setError(true) } finally { setLoading(false) }
  }, [organizationId])
  useEffect(() => { void reload() }, [reload])
  return { objectives, registers, loading, error, reload }
}

export function useReviews(organizationId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    loadReviews(organizationId).then(rows => { if (active) setReviews(rows) }).catch(() => { if (active) setReviews([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [organizationId])
  return { reviews, loading }
}

export const objectiveStateLabel = (state, en) => (en ? { met: 'Met', missed: 'Not met', pending: 'In progress' } : { met: 'Επιτυγχάνεται', missed: 'Δεν επιτυγχάνεται', pending: 'Σε εξέλιξη' })[state]
// How close the value is to the target (100 = met): value / target when more is
// better, target / value when less is better.
export function targetReach(objective) {
  const value = objective.current?.value, target = toNumber(objective.target)
  if (value == null || target == null || Number.isNaN(target)) return null
  if (objective.direction === 'lower') return value <= target ? 100 : target <= 0 ? 0 : (target / value) * 100
  return target <= 0 ? 100 : Math.min(100, (value / target) * 100)
}
const objectiveStateTone = state => ({ met: 'success', missed: 'danger' })[state] || 'info'

export const objectiveTitle = (objective, language) => (language === 'en' && objective.titleEn) || objective.title

export function objectivesExport(rows, language) {
  const en = language === 'en'
  return {
    name: en ? 'quality-objectives' : 'stoxoi-poiotitas',
    headers: en ? ['Code', 'Year', 'Objective', 'Measured by', 'Value', 'Target', 'Owner', 'Due', 'Status'] : ['Κωδικός', 'Έτος', 'Στόχος', 'Μετριέται με', 'Τιμή', 'Στόχος (τιμή)', 'Υπεύθυνος', 'Προθεσμία', 'Κατάσταση'],
    rows: rows.map(objective => [objective.code, objective.year, objectiveTitle(objective, language), objective.indicator ? textOf(objective.indicator, language) : '', formatObjectiveValue(objective.current.value, objective.unit, language), `${objective.direction === 'lower' ? '≤' : '≥'} ${formatObjectiveValue(objective.target, objective.unit, language)}`, objective.ownerLabel || '', formatDay(objective.dueDate, language), objectiveStateLabel(objective.current.status, en)]),
  }
}

export function reviewsExport(rows, language) {
  const en = language === 'en'
  return {
    name: en ? 'management-reviews' : 'anaskopiseis-dioikisis',
    headers: en ? ['Code', 'Date', 'From', 'To', 'Decisions', 'Open decisions', 'Next review', 'Status'] : ['Κωδικός', 'Ημερομηνία', 'Από', 'Έως', 'Αποφάσεις', 'Ανοιχτές αποφάσεις', 'Επόμενη', 'Κατάσταση'],
    rows: rows.map(review => [review.code, formatDay(review.reviewDate, language), formatDay(review.periodFrom, language), formatDay(review.periodTo, language), review.actions.length, review.actions.filter(action => action.status === 'open').length, formatDay(review.nextReviewDate, language), reviewStatusLabel(review.status, language)]),
  }
}

// The year's quality objectives with their value today (Quality Center > Measurement & review).
export function ObjectivesTable({ rows, loading, error = false, onRetry, onOpen }) {
  const { language } = useLanguage()
  const en = language === 'en'
  return <RegistryTable className="quality-table" rows={rows} error={error} onRetry={onRetry} columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'title', label: en ? 'Objective' : 'Στόχος' }, { key: 'source', label: en ? 'Measured by' : 'Μετριέται με', sortValue: objective => (objective.indicator ? textOf(objective.indicator, language) : '') }, { key: 'value', label: en ? 'Value / target' : 'Τιμή / στόχος', sortValue: objective => targetReach(objective) }, { key: 'owner', label: en ? 'Owner' : 'Υπεύθυνος', sortValue: objective => roleTitleText(objective.ownerLabel, language) }, { key: 'state', label: en ? 'Status' : 'Κατάσταση', sortValue: objective => objective.current.status }]}
    rowProps={objective => ({ className: 'registry-row-clickable', onClick: () => onOpen?.(objective) })}
    renderRow={objective => <>
      <td><strong>{objective.code}</strong><small>{objective.year}</small></td>
      <td>{objectiveTitle(objective, language)}</td>
      <td>{objective.indicator ? <>{textOf(objective.indicator, language)}<small>{en ? objective.register.nameEn : objective.register.name}</small></> : (en ? 'Value reported by the owner' : 'Τιμή από τον υπεύθυνο')}</td>
      <td><strong>{formatObjectiveValue(objective.current.value, objective.unit, language)}</strong><small>{objective.direction === 'lower' ? '≤' : '≥'} {formatObjectiveValue(objective.target, objective.unit, language)}</small><Meter value={targetReach(objective)} tone={objectiveStateTone(objective.current.status)} label={en ? 'How close to the target' : 'Πόσο κοντά στον στόχο'} /></td>
      <td>{roleTitleText(objective.ownerLabel, language) || '—'}<small>{formatDay(objective.dueDate, language)}</small></td>
      <td><StatusBadge tone={objectiveStateTone(objective.current.status)}>{objectiveStateLabel(objective.current.status, en)}</StatusBadge></td>
    </>}
    emptyTitle={!loading && !rows.length ? (en ? 'No quality objectives' : 'Δεν υπάρχουν στόχοι ποιότητας') : ''} emptyText={en ? 'Set the year’s objectives on the department indicators.' : 'Ορίστε τους στόχους του έτους πάνω στους δείκτες των τμημάτων.'} />
}

// The management reviews (ISO 9001 §9.3).
export function ReviewsTable({ rows, loading, onOpen }) {
  const { language } = useLanguage()
  const en = language === 'en'
  return <RegistryTable className="quality-table" rows={rows} columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'period', label: en ? 'Period' : 'Περίοδος' }, { key: 'actions', label: en ? 'Decisions' : 'Αποφάσεις' }, { key: 'next', label: en ? 'Next review' : 'Επόμενη' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
    rowProps={review => ({ onClick: () => onOpen?.(review) })}
    renderRow={review => <>
      <td><strong>{review.code}</strong></td>
      <td>{formatDay(review.reviewDate, language)}</td>
      <td>{formatDay(review.periodFrom, language) || '—'} – {formatDay(review.periodTo, language) || '—'}</td>
      <td>{review.actions.length}<small>{review.actions.filter(action => action.status === 'open').length} {en ? 'open' : 'ανοιχτές'}</small></td>
      <td>{formatDay(review.nextReviewDate, language) || '—'}</td>
      <td><StatusBadge tone={review.status === 'approved' ? 'success' : 'info'}>{reviewStatusLabel(review.status, language)}</StatusBadge></td>
    </>}
    emptyTitle={!loading && !rows.length ? (en ? 'No management reviews' : 'Δεν υπάρχουν ανασκοπήσεις') : ''} emptyText={en ? 'A new review starts from the facts Limoxis holds for the period.' : 'Η νέα ανασκόπηση ξεκινά με τα στοιχεία της περιόδου από το Limoxis.'} />
}

// The objectives as bars, for the review's «Achievement of objectives»: each
// one's value against its target, read in a line.
export function ObjectiveBars({ objectives }) {
  const { language } = useLanguage()
  const en = language === 'en'
  if (!objectives.length) return null
  return <ul className="objective-bars">{objectives.map(objective => <li key={objective.id || objective.code}>
    <span className="objective-bars-title">{objectiveTitle(objective, language)}</span>
    <Meter value={targetReach(objective)} tone={objectiveStateTone(objective.current.status)} label={`${objectiveTitle(objective, language)}: ${formatObjectiveValue(objective.current.value, objective.unit, language)}`} />
    <span className="objective-bars-value"><strong>{formatObjectiveValue(objective.current.value, objective.unit, language)}</strong> {objective.direction === 'lower' ? '≤' : '≥'} {formatObjectiveValue(objective.target, objective.unit, language)}</span>
    <StatusBadge tone={objectiveStateTone(objective.current.status)}>{objectiveStateLabel(objective.current.status, en)}</StatusBadge>
  </li>)}</ul>
}

// The target set in the definition of the indicator an objective is linked to (null when none).
export function linkedTarget(registers, objective) {
  const indicator = registers.find(item => item.id === objective.registerId)?.indicators.find(item => item.id === objective.indicatorKey)
  return indicator && indicator.target != null && indicator.target !== '' ? Number(indicator.target) : null
}

export const newObjective = () => ({ year: new Date().getFullYear(), title: '', direction: 'higher', target: '', status: 'active' })

// The fields of an objective, shared by the new-objective page and the edit dialog.
export function ObjectiveFields({ objective, set, registers }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const register = registers.find(item => item.id === objective.registerId)
  const indicatorOptions = useMemo(() => (register?.indicators || []).map(item => ({ value: item.id, label: textOf(item, language) })), [register, language])
  const indicatorTarget = linkedTarget(registers, objective)
  return <>
    <div className="lo-form-cards"><FormCard wide>
      <Field label={`${en ? 'Objective' : 'Στόχος'} *`}><input value={objective.title || ''} onChange={event => set({ title: event.target.value })} /></Field>
      <FormGrid columns={3}>
        <SearchableSelect label={en ? 'Register' : 'Μητρώο'} value={objective.registerId || ''} options={registers.map(item => ({ value: item.id, label: en ? item.nameEn : item.name, description: en ? item.departmentEn : item.department }))} onChange={value => set({ registerId: value || '', indicatorKey: '' })} placeholder={en ? 'None: value reported by the owner' : 'Κανένα: τιμή από τον υπεύθυνο'} {...selectText(en)} />
        {register ? <SearchableSelect label={en ? 'Indicator' : 'Δείκτης'} value={objective.indicatorKey || ''} options={indicatorOptions} onChange={value => { const indicator = register.indicators.find(item => item.id === value); set({ indicatorKey: value || '', unit: indicator?.unit || objective.unit, direction: ['higher', 'lower'].includes(indicator?.direction) ? indicator.direction : objective.direction }) }} {...selectText(en)} /> : <Field label={en ? 'Value so far' : 'Τιμή έως σήμερα'}><input inputMode="decimal" value={objective.reportedValue ?? ''} onChange={event => set({ reportedValue: event.target.value })} /></Field>}
        <Field label={en ? 'Unit' : 'Μονάδα'}><input value={objective.unit || ''} onChange={event => set({ unit: event.target.value })} /></Field>
      </FormGrid>
      <FormGrid columns={3}>
        <ChoiceField label={en ? 'Met when the value is' : 'Επιτυγχάνεται όταν η τιμή είναι'} value={objective.direction} options={[{ value: 'higher', label: en ? 'At least' : 'Τουλάχιστον' }, { value: 'lower', label: en ? 'At most' : 'Το πολύ' }]} onChange={value => set({ direction: value })} />
        <Field label={`${en ? 'Target' : 'Στόχος (τιμή)'}${indicatorTarget == null ? ' *' : ''}`} hint={indicatorTarget != null ? (en ? `Empty = the indicator's target (${indicatorTarget})` : `Κενό = ο στόχος του δείκτη (${indicatorTarget})`) : ''}><input inputMode="decimal" value={objective.target ?? ''} placeholder={indicatorTarget != null ? String(indicatorTarget) : ''} onChange={event => set({ target: event.target.value })} /></Field>
        <Field label={en ? 'Year' : 'Έτος'}><input inputMode="numeric" value={objective.year || ''} onChange={event => set({ year: Number(event.target.value) || '' })} /></Field>
      </FormGrid>
      <FormGrid columns={3}>
        <Field label={en ? 'Owner' : 'Υπεύθυνος'}><input value={objective.ownerLabel || ''} onChange={event => set({ ownerLabel: event.target.value })} /></Field>
        <ManualDateField label={en ? 'Due' : 'Προθεσμία'} value={objective.dueDate || ''} onChange={value => set({ dueDate: value })} />
      </FormGrid>
    </FormCard></div>
  </>
}
