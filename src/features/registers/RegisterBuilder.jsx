import { useEffect, useMemo, useState } from 'react'
import { Archive, ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { FormCard, FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { YesNoField } from '../../design-system/YesNoField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { IconButton } from '../../design-system/IconButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { AGGREGATIONS, COMPUTED_KINDS, FIELD_TYPES, FILTER_OPS, filterText, keyFrom, optionLabel, optionsOf, textOf } from './registerEngine'
import { saveRegister } from './registerService'
import { registerStatusLabel } from './registerText'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const move = (list, index, step) => { const next = [...list]; const target = index + step; if (target < 0 || target >= next.length) return list; [next[index], next[target]] = [next[target], next[index]]; return next }

// The definition of a register, edited by Quality: sections and fields (case)
// or rows and measures (sheet), and the indicators. Each new field becomes a
// column of the register's table; a field taken out is archived with its data.
// A saved field keeps its key and type, so the data already recorded keeps its meaning.
export function RegisterBuilder({ register, canEdit, entryCount, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { user, profile } = useAuth()
  const { tenant } = useTenant()
  const [draft, setDraft] = useState(() => structuredClone(register))
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  useEffect(() => setDraft(structuredClone(register)), [register])
  const savedKeys = useMemo(() => new Set(register.fields.map(field => field.key)), [register])
  const dirty = JSON.stringify(draft) !== JSON.stringify(register)
  const patch = next => setDraft(current => ({ ...current, ...next }))
  const setSettings = next => setDraft(current => ({ ...current, settings: { ...current.settings, ...next } }))
  const sections = draft.settings?.sections?.length ? draft.settings.sections : [{ key: 'main', label: en ? 'Details' : 'Στοιχεία', labelEn: 'Details' }]
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
  function upsertField(field, previousKey) {
    setDraft(current => {
      const exists = current.fields.some(item => item.key === previousKey)
      const fields = exists ? current.fields.map(item => (item.key === previousKey ? field : item)) : [...current.fields, field]
      const breakdowns = new Set(current.settings?.breakdowns || [])
      if (field.breakdown) breakdowns.add(field.key); else breakdowns.delete(field.key)
      const { breakdown, ...clean } = field // eslint-disable-line no-unused-vars
      return { ...current, fields: fields.map(item => (item.key === field.key ? clean : item)), settings: { ...current.settings, breakdowns: [...breakdowns] } }
    })
    setEditing(null)
  }
  function upsertIndicator(indicator, previousId) {
    setDraft(current => ({ ...current, indicators: current.indicators.some(item => item.id === previousId) ? current.indicators.map(item => (item.id === previousId ? indicator : item)) : [...current.indicators, indicator] }))
    setEditing(null)
  }

  return <RecordTabPanel className="register-builder" title={en ? 'Definition' : 'Ορισμός'} subtitle={canEdit ? (en ? `Version ${register.version}. Each field is a column of the register’s table; removing one keeps its data.` : `Έκδοση ${register.version}. Κάθε πεδίο είναι στήλη του πίνακα του μητρώου· όταν αφαιρείται, τα δεδομένα του μένουν.`) : (en ? 'Defined by the Quality team.' : 'Ορίζεται από την Ομάδα Ποιότητας.')}
    footer={canEdit && <div className="inline-edit-footer">{dirty && <span className="register-form-errors">{en ? 'Unsaved changes' : 'Μη αποθηκευμένες αλλαγές'}</span>}<Button variant="secondary" disabled={!dirty || saving} onClick={() => setDraft(structuredClone(register))}>{en ? 'Undo changes' : 'Αναίρεση αλλαγών'}</Button><SaveButton loading={saving} disabled={!dirty || saving} onClick={save}>{en ? 'Save definition' : 'Αποθήκευση ορισμού'}</SaveButton></div>}>
    <div className="lo-form-cards register-builder-cards">
      <FormCard title={en ? 'Register' : 'Μητρώο'}>
        <FormGrid columns={2}>
          <Field label={en ? 'Name' : 'Όνομα'}><input value={draft.name} disabled={!canEdit} onChange={event => patch({ name: event.target.value })} /></Field>
          <Field label={en ? 'Name in English' : 'Όνομα στα αγγλικά'}><input value={draft.nameEn} disabled={!canEdit} onChange={event => patch({ nameEn: event.target.value })} /></Field>
        </FormGrid>
        <ChoiceField label={en ? 'Status' : 'Κατάσταση'} value={draft.status} options={['active', 'draft', 'archived'].map(value => ({ value, label: registerStatusLabel(value, language) }))} onChange={value => canEdit && patch({ status: value })} />
        {draft.kind === 'case' && <SearchableSelect label={en ? 'Date a case counts on' : 'Ημερομηνία που μετράει το περιστατικό'} value={draft.settings?.entryDateField || ''} disabled={!canEdit} options={dateFields.map(field => ({ value: field.key, label: textOf(field, language) }))} onChange={value => setSettings({ entryDateField: value || '' })} {...selectText(en)} />}
        {draft.kind === 'case' && <FormGrid columns={2}>
          <YesNoField label={en ? 'Case number' : 'Αριθμός περιστατικού'} value={Boolean(draft.settings?.identity?.caseNumber)} onChange={value => canEdit && setSettings({ identity: { ...(draft.settings?.identity || {}), caseNumber: value } })} hint={en ? 'Kept in the identity table.' : 'Στον πίνακα ταυτότητας.'} />
          <YesNoField label={en ? 'Patient name' : 'Ονοματεπώνυμο'} value={Boolean(draft.settings?.identity?.patientName)} onChange={value => canEdit && setSettings({ identity: { ...(draft.settings?.identity || {}), patientName: value } })} hint={en ? 'Seen only inside the department.' : 'Το βλέπει μόνο το τμήμα.'} />
        </FormGrid>}
      </FormCard>

      {draft.kind === 'case' && <FormCard wide title={en ? `Fields ${draft.fields.length}` : `Πεδία ${draft.fields.length}`} hint={entryCount ? (en ? `${entryCount} entries recorded: a saved field keeps its type.` : `${entryCount} καταχωρίσεις: ένα αποθηκευμένο πεδίο κρατά τον τύπο του.`) : ''}>
        {sections.map(section => {
          const fields = draft.fields.filter(field => (field.section || sections[0].key) === section.key || (!sections.some(item => item.key === field.section) && section === sections[0]))
          return <div key={section.key} className="register-builder-section">
            <div className="register-builder-section-head"><input aria-label={en ? 'Section name' : 'Όνομα ενότητας'} value={textOf(section, language)} disabled={!canEdit} onChange={event => setSettings({ sections: sections.map(item => (item.key === section.key ? { ...item, [en ? 'labelEn' : 'label']: event.target.value } : item)) })} />{canEdit && <Button variant="secondary" onClick={() => setEditing({ kind: 'field', field: { key: '', section: section.key, type: 'number', label: '', labelEn: '' }, previousKey: null })}><Plus size={15} />{en ? 'Field' : 'Πεδίο'}</Button>}</div>
            <ul className="register-builder-list">{fields.map(field => {
              const index = draft.fields.indexOf(field)
              return <li key={field.key}>
                <span><strong>{textOf(field, language)}</strong><small>{[optionLabel(FIELD_TYPES, field.type, language), en ? field.unitEn || field.unit : field.unit, field.required && (en ? 'required' : 'υποχρεωτικό'), field.options?.length && `${field.options.length} ${en ? 'values' : 'τιμές'}`, field.provisional && (en ? 'list to complete' : 'λίστα προς συμπλήρωση')].filter(Boolean).join(' · ')}</small><code>{field.key}</code></span>
                {canEdit && <span className="register-builder-tools"><IconButton size="sm" label={en ? 'Up' : 'Πάνω'} onClick={() => patch({ fields: move(draft.fields, index, -1) })}><ArrowUp size={14} /></IconButton><IconButton size="sm" label={en ? 'Down' : 'Κάτω'} onClick={() => patch({ fields: move(draft.fields, index, 1) })}><ArrowDown size={14} /></IconButton><IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setEditing({ kind: 'field', field: { ...field, breakdown: (draft.settings?.breakdowns || []).includes(field.key) }, previousKey: field.key })}><Pencil size={14} /></IconButton><IconButton size="sm" label={en ? 'Remove (data kept)' : 'Αφαίρεση (τα δεδομένα μένουν)'} onClick={() => patch({ fields: draft.fields.filter(item => item !== field) })}><Archive size={14} /></IconButton></span>}
              </li>
            })}</ul>
          </div>
        })}
        {canEdit && <Button variant="secondary" onClick={() => { const label = en ? 'New section' : 'Νέα ενότητα'; setSettings({ sections: [...sections, { key: keyFrom(`section ${sections.length + 1}`, sections.map(item => item.key)), label, labelEn: label }] }) }}><Plus size={15} />{en ? 'Section' : 'Ενότητα'}</Button>}
      </FormCard>}

      {draft.kind === 'sheet' && <FormCard wide title={en ? 'Sheet' : 'Φύλλο'} hint={en ? 'Rows are what is counted (procedures); measures are the columns (number, shift). Each row × measure is a column of the table.' : 'Γραμμές: τι μετράται (πράξεις). Στήλες: τα μέτρα (αριθμός, βάρδια). Κάθε γραμμή × στήλη είναι στήλη του πίνακα.'}>
        <AxisEditor title={en ? 'Rows' : 'Γραμμές'} items={draft.sheet.rows} canEdit={canEdit} language={language} groups={draft.sheet.groups || []} onChange={rows => patch({ sheet: { ...draft.sheet, rows } })} />
        <AxisEditor title={en ? 'Measures' : 'Στήλες'} items={draft.sheet.measures} canEdit={canEdit} language={language} onChange={measures => patch({ sheet: { ...draft.sheet, measures } })} />
      </FormCard>}

      <FormCard wide title={en ? `Indicators ${draft.indicators.length}` : `Δείκτες ${draft.indicators.length}`}>
        <ul className="register-builder-list">{draft.indicators.map((indicator, index) => <li key={indicator.id}>
          <span><strong>{textOf(indicator, language)}</strong><small>{[optionLabel(AGGREGATIONS, indicator.aggregation, language), indicator.field && textOf(draft.fields.find(field => field.key === indicator.field), language), ...(indicator.filters || []).map(filter => filterText(draft, filter, language)), indicator.target != null && indicator.target !== '' && `${en ? 'target' : 'στόχος'} ${indicator.direction === 'higher' ? '≥' : '≤'} ${indicator.target}`].filter(Boolean).join(' · ')}</small></span>
          {canEdit && <span className="register-builder-tools"><IconButton size="sm" label={en ? 'Up' : 'Πάνω'} onClick={() => patch({ indicators: move(draft.indicators, index, -1) })}><ArrowUp size={14} /></IconButton><IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => setEditing({ kind: 'indicator', indicator, previousId: indicator.id })}><Pencil size={14} /></IconButton><IconButton size="sm" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => patch({ indicators: draft.indicators.filter(item => item !== indicator) })}><Archive size={14} /></IconButton></span>}
        </li>)}</ul>
        {canEdit && <Button variant="secondary" onClick={() => setEditing({ kind: 'indicator', indicator: { id: '', title: '', titleEn: '', aggregation: draft.kind === 'sheet' ? 'sum' : 'count', filters: [], denominatorFilters: [], rows: [], direction: 'context' }, previousId: null })}><Plus size={15} />{en ? 'Indicator' : 'Δείκτης'}</Button>}
      </FormCard>
    </div>
    {editing?.kind === 'field' && <FieldDialog field={editing.field} register={draft} sections={sections} locked={savedKeys.has(editing.previousKey)} onCancel={() => setEditing(null)} onSave={field => upsertField(field, editing.previousKey)} />}
    {editing?.kind === 'indicator' && <IndicatorDialog indicator={editing.indicator} register={draft} onCancel={() => setEditing(null)} onSave={indicator => upsertIndicator(indicator, editing.previousId)} />}
  </RecordTabPanel>
}

