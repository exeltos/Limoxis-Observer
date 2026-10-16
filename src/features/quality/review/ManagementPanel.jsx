import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardSignature, Plus, Target } from 'lucide-react'
import { ModeSwitch } from '../../../design-system/ModeSwitch'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { ActionButton } from '../../../design-system/ActionButton'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { loadEntries, loadRegisters } from '../../registers/registerService'
import { computeIndicator, periodOf, textOf } from '../../registers/registerEngine'
import { loadObjectives, loadReviews, saveObjective } from './reviewService'
import { objectiveState, reviewStatusLabel } from './reviewTemplate'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

// The objectives with their value today: from the linked register indicator
// (the year so far) or the value the owner reported.
export function useObjectives(organizationId) {
  const [objectives, setObjectives] = useState([])
  const [registers, setRegisters] = useState([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, allRegisters] = await Promise.all([loadObjectives(organizationId), loadRegisters(organizationId).catch(() => [])])
      setRegisters(allRegisters)
      const entriesBy = new Map()
      for (const id of [...new Set(rows.map(row => row.registerId).filter(Boolean))]) {
        const register = allRegisters.find(item => item.id === id)
        if (register) entriesBy.set(id, await loadEntries(organizationId, id, { register }).catch(() => []))
      }
      setObjectives(rows.map(objective => {
        const register = allRegisters.find(item => item.id === objective.registerId)
        const indicator = register?.indicators.find(item => item.id === objective.indicatorKey)
        const value = indicator ? computeIndicator(register, indicator, entriesBy.get(register.id) || [], periodOf('year', `${objective.year}-06-01`)).value : objective.reportedValue === '' ? null : Number(objective.reportedValue)
        return { ...objective, register, indicator, current: { value, status: objectiveState(objective, value) } }
      }))
    } catch (error) { console.error(error); setObjectives([]) } finally { setLoading(false) }
  }, [organizationId])
  useEffect(() => { void reload() }, [reload])
  return { objectives, registers, loading, reload }
}

