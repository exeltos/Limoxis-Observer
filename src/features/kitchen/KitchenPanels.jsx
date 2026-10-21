import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChefHat, ClipboardCheck, Package, Pencil, Plus, Route, Trash2, Truck, Undo2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { SignalBadge } from '../../design-system/StatusBadge'
import { SectionHeader } from '../../design-system/SectionHeader'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { FilterDate, FilterSelect } from '../../design-system/FilterBar'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ExportMenu } from '../../design-system/ExportMenu'
import { FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { reportExports } from '../../core/export/reportDocument'
import { KitchenList, LimitBadge, matches, useKitchenActor, useKitchenTrace } from './KitchenShared'
import { limitText } from './kitchenLimits'
import { RECEIPT_CHECK_FIELDS, shortDay, RECEIPT_RESULTS, STORAGES, PRODUCT_CATEGORIES, categoryLabel, newReceipt, fmtQty, fmtTemp, haccpReviewDue, receiptResultLabel, receiptResultTone, storageLabel, todayKey, traceBatch, unitLabel, verificationQueue, weekdayLabel, weekdayOf, dayRecords, addDays, newProduct, newMenu } from './kitchenModel'
import { kitchenErrorMessage, removeEntry, reopen, saveSettings, signOff } from './kitchenService'
import { traceabilityDocument } from './kitchenReports'

export const fmtDay = value => { if (!value) return '—'; const [y, m, d] = String(value).slice(0, 10).split('-'); return `${d}/${m}/${y}` }
export const fmtStamp = (value, language) => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) }
const timeOf = value => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const inPeriod = (date, from, to) => (!from || String(date) >= from) && (!to || String(date).slice(0, 10) <= to)

// An entry out of limits can become a quality deviation (the incident report, prefilled).
export function useDeviationReport() {
  const navigate = useNavigate()
  const { language } = useLanguage()
  const en = language === 'en'
  return (title, lines, date) => navigate('/quality/report', { state: { qualitySource: { title: `${en ? 'Kitchen deviation' : 'Απόκλιση κουζίνας (HACCP)'}: ${title}`, description: lines.filter(Boolean).join('\n'), date: String(date || '').slice(0, 10) }, limoxisFrom: { path: '/kitchen', label: en ? 'Kitchen' : 'Κουζίνα' } } })
}

// --- Today ---------------------------------------------------------------------------------------
// What needs action, on one screen: today's day, what is out of limits, the days waiting for verification.

