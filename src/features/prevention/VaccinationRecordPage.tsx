import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RouteLoading } from '../../design-system/RouteLoading'
import { ExportMenu } from '../../design-system/ExportMenu'
import { downloadRecordJson } from '../../core/export/recordExport'
import { EmptyState } from '../../design-system/EmptyState'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { useEmployeesData } from '../employees/useEmployeesData'
import {
  createVaccinationsBulkAsync,
  deleteVaccinationAsync,
  loadAllVaccinationsAsync,
  updateVaccinationAsync,
} from '../occupational-health/vaccinationService'
import { EMPTY_VACCINATION, StaffVaccinationEditor } from './StaffVaccinationEditor'

const BACK = '/prevention?tab=vaccinations'

// A staff vaccination (or a new one, single or for several employees) is a page of its own, like the other
// Prevention records: Back returns to the list, saving or deleting does too.
export function VaccinationRecordPage() {
  const { recordId } = useParams()
  const isNew = recordId === 'new'
  const { t, language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { notify, notifyError, confirm } = useFeedback()
  const { role, membership, canAccessRecord, tenant } = useTenant()
  const { data: employeeRows } = useEmployeesData()
  const canManage = can(role, CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const [value, setValue] = useState(isNew ? { mode: 'individual', draft: { ...EMPTY_VACCINATION }, selectedEmployeeIds: [] } : null)
  const [missing, setMissing] = useState(false)
  const employeeMap = useMemo(() => Object.fromEntries((employeeRows || []).map(item => [item.id, item])), [employeeRows])

  useEffect(() => {
    if (isNew || !tenant?.id) return undefined
    let alive = true
    loadAllVaccinationsAsync(tenant.id).then(rows => {
      if (!alive) return
      const row = (rows || []).find(item => String(item.id) === String(recordId))
      if (!row) return setMissing(true)
      setValue({ mode: 'record', draft: { ...row }, selectedEmployeeIds: [row.employeeId], readOnly: true })
    }).catch(error => { if (alive) { notifyError(error, 'load', { operation: 'staff_vaccinations_load' }); setMissing(true) } })
    return () => { alive = false }
  }, [recordId, isNew, tenant?.id, notifyError])

  const employees = (employeeRows || []).filter(item => item.employmentStatus === 'active' && canAccessRecord(item))

  async function save(payload) {
    try {
      if (payload.mode === 'edit') {
        await updateVaccinationAsync(tenant.id, payload.draft.id, payload.draft)
        notify(en ? 'Vaccination updated.' : t('vaccinationUpdated'), 'success')
      } else {
        const selected = (employeeRows || []).filter(item => payload.selectedEmployeeIds.includes(item.id))
        await createVaccinationsBulkAsync(tenant.id, selected, payload.draft)
        notify(t(selected.length === 1 ? 'copy.preventionCopy.vaccinationSavedOne' : 'copy.preventionCopy.vaccinationSavedMany').replace('{count}', selected.length), 'success')
      }
      navigate(BACK)
    } catch (error) {
      notifyError(error, 'save', { operation: payload.mode === 'edit' ? 'staff_vaccinations_update' : 'staff_vaccinations_create' })
    }
  }
  async function remove(payload) {
    const ok = await confirm({
      title: en ? 'Delete vaccination' : t('delete'),
      message: en ? 'Delete this vaccination record? This action cannot be undone.' : t('vaccinationDeleteConfirm'),
      confirmLabel: en ? 'Delete' : t('delete'),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteVaccinationAsync(tenant.id, payload.draft.id)
      notify(en ? 'Vaccination deleted.' : t('vaccinationDeleted'), 'success')
      navigate(BACK)
    } catch (error) {
      notifyError(error, 'delete', { operation: 'staff_vaccinations_delete' })
    }
  }

  const title = isNew || value?.mode === 'edit'
    ? (isNew ? (en ? 'Vaccination entry' : 'Καταχώρηση εμβολιασμού') : (en ? 'Edit vaccination' : 'Επεξεργασία εμβολιασμού'))
    : (en ? 'Vaccination record' : 'Εγγραφή εμβολιασμού')
  const subtitle = isNew
    ? (en ? 'Choose one employee or register the same vaccine for several selected employees.' : 'Επιλέξτε έναν εργαζόμενο ή καταχωρήστε το ίδιο εμβόλιο σε πολλούς επιλεγμένους εργαζομένους.')
    : (en ? 'Staff vaccination' : 'Εμβολιασμός προσωπικού')
  if (missing) return <Page fill><EmptyState title={en ? 'Vaccination not found' : 'Η εγγραφή δεν βρέθηκε'} description="" /></Page>
  if (!value) return <RouteLoading />
  return (
    <Page fill>
      <EntityRecordShell className="vaccination-record-shell workspace-fill" avatar={<ShieldCheck size={19} />} eyebrow={t('prevention')} title={title} subtitle={subtitle} tabs={[]} activeTab="" onTabChange={() => {}} onBack={() => navigate(BACK)} headerActions={!isNew && value.draft?.id ? <ExportMenu onPrint={() => window.print()} items={[{ id: 'json', kind: 'data', label: 'JSON', onClick: () => downloadRecordJson(value.draft, { filename: value.draft.id }) }]} /> : null}>
        <StaffVaccinationEditor
          asPage
          language={language}
          employees={employees}
          value={{ ...value, selectedEmployee: employeeMap[value.draft?.employeeId] || value.selectedEmployee }}
          canManage={canManage}
          onChange={setValue}
          onClose={() => navigate(BACK)}
          onSave={save}
          onDelete={remove}
        />
      </EntityRecordShell>
    </Page>
  )
}