export function ManagementPanel({ canManage }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const [view, setView] = useState('objectives')
  const objectives = useObjectives(tenant?.id)
  const [reviews, setReviews] = useState([])
  const [editing, setEditing] = useState(null)
  useEffect(() => { loadReviews(tenant?.id).then(setReviews).catch(() => setReviews([])) }, [tenant?.id])
  const stateTone = state => ({ met: 'success', missed: 'danger' })[state] || 'info'
  const stateLabel = state => (en ? { met: 'Met', missed: 'Not met', pending: 'In progress' } : { met: 'Επιτυγχάνεται', missed: 'Δεν επιτυγχάνεται', pending: 'Σε εξέλιξη' })[state]
  return <>
    <div className="quality-management-head">
      <ModeSwitch ariaLabel={en ? 'View' : 'Προβολή'} value={view} onChange={setView} options={[{ value: 'objectives', label: en ? 'Quality objectives' : 'Στόχοι ποιότητας', icon: Target }, { value: 'reviews', label: en ? 'Management reviews' : 'Ανασκοπήσεις Διοίκησης', icon: ClipboardSignature }]} />
      {canManage && (view === 'objectives'
        ? <ActionButton tone="primary" label={en ? 'New objective' : 'Νέος στόχος'} onClick={() => setEditing({ year: new Date().getFullYear(), title: '', direction: 'higher', target: '', status: 'active' })}><Plus size={17} /><span>{en ? 'New objective' : 'Νέος στόχος'}</span></ActionButton>
        : <ActionButton tone="primary" label={en ? 'New review' : 'Νέα ανασκόπηση'} onClick={() => navigate('/quality/reviews/new')}><Plus size={17} /><span>{en ? 'New review' : 'Νέα ανασκόπηση'}</span></ActionButton>)}
    </div>
    {view === 'objectives' ? <RegistryTable className="quality-table" rows={objectives.objectives} columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'title', label: en ? 'Objective' : 'Στόχος' }, { key: 'source', label: en ? 'Measured by' : 'Μετριέται με' }, { key: 'value', label: en ? 'Value / target' : 'Τιμή / στόχος' }, { key: 'owner', label: en ? 'Owner' : 'Υπεύθυνος' }, { key: 'state', label: en ? 'Status' : 'Κατάσταση' }]}
      rowProps={objective => ({ onClick: () => canManage && setEditing(objective) })}
      renderRow={objective => <>
        <td><strong>{objective.code}</strong><small>{objective.year}</small></td>
        <td>{objective.title}</td>
        <td>{objective.indicator ? <>{textOf(objective.indicator, language)}<small>{en ? objective.register.nameEn : objective.register.name}</small></> : (en ? 'Value reported by the owner' : 'Τιμή από τον υπεύθυνο')}</td>
        <td><strong>{objective.current.value ?? '—'}{objective.unit === '%' && objective.current.value != null ? '%' : ''}</strong><small>{objective.direction === 'lower' ? '≤' : '≥'} {objective.target}{objective.unit === '%' ? '%' : objective.unit ? ` ${objective.unit}` : ''}</small></td>
        <td>{objective.ownerLabel || '—'}<small>{formatDay(objective.dueDate, language)}</small></td>
        <td><StatusBadge tone={stateTone(objective.current.status)}>{stateLabel(objective.current.status)}</StatusBadge></td>
      </>}
      emptyTitle={!objectives.loading && !objectives.objectives.length ? (en ? 'No quality objectives' : 'Δεν υπάρχουν στόχοι ποιότητας') : ''} emptyText={en ? 'Set the year’s objectives on the department indicators.' : 'Ορίστε τους στόχους του έτους πάνω στους δείκτες των τμημάτων.'} />
      : <RegistryTable className="quality-table" rows={reviews} columns={[{ key: 'code', label: en ? 'Code' : 'Κωδικός' }, { key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'period', label: en ? 'Period' : 'Περίοδος' }, { key: 'actions', label: en ? 'Decisions' : 'Αποφάσεις' }, { key: 'next', label: en ? 'Next review' : 'Επόμενη' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
        rowProps={review => ({ onClick: () => navigate(`/quality/reviews/${review.id}`) })}
        renderRow={review => <>
          <td><strong>{review.code}</strong></td>
          <td>{formatDay(review.reviewDate, language)}</td>
          <td>{formatDay(review.periodFrom, language) || '—'} – {formatDay(review.periodTo, language) || '—'}</td>
          <td>{review.actions.length}<small>{review.actions.filter(action => action.status === 'open').length} {en ? 'open' : 'ανοιχτές'}</small></td>
          <td>{formatDay(review.nextReviewDate, language) || '—'}</td>
          <td><StatusBadge tone={review.status === 'approved' ? 'success' : 'info'}>{reviewStatusLabel(review.status, language)}</StatusBadge></td>
        </>}
        emptyTitle={!reviews.length ? (en ? 'No management reviews' : 'Δεν υπάρχουν ανασκοπήσεις') : ''} emptyText={en ? 'A new review starts from the facts Limoxis holds for the period.' : 'Η νέα ανασκόπηση ξεκινά με τα στοιχεία της περιόδου από το Limoxis.'} />}
    {editing && <ObjectiveDialog objective={editing} registers={objectives.registers} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void objectives.reload() }} />}
  </>
}