export function OverviewPanel({ state, summary, access, onOpenDay, onTab, onStockAttention }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const report = useDeviationReport()
  const kindLabel = { receipt: en ? 'Receipt' : 'Παραλαβή', thermal: en ? 'Heat treatment' : 'Θερμική επεξεργασία', defrost: en ? 'Defrosting' : 'Απόψυξη', pureeing: en ? 'Pureeing' : 'Πολτοποίηση' }
  const production = summary.production
  const queue = verificationQueue(state, { today: summary.today, since: addDays(summary.today, -30) })
  const todayRows = [
    ...summary.receipts.map(row => ({ id: `r-${row.id}`, kind: en ? 'Receipt' : 'Παραλαβή', what: `${shortDay(row.receivedOn)} · ${row.supplierName || '—'}`, when: row.receivedTime, status: row.limitStatus, path: `/kitchen/receipts/${row.id}` })),
    ...summary.thermal.map(row => ({ id: `t-${row.id}`, kind: en ? 'Heat' : 'Ζέστη', what: row.dishName, when: row.processTime, status: row.limitStatus, path: row.productionId ? `/kitchen/days/${row.productionId}` : '' })),
    ...summary.defrosting.map(row => ({ id: `d-${row.id}`, kind: en ? 'Defrost' : 'Απόψυξη', what: `${row.productName}${row.endedAt ? '' : ` · ${en ? 'in progress' : 'σε εξέλιξη'}`}`, when: timeOf(row.endedAt || row.startedAt), status: row.limitStatus, path: row.productionId ? `/kitchen/days/${row.productionId}` : production ? `/kitchen/days/${production.id}` : '' })),
    ...summary.pureeing.map(row => ({ id: `p-${row.id}`, kind: en ? 'Pureeing' : 'Πολτοποίηση', what: row.productName, when: '', status: row.limitStatus, path: row.productionId ? `/kitchen/days/${row.productionId}` : '' })),
  ]
  return <div className="kitchen-overview">
    <nav className="kitchen-attention" aria-label={en ? 'What needs action' : 'Τι χρειάζεται ενέργεια'}>
      <span className={summary.outOfLimits.length ? 'is-alert' : ''}><strong>{summary.outOfLimits.length}</strong>{en ? 'out of limits (30 d)' : 'εκτός ορίων (30 ημ.)'}</span>
      <button type="button" className={summary.expiring.length ? 'is-alert' : ''} onClick={onStockAttention}><strong>{summary.expiring.length}</strong>{en ? 'expire soon / expired' : 'λήγουν / έληξαν'}</button>
      <button type="button" className={summary.toVerify ? 'is-alert' : ''} onClick={() => onTab('safety')}><strong>{summary.toVerify}</strong>{en ? 'days to verify' : 'ημέρες προς επαλήθευση'}</button>
    </nav>
    <section className="kitchen-card">
      <SectionHeader title={`${en ? 'Today' : 'Σήμερα'} · ${weekdayLabel(weekdayOf(summary.today), language)} ${fmtDay(summary.today)}`} subtitle={production ? (production.verifiedAt ? `${en ? 'Signed off by' : 'Επαληθεύτηκε από'} ${production.verifiedByName || '—'}` : (en ? 'Production day open' : 'Η ημέρα παραγωγής είναι ανοιχτή')) : (en ? 'No production day yet' : 'Δεν έχει ανοίξει ημέρα παραγωγής')} />
      {production?.menuText && <pre className="kitchen-menu-text is-compact">{production.menuText}</pre>}
      <RegistryTable className="kitchen-table" rows={todayRows.slice(0, 4)} rowKey={row => row.id} columns={[{ key: 'kind', label: en ? 'Record' : 'Καταγραφή' }, { key: 'what', label: en ? 'What' : 'Τι' }, { key: 'when', label: en ? 'Time' : 'Ώρα' }, { key: 'status', label: en ? 'Limits' : 'Όρια' }]}
        emptyTitle={en ? 'Nothing recorded today' : 'Τίποτα καταγεγραμμένο σήμερα'} emptyText={en ? 'Receipts, heat parameters, defrosting and pureeing of today appear here.' : 'Εδώ εμφανίζονται οι σημερινές παραλαβές, θερμοκρασίες, αποψύξεις και πολτοποιήσεις.'}
        rowProps={row => (row.path ? { className: 'registry-row-clickable', onClick: () => navigate(row.path) } : {})}
        renderRow={row => <><td>{row.kind}</td><td>{row.what}</td><td className="nowrap-cell">{row.when || '—'}</td><td><LimitBadge status={row.status} language={language} /></td></>} />
      {todayRows.length > 4 && <p className="kitchen-muted">{en ? `+${todayRows.length - 4} more in the production day` : `+${todayRows.length - 4} ακόμη στην ημέρα παραγωγής`}</p>}
    </section>
    <div className="kitchen-overview-side">
      <section className="kitchen-card">
        <SectionHeader title={en ? 'Out of limits (30 days)' : 'Εκτός ορίων (30 ημέρες)'} subtitle={en ? `${summary.outOfLimitsAll} in the whole history` : `${summary.outOfLimitsAll} σε όλο το ιστορικό`} />
        <RegistryTable className="kitchen-table" rows={summary.outOfLimits.slice(0, 3)} rowKey={row => `${row.kind}-${row.id}`} columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'record', label: en ? 'Record' : 'Καταγραφή' }, { key: 'action', label: en ? 'Corrective action' : 'Διορθωτική ενέργεια' }, { key: 'report', label: '' }]}
          emptyTitle={en ? 'Every measurement within limits' : 'Όλες οι μετρήσεις εντός ορίων'}
          renderRow={row => <>
            <td className="nowrap-cell">{fmtDay(row.date)}</td>
            <td><strong>{row.title}</strong><small>{kindLabel[row.kind]}{row.detail ? ` · ${row.detail}` : ''}</small></td>
            <td className="kitchen-text-cell">{row.action ? <span className="kitchen-clamp" title={row.action}>{row.action}</span> : <SignalBadge tone="danger">{en ? 'Missing' : 'Λείπει'}</SignalBadge>}</td>
            <td>{access.canRecord && <IconButton size="sm" label={en ? 'Report a deviation' : 'Αναφορά απόκλισης'} onClick={() => report(row.title, [`${kindLabel[row.kind]} · ${fmtDay(row.date)}`, row.detail, row.action && `${en ? 'Corrective action' : 'Διορθωτική ενέργεια'}: ${row.action}`], row.date)}><AlertTriangle size={14} /></IconButton>}</td>
          </>} />
      </section>
      <section className="kitchen-card">
        <SectionHeader title={en ? 'Days to verify' : 'Ημέρες προς επαλήθευση'} subtitle={en ? 'Days waiting for the sign-off (30 days).' : 'Ημέρες που περιμένουν επαλήθευση (30 ημέρες).'} />
        <RegistryTable className="kitchen-table" rows={queue.slice(0, 3).map(row => ({ ...row, id: row.production.id }))} rowKey={row => row.id} columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'records', label: en ? 'Records' : 'Καταγραφές' }, { key: 'out', label: en ? 'Out of limits' : 'Εκτός ορίων' }]}
          emptyTitle={en ? 'Nothing to verify' : 'Τίποτα προς επαλήθευση'}
          rowProps={row => ({ className: 'registry-row-clickable', onClick: () => onOpenDay(row.production.id) })}
          renderRow={row => <><td className="nowrap-cell"><strong>{fmtDay(row.production.productionDate)}</strong><small>{weekdayLabel(weekdayOf(row.production.productionDate), language)}</small></td><td>{row.total}</td><td>{row.outOfLimits ? <SignalBadge tone="danger">{row.outOfLimits}</SignalBadge> : '—'}</td></>} />
      </section>
    </div>
  </div>
}

export function StockNotes({ row, language }) {
  const en = language === 'en'
  return <span className="kitchen-notes">
    {!row.inStock && <SignalBadge tone="neutral">{en ? 'Rejected' : 'Απορρίφθηκε'}</SignalBadge>}
    {row.expired && <SignalBadge tone="danger">{en ? 'Expired' : 'Έληξε'}</SignalBadge>}
    {row.expiring && <SignalBadge tone="warning">{row.daysLeft === 0 ? (en ? 'Expires today' : 'Λήγει σήμερα') : (en ? `Expires in ${row.daysLeft} d` : `Λήγει σε ${row.daysLeft} ημ.`)}</SignalBadge>}
    {row.low && <SignalBadge tone="info">{en ? 'Low stock' : 'Χαμηλό απόθεμα'}</SignalBadge>}
    {row.overused && <SignalBadge tone="warning">{en ? 'To check · used more than received' : 'Προς έλεγχο · υπερκατανάλωση'}</SignalBadge>}
  </span>
}

// --- Receipts -------------------------------------------------------------------------------

