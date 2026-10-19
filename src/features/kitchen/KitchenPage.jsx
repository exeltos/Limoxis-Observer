import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Blend, CalendarClock, ChefHat, ClipboardList, LayoutDashboard, Package, Route, ShieldCheck, Siren, Snowflake, Thermometer, Truck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { MetricCard } from '../../design-system/MetricCard'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { reportExports } from '../../core/export/reportDocument'
import { useKitchen, useKitchenAccess } from './KitchenShared'
import { DefrostPanel, HaccpPanel, OverviewPanel, PlanPanel, PureeingPanel, ReceiptsPanel, SettingsDialog, StockPanel, ThermalPanel, TraceDialog, UsagePanel, VerificationPanel, useSignOff } from './KitchenPanels'
import { DefrostDialog, LimitsDialog, MenuDialog, ProductDialog, ProductionDialog, PureeingDialog, ReceiptDialog, StepDialog, ThermalDialog, UsageDialog, WriteoffDialog } from './KitchenDialogs'
import { addDays, categoryLabel, newReceipt, overview, productionForDay, stockRows, todayKey } from './kitchenModel'
import { dailyHaccpDocument, exportKitchenList, receiptsLogDocument } from './kitchenReports'
import { RecallDialog, RecallPanel } from './KitchenRecall'
import { drillSubject, recallSummary } from './kitchenRecallModel'

const TABS = ['overview', 'plan', 'receipts', 'stock', 'thermal', 'defrost', 'pureeing', 'usage', 'verification', 'recall', 'haccp']
const initialFilters = () => ({
  receipts: { query: '', result: 'all', supplier: 'all', limits: 'all', from: '', to: '' },
  stock: { query: '', show: 'in', storage: 'all', category: 'all', view: 'stock' },
  thermal: { query: '', limits: 'all', from: '', to: '' },
  defrost: { query: '', limits: 'all', signed: 'all', from: '', to: '' },
  pureeing: { query: '', limits: 'all', from: '', to: '' },
  usage: { query: '', link: 'all', from: '', to: '' },
  plan: { query: '', when: 'all', from: '', to: '', view: 'days' },
  verification: { query: '', range: '30' },
  recall: { query: '', result: 'all', scenario: 'all' },
})

