import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ClipboardCheck, FolderOpen, Info, Package, Pencil, Route, Trash2, Truck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RecordMetricStrip } from '../../design-system/RecordMetricStrip'
import { RegistryTable } from '../../design-system/RegistryTable'
import { SignalBadge } from '../../design-system/StatusBadge'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { ExportMenu } from '../../design-system/ExportMenu'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { reportExports } from '../../core/export/reportDocument'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { LimitBadge, useKitchen, useKitchenAccess } from './KitchenShared'
import { KitchenDialogHost } from './KitchenPage'
import { StockNotes, TraceDialog, fmtDay, fmtStamp, useDeviationReport } from './KitchenPanels'
import { RECEIPT_CHECK_FIELDS, receiptTitle, checkLabel, fmtQty, fmtTemp, receiptResultLabel, receiptResultTone, stockRows, storageLabel, temperatureClassLabel, unitLabel } from './kitchenModel'
import { limitText } from './kitchenLimits'
import { receiptsLogDocument } from './kitchenReports'
import { kitchenErrorMessage, removeEntry } from './kitchenService'

// A receipt («ΣΤΟΙΧΕΙΑ ΠΑΡΑΛΑΒΗΣ»): its products as batches in stock, the receipt checks,
// the attached delivery note and the details.
export function KitchenReceiptRecordPage() {
  const { receiptId } = useParams()
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/kitchen?tab=storage&view=receipts')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const access = useKitchenAccess()
  const { state, loading, reload, organizationId } = useKitchen({ receiptId })
  const [tab, setTab] = useState('items')
  const [dialog, setDialog] = useState(null)
  const [trace, setTrace] = useState(null)
  const report = useDeviationReport()
  const receipt = state?.receipts.find(item => item.id === receiptId) || null
  const stock = useMemo(() => (state ? stockRows(state) : []), [state])
  const [files, setFiles] = useState([])

  if (!state) return <Page fill><div className="inline-empty">{loading ? (en ? 'Loading…' : 'Φόρτωση…') : (en ? 'Not available.' : 'Δεν είναι διαθέσιμο.')}</div></Page>
  if (!receipt) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Receipt not found' : 'Η παραλαβή δεν βρέθηκε'}</strong></div></Page>

  const rows = receipt.items.map(item => ({ ...item, stock: stock.find(row => row.receiptItemId === item.id) }))
  const rejected = rows.filter(item => item.accepted === false).length
  const out = rows.filter(item => item.temperatureStatus === 'out').length
  const bad = RECEIPT_CHECK_FIELDS.filter(item => receipt[item.field] === 'noncompliant')
  const blocked = () => notify(en ? 'Allow pop-ups to print.' : 'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.', 'error')
  async function remove() {
    if (!await confirm({ title: en ? 'Delete receipt' : 'Διαγραφή παραλαβής', message: en ? 'The receipt and its products leave the stock; materials used keep their label without a batch.' : 'Η παραλαβή και τα προϊόντα της φεύγουν από το απόθεμα· οι πρώτες ύλες σε χρήση κρατούν την ετικέτα χωρίς παρτίδα.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeEntry(organizationId, 'kitchen_receipts', receipt.id); notify(en ? 'Deleted.' : 'Διαγράφηκε.', 'success'); goBack() } catch (error) { notify(kitchenErrorMessage(error, language), 'error') }
  }
  const headerActions = <div className="row-actions">
    <ExportMenu {...reportExports(() => receiptsLogDocument([receipt], { from: receipt.receivedOn, to: receipt.receivedOn, language }), { onBlocked: blocked })} />
    {access.canRecord && receipt.limitStatus === 'out' && <Button variant="secondary" onClick={() => report(receiptTitle(receipt, language), [`${en ? 'Receipt' : 'Παραλαβή'} ${fmtDay(receipt.receivedOn)} ${receipt.receivedTime || ''}`, ...bad.map(item => `${item.label[en ? 1 : 0]}: ${checkLabel('noncompliant', language)}`), ...rows.filter(item => item.accepted === false).map(item => `${item.productName}: ${item.rejectionReason}`), receipt.qualityNotes, receipt.correctiveAction && `${en ? 'Corrective action' : 'Διορθωτική ενέργεια'}: ${receipt.correctiveAction}`], receipt.receivedOn)}><AlertTriangle size={15} />{en ? 'Deviation' : 'Απόκλιση'}</Button>}
    {access.canRecord && <IconButton label={en ? 'Edit receipt' : 'Επεξεργασία παραλαβής'} tone="edit" onClick={() => setDialog({ type: 'receipt', initial: structuredClone(receipt) })}><Pencil size={16} /></IconButton>}
    {access.canManage && <IconButton tone="danger" label={en ? 'Delete receipt' : 'Διαγραφή παραλαβής'} onClick={remove}><Trash2 size={16} /></IconButton>}
  </div>
  const tabs = [
    { id: 'items', label: en ? `Products ${rows.length}` : `Προϊόντα ${rows.length}`, icon: Package },
    { id: 'checks', label: en ? 'Receipt checks' : 'Έλεγχοι παραλαβής', icon: ClipboardCheck },
    { id: 'files', label: en ? 'Files' : 'Αρχεία', icon: FolderOpen },
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: Info },
  ]
  const demo = isDemoDataEnvironment()
  return <Page fill><EntityRecordShell className="kitchen-record-shell workspace-fill" avatar={<Truck size={19} />} eyebrow={en ? 'Receipt' : 'Παραλαβή'} recordId={receipt.code} title={receipt.supplierName || (en ? 'Receipt' : 'Παραλαβή')}
    subtitle={[`${fmtDay(receipt.receivedOn)}${receipt.receivedTime ? ` ${receipt.receivedTime}` : ''}`, receipt.orderReference && `${en ? 'Order' : 'Παραγγελία'} ${receipt.orderReference}`, receipt.receiverName, receipt.code].filter(Boolean).join(' · ')}
    status={<span className="kitchen-notes"><SignalBadge tone={receiptResultTone(receipt.result)}>{receiptResultLabel(receipt.result, language)}</SignalBadge><LimitBadge status={receipt.limitStatus} language={language} />{receipt.status === 'in_progress' && <SignalBadge tone="info">{en ? 'In progress' : 'Σε εξέλιξη'}</SignalBadge>}</span>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'items' && <RecordTabPanel title={en ? 'Products' : 'Προϊόντα'} subtitle={en ? 'Each product is a batch in stock; a rejected one adds none.' : 'Κάθε προϊόν είναι μια παρτίδα στο απόθεμα· όσα απορρίφθηκαν δεν προσθέτουν.'}>
      <RecordMetricStrip items={[{ label: en ? 'Products' : 'Προϊόντα', value: rows.length, primary: true }, { label: en ? 'Rejected' : 'Απορρίφθηκαν', value: rejected, tone: rejected ? 'danger' : undefined }, { label: en ? 'Out of limits' : 'Εκτός ορίων', value: out, tone: out ? 'danger' : undefined }, { label: en ? 'Still in stock' : 'Σε απόθεμα', value: rows.filter(item => item.stock?.remaining > 0.0005).length }]} />
      <RegistryTable className="kitchen-table" rows={rows} rowKey={item => item.id}
        columns={[{ key: 'product', label: en ? 'Product' : 'Προϊόν' }, { key: 'batch', label: en ? 'Batch · expiry' : 'Παρτίδα · λήξη' }, { key: 'qty', label: en ? 'Quantity' : 'Ποσότητα' }, { key: 'temp', label: en ? 'Temperature' : 'Θερμοκρασία' }, { key: 'accepted', label: en ? 'Accepted' : 'Αποδοχή' }, { key: 'stock', label: en ? 'Used · remaining' : 'Καταναλώσεις · υπόλοιπο' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No products recorded' : 'Δεν καταγράφηκαν προϊόντα'}
        renderRow={item => <>
          <td><strong>{item.productName}</strong><small>{storageLabel(item.storage, language)}{item.notes ? ` · ${item.notes}` : ''}</small></td>
          <td className="nowrap-cell">{item.batchCode || item.lotLabel || '—'}<small>{fmtDay(item.expiryOn)}</small></td>
          <td className="nowrap-cell">{fmtQty(item.quantity, language)} {unitLabel(item.unit, language)}</td>
          <td className={`nowrap-cell kitchen-measure is-${item.temperatureStatus || 'none'}`}>{item.temperature !== '' && item.temperature != null ? fmtTemp(item.temperature, language) : '—'}{item.temperatureStatus && <small><LimitBadge status={item.temperatureStatus} language={language} /></small>}</td>
          <td>{item.accepted === false ? <><SignalBadge tone="danger">{en ? 'Rejected' : 'Απορρίφθηκε'}</SignalBadge><small className="kitchen-action-text" title={item.rejectionReason}>{item.rejectionReason}</small></> : <SignalBadge tone="success">{en ? 'Accepted' : 'Αποδεκτό'}</SignalBadge>}</td>
          <td className="nowrap-cell">{item.stock ? <>{fmtQty(item.stock.used, language)} · <strong>{fmtQty(item.stock.remaining, language)}</strong><StockNotes row={item.stock} language={language} /></> : '—'}</td>
          <td>{item.stock && <IconButton size="sm" label={en ? 'Traceability' : 'Ιχνηλάτηση'} onClick={() => setTrace(item.id)}><Route size={14} /></IconButton>}</td>
        </>} />
    </RecordTabPanel>}
    {tab === 'checks' && <RecordTabPanel title={en ? 'Receipt checks' : 'Έλεγχοι παραλαβής'}>
      <div className="record-view-stack">
        <RecordDetailsGrid fields={[
          ...RECEIPT_CHECK_FIELDS.map(item => ({ label: item.label[en ? 1 : 0], value: receipt[item.field] ? <SignalBadge tone={receipt[item.field] === 'noncompliant' ? 'danger' : 'success'}>{checkLabel(receipt[item.field], language)}</SignalBadge> : '—' })),
          { label: en ? 'Goods' : 'Είδος φορτίου', value: temperatureClassLabel(receipt.temperatureClass, language) },
          { label: en ? 'Measured temperature' : 'Μετρημένη θερμοκρασία', value: receipt.measuredTemperature !== '' && receipt.measuredTemperature != null ? fmtTemp(receipt.measuredTemperature, language) : receipt.measuredTemperatureText || '—', meta: receipt.temperatureStatus ? `${limitText(state.limits.find(item => item.limitKey === `receipt_${receipt.temperatureClass}`), language)}` : '' },
          { label: en ? 'Receipt' : 'Παραλαβή', value: receipt.accepted === false ? (en ? 'No (rejected)' : 'Όχι (απορρίφθηκε)') : receipt.accepted ? (en ? 'Yes' : 'Ναι') : (en ? 'Pending' : 'Εκκρεμεί') },
        ]} />
        <RecordDetailsGrid fields={[{ label: en ? 'Quality control remarks' : 'Παρατηρήσεις ποιοτικού ελέγχου', value: receipt.qualityNotes || '—', className: 'kitchen-span-3' }, { label: en ? 'Corrective action' : 'Διορθωτική ενέργεια', value: receipt.correctiveAction || '—', className: 'kitchen-span-3' }]} />
      </div>
    </RecordTabPanel>}
    {tab === 'files' && <RecordTabPanel title={en ? 'Files' : 'Αρχεία'} subtitle={en ? 'The delivery note, invoice or photos of the receipt.' : 'Το δελτίο αποστολής, το τιμολόγιο ή φωτογραφίες της παραλαβής.'}>
      <div className="resource-pad"><DocumentsWorkspace disabled={!access.canRecord} organizationId={demo ? null : organizationId} entityType="kitchen_receipt" entityId={receipt.id}
        categories={[['deliveryNote', en ? 'Delivery note' : 'Δελτίο αποστολής'], ['photo', en ? 'Photo' : 'Φωτογραφία'], ['generalDocument', en ? 'Document' : 'Έγγραφο']]} value={demo ? files : undefined} onChange={demo ? setFiles : undefined} /></div>
    </RecordTabPanel>}
    {tab === 'details' && <RecordTabPanel title={en ? 'Details' : 'Στοιχεία'}>
      <RecordDetailsGrid fields={[{ label: en ? 'Code' : 'Κωδικός', value: receipt.code }, { label: en ? 'Supplier' : 'Προμηθευτής', value: receipt.supplierName || '—', meta: receipt.supplierId ? '' : (en ? 'Not linked to the suppliers registry' : 'Χωρίς σύνδεση με το μητρώο προμηθευτών') }, { label: en ? 'Date · time' : 'Ημερομηνία · ώρα', value: `${fmtDay(receipt.receivedOn)}${receipt.receivedTime ? ` · ${receipt.receivedTime}` : ''}` },
        { label: en ? 'Order number (reference)' : 'Αριθμός παραγγελίας (αναφορά)', value: receipt.orderReference || '—' }, { label: en ? 'Received by' : 'Παρέλαβε', value: receipt.receiverName || '—' }, { label: en ? 'Recorded' : 'Καταχωρίστηκε', value: fmtStamp(receipt.createdAt, language) || '—', meta: receipt.source === 'filemaker' ? 'FileMaker' : '' }]} />
      {receipt.supplierId && <div className="kitchen-pad"><Button variant="secondary" onClick={() => navigate(`/quality/suppliers/${receipt.supplierId}`)}><Truck size={15} />{en ? 'Supplier record' : 'Καρτέλα προμηθευτή'}</Button></div>}
    </RecordTabPanel>}
    <KitchenDialogHost dialog={dialog} setDialog={setDialog} state={state} stock={stock} dishes={[]} organizationId={organizationId} reload={reload} />
    {trace && <TraceDialog state={state} organizationId={organizationId} receiptItemId={trace} onClose={() => setTrace(null)} />}
  </EntityRecordShell></Page>
}
