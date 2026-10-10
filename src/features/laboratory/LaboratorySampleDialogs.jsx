import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { organismsOf, resultDraftChecks, resultToSave } from './laboratorySampleProgress'
import { METHODS, rows } from './laboratorySampleFormat'

// Dialogs of the laboratory sample record: result, AST, AMR classification and
// critical-result communication.

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
  const [draft, setDraft] = useState(() => makeDraft(result)),
    [choice, setChoice] = useState('')
  const options = rows(libraries, 'microorganisms', language)
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }))
  const add = () => {
    if (choice && !draft.organisms.includes(choice)) {
      set('organisms', [...draft.organisms, choice])
      setChoice('')
    }
  }
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
      eyebrow={t('laboratoryRecords.microbiologyResult')}
      title={title}
      subtitle={tx('resultHelp')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
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
        <label>
          <span>{t('result')} *</span>
          <select value={draft.result} onChange={e => set('result', e.target.value)}>
            <option value="">{t('select')}</option>
            <option value="negative">{t('negative')}</option>
            <option value="positive">{t('positive')}</option>
            <option value="inconclusive">{t('inconclusive')}</option>
            <option value="contaminated">{t('contaminated')}</option>
          </select>
        </label>
        <label>
          <span>{tx('method')}</span>
          <select value={draft.method} onChange={e => set('method', e.target.value)}>
            <option value="">{t('select')}</option>
            {METHODS.map(([value, el, en]) => (
              <option key={value} value={value}>
                {language === 'el' ? el : en}
              </option>
            ))}
          </select>
        </label>
        {draft.result === 'positive' && (
          <div className="lab-dialog-span">
            <span className="lab-dialog-label">{tx('organisms')} *</span>
            <div className="lab-organism-picker">
              <select value={choice} onChange={e => setChoice(e.target.value)}>
                <option value="">{tx('chooseOrganism')}</option>
                {options
                  .filter(x => !draft.organisms.includes(x.value))
                  .map(x => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
              </select>
              <Button type="button" variant="secondary" disabled={!choice} onClick={add}>
                + {t('clinicalRecords.add')}
              </Button>
            </div>
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
          <label>
            <span>{tx('cfu')}</span>
            <input
              inputMode="decimal"
              value={draft.cfuCount}
              onChange={e => set('cfuCount', e.target.value)}
            />
          </label>
        )}
        <label className="lab-dialog-check lab-dialog-span">
          <input
            type="checkbox"
            checked={draft.critical}
            onChange={e => set('critical', e.target.checked)}
          />
          <span>{tx('critical')}</span>
        </label>
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
  const options = rows(libraries, 'antibiotics', language),
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
    const item = options.find(x => x.value === value)
    setDraft(d => ({ ...d, drug: value, code: item?.code || '' }))
  }
  return (
    <ObserverDialog
      width="standard"
      eyebrow={tx('organism')}
      title={tx('astTitle')}
      subtitle={draft.organism}
      onClose={onClose}
      footer={
        <DialogActions
          showCancel
          onCancel={onClose}
          onSave={() => onSave(draft)}
          disabled={!draft.organism || !draft.drug || !draft.version}
        />
      }
    >
      <div className="lab-dialog-form">
        <label>
          <span>{tx('organism')} *</span>
          <select value={draft.organism} onChange={e => set('organism', e.target.value)}>
            {organisms.map(x => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{tx('antibiotic')} *</span>
          <select value={draft.drug} onChange={e => choose(e.target.value)}>
            <option value="">{tx('chooseAntibiotic')}</option>
            {options.map(x => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <div className="lab-dialog-span">
          <span className="lab-dialog-label">S/I/R *</span>
          <div className="lab-sir-toggle" role="radiogroup">
            {['S', 'I', 'R'].map(value => (
              <button
                type="button"
                key={value}
                role="radio"
                aria-checked={draft.sir === value}
                className={`sir-${value.toLowerCase()} ${draft.sir === value ? 'is-selected' : ''}`}
                onClick={() => set('sir', value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span>MIC</span>
          <input value={draft.mic} onChange={e => set('mic', e.target.value)} />
        </label>
        <label>
          <span>{tx('method')}</span>
          <input value={draft.method} onChange={e => set('method', e.target.value)} />
        </label>
        <label>
          <span>{tx('standard')}</span>
          <input value={draft.standard} onChange={e => set('standard', e.target.value)} />
        </label>
        <label>
          <span>{tx('version')} *</span>
          <input value={draft.version} onChange={e => set('version', e.target.value)} />
        </label>
        <label className="lab-dialog-span">
          <span>{tx('notes')}</span>
          <input value={draft.notes} onChange={e => set('notes', e.target.value)} />
        </label>
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
          showCancel
          onCancel={onClose}
          onSave={() => onSave({ ...draft, organism })}
          disabled={!draft.classification || !draft.definitionSource || !draft.definitionVersion}
        />
      }
    >
      <div className="lab-dialog-form">
        <label className="lab-dialog-span">
          <span>{tx('classification')} *</span>
          <select
            value={draft.classification}
            onChange={e => set('classification', e.target.value)}
          >
            <option value="">{language === 'el' ? 'Επιλέξτε' : 'Select'}</option>
            <option value="MDR">
              MDR – {language === 'el' ? 'Πολυανθεκτικό' : 'Multidrug-resistant'}
            </option>
            <option value="XDR">
              XDR – {language === 'el' ? 'Εκτεταμένα ανθεκτικό' : 'Extensively drug-resistant'}
            </option>
            <option value="PDR">
              PDR – {language === 'el' ? 'Παν-ανθεκτικό' : 'Pandrug-resistant'}
            </option>
          </select>
        </label>
        <label>
          <span>{tx('definitionSource')} *</span>
          <input
            value={draft.definitionSource}
            onChange={e => set('definitionSource', e.target.value)}
          />
        </label>
        <label>
          <span>{tx('definitionVersion')} *</span>
          <input
            value={draft.definitionVersion}
            onChange={e => set('definitionVersion', e.target.value)}
          />
        </label>
        <label className="lab-dialog-span">
          <span>{tx('rationale')}</span>
          <textarea
            rows={3}
            value={draft.rationale}
            onChange={e => set('rationale', e.target.value)}
          />
        </label>
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
          showCancel
          onCancel={onClose}
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
        <label>
          <span>{tx('recipient')} *</span>
          <input value={draft.recipientName} onChange={e => set('recipientName', e.target.value)} />
        </label>
        <label>
          <span>{tx('role')} *</span>
          <input value={draft.recipientRole} onChange={e => set('recipientRole', e.target.value)} />
        </label>
        <label>
          <span>{tx('department')}</span>
          <input
            value={draft.recipientDepartment}
            onChange={e => set('recipientDepartment', e.target.value)}
          />
        </label>
        <label>
          <span>{tx('channel')}</span>
          <select value={draft.method} onChange={e => set('method', e.target.value)}>
            <option value="phone">{language === 'el' ? 'Τηλεφωνικά' : 'Phone'}</option>
            <option value="in_person">
              {language === 'el' ? 'Προφορικά / διά ζώσης' : 'In person'}
            </option>
            <option value="secure_message">
              {language === 'el' ? 'Ασφαλές ηλεκτρονικό μήνυμα' : 'Secure message'}
            </option>
            <option value="other">{language === 'el' ? 'Άλλος' : 'Other'}</option>
          </select>
        </label>
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
        <label className="lab-dialog-check lab-dialog-span">
          <input
            type="checkbox"
            checked={draft.readBack}
            onChange={e => set('readBack', e.target.checked)}
          />
          <span>{tx('readBack')}</span>
        </label>
        <label className="lab-dialog-span">
          <span>{tx('notes')}</span>
          <textarea rows={3} value={draft.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </div>
    </ObserverDialog>
  )
}
