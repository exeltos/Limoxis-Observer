import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'
import { RegistryTable } from '../../design-system/RegistryTable'
import { CheckboxField } from '../../design-system/CheckboxField'
import { Field } from '../../design-system/Field'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/systemRoleMatrix'
import { EPI_QUESTION_COUNT, EPI_CORE_KEYS, applyEpiSettings, epiDefinitionVersion, epiText } from '../surveillance/epiQuestionnaire/epiQuestionnaireModel'
import { fill } from '../surveillance/epiQuestionnaire/epiQuestionnaireText'
import { loadEpiSettings, saveEpiSetting } from '../surveillance/epiQuestionnaire/epiQuestionnaireService'
import '../surveillance/epiQuestionnaire/epiQuestionnaire.css'

// «Λίστες & ρυθμίσεις › Ερωτηματολόγια»: the system questionnaire of the surveillance. The wording,
// help text, time window and on / off are the hospital's; only the hospital administrator (and the
// Platform Owner) changes them (the database enforces it). A change raises the version and applies
// to new answers only; the three core questions are never switched off.
const PREFILL_SOURCES = { therapy: 'therapy', icu: 'icu', admission: 'admission', devices: 'devices' }
const canEditSettings = role => role === ROLES.PLATFORM_OWNER || role === ROLES.HOSPITAL_ADMIN

// The row of the questionnaires registry (the panel adds it above the hospital's own).
export function EpiQuestionnaireRegistryCells({ version }) {
  const { t } = useLanguage()
  return (
    <>
      <td>
        <strong>{t('epiQuestionnaire.name')}</strong>
        <small className="epi-sub">{fill(t('epiQuestionnaire.settings.subtitle'), { version })}</small>
      </td>
      <td>{t('epiQuestionnaire.settings.category')}</td>
      <td>{fill(t('epiQuestionnaire.settings.count'), { n: EPI_QUESTION_COUNT, core: EPI_CORE_KEYS.length })}</td>
      <td>
        <span className="status-badge active">{t('active')}</span> <span className="epi-lock"><Lock size={12} aria-hidden="true" />{t('epiQuestionnaire.settings.system')}</span>
      </td>
    </>
  )
}

