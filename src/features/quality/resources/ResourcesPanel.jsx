import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilterBar, FilterSelect } from '../../../design-system/FilterBar'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { can, CAPABILITIES, ROLES } from '../../../core/permissions/roles'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { useDepartments } from '../../management/useLibraries'
import { loadResources } from './resourceService'
import { APPROVALS, CRITICALITY, DUE_STATES, EQUIPMENT_STATES, SUPPLIER_CATEGORIES, approvalLabel, approvalTone, criticalityLabel, criticalityTone, dueStateLabel, dueStateTone, equipmentStateLabel, equipmentStateTone, eventKindLabel, filterEquipment, filterSuppliers, supplierCategoryLabel, withEquipmentStatus, withSupplierStatus } from './resourceModel'
import './resources.css'

// Who may do what with equipment and suppliers.
export function useResourceAccess() {
  const { role, membership, actualRole, isRolePreview } = useTenant()
  const owner = !isRolePreview && actualRole === ROLES.PLATFORM_OWNER
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const canManage = owner || can(role, CAPABILITIES.MANAGE_QUALITY, addOns, custom)
  const canViewAll = canManage || can(role, CAPABILITIES.VIEW_QUALITY, addOns, custom)
  const own = [...(membership?.departmentIds || []), membership?.previewDepartment].filter(Boolean)
  return { canManage, canViewAll, ownDepartments: own }
}

// The suppliers, the equipment with each device's state and the events, with
// department names. In the cloud the database returns a department only its
// own devices; the demo keeps them to the department here.
export function useResources(enabled = true) {
  const { tenant } = useTenant()
  const { language } = useLanguage()
  const { departments } = useDepartments()
  const access = useResourceAccess()
  const [data, setData] = useState({ suppliers: [], equipment: [], events: [] })
  const [loading, setLoading] = useState(enabled)
  const reload = useCallback(() => {
    if (!enabled) { setLoading(false); return Promise.resolve() }
    setLoading(true)
    return loadResources(tenant?.id).then(setData).catch(error => { console.error(error); setData({ suppliers: [], equipment: [], events: [] }) }).finally(() => setLoading(false))
  }, [tenant?.id, enabled])
  useEffect(() => { void reload() }, [reload])
  const scoped = !access.canViewAll && isDemoDataEnvironment()
  const ownKey = access.ownDepartments.join('|')
  const rows = useMemo(() => {
    const names = new Map(departments.map(item => [item.id || item.name, item]))
    const own = new Set(ownKey.split('|').filter(Boolean))
    const equipment = scoped ? data.equipment.filter(item => own.has(item.departmentId)) : data.equipment
    const suppliers = access.canViewAll ? data.suppliers : []
    const supplierNames = new Map(data.suppliers.map(item => [item.id, item.name]))
    const devices = withEquipmentStatus(equipment, data.events).map(item => { const department = names.get(item.departmentId); return { ...item, department: department?.name || (item.departmentId && !/^[0-9a-f-]{36}$/.test(item.departmentId) ? item.departmentId : ''), departmentEn: department?.nameEn || department?.name || '', supplierName: supplierNames.get(item.supplierId) || '' } })
    return { equipment: devices, suppliers: withSupplierStatus(suppliers, equipment), events: data.events }
  }, [data, departments, scoped, ownKey, access.canViewAll])
  return { ...rows, loading, reload, departments, language }
}

const NEXT_LABEL = (row, language) => row.next ? `${eventKindLabel(row.next.kind, language)} · ${formatDay(row.next.nextDue, language)}` : '—'

