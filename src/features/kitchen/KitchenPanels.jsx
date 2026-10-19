import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChefHat, ClipboardCheck, Package, Pencil, Plus, Route, ShieldCheck, Snowflake, Thermometer, Trash2, Undo2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { StatusBadge } from '../../design-system/StatusBadge'
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
import { KitchenList, LimitBadge, matches, useKitchenActor } from './KitchenShared'
import { limitText } from './kitchenLimits'
import { RECEIPT_CHECK_FIELDS, RECEIPT_RESULTS, STORAGES, PRODUCT_CATEGORIES, categoryLabel, dayOf, defrostMethodLabel, fmtQty, fmtTemp, haccpReviewDue, pureeMethodLabel, receiptResultLabel, receiptResultTone, storageLabel, todayKey, traceBatch, unitLabel, verificationQueue, weekdayLabel, weekdayOf, dayRecords, addDays, newProduct, newMenu, newProduction, newThermal, newDefrost, newPureeing } from './kitchenModel'
import { kitchenErrorMessage, removeEntry, reopen, saveSettings, signOff } from './kitchenService'
import { traceabilityDocument } from './kitchenReports'
import { RecallOverviewCard } from './KitchenRecall'

export const fmtDay = value => { if (!value) return '—'; const [y, m, d] = String(value).slice(0, 10).split('-'); return `${d}/${m}/${y}` }
export const fmtStamp = (value, language) => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) }
const timeOf = value => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const inPeriod = (date, from, to) => (!from || String(date) >= from) && (!to || String(date).slice(0, 10) <= to)
const temp = (value, text, language) => (value !== '' && value != null ? fmtTemp(value, language) : text ? <span className="kitchen-unparsed" title={text}>{text}</span> : '—')

// An entry out of limits can become a quality deviation (the incident report, prefilled).
export function useDeviationReport() {
  const navigate = useNavigate()
  const { language } = useLanguage()
  const en = language === 'en'
  return (title, lines, date) => navigate('/quality/report', { state: { qualitySource: { title: `${en ? 'Kitchen deviation' : 'Απόκλιση κουζίνας (HACCP)'}: ${title}`, description: lines.filter(Boolean).join('\n'), date: String(date || '').slice(0, 10) }, limoxisFrom: { path: '/kitchen', label: en ? 'Kitchen' : 'Κουζίνα' } } })
}

// --- Overview ------------------------------------------------------------------------------

