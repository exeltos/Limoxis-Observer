import { useEffect, useMemo, useState } from 'react'
import { limitAssessment } from './environmentalLimit'
import { AlertTriangle, Clock3, FlaskConical, PackageCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { PERIOD_DAYS, inPeriod } from '../surveillance/surveillanceOptions'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useTableSort } from '../../design-system/useTableSort'
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
  const [department, setDepartment] = useState('all')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState('all')
  const [openKey, setOpenKey] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const plates = useMemo(() => groupPlates(samples), [samples])
  const open = plates.find(plate => plate.key === openKey) || null
  const departmentOf = plate => (en ? plate.departmentEn : plate.department) || '—'
  const departments = useMemo(() => [...new Set(plates.map(plate => departmentOf(plate)).filter(name => name && name !== '—'))].sort((a, b) => a.localeCompare(b, language)), [plates]) // eslint-disable-line react-hooks/exhaustive-deps
  // Open work (waiting, in progress) counts every plate; «outside limits» counts the last 30 days, so old results do not weigh on today.
  const counts = {
    awaiting: plates.filter(plate => plate.status === 'awaiting').length,
    processing: plates.filter(plate => plate.status === 'processing').length,
    outside: plates.filter(plate => plate.counts.outside > 0 && inPeriod(plate.collectedAt, '30')).length,
  }
  const shown = plates
    .filter(plate => quick === 'all' || (quick === 'outside' ? plate.counts.outside > 0 : plate.status === quick))
    .filter(plate => department === 'all' || departmentOf(plate) === department)
    .filter(plate => status === 'all' || plate.status === status)
    .filter(plate => inPeriod(plate.collectedAt, period))
    .filter(plate =>
      [plate.plate, plate.batchId, departmentOf(plate), ...plate.samples.map(sample => `${sample.id} ${sample.location} ${sample.point}`)]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
  // The arrows in the headers sort the whole filtered list (newest sampling first); then the page is cut.
  const { sorted: sortedPlates, sort, onSort } = useTableSort(shown, {
    department: plate => departmentOf(plate),
    plate: plate => plate.plate,
    positions: plate => plate.samples.length,
    sampled: plate => plate.collectedAt,
    status: plate => plate.status,
    results: plate => plate.counts.outside,
  }, { key: 'sampled', dir: 'desc' })
  useEffect(() => { setPage(1) }, [sort, query, quick, department, status, period, pageSize])
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedPlates = sortedPlates.slice((safePage - 1) * pageSize, safePage * pageSize)
  const toggle = key => setQuick(current => (current === key ? 'all' : key))
  const positionsText = plate => `${plate.counts.total} ${t(plate.counts.total === 1 ? 'labPlates.positionOne' : 'labPlates.positionMany')}`
  const clear = () => {
    setQuery('')
    setQuick('all')
    setDepartment('all')
    setStatus('all')
    setPeriod('all')
  }
  const statusName = value => t(`labPlates.status${value[0].toUpperCase()}${value.slice(1)}`)
  const toggleOutside = () => {
    const on = !(quick === 'outside' && period === '30')
    setQuick(on ? 'outside' : 'all')
    setPeriod(on ? '30' : 'all')
  }

  return (
    <>
      <StatusCards label={t('labPlates.tab')} loading={loading} items={[
        { key: 'awaiting', icon: Clock3, label: t('labPlates.awaiting'), value: counts.awaiting, active: quick === 'awaiting', onToggle: () => toggle('awaiting') },
        { key: 'processing', icon: FlaskConical, label: t('labPlates.processing'), value: counts.processing, active: quick === 'processing', onToggle: () => toggle('processing') },
        { key: 'outside', icon: AlertTriangle, label: t('labPlatesExtra.outside30'), value: counts.outside, tone: counts.outside > 0 ? 'danger' : '', active: quick === 'outside' && period === '30', onToggle: toggleOutside },
      ]} />
      <section className="surface workspace-fill registry-workspace workspace-column canonical-paginated-registry laboratory-registry">
        <FilterBar query={query} onQueryChange={setQuery} placeholder={t('labPlates.search')} onClear={clear} activeAdvancedCount={(department !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0)} activeFilters={[
          department !== 'all' && { key: 'department', label: `${t('department')}: ${department}`, onRemove: () => setDepartment('all') },
          status !== 'all' && { key: 'status', label: `${t('status')}: ${statusName(status)}`, onRemove: () => setStatus('all') },
          period !== 'all' && { key: 'period', label: `${t('svPeriod')}: ${t(`svPeriod${period}`)}`, onRemove: () => setPeriod('all') },
        ].filter(Boolean)} advanced={<>
          <FilterSelect label={t('department')} value={department} onChange={setDepartment}><option value="all">{t('allDepartments')}</option>{departments.map(name => <option key={name} value={name}>{name}</option>)}</FilterSelect>
          <FilterSelect label={t('status')} value={status} onChange={setStatus}><option value="all">{t('all')}</option>{['awaiting', 'processing', 'completed', 'rejected'].map(value => <option key={value} value={value}>{statusName(value)}</option>)}</FilterSelect>
          <FilterSelect label={t('svPeriod')} value={period} onChange={setPeriod}><option value="all">{t('svPeriodAll')}</option>{PERIOD_DAYS.map(days => <option key={days} value={String(days)}>{t(`svPeriod${days}`)}</option>)}</FilterSelect>
        </>} />
        <div className="scroll-table">
          <RegistryTable bare className="lab-table lab-plates-table" sort={sort} onSort={onSort} columns={[
            { key: 'department', label: t('labPlates.colDepartment'), sortable: true },
            { key: 'plate', label: t('labPlates.colPlate'), sortable: true },
            { key: 'positions', label: t('labPlates.colPositions'), sortable: true },
            { key: 'sampled', label: t('labPlates.colSampled'), sortable: true },
            { key: 'status', label: t('labPlates.colStatus'), sortable: true },
            { key: 'results', label: t('labPlates.colResults'), sortable: true },
          ]} rows={pagedPlates} loading={loading} rowKey={plate => plate.key}
          rowProps={plate => ({ className: 'clickable-row', tabIndex: 0, onClick: () => setOpenKey(plate.key), onKeyDown: event => { if (event.key === 'Enter') setOpenKey(plate.key) } })}
          emptyTitle={plates.length ? t('svEmptyFiltered') : t('labPlates.empty')} emptyText={plates.length ? t('svEmptyFilteredHint') : t('labPlates.emptyText')} emptyFiltered={plates.length > 0} onClearFilters={clear} emptyIcon={PackageCheck}
          renderRow={plate => <>
            <td><strong>{departmentOf(plate)}</strong></td>
            <td>{`${t('clinicalRecords.envPlate')} ${plate.plate}`}{plate.batchId && <small>{`${t('labPlates.batch')} ${plate.batchId}`}</small>}</td>
            <td>{positionsText(plate)}<small>{plate.samples.map(sample => sample.environmentalPosition).filter(Boolean).join(', ')}</small></td>
            <td>{plate.collectedAt ? formatDay(plate.collectedAt, language) : '—'}</td>
            <td><StatusBadge tone={STATUS_TONE[plate.status]}>{t(`labPlates.status${plate.status[0].toUpperCase()}${plate.status.slice(1)}`)}</StatusBadge>{plate.status === 'awaiting' && <small>{`${plate.counts.awaiting}/${plate.counts.total}`}</small>}</td>
            <td><PlateResults plate={plate} t={t} /></td>
          </>} />
        </div>
        {shown.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }}/>}
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
