// The steps of the new-surveillance flow (NewSurveillanceFlow keeps their state).
import { useState } from 'react'
import { CheckCircle2, FlaskConical, Plus } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { libraryValue, sampleSourceOptions, screeningQuestions } from './newSurveillanceOptions'

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

export function AssessmentStep({
  addLibraryEntry,
  assessmentDraft,
  busy,
  language,
  newRisk,
  newSymptom,
  riskRows,
  saveAssessment,
  setActiveStep,
  setAssessment,
  setNewRisk,
  setNewSymptom,
  setScreening,
  symptomRows,
  t,
  toggle,
}) {
  return (
    <section className="flow-step-panel">
      <div className="flow-step-heading">
        <div>
          <span>02</span>
          <h3>{t('clinicalAssessment')}</h3>
        </div>
        <p>
          {language === 'el'
            ? 'Τα σημεία/συμπτώματα και οι παράγοντες κινδύνου προέρχονται από τη Βιβλιοθήκη του νοσοκομείου.'
            : 'Signs/symptoms and risk factors are loaded from the hospital Library.'}
        </p>
      </div>
      <ManualDateField
        label={t('assessmentDate')}
        value={assessmentDraft.date}
        onChange={v => setAssessment('date', v)}
      />
      <div className="clinical-check-grid library-clinical-grid">
        <LibraryChecklist
          title={t('signsSymptoms')}
          rows={symptomRows}
          selected={assessmentDraft.symptoms}
          onToggle={value => toggle('symptoms', value)}
          language={language}
        />
        <LibraryChecklist
          title={t('riskFactors')}
          rows={riskRows}
          selected={assessmentDraft.risks}
          onToggle={value => toggle('risks', value)}
          language={language}
        />
      </div>
      <div className="custom-clinical-add library-add-row">
        <label>
          <span>
            {language === 'el'
              ? 'Προσθήκη σημείου / συμπτώματος στη Βιβλιοθήκη'
              : 'Add sign / symptom to Library'}
          </span>
          <div>
            <input
              value={newSymptom}
              onChange={e => setNewSymptom(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addLibraryEntry('clinicalSymptoms', newSymptom, setNewSymptom, 'symptoms')
                }
              }}
            />
            <button
              type="button"
              onClick={() =>
                void addLibraryEntry('clinicalSymptoms', newSymptom, setNewSymptom, 'symptoms')
              }
            >
              <Plus size={14} />
            </button>
          </div>
        </label>
        <label>
          <span>
            {language === 'el'
              ? 'Προσθήκη παράγοντα κινδύνου στη Βιβλιοθήκη'
              : 'Add risk factor to Library'}
          </span>
          <div>
            <input
              value={newRisk}
              onChange={e => setNewRisk(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addLibraryEntry('clinicalRiskFactors', newRisk, setNewRisk, 'risks')
                }
              }}
            />
            <button
              type="button"
              onClick={() =>
                void addLibraryEntry('clinicalRiskFactors', newRisk, setNewRisk, 'risks')
              }
            >
              <Plus size={14} />
            </button>
          </div>
        </label>
      </div>
      <details className="secondary-risk-screen">
        <summary>
          {language === 'el' ? 'Επιπλέον έλεγχος παραγόντων κινδύνου' : 'Additional risk screening'}
        </summary>
        <section className="screening-questionnaire">
          <div className="questionnaire-grid">
            {screeningQuestions.map(q => (
              <div key={q.id} className="questionnaire-item">
                <span>{t(q.label)}</span>
                <select
                  value={assessmentDraft.screening[q.id]}
                  onChange={e => setScreening(q.id, e.target.value)}
                >
                  <option value="unknown">{t('unknown')}</option>
                  <option value="yes">{t('yes')}</option>
                  <option value="no">{t('no')}</option>
                </select>
              </div>
            ))}
          </div>
        </section>
      </details>
      <label className="assessment-summary">
        <span>
          {t('clinicalSummary')} <em>{t('optional')}</em>
        </span>
        <textarea
          rows={3}
          value={language === 'el' ? assessmentDraft.summary : assessmentDraft.summaryEn}
          onChange={e => setAssessment(language === 'el' ? 'summary' : 'summaryEn', e.target.value)}
        />
      </label>
      <label className="assessment-summary">
        <span>{t('notes')}</span>
        <textarea
          rows={2}
          value={language === 'el' ? assessmentDraft.notes : assessmentDraft.notesEn}
          onChange={e => setAssessment(language === 'el' ? 'notes' : 'notesEn', e.target.value)}
        />
      </label>
      <div className="flow-step-actions">
        <Button variant="secondary" onClick={() => setActiveStep('start')}>
          {t('clinicalRecords.previous')}
        </Button>
        <Button disabled={busy || !assessmentDraft.date} onClick={saveAssessment}>
          {busy ? (language === 'el' ? 'Αποθήκευση…' : 'Saving…') : t('saveAndContinue')}
        </Button>
      </div>
    </section>
  )
}