export function OverviewPanel({ state, summary, access, onOpenDay, onDialog, onTab, onRecall }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const report = useDeviationReport()
  const kindLabel = { receipt: en ? 'Receipt' : 'Παραλαβή', thermal: en ? 'Heat treatment' : 'Θερμική επεξεργασία', defrost: en ? 'Defrosting' : 'Απόψυξη', pureeing: en ? 'Pureeing' : 'Πολτοποίηση' }
  const production = summary.production
  return <div className="kitchen-overview">
    <section className="kitchen-card">
      <SectionHeader title={`${en ? 'Today' : 'Σήμερα'} · ${weekdayLabel(weekdayOf(summary.today), language)} ${fmtDay(summary.today)}`} subtitle={production ? (production.verifiedAt ? `${en ? 'Signed off by' : 'Επαληθεύτηκε από'} ${production.verifiedByName || '—'}` : (en ? 'Production day open' : 'Η ημέρα παραγωγής είναι ανοιχτή')) : (en ? 'No production day yet' : 'Δεν έχει ανοίξει ημέρα παραγωγής')}
        actions={production ? <Button onClick={() => onOpenDay(production.id)}><ChefHat size={15} />{en ? 'Production day' : 'Ημέρα παραγωγής'}</Button> : access.canRecord && <Button onClick={() => onDialog({ type: 'production', initial: newProduction(summary.today) })}><Plus size={15} />{en ? 'Open today\'s production' : 'Άνοιγμα σημερινής παραγωγής'}</Button>} />
      {production?.menuText && <pre className="kitchen-menu-text">{production.menuText}</pre>}
      <RegistryTable className="kitchen-table" rows={[
        ...summary.receipts.map(row => ({ id: `r-${row.id}`, kind: en ? 'Receipt' : 'Παραλαβή', what: `${row.code} · ${row.supplierName || ''}`, when: row.receivedTime, status: row.limitStatus, path: `/kitchen/receipts/${row.id}` })),
        ...summary.thermal.map(row => ({ id: `t-${row.id}`, kind: en ? 'Heat' : 'Ζέστη', what: row.dishName, when: row.processTime, status: row.limitStatus, path: row.productionId ? `/kitchen/days/${row.productionId}` : '' })),
        ...summary.defrosting.map(row => ({ id: `d-${row.id}`, kind: en ? 'Defrost' : 'Απόψυξη', what: `${row.productName}${row.endedAt ? '' : ` · ${en ? 'in progress' : 'σε εξέλιξη'}`}`, when: timeOf(row.endedAt || row.startedAt), status: row.limitStatus, path: '' })),
        ...summary.pureeing.map(row => ({ id: `p-${row.id}`, kind: en ? 'Pureeing' : 'Πολτοποίηση', what: row.productName, when: '', status: row.limitStatus, path: row.productionId ? `/kitchen/days/${row.productionId}` : '' })),
      ]} rowKey={row => row.id} columns={[{ key: 'kind', label: en ? 'Record' : 'Καταγραφή' }, { key: 'what', label: en ? 'What' : 'Τι' }, { key: 'when', label: en ? 'Time' : 'Ώρα' }, { key: 'status', label: en ? 'Limits' : 'Όρια' }]}
        emptyTitle={en ? 'Nothing recorded today' : 'Τίποτα καταγεγραμμένο σήμερα'} emptyText={en ? 'Receipts, heat parameters, defrosting and pureeing of today appear here.' : 'Εδώ εμφανίζονται οι σημερινές παραλαβές, θερμοκρασίες, αποψύξεις και πολτοποιήσεις.'}
        rowProps={row => (row.path ? { className: 'registry-row-clickable', onClick: () => navigate(row.path) } : {})}
        renderRow={row => <><td>{row.kind}</td><td>{row.what}</td><td className="nowrap-cell">{row.when || '—'}</td><td><LimitBadge status={row.status} language={language} /></td></>} />
    </section>
    <section className="kitchen-card">
      <SectionHeader title={en ? 'Out of limits (30 days)' : 'Εκτός ορίων (30 ημέρες)'} subtitle={en ? `${summary.outOfLimitsAll} in the whole history` : `${summary.outOfLimitsAll} σε όλο το ιστορικό`} />
      <RegistryTable className="kitchen-table" rows={summary.outOfLimits.slice(0, 12)} rowKey={row => `${row.kind}-${row.id}`} columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'record', label: en ? 'Record' : 'Καταγραφή' }, { key: 'action', label: en ? 'Corrective action' : 'Διορθωτική ενέργεια' }, { key: 'report', label: '' }]}
        emptyTitle={en ? 'Every measurement within limits' : 'Όλες οι μετρήσεις εντός ορίων'}
        renderRow={row => <>
          <td className="nowrap-cell">{fmtDay(row.date)}</td>
          <td><strong>{row.title}</strong><small>{kindLabel[row.kind]}{row.detail ? ` · ${row.detail}` : ''}</small></td>
          <td className="kitchen-text-cell">{row.action || <StatusBadge tone="danger">{en ? 'Missing' : 'Λείπει'}</StatusBadge>}</td>
          <td>{access.canRecord && <Button variant="secondary" onClick={() => report(row.title, [`${kindLabel[row.kind]} · ${fmtDay(row.date)}`, row.detail, row.action && `${en ? 'Corrective action' : 'Διορθωτική ενέργεια'}: ${row.action}`], row.date)}><AlertTriangle size={15} />{en ? 'Deviation' : 'Απόκλιση'}</Button>}</td>
        </>} />
    </section>
    <section className="kitchen-card">
      <SectionHeader title={en ? 'Expiry and low stock' : 'Λήξεις και χαμηλό απόθεμα'} actions={<Button variant="secondary" onClick={() => onTab('stock')}><Package size={15} />{en ? 'Stock' : 'Απόθεμα'}</Button>} />
      <RegistryTable className="kitchen-table" rows={[...summary.expiring, ...summary.lowStock.filter(row => !row.expiring && !row.expired)].slice(0, 10)} rowKey={row => row.receiptItemId} columns={[{ key: 'product', label: en ? 'Product' : 'Προϊόν' }, { key: 'left', label: en ? 'Remaining' : 'Υπόλοιπο' }, { key: 'note', label: '' }]}
        emptyTitle={en ? 'Nothing expires soon' : 'Τίποτα δεν λήγει σύντομα'}
        renderRow={row => <><td>{row.productName}<small>{row.receiptCode} · {row.supplierName}</small></td><td className="nowrap-cell">{fmtQty(row.remaining, language)} {unitLabel(row.unit, language)}</td><td><StockNotes row={row} language={language} /></td></>} />
    </section>
    <section className="kitchen-card">
      <SectionHeader title={en ? 'HACCP verification' : 'Επαλήθευση HACCP'} subtitle={en ? 'Days waiting for the sign-off of the kitchen manager or quality office (30 days).' : 'Ημέρες που περιμένουν την επαλήθευση του υπεύθυνου κουζίνας ή του γραφείου ποιότητας (30 ημέρες).'} actions={<Button variant="secondary" onClick={() => onTab('verification')}><ShieldCheck size={15} />{summary.toVerify}</Button>} />
    </section>
    {state && <RecallOverviewCard state={state} access={access} onTab={onTab} onRecall={onRecall} />}
  </div>
}

