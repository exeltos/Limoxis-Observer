import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { MultiSelect } from '../../design-system/MultiSelect'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { TimeField } from '../../design-system/TimeField'
import { YesNoField } from '../../design-system/YesNoField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { findLibraryItem, libraryOptions } from '../management/useLibraries'
import { organismsOf, resultDraftChecks, resultToSave } from './laboratorySampleProgress'
import { AMR_CLASSES, COMMUNICATION_CHANNELS, METHODS, RESULT_VALUES } from './laboratorySampleFormat'
import { referenceOptions } from './laboratoryReferenceData'

// Dialogs of the laboratory sample record: result, AST, AMR classification and
// critical-result communication.

// A titled choice of two to four exclusive answers (result, S/I/R, AMR class,
// priority): the shared mode switch with the field title, as tall as the
// other controls of the row (the yes/no field's geometry).
function makeDraft(result) {
  return {
    id: result?.id || null,
    result: result?.result || '',
    organisms: organismsOf(result),
    critical: Boolean(result?.critical),
    method: result?.method || '',
    interpretationStandard: result?.interpretationStandard || 'EUCAST',
    interpretationVersion: result?.interpretationVersion || '',
    cfuCount: result?.cfuCount ?? '',
  }
}

export function ResultDialog({
  t,
  tx,
  language,
  result,
  isEnvironmental,
  standard,
  libraries,
  canValidate,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() => makeDraft(result))
  const library = libraryOptions(libraries?.microorganisms, language)
  // Organisms recorded earlier that the library no longer lists stay choosable.
  const options = [
    ...library,
    ...draft.organisms
      .filter(name => !library.some(x => x.value === name))
      .map(name => ({ value: name, label: name })),
  ]
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }))
  const remove = name =>
    set(
      'organisms',
      draft.organisms.filter(x => x !== name),
    )
  const save = status => onSave(resultToSave(draft, status, { isEnvironmental, standard }))
  const { complete, needsOrganism } = resultDraftChecks(draft, isEnvironmental)
  const title = isEnvironmental
    ? t('laboratoryRecords.environmentalResult')
    : t('laboratoryRecords.resultAndOrganism')
  return (
    <ObserverDialog
      width="standard"
      fixedHeight
      className="lab-result-dialog"
      eyebrow={t('laboratoryRecords.microbiologyResult')}
      title={title}
      subtitle={tx('resultHelp')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={!complete} onClick={() => save('draft')}>
            {tx('saveDraft')}
          </Button>
          {canValidate && (
            <Button disabled={!complete || needsOrganism} onClick={() => save('validated')}>
              <CheckCircle2 size={15} />
              {tx('validate')}
            </Button>
          )}
        </>
      }
    >
      <div className="lab-dialog-form">
        <ChoiceField
          className="lab-dialog-span"
          label={`${t('result')} *`}
          value={draft.result}
          onChange={value => set('result', value)}
          options={RESULT_VALUES.map(value => ({ value, label: t(value) }))}
        />
        <SearchableSelect
          label={tx('method')}
          value={draft.method}
          onChange={value => set('method', value)}
          options={referenceOptions(METHODS, language)}
          placeholder={t('select')}
          clearLabel={t('surveillanceList.clearSelection')}
        />
        <YesNoField
          label={tx('critical')}
          value={draft.critical}
          onChange={value => set('critical', value)}
        />
        {draft.result === 'positive' && (
          <div className="lab-dialog-span">
            <MultiSelect
              label={`${tx('organisms')} *`}
              options={options}
              selected={draft.organisms}
              onChange={next => set('organisms', next)}
              placeholder={tx('chooseOrganism')}
              searchPlaceholder={language === 'el' ? 'Αναζήτηση μικροοργανισμού…' : 'Search organism…'}
              emptyLabel={language === 'el' ? 'Καμία αντιστοιχία' : 'No match'}
              countLabel={n => `${n} ${tx('organisms').toLocaleLowerCase(language)}`}
            />
            {draft.organisms.length > 0 && (
              <div className="lab-organism-chips">
                {draft.organisms.map(name => (
                  <span className="lab-organism-chip" key={name}>
                    {name}
                    <button type="button" onClick={() => remove(name)} aria-label={t('delete')}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {needsOrganism && <small className="lab-dialog-hint">{tx('organismRequired')}</small>}
          </div>
        )}
        {isEnvironmental && draft.result === 'positive' && (
          <Field label={tx('cfu')}>
            <input
              inputMode="decimal"
              value={draft.cfuCount}
              onChange={e => set('cfuCount', e.target.value)}
            />
          </Field>
        )}
      </div>
    </ObserverDialog>
  )
}

export function AstDialog({
  tx,
  language,
  libraries,
  organisms,
  initialOrganism,
  onClose,
  onSave,
}) {
  const antibiotics = libraries?.antibiotics || [],
    [draft, setDraft] = useState({
      organism: initialOrganism || organisms[0] || '',
      drug: '',
      code: '',
      method: 'MIC',
      sir: 'S',
      standard: 'EUCAST',
      version: '',
      mic: '',
      notes: '',
    })
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }))
  const choose = value => {
    const item = findLibraryItem(antibiotics, value)
    setDraft(d => ({ ...d, drug: value, code: (value && item?.code) || '' }))
  }
  const noMatch = language === 'el' ? 'Καμία αντιστοιχία' : 'No match'
  return (
    <ObserverDialog
      width="standard"
      eyebrow={tx('organism')}
      title={tx('astTitle')}
      subtitle={draft.organism}
      onClose={onClose}
      footer={
        <DialogActions
          onSave={() => onSave(draft)}
          disabled={!draft.organism || !draft.drug || !draft.version}
        />
      }
    >
      <div className="lab-dialog-form">
        <SearchableSelect
          label={`${tx('organism')} *`}
          value={draft.organism}
          onChange={value => value && set('organism', value)}
          options={organisms.map(x => ({ value: x, label: x }))}
          emptyLabel={noMatch}
        />
        <SearchableSelect
          label={`${tx('antibiotic')} *`}
          value={draft.drug}
          onChange={choose}
          options={libraryOptions(antibiotics, language)}
          placeholder={tx('chooseAntibiotic')}
          emptyLabel={noMatch}
          clearLabel={language === 'el' ? 'Καθαρισμός' : 'Clear'}
        />
        <ChoiceField
          className="lab-dialog-span lab-sir-choice"
          label="S/I/R *"
          value={draft.sir}
          onChange={value => set('sir', value)}
          options={['S', 'I', 'R'].map(value => ({ value, label: value }))}
        />
        <Field label="MIC">
          <input value={draft.mic} onChange={e => set('mic', e.target.value)} />
        </Field>
        <Field label={tx('method')}>
          <input value={draft.method} onChange={e => set('method', e.target.value)} />
        </Field>
        <Field label={tx('standard')}>
          <input value={draft.standard} onChange={e => set('standard', e.target.value)} />
        </Field>
        <Field label={`${tx('version')} *`}>
          <input value={draft.version} onChange={e => set('version', e.target.value)} />
        </Field>
        <div className="lab-dialog-span">
          <Field label={tx('notes')}>
            <input value={draft.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>
      </div>
    </ObserverDialog>
  )
}

export function AmrDialog({ tx, language, organism, initialClassification = '', onClose, onSave }) {
  const [draft, setDraft] = useState({
    classification: initialClassification,
    definitionSource: 'Magiorakos et al.',
    definitionVersion: '2012',
    rationale: '',
  })
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }))
  return (
    <ObserverDialog
      width="standard"
      eyebrow={tx('organism')}
      title={tx('amrTitle')}
      subtitle={organism}
      onClose={onClose}
      footer={
        <DialogActions
          onSave={() => onSave({ ...draft, organism })}
          disabled={!draft.classification || !draft.definitionSource || !draft.definitionVersion}
        />
      }
    >
      <div className="lab-dialog-form">
        <ChoiceField
          className="lab-dialog-span"
          label={`${tx('classification')} *`}
          value={draft.classification}
          onChange={value => set('classification', value)}
          options={AMR_CLASSES.map(item => ({
            value: item.id,
            label: language === 'el' ? item.el : item.en,
          }))}
        />
        <Field label={`${tx('definitionSource')} *`}>
          <input
            value={draft.definitionSource}
            onChange={e => set('definitionSource', e.target.value)}
          />
        </Field>
        <Field label={`${tx('definitionVersion')} *`}>
          <input
            value={draft.definitionVersion}
            onChange={e => set('definitionVersion', e.target.value)}
          />
        </Field>
        <div className="lab-dialog-span">
          <Field label={tx('rationale')}>
            <textarea
              rows={3}
              value={draft.rationale}
              onChange={e => set('rationale', e.target.value)}
            />
          </Field>
        </div>
      </div>
    </ObserverDialog>
  )
}