function AxisEditor({ title, items = [], canEdit, language, groups, onChange }) {
  const en = language === 'en'
  const set = (index, next) => onChange(items.map((item, position) => (position === index ? { ...item, ...next } : item)))
  return <div className="register-builder-section">
    <div className="register-builder-section-head"><strong>{title}</strong>{canEdit && <Button variant="secondary" onClick={() => { const label = en ? 'New' : 'Νέα'; onChange([...items, { key: keyFrom(`row ${items.length + 1}`, items.map(item => item.key)), label, labelEn: label }]) }}><Plus size={15} />{en ? 'Add' : 'Προσθήκη'}</Button>}</div>
    <ul className="register-builder-list">{items.map((item, index) => <li key={item.key}>
      <span className="register-axis-fields"><input aria-label={title} value={item.label} disabled={!canEdit} onChange={event => set(index, { label: event.target.value, ...(item.labelEn === item.label ? { labelEn: event.target.value } : {}) })} /><input aria-label={`${title} (EN)`} value={item.labelEn || ''} disabled={!canEdit} placeholder="English" onChange={event => set(index, { labelEn: event.target.value })} />{groups?.length > 0 && <SearchableSelect hideLabel label={en ? 'Group' : 'Ομάδα'} value={item.group || ''} disabled={!canEdit} options={groups.map(group => ({ value: group.key, label: textOf(group, language) }))} onChange={value => set(index, { group: value || '' })} {...selectText(en)} />}<code>{item.key}</code></span>
      {canEdit && <span className="register-builder-tools"><IconButton size="sm" label={en ? 'Up' : 'Πάνω'} onClick={() => onChange(move(items, index, -1))}><ArrowUp size={14} /></IconButton><IconButton size="sm" label={en ? 'Remove (data kept)' : 'Αφαίρεση (τα δεδομένα μένουν)'} onClick={() => onChange(items.filter((_, position) => position !== index))}><Archive size={14} /></IconButton></span>}
    </li>)}</ul>
  </div>
}