export function StockNotes({ row, language }) {
  const en = language === 'en'
  return <span className="kitchen-notes">
    {!row.inStock && <StatusBadge tone="neutral">{en ? 'Rejected' : 'Απορρίφθηκε'}</StatusBadge>}
    {row.expired && <StatusBadge tone="danger">{en ? 'Expired' : 'Έληξε'}</StatusBadge>}
    {row.expiring && <StatusBadge tone="warning">{row.daysLeft === 0 ? (en ? 'Expires today' : 'Λήγει σήμερα') : (en ? `Expires in ${row.daysLeft} d` : `Λήγει σε ${row.daysLeft} ημ.`)}</StatusBadge>}
    {row.low && <StatusBadge tone="info">{en ? 'Low stock' : 'Χαμηλό απόθεμα'}</StatusBadge>}
    {row.overused && <StatusBadge tone="warning">{en ? 'To check · used more than received' : 'Προς έλεγχο · υπερκατανάλωση'}</StatusBadge>}
  </span>
}

// --- Receipts -------------------------------------------------------------------------------

export function ReceiptsPanel({ state, filters, setFilters }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const suppliers = useMemo(() => [...new Map(state.receipts.map(row => [row.supplierId || row.supplierName, row.supplierName])).entries()].filter(([key]) => key).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'el')), [state.receipts])
  const rows = state.receipts.filter(row => (filters.result === 'all' || row.result === filters.result) && (filters.supplier === 'all' || (row.supplierId || row.supplierName) === filters.supplier) && (filters.limits === 'all' || row.limitStatus === filters.limits) && inPeriod(row.receivedOn, filters.from, filters.to) && matches(filters.query, row.code, row.supplierName, row.orderReference, row.receiverName, ...(row.items || []).map(item => `${item.productName} ${item.batchCode}`)))
    .sort((a, b) => String(b.receivedOn).localeCompare(String(a.receivedOn)) || String(b.receivedTime || '').localeCompare(String(a.receivedTime || '')) || String(b.code).localeCompare(String(a.code)))
  const active = ['result', 'supplier', 'limits'].filter(key => filters[key] !== 'all').length + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search code, supplier, product, batch…' : 'Αναζήτηση κωδικού, προμηθευτή, προϊόντος, παρτίδας…'} activeFilters={active}
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
    rowProps={row => ({ className: 'registry-row-clickable', onClick: () => navigate(`/kitchen/receipts/${row.id}`) })}
    renderRow={row => { const bad = RECEIPT_CHECK_FIELDS.filter(item => row[item.field] === 'noncompliant'); return <>
      <td className="nowrap-cell"><strong>{row.code}</strong><small>{fmtDay(row.receivedOn)}{row.receivedTime ? ` · ${row.receivedTime}` : ''}</small></td>
      <td>{row.supplierName || '—'}{row.orderReference && <small>{en ? 'Order' : 'Παραγγελία'} {row.orderReference}</small>}</td>
      <td>{(row.items || []).length ? (row.items || []).slice(0, 2).map(item => item.productName).join(' · ') : '—'}{(row.items || []).length > 2 && <small>+{row.items.length - 2}</small>}</td>
      <td>{bad.length ? <span className="kitchen-notes">{bad.map(item => <StatusBadge key={item.field} tone="danger">{item.label[en ? 1 : 0]}</StatusBadge>)}</span> : row.limitStatus === 'out' ? <LimitBadge status="out" language={language} /> : row.limitStatus === 'in' ? (en ? 'All compliant' : 'Όλοι σε συμμόρφωση') : '—'}{row.measuredTemperature !== '' && row.measuredTemperature != null && <small>{fmtTemp(row.measuredTemperature, language)}</small>}</td>
      <td><StatusBadge tone={receiptResultTone(row.result)}>{receiptResultLabel(row.result, language)}</StatusBadge></td>
    </> }} />
}

// --- Stock and catalogue ----------------------------------------------------------------------

