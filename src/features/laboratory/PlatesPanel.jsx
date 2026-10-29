import { useMemo, useState } from 'react'
import { limitAssessment } from './environmentalLimit'
import { AlertTriangle, Clock3, FlaskConical, PackageCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { StatusCards } from '../../design-system/StatusCards'
import { formatDay } from '../../core/i18n/formatDay'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { LaboratoryStatus, labSampleStatus } from './LaboratoryStatus'
import { groupPlates, receivePlate } from './laboratoryPlates'

// «Τρυβλία» of the laboratory: the environmental samples grouped by culture plate. A plate is read
// and received as one thing (every position at once), while each position keeps its own sample,
// result and CFU count; a row opens the plate with all its positions side by side.
const STATUS_TONE = { awaiting: 'warning', processing: 'info', completed: 'success', rejected: 'neutral' }

// A plate's results at a glance: how many points are outside their limits; once it is done,
// «all within limits», or «no limit» when no point had one to be assessed against.
function PlateResults({ plate, t }) {
  if (plate.counts.outside) return <StatusBadge tone="danger">{t('labPlates.outsideN').replace('{n}', String(plate.counts.outside))}</StatusBadge>
  if (plate.status !== 'completed') return '—'
  const assessed = plate.samples.some(sample => (sample.microbiologyResults || []).some(result => limitAssessment(result) != null))
  return assessed ? <StatusBadge tone="success">{t('labPlates.allWithin')}</StatusBadge> : <StatusBadge tone="neutral">{t('labPlates.noLimitShort')}</StatusBadge>
}

export function PlatesPanel({ samples = [], loading = false, canManage = false, repository, reload }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState('all')
  const [openKey, setOpenKey] = useState(null)
  const plates = useMemo(() => groupPlates(samples), [samples])
  const open = plates.find(plate => plate.key === openKey) || null
  const departmentOf = plate => (en ? plate.departmentEn : plate.department) || '—'
  const counts = {
    awaiting: plates.filter(plate => plate.status === 'awaiting').length,
    processing: plates.filter(plate => plate.status === 'processing').length,
    outside: plates.filter(plate => plate.counts.outside > 0).length,
  }
  const shown = plates
    .filter(plate => quick === 'all' || (quick === 'outside' ? plate.counts.outside > 0 : plate.status === quick))
    .filter(plate =>
      [plate.plate, plate.batchId, departmentOf(plate), ...plate.samples.map(sample => `${sample.id} ${sample.location} ${sample.point}`)]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
  const toggle = key => setQuick(current => (current === key ? 'all' : key))
  const positionsText = plate => `${plate.counts.total} ${t(plate.counts.total === 1 ? 'labPlates.positionOne' : 'labPlates.positionMany')}`
  const clear = () => {
    setQuery('')
    setQuick('all')
  }

  return (
    <>
      <StatusCards label={t('labPlates.tab')} loading={loading} items={[
        { key: 'awaiting', icon: Clock3, label: t('labPlates.awaiting'), value: counts.awaiting, active: quick === 'awaiting', onToggle: () => toggle('awaiting') },
        { key: 'processing', icon: FlaskConical, label: t('labPlates.processing'), value: counts.processing, active: quick === 'processing', onToggle: () => toggle('processing') },
        { key: 'outside', icon: AlertTriangle, label: t('labPlates.outside'), value: counts.outside, tone: counts.outside > 0 ? 'danger' : '', active: quick === 'outside', onToggle: () => toggle('outside') },
      ]} />
      <section className="surface workspace-fill registry-workspace workspace-column canonical-paginated-registry laboratory-registry">
        <FilterBar query={query} onQueryChange={setQuery} placeholder={t('labPlates.search')} onClear={clear} />
        <div className="scroll-table">
          <RegistryTable bare className="lab-table lab-plates-table" columns={[
            { key: 'plate', label: t('labPlates.colPlate'), sortValue: plate => plate.collectedAt || plate.plate },
            { key: 'department', label: t('labPlates.colDepartment'), sortValue: plate => departmentOf(plate) },
            { key: 'positions', label: t('labPlates.colPositions'), sortValue: plate => plate.samples.length },
            { key: 'sampled', label: t('labPlates.colSampled'), sortValue: plate => plate.collectedAt },
            { key: 'status', label: t('labPlates.colStatus'), sortValue: plate => plate.status },
            { key: 'results', label: t('labPlates.colResults'), sortValue: plate => plate.counts.outside },
          ]} rows={shown} loading={loading} rowKey={plate => plate.key}
          rowProps={plate => ({ className: 'clickable-row', tabIndex: 0, onClick: () => setOpenKey(plate.key), onKeyDown: event => { if (event.key === 'Enter') setOpenKey(plate.key) } })}
          emptyTitle={plates.length ? t('svEmptyFiltered') : t('labPlates.empty')} emptyText={plates.length ? t('svEmptyFilteredHint') : t('labPlates.emptyText')} emptyFiltered={plates.length > 0} onClearFilters={clear} emptyIcon={PackageCheck}
          renderRow={plate => <>
            <td><strong>{`${t('clinicalRecords.envPlate')} ${plate.plate}`}</strong>{plate.batchId && <small>{`${t('labPlates.batch')} ${plate.batchId}`}</small>}</td>
            <td>{departmentOf(plate)}</td>
            <td>{positionsText(plate)}<small>{plate.samples.map(sample => sample.environmentalPosition).filter(Boolean).join(', ')}</small></td>
            <td>{plate.collectedAt ? formatDay(plate.collectedAt, language) : '—'}</td>
            <td><StatusBadge tone={STATUS_TONE[plate.status]}>{t(`labPlates.status${plate.status[0].toUpperCase()}${plate.status.slice(1)}`)}</StatusBadge>{plate.status === 'awaiting' && <small>{`${plate.counts.awaiting}/${plate.counts.total}`}</small>}</td>
            <td><PlateResults plate={plate} t={t} /></td>
          </>} />
        </div>
      </section>
      {open && <PlateDialog plate={open} departmentOf={departmentOf} canManage={canManage} repository={repository} reload={reload} onClose={() => setOpenKey(null)} />}
    </>
  )
}

// One plate with every position side by side: the point, the sample, its state and result with the CFU count.
function PlateDialog({ plate, departmentOf, canManage, repository, reload, onClose }) {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  async function receive() {
    setBusy(true)
    try {
      const received = await receivePlate(repository, plate)
      notify(t('labPlates.receivedN').replace('{n}', String(received)).replace('{plate}', plate.plate), 'success')
    } catch (error) {
      notify(t('labPlates.receivePartial').replace('{n}', String(error.received || 0)).replace('{total}', String(plate.awaiting.length)).replace('{error}', error?.message || t('actionFailed')), 'danger')
    } finally {
      await reload?.()
      setBusy(false)
    }
  }
  const subtitle = [departmentOf(plate), plate.collectedAt && formatDay(plate.collectedAt, language), plate.batchId && `${t('labPlates.batch')} ${plate.batchId}`].filter(Boolean).join(' · ')
  return (
    <ObserverDialog
      width="standard"
      title={`${t('clinicalRecords.envPlate')} ${plate.plate}`}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        canManage ? (
          <Button disabled={busy || !plate.awaiting.length} loading={busy} onClick={receive} title={plate.awaiting.length ? undefined : t('labPlates.receiveNone')}>
            <PackageCheck size={15} aria-hidden="true" />
            {t('labPlates.receive')}
            {plate.awaiting.length > 0 && ` (${plate.awaiting.length})`}
          </Button>
        ) : null
      }
    >
      <table className="plate-positions">
        <thead>
          <tr>
            <th>{t('labPlates.colPosition')}</th>
            <th>{t('labPlates.colPoint')}</th>
            <th>{t('labPlates.colStatus')}</th>
            <th>{t('labPlates.colResult')}</th>
          </tr>
        </thead>
        <tbody>
          {plate.samples.map(sample => {
            const result = sample.microbiologyResults?.[0]
            return (
              <tr key={sample.id} tabIndex={0} aria-label={`${t('labPlates.openSample')} ${sample.id}`} onClick={() => navigate(`/laboratory/${encodeURIComponent(sample.id)}`)} onKeyDown={event => { if (event.key === 'Enter') navigate(`/laboratory/${encodeURIComponent(sample.id)}`) }}>
                <td><strong>{sample.environmentalPosition || '—'}</strong></td>
                <td>{[sample.location, sample.point].filter(Boolean).join(' · ') || '—'}<small>{sample.id}</small></td>
                <td><LaboratoryStatus {...labSampleStatus(sample, language)} /></td>
                <td>
                  {result ? (
                    <>
                      {limitAssessment(result) === true && <StatusBadge tone="success">{t('clinicalRecords.withinLimitsShort')}</StatusBadge>}
                      {limitAssessment(result) === false && <StatusBadge tone="danger">{t('clinicalRecords.outsideLimitsShort')}</StatusBadge>}
                      {limitAssessment(result) == null && <strong>{t(result.result)}</strong>}
                      <small>{[limitAssessment(result) != null && t(result.result), result.organism, result.cfuCount != null && `${result.cfuCount} CFU`].filter(Boolean).join(' · ')}</small>
                    </>
                  ) : (
                    <span className="plate-no-result">{t('labPlates.noResult')}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ObserverDialog>
  )
}
