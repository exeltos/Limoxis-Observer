import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { StepList } from '../../design-system/StepList'
import { FormCard } from '../../design-system/FormCard'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { YesNoField } from '../../design-system/YesNoField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { MetricCard } from '../../design-system/MetricCard'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { parseCsv, readWorkbookSheets } from '../../core/import/spreadsheetImport'
import { deleteEntries, loadEntries, loadRegister, saveEntries, saveRegister } from './registerService'
import { useRegisterAccess } from './registerAccess'
import { keyFrom, textOf } from './registerEngine'
import { IGNORED_COLUMN, isAmka, planImport, suggestMapping, toIsoDate, valueMappings, withTemplateHints } from './registerImport'
import { formatDay } from '../../core/i18n/formatDay'
import './registers.css'

const NEW = '__new__'
const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

async function readFile(file) {
  const name = String(file?.name || '').toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCsv(await file.text())
  if (name.endsWith('.xlsx')) return (await readWorkbookSheets(await file.arrayBuffer(), { skipEmpty: true }))[0]?.rows || []
  throw new Error('SPREADSHEET_UNSUPPORTED_TYPE')
}

// Bringing a register's history in from FileMaker: the file, its columns,
// its list values, then a dry run that says exactly what goes in and what
// not before anything is written. The file stays in the browser; only the
// imported values reach the register's table (names to its identity table).
export function RegisterImportPage() {
  const { registerId } = useParams()
  const navigate = useNavigate()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { user, profile } = useAuth()
  const { tenant } = useTenant()
  const access = useRegisterAccess()
  const [register, setRegister] = useState(null)
  const [existing, setExisting] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [table, setTable] = useState({ headers: [], rows: [] })
  const [mapping, setMapping] = useState([])
  const [valueMap, setValueMap] = useState({})
  const [emptyIsNo, setEmptyIsNo] = useState(true)
  const [fallbackDate, setFallbackDate] = useState('')
  const [replace, setReplace] = useState(false)
  const [progress, setProgress] = useState(null)
  const [reading, setReading] = useState(false)
  const back = () => navigate(`/registers/${registerId}`, { replace: true })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const next = await loadRegister(tenant?.id, registerId)
        if (!active || !next) return
        // The template's FileMaker names and newer options come along (withTemplateHints).
        const hinted = withTemplateHints(next)
        setRegister(hinted)
        if (hinted.undatedImport) setFallbackDate(new Date().toISOString().slice(0, 10))
        setExisting(await loadEntries(tenant?.id, next.id, { withIdentity: access.canSeeIdentity(next), register: next }))
      } catch (error) { console.error(error) } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [tenant?.id, registerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const lists = useMemo(() => (register && table.headers.length ? valueMappings(register, table.headers, table.rows, mapping) : {}), [register, table, mapping])
  const chosenValues = useMemo(() => Object.fromEntries(Object.entries(lists).map(([key, list]) => [key, Object.fromEntries(list.values.map(item => [item.value, valueMap[key]?.[item.value] ?? (item.option || ((list.field.provisional || !list.field.options?.length) && key !== 'sheet.measure' ? NEW : ''))]))])), [lists, valueMap])
  // New list values (a physician FileMaker knew) become options of the register.
  const newOptions = useMemo(() => {
    const result = {}
    for (const [key, values] of Object.entries(chosenValues)) {
      const field = register?.fields.find(item => item.key === key)
      if (!field) continue
      const taken = (field.options || []).map(option => option.value)
      for (const [value, option] of Object.entries(values)) if (option === NEW) { const id = keyFrom(value, taken); taken.push(id); result[key] = { ...(result[key] || {}), [value]: id } }
    }
    return result
  }, [chosenValues, register])
  const effectiveMap = useMemo(() => Object.fromEntries(Object.entries(chosenValues).map(([key, values]) => [key, Object.fromEntries(Object.entries(values).map(([value, option]) => [value, option === NEW ? newOptions[key]?.[value] || '' : option]))])), [chosenValues, newOptions])
  // Replacing: what is there goes, except closed (locked) periods, which stay and still count.
  const replaced = useMemo(() => (replace ? existing.filter(entry => !entry.locked) : []), [replace, existing])
  const keptEntries = useMemo(() => (replace ? existing.filter(entry => entry.locked) : existing), [replace, existing])
  const plan = useMemo(() => (register && step >= 3 ? planImport(register, table.headers, table.rows, mapping, { valueMap: effectiveMap, emptyIsNo, fallbackDate, existing: keptEntries, language }) : null), [register, step, table, mapping, effectiveMap, emptyIsNo, fallbackDate, keptEntries, language])

  if (loading) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (!register) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Register not found' : 'Το μητρώο δεν βρέθηκε'}</strong></div></Page>
  const canImport = access.canRecord(register) && (register.kind === 'sheet' || access.canSeeIdentity(register))
  if (!canImport) return <Navigate to={`/registers/${registerId}`} replace />

  const sheet = register.kind === 'sheet'
  const targets = [
    ...(sheet ? [{ value: 'sheet.date', label: en ? 'Date' : 'Ημερομηνία' }, ...(register.sheet.measures.length > 1 ? [{ value: 'sheet.measure', label: en ? 'Column (shift)' : 'Στήλη (βάρδια)' }] : []), ...register.sheet.rows.map(row => ({ value: `row.${row.key}`, label: textOf(row, language) }))] : [
      ...(register.settings?.identity?.caseNumber ? [{ value: 'identity.caseNumber', label: en ? 'Case number (department only)' : 'Αριθμός περιστατικού (μόνο τμήμα)' }] : []),
      ...(register.settings?.identity?.patientName ? [{ value: 'identity.patientName', label: en ? 'Name (department only)' : 'Όνομα (μόνο τμήμα)' }] : []),
      // A field the template gained can be filled only by who may change the register.
      ...register.fields.filter(field => field.type !== 'computed' && (!field.fromTemplate || access.canDefine)).map(field => ({ value: field.key, label: textOf(field, language) })),
    ]),
  ]
  const dateField = register.fields.find(field => field.key === register.settings?.entryDateField)
  // What the file does not bring: fields (or sheet rows) no column goes to.
  const missing = sheet ? register.sheet.rows.filter(row => !mapping.includes(`row.${row.key}`)) : register.fields.filter(field => field.type !== 'computed' && !field.fromTemplate && !mapping.includes(field.key))
  const hasDate = sheet ? mapping.includes('sheet.date') : mapping.includes(register.settings?.entryDateField)
  const valid = [Boolean(table.headers.length), hasDate || (!sheet && Boolean(fallbackDate)), true, Boolean(plan?.items.length)]
  const steps = en ? ['File', 'Columns', 'Values', 'Check and import'] : ['Αρχείο', 'Στήλες', 'Τιμές', 'Έλεγχος και εισαγωγή']

  async function pick(event) {
    const chosen = event.target.files?.[0]
    if (!chosen) return
    setReading(true)
    try {
      const rows = await readFile(chosen)
      const [headers = [], ...data] = rows
      // A line counts when it has a value outside the columns never imported (REPORTING::, related tables, AMKA):
      // FileMaker can join another table's names onto a sheet, a million lines that are nothing else.
      const kept = headers.map((header, column) => (IGNORED_COLUMN.test(String(header ?? '')) ? -1 : column)).filter(column => column >= 0)
      const clean = data.filter(row => row && kept.some(column => row[column] !== undefined && row[column] !== null && String(row[column]).trim() !== ''))
      setFile(chosen.name)
      setTable({ headers: headers.map(value => String(value ?? '').trim()), rows: clean })
      setMapping(suggestMapping(register, headers.map(value => String(value ?? '').trim())))
      setValueMap({})
      setStep(1)
    } catch (error) {
      console.error(error)
      notify(en ? 'The file could not be read. Use .xlsx or .csv with the column names in the first row.' : 'Το αρχείο δεν διαβάστηκε. Χρησιμοποιήστε .xlsx ή .csv με τα ονόματα των στηλών στην πρώτη γραμμή.', 'error')
    } finally { setReading(false); event.target.value = '' }
  }
  async function run() {
    if (!plan?.items.length) return
    setProgress({ done: 0, total: plan.items.length })
    try {
      let target = register
      // Options and fields the template gained since the register was made, and values FileMaker knew, join the register;
      // a gained field only when a column goes to it.
      const gained = register.fields.some(field => (field.fromTemplate && mapping.includes(field.key)) || (field.options || []).some(option => option.fromTemplate))
      if ((Object.keys(newOptions).length || gained) && access.canDefine) {
        const fields = register.fields.filter(field => !field.fromTemplate || mapping.includes(field.key)).map(({ fromTemplate: _gained, ...field }) => ({ ...field, options: [...(field.options || []).map(({ fromTemplate: _fromTemplate, ...option }) => option), ...Object.entries(newOptions[field.key] || {}).map(([label, value]) => ({ value, label, labelEn: label }))] }))
        target = await saveRegister(tenant?.id, { ...register, fields }, { actor: auditActorFromAuth({ profile, user }).name, action: 'updated', definitionChanged: true })
      }
      if (replaced.length) await deleteEntries(tenant?.id, target, replaced.map(entry => entry.id))
      const done = await saveEntries(tenant?.id, target, plan.items, { onProgress: (count, total) => setProgress({ done: count, total }) })
      notify(en ? `${done} entries imported.` : `Εισήχθησαν ${done} καταχωρίσεις.`, 'success')
      back()
    } catch (error) {
      console.error(error)
      notify(en ? 'The import stopped. What was written so far stays; run the check again before continuing.' : 'Η εισαγωγή σταμάτησε. Όσα γράφτηκαν μένουν· ξανακάντε τον έλεγχο πριν συνεχίσετε.', 'error')
      setProgress(null)
    }
  }

  const issueGroups = plan ? [...plan.issues.reduce((map, issue) => { const key = `${issue.field}|${issue.text.replace(/«[^»]*»/g, '«…»').replace(/^[\d.,]+ (στις|on) \S+/, 'N').replace(/^[^—]*— /, '')}`; const entry = map.get(key) || { field: issue.field, text: issue.text, rows: [] }; entry.rows.push(issue.row); map.set(key, entry); return map }, new Map()).values()] : []

  return <Page fill><EntityRecordShell className="register-record-shell workspace-fill" avatar={<Upload size={19} />} eyebrow={en ? register.nameEn : register.name} title={en ? 'Import from FileMaker' : 'Εισαγωγή από FileMaker'} subtitle={file || (en ? 'An .xlsx or .csv export, column names in the first row.' : 'Εξαγωγή .xlsx ή .csv, με τα ονόματα των στηλών στην πρώτη γραμμή.')} tabs={[]} activeTab="" onTabChange={() => {}} onBack={back}>
    <div className="register-form-page register-import">
      <StepList steps={steps} current={step} valid={valid} disabled={Boolean(progress)} onSelect={setStep} ariaLabel={en ? 'Steps' : 'Βήματα'} />
      <div className="lo-form-cards">
        {step === 0 && <FormCard wide title={en ? 'File' : 'Αρχείο'} icon={FileSpreadsheet} hint={en ? 'The file is read in your browser. AMKA columns are never imported.' : 'Το αρχείο διαβάζεται στον browser σας. Στήλες ΑΜΚΑ δεν εισάγονται ποτέ.'}>
          <label className="register-file-drop"><input type="file" accept=".xlsx,.csv,.txt" onChange={pick} disabled={reading} /><Upload size={22} /><strong>{reading ? (en ? 'Reading…' : 'Ανάγνωση…') : (en ? 'Choose the FileMaker export' : 'Επιλέξτε την εξαγωγή του FileMaker')}</strong><small>.xlsx · .csv</small></label>
        </FormCard>}
        {step === 1 && <FormCard wide title={en ? `Columns ${table.headers.length} · rows ${table.rows.length}` : `Στήλες ${table.headers.length} · γραμμές ${table.rows.length}`} hint={en ? 'Each column goes to a field of the register, or is left out.' : 'Κάθε στήλη πηγαίνει σε πεδίο του μητρώου ή μένει εκτός.'}>
          <table className="data-table register-mapping"><thead><tr><th>{en ? 'File column' : 'Στήλη αρχείου'}</th><th>{en ? 'Sample' : 'Δείγμα'}</th><th>{en ? 'Goes to' : 'Πηγαίνει σε'}</th></tr></thead><tbody>
            {table.headers.map((header, column) => {
              const amka = isAmka(header)
              const samples = [...new Set(table.rows.map(row => row[column]).filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '').slice(0, 30))].slice(0, 3)
              const personal = amka || mapping[column]?.startsWith('identity.')
              return <tr key={`${header}-${column}`}><td className="register-row-label">{header || '—'}</td><td className="register-samples">{personal ? <span className="register-privacy"><ShieldCheck size={13} />{amka ? (en ? 'AMKA: never imported' : 'ΑΜΚΑ: δεν εισάγεται') : (en ? 'personal data' : 'προσωπικά δεδομένα')}</span> : samples.map(cell => sampleText(cell, header, mapping[column], register, language)).join(' · ') || '—'}</td><td>{amka ? '—' : <SearchableSelect hideLabel label={header} value={mapping[column] || ''} options={targets} onChange={value => setMapping(current => current.map((item, index) => (index === column ? value || '' : item)))} placeholder={en ? 'Left out' : 'Εκτός'} {...selectText(en)} />}</td></tr>
            })}
          </tbody></table>
          {missing.length > 0 && <div className="register-import-missing"><strong>{en ? `Fields of the register not in the file (${missing.length})` : `Πεδία του μητρώου που δεν υπάρχουν στο αρχείο (${missing.length})`}</strong><span>{missing.map(item => textOf(item, language)).join(' · ')}</span><small>{en ? 'They stay empty. For the full history, export these fields from FileMaker too, or pick a column for them above.' : 'Μένουν κενά. Για πλήρες ιστορικό, εξάγετε και αυτά τα πεδία από το FileMaker ή επιλέξτε στήλη γι’ αυτά παραπάνω.'}</small></div>}
          {!sheet && <div className="register-import-options">
            <YesNoField label={en ? 'An empty yes/no cell means No' : 'Κενό σε ναι/όχι σημαίνει Όχι'} value={emptyIsNo} onChange={setEmptyIsNo} hint={en ? 'FileMaker checkboxes leave the cell empty when not ticked.' : 'Τα κουτάκια του FileMaker αφήνουν κενό όταν δεν είναι τσεκαρισμένα.'} />
            {register.undatedImport && <ManualDateField label={en ? `Recorded on, for patients without «${textOf(dateField, 'en')}»` : `Ημερομηνία καταγραφής, για όσους δεν έχουν «${textOf(dateField)}»`} value={fallbackDate} onChange={setFallbackDate} />}
            {!register.undatedImport && !mapping.includes(register.settings?.entryDateField) && <ManualDateField label={en ? `Date for every case (no «${textOf(dateField, 'en')}» column)` : `Ημερομηνία για όλα (λείπει η στήλη «${textOf(dateField)}»)`} value={fallbackDate} onChange={setFallbackDate} />}
          </div>}
          {existing.length > 0 && access.canDefine && <div className="register-import-options">
            <YesNoField label={en ? `Replace what is in the register (${existing.length})` : `Αντικατάσταση όσων υπάρχουν (${existing.length})`} value={replace} onChange={setReplace} hint={en ? 'The entries already in the register are deleted and the file takes their place. Closed periods stay.' : 'Οι καταχωρίσεις που υπάρχουν σβήνονται και τη θέση τους παίρνει το αρχείο. Οι κλεισμένες περίοδοι μένουν.'} />
          </div>}
          {!hasDate && sheet && <div className="governance-banner"><AlertTriangle size={16} /><span>{en ? 'Choose the date column.' : 'Επιλέξτε τη στήλη της ημερομηνίας.'}</span></div>}
        </FormCard>}
        {step === 2 && <>
          {!Object.keys(lists).length && <FormCard wide title={en ? 'Values' : 'Τιμές'}><div className="inline-empty">{en ? 'No list columns to match.' : 'Δεν υπάρχουν στήλες λίστας για αντιστοίχιση.'}</div></FormCard>}
          {Object.entries(lists).map(([key, list]) => <FormCard key={key} wide title={textOf(list.field, language)} hint={en ? 'Each value of the file goes to a value of the register.' : 'Κάθε τιμή του αρχείου πηγαίνει σε τιμή του μητρώου.'}>
            <table className="data-table register-mapping"><thead><tr><th>{en ? 'In the file' : 'Στο αρχείο'}</th><th className="register-num">{en ? 'Rows' : 'Γραμμές'}</th><th>{en ? 'Becomes' : 'Γίνεται'}</th></tr></thead><tbody>
              {list.values.map(item => <tr key={item.value}><td className="register-row-label">{item.value}</td><td className="register-num">{item.count}</td><td><SearchableSelect hideLabel label={item.value} value={chosenValues[key]?.[item.value] || ''} options={[...(list.field.options || []).map(option => ({ value: option.value, label: textOf(option, language) })), ...(key !== 'sheet.measure' && access.canDefine ? [{ value: NEW, label: en ? `New value «${item.value}»` : `Νέα τιμή «${item.value}»` }] : [])]} onChange={value => setValueMap(current => ({ ...current, [key]: { ...(current[key] || {}), [item.value]: value || '' } }))} placeholder={en ? 'Left empty' : 'Μένει κενό'} {...selectText(en)} /></td></tr>)}
            </tbody></table>
          </FormCard>)}
        </>}
        {step === 3 && plan && <>
          <div className="module-summary-strip register-import-summary">
            <MetricCard icon={FileSpreadsheet} value={plan.counts.rows} label={en ? 'Rows in the file' : 'Γραμμές αρχείου'} />
            <MetricCard icon={CheckCircle2} tone="active" value={plan.counts.ready} label={sheet ? (en ? 'Months to import' : 'Μήνες για εισαγωγή') : (en ? 'Cases to import' : 'Περιστατικά για εισαγωγή')} />
            <MetricCard icon={AlertTriangle} tone={plan.issues.length ? 'warning' : 'neutral'} value={plan.issues.length} label={en ? 'Values to check' : 'Τιμές προς έλεγχο'} />
          </div>
          <FormCard wide title={en ? 'What happens' : 'Τι θα γίνει'}>
            <ul className="register-import-skips">
              {replaced.length > 0 && <li><strong>{replaced.length}</strong> {en ? 'entries already in the register are deleted first' : 'καταχωρίσεις που υπάρχουν σβήνονται πρώτα'}</li>}
              {Object.entries(plan.skipped).filter(([, count]) => count).map(([reason, count]) => <li key={reason}><strong>{count}</strong> {skipText(reason, language)}</li>)}
              {Object.keys(newOptions).map(key => <li key={key}><strong>{Object.keys(newOptions[key]).length}</strong> {en ? `new values added to «${textOf(register.fields.find(field => field.key === key), 'en')}»` : `νέες τιμές προστίθενται στο «${textOf(register.fields.find(field => field.key === key))}»`}</li>)}
              {!Object.values(plan.skipped).some(Boolean) && !Object.keys(newOptions).length && !replaced.length && <li>{en ? 'Every row goes in.' : 'Όλες οι γραμμές περνούν.'}</li>}
            </ul>
          </FormCard>
          {issueGroups.length > 0 && <FormCard wide title={en ? 'Values to check' : 'Τιμές προς έλεγχο'} hint={en ? 'These values are left empty; the rest of the row goes in. Row numbers are those of the file.' : 'Αυτές οι τιμές μένουν κενές· η υπόλοιπη γραμμή περνά. Οι αριθμοί γραμμών είναι του αρχείου.'}>
            <table className="data-table register-mapping"><thead><tr><th>{en ? 'Field' : 'Πεδίο'}</th><th>{en ? 'What' : 'Τι'}</th><th className="register-num">{en ? 'Times' : 'Φορές'}</th><th>{en ? 'Rows' : 'Γραμμές'}</th></tr></thead><tbody>
              {issueGroups.map(group => <tr key={`${group.field}${group.text}`}><td>{group.field || '—'}</td><td>{group.text}</td><td className="register-num">{group.rows.length}</td><td className="register-samples">{group.rows.filter(Boolean).slice(0, 8).join(', ')}{group.rows.length > 8 ? '…' : ''}</td></tr>)}
            </tbody></table>
          </FormCard>}
        </>}
      </div>
      <div className="inline-edit-footer">
        {progress && <span className="register-form-errors">{en ? `Writing ${progress.done} / ${progress.total}…` : `Εγγραφή ${progress.done} / ${progress.total}…`}</span>}
        <Button variant="secondary" disabled={Boolean(progress)} onClick={step ? () => setStep(step - 1) : back}>{step ? (en ? 'Back' : 'Πίσω') : (en ? 'Cancel' : 'Ακύρωση')}</Button>
        {step > 0 && step < 3 && <Button disabled={!valid[step]} onClick={() => setStep(step + 1)}>{en ? 'Next' : 'Επόμενο'}</Button>}
        {step === 3 && <SaveButton loading={Boolean(progress)} disabled={!plan?.items.length || Boolean(progress)} onClick={run}>{en ? `Import ${plan?.items.length || 0}` : `Εισαγωγή ${plan?.items.length || 0}`}</SaveButton>}
      </div>
    </div>
  </EntityRecordShell></Page>
}

