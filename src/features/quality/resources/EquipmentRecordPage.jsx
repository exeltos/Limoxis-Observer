import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertOctagon, CalendarClock, CheckSquare2, ClipboardList, History, Plus, Stethoscope, Trash2, Wrench } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { Button } from '../../../design-system/Button'
import { SaveButton } from '../../../design-system/SaveButton'
import { IconButton } from '../../../design-system/IconButton'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { PrintExportActions } from '../../../design-system/PrintExportActions'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry } from '../../../core/export/registryExports'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useLibraries, libraryOptions } from '../../management/useLibraries'
import { QualityDepartmentField } from '../QualityFields'
import { useResources, useResourceAccess } from './ResourcesPanel'
import { addEvent, removeEquipment, removeEvent, saveEquipment } from './resourceService'
import { CRITICALITY, EVENT_KINDS, PROGRAMME, criticalityLabel, criticalityTone, dueStateLabel, dueStateTone, equipmentCapaSource, equipmentProblems, equipmentStateLabel, equipmentStateTone, eventKindLabel, eventProblems, eventResultLabel, eventResultTone, newEquipment, newEvent, resultsFor } from './resourceModel'
import '../quality.css'
import './resources.css'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

export function EquipmentRecordPage() {
  const { equipmentId } = useParams()
  const isNew = equipmentId === 'new'
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/quality')
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { tenant } = useTenant()
  const access = useResourceAccess()
  const list = useResources()
  const { libraries } = useLibraries()
  const [draft, setDraft] = useState(null)
  const [tab, setTab] = useState(isNew ? 'details' : 'programme')
  const [saving, setSaving] = useState(false)
  const [event, setEvent] = useState(null)

  const row = useMemo(() => (isNew ? null : list.equipment.find(item => item.id === equipmentId) || null), [isNew, list.equipment, equipmentId])
  useEffect(() => { if (isNew) setDraft(current => current || newEquipment()); else if (row) setDraft(current => (current?.id === row.id ? current : structuredClone(row))) }, [isNew, row])
  const events = useMemo(() => list.events.filter(item => item.equipmentId === equipmentId).sort((a, b) => String(b.happenedOn).localeCompare(String(a.happenedOn)) || String(b.recordedAt || '').localeCompare(String(a.recordedAt || ''))), [list.events, equipmentId])

  if (list.loading && !draft) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (!isNew && !row) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Device not found' : 'Ο εξοπλισμός δεν βρέθηκε'}</strong></div></Page>
  if (!draft) return null

  const locked = !access.canManage
  const canRecord = access.canManage || (row?.departmentId && access.ownDepartments.includes(row.departmentId))
  const set = next => setDraft(current => ({ ...current, ...next }))
  const typeOptions = libraryOptions(libraries.equipment || [], language)
  const supplierOptions = list.suppliers.filter(item => item.status !== 'inactive' || item.id === draft.supplierId).map(item => ({ value: item.id, label: item.name, description: item.code, keywords: `${item.code} ${item.name}` }))

  async function save() {
    const problems = equipmentProblems(draft, language)
    if (problems.length) { notify(`${en ? 'Fill in:' : 'Συμπληρώστε:'} ${problems.join(' · ')}`, 'error'); return }
    setSaving(true)
    try {
      const saved = await saveEquipment(tenant?.id, draft)
      notify(en ? 'Device saved.' : 'Ο εξοπλισμός αποθηκεύτηκε.', 'success')
      await list.reload()
      if (isNew) navigate(`/quality/equipment/${saved.id}`, { replace: true })
      else setDraft(structuredClone(saved))
    } catch (error) { console.error(error); notify(en ? 'The device could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.', 'error') } finally { setSaving(false) }
  }
  async function remove() {
    const ok = await confirm({ title: en ? 'Delete device' : 'Διαγραφή εξοπλισμού', message: en ? `The device and its ${events.length} events are deleted. A device no longer used is better marked «Retired».` : `Διαγράφονται ο εξοπλισμός και τα ${events.length} συμβάντα του. Για εξοπλισμό που δεν χρησιμοποιείται πια, προτιμήστε «Αποσύρθηκε».`, confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await removeEquipment(tenant?.id, row.id); notify(en ? 'Device deleted.' : 'Ο εξοπλισμός διαγράφηκε.', 'success'); goBack() } catch (error) { console.error(error); notify(en ? 'The device could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  async function dropEvent(item) {
    const ok = await confirm({ title: en ? 'Delete event' : 'Διαγραφή συμβάντος', message: en ? 'Only for an event recorded by mistake.' : 'Μόνο για συμβάν που καταχωρίστηκε κατά λάθος.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await removeEvent(tenant?.id, item.id); await list.reload() } catch (error) { console.error(error); notify(en ? 'The event could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  const openCapa = item => navigate('/quality/capas/new', { state: { qualitySource: { ...equipmentCapaSource(row, item, language), department: row.department, departmentEn: row.departmentEn } } })

  const tabs = isNew ? [{ id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList }] : [
    { id: 'programme', label: en ? 'Programme' : 'Πρόγραμμα', icon: CalendarClock },
    { id: 'history', label: en ? `History ${events.length}` : `Ιστορικό ${events.length}`, icon: History },
    { id: 'details', label: en ? 'Details' : 'Στοιχεία', icon: ClipboardList },
  ]
  const headerActions = !isNew && <div className="row-actions">
    {canRecord && row.state !== 'retired' && <Button variant="secondary" onClick={() => setEvent(newEvent('maintenance'))}><Wrench size={15} />{en ? 'Record a check' : 'Καταγραφή ελέγχου'}</Button>}
    {canRecord && row.state === 'in_service' && <Button variant="secondary" onClick={() => setEvent(newEvent('failure'))}><AlertOctagon size={15} />{en ? 'Report a failure' : 'Δήλωση βλάβης'}</Button>}
    {canRecord && row.state === 'out_of_service' && <Button onClick={() => setEvent(newEvent('repair'))}><Wrench size={15} />{en ? 'Record the repair' : 'Καταγραφή επισκευής'}</Button>}
    {access.canManage && row.state === 'out_of_service' && <Button variant="secondary" onClick={() => openCapa(row.downEvent)}><CheckSquare2 size={15} />{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>}
    {access.canManage && <IconButton tone="danger" label={en ? 'Delete device' : 'Διαγραφή εξοπλισμού'} onClick={remove}><Trash2 size={16} /></IconButton>}
  </div>
  const footer = !locked && <div className="inline-edit-footer"><Button variant="secondary" onClick={goBack}>{en ? 'Close' : 'Κλείσιμο'}</Button><SaveButton loading={saving} disabled={saving} onClick={save}>{isNew ? (en ? 'Register device' : 'Καταχώριση εξοπλισμού') : (en ? 'Save' : 'Αποθήκευση')}</SaveButton></div>
  const exportHistory = () => exportRegistry({ name: `${row.code}-${en ? 'history' : 'istoriko'}`, headers: en ? ['Date', 'Event', 'Result', 'By', 'Description', 'Certificate'] : ['Ημερομηνία', 'Συμβάν', 'Αποτέλεσμα', 'Από', 'Περιγραφή', 'Πιστοποιητικό'], rows: events.map(item => [item.happenedOn, eventKindLabel(item.kind, language), eventResultLabel(item, language), item.performedBy, item.description, item.certificate]) })

  return <Page fill><EntityRecordShell className="quality-record-shell resource-record-shell workspace-fill" avatar={<Stethoscope size={19} />} eyebrow={row?.code || (en ? 'New device' : 'Νέος εξοπλισμός')} title={draft.name || (en ? 'New device' : 'Νέος εξοπλισμός')}
    subtitle={row ? [(en ? row.departmentEn : row.department), row.location, [row.manufacturer, row.model].filter(Boolean).join(' '), row.serialNumber && `S/N ${row.serialNumber}`].filter(Boolean).join(' · ') : ''}
    status={row && <span className="resource-status"><StatusBadge tone={equipmentStateTone(row.state)}>{equipmentStateLabel(row.state, language)}</StatusBadge><StatusBadge tone={criticalityTone(row.criticality)}>{en ? 'Criticality' : 'Κρισιμότητα'}: {criticalityLabel(row.criticality, language)}</StatusBadge></span>}
    headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack}>
    {tab === 'programme' && row && <RecordTabPanel title={en ? 'Maintenance and calibration programme' : 'Πρόγραμμα συντήρησης και διακρίβωσης'} subtitle={en ? 'The next date follows from the last successful check and the interval.' : 'Η επόμενη ημερομηνία προκύπτει από τον τελευταίο επιτυχή έλεγχο και το διάστημα.'}>
      <div className="resource-pad">
      {row.state === 'out_of_service' && <div className="resource-alert"><AlertOctagon size={16} /><span><strong>{en ? 'Out of service' : 'Εκτός λειτουργίας'} {en ? 'since' : 'από'} {formatDay(row.downSince, language)}</strong>{row.downEvent?.description && ` · ${row.downEvent.description}`}</span><span className="resource-alert-actions">{canRecord && <Button onClick={() => setEvent(newEvent('repair'))}><Wrench size={15} />{en ? 'Record the repair' : 'Καταγραφή επισκευής'}</Button>}{access.canManage && <Button variant="secondary" onClick={() => openCapa(row.downEvent)}><CheckSquare2 size={15} />{en ? 'Corrective action' : 'Διορθωτική ενέργεια'}</Button>}</span></div>}
      <div className="resource-programme">
        {row.programme.map(item => { const step = PROGRAMME.find(entry => entry.kind === item.kind); return <section key={item.kind} className={`resource-programme-card is-${item.state}`}>
          <header><strong>{step.label[en ? 1 : 0]}</strong><StatusBadge tone={dueStateTone(item.state)}>{dueStateLabel(item.state, language)}</StatusBadge></header>
          {item.state === 'none' ? <p>{en ? 'Not part of this device’s programme.' : 'Δεν προβλέπεται για αυτόν τον εξοπλισμό.'}</p> : <dl>
            <div><dt>{en ? 'Every' : 'Κάθε'}</dt><dd>{item.months} {en ? 'months' : 'μήνες'}</dd></div>
            <div><dt>{en ? 'Last' : 'Τελευταία'}</dt><dd>{item.last ? formatDay(item.last.happenedOn, language) : en ? 'never recorded' : 'δεν έχει καταγραφεί'}</dd></div>
            <div><dt>{en ? 'Next' : 'Επόμενη'}</dt><dd>{formatDay(item.nextDue, language)}{item.days != null && <small>{item.days < 0 ? (en ? `${-item.days} days late` : `${-item.days} ημέρες καθυστέρηση`) : en ? `in ${item.days} days` : `σε ${item.days} ημέρες`}</small>}</dd></div>
          </dl>}
          {item.state !== 'none' && canRecord && row.state !== 'retired' && <Button variant="secondary" onClick={() => setEvent(newEvent(item.kind))}><Plus size={15} />{en ? 'Record' : 'Καταγραφή'}</Button>}
        </section> })}
      </div>
      <div className="resource-facts">
        <span>{en ? 'Warranty' : 'Εγγύηση'}: <strong>{row.warrantyEndsOn ? `${row.warrantyActive ? (en ? 'until' : 'έως') : (en ? 'ended' : 'έληξε')} ${formatDay(row.warrantyEndsOn, language)}` : '—'}</strong></span>
        <span>{en ? 'Supplier' : 'Προμηθευτής'}: <strong>{row.supplierName || '—'}</strong></span>
        <span>{en ? 'Failures recorded' : 'Καταγεγραμμένες βλάβες'}: <strong>{row.failures}</strong></span>
      </div>
      </div>
    </RecordTabPanel>}
    {tab === 'history' && row && <RecordTabPanel title={en ? 'History' : 'Ιστορικό'} subtitle={en ? 'Every check, failure and repair of the device.' : 'Κάθε έλεγχος, βλάβη και επισκευή του εξοπλισμού.'} actions={<div className="row-actions"><PrintExportActions showPrint={false} onExport={exportHistory} />{canRecord && row.state !== 'retired' && <Button onClick={() => setEvent(newEvent('maintenance'))}><Plus size={15} />{en ? 'Event' : 'Συμβάν'}</Button>}</div>}>
      <RegistryTable className="quality-table" rows={events} rowKey={item => item.id}
        columns={[{ key: 'date', label: en ? 'Date' : 'Ημερομηνία' }, { key: 'kind', label: en ? 'Event' : 'Συμβάν' }, { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα' }, { key: 'by', label: en ? 'By' : 'Από' }, { key: 'description', label: en ? 'Description' : 'Περιγραφή' }, { key: 'actions', label: '' }]}
        emptyTitle={en ? 'No events yet' : 'Δεν υπάρχουν συμβάντα'} emptyText={en ? 'Record maintenance, calibrations, safety tests and failures here.' : 'Καταγράψτε εδώ συντηρήσεις, διακριβώσεις, ελέγχους ασφάλειας και βλάβες.'}
        renderRow={item => <>
          <td className="nowrap-cell">{formatDay(item.happenedOn, language)}</td>
          <td>{eventKindLabel(item.kind, language)}{item.certificate && <small>{en ? 'Certificate' : 'Πιστοποιητικό'} {item.certificate}</small>}</td>
          <td><StatusBadge tone={eventResultTone(item)}>{eventResultLabel(item, language)}</StatusBadge></td>
          <td>{item.performedBy || '—'}</td>
          <td className="resource-description-cell">{item.description || '—'}</td>
          <td><div className="row-actions">{access.canManage && item.kind === 'failure' && <IconButton size="sm" label={en ? 'Corrective action' : 'Διορθωτική ενέργεια'} onClick={() => openCapa(item)}><CheckSquare2 size={14} /></IconButton>}{access.canManage && <IconButton size="sm" tone="danger" label={en ? 'Delete event' : 'Διαγραφή συμβάντος'} onClick={() => dropEvent(item)}><Trash2 size={14} /></IconButton>}</div></td>
        </>} />
    </RecordTabPanel>}
    {tab === 'details' && <RecordTabPanel title={en ? 'Details' : 'Στοιχεία'} subtitle={locked ? (en ? 'Kept by Quality.' : 'Τα τηρεί η Ποιότητα.') : ''} footer={footer}>
      <div className="lo-form-cards">
        <FormCard wide title={en ? 'Device' : 'Εξοπλισμός'}>
          <FormGrid columns={3}>
            <Field label={en ? 'Name *' : 'Ονομασία *'}><input value={draft.name} disabled={locked} onChange={e => set({ name: e.target.value })} placeholder={en ? 'e.g. Defibrillator' : 'π.χ. Απινιδωτής'} /></Field>
            <SearchableSelect label={en ? 'Type' : 'Τύπος'} value={draft.equipmentType} options={typeOptions} disabled={locked} allowCustom onChange={value => set({ equipmentType: value || '', name: draft.name || value || '' })} placeholder={en ? 'From the equipment library' : 'Από τη βιβλιοθήκη εξοπλισμού'} {...selectText(en)} />
            {locked ? <Field label={en ? 'Department' : 'Τμήμα'}><input value={(en ? row?.departmentEn : row?.department) || ''} disabled /></Field> : <QualityDepartmentField value={draft.departmentId} onChange={next => set({ departmentId: next.departmentId })} />}
            <Field label={en ? 'Location' : 'Θέση'}><input value={draft.location} disabled={locked} onChange={e => set({ location: e.target.value })} placeholder={en ? 'e.g. Nurses station' : 'π.χ. Σταθμός νοσηλευτών'} /></Field>
            <Field label={en ? 'Manufacturer' : 'Κατασκευαστής'}><input value={draft.manufacturer} disabled={locked} onChange={e => set({ manufacturer: e.target.value })} /></Field>
            <Field label={en ? 'Model' : 'Μοντέλο'}><input value={draft.model} disabled={locked} onChange={e => set({ model: e.target.value })} /></Field>
            <Field label={en ? 'Serial number' : 'Σειριακός αριθμός'}><input value={draft.serialNumber} disabled={locked} onChange={e => set({ serialNumber: e.target.value })} /></Field>
            <Field label={en ? 'Inventory number' : 'Αριθμός απογραφής'}><input value={draft.inventoryNumber} disabled={locked} onChange={e => set({ inventoryNumber: e.target.value })} /></Field>
            <SearchableSelect label={en ? 'Supplier' : 'Προμηθευτής'} value={draft.supplierId} options={supplierOptions} disabled={locked} onChange={value => set({ supplierId: value || '' })} placeholder={en ? 'From the suppliers' : 'Από τους προμηθευτές'} {...selectText(en)} />
          </FormGrid>
          <FormGrid columns={3}>
            <ChoiceField label={en ? 'Criticality' : 'Κρισιμότητα'} value={draft.criticality} options={CRITICALITY.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => !locked && set({ criticality: value })} />
            <ManualDateField label={en ? 'Installed on' : 'Εγκατάσταση'} value={draft.installedOn} disabled={locked} onChange={value => set({ installedOn: value })} optional />
            <ManualDateField label={en ? 'Warranty until' : 'Εγγύηση έως'} value={draft.warrantyEndsOn} disabled={locked} onChange={value => set({ warrantyEndsOn: value })} optional />
          </FormGrid>
        </FormCard>
        <FormCard wide icon={CalendarClock} title={en ? 'Programme' : 'Πρόγραμμα'} hint={en ? 'Leave empty what the device does not need.' : 'Αφήστε κενό ό,τι δεν χρειάζεται ο εξοπλισμός.'}>
          <FormGrid columns={3}>
            {PROGRAMME.map(step => <Field key={step.kind} label={`${step.label[en ? 1 : 0]} (${en ? 'every … months' : 'κάθε … μήνες'})`}><input type="number" min="1" max="120" inputMode="numeric" value={draft[step.field] ?? ''} disabled={locked} onChange={e => set({ [step.field]: e.target.value })} /></Field>)}
          </FormGrid>
        </FormCard>
        <FormCard wide title={en ? 'Status and notes' : 'Κατάσταση και σημειώσεις'}>
          <ChoiceField label={en ? 'In use' : 'Χρήση'} value={draft.status} options={[{ value: 'in_service', label: en ? 'In use' : 'Σε χρήση' }, { value: 'retired', label: en ? 'Retired' : 'Αποσύρθηκε' }]} onChange={value => !locked && set({ status: value })} />
          <Field label={en ? 'Notes' : 'Σημειώσεις'}><textarea rows={3} value={draft.notes} disabled={locked} onChange={e => set({ notes: e.target.value })} /></Field>
        </FormCard>
      </div>
    </RecordTabPanel>}
    {event && <EventDialog event={event} setEvent={setEvent} device={row} language={language} onSave={async () => {
      const problems = eventProblems(event, language)
      if (problems.length) { notify(`${en ? 'Fill in:' : 'Συμπληρώστε:'} ${problems.join(' · ')}`, 'error'); return }
      try {
        await addEvent(tenant?.id, row.id, event)
        notify(event.kind === 'failure' && event.result === 'out_of_service' ? (en ? 'Failure recorded: the device is out of service.' : 'Η βλάβη καταγράφηκε: ο εξοπλισμός είναι εκτός λειτουργίας.') : (en ? 'Event recorded.' : 'Το συμβάν καταγράφηκε.'), 'success')
        setEvent(null)
        await list.reload()
      } catch (error) { console.error(error); notify(en ? 'The event could not be recorded.' : 'Δεν ήταν δυνατή η καταγραφή.', 'error') }
    }} />}
  </EntityRecordShell></Page>
}

// One event of a device: a check of its programme, a failure, a repair.
function EventDialog({ event, setEvent, device, language, onSave }) {
  const en = language === 'en'
  const [busy, setBusy] = useState(false)
  const set = next => setEvent(current => ({ ...current, ...next }))
  const kinds = EVENT_KINDS.filter(item => item.value !== 'repair' || device.state === 'out_of_service' || event.kind === 'repair')
  return <ObserverDialog title={en ? 'Record an event' : 'Καταγραφή συμβάντος'} subtitle={`${device.code} · ${device.name}`} onClose={() => setEvent(null)}
    footer={<DialogActions onCancel={() => setEvent(null)} onSave={async () => { setBusy(true); try { await onSave() } finally { setBusy(false) } }} saveLabel={en ? 'Record' : 'Καταγραφή'} disabled={busy} />}>
    <div className="resource-event-form">
      <ChoiceField label={en ? 'Event' : 'Συμβάν'} value={event.kind} options={kinds.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={kind => set({ kind, result: resultsFor(kind)[0] })} />
      <ChoiceField label={en ? 'Result' : 'Αποτέλεσμα'} value={event.result} options={resultsFor(event.kind).map(value => ({ value, label: eventResultLabel({ kind: event.kind, result: value }, language) }))} onChange={result => set({ result })} />
      <FormGrid columns={2}>
        <ManualDateField label={en ? 'Date *' : 'Ημερομηνία *'} value={event.happenedOn} onChange={value => set({ happenedOn: value })} />
        <Field label={en ? 'By' : 'Από'}><input value={event.performedBy} onChange={e => set({ performedBy: e.target.value })} placeholder={en ? 'Technician, company or staff' : 'Τεχνικός, εταιρεία ή προσωπικό'} /></Field>
      </FormGrid>
      {['maintenance', 'calibration', 'safety'].includes(event.kind) && <Field label={en ? 'Certificate / report number' : 'Αριθμός πιστοποιητικού / δελτίου'}><input value={event.certificate} onChange={e => set({ certificate: e.target.value })} /></Field>}
      <Field label={event.kind === 'failure' ? (en ? 'What happened *' : 'Τι συνέβη *') : (en ? 'Description' : 'Περιγραφή')}><textarea rows={3} value={event.description} onChange={e => set({ description: e.target.value })} /></Field>
      {event.kind === 'failure' && event.result === 'out_of_service' && <p className="resource-event-note">{en ? 'The device shows as out of service until a repair is recorded.' : 'Ο εξοπλισμός εμφανίζεται εκτός λειτουργίας μέχρι να καταγραφεί επισκευή.'}</p>}
    </div>
  </ObserverDialog>
}
