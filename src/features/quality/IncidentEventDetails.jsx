import { useMemo } from 'react'
import { ChoiceField } from '../../design-system/ChoiceField'
import { Field } from '../../design-system/Field'
import { FormGrid } from '../../design-system/FormCard'
import { MultiSelect } from '../../design-system/MultiSelect'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useEmployeesData } from '../employees/useEmployeesData'
import { BED_RAILS, BLUE_CODE_INTERVENTIONS, BLUE_CODE_OUTCOMES, BODY_SITES, EVENT_TYPES, FALL_TYPES, FLOOR_CONDITIONS, INJURED_PERSON_TYPES, INJURY_CATEGORIES, INJURY_SUBCATEGORIES, OBSTETRIC_SUBCATEGORIES, SHARP_TOOLS, TOOL_STATES, TRANSFER_TARGETS, detailBlock, detailBlocks, detailOptions, employeeName, incidentDetailFacts } from './incidentDetails'

// The event type of an incident and the details it records (incidentDetails.js):
// the form's fields, and what the record shows.

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const yesNoOptions = en => [{ value: 'yes', label: en ? 'Yes' : 'Ναι' }, { value: 'no', label: en ? 'No' : 'Όχι' }]
const toYesNo = value => (value === true ? 'yes' : value === false ? 'no' : '')

export function IncidentEventTypeField({ value, onChange, language }) {
  const en = language === 'en'
  return <SearchableSelect label={en ? 'Event type' : 'Είδος συμβάντος'} value={value || ''} options={detailOptions(EVENT_TYPES, language)} onChange={next => onChange(next || '')} placeholder={en ? 'Optional' : 'Προαιρετικό'} {...selectText(en)} />
}

