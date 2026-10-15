// The patient choice and start step of the new-surveillance flow (NewSurveillanceFlow
// keeps their state). Assessment, samples and isolation are recorded later in the
// episode's journey (ClinicalJourney).
import { UserPlus, UserSearch } from 'lucide-react'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'

export function PatientSelector({
  chooseExistingPatient,
  createdPatient,
  departmentPairs,
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
            <label>
              <span>{t('patientId')}</span>
              <input
                value={patientDraft.patientCode}
                onChange={e => setPatientField('patientCode', e.target.value)}
              />
            </label>
          )}
          <label>
            <span>{t('firstName')}</span>
            <input
              value={language === 'el' ? patientDraft.firstName : patientDraft.firstNameEn}
              onChange={e =>
                setPatientField(language === 'el' ? 'firstName' : 'firstNameEn', e.target.value)
              }
            />
          </label>
          <label>
            <span>{t('lastName')}</span>
            <input
              value={language === 'el' ? patientDraft.lastName : patientDraft.lastNameEn}
              onChange={e =>
                setPatientField(language === 'el' ? 'lastName' : 'lastNameEn', e.target.value)
              }
            />
          </label>
          <label>
            <span>{t('department')}</span>
            <select
              value={patientDraft.departmentId || patientDraft.department}
              onChange={e => setPatientDepartment(e.target.value)}
            >
              <option value="">{t('select')}</option>
              {departmentPairs.map(item => (
                <option key={item.id || item.el} value={item.id || item.el}>
                  {language === 'el' ? item.el : item.en}
                </option>
              ))}
            </select>
          </label>
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
        <span>{t('department')}</span>
        <strong>{contextDepartment || '—'}</strong>
        <small>{language === 'el' ? 'Από την ενεργή νοσηλεία' : 'From active admission'}</small>
      </div>
      <div className="flow-context-field">
        <span>{t('room')}</span>
        <strong>
          {language === 'el' ? 'Δεν έχει καταχωρηθεί στη νοσηλεία' : 'Not recorded on admission'}
        </strong>
        <small>
          {language === 'el'
            ? 'Η θέση ασθενούς δεν αλλάζει από την επιτήρηση'
            : 'Patient location is not edited from surveillance'}
        </small>
      </div>
      <label>
        <span>{t('clinicalRecords.suspectedSource')}</span>
        <select
          value={startDraft.suspectedSource}
          onChange={e => setStart('suspectedSource', e.target.value)}
        >
          <option value="">{t('underAssessment')}</option>
          <option value="bloodstream">{t('clinicalRecords.bloodstream')}</option>
          <option value="urinary">{t('clinicalRecords.urinary')}</option>
          <option value="respiratory">{t('clinicalRecords.respiratory')}</option>
          <option value="surgicalSite">{t('clinicalRecords.surgicalSite')}</option>
          <option value="other">{t('other')}</option>
        </select>
      </label>
      <label className="entry-span-2">
        <span>{t('surveillanceReason')}</span>
        <textarea
          rows={3}
          value={language === 'el' ? startDraft.reason : startDraft.reasonEn}
          onChange={e => setStart(language === 'el' ? 'reason' : 'reasonEn', e.target.value)}
        />
      </label>
    </div>
  )
}