const skipText = (reason, language) => (language === 'en'
  ? { noDate: 'rows without the date they count on: left out', test: 'test rows (ΤΕΣΤ): left out', duplicate: 'already in the register or twice in the file (same case number and date): left out', summary: 'summary rows among the days: left out', existing: 'months already recorded: kept as they are', noMeasure: 'rows with an unknown shift: left out' }
  : { noDate: 'γραμμές χωρίς την ημερομηνία που μετρούν: μένουν εκτός', test: 'δοκιμαστικές γραμμές (ΤΕΣΤ): μένουν εκτός', duplicate: 'υπάρχουν ήδη ή δύο φορές στο αρχείο (ίδιος αριθμός και ημερομηνία): μένουν εκτός', summary: 'γραμμές συνόλων ανάμεσα στις ημέρες: μένουν εκτός', existing: 'μήνες που έχουν ήδη καταχωριστεί: μένουν ως έχουν', noMeasure: 'γραμμές με άγνωστη βάρδια: μένουν εκτός' })[reason] || reason

// A sample as the register will read it: Excel day numbers as dates.
function sampleText(cell, header, target, register, language) {
  const date = target === 'sheet.date' || register.fields.find(field => field.key === target)?.type === 'date' || /ημερομην|date/i.test(header)
  const day = date ? toIsoDate(cell) : null
  return day ? formatDay(day, language) : String(cell)
}