export function MicrobiologyStep({
  alreadyHasSample,
  busy,
  continueWithoutSample,
  language,
  linkedLabSamples,
  requestSample,
  sampleDraft,
  setActiveStep,
  setSample,
  setSampleDraft,
  t,
}) {
  return (
    <section className="flow-step-panel">
      <div className="flow-step-heading">
        <div>
          <span>03</span>
          <h3>{t('sampleAndLaboratory')}</h3>
        </div>
        <p>
          {alreadyHasSample
            ? language === 'el'
              ? 'Η επιτήρηση έχει ήδη συνδεδεμένο δείγμα. Δεν απαιτείται νέα καταχώρηση· συνεχίστε στο επόμενο βήμα.'
              : 'This surveillance already has a linked sample. No duplicate entry is required; continue to the next step.'
            : language === 'el'
              ? 'Μπορείτε να προσθέσετε νέο δείγμα ή να συνεχίσετε χωρίς νέο δείγμα.'
              : 'Add a new sample or continue without a new sample.'}
        </p>
      </div>
      <div className="sample-request-card">
        {!alreadyHasSample && (
          <div className="entry-grid">
            <label>
              <span>{t('sampleType')}</span>
              <select
                value={sampleDraft.type}
                onChange={e => {
                  const type = e.target.value,
                    first = (sampleSourceOptions[type] || [])[0]?.[0] || ''
                  setSampleDraft(d => ({
                    ...d,
                    type,
                    source: first,
                    sourceEn: first,
                    anatomicalSite: '',
                  }))
                }}
              >
                <option value="bloodCulture">{t('bloodCulture')}</option>
                <option value="urineCulture">{t('urineCulture')}</option>
                <option value="respiratorySample">{t('respiratorySample')}</option>
                <option value="woundCulture">{t('woundCulture')}</option>
              </select>
            </label>
            <label>
              <span>{t('collectionSource')}</span>
              <select
                value={sampleDraft.source}
                onChange={e => setSample('source', e.target.value)}
              >
                {(sampleSourceOptions[sampleDraft.type] || []).map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('anatomicalSite')}</span>
              <input
                value={sampleDraft.anatomicalSite}
                onChange={e => setSample('anatomicalSite', e.target.value)}
              />
            </label>
            <ManualDateField
              label={t('clinicalRecords.sampleDate')}
              value={sampleDraft.collectedAt}
              onChange={v => setSample('collectedAt', v)}
            />
            <label>
              <span>{t('priority')}</span>
              <select
                value={sampleDraft.priority}
                onChange={e => setSample('priority', e.target.value)}
              >
                <option value="routine">{t('routine')}</option>
                <option value="urgent">{t('urgent')}</option>
                <option value="critical">{t('critical')}</option>
              </select>
            </label>
          </div>
        )}
        <div className="flow-step-actions">
          <Button variant="secondary" onClick={() => setActiveStep('assessment')}>
            {t('clinicalRecords.previous')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={continueWithoutSample}>
            {alreadyHasSample
              ? language === 'el'
                ? 'Συνέχεια'
                : 'Continue'
              : language === 'el'
                ? 'Συνέχεια χωρίς νέο δείγμα'
                : 'Continue without new sample'}
          </Button>
          {!alreadyHasSample && (
            <Button
              disabled={busy || !sampleDraft.type || !sampleDraft.source}
              onClick={requestSample}
            >
              <FlaskConical size={15} />
              {busy
                ? language === 'el'
                  ? 'Αποθήκευση…'
                  : 'Saving…'
                : t('clinicalRecords.saveAndNotifyLaboratory')}
            </Button>
          )}
        </div>
      </div>
      <div className="linked-lab-list">
        {linkedLabSamples.length ? (
          linkedLabSamples.map(x => (
            <div key={x.id} className={`linked-lab-row ${x.organism ? 'validated' : ''}`}>
              <div>
                <strong>{x.id}</strong>
                <span>
                  {t(x.type)} · {t(x.status)}
                </span>
              </div>
              <div>
                {x.organism ? <b>{x.organism}</b> : <span>{t('waitingForLaboratory')}</span>}
              </div>
            </div>
          ))
        ) : (
          <div className="workflow-empty-step">
            <strong>{t('clinicalRecords.noSampleRequested')}</strong>
            <span>
              {language === 'el'
                ? 'Δεν απαιτείται υποχρεωτικά νέο δείγμα.'
                : 'A new sample is not mandatory.'}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

export function IsolationStep({
  busy,
  isolationDraft,
  isolationNeeded,
  language,
  saveIsolation,
  setActiveStep,
  setIsolation,
  setIsolationNeeded,
  t,
}) {
  return (
    <section className="flow-step-panel isolation-decision-step">
      <div className="flow-step-heading">
        <div>
          <span>04</span>
          <h3>{t('isolation')}</h3>
        </div>
        <p>{t('clinicalRecords.preventiveIsolationHelp')}</p>
      </div>
      <div className={`isolation-question ${isolationNeeded === null ? 'required-decision' : ''}`}>
        <strong>{t('isIsolationRequired')}</strong>
        <span>
          {isolationNeeded === null ? t('isolationDecisionRequired') : t('isIsolationRequiredHelp')}
        </span>
        <div>
          <button
            type="button"
            className={isolationNeeded === true ? 'selected yes' : ''}
            onClick={() => setIsolationNeeded(true)}
          >
            {t('yes')}
          </button>
          <button
            type="button"
            className={isolationNeeded === false ? 'selected no' : ''}
            onClick={() => setIsolationNeeded(false)}
          >
            {t('no')}
          </button>
        </div>
      </div>
      {isolationNeeded === true && (
        <div className="entry-grid isolation-fields">
          <ManualDateField
            label={t('isolationStart')}
            value={isolationDraft.startedAt}
            onChange={v => setIsolation('startedAt', v)}
          />
          <label>
            <span>{t('precautionType')}</span>
            <select
              value={isolationDraft.precautionType}
              onChange={e => setIsolation('precautionType', e.target.value)}
            >
              <option value="contact">{t('contactPrecautions')}</option>
              <option value="droplet">{t('dropletPrecautions')}</option>
              <option value="airborne">{t('airbornePrecautions')}</option>
              <option value="protective">{t('protectiveIsolation')}</option>
              <option value="other">{t('other')}</option>
            </select>
          </label>
          <label className="entry-span-2">
            <span>{t('isolationReason')}</span>
            <textarea
              rows={3}
              value={language === 'el' ? isolationDraft.reason : isolationDraft.reasonEn}
              onChange={e =>
                setIsolation(language === 'el' ? 'reason' : 'reasonEn', e.target.value)
              }
            />
          </label>
        </div>
      )}
      {isolationNeeded === false && (
        <div className="no-isolation-note">
          <CheckCircle2 size={16} />
          <span>{t('noIsolationDecisionHint')}</span>
        </div>
      )}
      <div className="flow-step-actions">
        <Button variant="secondary" onClick={() => setActiveStep('microbiology')}>
          {t('clinicalRecords.previous')}
        </Button>
        <SaveButton
          disabled={
            busy ||
            isolationNeeded === null ||
            (isolationNeeded === true && !isolationDraft.startedAt)
          }
          onClick={saveIsolation}
        >
          {busy ? (language === 'el' ? 'Αποθήκευση…' : 'Saving…') : t('save')}
        </SaveButton>
      </div>
    </section>
  )
}

function LibraryChecklist({ title, rows, selected, onToggle, language }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedRows = rows.filter(row => selected.includes(libraryValue(row)))
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = rows.filter(row => {
    const label = language === 'el' ? row[0] || row[1] : row[1] || row[0]
    return (
      !normalizedQuery ||
      String(label || '')
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    )
  })
  const summary = selectedRows.length
    ? `${selectedRows.length} ${language === 'el' ? 'επιλεγμένα' : 'selected'}`
    : language === 'el'
      ? 'Επιλέξτε από τη λίστα'
      : 'Select from list'
  return (
    <section className="clinical-checklist library-checklist clinical-library-multiselect">
      <h4>{title}</h4>
      <button
        type="button"
        className="clinical-library-trigger"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span>{summary}</span>
        <span className={open ? 'open' : ''} aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className="clinical-library-menu">
          <input
            className="clinical-library-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={language === 'el' ? 'Αναζήτηση...' : 'Search...'}
            autoFocus
          />
          <div className="clinical-library-options">
            {filtered.map(row => {
              const value = libraryValue(row)
              const label = language === 'el' ? row[0] || row[1] : row[1] || row[0]
              return (
                <label key={value} className={selected.includes(value) ? 'selected' : ''}>
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={() => onToggle(value)}
                  />
                  <span>{label}</span>
                </label>
              )
            })}
            {!filtered.length && (
              <div className="clinical-library-empty">
                {language === 'el' ? 'Δεν βρέθηκαν επιλογές' : 'No options found'}
              </div>
            )}
          </div>
        </div>
      )}
      {selectedRows.length > 0 && (
        <div className="clinical-library-selected">
          {selectedRows.map(row => {
            const value = libraryValue(row)
            const label = language === 'el' ? row[0] || row[1] : row[1] || row[0]
            return (
              <button
                type="button"
                key={value}
                onClick={() => onToggle(value)}
                title={language === 'el' ? 'Αφαίρεση' : 'Remove'}
              >
                {label}
                <span aria-hidden="true">×</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