export function ReceiptsPanel({ state, access, onDialog, filters, setFilters, switcher = null }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const suppliers = useMemo(() => [...new Map(state.receipts.map(row => [row.supplierId || row.supplierName, row.supplierName])).entries()].filter(([key]) => key).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'el')), [state.receipts])
  const rows = state.receipts.filter(row => (filters.result === 'all' || row.result === filters.result) && (filters.supplier === 'all' || (row.supplierId || row.supplierName) === filters.supplier) && (filters.limits === 'all' || row.limitStatus === filters.limits) && inPeriod(row.receivedOn, filters.from, filters.to) && matches(filters.query, row.code, row.supplierName, row.orderReference, row.receiverName, ...(row.items || []).map(item => `${item.productName} ${item.batchCode}`)))
    .sort((a, b) => String(b.receivedOn).localeCompare(String(a.receivedOn)) || String(b.receivedTime || '').localeCompare(String(a.receivedTime || '')) || String(b.code).localeCompare(String(a.code)))
  const active = ['result', 'supplier', 'limits'].filter(key => filters[key] !== 'all').length + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search code, supplier, product, batch…' : 'Αναζήτηση κωδικού, προμηθευτή, προϊόντος, παρτίδας…'} activeFilters={active} end={switcher}
    onClear={() => setFilters(current => ({ ...current, query: '', result: 'all', supplier: 'all', limits: 'all', from: '', to: '' }))}
    filters={<>
      <FilterSelect label={en ? 'Result' : 'Αποτέλεσμα'} value={filters.result} onChange={value => set('result', value)}><option value="all">{en ? 'All' : 'Όλα'}</option>{RECEIPT_RESULTS.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
      <FilterSelect label={en ? 'Limits' : 'Όρια'} value={filters.limits} onChange={value => set('limits', value)}><option value="all">{en ? 'All' : 'Όλα'}</option><option value="out">{en ? 'Out of limits' : 'Εκτός ορίων'}</option><option value="in">{en ? 'Within limits' : 'Εντός ορίων'}</option></FilterSelect>
      <FilterSelect label={en ? 'Supplier' : 'Προμηθευτής'} value={filters.supplier} onChange={value => set('supplier', value)}><option value="all">{en ? 'All' : 'Όλοι'}</option>{suppliers.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</FilterSelect>
      <FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => set('from', value)} />
      <FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => set('to', value)} />
    </>}
    columns={[{ key: 'code', label: en ? 'Receipt' : 'Παραλαβή' }, { key: 'supplier', label: en ? 'Supplier' : 'Προμηθευτής' }, { key: 'items', label: en ? 'Products' : 'Προϊόντα' }, { key: 'checks', label: en ? 'Checks' : 'Έλεγχοι' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }]}
    empty={!rows.length} emptyTitle={en ? 'No receipts' : 'Δεν υπάρχουν παραλαβές'} emptyText={en ? 'Every delivery is recorded here with its checks and products.' : 'Κάθε παράδοση καταγράφεται εδώ με τους ελέγχους και τα προϊόντα της.'}
    emptyIcon={Truck} emptyAction={access?.canRecord && onDialog ? { label: en ? 'New receipt' : 'Νέα παραλαβή', icon: Plus, onClick: () => onDialog({ type: 'receipt', initial: newReceipt() }) } : null}
    rowProps={row => ({ className: 'registry-row-clickable', onClick: () => navigate(`/kitchen/receipts/${row.id}`) })}
    renderRow={row => { const bad = RECEIPT_CHECK_FIELDS.filter(item => row[item.field] === 'noncompliant'); return <>
      <td className="nowrap-cell"><strong>{fmtDay(row.receivedOn)}{row.receivedTime ? ` · ${row.receivedTime}` : ''}</strong><small>{row.code}</small></td>
      <td>{row.supplierName || '—'}{row.orderReference && <small>{en ? 'Order' : 'Παραγγελία'} {row.orderReference}</small>}</td>
      <td>{(row.items || []).length ? (row.items || []).slice(0, 2).map(item => item.productName).join(' · ') : '—'}{(row.items || []).length > 2 && <small>+{row.items.length - 2}</small>}</td>
      <td>{bad.length ? <span className="kitchen-notes">{bad.map(item => <SignalBadge key={item.field} tone="danger">{item.label[en ? 1 : 0]}</SignalBadge>)}</span> : row.limitStatus === 'out' ? <LimitBadge status="out" language={language} /> : row.limitStatus === 'in' ? (en ? 'All compliant' : 'Όλοι σε συμμόρφωση') : '—'}{row.measuredTemperature !== '' && row.measuredTemperature != null && <small>{fmtTemp(row.measuredTemperature, language)}</small>}</td>
      <td><SignalBadge tone={receiptResultTone(row.result)}>{receiptResultLabel(row.result, language)}</SignalBadge></td>
    </> }} />
}

// --- Stock and catalogue ----------------------------------------------------------------------