export function StockPanel({ state, stock, access, filters, setFilters, onDialog, onTrace, reload, organizationId }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { confirm, notify } = useFeedback()
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const view = filters.view || 'stock'
  const suppliers = new Map((state.suppliers || []).map(item => [item.id, item.name]))
  const rows = stock.filter(row => (filters.show === 'all' || (filters.show === 'in' && row.inStock && row.remaining > 0.0005) || (filters.show === 'attention' && (row.expiring || row.expired || row.low || row.overused))) && (filters.storage === 'all' || row.storage === filters.storage) && matches(filters.query, row.productName, row.supplierName, row.batchCode, row.lotLabel, row.receiptCode))
    .sort((a, b) => String(b.receivedOn).localeCompare(String(a.receivedOn)) || String(a.productName).localeCompare(String(b.productName), 'el'))
  const products = (state.products || []).map(item => ({ ...item, supplierName: suppliers.get(item.supplierId) || '', categoryLabel: categoryLabel(item.category, language) }))
    .filter(item => (filters.category === 'all' || item.category === filters.category) && matches(filters.query, item.name, item.supplierName, item.supplierCode))
    .sort((a, b) => (a.supplierName ? 0 : 1) - (b.supplierName ? 0 : 1) || String(a.supplierName).localeCompare(String(b.supplierName), 'el') || a.name.localeCompare(b.name, 'el'))
  // Grouped by supplier, as FileMaker's «ΛΙΣΤΑ ΠΡΟΪΟΝΤΩΝ».
  const grouped = products.flatMap((item, index) => (index === 0 || products[index - 1].supplierName !== item.supplierName ? [{ id: `group-${item.supplierName || 'none'}-${index}`, group: item.supplierName || (en ? 'No supplier' : 'Χωρίς προμηθευτή'), count: products.filter(other => other.supplierName === item.supplierName).length }, item] : [item]))
  const switcher = <ModeSwitch ariaLabel={en ? 'View' : 'Προβολή'} value={view} onChange={value => set('view', value)} options={[{ value: 'stock', label: en ? 'Received products' : 'Παραληφθέντα προϊόντα', icon: Package }, { value: 'products', label: en ? 'Product list' : 'Λίστα προϊόντων', icon: ClipboardCheck }]} />
  async function removeProduct(item) {
    if (!await confirm({ title: en ? 'Delete product' : 'Διαγραφή προϊόντος', message: en ? 'The product leaves the catalogue; receipts keep its name. A product no longer bought is better made inactive.' : 'Το προϊόν φεύγει από τη λίστα· οι παραλαβές κρατούν το όνομά του. Για προϊόν που δεν αγοράζεται πια, προτιμήστε «Ανενεργό».', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeEntry(organizationId, 'kitchen_products', item.id); await reload() } catch (error) { notify(kitchenErrorMessage(error, language), 'error') }
  }
  if (view === 'products') return <KitchenList rows={grouped} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search product, supplier, code…' : 'Αναζήτηση προϊόντος, προμηθευτή, κωδικού…'} activeFilters={filters.category !== 'all' ? 1 : 0}
    onClear={() => setFilters(current => ({ ...current, query: '', category: 'all' }))} end={<>{switcher}{access.canManage && <Button onClick={() => onDialog({ type: 'product', initial: newProduct() })}><Plus size={15} />{en ? 'Product' : 'Προϊόν'}</Button>}</>}
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
    onClear={() => setFilters(current => ({ ...current, query: '', show: 'in', storage: 'all' }))} end={switcher}
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

// --- Heat parameters, defrosting, pureeing ------------------------------------------------

export function ThermalPanel({ state, access, filters, setFilters, onDialog }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const report = useDeviationReport()
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const locked = id => Boolean(id && state.productions.find(item => item.id === id)?.verifiedAt)
  const rows = state.thermal.filter(row => (filters.limits === 'all' || row.limitStatus === filters.limits || (filters.limits === 'none' && !row.limitStatus)) && inPeriod(row.processDate, filters.from, filters.to) && matches(filters.query, row.dishName, row.notes, row.recordedByName))
    .sort((a, b) => String(b.processDate).localeCompare(String(a.processDate)) || String(b.processTime || '').localeCompare(String(a.processTime || '')))
  const active = (filters.limits !== 'all' ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search dish…' : 'Αναζήτηση πιάτου…'} activeFilters={active} onClear={() => setFilters(current => ({ ...current, query: '', limits: 'all', from: '', to: '' }))}
    end={access.canRecord && <Button onClick={() => onDialog({ type: 'thermal', initial: newThermal() })}><Thermometer size={15} />{en ? 'Record' : 'Καταχώριση'}</Button>}
    filters={<><LimitsFilter value={filters.limits} onChange={value => set('limits', value)} en={en} /><FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => set('from', value)} /><FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => set('to', value)} /></>}
    columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'dish', label: en ? 'Dish' : 'Πιάτο' }, { key: 'cook', label: `${en ? 'Core' : 'Πυρήνας'} ${limitText(state.limits.find(item => item.limitKey === 'cooking_core'), language)}` }, { key: 'chill', label: `${en ? 'Chilling' : 'Ψύξη'} ${limitText(state.limits.find(item => item.limitKey === 'chilling'), language)}` }, { key: 'reheat', label: `${en ? 'Reheating' : 'Αναθέρμανση'} ${limitText(state.limits.find(item => item.limitKey === 'reheating'), language)}` }, { key: 'fry', label: en ? 'Frying' : 'Τηγάνισμα' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }, { key: 'actions', label: '' }]}
    empty={!rows.length} emptyTitle={en ? 'No heat treatments' : 'Δεν υπάρχουν θερμικές επεξεργασίες'} emptyText={en ? 'Cooking, chilling, reheating and frying temperatures of each dish.' : 'Θερμοκρασίες μαγειρέματος, ψύξης, αναθέρμανσης και τηγανίσματος κάθε πιάτου.'}
    renderRow={row => <>
      <td className="nowrap-cell">{fmtDay(row.processDate)}{row.processTime && <small>{row.processTime}</small>}</td>
      <td><strong>{row.dishName}</strong>{row.recordedByName && <small>{row.recordedByName}</small>}</td>
      <td className={`nowrap-cell kitchen-measure is-${row.cookingStatus || 'none'}`}>{temp(row.cookingTemp, row.cookingText, language)}</td>
      <td className={`nowrap-cell kitchen-measure is-${row.chillStatus || 'none'}`}>{row.chillTemp !== '' && row.chillTemp != null ? `${fmtTemp(row.chillTemp, language)}${row.chillMinutes ? ` · ${row.chillMinutes}′` : ''}` : temp('', row.chillText, language)}</td>
      <td className={`nowrap-cell kitchen-measure is-${row.reheatStatus || 'none'}`}>{temp(row.reheatTemp, row.reheatText, language)}</td>
      <td className={`nowrap-cell kitchen-measure is-${row.fryingStatus || 'none'}`}>{temp(row.fryingTemp, row.fryingText, language)}</td>
      <td><LimitBadge status={row.limitStatus} language={language} />{row.correctiveAction && <small className="kitchen-action-text" title={row.correctiveAction}>{row.correctiveAction}</small>}</td>
      <td><div className="row-actions">
        {access.canRecord && !locked(row.productionId) && <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => onDialog({ type: 'thermal', initial: { ...row } })}><Pencil size={14} /></IconButton>}
        {access.canRecord && row.limitStatus === 'out' && <IconButton size="sm" label={en ? 'Report a deviation' : 'Αναφορά απόκλισης'} onClick={() => report(row.dishName, [`${en ? 'Heat treatment' : 'Θερμική επεξεργασία'} · ${fmtDay(row.processDate)} ${row.processTime || ''}`, row.correctiveAction && `${en ? 'Corrective action' : 'Διορθωτική ενέργεια'}: ${row.correctiveAction}`], row.processDate)}><AlertTriangle size={14} /></IconButton>}
      </div></td>
    </>} />
}