function FieldDialog({ field: initial, register, sections, locked, onCancel, onSave }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [field, setField] = useState(() => structuredClone(initial))
  const set = next => setField(current => ({ ...current, ...next }))
  const others = register.fields.filter(item => item.key !== initial.key)
  const dates = others.filter(item => item.type === 'date')
  const isList = ['choice', 'multiChoice'].includes(field.type)
  const valid = Boolean(field.label.trim()) && (field.type !== 'computed' || (field.computed && field.from && field.to)) && (!isList || (field.options || []).length > 0 || field.provisional)
  function finish() {
    const key = locked ? field.key : field.key || keyFrom(field.labelEn || field.label, others.map(item => item.key))
    const options = isList ? (field.options || []).filter(option => option.label.trim()).map(option => ({ ...option, value: option.value || keyFrom(option.labelEn || option.label, (field.options || []).map(item => item.value).filter(Boolean)) })) : undefined
    const clean = Object.fromEntries(Object.entries({ ...field, key, options, labelEn: field.labelEn || field.label }).filter(([, value]) => value !== '' && value !== undefined && value !== null && value !== false))
    onSave(clean)
  }
  const number = (label, name) => <Field label={label}><input inputMode="decimal" value={field[name] ?? ''} onChange={event => set({ [name]: event.target.value === '' ? '' : Number(event.target.value.replace(',', '.')) })} /></Field>
  return <ObserverDialog title={initial.key ? (en ? 'Edit field' : 'Επεξεργασία πεδίου') : (en ? 'New field' : 'Νέο πεδίο')} subtitle={locked ? (en ? `Column ${field.key}: its type stays as recorded.` : `Στήλη ${field.key}: ο τύπος της μένει όπως καταγράφηκε.`) : ''} onClose={onCancel} width="wide" footer={<DialogActions onCancel={onCancel} onSave={finish} disabled={!valid} saveLabel={en ? 'Done' : 'Εντάξει'} showCancel />}>
    <div className="lo-form-cards">
      <FormCard wide title={en ? 'Field' : 'Πεδίο'}>
        <FormGrid columns={2}>
          <Field label={`${en ? 'Label' : 'Ετικέτα'} *`}><input value={field.label} onChange={event => set({ label: event.target.value })} /></Field>
          <Field label={en ? 'Label in English' : 'Ετικέτα στα αγγλικά'}><input value={field.labelEn || ''} onChange={event => set({ labelEn: event.target.value })} /></Field>
          <SearchableSelect label={en ? 'Type' : 'Τύπος'} value={field.type} disabled={locked} options={optionsOf(FIELD_TYPES, language)} onChange={value => value && set({ type: value })} {...selectText(en)} clearLabel="" />
          <SearchableSelect label={en ? 'Section' : 'Ενότητα'} value={field.section || sections[0]?.key || ''} options={sections.map(section => ({ value: section.key, label: textOf(section, language) }))} onChange={value => set({ section: value || sections[0]?.key })} {...selectText(en)} clearLabel="" />
        </FormGrid>
        <FormGrid columns={3}>
          <YesNoField label={en ? 'Required' : 'Υποχρεωτικό'} value={Boolean(field.required)} onChange={value => set({ required: value })} />
          <YesNoField label={en ? 'Column in the list' : 'Στήλη στη λίστα'} value={Boolean(field.list)} onChange={value => set({ list: value })} />
          {isList && <YesNoField label={en ? 'Split in reports' : 'Ανάλυση στις αναφορές'} value={Boolean(field.breakdown)} onChange={value => set({ breakdown: value })} />}
        </FormGrid>
        <Field label={en ? 'Help / definition' : 'Βοήθεια / ορισμός'}><input value={field.help || ''} onChange={event => set({ help: event.target.value })} /></Field>
      </FormCard>
      {['number', 'computed', 'gestation'].includes(field.type) && <FormCard wide title={en ? 'Unit and limits' : 'Μονάδα και όρια'} hint={en ? 'Outside the limits the value is refused; outside the usual range the user is asked to check.' : 'Εκτός ορίων η τιμή δεν γίνεται δεκτή· εκτός συνήθους εύρους ζητείται έλεγχος.'}>
        <FormGrid columns={2}><Field label={en ? 'Unit' : 'Μονάδα'}><input value={field.unit || ''} placeholder="g, ημέρες, %" onChange={event => set({ unit: event.target.value })} /></Field><Field label={en ? 'Unit in English' : 'Μονάδα στα αγγλικά'}><input value={field.unitEn || ''} onChange={event => set({ unitEn: event.target.value })} /></Field></FormGrid>
        {field.type !== 'computed' && <FormGrid columns={4}>{number(en ? 'Minimum' : 'Ελάχιστο', 'min')}{number(en ? 'Maximum' : 'Μέγιστο', 'max')}{number(en ? 'Usual from' : 'Σύνηθες από', 'usualMin')}{number(en ? 'Usual to' : 'Σύνηθες έως', 'usualMax')}</FormGrid>}
      </FormCard>}
      {field.type === 'computed' && <FormCard wide title={en ? 'Computed by the database' : 'Υπολογίζεται από τη βάση'}>
        <SearchableSelect label={en ? 'What' : 'Τι'} value={field.computed || ''} options={optionsOf(COMPUTED_KINDS, language)} onChange={value => set({ computed: value })} {...selectText(en)} />
        <FormGrid columns={2}>
          <SearchableSelect label={en ? 'From date' : 'Από ημερομηνία'} value={field.from || ''} options={dates.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ from: value })} {...selectText(en)} />
          <SearchableSelect label={en ? 'To date' : 'Έως ημερομηνία'} value={field.to || ''} options={dates.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ to: value })} {...selectText(en)} />
        </FormGrid>
      </FormCard>}
      {field.type === 'date' && <FormCard wide title={en ? 'Rule' : 'Κανόνας'}><SearchableSelect label={en ? 'Not before' : 'Όχι πριν από'} value={field.notBefore || ''} options={dates.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ notBefore: value || '' })} {...selectText(en)} /></FormCard>}
      {isList && <FormCard wide title={en ? 'Values' : 'Τιμές'} hint={en ? '«Import as» lists the beginnings of the old values (FileMaker) each value takes.' : 'Στο «Εισαγωγή ως» γράφετε πώς ξεκινούσε η τιμή στο FileMaker (π.χ. ΔΙΑΚΟΜΙΔΗ), χωρισμένα με κόμμα.'}>
        <ul className="register-builder-list">{(field.options || []).map((option, index) => <li key={option.value || index}><span className="register-axis-fields">
          <input aria-label={en ? 'Value' : 'Τιμή'} value={option.label} onChange={event => set({ options: field.options.map((item, position) => (position === index ? { ...item, label: event.target.value } : item)) })} />
          <input aria-label="English" placeholder="English" value={option.labelEn || ''} onChange={event => set({ options: field.options.map((item, position) => (position === index ? { ...item, labelEn: event.target.value } : item)) })} />
          <input aria-label={en ? 'Import as' : 'Εισαγωγή ως'} placeholder={en ? 'Import as' : 'Εισαγωγή ως'} value={(option.match || []).join(', ')} onChange={event => set({ options: field.options.map((item, position) => (position === index ? { ...item, match: event.target.value.split(',').map(text => text.trim()).filter(Boolean) } : item)) })} />
        </span><span className="register-builder-tools"><IconButton size="sm" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => set({ options: field.options.filter((_, position) => position !== index) })}><Archive size={14} /></IconButton></span></li>)}</ul>
        <Button variant="secondary" onClick={() => set({ options: [...(field.options || []), { value: '', label: '', labelEn: '' }] })}><Plus size={15} />{en ? 'Value' : 'Τιμή'}</Button>
      </FormCard>}
      {field.type !== 'computed' && <FormCard wide title={en ? 'Shown when' : 'Εμφανίζεται όταν'}>
        <SearchableSelect label={en ? 'Another field has a value' : 'Άλλο πεδίο έχει τιμή'} value={field.showWhen?.field || ''} options={others.filter(item => item.type !== 'computed').map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set({ showWhen: value ? { field: value } : '' })} placeholder={en ? 'Always shown' : 'Εμφανίζεται πάντα'} {...selectText(en)} />
      </FormCard>}
    </div>
  </ObserverDialog>
}