export function StockPanel({ state, stock, access, filters, setFilters, onDialog, onTrace, reload, organizationId, view = 'stock', switcher = null, onView }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { confirm, notify } = useFeedback()
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const suppliers = new Map((state.suppliers || []).map(item => [item.id, item.name]))
  const rows = stock.filter(row => (filters.show === 'all' || (filters.show === 'in' && row.inStock && row.remaining > 0.0005) || (filters.show === 'attention' && (row.expiring || row.expired || row.low || row.overused))) && (filters.storage === 'all' || row.storage === filters.storage) && matches(filters.query, row.productName, row.supplierName, row.batchCode, row.lotLabel, row.receiptCode))
    .sort((a, b) => String(b.receivedOn).localeCompare(String(a.receivedOn)) || String(a.productName).localeCompare(String(b.productName), 'el'))
  const products = (state.products || []).map(item => ({ ...item, supplierName: suppliers.get(item.supplierId) || '', categoryLabel: categoryLabel(item.category, language) }))
    .filter(item => (filters.category === 'all' || item.category === filters.category) && matches(filters.query, item.name, item.supplierName, item.supplierCode))
    .sort((a, b) => (a.supplierName ? 0 : 1) - (b.supplierName ? 0 : 1) || String(a.supplierName).localeCompare(String(b.supplierName), 'el') || a.name.localeCompare(b.name, 'el'))
  // Grouped by supplier, as FileMaker's «ΛΙΣΤΑ ΠΡΟΪΟΝΤΩΝ».
  const grouped = products.flatMap((item, index) => (index === 0 || products[index - 1].supplierName !== item.supplierName ? [{ id: `group-${item.supplierName || 'none'}-${index}`, group: item.supplierName || (en ? 'No supplier' : 'Χωρίς προμηθευτή'), count: products.filter(other => other.supplierName === item.supplierName).length }, item] : [item]))
  const inner = <ModeSwitch ariaLabel={en ? 'Stock view' : 'Προβολή αποθέματος'} value={view} onChange={onView} options={[{ value: 'stock', label: en ? 'Received products' : 'Παραληφθέντα προϊόντα', icon: Package }, { value: 'products', label: en ? 'Product list' : 'Λίστα προϊόντων', icon: ClipboardCheck }]} />
  async function removeProduct(item) {
    if (!await confirm({ title: en ? 'Delete product' : 'Διαγραφή προϊόντος', message: en ? 'The product leaves the catalogue; receipts keep its name. A product no longer bought is better made inactive.' : 'Το προϊόν φεύγει από τη λίστα· οι παραλαβές κρατούν το όνομά του. Για προϊόν που δεν αγοράζεται πια, προτιμήστε «Ανενεργό».', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeEntry(organizationId, 'kitchen_products', item.id); await reload() } catch (error) { notify(kitchenErrorMessage(error, language), 'error') }
  }
  if (view === 'products') return <KitchenList rows={grouped} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search product, supplier, code…' : 'Αναζήτηση προϊόντος, προμηθευτή, κωδικού…'} activeFilters={filters.category !== 'all' ? 1 : 0}
    onClear={() => setFilters(current => ({ ...current, query: '', category: 'all' }))} end={<>{switcher}{inner}{access.canManage && <Button onClick={() => onDialog({ type: 'product', initial: newProduct() })}><Plus size={15} />{en ? 'Product' : 'Προϊόν'}</Button>}</>}
    filters={<FilterSelect label={en ? 'Category' : 'Κατηγορία'} value={filters.category} onChange={value => set('category', value)}><option value="all">{en ? 'All' : 'Όλες'}</option>{PRODUCT_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>}
    columns={[{ key: 'code', label: en ? 'Supplier code' : 'Κωδικός προμηθευτή' }, { key: 'name', label: en ? 'Product' : 'Ονομασία / περιγραφή προϊόντος' }, { key: 'category', label: en ? 'Category' : 'Κατηγορία' }, { key: 'storage', label: en ? 'Storage' : 'Αποθήκευση' }, { key: 'actions', label: '' }]}
    rowProps={item => (item.group ? { className: 'kitchen-group-row' } : {})}
    empty={!products.length} emptyTitle={en ? 'No products' : 'Δεν υπάρχουν προϊόντα'} emptyText={en ? 'The products the kitchen receives, with their storage and supplier.' : 'Τα προϊόντα που παραλαμβάνει η κουζίνα, με την αποθήκευση και τον προμηθευτή τους.'}
    renderRow={item => item.group ? <td colSpan={5}><strong>{item.group}</strong><small>{item.count} {en ? 'products' : 'προϊόντα'}</small></td> : <>
      <td className="nowrap-cell">{item.supplierCode || '—'}</td>
      <td><strong>{item.name}</strong>{item.active === false && <small>{en ? 'Inactive' : 'Ανενεργό'}</small>}</td>
      <td>{item.categoryLabel}</td><td>{storageLabel(item.storage, language)}{item.lowStockQuantity !== '' && item.lowStockQuantity != null && <small>{en ? 'low at' : 'χαμηλό κάτω από'} {fmtQty(item.lowStockQuantity, language)} {unitLabel(item.unit, language)}</small>}</td>
      <td><div className="row-actions">{access.canManage && <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => onDialog({ type: 'product', initial: { ...item } })}><Pencil size={14} /></IconButton>}{access.canManage && <IconButton size="sm" tone="danger" label={en ? 'Delete' : 'Διαγραφή'} onClick={() => removeProduct(item)}><Trash2 size={14} /></IconButton>}</div></td>
    </>} />
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search product, supplier, batch…' : 'Αναζήτηση προϊόντος, προμηθευτή, παρτίδας…'} activeFilters={(filters.show !== 'in' ? 1 : 0) + (filters.storage !== 'all' ? 1 : 0)}
    onClear={() => setFilters(current => ({ ...current, query: '', show: 'in', storage: 'all' }))} end={<>{switcher}{inner}</>}
    filters={<>
      <FilterSelect label={en ? 'Show' : 'Εμφάνιση'} value={filters.show} onChange={value => set('show', value)}><option value="in">{en ? 'In stock' : 'Σε απόθεμα'}</option><option value="attention">{en ? 'Expiry, low, overuse' : 'Λήξεις, χαμηλό, υπερκατανάλωση'}</option><option value="all">{en ? 'Every batch' : 'Όλες οι παρτίδες'}</option></FilterSelect>
      <FilterSelect label={en ? 'Storage' : 'Αποθήκευση'} value={filters.storage} onChange={value => set('storage', value)}><option value="all">{en ? 'All' : 'Όλες'}</option>{STORAGES.map(item => <option key={item.value} value={item.value}>{item.label[en ? 1 : 0]}</option>)}</FilterSelect>
    </>}
    columns={[{ key: 'received', label: en ? 'Received' : 'Ημ/νία παραλαβής' }, { key: 'product', label: en ? 'Product' : 'Προϊόν' }, { key: 'supplier', label: en ? 'Supplier' : 'Προμηθευτής' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }, { key: 'used', label: en ? 'Used' : 'Καταναλώσεις' }, { key: 'left', label: en ? 'Remaining' : 'Υπόλοιπο' }, { key: 'expiry', label: en ? 'Expiry' : 'Λήξη' }, { key: 'actions', label: '' }]}
    empty={!rows.length} emptyTitle={en ? 'No batches in stock' : 'Δεν υπάρχουν παρτίδες σε απόθεμα'} emptyText={en ? 'Each product of an accepted receipt is a batch here; what production uses comes off it.' : 'Κάθε προϊόν αποδεκτής παραλαβής είναι εδώ μια παρτίδα· ό,τι χρησιμοποιεί η παραγωγή αφαιρείται από αυτήν.'}
    renderRow={row => <>
      <td className="nowrap-cell">{fmtDay(row.receivedOn)}<small>{row.receiptCode}</small></td>
      <td><strong>{row.productName}</strong><small>{[row.batchCode || row.lotLabel, storageLabel(row.storage, language)].filter(Boolean).join(' · ')}</small></td>
      <td>{row.supplierName || '—'}</td>
      <td className="nowrap-cell">{fmtQty(row.received, language)} {unitLabel(row.unit, language)}</td>
      <td className="nowrap-cell">{row.used ? fmtQty(row.used, language) : '—'}{row.writtenOff > 0 && <small>{en ? 'withdrawn' : 'απόσυρση'} {fmtQty(row.writtenOff, language)}</small>}</td>
      <td className="nowrap-cell"><strong>{fmtQty(row.remaining, language)}</strong><StockNotes row={row} language={language} /></td>
      <td className="nowrap-cell">{fmtDay(row.expiryOn)}</td>
      <td><div className="row-actions">
        <IconButton size="sm" label={en ? 'Traceability' : 'Ιχνηλάτηση'} onClick={() => onTrace(row.receiptItemId)}><Route size={14} /></IconButton>
        {access.canRecord && row.inStock && row.remaining > 0.0005 && <Button variant="secondary" onClick={() => onDialog({ type: 'writeoff', batch: row })}><Undo2 size={15} />{en ? 'Withdraw' : 'Απόσυρση'}</Button>}
      </div></td>
    </>} />
}

// The traceability of one batch, with its document.
export function TraceDialog({ state: loaded, organizationId = null, receiptItemId, onClose }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const navigate = useNavigate()
  // Every use of the batch, also those older than the loaded window.
  const subject = useMemo(() => ({ receiptItemIds: [receiptItemId] }), [receiptItemId])
  const { state } = useKitchenTrace(loaded, organizationId, subject)
  const trace = useMemo(() => traceBatch(state, receiptItemId), [state, receiptItemId])
  const b = trace.batch
  const blocked = () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  return <ObserverDialog width="wide" title={en ? 'Traceability' : 'Ιχνηλάτηση'} subtitle={b ? `${b.productName} · ${b.receiptCode}` : ''} onClose={onClose} footer={<DialogActions><ExportMenu {...reportExports(() => traceabilityDocument(trace, { language }), { onBlocked: blocked })} /></DialogActions>}>
    {b && <RecordDetailsGrid fields={[{ label: en ? 'Supplier' : 'Προμηθευτής', value: b.supplierName }, { label: en ? 'Received' : 'Παραλαβή', value: `${fmtDay(b.receivedOn)} · ${b.receiptCode}` }, { label: en ? 'Batch' : 'Παρτίδα', value: b.batchCode || b.lotLabel }, { label: en ? 'Expiry' : 'Λήξη', value: fmtDay(b.expiryOn) },
      { label: en ? 'Received qty' : 'Ποσότητα', value: `${fmtQty(b.received, language)} ${unitLabel(b.unit, language)}` }, { label: en ? 'Used' : 'Καταναλώσεις', value: fmtQty(b.used, language) }, { label: en ? 'Withdrawn' : 'Απόσυρση', value: fmtQty(b.writtenOff, language) }, { label: en ? 'Remaining' : 'Υπόλοιπο', value: fmtQty(b.remaining, language) }]} />}
    <SectionHeader title={en ? 'Where it was used' : 'Πού χρησιμοποιήθηκε'} />
    <RegistryTable className="kitchen-table" rows={trace.uses} rowKey={row => row.id} columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'dish', label: en ? 'Dish' : 'Πιάτο' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }, { key: 'by', label: en ? 'By' : 'Από' }]}
      emptyTitle={en ? 'Not used yet' : 'Δεν έχει χρησιμοποιηθεί'} rowProps={row => (row.productionId ? { className: 'registry-row-clickable', onClick: () => { onClose(); navigate(`/kitchen/days/${row.productionId}`) } } : {})}
      renderRow={row => <><td className="nowrap-cell">{fmtDay(row.usedOn)}</td><td>{row.dishName || '—'}</td><td className="nowrap-cell">{fmtQty(row.quantity, language)} {unitLabel(row.unit, language)}</td><td>{row.recordedByName || '—'}</td></>} />
    {trace.writeoffs.length > 0 && <><SectionHeader title={en ? 'Withdrawn / discarded' : 'Απόσυρση / απόρριψη'} />
      <RegistryTable className="kitchen-table" rows={trace.writeoffs} rowKey={row => row.id} columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }, { key: 'notes', label: en ? 'Notes' : 'Σημειώσεις' }]}
        renderRow={row => <><td className="nowrap-cell">{fmtDay(row.writtenOffOn)}</td><td>{fmtQty(row.quantity, language)}</td><td>{row.notes || '—'}</td></>} /></>}
  </ObserverDialog>
}