const LimitsFilter = ({ value, onChange, en }) => <FilterSelect label={en ? 'Limits' : 'Όρια'} value={value} onChange={onChange}><option value="all">{en ? 'All' : 'Όλα'}</option><option value="out">{en ? 'Out of limits' : 'Εκτός ορίων'}</option><option value="in">{en ? 'Within limits' : 'Εντός ορίων'}</option><option value="none">{en ? 'Not measured' : 'Χωρίς μέτρηση'}</option></FilterSelect>

// The defrost list (as FileMaker's «Λίστα Αποψύξεων»): one line per defrosting, with
// its HACCP sign-off (who and when), which locks the line until reopened with a reason.
export function DefrostPanel({ state, access, filters, setFilters, onDialog, onSign, onReopen }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const rows = state.defrosting.filter(row => (filters.limits === 'all' || row.limitStatus === filters.limits || (filters.limits === 'none' && !row.limitStatus)) && (filters.signed === 'all' || (filters.signed === 'pending' ? !row.verifiedAt : Boolean(row.verifiedAt))) && inPeriod(dayOf(row.startedAt), filters.from, filters.to) && matches(filters.query, row.productName, row.notes, row.verifiedByName))
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
  const active = (filters.limits !== 'all' ? 1 : 0) + (filters.signed !== 'all' ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  const draftOf = row => ({ ...row, startDay: dayOf(row.startedAt), startTime: timeOf(row.startedAt), endDay: row.endedAt ? dayOf(row.endedAt) : '', endTime: row.endedAt ? timeOf(row.endedAt) : '' })
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search product…' : 'Αναζήτηση προϊόντος…'} activeFilters={active} onClear={() => setFilters(current => ({ ...current, query: '', limits: 'all', signed: 'all', from: '', to: '' }))}
    end={access.canRecord && <Button onClick={() => onDialog({ type: 'defrost', initial: newDefrost() })}><Snowflake size={15} />{en ? 'Record' : 'Καταχώριση'}</Button>}
    filters={<><LimitsFilter value={filters.limits} onChange={value => set('limits', value)} en={en} /><FilterSelect label={en ? 'HACCP sign-off' : 'Επαλήθευση HACCP'} value={filters.signed} onChange={value => set('signed', value)}><option value="all">{en ? 'All' : 'Όλες'}</option><option value="pending">{en ? 'Pending' : 'Εκκρεμεί'}</option><option value="signed">{en ? 'Signed off' : 'Επαληθευμένες'}</option></FilterSelect><FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => set('from', value)} /><FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => set('to', value)} /></>}
    columns={[{ key: 'product', label: en ? 'Product' : 'Προϊόν' }, { key: 'start', label: en ? 'At the start of defrosting' : 'Κατά την έναρξη της απόψυξης' }, { key: 'end', label: en ? 'At the end of defrosting' : 'Κατά τη λήξη της απόψυξης' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }, { key: 'sign', label: en ? 'HACCP sign-off' : 'Επαλήθευση HACCP' }]}
    empty={!rows.length} emptyTitle={en ? 'No defrosting' : 'Δεν υπάρχουν αποψύξεις'} emptyText={en ? 'Each defrosting with its start and end temperature and the HACCP sign-off.' : 'Κάθε απόψυξη με θερμοκρασία έναρξης και λήξης και την επαλήθευση HACCP.'}
    rowProps={row => (access.canRecord && !row.verifiedAt ? { className: 'registry-row-clickable', onClick: () => onDialog({ type: 'defrost', initial: draftOf(row) }) } : {})}
    renderRow={row => <>
      <td><strong>{row.productName}</strong><small>{fmtQty(row.quantity, language)} {unitLabel(row.unit, language)} · {defrostMethodLabel(row.method, language)}</small></td>
      <td className="nowrap-cell">{fmtStamp(row.startedAt, language)}<small>{temp(row.startTemp, row.startText, language)}</small></td>
      <td className={`nowrap-cell kitchen-measure is-${row.limitStatus || 'none'}`}>{row.endedAt ? <>{fmtStamp(row.endedAt, language)}<small>{temp(row.endTemp, row.endText, language)}</small></> : <StatusBadge tone="info">{en ? 'In progress' : 'Σε εξέλιξη'}</StatusBadge>}</td>
      <td><LimitBadge status={row.limitStatus} language={language} />{row.correctiveAction && <small className="kitchen-action-text" title={row.correctiveAction}>{row.correctiveAction}</small>}</td>
      <td onClick={event => event.stopPropagation()}>{row.verifiedAt
        ? <span className="kitchen-signoff"><StatusBadge tone="success"><ShieldCheck size={13} />{row.verifiedByName || '—'}</StatusBadge><small>{fmtStamp(row.verifiedAt, language)}</small>{access.canManage && <IconButton size="sm" label={en ? 'Reopen' : 'Άνοιγμα ξανά'} onClick={() => onReopen('kitchen_defrosting', row)}><Undo2 size={14} /></IconButton>}</span>
        : access.canManage ? <Button variant="secondary" disabled={!row.endedAt} onClick={() => onSign('kitchen_defrosting', row)}><ShieldCheck size={15} />{en ? 'HACCP sign-off' : 'Επαλήθευση HACCP'}</Button> : <StatusBadge tone="warning">{en ? 'Pending' : 'Εκκρεμεί'}</StatusBadge>}</td>
    </>} />
}