export function CommunicationDialog({ tx, onClose, onSave }) {
  const { language } = useLanguage()
  const now = new Date(),
    localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [draft, setDraft] = useState({
    recipientName: '',
    recipientRole: '',
    recipientDepartment: '',
    method: 'phone',
    readBack: true,
    communicatedDate: localDate,
    communicatedTime: now.toTimeString().slice(0, 5),
    notes: '',
  })
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }))
  return (
    <ObserverDialog
      width="standard"
      eyebrow={tx('critical')}
      title={tx('communicationTitle')}
      onClose={onClose}
      footer={
        <DialogActions
          onSave={() =>
            onSave({
              ...draft,
              at: `${draft.communicatedDate}T${draft.communicatedTime || '00:00'}`,
            })
          }
          disabled={!draft.recipientName || !draft.recipientRole || !draft.communicatedDate}
        />
      }
    >
      <div className="lab-dialog-form">
        <Field label={`${tx('recipient')} *`}>
          <input value={draft.recipientName} onChange={e => set('recipientName', e.target.value)} />
        </Field>
        <Field label={`${tx('role')} *`}>
          <input value={draft.recipientRole} onChange={e => set('recipientRole', e.target.value)} />
        </Field>
        <Field label={tx('department')}>
          <input
            value={draft.recipientDepartment}
            onChange={e => set('recipientDepartment', e.target.value)}
          />
        </Field>
        <SearchableSelect
          label={tx('channel')}
          value={draft.method}
          onChange={value => value && set('method', value)}
          options={referenceOptions(COMMUNICATION_CHANNELS, language)}
          emptyLabel={language === 'el' ? 'Καμία αντιστοιχία' : 'No match'}
        />
        <ManualDateField
          label={`${tx('date')} *`}
          value={draft.communicatedDate}
          onChange={v => set('communicatedDate', v)}
        />
        <TimeField
          label={tx('time')}
          value={draft.communicatedTime}
          onChange={v => set('communicatedTime', v)}
        />
        <YesNoField
          label={tx('readBack')}
          value={draft.readBack}
          onChange={value => set('readBack', value)}
          className="lab-dialog-span"
        />
        <div className="lab-dialog-span">
          <Field label={tx('notes')}>
            <textarea rows={3} value={draft.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>
      </div>
    </ObserverDialog>
  )
}