// The fields of the blocks the record's event type records; `onChange` gets the changed record.
export function IncidentEventFields({ record, onChange, language }) {
  const en = language === 'en'
  const { data: employeeRows } = useEmployeesData()
  const employees = useMemo(() => (employeeRows || []).filter(item => item.employmentStatus !== 'inactive').map(item => ({ value: item.id, label: employeeName(item, language) })).filter(item => item.label), [employeeRows, language])
  const blocks = detailBlocks(record)
  if (!blocks.length) return null
  const block = key => detailBlock(record, key)
  const set = (key, patch) => onChange({ ...record, [key]: { ...block(key), ...patch } })
  const choice = (key, field, label, list) => <ChoiceField label={label} value={block(key)[field]} options={detailOptions(list, language)} onChange={value => set(key, { [field]: value })} />
  const select = (key, field, label, list) => <SearchableSelect label={label} value={block(key)[field] || ''} options={detailOptions(list, language)} onChange={value => set(key, { [field]: value || '' })} {...selectText(en)} />
  const input = (key, field, label) => <Field label={label}><input value={block(key)[field] || ''} onChange={event => set(key, { [field]: event.target.value })} /></Field>
  const area = (key, field, label) => <Field label={label}><textarea rows={2} value={block(key)[field] || ''} onChange={event => set(key, { [field]: event.target.value })} /></Field>
  const yesNo = (key, field, label) => <ChoiceField label={label} value={toYesNo(block(key)[field])} options={yesNoOptions(en)} onChange={value => set(key, { [field]: value === 'yes' })} />
  const fall = block('fall')
  return <div className="quality-event-details">
    {blocks.includes('fall') && <>
      <FormGrid columns={2}>
        {choice('fall', 'injuryCategory', en ? 'Injury category' : 'Κατηγορία τραυματισμού', INJURY_CATEGORIES)}
        {select('fall', 'injurySubcategory', en ? 'Subcategory' : 'Υποκατηγορία', INJURY_SUBCATEGORIES)}
        <ChoiceField label={en ? 'Who was injured' : 'Ποιος τραυματίστηκε'} value={fall.injuredPersonType} options={detailOptions(INJURED_PERSON_TYPES, language)} onChange={value => set('fall', { injuredPersonType: value, injuredEmployeeId: value === 'employee' ? fall.injuredEmployeeId : '' })} />
        {fall.injuredPersonType === 'employee' && <SearchableSelect label={en ? 'Employee' : 'Εργαζόμενος'} value={fall.injuredEmployeeId || ''} options={employees} onChange={value => set('fall', { injuredEmployeeId: value || '' })} placeholder={en ? 'Choose from the staff list' : 'Επιλογή από το προσωπικό'} {...selectText(en)} />}
      </FormGrid>
      <FormGrid columns={3}>
        {choice('fall', 'fallType', en ? 'Type of fall' : 'Είδος πτώσης', FALL_TYPES)}
        {choice('fall', 'floorCondition', en ? 'Floor' : 'Δάπεδο', FLOOR_CONDITIONS)}
        {choice('fall', 'bedRails', en ? 'Bed rails' : 'Προστατευτικά κλίνης', BED_RAILS)}
      </FormGrid>
      <FormGrid columns={2}>
        {input('fall', 'location', en ? 'Location' : 'Σημείο')}
        {yesNo('fall', 'examinedByDoctor', en ? 'Examined by a doctor' : 'Εξετάστηκε από ιατρό')}
      </FormGrid>
      {fall.examinedByDoctor === true && area('fall', 'doctorInstructions', en ? 'Doctor’s instructions' : 'Οδηγίες ιατρού')}
      {area('fall', 'injuryDescription', en ? 'The injury' : 'Περιγραφή τραυματισμού')}
    </>}
    {blocks.includes('sharp') && <>
      <FormGrid columns={2}>
        {select('sharp', 'tool', en ? 'Sharp' : 'Αιχμηρό', SHARP_TOOLS)}
        {choice('sharp', 'toolState', en ? 'It was' : 'Ήταν', TOOL_STATES)}
        {choice('sharp', 'bodySite', en ? 'Injury site' : 'Σημείο τραυματισμού', BODY_SITES)}
        {block('sharp').bodySite === 'other' && input('sharp', 'bodySiteOther', en ? 'Where' : 'Πού')}
        {input('sharp', 'firstUser', en ? 'First user of the sharp' : 'Πρώτος χρήστης του αιχμηρού')}
        {input('sharp', 'contactDuration', en ? 'Contact duration' : 'Διάρκεια επαφής')}
        {input('sharp', 'exposedBodyPart', en ? 'Exposed part' : 'Εκτεθειμένο μέρος')}
        {input('sharp', 'substance', en ? 'Substance' : 'Ουσία')}
      </FormGrid>
    </>}
    {blocks.includes('blueCode') && <>
      <FormGrid columns={2}>
        <MultiSelect label={en ? 'Interventions' : 'Παρεμβάσεις'} options={detailOptions(BLUE_CODE_INTERVENTIONS, language)} selected={block('blueCode').interventions} onChange={value => set('blueCode', { interventions: value })} placeholder={en ? 'Choose…' : 'Επιλέξτε…'} searchPlaceholder={en ? 'Search…' : 'Αναζήτηση…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} selectAllLabel={en ? 'All' : 'Όλες'} clearAllLabel={en ? 'None' : 'Καμία'} countLabel={count => (en ? `${count} interventions` : `${count} παρεμβάσεις`)} />
        {choice('blueCode', 'outcome', en ? 'Outcome' : 'Έκβαση', BLUE_CODE_OUTCOMES)}
        {select('blueCode', 'transferTo', en ? 'Transfer to' : 'Μεταφορά σε', TRANSFER_TARGETS)}
        {input('blueCode', 'patientStatus', en ? 'Patient status' : 'Κατάσταση ασθενούς')}
        {input('blueCode', 'doctor', en ? 'Doctor' : 'Ιατρός')}
        {input('blueCode', 'nurse', en ? 'Nurse' : 'Νοσηλευτής/τρια')}
        {yesNo('blueCode', 'gloves', en ? 'Gloves worn' : 'Χρήση γαντιών')}
      </FormGrid>
      {area('blueCode', 'staffInvolved', en ? 'Staff involved' : 'Εμπλεκόμενο προσωπικό')}
    </>}
    {blocks.includes('obstetric') && select('obstetric', 'subcategory', en ? 'Obstetric subcategory' : 'Υποκατηγορία μαιευτικού συμβάντος', OBSTETRIC_SUBCATEGORIES)}
  </div>
}

// What the record shows: the event type and the details filled in.
export function IncidentEventSummary({ record, language }) {
  const { data: employeeRows } = useEmployeesData()
  const facts = incidentDetailFacts(record, language, employeeRows || [])
  return <RecordDetailsGrid className="quality-event-summary" fields={facts.map(([label, value]) => ({ label, value }))} />
}