export function PureeingPanel({ state, access, filters, setFilters, onDialog }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const yes = value => (value == null ? '—' : value ? (en ? 'OK' : 'Εντάξει') : <StatusBadge tone="danger">{en ? 'Not OK' : 'Όχι'}</StatusBadge>)
  const locked = id => Boolean(id && state.productions.find(item => item.id === id)?.verifiedAt)
  const rows = state.pureeing.filter(row => (filters.limits === 'all' || row.limitStatus === filters.limits || (filters.limits === 'none' && !row.limitStatus)) && inPeriod(row.pureedOn, filters.from, filters.to) && matches(filters.query, row.productName, row.notes))
    .sort((a, b) => String(b.pureedOn).localeCompare(String(a.pureedOn)))
  const active = (filters.limits !== 'all' ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search dish…' : 'Αναζήτηση πιάτου…'} activeFilters={active} onClear={() => setFilters(current => ({ ...current, query: '', limits: 'all', from: '', to: '' }))}
    end={access.canRecord && <Button onClick={() => onDialog({ type: 'pureeing', initial: newPureeing() })}><Plus size={15} />{en ? 'Record' : 'Καταχώριση'}</Button>}
    filters={<><LimitsFilter value={filters.limits} onChange={value => set('limits', value)} en={en} /><FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => set('from', value)} /><FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => set('to', value)} /></>}
    columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'dish', label: en ? 'Dish / product' : 'Πιάτο / προϊόν' }, { key: 'method', label: en ? 'Method' : 'Μέθοδος' }, { key: 'visual', label: en ? 'Visual check' : 'Οπτικός έλεγχος' }, { key: 'blade', label: en ? 'Blade check' : 'Έλεγχος λεπίδας' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }, { key: 'actions', label: '' }]}
    empty={!rows.length} emptyTitle={en ? 'No pureeing' : 'Δεν υπάρχουν πολτοποιήσεις'}
    renderRow={row => <>
      <td className="nowrap-cell">{fmtDay(row.pureedOn)}</td><td><strong>{row.productName}</strong>{row.recordedByName && <small>{row.recordedByName}</small>}</td><td>{pureeMethodLabel(row.method, language)}</td>
      <td>{yes(row.visualCheck)}</td><td>{yes(row.bladeCheck)}</td><td><LimitBadge status={row.limitStatus} language={language} /></td>
      <td>{access.canRecord && !locked(row.productionId) && <IconButton size="sm" label={en ? 'Edit' : 'Επεξεργασία'} onClick={() => onDialog({ type: 'pureeing', initial: { ...row } })}><Pencil size={14} /></IconButton>}</td>
    </>} />
}

// --- Materials in use (traceability) -----------------------------------------------------

