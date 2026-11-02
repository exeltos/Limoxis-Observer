import { useMemo, useState } from 'react'
import { UserPlus, UserRound } from 'lucide-react'
import { ObserverDialog } from '../../../../design-system/ObserverDialog'
import { SearchableSelect } from '../../../../design-system/SearchableSelect'
import { ModeSwitch } from '../../../../design-system/ModeSwitch'
import { Field } from '../../../../design-system/Field'
import { FieldLabelText, FormSubmit, useFormValidation } from '../../../../design-system/FormValidation'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { EODY_CATALOGUE, EODY_FOOTNOTES, deadlineWords, eodyEntry, eodyLabel } from '../../../reporting/eodyCatalogue'
import { suggestPatientCode } from '../../../patients/patientsService'

// «Νέα δήλωση νοσήματος»: one window like every other form. The disease is one searchable list of
// the 57 ΕΟΔΥ diseases, each with its deadline under it; its notes show once it is chosen.
// With `patients` (the laboratory) the window also asks for the patient, an existing one or a
// new one (last name, first name, code); from a patient's record the patient is already known.
// onSave({ entry, patient }) for an existing patient, onSave({ entry, newPatient }) for a new one.
export function NewNotificationDialog({ patients = null, busy = false, onSave, onClose }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const [diseaseId, setDiseaseId] = useState('')
  const [mode, setMode] = useState('')
  const [patientId, setPatientId] = useState('')
  const [draft, setDraft] = useState({ lastName: '', firstName: '', patientCode: '' })
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const askPatient = Array.isArray(patients)
  const entry = diseaseId ? eodyEntry(diseaseId) : null
  const diseaseOptions = useMemo(
    () => EODY_CATALOGUE.map(item => ({ value: item.id, label: eodyLabel(item, language), description: deadlineWords(item.deadline, language), keywords: `${item.el} ${item.en}` })),
    [language],
  )
  const patientOptions = (patients || []).map(patient => ({ value: patient.id, label: en ? patient.nameEn || patient.name : patient.name, description: [patient.id, en ? patient.departmentEn || patient.department : patient.department].filter(Boolean).join(' · ') }))
  const form = useFormValidation([
    { key: 'disease', label: t('labNotifiable.colDisease'), valid: Boolean(entry) },
    askPatient && { key: 'mode', label: t('labNotifiable.patientTitle'), valid: Boolean(mode) },
    askPatient && mode === 'existing' && { key: 'patientId', label: t('patient'), valid: Boolean(patientId) },
    askPatient && mode === 'new' && { key: 'lastName', label: t('labNotifiable.lastName'), valid: Boolean(draft.lastName.trim()) },
    askPatient && mode === 'new' && { key: 'firstName', label: t('labNotifiable.firstName'), valid: Boolean(draft.firstName.trim()) },
    askPatient && mode === 'new' && { key: 'patientCode', label: t('labNotifiable.patientCode'), valid: Boolean(draft.patientCode.trim()) },
  ])
  function chooseMode(value) {
    setMode(value)
    if (value === 'new' && !draft.patientCode) set('patientCode', suggestPatientCode(patients || []))
  }
  function save() {
    if (!askPatient) return onSave({ entry })
    if (mode === 'existing') return onSave({ entry, patient: patients.find(item => item.id === patientId) })
    return onSave({ entry, newPatient: { lastName: draft.lastName.trim(), firstName: draft.firstName.trim(), patientCode: draft.patientCode.trim() } })
  }
  return (
    <ObserverDialog width="standard" title={t('episodeForms.notifiable.pickerTitle')} subtitle={t('episodeForms.notifiable.pickerSubtitle')} onClose={onClose}
      footer={<FormSubmit form={form} disabled={busy} onSubmit={save}>{t('labNotifiable.create')}</FormSubmit>}>
      <div className="episode-form-fields notifiable-new" ref={form.scopeRef}>
        <SearchableSelect label={t('labNotifiable.colDisease')} {...form.field('disease')} value={diseaseId} onChange={value => setDiseaseId(value || '')} options={diseaseOptions}
          placeholder={t('episodeForms.notifiable.pickerSearch')} emptyLabel={t('episodeForms.notifiable.pickerNone')} clearLabel="" />
        {entry?.notes.length > 0 && <p className="field-hint">{entry.notes.map(note => EODY_FOOTNOTES[note][en ? 'en' : 'el']).join(' ')}</p>}
        {askPatient && (
          <div className="field notifiable-new-mode" data-field-key="mode">
            <span className="field-label lo-field-label"><FieldLabelText label={t('patient')} required /></span>
            <ModeSwitch ariaLabel={t('labNotifiable.patientTitle')} value={mode} onChange={chooseMode} options={[{ value: 'existing', label: t('existingPatient'), icon: UserRound }, { value: 'new', label: t('laboratoryRecords.newPatientInline'), icon: UserPlus }]} />
            {form.errorFor('mode') && <span className="field-error">{form.errorFor('mode')}</span>}
          </div>
        )}
        {askPatient && mode === 'existing' && (
          <SearchableSelect label={t('patient')} {...form.field('patientId')} value={patientId} onChange={value => setPatientId(value || '')} options={patientOptions} placeholder={t('surveillanceList.patientSearchPlaceholder')} emptyLabel={t('surveillanceList.noPatientsFound')} clearLabel={t('surveillanceList.clearSelection')} />
        )}
        {askPatient && mode === 'new' && (
          <div className="entry-grid notifiable-new-patient">
            <Field label={t('labNotifiable.lastName')} {...form.field('lastName')}><input value={draft.lastName} onChange={event => set('lastName', event.target.value)} /></Field>
            <Field label={t('labNotifiable.firstName')} {...form.field('firstName')}><input value={draft.firstName} onChange={event => set('firstName', event.target.value)} /></Field>
            <Field label={t('labNotifiable.patientCode')} {...form.field('patientCode')}><input value={draft.patientCode} onChange={event => set('patientCode', event.target.value)} /></Field>
          </div>
        )}
      </div>
    </ObserverDialog>
  )
}
