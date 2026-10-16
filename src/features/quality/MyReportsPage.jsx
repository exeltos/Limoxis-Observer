import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { formatDay } from '../../core/i18n/formatDay'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLibraries } from '../management/useLibraries'
import { loadQualityRecords } from './qualityService'
import { INCIDENT_CLASSES, incidentCategoryLabel, qualityStatusTone, vocabularyLabel } from './qualityVocabulary'
import './quality.css'

// The reports the signed-in user sent, and where each one stands. Anonymous
// reports carry no name, so they never appear here.
export function isOwnReport(record, userId) {
  return Boolean(userId && record && !record.anonymous && record.reportedById === userId)
}

export function MyReportsPage() {
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const en = language === 'en'
  const { user, profile } = useAuth()
  const { tenant } = useTenant()
  const { libraries } = useLibraries()
  const categories = libraries.incidentCategories || []
  const userId = profile?.id || user?.id || null
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  useEffect(() => {
    let active = true
    loadQualityRecords('incidents', tenant?.id).then(data => { if (active) setRows(data) }).catch(() => { if (active) setRows([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tenant?.id])
  const mine = useMemo(() => rows.filter(row => isOwnReport(row, userId)).sort((a, b) => String(b.date).localeCompare(String(a.date))), [rows, userId])
  const newReport = () => navigate('/quality/report', { state: { limoxisFrom: { pathname: '/quality/my-reports', search: '', hash: '', state: null } } })
  const title = row => (en ? row.titleEn || row.title : row.title)
  return <Page fill className="quality-my-reports" title={en ? 'My incident reports' : 'Οι αναφορές συμβάντων μου'} subtitle={en ? 'Incidents, near misses and complaints you reported, and where each one stands.' : 'Τα συμβάντα, παρ’ ολίγον συμβάντα και παράπονα που αναφέρατε και σε ποια κατάσταση βρίσκεται το καθένα.'} actions={<ActionButton tone="primary" label={en ? 'New incident report' : 'Νέα αναφορά συμβάντος'} onClick={newReport}><Plus size={18} /><span>{en ? 'New incident report' : 'Νέα αναφορά συμβάντος'}</span></ActionButton>}>
    <div className="surface registry-workspace workspace-column workspace-fill">
      <RegistryTable className="quality-table" rows={mine} empty={!loading && !mine.length} emptyTitle={en ? 'You have not reported any incident yet' : 'Δεν έχετε αναφέρει ακόμη συμβάν'} emptyText={en ? 'Anything that went wrong or almost did: reporting helps the hospital learn.' : 'Ό,τι πήγε στραβά ή παραλίγο: η αναφορά βοηθά το νοσοκομείο να μαθαίνει.'} columns={[{ key: 'code', label: t('code') }, { key: 'title', label: t('title') }, { key: 'category', label: en ? 'Category' : 'Κατηγορία' }, { key: 'date', label: t('date') }, { key: 'status', label: t('status') }]} rowProps={row => ({ className: 'clickable-row', onClick: () => setOpen(row) })} renderRow={row => <>
        <td><strong>{row.displayId || row.id}</strong></td>
        <td>{title(row)}</td>
        <td>{incidentCategoryLabel(row.category, categories, language) || '—'}</td>
        <td>{formatDay(row.date, language) || '—'}</td>
        <td><StatusBadge tone={qualityStatusTone(row.status)}>{t(row.status)}</StatusBadge></td>
      </>} />
    </div>
    {open && <ObserverDialog eyebrow={open.displayId || open.id} title={title(open)} subtitle={en ? 'Your incident report' : 'Η αναφορά συμβάντος σας'} onClose={() => setOpen(null)}>
      <RecordDetailsGrid fields={[
        { label: t('status'), value: <StatusBadge tone={qualityStatusTone(open.status)}>{t(open.status)}</StatusBadge> },
        { label: en ? 'Type' : 'Τύπος', value: vocabularyLabel(INCIDENT_CLASSES, open.incidentClass, language) },
        { label: en ? 'Category' : 'Κατηγορία', value: incidentCategoryLabel(open.category, categories, language) },
        { label: en ? 'Department' : 'Τμήμα', value: en ? open.departmentEn || open.department : open.department },
        { label: t('date'), value: [formatDay(open.date, language), open.eventTime].filter(Boolean).join(' ') },
      ]} />
      {(open.description || open.descriptionEn) && <p className="quality-report-description">{en ? open.descriptionEn || open.description : open.description}</p>}
    </ObserverDialog>}
  </Page>
}