export function EquipmentList({ list, filters, setFilters, onOpen, filterEnd = null, showDepartment = true }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const rows = useMemo(() => filterEquipment(list.equipment, filters), [list.equipment, filters])
  useEffect(() => setPage(1), [filters, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const usedDepartments = useMemo(() => { const ids = new Set(list.equipment.map(item => item.departmentId).filter(Boolean)); return list.departments.filter(item => ids.has(item.id || item.name)) }, [list.equipment, list.departments])
  const advanced = ['department', 'state', 'due', 'criticality'].filter(key => filters[key] !== 'all').length
  return <>
    <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search device, serial number, location…' : 'Αναζήτηση εξοπλισμού, σειριακού αριθμού, θέσης…'} activeAdvancedCount={advanced} onClear={() => setFilters(current => ({ ...current, query: '', department: 'all', state: 'all', due: 'all', criticality: 'all', quick: null }))} end={filterEnd}>
      {showDepartment && usedDepartments.length > 1 && <FilterSelect label={en ? 'Department' : 'Τμήμα'} value={filters.department} onChange={value => set('department', value)}><option value="all">{t('all')}</option>{usedDepartments.map(item => <option key={item.id || item.name} value={item.id || item.name}>{en ? item.nameEn || item.name : item.name}</option>)}</FilterSelect>}
      <FilterSelect label={t('status')} value={filters.state} onChange={value => set('state', value)}><option value="all">{en ? 'In use' : 'Σε χρήση'}</option>{EQUIPMENT_STATES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Programme' : 'Πρόγραμμα'} value={filters.due} onChange={value => set('due', value)}><option value="all">{t('all')}</option>{DUE_STATES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Criticality' : 'Κρισιμότητα'} value={filters.criticality} onChange={value => set('criticality', value)}><option value="all">{t('all')}</option>{CRITICALITY.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
    </FilterBar>
    <div className="scroll-table">
      <RegistryTable bare className="quality-table quality-register-table" rows={rows.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={row => row.id} empty={!list.loading && !rows.length} emptyFiltered={list.equipment.length > 0} onClearFilters={() => setFilters(current => ({ ...current, query: '', department: 'all', state: 'all', due: 'all', criticality: 'all', quick: null }))}
        columns={[{ key: 'code', label: t('code') }, { key: 'device', label: en ? 'Device' : 'Εξοπλισμός' }, ...(showDepartment ? [{ key: 'department', label: en ? 'Department' : 'Τμήμα' }] : []), { key: 'next', label: en ? 'Next check' : 'Επόμενος έλεγχος' }, { key: 'programme', label: en ? 'Programme' : 'Πρόγραμμα' }, { key: 'status', label: t('status') }]}
        emptyTitle={en ? 'No equipment' : 'Δεν υπάρχει εξοπλισμός'} emptyText={en ? 'Register the devices whose maintenance and calibration you follow.' : 'Καταχωρίστε τον εξοπλισμό του οποίου παρακολουθείτε τη συντήρηση και τη διακρίβωση.'}
        rowProps={row => ({ className: 'registry-row-clickable', onClick: () => onOpen(row, rows) })}
        renderRow={row => <>
          <td><strong>{row.code}</strong><small><StatusBadge tone={criticalityTone(row.criticality)}>{criticalityLabel(row.criticality, language)}</StatusBadge></small></td>
          <td>{row.name}<small>{[row.manufacturer, row.model, row.serialNumber && `S/N ${row.serialNumber}`].filter(Boolean).join(' · ') || '—'}</small></td>
          {showDepartment && <td>{(en ? row.departmentEn : row.department) || '—'}{row.location && <small>{row.location}</small>}</td>}
          <td className="nowrap-cell">{NEXT_LABEL(row, language)}{row.next?.days != null && row.next.days < 0 && <small className="quality-overdue-text">{en ? `${-row.next.days} days late` : `${-row.next.days} ημέρες καθυστέρηση`}</small>}</td>
          <td><StatusBadge tone={dueStateTone(row.due)}>{dueStateLabel(row.due, language)}</StatusBadge></td>
          <td><StatusBadge tone={equipmentStateTone(row.state)}>{equipmentStateLabel(row.state, language)}</StatusBadge>{row.downSince && <small>{en ? 'since' : 'από'} {formatDay(row.downSince, language)}</small>}</td>
        </>} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
  </>
}

export function SuppliersList({ list, filters, setFilters, onOpen, filterEnd = null }) {
  const { t, language } = useLanguage()
  const en = language === 'en'
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const rows = useMemo(() => filterSuppliers(list.suppliers, filters), [list.suppliers, filters])
  useEffect(() => setPage(1), [filters, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const advanced = ['category', 'approval', 'criticality'].filter(key => filters[key] !== 'all').length + (filters.status !== 'active' ? 1 : 0)
  return <>
    <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search supplier, tax ID, products…' : 'Αναζήτηση προμηθευτή, ΑΦΜ, προϊόντων…'} activeAdvancedCount={advanced} onClear={() => setFilters(current => ({ ...current, query: '', category: 'all', approval: 'all', criticality: 'all', status: 'active', quick: null }))} end={filterEnd}>
      <FilterSelect label={en ? 'Category' : 'Κατηγορία'} value={filters.category} onChange={value => set('category', value)}><option value="all">{t('all')}</option>{SUPPLIER_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Approval' : 'Έγκριση'} value={filters.approval} onChange={value => set('approval', value)}><option value="all">{t('all')}</option>{APPROVALS.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Criticality' : 'Κρισιμότητα'} value={filters.criticality} onChange={value => set('criticality', value)}><option value="all">{t('all')}</option>{CRITICALITY.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={t('status')} value={filters.status} onChange={value => set('status', value)}><option value="active">{en ? 'Active' : 'Ενεργοί'}</option><option value="inactive">{en ? 'Inactive' : 'Ανενεργοί'}</option><option value="all">{t('all')}</option></FilterSelect>
    </FilterBar>
    <div className="scroll-table">
      <RegistryTable bare className="quality-table quality-register-table" rows={rows.slice((safePage - 1) * pageSize, safePage * pageSize)} rowKey={row => row.id} empty={!list.loading && !rows.length} emptyFiltered={list.suppliers.length > 0} onClearFilters={() => setFilters(current => ({ ...current, query: '', category: 'all', approval: 'all', criticality: 'all', status: 'active', quick: null }))}
        columns={[{ key: 'code', label: t('code') }, { key: 'supplier', label: en ? 'Supplier' : 'Προμηθευτής' }, { key: 'evaluation', label: en ? 'Latest evaluation' : 'Τελευταία αξιολόγηση' }, { key: 'attention', label: en ? 'Needs attention' : 'Χρειάζεται προσοχή' }, { key: 'approval', label: en ? 'Approval' : 'Έγκριση' }]}
        emptyTitle={en ? 'No suppliers' : 'Δεν υπάρχουν προμηθευτές'} emptyText={en ? 'Register the external providers whose products and services affect care.' : 'Καταχωρίστε τους εξωτερικούς παρόχους των οποίων τα προϊόντα και οι υπηρεσίες επηρεάζουν τη φροντίδα.'}
        rowProps={row => ({ className: 'registry-row-clickable', onClick: () => onOpen(row, rows) })}
        renderRow={row => { const notes = supplierNotes(row, language); return <>
          <td><strong>{row.code}</strong><small><StatusBadge tone={criticalityTone(row.criticality)}>{criticalityLabel(row.criticality, language)}</StatusBadge></small></td>
          <td>{row.name}<small>{supplierCategoryLabel(row.category, language)}</small></td>
          <td className="nowrap-cell">{row.latestEvaluation ? `${formatDay(row.latestEvaluation.evaluatedOn, language)} · ${row.score}%` : '—'}{row.evaluationDue && <small className="quality-overdue-text">{en ? 'Evaluation due' : 'Οφείλεται αξιολόγηση'}</small>}</td>
          <td>{notes.length ? <span className="resource-notes">{notes.map(note => <StatusBadge key={note.key} tone={note.tone}>{note.label}</StatusBadge>)}</span> : '—'}</td>
          <td><StatusBadge tone={approvalTone(row.approval)}>{approvalLabel(row.approval, language)}</StatusBadge></td>
        </> }} />
    </div>
    {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
  </>
}

// The short notes the supplier list shows: open nonconformities, certificates, the contract.
export function supplierNotes(row, language = 'el') {
  const en = language === 'en'
  return [
    row.openNonconformities > 0 && { key: 'nc', tone: row.majorOpen ? 'danger' : 'warning', label: en ? `${row.openNonconformities} open nonconformit${row.openNonconformities === 1 ? 'y' : 'ies'}` : `${row.openNonconformities} ανοιχτ${row.openNonconformities === 1 ? 'ή' : 'ές'} μη συμμόρφωσ${row.openNonconformities === 1 ? 'η' : 'εις'}` },
    row.expiredCertificates > 0 && { key: 'expired', tone: 'danger', label: en ? 'Certificate expired' : 'Ληγμένο πιστοποιητικό' },
    row.expiringCertificates > 0 && { key: 'expiring', tone: 'warning', label: en ? 'Certificate expiring' : 'Πιστοποιητικό λήγει' },
    row.contractState === 'expired' && { key: 'contract', tone: 'danger', label: en ? 'Contract ended' : 'Η σύμβαση έληξε' },
    row.contractState === 'expiring' && { key: 'contract', tone: 'warning', label: en ? 'Contract ends soon' : 'Η σύμβαση λήγει' },
  ].filter(Boolean)
}
