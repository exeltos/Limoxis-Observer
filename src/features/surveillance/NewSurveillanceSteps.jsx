// The patient choice and start step of the new-surveillance flow (NewSurveillanceFlow
// keeps their state). Assessment, samples and isolation are recorded later in the
// episode's journey (ClinicalJourney).
import { UserPlus, UserSearch } from 'lucide-react'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { Field } from '../../design-system/Field'
import { departmentOptions, listTexts, suspectedSourceOptions } from './surveillanceOptions'

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
  t,
}) {
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
            <Field label={t('patientId')}>
              <input
                value={patientDraft.patientCode}
                onChange={e => setPatientField('patientCode', e.target.value)}
              />
            </Field>
          )}
          <Field label={t('firstName')}>
            <input
              value={language === 'el' ? patientDraft.firstName : patientDraft.firstNameEn}
              onChange={e =>
                setPatientField(language === 'el' ? 'firstName' : 'firstNameEn', e.target.value)
              }
            />
          </Field>
          <Field label={t('lastName')}>
            <input
              value={language === 'el' ? patientDraft.lastName : patientDraft.lastNameEn}
              onChange={e =>
                setPatientField(language === 'el' ? 'lastName' : 'lastNameEn', e.target.value)
              }
            />
          </Field>
          <SearchableSelect
            label={t('department')}
            value={patientDraft.departmentId || patientDraft.department}
            options={departmentOptions(departments, language)}
            placeholder={t('select')}
            emptyLabel={listTexts(language).emptyLabel}
            clearLabel={listTexts(language).clearLabel}
            onChange={setPatientDepartment}
          />
          <ManualDateField
            label={t('admissionDate')}
            value={patientDraft.admissionDate}
            onChange={v => setPatientField('admissionDate', v)}
          />
        </div>
      )}
    </div>
  )
}

export function StartStep({ contextDepartment, language, setStart, startDraft, t }) {
  return (
    <div className="entry-grid surveillance-start-fields">
      <ManualDateField
        label={t('surveillanceStartDate')}
        value={startDraft.startedAt}
        onChange={v => setStart('startedAt', v)}
      />
      <ManualDateField
        label={t('nextReview')}
        optional
        value={startDraft.reviewDue}
        onChange={v => setStart('reviewDue', v)}
      />
      <div className="flow-context-field">
        <span className="lo-field-label">{t('department')}</span>
        <strong>{contextDepartment || '—'}</strong>
        <small>{language === 'el' ? 'Από την ενεργή νοσηλεία' : 'From active admission'}</small>
      </div>
      <div className="flow-context-field">
        <span className="lo-field-label">{t('room')}</span>
        <strong>
          {language === 'el' ? 'Δεν έχει καταχωρηθεί στη νοσηλεία' : 'Not recorded on admission'}
        </strong>
        <small>
          {language === 'el'
            ? 'Η θέση ασθενούς δεν αλλάζει από την επιτήρηση'
            : 'Patient location is not edited from surveillance'}
        </small>
      </div>
      <SearchableSelect
        label={t('clinicalRecords.suspectedSource')}
        value={startDraft.suspectedSource}
        options={suspectedSourceOptions(t)}
        placeholder={t('underAssessment')}
        emptyLabel={listTexts(language).emptyLabel}
        clearLabel={listTexts(language).clearLabel}
        onChange={v => setStart('suspectedSource', v)}
      />
      <label className="field entry-span-2">
        <span className="lo-field-label">{t('surveillanceReason')}</span>
        <textarea
          rows={3}
          value={language === 'el' ? startDraft.reason : startDraft.reasonEn}
          onChange={e => setStart(language === 'el' ? 'reason' : 'reasonEn', e.target.value)}
        />
      </label>
    </div>
  )
}