export function UsagePanel({ state, stock, filters, setFilters, onTrace }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const batches = new Map(stock.map(row => [row.receiptItemId, row]))
  const rows = state.usage.map(row => ({ ...row, batch: batches.get(row.receiptItemId) || null }))
    .filter(row => (filters.link === 'all' || (filters.link === 'linked' ? Boolean(row.batch) : !row.batch)) && inPeriod(row.usedOn, filters.from, filters.to) && matches(filters.query, row.productName, row.dishName, row.lotLabel, row.batch?.supplierName, row.batch?.receiptCode))
    .sort((a, b) => String(b.usedOn).localeCompare(String(a.usedOn)))
  const active = (filters.link !== 'all' ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search product, dish, batch, supplier…' : 'Αναζήτηση προϊόντος, πιάτου, παρτίδας, προμηθευτή…'} activeFilters={active} onClear={() => setFilters(current => ({ ...current, query: '', link: 'all', from: '', to: '' }))}
    filters={<><FilterSelect label={en ? 'Batch' : 'Παρτίδα'} value={filters.link} onChange={value => set('link', value)}><option value="all">{en ? 'All' : 'Όλες'}</option><option value="linked">{en ? 'Traced to a receipt' : 'Με παραλαβή'}</option><option value="unlinked">{en ? 'Without a receipt' : 'Χωρίς παραλαβή'}</option></FilterSelect><FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => set('from', value)} /><FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => set('to', value)} /></>}
    columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'product', label: en ? 'Raw material · batch' : 'Πρώτη ύλη · παρτίδα' }, { key: 'receipt', label: en ? 'Supplier · receipt' : 'Προμηθευτής · παραλαβή' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }, { key: 'dish', label: en ? 'Dish' : 'Πιάτο' }, { key: 'actions', label: '' }]}
    empty={!rows.length} emptyTitle={en ? 'No raw materials used' : 'Δεν υπάρχουν πρώτες ύλες σε χρήση'} emptyText={en ? 'Supplier → batch → production day → dish: every batch used in a production.' : 'Προμηθευτής → παρτίδα → ημέρα παραγωγής → πιάτο: κάθε παρτίδα που μπήκε στην παραγωγή.'}
    rowProps={row => (row.productionId ? { className: 'registry-row-clickable', onClick: () => navigate(`/kitchen/days/${row.productionId}`) } : {})}
    renderRow={row => <>
      <td className="nowrap-cell">{fmtDay(row.usedOn)}</td>
      <td><strong>{row.productName}</strong><small>{row.batch?.batchCode || row.lotLabel || '—'}</small></td>
      <td>{row.batch ? <>{row.batch.supplierName || '—'}<small>{row.batch.receiptCode} · {fmtDay(row.batch.receivedOn)}</small></> : <span className="kitchen-muted">{en ? 'Batch not found' : 'Χωρίς παρτίδα παραλαβής'}</span>}</td>
      <td className="nowrap-cell">{fmtQty(row.quantity, language)} {unitLabel(row.unit, language)}</td>
      <td>{row.dishName || '—'}</td>
      <td onClick={event => event.stopPropagation()}>{row.receiptItemId && <IconButton size="sm" label={en ? 'Traceability' : 'Ιχνηλάτηση'} onClick={() => onTrace(row.receiptItemId)}><Route size={14} /></IconButton>}</td>
    </>} />
}

// The traceability of one batch, with its document.
export function TraceDialog({ state, receiptItemId, onClose }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const navigate = useNavigate()
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
    end={<>{switcher}{access.canRecord && <Button onClick={() => onDialog({ type: 'production', initial: newProduction(today) })}><Plus size={15} />{en ? 'Production day' : 'Ημέρα παραγωγής'}</Button>}</>}
    filters={<><FilterSelect label={en ? 'Days' : 'Ημέρες'} value={filters.when} onChange={value => set('when', value)}><option value="all">{en ? 'All' : 'Όλες'}</option><option value="upcoming">{en ? 'Today and planned' : 'Σήμερα και προγραμματισμένες'}</option><option value="past">{en ? 'Past' : 'Περασμένες'}</option></FilterSelect><FilterDate label={en ? 'From' : 'Από'} value={filters.from} onChange={value => set('from', value)} /><FilterDate label={en ? 'To' : 'Έως'} value={filters.to} onChange={value => set('to', value)} /></>}
    columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'menu', label: en ? 'Daily menu' : 'Μενού ημέρας' }, { key: 'records', label: en ? 'Records' : 'Καταγραφές' }, { key: 'verify', label: en ? 'Verification' : 'Επαλήθευση' }]}
    empty={!days.length} emptyTitle={en ? 'No production days' : 'Δεν υπάρχουν ημέρες παραγωγής'} emptyText={en ? 'Open the day from its menu, then record what the production uses and the heat parameters.' : 'Ανοίξτε την ημέρα από το μενού της και καταγράψτε τις πρώτες ύλες και τις παραμέτρους ζέστης.'}
    rowProps={item => ({ className: 'registry-row-clickable', onClick: () => onOpenDay(item.id) })}
    renderRow={item => <>
      <td className="nowrap-cell"><strong>{fmtDay(item.productionDate)}</strong><small>{weekdayLabel(weekdayOf(item.productionDate), language)}{item.productionDate > today ? ` · ${en ? 'planned' : 'προγραμματισμένη'}` : ''}</small></td>
      <td className="kitchen-text-cell">{(item.menuText || '—').split('\n').filter(line => line.trim()).slice(0, 3).join(' · ')}</td>
      <td className="nowrap-cell">{item.records.usage.length} {en ? 'materials' : 'α΄ ύλες'} · {item.records.thermal.length} {en ? 'heat' : 'ζέστη'}{item.records.outOfLimits > 0 && <small><StatusBadge tone="danger">{item.records.outOfLimits} {en ? 'out of limits' : 'εκτός ορίων'}</StatusBadge></small>}</td>
      <td>{item.verifiedAt ? <StatusBadge tone="success">{item.verifiedByName || (en ? 'Signed off' : 'Επαληθεύτηκε')}</StatusBadge> : item.productionDate <= today ? <StatusBadge tone="warning">{en ? 'Pending' : 'Εκκρεμεί'}</StatusBadge> : '—'}</td>
    </>} />
}

