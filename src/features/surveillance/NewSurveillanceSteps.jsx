// The patient choice and start step of the new-surveillance flow (NewSurveillanceFlow
// keeps their state). Assessment, samples and isolation are recorded later in the
// episode's journey (ClinicalJourney).
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'

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
      <div className="entry-mode-switch">
        <button
          type="button"
          className={patientMode === 'existing' ? 'active' : ''}
          onClick={() => {
            setPatientMode('existing')
            setCreatedPatient(null)
            setSelectedPatientId('')
          }}
        >
          {t('existingPatient')}
        </button>
        <button
          type="button"
          className={patientMode === 'new' ? 'active' : ''}
          onClick={() => {
            setPatientMode('new')
            setCreatedPatient(null)
            setSelectedPatientId('')
          }}
        >
          {t('newPatient')}
        </button>
      </div>
      {patientMode === 'existing' && (
        <label>
          <span>{t('patient')}</span>
          <select value={selectedPatientId} onChange={e => chooseExistingPatient(e.target.value)}>
            <option value="">{t('clinicalRecords.selectPatient')}</option>
            {patients
              .filter(x => x.status === 'active')
              .map(item => (
                <option key={item.id} value={item.id}>
                  {language === 'el' ? item.name : item.nameEn || item.name} · {item.id}
                </option>
              ))}
          </select>
        </label>
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

export function StartStep({
  busy,
  cancelFlow,
  contextDepartment,
  language,
  patientMode,
  saveStart,
  selectedPatient,
  setStart,
  startDraft,
  t,
}) {
  return (
    <section className="flow-step-panel">
      <div className="entry-grid">
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
      <div className="flow-step-actions">
        <Button variant="secondary" onClick={cancelFlow}>
          {language === 'el' ? 'Ακύρωση' : 'Cancel'}
        </Button>
        <Button
          disabled={
            busy ||
            !startDraft.startedAt ||
            !(startDraft.reason || startDraft.reasonEn) ||
            (patientMode === 'existing' && !selectedPatient)
          }
          onClick={saveStart}
        >
          {busy
            ? language === 'el'
              ? 'Αποθήκευση…'
              : 'Saving…'
            : language === 'el'
              ? 'Έναρξη επιτήρησης'
              : 'Start surveillance'}
        </Button>
      </div>
    </section>
  )
}
