import { useEffect, useMemo, useState } from 'react'
import { Archive, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, FolderInput, GripVertical, Minus, Pencil, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import { FormCard, FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { YesNoField } from '../../design-system/YesNoField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { IconButton } from '../../design-system/IconButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { StatusBadge } from '../../design-system/StatusBadge'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { formatDay } from '../../core/i18n/formatDay'
import { roleLabel } from '../../core/permissions/roleLabels'
import { hospitalDate } from '../../core/dates/hospitalDate'
import { AGGREGATIONS, dailyStart, COMPUTED_KINDS, computeIndicator, definitionChanges, FIELD_TYPES, FILTER_OPS, fieldVisible, filterText, keyFrom, optionLabel, optionsOf, periodLabel, periodOf, textOf } from './registerEngine'
import { saveRegister } from './registerService'
import { formatIndicatorValue, indicatorStatusLabel, indicatorStatusTone, registerStatusLabel, shortUnit } from './registerText'
import { registerThemeKey } from './registerThemes'
import { RegisterField as RegisterFieldControl } from './RegisterEntryPage'
import type { DragEvent, ReactNode } from 'react'
import type { IndicatorResult, Period } from './registerEngine'
import type { FieldOption, IndicatorFilter, Register, RegisterEntry, RegisterField, RegisterIndicator, RegisterSection, RegisterSettings, SheetAxisItem, ShowWhen } from './registerTypes'

const selectText = (en: boolean) => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const move = <T,>(list: T[], index: number, step: number) => { const next = [...list]; const target = index + step; if (target < 0 || target >= next.length) return list; [next[index], next[target]] = [next[target], next[index]]; return next }
// The indicators are shown with the value of the last complete month (the definition reads the entries already loaded).
const lastCompleteMonth = (): Period => { const date = new Date(`${hospitalDate().slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1); return periodOf('month', date.toISOString().slice(0, 10)) }
// An indicator still being set up (a mean without its field) gives no value rather than an error.
const valueOf = (register: Register, indicator: RegisterIndicator, entries: RegisterEntry[], period: Period): IndicatorResult | null => { try { return computeIndicator(register, indicator, entries, period) } catch { return null } }
// What kind of number an indicator is, short enough for a chip (owner, 23/11/2026).
function aggregationChip(indicator: RegisterIndicator, language: string) {
  const en = language === 'en'
  if (indicator.aggregation === 'rate') { const per = new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(Number(indicator.multiplier) || 1000); return en ? `per ${per} days` : `ανά ${per} ημέρες` }
  if (indicator.aggregation === 'smr') return 'SMR'
  return optionLabel(AGGREGATIONS, indicator.aggregation, language).replace(/ %$/, '')
}
// The value of an indicator as the indicators tab shows it (the unit beside it, short).
function IndicatorValue({ indicator, result, language }: { indicator: RegisterIndicator, result: IndicatorResult | null, language: string }) {
  const en = language === 'en'
  if (!result) return <span className="register-muted">—</span>
  if (result.notRecorded) return <span className="register-muted">{en ? 'Not recorded' : 'Δεν καταγράφεται'}</span>
  const unit = en ? indicator.unitEn || indicator.unit : indicator.unit
  return <span className={`register-def-value is-${result.status || 'context'}`}><strong>{formatIndicatorValue(result.value, { ...indicator, unit: unit === '%' ? '%' : '', unitEn: '' }, language)}</strong>{result.value != null && unit && unit !== '%' && <small> {shortUnit(unit)}</small>}{['percent', 'rate', 'smr'].includes(indicator.aggregation) && result.numerator != null && result.denominator != null && <small className="register-def-ratio">{formatIndicatorValue(result.numerator, null, language)} / {formatIndicatorValue(result.denominator, null, language)}</small>}</span>
}

// The definition of a register, edited by Quality: sections and fields (case)
// or rows and measures (sheet), and the indicators. Each new field becomes a
// column of the register's table; a field taken out is archived with its data.
// A saved field keeps its key and type, so the data already recorded keeps its meaning.
// A field carries whether it is split in the reports until applied (then kept in settings.breakdowns);
// in its editor «Always shown» is an empty showWhen, left out when applied.
// Owner, 23/11/2026: the parts sit right under the record's tabs on one surface; each row has a «⋯» at its right
// (fields also a handle to drag them); a field or an indicator opens in a centred card; the save bar shows only with changes.
type AppliedField = RegisterField & { breakdown?: boolean }
type FieldDraft = Omit<AppliedField, 'showWhen'> & { showWhen?: ShowWhen | '' }
// A sheet row or measure in its editor (a new one gets its key when applied).
type AxisDraft = Omit<SheetAxisItem, 'key'> & { key?: string }
// What is open in a card: a field or an indicator, with the key it had (null: new).
type Editing = { kind: 'field', field: AppliedField, previousKey: string | null } | { kind: 'indicator', indicator: RegisterIndicator, previousId: string | null }
// Where a dragged field lands: before or after a field, or at the end of a section.
type DropTarget = { key: string | null, section: string, after: boolean }
interface RegisterBuilderProps { register: Register, entries?: RegisterEntry[], canEdit: boolean, entryCount: number, openIndicator?: string | null, onSaved?: (register: Register | null) => void }
export function RegisterBuilder({ register, entries = [], canEdit, entryCount, openIndicator = null, onSaved }: RegisterBuilderProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { user, profile } = useAuth()
  const { tenant } = useTenant()
  const [draft, setDraft] = useState(() => structuredClone(register))
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)
  // The sections of the fields: the first one is open, the others fold, so 35 fields are not one long list.
  const [expanded, setExpanded] = useState(() => new Set<string>([register.settings?.sections?.[0]?.key || 'main']))
  const toggleSection = (key: string) => setExpanded(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  // The definition in three parts, so it is not one long page: the register, its fields (or sheet), its indicators.
  const [part, setPart] = useState(() => (openIndicator ? 'indicators' : 'register'))
  const [previewOpen, setPreviewOpen] = useState(false)
  const [moving, setMoving] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [drop, setDrop] = useState<DropTarget | null>(null)
  // Opened from «Set a target»: that indicator's editor is open.
  useEffect(() => {
    const indicator = openIndicator && register.indicators.find(item => item.id === openIndicator)
    if (indicator && canEdit) { setPart('indicators'); setEditing({ kind: 'indicator', indicator, previousId: indicator.id }) }
  }, [openIndicator]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(structuredClone(register)), [register])
  const savedKeys = useMemo(() => new Set<string | null>(register.fields.map(field => field.key)), [register])
  const changes = useMemo(() => definitionChanges(register, draft), [register, draft])
  const dirty = changes > 0
  const period = useMemo(lastCompleteMonth, [])
  const results = useMemo(() => new Map(draft.indicators.map(indicator => [indicator.id, valueOf(draft, indicator, entries, period)])), [draft, entries, period])
  const patch = (next: Partial<Register>) => setDraft(current => ({ ...current, ...next }))
  const setSettings = (next: RegisterSettings) => setDraft(current => ({ ...current, settings: { ...current.settings, ...next } }))
  const sections = draft.settings?.sections?.length ? draft.settings.sections : [{ key: 'main', label: en ? 'Details' : 'Στοιχεία', labelEn: 'Details' }]
  const sectionOf = (field: RegisterField) => (field.section && sections.some(item => item.key === field.section) ? field.section : sections[0].key)
  const fieldsOf = (section: RegisterSection) => draft.fields.filter(field => sectionOf(field) === section.key)
  const dateFields = draft.fields.filter(field => field.type === 'date')

  async function save() {
    setSaving(true)
    try {
      const saved = await saveRegister(tenant?.id, draft, { actor: auditActorFromAuth({ profile, user }).name, action: draft.status !== register.status ? (draft.status === 'archived' ? 'archived' : 'activated') : 'updated', definitionChanged: true })
      notify(en ? 'Definition saved.' : 'Ο ορισμός αποθηκεύτηκε.', 'success')
      onSaved?.(saved)
    } catch (error) {
      console.error(error)
      notify(en ? 'The definition could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση του ορισμού.', 'error')
    } finally { setSaving(false) }
  }
  function upsertField(field: AppliedField, previousKey: string | null) {
    setDraft(current => {
      const exists = current.fields.some(item => item.key === previousKey)
      const fields = exists ? current.fields.map(item => (item.key === previousKey ? field : item)) : [...current.fields, field]
      const breakdowns = new Set<string>(current.settings?.breakdowns || [])
      if (field.breakdown) breakdowns.add(field.key); else breakdowns.delete(field.key)
      const { breakdown, ...clean } = field // eslint-disable-line @typescript-eslint/no-unused-vars
      return { ...current, fields: fields.map(item => (item.key === field.key ? clean : item)), settings: { ...current.settings, breakdowns: [...breakdowns] } }
    })
    setExpanded(current => new Set(current).add(field.section || sections[0].key))
    setEditing(null)
  }
  function upsertIndicator(indicator: RegisterIndicator, previousId: string | null) {
    setDraft(current => ({ ...current, indicators: current.indicators.some(item => item.id === previousId) ? current.indicators.map(item => (item.id === previousId ? indicator : item)) : [...current.indicators, indicator] }))
    setEditing(null)
  }
  // A field moved by dragging or from its «⋯»: before or after another field, or at the end of a section (it then takes that section).
  function placeField(key: string, target: DropTarget) {
    const field = draft.fields.find(item => item.key === key)
    if (!field || target.key === key) return
    const placed = sectionOf(field) === target.section ? field : { ...field, section: target.section }
    const rest = draft.fields.filter(item => item !== field)
    const anchor = target.key ? rest.findIndex(item => item.key === target.key) : -1
    const lastOfSection = rest.reduce((last, item, index) => (sectionOf(item) === target.section ? index : last), -1)
    const at = anchor >= 0 ? anchor + (target.after ? 1 : 0) : lastOfSection >= 0 ? lastOfSection + 1 : rest.length
    patch({ fields: [...rest.slice(0, at), placed, ...rest.slice(at)] })
    setExpanded(current => new Set(current).add(target.section))
  }
  // «Move up / down» in the «⋯»: the keyboard's way to reorder, within the section.
  function stepField(field: RegisterField, step: number) {
    const siblings = draft.fields.filter(item => sectionOf(item) === sectionOf(field))
    const other = siblings[siblings.indexOf(field) + step]
    if (other) placeField(field.key, { key: other.key, section: sectionOf(field), after: step > 0 })
  }
  const dragOver = (event: DragEvent, target: DropTarget) => { if (!dragKey) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (drop?.key !== target.key || drop?.after !== target.after || drop?.section !== target.section) setDrop(target) }
  const dropHere = (event: DragEvent) => { event.preventDefault(); if (dragKey && drop) placeField(dragKey, drop); setDragKey(null); setDrop(null) }
  const newField = (section: string) => { setExpanded(current => new Set(current).add(section)); setEditing({ kind: 'field', field: { key: '', section, type: 'number', label: '', labelEn: '' }, previousKey: null }) }
  const newIndicator = () => setEditing({ kind: 'indicator', indicator: { id: '', title: '', titleEn: '', aggregation: draft.kind === 'sheet' ? 'sum' : 'count', filters: [], denominatorFilters: [], rows: [], direction: 'context' }, previousId: null })
  const addSection = () => { const label = en ? 'New section' : 'Νέα ενότητα'; const key = keyFrom(`section ${sections.length + 1}`, sections.map(item => item.key)); setSettings({ sections: [...sections, { key, label, labelEn: label }] }); setExpanded(current => new Set(current).add(key)); setRenaming(key) }
  const fieldColumns = canEdit ? 5 : 3

  const parts = [{ value: 'register', label: en ? 'Register' : 'Μητρώο' }, { value: 'fields', label: draft.kind === 'sheet' ? (en ? 'Sheet' : 'Φύλλο') : `${en ? 'Fields' : 'Πεδία'} (${draft.fields.length})` }, { value: 'indicators', label: `${en ? 'Indicators' : 'Δείκτες'} (${draft.indicators.length})` }]
  return <section className="record-tab-panel register-builder">
    <div className="register-def-tabs"><CanonicalTabs items={parts} value={part} onChange={value => { setPart(value); setEditing(null) }} ariaLabel={en ? 'Definition' : 'Ορισμός'} /></div>
    <div className="record-tab-panel-body"><div className="register-def-body">
      {part === 'register' && <RegisterSummary register={draft} saved={register} entries={entries} entryCount={entryCount} canEdit={canEdit} sections={sections} sectionOf={sectionOf} dateFields={dateFields} patch={patch} setSettings={setSettings} />}

      {part === 'fields' && draft.kind === 'case' && <>
        <div className="register-def-toolbar">
          <p>{canEdit ? (en ? 'Each field is a column of the register’s table; removing one keeps its data.' : 'Κάθε πεδίο είναι στήλη του πίνακα του μητρώου· όταν αφαιρείται, τα δεδομένα του μένουν.') : (en ? 'Defined by the Quality team.' : 'Ορίζεται από την Ομάδα Ποιότητας.')}{entryCount > 0 && <small>{en ? `${entryCount} entries recorded: a saved field keeps its type.` : `${entryCount} καταχωρίσεις: ένα αποθηκευμένο πεδίο κρατά τον τύπο του.`}</small>}</p>
          <div>
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}><Eye size={15} />{en ? 'As the department sees it' : 'Όπως το βλέπει το τμήμα'}</Button>
            {canEdit && <Button variant="secondary" onClick={addSection}><Plus size={15} />{en ? 'Section' : 'Ενότητα'}</Button>}
            {canEdit && <Button onClick={() => newField(sections[0].key)}><Plus size={15} />{en ? 'Field' : 'Πεδίο'}</Button>}
          </div>
        </div>
        <table className="data-table register-def-table">
          <thead><tr>{canEdit && <th aria-label={en ? 'Order' : 'Σειρά'} />}<th>{en ? 'Field' : 'Πεδίο'}</th><th>{en ? 'Type' : 'Τύπος'}</th><th>{en ? 'Details' : 'Λεπτομέρειες'}</th>{canEdit && <th aria-label={en ? 'Actions' : 'Ενέργειες'} />}</tr></thead>
          {sections.map(section => {
            const fields = fieldsOf(section)
            const isOpen = expanded.has(section.key)
            const endOfSection: DropTarget = { key: null, section: section.key, after: true }
            return <tbody key={section.key}>
              <tr className={`register-def-band${drop && !drop.key && drop.section === section.key ? ' is-drop' : ''}`} onDragOver={event => dragOver(event, endOfSection)} onDrop={dropHere}><th colSpan={fieldColumns} scope="rowgroup"><div className="register-def-band-row">
                <button type="button" className="register-def-band-toggle" aria-expanded={isOpen} onClick={() => toggleSection(section.key)}>{isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}<span>{textOf(section, language)}</span><small>{fields.length}</small></button>
                {canEdit && <span className="register-def-band-tools">
                  <Button variant="secondary" onClick={() => newField(section.key)}><Plus size={14} />{en ? 'Field' : 'Πεδίο'}</Button>
                  <OverflowMenu label={en ? 'Section actions' : 'Ενέργειες ενότητας'} items={[{ id: 'rename', label: en ? 'Rename' : 'Μετονομασία', icon: Pencil, onClick: () => setRenaming(section.key) }]} />
                </span>}
              </div></th></tr>
              {isOpen && fields.map(field => {
                const siblings = fields.indexOf(field)
                const dropClass = drop?.key === field.key ? (drop.after ? ' is-drop-after' : ' is-drop-before') : ''
                return <tr key={field.key} className={`register-def-row${dragKey === field.key ? ' is-dragging' : ''}${dropClass}`} onDragOver={event => { const box = event.currentTarget.getBoundingClientRect(); dragOver(event, { key: field.key, section: section.key, after: event.clientY > box.top + box.height / 2 }) }} onDrop={dropHere}>
                  {canEdit && <td className="register-def-grip-cell"><span className="register-def-grip" draggable title={en ? 'Drag to reorder' : 'Σύρετε για αλλαγή σειράς'} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', field.key); setDragKey(field.key) }} onDragEnd={() => { setDragKey(null); setDrop(null) }}><GripVertical size={15} aria-hidden="true" /></span></td>}
                  <td><strong>{textOf(field, language)}</strong></td>
                  <td><span className="register-def-chip">{optionLabel(FIELD_TYPES, field.type, language)}</span></td>
                  <td><span className="register-def-detail">{field.required && <span className="register-def-badge">{field.requiredFrom ? (en ? `required from ${field.requiredFrom.split('-').reverse().join('/')}` : `υποχρεωτικό από ${field.requiredFrom.split('-').reverse().join('/')}`) : (en ? 'required' : 'υποχρεωτικό')}</span>}<span>{[en ? field.unitEn || field.unit : field.unit, field.options?.length && `${field.options.length} ${en ? 'values' : 'τιμές'}`, field.provisional && (en ? 'list to complete' : 'λίστα προς συμπλήρωση'), field.showWhen?.field && `${en ? 'shown when' : 'εμφανίζεται όταν'} ${textOf(draft.fields.find(item => item.key === field.showWhen?.field), language).toLowerCase()}`].filter(Boolean).join(' · ') || (field.required ? '' : '—')}</span></span></td>
                  {canEdit && <td className="register-def-menu-cell"><OverflowMenu label={`${en ? 'Actions' : 'Ενέργειες'}: ${textOf(field, language)}`} items={[
                    { id: 'edit', label: en ? 'Edit' : 'Επεξεργασία', icon: Pencil, onClick: () => setEditing({ kind: 'field', field: { ...field, breakdown: (draft.settings?.breakdowns || []).includes(field.key) }, previousKey: field.key }) },
                    sections.length > 1 && { id: 'section', label: en ? 'Move to section' : 'Μετακίνηση σε ενότητα', icon: FolderInput, onClick: () => setMoving(field.key) },
                    { id: 'up', label: en ? 'Move up' : 'Μετακίνηση πάνω', icon: ArrowUp, disabled: siblings === 0, onClick: () => stepField(field, -1) },
                    { id: 'down', label: en ? 'Move down' : 'Μετακίνηση κάτω', icon: ArrowDown, disabled: siblings === fields.length - 1, onClick: () => stepField(field, 1) },
                    { id: 'archive', label: en ? 'Withdraw' : 'Απόσυρση', description: en ? 'The data already recorded is kept.' : 'Τα δεδομένα που καταγράφηκαν μένουν.', icon: Archive, tone: 'danger', separatorBefore: true, onClick: () => patch({ fields: draft.fields.filter(item => item !== field) }) },
                  ]} /></td>}
                </tr>
              })}
              {isOpen && !fields.length && <tr className="register-def-empty"><td colSpan={fieldColumns}>{en ? 'No fields in this section yet.' : 'Δεν υπάρχουν ακόμη πεδία σε αυτή την ενότητα.'}</td></tr>}
            </tbody>
          })}
        </table>
      </>}

      {part === 'fields' && draft.kind === 'sheet' && <>
        <div className="register-def-toolbar"><p>{en ? 'Rows are what is counted (procedures); measures are the columns (number, shift). Each row × measure is a column of the table.' : 'Γραμμές: τι μετράται (πράξεις). Στήλες: τα μέτρα (αριθμός, βάρδια). Κάθε γραμμή × στήλη είναι στήλη του πίνακα.'}</p></div>
        <AxisEditor usual={usualPerDay(draft, entries)} title={en ? 'Rows' : 'Γραμμές'} items={draft.sheet.rows} canEdit={canEdit} language={language} groups={draft.sheet.groups || []} onChange={rows => patch({ sheet: { ...draft.sheet, rows } })} />
        <AxisEditor title={en ? 'Measures' : 'Στήλες'} items={draft.sheet.measures} canEdit={canEdit} language={language} onChange={measures => patch({ sheet: { ...draft.sheet, measures } })} />
      </>}

      {part === 'indicators' && <>
        <div className="register-def-toolbar">
          <p>{en ? `The value is that of ${periodLabel(period, language)}, the last complete month, with the definition as it is now.` : `Η τιμή είναι του μήνα ${periodLabel(period, language)}, του τελευταίου πλήρους μήνα, με τον ορισμό όπως είναι τώρα.`}</p>
          {canEdit && <div><Button onClick={newIndicator}><Plus size={15} />{en ? 'Indicator' : 'Δείκτης'}</Button></div>}
        </div>
        <table className="data-table register-def-table">
          <thead><tr><th>{en ? 'Indicator' : 'Δείκτης'}</th><th>{en ? 'Type' : 'Τύπος'}</th><th>{en ? 'Better when · target' : 'Καλύτερα όταν · στόχος'}</th><th className="register-num">{periodLabel(period, language)}</th>{canEdit && <th aria-label={en ? 'Actions' : 'Ενέργειες'} />}</tr></thead>
          <tbody>{draft.indicators.map((indicator, index) => {
            const judged = indicator.direction === 'higher' || indicator.direction === 'lower'
            const percent = indicator.aggregation === 'percent' || indicator.unit === '%'
            const limit = (value: unknown) => `${value}${percent ? '%' : ''}`
            const basis = draft.kind === 'case' && textOf(draft.fields.find(field => field.key === (indicator.dateField || draft.settings?.entryDateField)), language)
            return <tr key={indicator.id} className="register-def-row">
              <td><strong>{textOf(indicator, language)}</strong><small>{[indicator.field && textOf(draft.fields.find(field => field.key === indicator.field), language), ...(indicator.filters || []).map((filter: IndicatorFilter) => filterText(draft, filter, language)), basis && `${en ? 'counted on' : 'μετράει στην'} ${basis.toLowerCase()}`].filter(Boolean).join(' · ')}</small></td>
              <td><span className="register-def-chip">{aggregationChip(indicator, language)}</span></td>
              <td><span className="register-def-detail">{indicator.direction === 'higher' ? <span className="register-def-better"><TrendingUp size={15} aria-hidden="true" />{en ? 'Higher' : 'Υψηλότερο'}</span> : indicator.direction === 'lower' ? <span className="register-def-better"><TrendingDown size={15} aria-hidden="true" />{en ? 'Lower' : 'Χαμηλότερο'}</span> : <span className="register-def-better register-muted"><Minus size={15} aria-hidden="true" />{en ? 'No target' : 'Χωρίς στόχο'}</span>}{judged && indicator.target != null && indicator.target !== '' && <span className="register-def-badge">{en ? 'Target' : 'Στόχος'} {indicator.direction === 'higher' ? '≥' : '≤'} {limit(indicator.target)}</span>}{judged && indicator.threshold != null && indicator.threshold !== '' && <span className="register-def-badge is-limit">{en ? 'Limit' : 'Όριο'} {limit(indicator.threshold)}</span>}</span></td>
              <td className="register-num"><IndicatorValue indicator={indicator} result={results.get(indicator.id) ?? null} language={language} /></td>
              {canEdit && <td className="register-def-menu-cell"><OverflowMenu label={`${en ? 'Actions' : 'Ενέργειες'}: ${textOf(indicator, language)}`} items={[
                { id: 'edit', label: en ? 'Edit' : 'Επεξεργασία', icon: Pencil, onClick: () => setEditing({ kind: 'indicator', indicator, previousId: indicator.id }) },
                { id: 'up', label: en ? 'Move up' : 'Μετακίνηση πάνω', icon: ArrowUp, disabled: index === 0, onClick: () => patch({ indicators: move(draft.indicators, index, -1) }) },
                { id: 'down', label: en ? 'Move down' : 'Μετακίνηση κάτω', icon: ArrowDown, disabled: index === draft.indicators.length - 1, onClick: () => patch({ indicators: move(draft.indicators, index, 1) }) },
                { id: 'remove', label: en ? 'Remove' : 'Αφαίρεση', icon: Archive, tone: 'danger', separatorBefore: true, onClick: () => patch({ indicators: draft.indicators.filter(item => item !== indicator) }) },
              ]} /></td>}
            </tr>
          })}</tbody>
        </table>
        {!draft.indicators.length && <div className="inline-empty">{en ? 'No indicators yet.' : 'Δεν υπάρχουν ακόμη δείκτες.'}</div>}
      </>}
    </div></div>
    {canEdit && dirty && <div className="inline-edit-footer register-def-savebar"><Button variant="secondary" disabled={saving} onClick={() => setDraft(structuredClone(register))}>{en ? 'Undo changes' : 'Αναίρεση αλλαγών'}</Button><SaveButton loading={saving} disabled={saving} onClick={save}>{en ? `Save · ${changes} ${changes === 1 ? 'change' : 'changes'}` : `Αποθήκευση · ${changes} ${changes === 1 ? 'αλλαγή' : 'αλλαγές'}`}</SaveButton></div>}

    {editing?.kind === 'field' && <FieldEditor field={editing.field} register={draft} sections={sections} locked={savedKeys.has(editing.previousKey)} onCancel={() => setEditing(null)} onSave={next => upsertField(next, editing.previousKey)} />}
    {editing?.kind === 'indicator' && <IndicatorEditor indicator={editing.indicator} register={draft} entries={entries} period={period} onCancel={() => setEditing(null)} onSave={next => upsertIndicator(next, editing.previousId)} />}
    {previewOpen && <RegisterPreview register={draft} sections={sections} sectionOf={sectionOf} onClose={() => setPreviewOpen(false)} />}
    {moving && <MoveToSection field={draft.fields.find(item => item.key === moving)} current={sectionOf(draft.fields.find(item => item.key === moving) || draft.fields[0])} sections={sections} onCancel={() => setMoving(null)} onApply={section => { placeField(moving, { key: null, section, after: true }); setMoving(null) }} />}
    {renaming && <RenameSection section={sections.find(item => item.key === renaming)} onCancel={() => setRenaming(null)} onApply={next => { setSettings({ sections: sections.map(item => (item.key === renaming ? { ...item, ...next } : item)) }); setRenaming(null) }} />}
  </section>
}

// «Register»: the basic fields on one or two rows, then what the register holds and who records in it.
interface RegisterSummaryProps { register: Register, saved: Register, entries: RegisterEntry[], entryCount: number, canEdit: boolean, sections: RegisterSection[], sectionOf: (field: RegisterField) => string, dateFields: RegisterField[], patch: (next: Partial<Register>) => void, setSettings: (next: RegisterSettings) => void }
function RegisterSummary({ register: draft, saved, entries, entryCount, canEdit, sections, sectionOf, dateFields, patch, setSettings }: RegisterSummaryProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const days = entries.map(entry => String(entry.entryDate || entry.periodStart || '').slice(0, 10)).filter(Boolean).sort()
  const department = (en ? saved.departmentEn : saved.department) || (en ? 'the department' : 'το τμήμα')
  const withTarget = draft.indicators.filter(indicator => (indicator.direction === 'higher' || indicator.direction === 'lower') && indicator.target != null && indicator.target !== '').length
  return <>
    <div className="register-def-basics">
      <Field label={en ? 'Name' : 'Όνομα'}><input value={draft.name} disabled={!canEdit} onChange={event => patch({ name: event.target.value })} /></Field>
      <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={draft.status} options={['active', 'draft', 'archived'].map(value => ({ value, label: registerStatusLabel(value, language) }))} onChange={value => canEdit && patch({ status: value })} />
      {draft.kind === 'sheet' && <ManualDateField label={en ? 'Recorded day by day from' : 'Ημερήσια καταχώριση από'} value={dailyStart(draft.sheet?.dailyFrom)} disabled={!canEdit} onChange={value => canEdit && value && patch({ sheet: { ...draft.sheet, dailyFrom: value } })} hint={en ? 'Before this day the sheet has one total a month.' : 'Πριν από αυτή την ημέρα το φύλλο έχει ένα σύνολο τον μήνα.'} />}
      {draft.kind === 'case' && <SearchableSelect label={en ? 'Date a case counts on' : 'Ημερομηνία που μετράει το περιστατικό'} value={draft.settings?.entryDateField || ''} disabled={!canEdit} options={dateFields.map(field => ({ value: field.key, label: textOf(field, language) }))} onChange={value => setSettings({ entryDateField: value || '' })} {...selectText(en)} />}
      {draft.kind === 'case' && <div className="register-builder-checks">
        <span className="lo-field-label">{en ? 'Identity kept for each case' : 'Ταυτότητα που κρατιέται σε κάθε περιστατικό'}</span>
        <div className="register-builder-checks-row">
          <YesNoField label={en ? 'Case number' : 'Αριθμός περιστατικού'} value={Boolean(draft.settings?.identity?.caseNumber)} onChange={value => canEdit && setSettings({ identity: { ...(draft.settings?.identity || {}), caseNumber: value } })} />
          <YesNoField label={en ? 'Patient name' : 'Ονοματεπώνυμο'} value={Boolean(draft.settings?.identity?.patientName)} onChange={value => canEdit && setSettings({ identity: { ...(draft.settings?.identity || {}), patientName: value } })} />
          <small className="field-hint">{en ? 'Seen only inside the department; never in indicators or exports.' : 'Τα βλέπει μόνο το τμήμα· δεν εμφανίζονται σε δείκτες ή εξαγωγές.'}</small>
        </div>
      </div>}
    </div>
    <div className="register-def-summary">
      <section>
        <h4>{draft.kind === 'sheet' ? (en ? 'Sheet' : 'Φύλλο') : (en ? 'Fields by section' : 'Πεδία ανά ενότητα')}</h4>
        {draft.kind === 'sheet' ? <ul><li><span>{en ? 'Rows' : 'Γραμμές'}</span><b>{draft.sheet?.rows?.length || 0}</b></li><li><span>{en ? 'Measures' : 'Στήλες'}</span><b>{draft.sheet?.measures?.length || 0}</b></li></ul>
          : <ul>{sections.map(section => <li key={section.key}><span>{textOf(section, language)}</span><b>{draft.fields.filter(field => sectionOf(field) === section.key).length}</b></li>)}<li className="is-total"><span>{en ? 'In all' : 'Σύνολο'}</span><b>{draft.fields.length}</b></li></ul>}
      </section>
      <section>
        <h4>{en ? 'Indicators' : 'Δείκτες'}</h4>
        <strong>{draft.indicators.length}</strong>
        <p>{en ? `${withTarget} with a target` : `${withTarget} με στόχο`}</p>
      </section>
      <section>
        <h4>{draft.kind === 'sheet' ? (en ? 'Days recorded' : 'Καταχωρισμένες ημέρες') : (en ? 'Entries' : 'Καταχωρίσεις')}</h4>
        <strong>{entryCount}</strong>
        <p>{days.length ? `${en ? 'since' : 'από'} ${formatDay(days[0], language)} · ${en ? 'latest' : 'τελευταία'} ${formatDay(days[days.length - 1], language)}` : (en ? 'Nothing recorded yet.' : 'Δεν έχει καταγραφεί τίποτα ακόμη.')}</p>
      </section>
      <section>
        <h4>{en ? 'Who records' : 'Ποιος καταγράφει'}</h4>
        <p>{en ? `The members of ${department} and the ${roleLabel('hospital_admin', language)}, while the register is active.` : `Τα μέλη του τμήματος ${department} και ο ${roleLabel('hospital_admin', language)}, όσο το μητρώο είναι ενεργό.`}</p>
        <p>{en ? `Defined by the Quality team; Quality and the ${roleLabel('division_director', language)} read the indicators without names.` : `Ορίζεται από την Ομάδα Ποιότητας· η Ποιότητα και ο ${roleLabel('division_director', language)} βλέπουν τους δείκτες χωρίς ονόματα.`}</p>
        {draft.status !== 'active' && <p className="is-warning">{en ? 'Not active: it takes no new entries.' : 'Δεν είναι ενεργό: δεν δέχεται νέες καταχωρίσεις.'}</p>}
      </section>
    </div>
  </>
}

// «As the department sees it»: a new entry's form with the fields as they are now (not saved yet), drawn with the
// same controls as the entry page, read-only. Fields shown only after another answer are left out and counted.
interface RegisterPreviewProps { register: Register, sections: RegisterSection[], sectionOf: (field: RegisterField) => string, onClose: () => void }
function RegisterPreview({ register, sections, sectionOf, onClose }: RegisterPreviewProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const theme = registerThemeKey(register)
  const shown = sections.map(section => ({ section, fields: register.fields.filter(field => sectionOf(field) === section.key) })).filter(item => item.fields.length)
  const hidden = register.fields.filter(field => !fieldVisible(field, {})).length
  return <ObserverDialog width="wide" className="register-def-dialog" eyebrow={en ? register.nameEn : register.name} title={en ? 'As the department sees it' : 'Όπως το βλέπει το τμήμα'} subtitle={[en ? 'A new entry with the fields as they are now, before saving. Nothing can be typed here.' : 'Νέα καταχώριση με τα πεδία όπως είναι τώρα, πριν την αποθήκευση. Εδώ δεν συμπληρώνεται τίποτα.', hidden ? (en ? `${hidden} more appear after the answers they depend on.` : `Άλλα ${hidden} εμφανίζονται ανάλογα με τις απαντήσεις.`) : ''].filter(Boolean).join(' ')} onClose={onClose}>
    <div className={`register-entry-form register-def-preview${theme ? ` is-theme-${theme}` : ''}`}>
      {register.settings?.identity && (register.settings.identity.caseNumber || register.settings.identity.patientName) && <section className="register-entry-section">
        <header><h3>{en ? 'Who' : 'Ταυτότητα'}</h3></header>
        <div className="register-entry-grid">
          {register.settings.identity.caseNumber && <Field label={en ? 'Case number' : 'Αριθμός περιστατικού'}><input value="" disabled readOnly /></Field>}
          {register.settings.identity.patientName && <Field label={en ? 'Name' : 'Ονοματεπώνυμο'}><input value="" disabled readOnly /></Field>}
        </div>
      </section>}
      {shown.map(({ section, fields }, position) => {
        const visible = fields.filter(field => fieldVisible(field, {}))
        return <section key={section.key} className="register-entry-section">
          <header><span className="register-entry-badge">{position + 1}</span><h3>{textOf(section, language)}</h3><small>{visible.length}</small></header>
          <div className="register-entry-grid">{visible.map(field => <RegisterFieldControl key={field.key} field={field} value={undefined} onChange={() => {}} disabled language={language} entryValues={{}} fields={register.fields} />)}</div>
        </section>
      })}
    </div>
  </ObserverDialog>
}

// «Move to section» of a field's «⋯».
interface MoveToSectionProps { field?: RegisterField, current: string, sections: RegisterSection[], onCancel: () => void, onApply: (section: string) => void }
function MoveToSection({ field, current, sections, onCancel, onApply }: MoveToSectionProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [section, setSection] = useState(current)
  return <ObserverDialog width="compact" title={en ? 'Move to section' : 'Μετακίνηση σε ενότητα'} subtitle={textOf(field, language)} onClose={onCancel} footer={<Button disabled={section === current} onClick={() => onApply(section)}>{en ? 'Move' : 'Μετακίνηση'}</Button>}>
    <SearchableSelect label={en ? 'Section' : 'Ενότητα'} value={section} options={sections.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => value && setSection(value)} {...selectText(en)} clearLabel="" />
  </ObserverDialog>
}

// A section's name in Greek and English.
interface RenameSectionProps { section?: RegisterSection, onCancel: () => void, onApply: (section: Pick<RegisterSection, 'label' | 'labelEn'>) => void }
function RenameSection({ section, onCancel, onApply }: RenameSectionProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [label, setLabel] = useState(section?.label || '')
  const [labelEn, setLabelEn] = useState(section?.labelEn || '')
  return <ObserverDialog width="compact" title={en ? 'Section name' : 'Όνομα ενότητας'} onClose={onCancel} footer={<Button disabled={!label.trim()} onClick={() => onApply({ label: label.trim(), labelEn: labelEn.trim() || label.trim() })}>{en ? 'Apply' : 'Εφαρμογή'}</Button>}>
    <FormGrid columns={1}>
      <Field label={`${en ? 'Name (Greek)' : 'Όνομα (ελληνικά)'} *`}><input value={label} onChange={event => setLabel(event.target.value)} /></Field>
      <Field label={en ? 'Name (English)' : 'Όνομα (αγγλικά)'}><input value={labelEn} onChange={event => setLabelEn(event.target.value)} /></Field>
    </FormGrid>
  </ObserverDialog>
}

// What each row usually is per day: the mean of the last 30 daily entries (null before the daily sheets start).
function usualPerDay(register: Register, entries: RegisterEntry[]) {
  if (register.kind !== 'sheet') return null
  const dailyFrom = dailyStart(register.sheet?.dailyFrom)
  const days = entries.filter(entry => String(entry.periodStart) >= dailyFrom).sort((a, b) => String(b.periodStart).localeCompare(String(a.periodStart))).slice(0, 30)
  return new Map<string, number | null>((register.sheet?.rows || []).map(row => {
    const totals = days.map(entry => Object.values(entry.values?.[row.key] || {}).reduce((sum: number, cell) => sum + (Number(cell) || 0), 0))
    return [row.key, totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null]
  }))
}

// The rows (or measures) of a sheet as a table, like the fields: each one opens in a card from its «⋯».
interface AxisEditorProps { title: string, items?: SheetAxisItem[], canEdit: boolean, language: string, groups?: SheetAxisItem[], usual?: Map<string, number | null> | null, onChange: (items: SheetAxisItem[]) => void }
function AxisEditor({ title, items = [], canEdit, language, groups, usual = null, onChange }: AxisEditorProps) {
  const en = language === 'en'
  const [editing, setEditing] = useState<{ index: number | null, item: AxisDraft } | null>(null)
  const withGroups = (groups?.length ?? 0) > 0
  function apply(next: AxisDraft) {
    const label = next.label.trim()
    const item = { ...next, label, labelEn: (next.labelEn || '').trim() || label }
    onChange(editing!.index == null ? [...items, { ...item, key: keyFrom(label || `row ${items.length + 1}`, items.map(row => row.key)) }] : items.map((row, position) => (position === editing!.index ? item as SheetAxisItem : row)))
    setEditing(null)
  }
  return <div className="register-builder-section">
    <div className="register-builder-section-head"><strong>{title} ({items.length})</strong>{canEdit && <Button variant="secondary" onClick={() => setEditing({ index: null, item: { label: '', labelEn: '', group: '' } })}><Plus size={15} />{en ? 'Add' : 'Προσθήκη'}</Button>}</div>
    <table className="data-table register-def-table"><thead><tr><th>{en ? 'Name' : 'Όνομα'}</th>{withGroups && <th>{en ? 'Group' : 'Ομάδα'}</th>}{usual && <th className="register-num">{en ? 'Usually per day' : 'Συνήθως ανά ημέρα'}</th>}{canEdit && <th aria-label={en ? 'Actions' : 'Ενέργειες'} />}</tr></thead><tbody>{items.map((item, index) => <tr key={item.key} className="register-def-row">
      <td><strong>{textOf(item, language)}</strong></td>
      {withGroups && <td>{textOf(groups!.find(group => group.key === item.group), language) || <span className="register-muted">—</span>}</td>}
      {usual && <td className="register-num">{usual.get(item.key) == null ? <span className="register-muted">—</span> : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(usual.get(item.key)!)}</td>}
      {canEdit && <td className="register-def-menu-cell"><OverflowMenu label={`${en ? 'Actions' : 'Ενέργειες'}: ${textOf(item, language)}`} items={[
        { id: 'edit', label: en ? 'Edit' : 'Επεξεργασία', icon: Pencil, onClick: () => setEditing({ index, item }) },
        { id: 'up', label: en ? 'Move up' : 'Μετακίνηση πάνω', icon: ArrowUp, disabled: index === 0, onClick: () => onChange(move(items, index, -1)) },
        { id: 'down', label: en ? 'Move down' : 'Μετακίνηση κάτω', icon: ArrowDown, disabled: index === items.length - 1, onClick: () => onChange(move(items, index, 1)) },
        { id: 'archive', label: en ? 'Withdraw' : 'Απόσυρση', description: en ? 'The data already recorded is kept.' : 'Τα δεδομένα που καταγράφηκαν μένουν.', icon: Archive, tone: 'danger', separatorBefore: true, onClick: () => onChange(items.filter((_, position) => position !== index)) },
      ]} /></td>}
    </tr>)}</tbody></table>
    {editing && <AxisItemEditor item={editing.item} title={title} groups={groups} language={language} onCancel={() => setEditing(null)} onApply={apply} />}
  </div>
}

interface AxisItemEditorProps { item?: AxisDraft, title: string, groups?: SheetAxisItem[], language: string, onCancel: () => void, onApply: (item: AxisDraft) => void }
function AxisItemEditor({ item: initial, title, groups, language, onCancel, onApply }: AxisItemEditorProps) {
  const en = language === 'en'
  const [item, setItem] = useState<AxisDraft>(initial || { label: '', labelEn: '', group: '' })
  const set = (next: Partial<AxisDraft>) => setItem(current => ({ ...current, ...next }))
  return <EditorPanel compact title={initial?.key ? `${en ? 'Edit' : 'Επεξεργασία'} · ${title}` : `${en ? 'New' : 'Νέα'} · ${title}`} onCancel={onCancel} onApply={() => onApply(item)} disabled={!item.label.trim()}>
    <FormGrid columns={groups?.length ? 2 : 1}>
      <Field label={`${en ? 'Name' : 'Όνομα'} *`}><input value={item.label} onChange={event => set({ label: event.target.value })} /></Field>
      {(groups?.length ?? 0) > 0 && <SearchableSelect label={en ? 'Group' : 'Ομάδα'} value={item.group || ''} options={groups!.map(group => ({ value: group.key, label: textOf(group, language) }))} onChange={value => set({ group: value || '' })} {...selectText(en)} />}
    </FormGrid>
  </EditorPanel>
}

// An editor opened as a centred card (owner, 23/11/2026, like the Library's cards): «Apply» puts the change in the
// draft, which «Save» at the bottom of the definition stores. Closing it with × leaves the draft as it was.
interface EditorPanelProps { title: string, subtitle?: ReactNode, onCancel: () => void, onApply: () => void, disabled?: boolean, compact?: boolean, children?: ReactNode }
function EditorPanel({ title, subtitle, onCancel, onApply, disabled, compact = false, children }: EditorPanelProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  return <ObserverDialog width={compact ? 'compact' : 'wide'} className="register-def-dialog" title={title} subtitle={subtitle || undefined} onClose={onCancel}
    footer={<><small className="register-def-dialog-note">{en ? 'The change is kept with «Save» of the definition.' : 'Η αλλαγή κρατιέται με την «Αποθήκευση» του ορισμού.'}</small><Button disabled={disabled} onClick={onApply}>{en ? 'Apply' : 'Εφαρμογή'}</Button></>}>
    {children}
  </ObserverDialog>
}

interface FieldEditorProps { field: FieldDraft, register: Register, sections: RegisterSection[], locked: boolean, onCancel: () => void, onSave: (field: AppliedField) => void }
function FieldEditor({ field: initial, register, sections, locked, onCancel, onSave }: FieldEditorProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [field, setField] = useState<FieldDraft>(() => structuredClone(initial))
  const set = (next: Partial<FieldDraft>) => setField(current => ({ ...current, ...next }))
  const others = register.fields.filter(item => item.key !== initial.key)
  const dates = others.filter(item => item.type === 'date')
  const numbers = others.filter(item => item.type === 'number')
  const yesNos = others.filter(item => item.type === 'yesNo')
  const isList = ['choice', 'multiChoice'].includes(field.type)
  const valid = Boolean(field.label.trim()) && (field.type !== 'computed' || (field.computed && field.from && field.to)) && (!isList || (field.options || []).length > 0 || field.provisional)
  function finish() {
    const key = locked ? field.key : field.key || keyFrom(field.labelEn || field.label, others.map(item => item.key))
    const options = isList ? (field.options || []).filter((option: FieldOption) => option.label.trim()).map((option: FieldOption) => ({ ...option, value: option.value || keyFrom(option.labelEn || option.label, (field.options || []).map((item: FieldOption) => item.value).filter(Boolean)) })) : undefined
    const clean = Object.fromEntries(Object.entries({ ...field, key, options, labelEn: field.labelEn || field.label }).filter(([, value]) => value !== '' && value !== undefined && value !== null && value !== false))
    // The empty values are left out: what stays is still the field.
    onSave(clean as unknown as AppliedField)
  }
  const number = (label: string, name: 'min' | 'max' | 'usualMin' | 'usualMax') => <Field label={label}><input inputMode="decimal" value={field[name] ?? ''} onChange={event => set({ [name]: event.target.value === '' ? '' : Number(event.target.value.replace(',', '.')) })} /></Field>
  return <EditorPanel title={initial.key ? (en ? 'Edit field' : 'Επεξεργασία πεδίου') : (en ? 'New field' : 'Νέο πεδίο')} subtitle={locked ? (en ? `Column ${field.key}: its type stays as recorded.` : `Στήλη ${field.key}: ο τύπος της μένει όπως καταγράφηκε.`) : ''} onCancel={onCancel} onApply={finish} disabled={!valid}>
    <div className="lo-form-cards">
      <FormCard wide title={en ? 'Field' : 'Πεδίο'}>
        <FormGrid columns={3}>
          <Field label={`${en ? 'Label' : 'Ετικέτα'} *`}><input value={field.label} onChange={event => set({ label: event.target.value })} /></Field>
          <SearchableSelect label={en ? 'Type' : 'Τύπος'} value={field.type} disabled={locked} options={optionsOf(FIELD_TYPES, language)} onChange={value => value && set({ type: value })} {...selectText(en)} clearLabel="" />
          <SearchableSelect label={en ? 'Section' : 'Ενότητα'} value={field.section || sections[0]?.key || ''} options={sections.map(section => ({ value: section.key, label: textOf(section, language) }))} onChange={value => set({ section: value || sections[0]?.key })} {...selectText(en)} clearLabel="" />
        </FormGrid>
        <FormGrid columns={3}>
          <YesNoField label={en ? 'Required' : 'Υποχρεωτικό'} value={Boolean(field.required)} onChange={value => set({ required: value })} />
          {field.required && <ManualDateField label={en ? 'Required from' : 'Υποχρεωτικό από'} optional value={field.requiredFrom || ''} onChange={value => set({ requiredFrom: value || undefined })} />}
          <YesNoField label={en ? 'Column in the list' : 'Στήλη στη λίστα'} value={Boolean(field.list)} onChange={value => set({ list: value })} />
          {isList && <YesNoField label={en ? 'Split in reports' : 'Ανάλυση στις αναφορές'} value={Boolean(field.breakdown)} onChange={value => set({ breakdown: value })} />}
        </FormGrid>
        <Field label={en ? 'Help / definition' : 'Βοήθεια / ορισμός'}><input value={field.help || ''} onChange={event => set({ help: event.target.value })} /></Field>
      </FormCard>
      {['number', 'computed', 'gestation'].includes(field.type) && <FormCard wide title={en ? 'Unit and limits' : 'Μονάδα και όρια'} hint={en ? 'Outside the limits the value is refused; outside the usual range the user is asked to check.' : 'Εκτός ορίων η τιμή δεν γίνεται δεκτή· εκτός συνήθους εύρους ζητείται έλεγχος.'}>
        <FormGrid columns={2}><Field label={en ? 'Unit' : 'Μονάδα'}><input value={field.unit || ''} placeholder="g, ημέρες, %" onChange={event => set({ unit: event.target.value })} /></Field></FormGrid>
        {field.type !== 'computed' && <FormGrid columns={4}>{number(en ? 'Minimum' : 'Ελάχιστο', 'min')}{number(en ? 'Maximum' : 'Μέγιστο', 'max')}{number(en ? 'Usual from' : 'Σύνηθες από', 'usualMin')}{number(en ? 'Usual to' : 'Σύνηθες έως', 'usualMax')}</FormGrid>}
      </FormCard>}
      {field.type === 'computed' && <FormCard wide title={en ? 'Computed by the database' : 'Υπολογίζεται από τη βάση'}>
        <SearchableSelect label={en ? 'What' : 'Τι'} value={field.computed || ''} options={optionsOf(COMPUTED_KINDS, language)} onChange={value => set({ computed: value })} {...selectText(en)} />
        <FormGrid columns={2}>
          {field.computed === 'apacheII' ? <>
            <SearchableSelect label={en ? 'APACHE II score' : 'APACHE II score'} value={field.from || ''} options={numbers.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ from: value })} {...selectText(en)} />
            <SearchableSelect label={en ? 'Post-operative (yes/no)' : 'Μετεγχειρητικός (ναι/όχι)'} value={field.to || ''} options={yesNos.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ to: value })} {...selectText(en)} />
          </> : <>
          <SearchableSelect label={en ? 'From date' : 'Από ημερομηνία'} value={field.from || ''} options={dates.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ from: value })} {...selectText(en)} />
          <SearchableSelect label={en ? 'To date' : 'Έως ημερομηνία'} value={field.to || ''} options={dates.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ to: value })} {...selectText(en)} />
          </>}
        </FormGrid>
      </FormCard>}
      {field.type === 'date' && <FormCard wide title={en ? 'Rule' : 'Κανόνας'}><SearchableSelect label={en ? 'Not before' : 'Όχι πριν από'} value={field.notBefore || ''} options={dates.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ notBefore: value || '' })} {...selectText(en)} /></FormCard>}
      {isList && <FormCard wide title={en ? 'Values' : 'Τιμές'} hint={en ? '«Import as» lists how each value began in the imported file.' : 'Στο «Εισαγωγή ως» γράφετε πώς ξεκινά η τιμή στο αρχείο εισαγωγής (π.χ. ΔΙΑΚΟΜΙΔΗ), χωρισμένα με κόμμα.'}>
        <ul className="register-builder-list">{(field.options || []).map((option: FieldOption, index: number) => <li key={option.value || index}><span className="register-axis-fields">
          <input aria-label={en ? 'Value' : 'Τιμή'} value={option.label} onChange={event => set({ options: field.options!.map((item: FieldOption, position: number) => (position === index ? { ...item, label: event.target.value } : item)) })} />
          <input aria-label={en ? 'Import as' : 'Εισαγωγή ως'} placeholder={en ? 'Import as' : 'Εισαγωγή ως'} value={(option.match || []).join(', ')} onChange={event => set({ options: field.options!.map((item: FieldOption, position: number) => (position === index ? { ...item, match: event.target.value.split(',').map(text => text.trim()).filter(Boolean) } : item)) })} />
        </span><span className="register-builder-tools"><IconButton size="sm" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ options: field.options!.filter((_: FieldOption, position: number) => position !== index) })}><Archive size={14} /></IconButton></span></li>)}</ul>
        <Button variant="secondary" onClick={() => set({ options: [...(field.options || []), { value: '', label: '', labelEn: '' }] })}><Plus size={15} />{en ? 'Value' : 'Τιμή'}</Button>
      </FormCard>}
      {field.type !== 'computed' && <FormCard wide title={en ? 'Shown when' : 'Εμφανίζεται όταν'}>
        <SearchableSelect label={en ? 'Another field has a value' : 'Άλλο πεδίο έχει τιμή'} value={(field.showWhen || undefined)?.field || ''} options={others.filter(item => item.type !== 'computed').map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ showWhen: value ? { field: value } : '' })} placeholder={en ? 'Always shown' : 'Εμφανίζεται πάντα'} {...selectText(en)} />
      </FormCard>}
    </div>
  </EditorPanel>
}

interface FilterRowsProps { register: Register, filters?: IndicatorFilter[], onChange: (filters: IndicatorFilter[]) => void, language: string }
function FilterRows({ register, filters = [], onChange, language }: FilterRowsProps) {
  const en = language === 'en'
  const fields = register.fields.filter(field => field.type !== 'text')
  const set = (index: number, next: Partial<IndicatorFilter>) => onChange(filters.map((filter, position) => (position === index ? { ...filter, ...next } : filter)))
  return <div className="register-filter-rows">
    {filters.map((filter, index) => {
      const field = fields.find(item => item.key === filter.field)
      return <div key={index} className="register-filter-row">
        <SearchableSelect hideLabel label={en ? 'Field' : 'Πεδίο'} value={filter.field} options={fields.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set(index, { field: value, value: undefined })} {...selectText(en)} />
        <SearchableSelect hideLabel label={en ? 'Condition' : 'Συνθήκη'} value={filter.op} options={optionsOf(FILTER_OPS, language)} onChange={value => set(index, { op: value })} {...selectText(en)} clearLabel="" />
        {filter.op === 'eq' && field?.options ? <SearchableSelect<string | number> hideLabel label={en ? 'Value' : 'Τιμή'} value={filter.value || ''} options={field.options.map((option: FieldOption) => ({ value: option.value, label: textOf(option, language) }))} onChange={value => set(index, { value })} {...selectText(en)} /> : ['gt', 'lt', 'eq'].includes(filter.op) ? <input aria-label={en ? 'Value' : 'Τιμή'} value={filter.value ?? ''} onChange={event => set(index, { value: filter.op === 'eq' ? event.target.value : Number(event.target.value) })} /> : <span />}
        <IconButton size="sm" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => onChange(filters.filter((_, position) => position !== index))}><Archive size={14} /></IconButton>
      </div>
    })}
    <Button variant="secondary" onClick={() => onChange([...filters, { field: fields[0]?.key || '', op: 'filled' }])}><Plus size={15} />{en ? 'Condition' : 'Συνθήκη'}</Button>
  </div>
}

interface IndicatorEditorProps { indicator: RegisterIndicator, register: Register, entries: RegisterEntry[], period: Period, onCancel: () => void, onSave: (indicator: RegisterIndicator) => void }
function IndicatorEditor({ indicator: initial, register, entries, period, onCancel, onSave }: IndicatorEditorProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [indicator, setIndicator] = useState<RegisterIndicator>(() => structuredClone(initial))
  const set = (next: Partial<RegisterIndicator>) => setIndicator(current => ({ ...current, ...next }))
  const sheet = register.kind === 'sheet'
  const numeric = register.fields.filter(field => ['number', 'computed', 'gestation'].includes(field.type))
  const dates = register.fields.filter(field => field.type === 'date')
  const aggregations = AGGREGATIONS.filter(item => (sheet ? ['sum', 'percent', 'mean', 'count'].includes(item.value) : item.value !== 'smr' || indicator.aggregation === 'smr'))
  const rows = (register.sheet?.rows || []).map(row => ({ value: row.key, label: textOf(row, language) }))
  const measures = (register.sheet?.measures || []).map(measure => ({ value: measure.key, label: textOf(measure, language) }))
  const needsField = !sheet && ['mean', 'median', 'sum'].includes(indicator.aggregation)
  const valid = Boolean(indicator.title.trim()) && (!needsField || indicator.field) && (sheet || indicator.aggregation !== 'rate' || indicator.denominatorField)
  function finish() {
    const id = initial.id || keyFrom(indicator.titleEn || indicator.title, register.indicators.map(item => item.id))
    const clean = Object.fromEntries(Object.entries({ ...indicator, id, titleEn: indicator.titleEn || indicator.title, unit: indicator.aggregation === 'percent' ? '%' : indicator.unit }).filter(([, value]) => value !== '' && value !== undefined && value !== null))
    // The empty values are left out: what stays is still the indicator.
    onSave(clean as unknown as RegisterIndicator)
  }
  // What the indicator would give with these settings, live (the last complete month).
  const shown = useMemo(() => ({ ...indicator, unit: indicator.aggregation === 'percent' ? '%' : indicator.unit }), [indicator])
  const result = useMemo(() => (valid ? valueOf(register, shown, entries, period) : null), [valid, register, shown, entries, period])
  return <EditorPanel title={initial.id ? (en ? 'Edit indicator' : 'Επεξεργασία δείκτη') : (en ? 'New indicator' : 'Νέος δείκτης')} onCancel={onCancel} onApply={finish} disabled={!valid}>
    <div className="register-def-live" role="status"><span>{en ? `With these settings · ${periodLabel(period, language)}` : `Με αυτές τις ρυθμίσεις · ${periodLabel(period, language)}`}</span>{valid ? <IndicatorValue indicator={shown} result={result} language={language} /> : <span className="register-muted">{en ? 'Complete the settings to see its value.' : 'Συμπληρώστε τις ρυθμίσεις για να φανεί η τιμή.'}</span>}{result && result.status && result.status !== 'context' && !result.notRecorded && <StatusBadge tone={indicatorStatusTone(result.status)}>{indicatorStatusLabel(result.status, language)}</StatusBadge>}</div>
    <div className="lo-form-cards">
      <FormCard wide title={en ? 'Indicator' : 'Δείκτης'}>
        <FormGrid columns={1}>
          <Field label={`${en ? 'Title' : 'Τίτλος'} *`}><input value={indicator.title} onChange={event => set({ title: event.target.value })} /></Field>
        </FormGrid>
        <SearchableSelect label={en ? 'Calculation' : 'Υπολογισμός'} value={indicator.aggregation} options={optionsOf(aggregations, language)} onChange={value => value && set({ aggregation: value })} {...selectText(en)} clearLabel="" />
        {needsField && <SearchableSelect label={en ? 'Of field' : 'Του πεδίου'} value={indicator.field || ''} options={numeric.map(field => ({ value: field.key, label: textOf(field, language) }))} onChange={value => set({ field: value })} {...selectText(en)} />}
        {!sheet && <SearchableSelect label={en ? 'Counts in the period of' : 'Μετράει στην περίοδο της'} value={indicator.dateField || ''} options={dates.map(field => ({ value: field.key, label: textOf(field, language) }))} onChange={value => set({ dateField: value || '' })} placeholder={en ? 'The register’s date' : 'Ημερομηνίας του μητρώου'} {...selectText(en)} />}
      </FormCard>
      {sheet ? <FormCard wide title={en ? 'What is counted' : 'Τι μετράει'}>
        <ChoiceChips label={en ? 'Rows (none = all)' : 'Γραμμές (καμία = όλες)'} options={rows} selected={indicator.rows || []} onToggle={value => set({ rows: (indicator.rows || []).includes(value) ? indicator.rows!.filter((item: string) => item !== value) : [...(indicator.rows || []), value] })} />
        {measures.length > 1 && <SearchableSelect label={en ? 'Measure (empty = all)' : 'Στήλη (κενό = όλες)'} value={indicator.measure || ''} options={measures} onChange={value => set({ measure: value || '' })} {...selectText(en)} />}
        {indicator.aggregation === 'percent' && <ChoiceChips label={en ? 'Out of rows (none = all)' : 'Επί των γραμμών (καμία = όλες)'} options={rows} selected={indicator.denominatorRows || []} onToggle={value => set({ denominatorRows: (indicator.denominatorRows || []).includes(value) ? indicator.denominatorRows!.filter((item: string) => item !== value) : [...(indicator.denominatorRows || []), value] })} />}
        {['mean', 'count'].includes(indicator.aggregation) && <YesNoField label={en ? 'Only from the daily sheets' : 'Μόνο από τα ημερήσια φύλλα'} value={Boolean(indicator.dailyOnly)} onChange={value => set({ dailyOnly: value })} hint={en ? 'Months recorded as a single total are left out.' : 'Οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.'} />}
      </FormCard> : <FormCard wide title={en ? 'Which cases' : 'Ποια περιστατικά'} hint={en ? 'No condition = every case of the period.' : 'Χωρίς συνθήκη = όλα τα περιστατικά της περιόδου.'}>
        <FilterRows register={register} filters={indicator.filters || []} language={language} onChange={filters => set({ filters })} />
        {['percent', 'rate', 'smr'].includes(indicator.aggregation) && <><h5 className="register-builder-subtitle">{indicator.aggregation === 'rate' ? (en ? 'Days counted among' : 'Ημέρες από τα περιστατικά με') : (en ? 'Out of cases with' : 'Επί των περιστατικών με')}</h5><FilterRows register={register} filters={indicator.denominatorFilters || []} language={language} onChange={denominatorFilters => set({ denominatorFilters })} /></>}
        {indicator.aggregation === 'rate' && <FormGrid columns={2}><SearchableSelect label={en ? 'Days field' : 'Πεδίο ημερών'} value={indicator.denominatorField || ''} options={numeric.map(field => ({ value: field.key, label: textOf(field, language) }))} onChange={value => set({ denominatorField: value })} {...selectText(en)} /><Field label={en ? 'Per' : 'Ανά'}><input inputMode="numeric" value={indicator.multiplier ?? 1000} onChange={event => set({ multiplier: Number(event.target.value) || 1000 })} /></Field></FormGrid>}
      </FormCard>}
      <FormCard wide title={en ? 'Target' : 'Στόχος'} hint={en ? 'Past the limit the indicator turns red and Quality is asked to open a corrective action.' : 'Πέρα από το όριο ο δείκτης γίνεται κόκκινος και προτείνεται διορθωτική ενέργεια.'}>
        <ChoiceField label={en ? 'Better when' : 'Καλύτερα όταν'} value={indicator.direction || 'context'} options={[{ value: 'lower', label: en ? 'Lower' : 'Χαμηλότερο' }, { value: 'higher', label: en ? 'Higher' : 'Υψηλότερο' }, { value: 'context', label: en ? 'No target' : 'Χωρίς στόχο' }]} onChange={value => set({ direction: value })} />
        {indicator.direction !== 'context' && <FormGrid columns={3}>
          <Field label={en ? 'Target' : 'Στόχος'}><input inputMode="decimal" value={indicator.target ?? ''} onChange={event => set({ target: event.target.value === '' ? '' : Number(event.target.value.replace(',', '.')) })} /></Field>
          <Field label={en ? 'Limit' : 'Όριο'}><input inputMode="decimal" value={indicator.threshold ?? ''} onChange={event => set({ threshold: event.target.value === '' ? '' : Number(event.target.value.replace(',', '.')) })} /></Field>
          {indicator.aggregation !== 'percent' && <Field label={en ? 'Unit' : 'Μονάδα'}><input value={indicator.unit || ''} onChange={event => set({ unit: event.target.value })} /></Field>}
        </FormGrid>}
        <Field label={en ? 'Note' : 'Σημείωση'}><input value={indicator.note || ''} onChange={event => set({ note: event.target.value })} /></Field>
      </FormCard>
    </div>
  </EditorPanel>
}
