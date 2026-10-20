import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { StatusBadge } from '../../design-system/StatusBadge'
import { DetailList } from '../../design-system/DetailList'
import { loadPatientNotificationReports } from '../reporting/notificationReportsService'

const STATUS_KEY = { pending: 'notifiableStatusPending', notified: 'notifiableStatusNotified', not_required: 'notifiableStatusNotRequired' }

// A patient record with no admission is never an empty page: it says so, offers
// «Νέα νοσηλεία», and lists what does exist for the patient (notifiable disease
// reports with their date and a link, surveillance episodes, samples).
export function PatientWithoutAdmission({ patient, tenantId, isDemo, canAdmit, canViewReports, onNewAdmission, episodesCount = 0, samplesCount = 0, t, fmtDate }) {
  const [reports, setReports] = useState([])
  useEffect(() => {
    let alive = true
    loadPatientNotificationReports(tenantId, patient?.recordId, { isDemo })
      .then(rows => { if (alive) setReports(rows) })
      .catch(() => { if (alive) setReports([]) })
    return () => { alive = false }
  }, [tenantId, isDemo, patient?.recordId])
  const items = [
    reports.length > 0 && {
      label: t('clinicalRecords.notifiableReports'),
      wide: true,
      value: (
        <ul className="patient-no-admission-reports">
          {reports.map(report => (
            <li key={report.id}>
              <span>{report.disease || t('clinicalRecords.notifiableReports')}</span>
              <small>{fmtDate(report.notifiedAt || report.createdAt)}</small>
              <StatusBadge tone={report.status === 'notified' ? 'active' : report.status === 'pending' ? 'temporary' : ''}>{t(`clinicalRecords.${STATUS_KEY[report.status] || 'notifiableStatusPending'}`)}</StatusBadge>
              {canViewReports && <Link to="/analysis?tab=reporting">{t('clinicalRecords.openReports')}</Link>}
            </li>
          ))}
        </ul>
      ),
    },
    episodesCount > 0 && { label: t('clinicalRecords.episodesCountLabel'), value: String(episodesCount) },
    samplesCount > 0 && { label: t('clinicalRecords.samplesCountLabel'), value: String(samplesCount) },
  ].filter(Boolean)
  return (
    <section className="clinical-panel patient-summary-card patient-no-admission">
      <div className="patient-no-admission-head">
        <div>
          <h3>{t('clinicalRecords.noAdmissionTitle')}</h3>
          <p>{t('clinicalRecords.noAdmissionHint')}</p>
        </div>
        {canAdmit && (
          <Button onClick={onNewAdmission}>
            <Plus size={15} />
            {t('clinicalRecords.newAdmission')}
          </Button>
        )}
      </div>
      <DetailList sections={[{ title: t('clinicalRecords.onRecordTitle'), items }]} />
      {!items.length && <p className="lo-detail-missing">{t('clinicalRecords.nothingElseOnRecord')}</p>}
    </section>
  )
}
