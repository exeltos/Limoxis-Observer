import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useAuth } from '../../../core/auth/AuthContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { auditActorFromAuth } from '../../../core/audit/actor'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { loadQualityRecords, saveQualityRecord } from '../qualityService'
import { independenceBlocks } from './auditModel'
import { AuditPlanFields } from './AuditPlanFields'
import { useAuditTemplates, useAuditorCompetence } from './useAuditTemplates'
import './audits.css'

const L = (en, el, english) => (en ? english : el)

// An audit's planning, on a page of its own (not a pop-up): questionnaire, date, team and the rest.
// An audit whose lead auditor audits their own department is not saved.
export function AuditPlanPage() {
  const { recordId } = useParams()
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { user, profile } = useAuth()
  const { goBack } = useContextualNavigation('/quality')
  const { tenant, role, membership, actualRole, isRolePreview } = useTenant()
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const canManage = (!isRolePreview && actualRole === ROLES.PLATFORM_OWNER) || can(role, CAPABILITIES.MANAGE_QUALITY, addOns, custom)
  const actor = useMemo(() => auditActorFromAuth({ profile, user }), [profile, user])
  const { templates } = useAuditTemplates(tenant?.id)
  const competence = useAuditorCompetence(tenant?.id)
  const [record, setRecord] = useState(null)
  const [draft, setDraft] = useState(null)
  const [missing, setMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    loadQualityRecords('audits', tenant?.id).then(rows => {
      if (!active) return
      const found = rows.find(row => String(row.id) === String(recordId))
      if (found) { setRecord(found); setDraft(structuredClone(found)) } else setMissing(true)
    }).catch(() => { if (active) setMissing(true) })
    return () => { active = false }
  }, [tenant?.id, recordId])
  const blocked = draft ? independenceBlocks(draft.team || [], { id: draft.departmentId, name: draft.department }) : false
  async function save() {
    if (blocked) { notify(L(en, 'Ο επικεφαλής επιθεωρητής δεν μπορεί να επιθεωρήσει το δικό του τμήμα.', 'The lead auditor cannot audit their own department.'), 'error'); return }
    setSaving(true)
    try {
      await saveQualityRecord('audits', tenant?.id, { ...draft, history: [{ at: new Date().toISOString(), action: 'recordUpdated', actor: actor?.name || '' }, ...(record.history || [])] })
      notify(L(en, 'Ο σχεδιασμός αποθηκεύτηκε.', 'Planning saved.'), 'success')
      goBack()
    } catch (error) {
      console.error(error)
      notify(L(en, 'Δεν ήταν δυνατή η αποθήκευση.', 'The planning could not be saved.'), 'error')
    } finally { setSaving(false) }
  }
  if (!canManage || missing) return <Navigate to="/quality" replace />
  return <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<CalendarDays size={19} />} eyebrow={record?.displayId || record?.id || t('quality')} title={L(en, 'Σχεδιασμός επιθεώρησης', 'Audit planning')} subtitle={record ? (en ? record.titleEn || record.title : record.title) : ''} tabs={[]} activeTab="" onTabChange={() => {}} onBack={goBack}>
    {draft && <div className="record-section audit-plan-page">
      <div className="audit-plan-flat"><AuditPlanFields flat draft={draft} setDraft={setDraft} templates={templates} competence={competence} language={language} /></div>
      <div className="inline-edit-footer">
        <Button variant="secondary" onClick={goBack}>{L(en, 'Ακύρωση', 'Cancel')}</Button>
        <SaveButton loading={saving} disabled={saving || blocked} onClick={save}>{L(en, 'Αποθήκευση', 'Save')}</SaveButton>
      </div>
    </div>}
  </EntityRecordShell></Page>
}