// --- Menu & plan -----------------------------------------------------------------------------

export function PlanPanel({ state, access, filters, setFilters, onDialog, onOpenDay }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const view = filters.view || 'days'
  const switcher = <ModeSwitch ariaLabel={en ? 'View' : 'Προβολή'} value={view} onChange={value => set('view', value)} options={[{ value: 'days', label: en ? 'Production days' : 'Ημέρες παραγωγής', icon: ChefHat }, { value: 'menus', label: en ? 'Standard menus' : 'Τυπικά μενού', icon: ClipboardCheck }]} />
  if (view === 'menus') {
    const menus = [...state.menus].filter(item => matches(filters.query, item.name, item.menuText)).sort((a, b) => (Number(a.weekday) || 9) - (Number(b.weekday) || 9))
    return <KitchenList rows={menus} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search menu…' : 'Αναζήτηση μενού…'} onClear={() => set('query', '')} end={<>{switcher}{access.canManage && <Button onClick={() => onDialog({ type: 'menu', initial: newMenu() })}><Plus size={15} />{en ? 'Menu' : 'Μενού'}</Button>}</>}
      columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'menu', label: en ? 'Menu' : 'Μενού' }, { key: 'actions', label: '' }]} empty={!menus.length} emptyTitle={en ? 'No standard menus' : 'Δεν υπάρχουν τυπικά μενού'} emptyText={en ? 'One menu per weekday: a new production day starts from it.' : 'Ένα μενού ανά ημέρα της εβδομάδας: από αυτό ξεκινά κάθε νέα ημέρα παραγωγής.'}
      renderRow={item => <><td className="nowrap-cell"><strong>{item.name}</strong><small>{item.weekday ? weekdayLabel(Number(item.weekday), language) : (en ? 'Any day' : 'Οποιαδήποτε ημέρα')}{item.active === false ? ` · ${en ? 'inactive' : 'ανενεργό'}` : ''}</small></td><td><pre className="kitchen-menu-text is-compact">{item.menuText || '—'}</pre></td>
        <td>{access.canManage && <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => onDialog({ type: 'menu', initial: { ...item, weekday: item.weekday ? String(item.weekday) : '' } })}><Pencil size={14} /></IconButton>}</td></>} />
  }
  const today = todayKey()
  const days = state.productions.map(item => ({ ...item, records: dayRecords(state, item) }))
    .filter(item => (filters.when === 'all' || (filters.when === 'upcoming' ? item.productionDate >= today : item.productionDate < today)) && inPeriod(item.productionDate, filters.from, filters.to) && matches(filters.query, item.menuText, item.notes, fmtDay(item.productionDate)))
    .sort((a, b) => String(b.productionDate).localeCompare(String(a.productionDate)))
  const active = (filters.when !== 'all' ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  return <KitchenList rows={days} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search menu, notes, date…' : 'Αναζήτηση μενού, σημειώσεων, ημερομηνίας…'} activeFilters={active} onClear={() => setFilters(current => ({ ...current, query: '', when: 'all', from: '', to: '' }))}
    end={switcher}
    filters={<><FilterSelect label={en ? 'Days' : 'Ημέρες'} value={filters.when} onChange={value => set('when', value)}><option value="all">{en ? 'All' : 'Όλες'}</option><option value="upcoming">{en ? 'Today and planned' : 'Σήμερα και προγραμματισμένες'}</option><option value="past">{en ? 'Past' : 'Περασμένες'}</option></FilterSelect><FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => set('from', value)} /><FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => set('to', value)} /></>}
    columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'menu', label: en ? 'Daily menu' : 'Μενού ημέρας' }, { key: 'records', label: en ? 'Records' : 'Καταγραφές' }, { key: 'verify', label: en ? 'Verification' : 'Επαλήθευση' }]}
    empty={!days.length} emptyTitle={en ? 'No production days' : 'Δεν υπάρχουν ημέρες παραγωγής'} emptyText={en ? 'Open the day from its menu, then record what the production uses and the heat parameters.' : 'Ανοίξτε την ημέρα από το μενού της και καταγράψτε τις πρώτες ύλες και τις παραμέτρους ζέστης.'}
    rowProps={item => ({ className: 'registry-row-clickable', onClick: () => onOpenDay(item.id) })}
    renderRow={item => <>
      <td className="nowrap-cell"><strong>{fmtDay(item.productionDate)}</strong><small>{weekdayLabel(weekdayOf(item.productionDate), language)}{item.productionDate > today ? ` · ${en ? 'planned' : 'προγραμματισμένη'}` : ''}</small></td>
      <td className="kitchen-text-cell">{(item.menuText || '—').split('\n').filter(line => line.trim()).slice(0, 3).join(' · ')}</td>
      <td className="nowrap-cell">{item.records.usage.length} {en ? 'materials' : 'α΄ ύλες'} · {item.records.thermal.length} {en ? 'heat' : 'ζέστη'}{item.records.outOfLimits > 0 && <small><SignalBadge tone="danger">{item.records.outOfLimits} {en ? 'out of limits' : 'εκτός ορίων'}</SignalBadge></small>}</td>
      <td>{item.verifiedAt ? <SignalBadge tone="success">{item.verifiedByName || (en ? 'Signed off' : 'Επαληθεύτηκε')}</SignalBadge> : item.productionDate <= today ? <SignalBadge tone="warning">{en ? 'Pending' : 'Εκκρεμεί'}</SignalBadge> : '—'}</td>
    </>} />
}

