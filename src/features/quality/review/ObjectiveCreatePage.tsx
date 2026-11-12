import { useEffect,useState } from 'react'
import { Navigate,useLocation,useParams } from 'react-router-dom'
import { Target } from 'lucide-react'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../../core/permissions/roles'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { ObjectiveFields,linkedTarget,newObjective,useObjectives } from './QualityObjectives'
import { saveObjective } from './reviewService'
import { rememberQualitySection } from '../qualityReturnSection'
import '../quality.css'
import type { AnyRecord } from '../../../types/featureTypes'

// /quality/objectives/new and /quality/objectives/:objectiveId/edit — a quality objective on a page of its own
// (ISO 9001 §6.2: measurable, with an owner and a date).
export function ObjectiveCreatePage() {
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant, role, membership } = useTenant()
  const canManage = can(role, CAPABILITIES.MANAGE_QUALITY, membership?.capabilities || [], membership?.customCapabilities || [])
  const { goBack } = useContextualNavigation('/quality')
  const { objectiveId } = useParams()
  const prefill = useLocation().state?.prefill
  const { objectives, registers, definitions, levels, loading } = useObjectives(tenant?.id)
  const existing = objectiveId ? objectives.find(item => item.id === objectiveId) : null
  const [objective, setObjective] = useState(() => ({ ...newObjective(), ...(prefill || {}) }))
  // Editing: the form starts from the saved objective, without the values computed for display.
  useEffect(() => { if (existing) { const { register: _r, indicator: _i, current: _c, platformIndicator: _p, months: _m, department: _d, committee: _k, targetFromIndicator, ...clean } = existing; setObjective(targetFromIndicator ? { ...clean, target: '' } : clean) } }, [existing]) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [saving, setSaving] = useState(false)
  const set = (next: AnyRecord) => setObjective((current: AnyRecord) => ({ ...current, ...next }))
  const valid = Boolean(objective.title?.trim()) && ((objective.target !== '' && objective.target != null) || linkedTarget(registers, objective, definitions) != null)
  const back = () => { if (!objectiveId) rememberQualitySection('indicators:objectives'); goBack() }
  async function save() {
    if (!valid || saving) return
    setSaving(true)
    try {
      await saveObjective(tenant?.id, objective)
      notify(en ? 'Objective saved.' : 'Ο στόχος αποθηκεύτηκε.', 'success')
      back()
    } catch (error) { console.error(error); notify(en ? 'The objective could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.', 'error') } finally { setSaving(false) }
  }
  if (!canManage) return <Navigate to="/quality" replace />
  if (objectiveId && loading) return <RouteLoading />
  if (objectiveId && !existing) return <Navigate to="/quality" replace />
  return <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<Target size={19} />} eyebrow={t('quality')} title={objectiveId ? (en ? 'Edit quality objective' : 'Επεξεργασία στόχου') : (en ? 'New quality objective' : 'Νέος στόχος ποιότητας')}
    subtitle={en ? 'Measurable, with an owner and a date.' : 'Μετρήσιμος, με υπεύθυνο και προθεσμία.'} tabs={[]} activeTab="" onTabChange={() => {}} onBack={back}>
    <div className="record-section">
      <ObjectiveFields objective={objective} set={set} registers={registers} definitions={definitions} levels={levels} />
      <div className="inline-edit-footer">
        <Button variant="secondary" onClick={back}>{en ? 'Cancel' : 'Ακύρωση'}</Button>
        <SaveButton loading={saving} disabled={saving || !valid} onClick={save}>{objectiveId ? (en ? 'Save' : 'Αποθήκευση') : (en ? 'Create objective' : 'Δημιουργία στόχου')}</SaveButton>
      </div>
    </div>
  </EntityRecordShell></Page>
}