function FilterRows({ register, filters = [], onChange, language }) {
  const en = language === 'en'
  const fields = register.fields.filter(field => field.type !== 'text')
  const set = (index, next) => onChange(filters.map((filter, position) => (position === index ? { ...filter, ...next } : filter)))
  return <div className="register-filter-rows">
    {filters.map((filter, index) => {
      const field = fields.find(item => item.key === filter.field)
      return <div key={index} className="register-filter-row">
        <SearchableSelect hideLabel label={en ? 'Field' : 'Πεδίο'} value={filter.field} options={fields.map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={value => set(index, { field: value, value: undefined })} {...selectText(en)} />
        <SearchableSelect hideLabel label={en ? 'Condition' : 'Συνθήκη'} value={filter.op} options={optionsOf(FILTER_OPS, language)} onChange={value => set(index, { op: value })} {...selectText(en)} clearLabel="" />
        {filter.op === 'eq' && field?.options ? <SearchableSelect hideLabel label={en ? 'Value' : 'Τιμή'} value={filter.value || ''} options={field.options.map(option => ({ value: option.value, label: textOf(option, language) }))} onChange={value => set(index, { value })} {...selectText(en)} /> : ['gt', 'lt', 'eq'].includes(filter.op) ? <input aria-label={en ? 'Value' : 'Τιμή'} value={filter.value ?? ''} onChange={event => set(index, { value: filter.op === 'eq' ? event.target.value : Number(event.target.value) })} /> : <span />}
        <IconButton size="sm" label={en ? 'Remove' : 'Αφαίρεση'} onClick={() => onChange(filters.filter((_, position) => position !== index))}><Archive size={14} /></IconButton>
      </div>
    })}
    <Button variant="secondary" onClick={() => onChange([...filters, { field: fields[0]?.key || '', op: 'filled' }])}><Plus size={15} />{en ? 'Condition' : 'Συνθήκη'}</Button>
  </div>
}

function IndicatorDialog({ indicator: initial, register, onCancel, onSave }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [indicator, setIndicator] = useState(() => structuredClone(initial))
  const set = next => setIndicator(current => ({ ...current, ...next }))
  const sheet = register.kind === 'sheet'
  const numeric = register.fields.filter(field => ['number', 'computed', 'gestation'].includes(field.type))
  const dates = register.fields.filter(field => field.type === 'date')
  const aggregations = AGGREGATIONS.filter(item => (sheet ? ['sum', 'percent', 'mean'].includes(item.value) : true))
  const rows = (register.sheet?.rows || []).map(row => ({ value: row.key, label: textOf(row, language) }))
  const measures = (register.sheet?.measures || []).map(measure => ({ value: measure.key, label: textOf(measure, language) }))
  const needsField = !sheet && ['mean', 'median', 'sum'].includes(indicator.aggregation)
  const valid = Boolean(indicator.title.trim()) && (!needsField || indicator.field) && (sheet || indicator.aggregation !== 'rate' || indicator.denominatorField)
  function finish() {
    const id = initial.id || keyFrom(indicator.titleEn || indicator.title, register.indicators.map(item => item.id))
    const clean = Object.fromEntries(Object.entries({ ...indicator, id, titleEn: indicator.titleEn || indicator.title, unit: indicator.aggregation === 'percent' ? '%' : indicator.unit }).filter(([, value]) => value !== '' && value !== undefined && value !== null))
    onSave(clean)
  }
  return <ObserverDialog title={initial.id ? (en ? 'Edit indicator' : 'Επεξεργασία δείκτη') : (en ? 'New indicator' : 'Νέος δείκτης')} onClose={onCancel} width="wide" footer={<DialogActions onCancel={onCancel} onSave={finish} disabled={!valid} saveLabel={en ? 'Done' : 'Εντάξει'} showCancel />}>
    <div className="lo-form-cards">
      <FormCard wide title={en ? 'Indicator' : 'Δείκτης'}>
        <FormGrid columns={2}>
          <Field label={`${en ? 'Title' : 'Τίτλος'} *`}><input value={indicator.title} onChange={event => set({ title: event.target.value })} /></Field>
          <Field label={en ? 'Title in English' : 'Τίτλος στα αγγλικά'}><input value={indicator.titleEn || ''} onChange={event => set({ titleEn: event.target.value })} /></Field>
        </FormGrid>
        <SearchableSelect label={en ? 'Calculation' : 'Υπολογισμός'} value={indicator.aggregation} options={optionsOf(aggregations, language)} onChange={value => value && set({ aggregation: value })} {...selectText(en)} clearLabel="" />
        {needsField && <SearchableSelect label={en ? 'Of field' : 'Του πεδίου'} value={indicator.field || ''} options={numeric.map(field => ({ value: field.key, label: textOf(field, language) }))} onChange={value => set({ field: value })} {...selectText(en)} />}
        {!sheet && <SearchableSelect label={en ? 'Counts in the period of' : 'Μετράει στην περίοδο της'} value={indicator.dateField || ''} options={dates.map(field => ({ value: field.key, label: textOf(field, language) }))} onChange={value => set({ dateField: value || '' })} placeholder={en ? 'The register’s date' : 'Ημερομηνίας του μητρώου'} {...selectText(en)} />}
      </FormCard>
      {sheet ? <FormCard wide title={en ? 'What is counted' : 'Τι μετράει'}>
        <ChoiceChips label={en ? 'Rows (none = all)' : 'Γραμμές (καμία = όλες)'} options={rows} selected={indicator.rows || []} onToggle={value => set({ rows: (indicator.rows || []).includes(value) ? indicator.rows.filter(item => item !== value) : [...(indicator.rows || []), value] })} />
        {measures.length > 1 && <SearchableSelect label={en ? 'Measure (empty = all)' : 'Στήλη (κενό = όλες)'} value={indicator.measure || ''} options={measures} onChange={value => set({ measure: value || '' })} {...selectText(en)} />}
        {indicator.aggregation === 'percent' && <ChoiceChips label={en ? 'Out of rows (none = all)' : 'Επί των γραμμών (καμία = όλες)'} options={rows} selected={indicator.denominatorRows || []} onToggle={value => set({ denominatorRows: (indicator.denominatorRows || []).includes(value) ? indicator.denominatorRows.filter(item => item !== value) : [...(indicator.denominatorRows || []), value] })} />}
      </FormCard> : <FormCard wide title={en ? 'Which cases' : 'Ποια περιστατικά'} hint={en ? 'No condition = every case of the period.' : 'Χωρίς συνθήκη = όλα τα περιστατικά της περιόδου.'}>
        <FilterRows register={register} filters={indicator.filters || []} language={language} onChange={filters => set({ filters })} />
        {['percent', 'rate'].includes(indicator.aggregation) && <><h5 className="register-builder-subtitle">{indicator.aggregation === 'rate' ? (en ? 'Days counted among' : 'Ημέρες από τα περιστατικά με') : (en ? 'Out of cases with' : 'Επί των περιστατικών με')}</h5><FilterRows register={register} filters={indicator.denominatorFilters || []} language={language} onChange={denominatorFilters => set({ denominatorFilters })} /></>}
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
  </ObserverDialog>
}