// --- Verification queue -----------------------------------------------------------------------

export function VerificationPanel({ state, filters, setFilters, onOpenDay }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const today = todayKey()
  const rows = verificationQueue(state, { today, since: filters.range === 'all' ? '' : addDays(today, -Number(filters.range || 30)) }).map(row => ({ ...row, id: row.production.id }))
    .filter(row => matches(filters.query, row.production.menuText, fmtDay(row.production.productionDate)))
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search date or menu…' : 'Αναζήτηση ημερομηνίας ή μενού…'} activeFilters={filters.range !== '30' ? 1 : 0} onClear={() => setFilters(current => ({ ...current, query: '', range: '30' }))}
    filters={<FilterSelect label={en ? 'Period' : 'Περίοδος'} value={filters.range} onChange={value => set('range', value)}><option value="7">{en ? 'Last 7 days' : 'Τελευταίες 7 ημέρες'}</option><option value="30">{en ? 'Last 30 days' : 'Τελευταίες 30 ημέρες'}</option><option value="all">{en ? 'Every unverified day' : 'Όλες οι ανεπαλήθευτες ημέρες'}</option></FilterSelect>}
    columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'records', label: en ? 'Records' : 'Καταγραφές' }, { key: 'out', label: en ? 'Out of limits' : 'Εκτός ορίων' }, { key: 'defrost', label: en ? 'Defrosts to sign' : 'Αποψύξεις προς επαλήθευση' }]}
    empty={!rows.length} emptyTitle={en ? 'Nothing to verify' : 'Τίποτα προς επαλήθευση'} emptyText={en ? 'Every production day of the period is signed off.' : 'Όλες οι ημέρες παραγωγής της περιόδου έχουν επαληθευτεί.'}
    rowProps={row => ({ className: 'registry-row-clickable', onClick: () => onOpenDay(row.production.id) })}
    renderRow={row => <>
      <td className="nowrap-cell"><strong>{fmtDay(row.production.productionDate)}</strong><small>{weekdayLabel(weekdayOf(row.production.productionDate), language)}</small></td>
      <td>{[`${row.receipts.length} ${en ? 'receipts' : 'παραλαβές'}`, `${row.usage.length} ${en ? 'materials' : 'α΄ ύλες'}`, `${row.thermal.length} ${en ? 'heat' : 'ζέστη'}`, `${row.pureeing.length} ${en ? 'pureeing' : 'πολτοπ.'}`, `${row.defrosting.length} ${en ? 'defrost' : 'αποψ.'}`].join(' · ')}</td>
      <td>{row.outOfLimits ? <SignalBadge tone="danger">{row.outOfLimits}</SignalBadge> : '—'}</td>
      <td>{row.pendingDefrosts || '—'}</td>
    </>} />
}

