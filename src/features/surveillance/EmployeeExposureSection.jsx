import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ShieldAlert } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { DetailList } from '../../design-system/DetailList'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { ROLES } from '../../core/permissions/systemRoleMatrix'
import { useEmployeesData } from '../employees/useEmployeesData'
import { createExposureIncidentAsync, loadExposureIncidentsForRecordAsync } from '../occupational-health/exposureIncidentService'
import { EMPTY_EXPOSURE_INCIDENT, ExposureIncidentEditor, exposureTypeLabel, followUpLabel, sourceStatusLabel } from '../occupational-health/ExposureIncidentEditor'
import { loadClinicalCases } from './clinicalCloudService'
import { clinicalCases } from './clinicalDemoData'
import { FormEmpty, FormRow, FormRows } from './forms/FormRow'
import { FormSection, FormsTabProvider } from './forms/FormSection'
import { FORM_STATUS, athensToday } from './forms/formStatus'
import { hospitalDay } from './patientRecordScope'
import './forms/episodeForms.css'

// «Έκθεση προσωπικού» on the staff surveillance record: the occupational exposures recorded
// from it, with the source (patient) as far as this role may know it, the prophylaxis and the
// follow-up. Seen only by the occupational physician (or the manage-occupational-health
// permission): the same roles the database lets read occupational_exposure_incidents.
export const canSeeExposure = ({ isDemo, role, has }) => isDemo || role === ROLES.OCCUPATIONAL_PHYSICIAN || has(CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH)

export function exposureStatus(row, today = athensToday()) {
  if (['completed', 'closed'].includes(row.followUpStatus) || row.status === 'closed') return FORM_STATUS.DONE
  const due = row.followUpDueAt ? hospitalDay(row.followUpDueAt) : ''
  return due && due < today ? FORM_STATUS.OVERDUE : FORM_STATUS.PENDING
}

async function episodeOptions({ isDemo, organizationId, language }) {
  const rows = isDemo ? Object.values(clinicalCases) : await loadClinicalCases(organizationId, { summary: true })
  const en = language === 'en'
  return rows.map(row => ({
    value: isDemo ? row.id : row.recordId || row.id,
    label: [row.patientId, en ? row.departmentEn || row.department : row.department, row.startedAt && String(row.startedAt).slice(0, 10)].filter(Boolean).join(' · '),
    description: row.id,
  }))
}