// --- Verification queue -----------------------------------------------------------------------

export function VerificationPanel({ state, access, filters, setFilters, onOpenDay, onSign }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const today = todayKey()
  const rows = verificationQueue(state, { today, since: filters.range === 'all' ? '' : addDays(today, -Number(filters.range || 30)) }).map(row => ({ ...row, id: row.production.id }))
    .filter(row => matches(filters.query, row.production.menuText, fmtDay(row.production.productionDate)))
  return <KitchenList rows={rows} query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search date or menu…' : 'Αναζήτηση ημερομηνίας ή μενού…'} activeFilters={filters.range !== '30' ? 1 : 0} onClear={() => setFilters(current => ({ ...current, query: '', range: '30' }))}
    filters={<FilterSelect label={en ? 'Period' : 'Περίοδος'} value={filters.range} onChange={value => set('range', value)}><option value="7">{en ? 'Last 7 days' : 'Τελευταίες 7 ημέρες'}</option><option value="30">{en ? 'Last 30 days' : 'Τελευταίες 30 ημέρες'}</option><option value="all">{en ? 'Every unverified day' : 'Όλες οι ανεπαλήθευτες ημέρες'}</option></FilterSelect>}
    columns={[{ key: 'day', label: en ? 'Day' : 'Ημέρα' }, { key: 'records', label: en ? 'Records' : 'Καταγραφές' }, { key: 'out', label: en ? 'Out of limits' : 'Εκτός ορίων' }, { key: 'defrost', label: en ? 'Defrosts to sign' : 'Αποψύξεις προς επαλήθευση' }, { key: 'actions', label: '' }]}
    empty={!rows.length} emptyTitle={en ? 'Nothing to verify' : 'Τίποτα προς επαλήθευση'} emptyText={en ? 'Every production day of the period is signed off.' : 'Όλες οι ημέρες παραγωγής της περιόδου έχουν επαληθευτεί.'}
    rowProps={row => ({ className: 'registry-row-clickable', onClick: () => onOpenDay(row.production.id) })}
    renderRow={row => <>
      <td className="nowrap-cell"><strong>{fmtDay(row.production.productionDate)}</strong><small>{weekdayLabel(weekdayOf(row.production.productionDate), language)}</small></td>
      <td>{[`${row.receipts.length} ${en ? 'receipts' : 'παραλαβές'}`, `${row.usage.length} ${en ? 'materials' : 'α΄ ύλες'}`, `${row.thermal.length} ${en ? 'heat' : 'ζέστη'}`, `${row.pureeing.length} ${en ? 'pureeing' : 'πολτοπ.'}`, `${row.defrosting.length} ${en ? 'defrost' : 'αποψ.'}`].join(' · ')}</td>
      <td>{row.outOfLimits ? <StatusBadge tone="danger">{row.outOfLimits}</StatusBadge> : '—'}</td>
      <td>{row.pendingDefrosts || '—'}</td>
      <td onClick={event => event.stopPropagation()}>{access.canManage && <Button variant="secondary" onClick={() => onSign('kitchen_productions', row.production)}><ShieldCheck size={15} />{en ? 'Sign off' : 'Επαλήθευση'}</Button>}</td>
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
          <td><span className="kitchen-notes">{HAZARD_LABELS.filter(([key]) => row[key]).map(([key, el, enLabel]) => <StatusBadge key={key} tone="neutral">{en ? enLabel : el}</StatusBadge>)}</span>{row.hazards && <small>{row.hazards}</small>}</td>
          <td>{row.isCcp ? <StatusBadge tone="danger">CCP</StatusBadge> : '—'}{row.limitKey && <small>{limitText(limitOf(row.limitKey), language)}</small>}</td>
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
    const notes = await confirm({ title: en ? 'HACCP sign-off' : 'Επαλήθευση HACCP', message: table === 'kitchen_productions' ? (en ? `You confirm that the records of ${fmtDay(row.productionDate)} were reviewed. The day is locked until reopened.` : `Επιβεβαιώνετε ότι ελέγξατε τις καταγραφές της ${fmtDay(row.productionDate)}. Η ημέρα κλειδώνει ώσπου να ανοίξει ξανά.`) : (en ? `You confirm the defrosting of ${row.productName}. The line is locked until reopened.` : `Επιβεβαιώνετε την απόψυξη «${row.productName}». Η γραμμή κλειδώνει ώσπου να ανοίξει ξανά.`),
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