// --- HACCP plan, limits, review ---------------------------------------------------------------

const HAZARD_LABELS = [['hazardBiological', 'Βιολογικός', 'Biological'], ['hazardChemical', 'Χημικός', 'Chemical'], ['hazardPhysical', 'Φυσικός', 'Physical'], ['hazardAllergen', 'Αλλεργιογόνα', 'Allergens']]
export function HaccpPanel({ state, access, onDialog }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const review = haccpReviewDue(state.settings)
  const limitOf = key => state.limits.find(item => item.limitKey === key)
  return <div className="kitchen-haccp">
    <section className="kitchen-card">
      <SectionHeader title={en ? 'Review of the HACCP plan' : 'Ανασκόπηση σχεδίου HACCP'} subtitle={en ? 'The HACCP team reviews hazards, CCPs and limits at least yearly and after every change.' : 'Η ομάδα HACCP ανασκοπεί κινδύνους, CCP και όρια τουλάχιστον ετησίως και μετά από κάθε αλλαγή.'} actions={access.canManage && <IconButton label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => onDialog({ type: 'settings' })}><Pencil size={15} /></IconButton>} />
      <RecordDetailsGrid fields={[{ label: en ? 'Last review' : 'Τελευταία ανασκόπηση', value: fmtDay(state.settings?.haccpLastReviewOn) }, { label: en ? 'Next review' : 'Επόμενη ανασκόπηση', value: review ? fmtDay(review) : '—', meta: review && review < todayKey() ? (en ? 'Overdue' : 'Εκπρόθεσμη') : '' }, { label: en ? 'Every (months)' : 'Κάθε (μήνες)', value: String(state.settings?.haccpReviewMonths || 12) }, { label: en ? 'Expiry warning (days)' : 'Ειδοποίηση λήξης (ημέρες)', value: String(state.settings?.expiryWarningDays ?? 2) }, { label: en ? 'Recall drill every (months)' : 'Άσκηση ανάκλησης κάθε (μήνες)', value: String(state.settings?.recallDrillMonths || 12) }, { label: en ? 'HACCP team' : 'Ομάδα HACCP', value: state.settings?.haccpTeam || '—', className: 'kitchen-span-2' }]} />
    </section>
    <section className="kitchen-card">
      <SectionHeader title={en ? 'Critical limits' : 'Κρίσιμα όρια'} subtitle={en ? 'Each measurement is marked within / out of limits automatically; out of limits needs a corrective action.' : 'Κάθε μέτρηση χαρακτηρίζεται αυτόματα εντός / εκτός ορίων· εκτός ορίων χρειάζεται διορθωτική ενέργεια.'} actions={access.canManage && <Button variant="secondary" onClick={() => onDialog({ type: 'limits' })}><Pencil size={15} />{en ? 'Limits' : 'Όρια'}</Button>} />
      <RegistryTable className="kitchen-table" rows={state.limits} rowKey={row => row.limitKey} columns={[{ key: 'what', label: en ? 'Measurement' : 'Μέτρηση' }, { key: 'limit', label: en ? 'Limit' : 'Όριο' }, { key: 'on', label: en ? 'Checked' : 'Ελέγχεται' }]}
        renderRow={row => <><td>{row.label[en ? 1 : 0]}</td><td className="nowrap-cell"><strong>{limitText(row, language)}</strong></td><td>{row.active !== false ? (en ? 'Yes' : 'Ναι') : (en ? 'No' : 'Όχι')}</td></>} />
    </section>
    <section className="kitchen-card kitchen-card-wide">
      <SectionHeader title={en ? 'HACCP plan: hazards and critical control points' : 'Σχέδιο HACCP: κίνδυνοι και κρίσιμα σημεία ελέγχου'} subtitle={en ? 'Per process step: hazards, control measure, CCP and limit, monitoring, corrective action, verification and records.' : 'Ανά στάδιο: κίνδυνοι, μέτρο ελέγχου, CCP και όριο, παρακολούθηση, διορθωτική ενέργεια, επαλήθευση και αρχεία.'}
        actions={access.canManage && <Button variant="secondary" onClick={() => onDialog({ type: 'step', initial: { position: (state.steps.length || 0) + 1, name: '', hazardBiological: true, hazardChemical: false, hazardPhysical: false, hazardAllergen: false, isCcp: false, limitKey: '', active: true } })}><Plus size={15} />{en ? 'Step' : 'Στάδιο'}</Button>} />
      <RegistryTable className="kitchen-table kitchen-plan-table" rows={[...state.steps].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))} rowKey={row => row.id}
        columns={[{ key: 'step', label: en ? 'Step' : 'Στάδιο' }, { key: 'hazards', label: en ? 'Hazards' : 'Κίνδυνοι' }, { key: 'ccp', label: 'CCP' }, { key: 'monitor', label: en ? 'Monitoring' : 'Παρακολούθηση' }, { key: 'action', label: en ? 'Corrective action' : 'Διορθωτική ενέργεια' }, { key: 'verify', label: en ? 'Verification · records' : 'Επαλήθευση · αρχεία' }, { key: 'edit', label: '' }]}
        emptyTitle={en ? 'No HACCP plan' : 'Δεν υπάρχει σχέδιο HACCP'}
        renderRow={row => <>
          <td><strong>{row.position}. {row.name}</strong>{row.controlMeasure && <small>{row.controlMeasure}</small>}</td>
          <td><span className="kitchen-notes">{HAZARD_LABELS.filter(([key]) => row[key]).map(([key, el, enLabel]) => <SignalBadge key={key} tone="neutral">{en ? enLabel : el}</SignalBadge>)}</span>{row.hazards && <small>{row.hazards}</small>}</td>
          <td>{row.isCcp ? <SignalBadge tone="neutral">CCP</SignalBadge> : '—'}{row.limitKey && <small>{limitText(limitOf(row.limitKey), language)}</small>}</td>
          <td>{row.monitoring || '—'}{row.frequency && <small>{row.frequency}</small>}</td>
          <td className="kitchen-text-cell">{row.correctiveAction || '—'}</td>
          <td>{row.verification || '—'}{row.records && <small>{row.records}</small>}</td>
          <td>{access.canManage && <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => onDialog({ type: 'step', initial: { ...row } })}><Pencil size={14} /></IconButton>}</td>
        </>} />
    </section>
  </div>
}