function ExposureSectionBody({ record, department }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant, isDemo, role, membership } = useTenant()
  const has = useCallback(cap => can(role, cap, membership?.capabilities ?? [], membership?.customCapabilities ?? []), [role, membership])
  const { data: employeeRows = [] } = useEmployeesData()
  const [rows, setRows] = useState([])
  const [editor, setEditor] = useState(null)
  const [detail, setDetail] = useState(null)
  const [caseOptions, setCaseOptions] = useState([])
  const recordKey = record.recordId || record.id
  const canLinkEpisode = has(CAPABILITIES.VIEW_SURVEILLANCE)
  const fmt = value => (value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(en ? 'en-GB' : 'el-GR') : '')
  const reload = useCallback(async () => {
    try {
      setRows(await loadExposureIncidentsForRecordAsync(tenant?.id, recordKey))
    } catch {
      setRows([])
    }
  }, [tenant?.id, recordKey])
  useEffect(() => {
    void reload()
  }, [reload])
  const employee = useMemo(
    () => employeeRows.find(item => (record.employeeDbId && String(item.dbId) === String(record.employeeDbId)) || item.id === record.employeeId) || null,
    [employeeRows, record.employeeDbId, record.employeeId],
  )
  async function openEditor() {
    setEditor({ ...EMPTY_EXPOSURE_INCIDENT, employeeId: employee?.id || record.employeeId, employeeSurveillanceRecordId: recordKey, sourceCaseId: '' })
    if (canLinkEpisode && !caseOptions.length) setCaseOptions(await episodeOptions({ isDemo, organizationId: tenant?.id, language }).catch(() => []))
  }
  async function save(draft) {
    try {
      await createExposureIncidentAsync(tenant?.id, employee, draft)
      notify(t('episodeForms.exposure.saved'), 'success')
      setEditor(null)
      await reload()
    } catch (error) {
      notify(error?.message || t('episodeForms.exposure.saveFailed'), 'error')
    }
  }
  const overdue = rows.filter(row => exposureStatus(row) === FORM_STATUS.OVERDUE).length
  const pending = rows.filter(row => exposureStatus(row) === FORM_STATUS.PENDING).length
  const summary = rows.length ? `${rows.length} ${t('episodeForms.exposure.count')}${overdue ? ` · ${overdue} ${t('episodeForms.status.overdue').toLowerCase()}` : pending ? ` · ${pending} ${t('episodeForms.status.pending').toLowerCase()}` : ''}` : t('episodeForms.exposure.none')
  const name = en ? record.employeeNameEn || record.employeeName : record.employeeName
  return (
    <>
      <FormSection
        id="exposure"
        title={t('episodeForms.exposure.title')}
        icon={ShieldAlert}
        defaultOpen
        summary={summary}
        needsAttention={overdue + pending > 0}
        actions={
          <Button variant="secondary" onClick={openEditor} disabled={!employee && !record.employeeId}>
            <Plus size={14} aria-hidden="true" />
            {t('episodeForms.exposure.record')}
          </Button>
        }
      >
        {rows.length === 0 ? (
          <FormEmpty>{t('episodeForms.exposure.empty')}</FormEmpty>
        ) : (
          <FormRows label={t('episodeForms.exposure.title')}>
            {rows.map(row => {
              const status = exposureStatus(row)
              return (
                <FormRow
                  key={row.id}
                  title={exposureTypeLabel(row.exposureType, en)}
                  detail={[row.deviceOrSource, row.bodySite, row.sourcePatientStatus && sourceStatusLabel(row.sourcePatientStatus, en), row.pepAdministered != null && `${t('episodeForms.exposure.pep')}: ${row.pepAdministered ? t('episodeForms.exposure.yes') : t('episodeForms.exposure.no')}`].filter(Boolean).join(' · ')}
                  status={status}
                  statusDetail={[followUpLabel(row.followUpStatus, en), row.followUpDueAt && fmt(row.followUpDueAt)].filter(Boolean).join(' · ')}
                  date={fmt(row.incidentDate)}
                  dateLabel={t('episodeForms.exposure.incidentDate')}
                  action={{ label: t('episodeForms.open'), onClick: () => setDetail(row) }}
                />
              )
            })}
          </FormRows>
        )}
      </FormSection>
      {editor && (
        <ExposureIncidentEditor
          language={language}
          employees={employee ? [employee] : []}
          draft={editor}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={save}
          prefillItems={[
            { label: t('episodeForms.exposure.employee'), value: [record.employeeId, name].filter(Boolean).join(' · ') },
            { label: t('episodeForms.exposure.department'), value: department },
            { label: t('episodeForms.exposure.record'), value: [record.id, record.startedAt && fmt(record.startedAt)].filter(Boolean).join(' · ') },
          ]}
          sourceCaseOptions={canLinkEpisode ? caseOptions : []}
        />
      )}
      {detail && (
        <ObserverDialog width="standard" title={exposureTypeLabel(detail.exposureType, en)} subtitle={`${t('episodeForms.exposure.title')} · ${fmt(detail.incidentDate)}`} onClose={() => setDetail(null)}>
          <DetailList
            sections={[
              {
                key: 'exposure',
                items: [
                  { label: t('episodeForms.exposure.source'), value: detail.deviceOrSource },
                  { label: t('episodeForms.exposure.sourcePatient'), value: detail.sourceCaseId ? (canLinkEpisode ? <Link to={`/surveillance/${detail.sourceCaseId}`}>{t('episodeForms.exposure.openEpisode')}</Link> : t('episodeForms.exposure.linkedSource')) : '' },
                  { label: t('episodeForms.exposure.sourceStatus'), value: detail.sourcePatientStatus ? sourceStatusLabel(detail.sourcePatientStatus, en) : '' },
                  { label: t('episodeForms.exposure.bodySite'), value: detail.bodySite },
                  { label: t('episodeForms.exposure.pep'), value: detail.pepAdministered == null ? '' : [detail.pepAdministered ? t('episodeForms.exposure.yes') : t('episodeForms.exposure.no'), detail.pepDetails].filter(Boolean).join(' · ') },
                  { label: t('episodeForms.exposure.followUp'), value: [followUpLabel(detail.followUpStatus, en), detail.followUpDueAt && fmt(detail.followUpDueAt)].filter(Boolean).join(' · ') },
                  { label: t('episodeForms.exposure.notes'), value: detail.notes, wide: true },
                ],
              },
            ]}
          />
        </ObserverDialog>
      )}
    </>
  )
}

export function EmployeeExposureSection({ record, department }) {
  const { isDemo, role, membership } = useTenant()
  const has = cap => can(role, cap, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  if (!canSeeExposure({ isDemo, role, has })) return null
  return (
    <FormsTabProvider>
      <div className="episode-forms employee-exposure">
        <ExposureSectionBody record={record} department={department} />
      </div>
    </FormsTabProvider>
  )
}