// Κουζίνα (HACCP): the production day is the hub, the receipt the stock entry point.
export function KitchenPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = next => setParams(current => { const copy = new URLSearchParams(current); copy.set('tab', next); return copy }, { replace: true })
  const access = useKitchenAccess()
  const { state, loading, reload, organizationId } = useKitchen()
  const [filters, setAllFilters] = useState(initialFilters)
  const filtersFor = key => [filters[key], updater => setAllFilters(current => ({ ...current, [key]: typeof updater === 'function' ? updater(current[key]) : updater }))]
  const [dialog, setDialog] = useState(null)
  const [trace, setTrace] = useState(null)
  const [recall, setRecall] = useState(null)
  const { sign, reopenRow } = useSignOff(organizationId, reload)
  const today = todayKey()
  const stock = useMemo(() => (state ? stockRows(state, today) : []), [state, today])
  const summary = useMemo(() => (state ? overview(state, today) : null), [state, today])
  const dishes = useMemo(() => (state ? [...new Set([...state.thermal.map(row => row.dishName), ...state.productions.flatMap(row => (row.meals || []).map(meal => meal.dish))].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el')).slice(0, 400) : []), [state])
  const openDay = id => navigate(`/kitchen/days/${id}`)
  const blocked = () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')

  if (!state) return <Page fill title={en ? 'Kitchen' : 'Κουζίνα'}><div className="inline-empty">{loading ? (en ? 'Loading…' : 'Φόρτωση…') : (en ? 'The kitchen could not be loaded.' : 'Δεν ήταν δυνατή η φόρτωση της κουζίνας.')}</div></Page>

  // One export control per page: what the tab shows.
  const todayProduction = productionForDay(state, today) || [...state.productions].filter(item => item.productionDate <= today).sort((a, b) => b.productionDate.localeCompare(a.productionDate))[0]
  const [receiptFilters] = filtersFor('receipts')
  const receiptsInView = state.receipts.filter(row => (!receiptFilters.from || row.receivedOn >= receiptFilters.from) && (!receiptFilters.to || row.receivedOn <= receiptFilters.to)).sort((a, b) => String(a.receivedOn).localeCompare(String(b.receivedOn)))
  const logFrom = receiptFilters.from || addDays(today, -30), logTo = receiptFilters.to || today
  const exportsFor = {
    overview: todayProduction ? reportExports(() => dailyHaccpDocument(state, todayProduction, { language }), { word: true, onBlocked: blocked }) : {},
    receipts: { ...reportExports(() => receiptsLogDocument(receiptsInView.filter(row => row.receivedOn >= logFrom && row.receivedOn <= logTo), { from: logFrom, to: logTo, language }), { onBlocked: blocked }), onExcel: () => exportKitchenList('receipts', receiptsInView, language) },
    stock: { onExcel: () => (filters.stock.view === 'products' ? exportKitchenList('products', state.products.map(item => ({ ...item, supplierName: state.suppliers.find(s => s.id === item.supplierId)?.name || '', categoryLabel: categoryLabel(item.category, language) })), language) : exportKitchenList('stock', stock, language)) },
    thermal: { onExcel: () => exportKitchenList('thermal', state.thermal, language) },
    defrost: { onExcel: () => exportKitchenList('defrosting', state.defrosting, language) },
    pureeing: { onExcel: () => exportKitchenList('pureeing', state.pureeing, language) },
    usage: { onExcel: () => exportKitchenList('usage', state.usage.map(row => ({ ...row, batch: stock.find(item => item.receiptItemId === row.receiptItemId) })), language) },
    plan: todayProduction ? reportExports(() => dailyHaccpDocument(state, todayProduction, { language }), { word: true, onBlocked: blocked }) : {},
    recall: { onExcel: () => exportKitchenList('recall', (state.recallDrills || []).map(row => ({ ...row, subject: drillSubject(row, state, language) })), language) },
    verification: {}, haccp: {},
  }
  const exportProps = exportsFor[tab] || {}
  const actions = <div className="row-actions">
    {Object.keys(exportProps).length > 0 && <ExportMenu {...exportProps} />}
    {access.canRecord && <Button variant="secondary" onClick={() => setDialog({ type: 'receipt', initial: newReceipt() })}><Truck size={15} />{en ? 'Receipt' : 'Παραλαβή'}</Button>}
    {access.canRecord && <Button onClick={() => (summary.production ? openDay(summary.production.id) : setDialog({ type: 'production', initial: { ...newProductionFor(today) } }))}><ChefHat size={15} />{summary.production ? (en ? 'Today\'s production' : 'Σημερινή παραγωγή') : (en ? 'Open today' : 'Άνοιγμα ημέρας')}</Button>}
  </div>

  const tabs = [
    { value: 'overview', label: en ? 'Overview' : 'Επισκόπηση', icon: LayoutDashboard },
    { value: 'plan', label: en ? 'Menu & plan' : 'Μενού & Πλάνο', icon: CalendarClock },
    { value: 'receipts', label: en ? 'Receipts' : 'Παραλαβές', icon: Truck },
    { value: 'stock', label: en ? 'Stock' : 'Απόθεμα', icon: Package, count: summary.expiring.filter(row => row.expired).length },
    { value: 'thermal', label: en ? 'Heat treatments' : 'Θερμικές επεξεργασίες', icon: Thermometer },
    { value: 'defrost', label: en ? 'Defrosting' : 'Αποψύξεις', icon: Snowflake },
    { value: 'pureeing', label: en ? 'Pureeing' : 'Πολτοποιήσεις', icon: Blend },
    { value: 'usage', label: en ? 'Materials in use' : 'Υλικά σε χρήση', icon: Route },
    { value: 'verification', label: en ? 'Verification' : 'Επαλήθευση', icon: ShieldCheck, count: summary.toVerify },
    { value: 'recall', label: en ? 'Recall drills' : 'Ανάκληση', icon: Siren, count: recallSummary(state, today).overdue ? 1 : 0 },
    { value: 'haccp', label: en ? 'HACCP plan' : 'Σχέδιο HACCP', icon: ClipboardList },
  ]
  const props = { state, access, reload, organizationId, onDialog: setDialog, onOpenDay: openDay, onTrace: setTrace, onRecall: setRecall, stock }
  return <Page fill className="registry-fill-page kitchen-page" title={en ? 'Kitchen' : 'Κουζίνα'} subtitle={en ? 'HACCP food safety: receipts and stock, the production day, critical limits, verification and traceability.' : 'Ασφάλεια τροφίμων HACCP: παραλαβές και απόθεμα, ημέρα παραγωγής, κρίσιμα όρια, επαλήθευση και ιχνηλασιμότητα.'} actions={actions}>
    <div className="workspace-summary"><div className="module-summary-strip">
      <MetricCard icon={Truck} value={summary.receipts.length} label={en ? 'Receipts today' : 'Παραλαβές σήμερα'} onClick={() => setTab('receipts')} />
      <MetricCard icon={Thermometer} value={summary.thermal.length} label={en ? 'Heat treatments today' : 'Θερμικές σήμερα'} onClick={() => setTab('thermal')} />
      <MetricCard icon={AlertTriangle} tone={summary.outOfLimits.length ? 'danger' : 'neutral'} value={summary.outOfLimits.length} label={en ? 'Out of limits (30 d)' : 'Εκτός ορίων (30 ημ.)'} onClick={() => setTab('overview')} />
      <MetricCard icon={Package} value={summary.inStock} label={en ? 'Batches in stock' : 'Παρτίδες σε απόθεμα'} onClick={() => setTab('stock')} />
      <MetricCard icon={CalendarClock} tone={summary.expiring.length ? 'warning' : 'neutral'} value={summary.expiring.length} label={en ? 'Expire soon / expired' : 'Λήγουν / έληξαν'} onClick={() => { setAllFilters(current => ({ ...current, stock: { ...current.stock, view: 'stock', show: 'attention' } })); setTab('stock') }} />
      <MetricCard icon={ShieldCheck} tone={summary.toVerify ? 'warning' : 'neutral'} value={summary.toVerify} label={en ? 'Days to verify' : 'Ημέρες προς επαλήθευση'} onClick={() => setTab('verification')} />
    </div></div>
    <CanonicalTabs items={tabs} value={tab} onChange={setTab} ariaLabel={en ? 'Kitchen' : 'Κουζίνα'} />
    <section className={`surface registry-workspace workspace-column workspace-fill kitchen-workspace kitchen-tab-${tab}`}>
      {tab === 'overview' && <OverviewPanel {...props} summary={summary} onTab={setTab} />}
      {tab === 'plan' && <PlanPanel {...props} {...pair(filtersFor('plan'))} />}
      {tab === 'receipts' && <ReceiptsPanel {...props} {...pair(filtersFor('receipts'))} />}
      {tab === 'stock' && <StockPanel {...props} {...pair(filtersFor('stock'))} />}
      {tab === 'thermal' && <ThermalPanel {...props} {...pair(filtersFor('thermal'))} />}
      {tab === 'defrost' && <DefrostPanel {...props} {...pair(filtersFor('defrost'))} onSign={sign} onReopen={reopenRow} />}
      {tab === 'pureeing' && <PureeingPanel {...props} {...pair(filtersFor('pureeing'))} />}
      {tab === 'usage' && <UsagePanel {...props} {...pair(filtersFor('usage'))} />}
      {tab === 'verification' && <VerificationPanel {...props} {...pair(filtersFor('verification'))} onSign={sign} />}
      {tab === 'recall' && <RecallPanel {...props} {...pair(filtersFor('recall'))} />}
      {tab === 'haccp' && <HaccpPanel {...props} />}
    </section>
    <KitchenDialogHost dialog={dialog} setDialog={setDialog} state={state} stock={stock} dishes={dishes} organizationId={organizationId} reload={reload} onOpenDay={openDay} />
    {trace && <TraceDialog state={state} receiptItemId={trace} onClose={() => setTrace(null)} />}
    {recall && <RecallDialog key={recall.id || 'new'} state={state} organizationId={organizationId} access={access} initial={recall} onClose={() => setRecall(null)} onSaved={reload} />}
  </Page>
}

const pair = ([filters, setFilters]) => ({ filters, setFilters })
const newProductionFor = day => ({ id: '', productionDate: day, menuId: '', menuText: '', notes: '', disinfectionVegetables: false, disinfectionFruit: false, meals: [], source: 'app' })

// The dialogs of the kitchen, shared by the page and the records.
export function KitchenDialogHost({ dialog, setDialog, state, stock, dishes, organizationId, reload, onOpenDay }) {
  if (!dialog) return null
  const close = () => setDialog(null)
  const common = { state, organizationId, onClose: close, onSaved: reload }
  switch (dialog.type) {
    case 'receipt': return <ReceiptDialog {...common} initial={dialog.initial} />
    case 'thermal': return <ThermalDialog {...common} initial={dialog.initial} dishes={dishes} />
    case 'defrost': return <DefrostDialog {...common} initial={dialog.initial} stock={stock} />
    case 'pureeing': return <PureeingDialog {...common} initial={dialog.initial} dishes={dishes} />
    case 'usage': return <UsageDialog {...common} initial={dialog.initial} stock={stock} dishes={dishes} />
    case 'writeoff': return <WriteoffDialog {...common} batch={dialog.batch} />
    case 'product': return <ProductDialog {...common} initial={dialog.initial} />
    case 'menu': return <MenuDialog {...common} initial={dialog.initial} />
    case 'limits': return <LimitsDialog {...common} />
    case 'step': return <StepDialog {...common} initial={dialog.initial} />
    case 'settings': return <SettingsDialog {...common} />
    case 'production': return <ProductionDialog {...common} initial={dialog.initial} onSaved={async id => { close(); await reload(); if (id && onOpenDay) onOpenDay(id) }} />
    default: return null
  }
}
