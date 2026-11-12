// The patient choice and start step of the new-surveillance flow (NewSurveillanceFlow
// keeps their state). Assessment, samples and isolation are recorded later in the
// episode's journey (ClinicalJourney).
import { UserPlus, UserSearch } from 'lucide-react'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { Field } from '../../design-system/Field'
import { ReadOnlyField } from '../../design-system/ReadOnlyField'
import { departmentOptions, listTexts, suspectedSourceOptions } from './surveillanceOptions'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler, Setter } from './surveillanceTypes'
import type { ReactNode } from 'react'

interface PatientSelectorProps {
  chooseExistingPatient: Handler
  createdPatient: AnyRecord | null
  departments: AnyRecord[]
  isDemo: boolean
  language: string
  patientDraft: AnyRecord
  patientMode: string
  patients: AnyRecord[]
  selectedPatientId: string
  setCreatedPatient: Setter<AnyRecord | null>
  setPatientDepartment: (value: string) => void
  setPatientField: (key: string, value: unknown) => void
  setPatientMode: Setter<string>
  setSelectedPatientId: Setter<string>
  form: AnyRecord
  t: (key: string) => string
}
export function PatientSelector({
  chooseExistingPatient,
  createdPatient,
  departments,
  isDemo,
  language,
  patientDraft,
  patientMode,
  patients,
  selectedPatientId,
  setCreatedPatient,
  setPatientDepartment,
  setPatientField,
  setPatientMode,
  setSelectedPatientId,
  form,
  t,
}: PatientSelectorProps) {
  return (
    <div className="flow-patient-selector surveillance-patient-entry">
      <ModeSwitch
        ariaLabel={t('patient')}
        value={patientMode}
        onChange={mode => {
          setPatientMode(mode)
          setCreatedPatient(null)
          setSelectedPatientId('')
        }}
        options={[
          { value: 'existing', label: t('existingPatient'), icon: UserSearch },
          { value: 'new', label: t('newPatient'), icon: UserPlus },
        ]}
      />
      {patientMode === 'existing' && (
        <SearchableSelect
          label={t('patient')}
          {...form?.field('patient')}
          value={selectedPatientId}
          onChange={chooseExistingPatient}
          placeholder={t('surveillanceList.patientSearchPlaceholder')}
          emptyLabel={t('surveillanceList.noPatientsFound')}
          clearLabel={t('surveillanceList.clearSelection')}
          options={patients
            .filter(x => x.status === 'active')
            .map(item => ({
              value: item.id,
              label: `${language === 'el' ? item.name : item.nameEn || item.name} · ${item.id}`,
              description: language === 'el' ? item.department : item.departmentEn,
              keywords: [item.name, item.nameEn, item.patientCode].filter(Boolean).join(' '),
            }))}
        />
      )}
      {patientMode === 'new' && !createdPatient && (
        <div className="entry-grid inline-patient-create">
          {!isDemo && (
            <Field label={t('patientId')} {...form?.field('patientCode')}>
              <input
                value={patientDraft.patientCode}
                onChange={e => setPatientField('patientCode', e.target.value)}
              />
            </Field>
          )}
          <Field label={t('firstName')} {...form?.field('firstName')}>
            <input
              value={language === 'el' ? patientDraft.firstName : patientDraft.firstNameEn}
              onChange={e =>
                setPatientField(language === 'el' ? 'firstName' : 'firstNameEn', e.target.value)
              }
            />
          </Field>
          <Field label={t('lastName')} {...form?.field('lastName')}>
            <input
              value={language === 'el' ? patientDraft.lastName : patientDraft.lastNameEn}
              onChange={e =>
                setPatientField(language === 'el' ? 'lastName' : 'lastNameEn', e.target.value)
              }
            />
          </Field>
          <SearchableSelect
            label={t('department')}
            {...form?.field('patientDepartment')}
            value={patientDraft.departmentId || patientDraft.department}
            options={departmentOptions(departments, language)}
            placeholder={t('select')}
            emptyLabel={listTexts(language).emptyLabel}
            clearLabel={listTexts(language).clearLabel}
            onChange={setPatientDepartment}
          />
          <ManualDateField
            label={t('admissionDate')}
            {...form?.field('admissionDate')}
            value={patientDraft.admissionDate}
            onChange={v => setPatientField('admissionDate', v)}
          />
        </div>
      )}
    </div>
  )
}

interface StartStepProps {
  contextDepartment: ReactNode
  language: string
  setStart: (key: string, value: unknown) => void
  startDraft: AnyRecord
  form: AnyRecord
  t: (key: string) => string
}
export function StartStep({ contextDepartment, language, setStart, startDraft, form, t }: StartStepProps) {
  return (
    <div className="entry-grid surveillance-start-fields">
      <ManualDateField
        label={t('surveillanceStartDate')}
        {...form?.field('startedAt')}
        value={startDraft.startedAt}
        onChange={v => setStart('startedAt', v)}
      />
      <ManualDateField
        label={t('nextReview')}
        optional
        value={startDraft.reviewDue}
        onChange={v => setStart('reviewDue', v)}
      />
      {/* Read-only context, as tall as the inputs beside it; the helper line goes under it. */}
      <ReadOnlyField
        label={t('department')}
        value={contextDepartment}
        hint={language === 'el' ? 'Από την ενεργή νοσηλεία' : 'From active admission'}
      />
      <ReadOnlyField
        label={t('room')}
        value={language === 'el' ? 'Δεν έχει καταχωρηθεί στη νοσηλεία' : 'Not recorded on admission'}
        hint={
          language === 'el'
            ? 'Η θέση ασθενούς δεν αλλάζει από την επιτήρηση'
            : 'Patient location is not edited from surveillance'
        }
      />
      <SearchableSelect
        label={t('clinicalRecords.suspectedSource')}
        value={startDraft.suspectedSource}
        options={suspectedSourceOptions(t)}
        placeholder={t('underAssessment')}
        emptyLabel={listTexts(language).emptyLabel}
        clearLabel={listTexts(language).clearLabel}
        onChange={v => setStart('suspectedSource', v)}
      />
      <Field className="entry-span-2" label={t('surveillanceReason')} {...form?.field('reason')}>
        <textarea
          rows={3}
          value={language === 'el' ? startDraft.reason : startDraft.reasonEn}
          onChange={e => setStart(language === 'el' ? 'reason' : 'reasonEn', e.target.value)}
        />
      </Field>
    </div>
  )
}