function ObjectiveDialog({ objective: initial, registers, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const [objective, setObjective] = useState(() => ({ ...initial }))
  const [saving, setSaving] = useState(false)
  const set = next => setObjective(current => ({ ...current, ...next }))
  const register = registers.find(item => item.id === objective.registerId)
  const indicatorOptions = useMemo(() => (register?.indicators || []).map(item => ({ value: item.id, label: textOf(item, language) })), [register, language])
  const valid = objective.title?.trim() && objective.target !== ''
  async function save() {
    setSaving(true)
    try {
      const { register: _r, indicator: _i, current: _c, ...clean } = objective // eslint-disable-line no-unused-vars
      await saveObjective(tenant?.id, clean)
      notify(en ? 'Objective saved.' : 'Ο στόχος αποθηκεύτηκε.', 'success')
      onSaved()
    } catch (error) { console.error(error); notify(en ? 'The objective could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.', 'error') } finally { setSaving(false) }
  }
  return <ObserverDialog title={initial.id ? (en ? 'Quality objective' : 'Στόχος ποιότητας') : (en ? 'New quality objective' : 'Νέος στόχος ποιότητας')} subtitle={en ? 'ISO 9001 §6.2: measurable, with an owner and a date.' : 'ISO 9001 §6.2: μετρήσιμος, με υπεύθυνο και προθεσμία.'} onClose={onClose} width="wide" footer={<DialogActions onCancel={onClose} onSave={save} disabled={!valid || saving} saveLabel={en ? 'Save' : 'Αποθήκευση'} showCancel />}>
    <div className="lo-form-cards"><FormCard wide>
      <Field label={`${en ? 'Objective' : 'Στόχος'} *`}><input value={objective.title || ''} onChange={event => set({ title: event.target.value })} /></Field>
      <FormGrid columns={2}>
        <SearchableSelect label={en ? 'Register' : 'Μητρώο'} value={objective.registerId || ''} options={registers.map(item => ({ value: item.id, label: en ? item.nameEn : item.name, description: en ? item.departmentEn : item.department }))} onChange={value => set({ registerId: value || '', indicatorKey: '' })} placeholder={en ? 'None: value reported by the owner' : 'Κανένα: τιμή από τον υπεύθυνο'} {...selectText(en)} />
        {register ? <SearchableSelect label={en ? 'Indicator' : 'Δείκτης'} value={objective.indicatorKey || ''} options={indicatorOptions} onChange={value => { const indicator = register.indicators.find(item => item.id === value); set({ indicatorKey: value || '', unit: indicator?.unit || objective.unit, direction: ['higher', 'lower'].includes(indicator?.direction) ? indicator.direction : objective.direction }) }} {...selectText(en)} /> : <Field label={en ? 'Value so far' : 'Τιμή έως σήμερα'}><input inputMode="decimal" value={objective.reportedValue ?? ''} onChange={event => set({ reportedValue: event.target.value })} /></Field>}
      </FormGrid>
      <FormGrid columns={3}>
        <ChoiceField label={en ? 'Met when the value is' : 'Επιτυγχάνεται όταν η τιμή είναι'} value={objective.direction} options={[{ value: 'higher', label: en ? 'At least' : 'Τουλάχιστον' }, { value: 'lower', label: en ? 'At most' : 'Το πολύ' }]} onChange={value => set({ direction: value })} />
        <Field label={`${en ? 'Target' : 'Στόχος (τιμή)'} *`}><input inputMode="decimal" value={objective.target ?? ''} onChange={event => set({ target: event.target.value })} /></Field>
        <Field label={en ? 'Unit' : 'Μονάδα'}><input value={objective.unit || ''} onChange={event => set({ unit: event.target.value })} /></Field>
      </FormGrid>
      <FormGrid columns={3}>
        <Field label={en ? 'Owner' : 'Υπεύθυνος'}><input value={objective.ownerLabel || ''} onChange={event => set({ ownerLabel: event.target.value })} /></Field>
        <ManualDateField label={en ? 'Due' : 'Προθεσμία'} value={objective.dueDate || ''} onChange={value => set({ dueDate: value })} />
        <Field label={en ? 'Year' : 'Έτος'}><input inputMode="numeric" value={objective.year || ''} onChange={event => set({ year: Number(event.target.value) || '' })} /></Field>
      </FormGrid>
    </FormCard></div>
  </ObserverDialog>
}