export function SettingsDialog({ state, organizationId, onClose, onSaved }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const [draft, setDraft] = useState(() => ({ ...state.settings }))
  const [saving, setSaving] = useState(false)
  const set = next => setDraft(current => ({ ...current, ...next }))
  async function save() {
    setSaving(true)
    try { await saveSettings(organizationId, draft); notify(en ? 'Saved.' : 'Αποθηκεύτηκε.', 'success'); await onSaved(); onClose() } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error') } finally { setSaving(false) }
  }
  return <ObserverDialog title={en ? 'HACCP plan review' : 'Ανασκόπηση σχεδίου HACCP'} onClose={onClose} footer={<DialogActions onSave={save} disabled={saving} />}>
    <FormGrid columns={3}>
      <ManualDateField label={en ? 'Last review' : 'Τελευταία ανασκόπηση'} value={draft.haccpLastReviewOn || ''} onChange={value => set({ haccpLastReviewOn: value })} optional />
      <Field label={en ? 'Review every (months)' : 'Ανασκόπηση κάθε (μήνες)'}><input inputMode="numeric" value={draft.haccpReviewMonths ?? 12} onChange={e => set({ haccpReviewMonths: e.target.value.replace(/\D/g, '') })} /></Field>
      <Field label={en ? 'Expiry warning (days)' : 'Ειδοποίηση λήξης (ημέρες)'}><input inputMode="numeric" value={draft.expiryWarningDays ?? 2} onChange={e => set({ expiryWarningDays: e.target.value.replace(/\D/g, '') })} /></Field>
      <Field label={en ? 'Recall drill every (months)' : 'Άσκηση ανάκλησης κάθε (μήνες)'}><input inputMode="numeric" value={draft.recallDrillMonths ?? 12} onChange={e => set({ recallDrillMonths: e.target.value.replace(/\D/g, '') })} /></Field>
    </FormGrid>
    <Field label={en ? 'HACCP team' : 'Ομάδα HACCP'}><textarea rows={2} value={draft.haccpTeam || ''} onChange={e => set({ haccpTeam: e.target.value })} /></Field>
    <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={2} value={draft.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
  </ObserverDialog>
}

// Sign-off and reopening, shared by the page and the day record.
export function useSignOff(organizationId, reload) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { confirm, notify } = useFeedback()
  const actor = useKitchenActor()
  const sign = async (table, row) => {
    const notes = await confirm({ title: en ? 'Sign-off' : 'Επαλήθευση', message: table === 'kitchen_productions' ? (en ? `You confirm that the records of ${fmtDay(row.productionDate)} were reviewed. The day is locked until reopened.` : `Επιβεβαιώνετε ότι ελέγξατε τις καταγραφές της ${fmtDay(row.productionDate)}. Η ημέρα κλειδώνει ώσπου να ανοίξει ξανά.`) : (en ? `You confirm the defrosting of ${row.productName}. The line is locked until reopened.` : `Επιβεβαιώνετε την απόψυξη «${row.productName}». Η γραμμή κλειδώνει ώσπου να ανοίξει ξανά.`),
      confirmLabel: en ? 'Sign off' : 'Επαλήθευση', input: { label: en ? 'Remarks (optional)' : 'Παρατηρήσεις (προαιρετικά)' } })
    if (notes === false) return
    try { await signOff(organizationId, table, row.id, { actor, notes: typeof notes === 'string' ? notes : '' }); notify(en ? 'Signed off.' : 'Επαληθεύτηκε.', 'success'); await reload() } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error') }
  }
  const reopenRow = async (table, row) => {
    const reason = await confirm({ title: en ? 'Reopen' : 'Άνοιγμα ξανά', message: en ? 'The sign-off is removed and the record can be changed. Give the reason.' : 'Η επαλήθευση αφαιρείται και η εγγραφή μπορεί να αλλάξει. Γράψτε την αιτία.', confirmLabel: en ? 'Reopen' : 'Άνοιγμα', input: { label: en ? 'Reason *' : 'Αιτία *', required: true } })
    if (!reason) return
    try { await reopen(organizationId, table, row.id, reason); notify(en ? 'Reopened.' : 'Άνοιξε ξανά.', 'success'); await reload() } catch (error) { console.error(error); notify(kitchenErrorMessage(error, language), 'error') }
  }
  return { sign, reopenRow }
}