export function useEpiSettings() {
  const { tenant, isDemo } = useTenant()
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    loadEpiSettings(tenant?.id, { isDemo })
      .catch(() => [])
      .then(rows => {
        if (alive) {
          setSettings(rows)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [tenant?.id, isDemo])
  return { settings, setSettings, loading, version: epiDefinitionVersion(settings) }
}

function WordingDialog({ question, setting, nextVersion, onClose, onSave }) {
  const { t } = useLanguage()
  const [draft, setDraft] = useState({
    labelEl: setting?.labelEl || question.label.el,
    labelEn: setting?.labelEn || question.label.en,
    helpEl: setting?.helpEl || '',
    helpEn: setting?.helpEn || '',
    windowDays: question.windowDays == null ? '' : String(question.windowDays),
  })
  const set = key => event => setDraft(current => ({ ...current, [key]: event.target.value }))
  const days = draft.windowDays === '' ? null : Number(draft.windowDays)
  const valid = draft.labelEl.trim() && draft.labelEn.trim() && (days === null || (Number.isInteger(days) && days > 0))
  const number = question.index + 1
  return (
    <ObserverDialog
      width="standard"
      eyebrow={fill(t(question.core ? 'epiQuestionnaire.settings.eyebrowCore' : 'epiQuestionnaire.settings.eyebrow'), { n: number })}
      title={t('epiQuestionnaire.settings.dialogTitle')}
      onClose={onClose}
      footer={
        <>
          <p className="epi-q-summary" role="status">{fill(t('epiQuestionnaire.settings.effect'), { version: nextVersion })}</p>
          <DialogActions onSave={() => onSave({ ...draft, windowDays: days })} disabled={!valid} />
        </>
      }
    >
      <div className="epi-fields">
        <Field label={t('epiQuestionnaire.settings.labelEl')} required>
          <input value={draft.labelEl} onChange={set('labelEl')} />
        </Field>
        <Field label={t('epiQuestionnaire.settings.labelEn')} required>
          <input value={draft.labelEn} onChange={set('labelEn')} />
        </Field>
        <Field label={t('epiQuestionnaire.settings.helpEl')}>
          <input value={draft.helpEl} onChange={set('helpEl')} />
        </Field>
        <Field label={t('epiQuestionnaire.settings.helpEn')}>
          <input value={draft.helpEn} onChange={set('helpEn')} />
        </Field>
        <Field label={t('epiQuestionnaire.settings.windowDays')}>
          <input inputMode="numeric" value={draft.windowDays} onChange={set('windowDays')} />
        </Field>
      </div>
    </ObserverDialog>
  )
}

export function EpiQuestionnaireSettings({ onBack }) {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const { tenant, isDemo, role } = useTenant()
  const { settings, setSettings, version } = useEpiSettings()
  const [editing, setEditing] = useState(null)
  const canEdit = canEditSettings(role)
  const rows = useMemo(() => applyEpiSettings(settings).map((question, index) => ({ ...question, index })), [settings])
  const windowWords = days => (days == null ? t('epiQuestionnaire.settings.anytime') : days === 2 ? fill(t('epiQuestionnaire.settings.hours'), { n: 48 }) : fill(t('epiQuestionnaire.settings.days'), { n: days }))
  async function persist(question, patch) {
    const current = settings.find(row => row.questionKey === question.key) || null
    try {
      const saved = await saveEpiSetting(tenant?.id, question.key, patch, current, { isDemo })
      setSettings(list => [...list.filter(row => row.questionKey !== question.key), saved])
      notify(t('epiQuestionnaire.settings.saved'), 'success')
      return true
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
      return false
    }
  }
  return (
    <div className="questionnaires-panel workspace-column workspace-fill">
      <div className="section-toolbar">
        <div>
          <button type="button" className="epi-link epi-back" onClick={onBack} aria-label={t('epiQuestionnaire.settings.backLabel')}>
            <ArrowLeft size={13} aria-hidden="true" />
            {t('epiQuestionnaire.settings.back')}
          </button>
          <h2>{t('epiQuestionnaire.name')}</h2>
          <p>{fill(t('epiQuestionnaire.settings.intro'), { version })}</p>
          {!canEdit && <p className="field-hint">{t('epiQuestionnaire.settings.readOnly')}</p>}
        </div>
      </div>
      <RegistryTable
        wrapperClassName="table-wrap scroll-table questionnaires-registry"
        className="epi-settings-table"
        columns={[
          { key: 'question', label: t('epiQuestionnaire.settings.question') },
          { key: 'step', label: t('epiQuestionnaire.settings.step'), className: 'epi-col-secondary' },
          { key: 'window', label: t('epiQuestionnaire.settings.window'), className: 'epi-col-secondary' },
          { key: 'prefill', label: t('epiQuestionnaire.settings.prefill'), className: 'epi-col-secondary' },
          { key: 'active', label: t('epiQuestionnaire.settings.active') },
          { key: 'edit', label: '', ariaLabel: t('epiQuestionnaire.settings.wording') },
        ]}
        rows={rows}
        rowKey={question => question.key}
        renderRow={question => (
          <>
            <td>
              <strong>{epiText(question.label, language)}</strong>
            </td>
            <td className="epi-col-secondary">{question.step}</td>
            <td className="epi-col-secondary">{windowWords(question.windowDays)}</td>
            <td className="epi-col-secondary">{question.prefill && PREFILL_SOURCES[question.prefill] ? t(`epiQuestionnaire.sources.${question.prefill}`) : <span className="epi-muted">{t('epiQuestionnaire.settings.manual')}</span>}</td>
            <td>
              <div className="epi-on">
                <CheckboxField
                  checked={question.active}
                  disabled={!canEdit || question.core}
                  ariaLabel={`${t('epiQuestionnaire.settings.active')}: ${epiText(question.label, language)}`}
                  onChange={checked => persist(question, { isActive: checked })}
                />
                {question.core && (
                  <span className="epi-lock">
                    <Lock size={12} aria-hidden="true" />
                    {t('epiQuestionnaire.settings.core')}
                  </span>
                )}
              </div>
            </td>
            <td>
              {canEdit && (
                <button type="button" className="epi-link" onClick={() => setEditing(question)}>
                  {t('epiQuestionnaire.settings.wording')}
                </button>
              )}
            </td>
          </>
        )}
      />
      <p className="epi-note">{t('epiQuestionnaire.settings.neonatal')}</p>
      {editing && (
        <WordingDialog
          question={editing}
          setting={settings.find(row => row.questionKey === editing.key) || null}
          nextVersion={version + 1}
          onClose={() => setEditing(null)}
          onSave={async patch => {
            const ok = await persist(editing, { labelEl: patch.labelEl.trim(), labelEn: patch.labelEn.trim(), helpEl: patch.helpEl.trim(), helpEn: patch.helpEn.trim(), windowDays: patch.windowDays })
            if (ok) setEditing(null)
          }}
        />
      )}
    </div>
  )
}
