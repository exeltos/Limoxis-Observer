import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, ChefHat, ClipboardList, LayoutDashboard, Package, ShieldCheck, Siren, Truck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { SectionHeader } from '../../design-system/SectionHeader'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { reportExports } from '../../core/export/reportDocument'
import { useKitchen, useKitchenAccess } from './KitchenShared'
import { HaccpPanel, OverviewPanel, PlanPanel, ReceiptsPanel, SettingsDialog, StockPanel, TraceDialog, VerificationPanel, fmtDay } from './KitchenPanels'
import { DefrostDialog, LimitsDialog, MenuDialog, ProductDialog, ProductionDialog, PureeingDialog, ReceiptDialog, StepDialog, ThermalDialog, UsageDialog, WriteoffDialog } from './KitchenDialogs'
import { KITCHEN_PRIMARY_ACTION, addDays, categoryLabel, newProduction, newReceipt, overview, productionForDay, resolveKitchenLocation, stockRows, todayKey } from './kitchenModel'
import { dailyHaccpDocument, exportKitchenList, receiptsLogDocument } from './kitchenReports'
import { RecallDialog, RecallPanel } from './KitchenRecall'
import { drillSubject, newRecallDrill, recallSummary } from './kitchenRecallModel'

const initialFilters = () => ({
  receipts: { query: '', result: 'all', supplier: 'all', limits: 'all', from: '', to: '' },
  stock: { query: '', show: 'in', storage: 'all', category: 'all' },
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
  // The tab and its view; an address of the old eleven tabs (?tab=thermal, ?tab=recall…) is rewritten to its new place.
  const { tab, view } = resolveKitchenLocation(params.get('tab'), params.get('view'))
  const setLocation = (next, nextView = '') => setParams(current => { const copy = new URLSearchParams(current); copy.set('tab', next); if (nextView) copy.set('view', nextView); else copy.delete('view'); return copy }, { replace: true })
  const setTab = next => setLocation(next, resolveKitchenLocation(next).view)
  const wantsRewrite = params.get('tab') !== tab || (view || '') !== (params.get('view') || '')
  useEffect(() => { if (params.get('tab') && wantsRewrite) setLocation(tab, view) }, [wantsRewrite, tab, view]) // eslint-disable-line react-hooks/exhaustive-deps
  const access = useKitchenAccess()
  const { state, loading, reload, organizationId, showSince } = useKitchen()
  const [filters, setAllFilters] = useState(initialFilters)
  // The lists show the loaded window; a «From» date (or a longer verification period) before it reads further back.
  const today = todayKey()
  const wantSince = useMemo(() => (filters.verification.range === 'all' ? null : [addDays(today, -Number(filters.verification.range || 30)), ...['receipts', 'plan'].map(key => filters[key].from)].filter(Boolean).sort()[0]), [filters, today])
  useEffect(() => { showSince(wantSince) }, [wantSince, showSince])
  const filtersFor = key => [filters[key], updater => setAllFilters(current => ({ ...current, [key]: typeof updater === 'function' ? updater(current[key]) : updater }))]
  const [dialog, setDialog] = useState(null)
  const [trace, setTrace] = useState(null)
  const [recallDraft, setRecall] = useState(null)
  // An address of the old Recall / Verification tabs scrolls to its section of the shared tab.
  const focusRef = useRef(null)
  useEffect(() => { if (tab === 'safety' && params.get('view') && focusRef.current?.scrollIntoView) focusRef.current.scrollIntoView({ block: 'start' }) }, [tab, view, state]) // eslint-disable-line react-hooks/exhaustive-deps
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
  const productsExcel = () => exportKitchenList('products', state.products.map(item => ({ ...item, supplierName: state.suppliers.find(s => s.id === item.supplierId)?.name || '', categoryLabel: categoryLabel(item.category, language) })), language)
  const dayDocument = todayProduction ? reportExports(() => dailyHaccpDocument(state, todayProduction, { language }), { word: true, onBlocked: blocked }) : {}
  const exportsFor = {
    today: dayDocument,
    // The period lists of the records (heat, defrosting, pureeing, materials in use) are Excel files here: they are recorded in the production day.
    days: { ...dayDocument, items: [
      { id: 'x-thermal', kind: 'excel', label: en ? 'Excel · Heat treatments' : 'Excel · Θερμικές επεξεργασίες', onClick: () => exportKitchenList('thermal', state.thermal, language) },
      { id: 'x-defrost', kind: 'excel', label: en ? 'Excel · Defrosting' : 'Excel · Αποψύξεις', onClick: () => exportKitchenList('defrosting', state.defrosting, language) },
      { id: 'x-pureeing', kind: 'excel', label: en ? 'Excel · Pureeing' : 'Excel · Πολτοποιήσεις', onClick: () => exportKitchenList('pureeing', state.pureeing, language) },
      { id: 'x-usage', kind: 'excel', label: en ? 'Excel · Materials in use' : 'Excel · Υλικά σε χρήση', onClick: () => exportKitchenList('usage', state.usage.map(row => ({ ...row, batch: stock.find(item => item.receiptItemId === row.receiptItemId) })), language) },
    ] },
    storage: view === 'receipts' ? { ...reportExports(() => receiptsLogDocument(receiptsInView.filter(row => row.receivedOn >= logFrom && row.receivedOn <= logTo), { from: logFrom, to: logTo, language }), { onBlocked: blocked }), onExcel: () => exportKitchenList('receipts', receiptsInView, language) }
      : { onExcel: view === 'products' ? productsExcel : () => exportKitchenList('stock', stock, language) },
    safety: { onExcel: () => exportKitchenList('recall', (state.recallDrills || []).map(row => ({ ...row, subject: drillSubject(row, state, language) })), language) },
    haccp: {},
  }
  const exportProps = exportsFor[tab] || {}
  // One button per action: Export, and the one primary action of the tab.
  const primary = access.canRecord ? KITCHEN_PRIMARY_ACTION[tab] : null
  const primaryButton = {
    production: <Button onClick={() => (summary.production ? openDay(summary.production.id) : setDialog({ type: 'production', initial: newProduction(today) }))}><ChefHat size={15} />{summary.production ? (en ? 'Today\'s production' : 'Σημερινή παραγωγή') : (en ? 'Open today' : 'Άνοιγμα ημέρας')}</Button>,
    day: <Button onClick={() => setDialog({ type: 'production', initial: newProduction(today) })}><ChefHat size={15} />{en ? 'New day' : 'Νέα ημέρα'}</Button>,
    receipt: <Button onClick={() => setDialog({ type: 'receipt', initial: newReceipt() })}><Truck size={15} />{en ? 'Receipt' : 'Παραλαβή'}</Button>,
    drill: <Button onClick={() => setRecall(newRecallDrill())}><Siren size={15} />{en ? 'New drill' : 'Νέα άσκηση'}</Button>,
  }[primary]
  const actions = <div className="row-actions">
    {Object.keys(exportProps).length > 0 && <ExportMenu {...exportProps} />}
    {primaryButton}
  </div>

  const recall = recallSummary(state, today)
  const tabs = [
    { value: 'today', label: en ? 'Today' : 'Σήμερα', icon: LayoutDashboard },
    { value: 'days', label: en ? 'Production days' : 'Ημέρες παραγωγής', icon: CalendarClock },
    { value: 'storage', label: en ? 'Storage' : 'Αποθήκη', icon: Package, count: summary.expiring.filter(row => row.expired).length },
    { value: 'safety', label: en ? 'Verification & recall' : 'Επαλήθευση & Ανάκληση', icon: ShieldCheck, count: summary.toVerify + (recall.overdue ? 1 : 0) },
    { value: 'haccp', label: en ? 'HACCP plan' : 'Σχέδιο HACCP', icon: ClipboardList },
  ]
  const storageSwitch = <ModeSwitch ariaLabel={en ? 'View' : 'Προβολή'} value={view === 'receipts' ? 'receipts' : 'stock'} onChange={value => setLocation('storage', value)} options={[{ value: 'receipts', label: en ? 'Receipts' : 'Παραλαβές', icon: Truck }, { value: 'stock', label: en ? 'Stock' : 'Απόθεμα', icon: Package }]} />
  const props = { state, access, reload, organizationId, onDialog: setDialog, onOpenDay: openDay, onTrace: setTrace, onRecall: setRecall, stock }
  const lastDrill = recall.last
  return <Page fill className="registry-fill-page kitchen-page" title={en ? 'Kitchen' : 'Κουζίνα'} subtitle={en ? 'HACCP food safety: receipts and stock, the production day, critical limits, verification and traceability.' : 'Ασφάλεια τροφίμων HACCP: παραλαβές και απόθεμα, ημέρα παραγωγής, κρίσιμα όρια, επαλήθευση και ιχνηλασιμότητα.'} actions={actions}>
    <CanonicalTabs items={tabs} value={tab} onChange={setTab} ariaLabel={en ? 'Kitchen' : 'Κουζίνα'} />
    <section className={`surface registry-workspace workspace-column workspace-fill kitchen-workspace kitchen-tab-${tab}`}>
      {tab === 'today' && <OverviewPanel {...props} summary={summary} onTab={setTab} onStockAttention={() => { setAllFilters(current => ({ ...current, stock: { ...current.stock, show: 'attention' } })); setLocation('storage', 'stock') }} />}
      {tab === 'days' && <PlanPanel {...props} {...pair(filtersFor('plan'))} />}
      {tab === 'storage' && view === 'receipts' && <ReceiptsPanel {...props} {...pair(filtersFor('receipts'))} switcher={storageSwitch} />}
      {tab === 'storage' && view !== 'receipts' && <StockPanel {...props} {...pair(filtersFor('stock'))} view={view} switcher={storageSwitch} onView={value => setLocation('storage', value)} />}
      {tab === 'safety' && <div className="kitchen-safety">
        <section className="kitchen-card kitchen-safety-section" ref={view === 'verification' ? focusRef : null}>
          <SectionHeader title={en ? 'Days to verify' : 'Ημέρες προς επαλήθευση'} subtitle={en ? 'Open a day to review its records and sign it off.' : 'Ανοίξτε την ημέρα για να ελέγξετε τις καταγραφές και να την επαληθεύσετε.'} />
          <VerificationPanel {...props} {...pair(filtersFor('verification'))} />
        </section>
        <section className="kitchen-card kitchen-safety-section" ref={view === 'recall' ? focusRef : null}>
          <SectionHeader title={en ? 'Recall drills' : 'Ασκήσεις ανάκλησης'} subtitle={lastDrill ? (en ? `Last drill ${fmtDay(lastDrill.drillDate)} · next due ${recall.due ? fmtDay(recall.due) : 'now'}` : `Τελευταία άσκηση ${fmtDay(lastDrill.drillDate)} · επόμενη ${recall.due ? fmtDay(recall.due) : 'άμεσα'}`) : (en ? `The recall procedure is tested at least every ${recall.months} months.` : `Η διαδικασία ανάκλησης δοκιμάζεται τουλάχιστον κάθε ${recall.months} μήνες.`)} />
          <RecallPanel {...props} {...pair(filtersFor('recall'))} />
        </section>
      </div>}
      {tab === 'haccp' && <HaccpPanel {...props} />}
    </section>
    <KitchenDialogHost dialog={dialog} setDialog={setDialog} state={state} stock={stock} dishes={dishes} organizationId={organizationId} reload={reload} onOpenDay={openDay} />
    {trace && <TraceDialog state={state} organizationId={organizationId} receiptItemId={trace} onClose={() => setTrace(null)} />}
    {recallDraft && <RecallDialog key={recallDraft.id || 'new'} state={state} organizationId={organizationId} access={access} initial={recallDraft} onClose={() => setRecall(null)} onSaved={reload} />}
  </Page>
}

const pair = ([filters, setFilters]) => ({ filters, setFilters })

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
