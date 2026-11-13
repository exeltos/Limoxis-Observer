import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calculator, Check, Lock, Pencil, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { TimeField } from '../../design-system/TimeField'
import { MultiSelect } from '../../design-system/MultiSelect'
import { IconButton } from '../../design-system/IconButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { formatDay } from '../../core/i18n/formatDay'
import { auditActorFromAuth } from '../../core/audit/actor'
import { deleteEntry, loadEntry, loadRegister, saveEntry } from './registerService'
import { findApacheScore } from './registerScaleLookup'
import { ApacheCalculatorDialog } from './ApacheCalculatorDialog'
import { useRegisterAccess } from './registerAccess'
import { caseMarker, registerThemeKey, themeIcon } from './registerThemes'
import { computeValues, derivedHours, fieldVisible, formatValue, gestationText, hoursField, isRequired, parseGestation, textOf, validateEntry } from './registerEngine'
import './registers.css'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import type { ReactNode } from 'react'
import type { EntryValue, EntryValues, FieldOption, Register, RegisterEntry, RegisterField, RegisterSection } from './registerTypes'

// One case of a register (a neonate in the NICU): the identity the department
// keeps, then the register's fields section by section. Computed fields
// (length of stay, age) update as the dates are typed. A saved case opens
// read-only; «Edit» (in the card's ⋯) opens its fields.
export function RegisterEntryPage() {
  const { registerId, entryId } = useParams()
  const isNew = entryId === 'new'
  const navigate = useNavigate()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const { user, profile } = useAuth()
  const { tenant, isDemo } = useTenant()
  const access = useRegisterAccess()
  const [register, setRegister] = useState<Register | null>(null)
  const [entry, setEntry] = useState<RegisterEntry | null>(null)
  const [values, setValues] = useState<EntryValues>({})
  const [identity, setIdentity] = useState<{ caseNumber: string, patientName: string }>({ caseNumber: '', patientName: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const [editing, setEditing] = useState(false)
  const [apacheOpen, setApacheOpen] = useState(false)
  // The section the page is at (the side index follows the scrolling).
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const back = () => navigate(`/registers/${registerId}`, { replace: true })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const next = await loadRegister(tenant?.id, registerId)
        if (!active) return
        setRegister(next)
        if (next && !isNew) {
          const found = await loadEntry(tenant?.id, entryId as string, { withIdentity: access.canSeeIdentity(next), register: next })
          if (!active) return
          setEntry(found)
          setValues(found?.values || {})
          setIdentity(found?.identity || { caseNumber: '', patientName: '' })
        }
      } catch (error) { console.error(error) } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [tenant?.id, registerId, entryId, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

  const full = useMemo(() => (register ? computeValues(register.fields, values) : {}), [register, values])
  const entryDate = (register && full[register.settings?.entryDateField as string]) || entry?.entryDate || ''
  const check = useMemo(() => (register ? validateEntry(register.fields, values, language, entryDate) : { errors: {}, warnings: {}, valid: false }), [register, values, language, entryDate])
  // The index follows the scrolling: the section whose top is the last one above the fold.
  useEffect(() => {
    const box = pageRef.current
    if (!box) return undefined
    const onScroll = () => {
      const top = box.getBoundingClientRect().top + 90
      let current: string | null = null
      for (const item of box.querySelectorAll<HTMLElement>('[data-register-section]')) if (item.getBoundingClientRect().top <= top) current = item.dataset.registerSection ?? null
      setActiveSection(current)
    }
    onScroll()
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => box.removeEventListener('scroll', onScroll)
  }, [loading, register?.id, entry?.id, editing])
  if (loading) return <Page fill><TableSkeleton/></Page>
  if (!register || (!isNew && !entry) || !access.canSee(register)) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Case not found' : 'Το περιστατικό δεν βρέθηκε'}</strong></div></Page>

  const canEdit = access.canRecord(register) && !entry?.locked
  const editable = canEdit && (isNew || editing)
  const showIdentity = Boolean(register.settings?.identity) && access.canSeeIdentity(register)
  const set = (key: string, value: EntryValue) => setValues(current => ({ ...current, [key]: value }))
  const sections = register.settings?.sections?.length ? register.settings.sections : [{ key: '', label: en ? 'Details' : 'Στοιχεία' }]
  const fieldsOf = (section: RegisterSection) => register.fields.filter(field => (field.section || '') === section.key || (!sections.some(item => item.key === field.section) && section === sections[0]))

  const shownSections = sections.map(section => ({ section, fields: fieldsOf(section).filter(field => fieldVisible(field, full)) })).filter(item => item.fields.length)
  const isBlank = (value: unknown) => value == null || value === '' || (Array.isArray(value) && !value.length)
  // «Admission 5/8»: the fields filled of those that are typed (computed ones fill themselves); after a failed save, how many to correct.
  const sectionIndex = shownSections.map(({ section, fields }, position) => {
    const typed = fields.filter(field => field.type !== 'computed')
    const filled = typed.filter(field => !isBlank(full[field.key])).length
    return { id: section.key || 'main', no: position + 1, label: textOf(section, language), filled, total: typed.length, wrong: tried ? fields.filter(field => check.errors[field.key]).length : 0 }
  })
  const goToSection = (id: string) => { setActiveSection(id); document.getElementById(`register-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const theme = registerThemeKey(register)
  const ThemeIcon = themeIcon(theme)
  // The ICU keeps General and Cardiac surgery patients together: the choice is two cards at the top and colours the whole entry.
  const categoryField: RegisterField | null | undefined = theme === 'icu' ? register.fields.find(field => field.key === 'category' && field.type === 'choice') : null
  const marker = caseMarker(register, full, language)
  async function save() {
    setTried(true)
    // The first section with a field to correct opens.
    if (!check.valid) { const bad = shownSections.find(item => item.fields.some(field => check.errors[field.key])); if (bad) goToSection(bad.section.key || 'main') }
    if (!check.valid || saving || !editable) return
    setSaving(true)
    try {
      // Hours calculated from the times are saved with the entry (the field stays a plain number).
      const saved = { ...values, ...derivedHours(register!.fields, values) }
      await saveEntry(tenant?.id, register!, { ...(entry || {}), values: saved }, { identity: showIdentity ? identity : null, actorLabel: auditActorFromAuth({ profile, user }).name })
      notify(en ? 'Case saved.' : 'Το περιστατικό αποθηκεύτηκε.', 'success')
      if (isNew) back()
      else { setEntry(current => ({ ...current!, values: saved, identity: showIdentity ? identity : current!.identity })); setEditing(false); setTried(false) }
    } catch (error) {
      console.error(error)
      notify(en ? 'The case could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση του περιστατικού.', 'error')
    } finally { setSaving(false) }
  }
  async function remove() {
    const ok = await confirm({ title: en ? 'Delete case' : 'Διαγραφή περιστατικού', message: en ? 'The case and its values are deleted from the register and its indicators.' : 'Το περιστατικό και οι τιμές του διαγράφονται από το μητρώο και τους δείκτες του.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await deleteEntry(tenant?.id, register!, entry!.id); notify(en ? 'Case deleted.' : 'Το περιστατικό διαγράφηκε.', 'success'); back() } catch (error) { console.error(error); notify(en ? 'The case could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  // «From the patient's scales»: the APACHE II saved for this case number in the clinical scales; the score can still be typed.
  async function fillApache() {
    try {
      const found = isDemo || !String(identity.caseNumber ?? '').trim() ? null : await findApacheScore(tenant?.id, identity.caseNumber)
      if (found?.score != null) { set('apache_score', found.score); notify(en ? `APACHE II ${found.score} taken from the patient’s scales.` : `APACHE II ${found.score} από τις κλίμακες του ασθενή.`, 'success'); return }
      // Nothing saved (or no such patient): the registers are independent of the surveillance's patients, so offer to calculate it here.
      const calculate = await confirm({ title: en ? 'No APACHE II saved' : 'Δεν υπάρχει αποθηκευμένο APACHE II', message: en ? 'Do you want to calculate it now? The APACHE II calculator opens here and the result fills the score.' : 'Θέλετε να υπολογιστεί τώρα; Ανοίγει ο υπολογισμός APACHE II εδώ και το αποτέλεσμα γεμίζει το score.', confirmLabel: en ? 'Calculate' : 'Υπολογισμός' })
      if (calculate) setApacheOpen(true)
    } catch (error) { console.error(error); notify(en ? 'The patient’s scales could not be read.' : 'Δεν ήταν δυνατή η ανάγνωση των κλιμάκων του ασθενή.', 'error') }
  }
  const cancelEdit = () => { setValues(entry?.values || {}); setIdentity(entry?.identity || { caseNumber: '', patientName: '' }); setEditing(false); setTried(false) }
  const caseCode = entry ? String(entry.id).slice(-6).toUpperCase() : ''
  const title = isNew ? (en ? 'New case' : 'Νέο περιστατικό') : (showIdentity && identity.patientName) || `${en ? 'Case' : 'Περιστατικό'} ${caseCode}`
  const subtitle = [showIdentity && identity.caseNumber ? `${en ? 'Case no.' : 'Αρ. περιστατικού'} ${identity.caseNumber}` : '', !isNew && entryDate ? `${en ? 'admitted' : 'εισαγωγή'} ${formatDay(entryDate, language)}` : '', en ? register.departmentEn : register.department].filter(Boolean).join(' · ')
  const errorCount = Object.keys(check.errors).length
  return <Page fill><EntityRecordShell className="register-record-shell register-entry-shell workspace-fill" avatar={<ThemeIcon size={19} />} eyebrow={en ? register.nameEn : register.name} title={title} subtitle={subtitle} recordId={isNew ? undefined : entry!.id} tabs={[]} activeTab="" onTabChange={() => {}} onBack={back}
    headerActions={!isNew && canEdit && !editing && <><IconButton label={en ? 'Edit' : 'Επεξεργασία'} tone="edit" onClick={() => setEditing(true)}><Pencil size={16} /></IconButton><IconButton label={en ? 'Delete case' : 'Διαγραφή περιστατικού'} tone="danger" onClick={remove}><Trash2 size={16} /></IconButton></>}>
    <div className={`register-form-page register-entry-form${theme ? ` is-theme-${theme}` : ''}`} data-category={marker?.value || undefined}><div className="lo-form-cards register-entry-scroll" ref={pageRef}>
      {entry?.locked && <div className="governance-banner"><Lock size={16} /><span>{en ? 'This case belongs to a closed period and is read-only.' : 'Το περιστατικό ανήκει σε κλειστή περίοδο και δεν αλλάζει.'}</span></div>}
      <div className={`register-entry-layout${sectionIndex.length > 1 ? '' : ' has-no-rail'}`}>
        {sectionIndex.length > 1 && <nav className="register-entry-rail" aria-label={en ? 'Sections of the entry' : 'Ενότητες της καταχώρισης'}>
          <span className="register-entry-rail-title"><ThemeIcon size={16} aria-hidden="true" />{en ? 'Entry' : 'Καταχώριση'}</span>
          {sectionIndex.map(item => <button key={item.id} type="button" className={`${activeSection === item.id || (!activeSection && item.no === 1) ? 'is-active' : ''} ${item.wrong ? 'has-errors' : item.total && item.filled === item.total ? 'is-done' : ''}`.trim()} onClick={() => goToSection(item.id)}>
            <i>{item.wrong ? '!' : item.total && item.filled === item.total ? <Check size={13} aria-hidden="true" /> : item.no}</i>
            <span>{item.label}</span><small>{item.filled}/{item.total}</small>
          </button>)}
        </nav>}
        <div className="register-entry-main">
          {categoryField && <section className="register-entry-category" aria-label={textOf(categoryField, language)}>
            <span className="register-entry-category-label">{textOf(categoryField, language)}{categoryField.required ? ' *' : ''}</span>
            <div role="radiogroup" className="register-entry-category-cards">
              {categoryField.options!.map((option: FieldOption) => { const choice = caseMarker(register, { category: option.value }, language); const OptionIcon = choice?.Icon; return <button key={option.value} type="button" role="radio" aria-checked={full.category === option.value} disabled={!editable} className={`is-${option.value}${full.category === option.value ? ' is-selected' : ''}`} onClick={() => set('category', option.value)}>{OptionIcon && <OptionIcon size={20} aria-hidden="true" />}<span>{textOf(option, language)}</span></button> })}
            </div>
            {tried && check.errors.category && <span className="field-error">{check.errors.category}</span>}
          </section>}
          {register.settings?.identity && (showIdentity ? <section className="register-entry-identity">
            {(theme === 'icu' || theme === 'cathlab') && <svg className="register-entry-ecg" viewBox="0 0 240 40" aria-hidden="true" preserveAspectRatio="none"><polyline points="0,22 52,22 60,22 66,8 74,36 82,14 88,22 140,22 150,22 156,10 164,34 172,22 240,22" /></svg>}
            <header><span className="register-entry-badge">{theme ? <ThemeIcon size={20} aria-hidden="true" /> : <UserRound size={20} aria-hidden="true" />}</span><div><h3>{en ? 'Who' : 'Ταυτότητα'}</h3><small><Lock size={12} aria-hidden="true" />{en ? 'Seen only inside the department; never in indicators or exports.' : 'Τη βλέπει μόνο το τμήμα· δεν εμφανίζεται σε δείκτες ή εξαγωγές.'}</small></div></header>
            <div className="register-entry-identity-fields">
              {register.settings.identity.caseNumber && <Field label={en ? 'Case number' : 'Αριθμός περιστατικού'}><input value={identity.caseNumber} disabled={!editable} inputMode="numeric" onChange={event => setIdentity(current => ({ ...current, caseNumber: event.target.value }))} /></Field>}
              {register.settings.identity.patientName && <Field label={en ? 'Name' : 'Ονοματεπώνυμο'}><input value={identity.patientName} disabled={!editable} onChange={event => setIdentity(current => ({ ...current, patientName: event.target.value }))} /></Field>}
            </div>
          </section> : <div className="governance-banner"><Lock size={16} /><span>{en ? 'The case number and name are kept by the department and are not shown here.' : 'Ο αριθμός περιστατικού και το όνομα μένουν στο τμήμα και δεν εμφανίζονται εδώ.'}</span></div>)}
          {shownSections.map(({ section, fields }, position) => {
            const info = sectionIndex[position]
            return <section key={section.key || 'main'} id={`register-section-${info.id}`} data-register-section={info.id} className="register-entry-section">
              <header><span className="register-entry-badge">{info.no}</span><h3>{info.label}</h3>{info.wrong > 0 ? <small className="is-wrong">{en ? `to correct ${info.wrong}` : `προς διόρθωση ${info.wrong}`}</small> : <small>{info.filled}/{info.total}</small>}</header>
              <div className={`register-entry-grid${editable ? '' : ' is-readonly'}`}>{fields.filter(field => !(categoryField && field.key === 'category')).map(field => !editable ? <RegisterValue key={field.key} field={field} value={full[field.key]} language={language} entryValues={full} /> : <RegisterField key={field.key} cards={theme === 'cathlab'} field={field} value={full[field.key]} onChange={(value: EntryValue) => set(field.key, value)} entryValues={full} fields={register.fields} disabled={!editable} error={tried || values[field.key] !== undefined ? check.errors[field.key] : ''} warning={check.warnings[field.key]} required={isRequired(field, entryDate)} language={language} action={field.key === 'apache_score' ? <button type="button" className="register-field-action" onClick={fillApache}>{en ? 'From the patient’s scales' : 'Από τις κλίμακες του ασθενή'}</button> : null} />)}</div>
            </section>
          })}
        </div>
      </div>
    </div>{editable && <div className="inline-edit-footer">{tried && errorCount > 0 && <span className="register-form-errors">{en ? `${errorCount} field(s) need attention` : `${errorCount} πεδί${errorCount === 1 ? 'ο θέλει' : 'α θέλουν'} διόρθωση`}</span>}<Button variant="secondary" onClick={isNew ? back : cancelEdit}>{en ? 'Cancel' : 'Ακύρωση'}</Button><SaveButton loading={saving} disabled={saving} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></div>}</div>
  </EntityRecordShell>{apacheOpen && <ApacheCalculatorDialog age={full.age} onClose={() => setApacheOpen(false)} onUse={(score: number | null) => { set('apache_score', score); setApacheOpen(false); notify(en ? `APACHE II ${score} calculated.` : `APACHE II ${score} υπολογίστηκε.`, 'success') }} />}</Page>
}

// A field of a saved case, read-only: its label and value, compact.
interface RegisterValueProps { field: RegisterField, value: unknown, language: string, entryValues?: EntryValues | null }
function RegisterValue({ field, value, language, entryValues = null }: RegisterValueProps) {
  const empty = value == null || value === '' || (Array.isArray(value) && !value.length)
  return <div className="register-value"><span className="lo-field-label">{textOf(field, language)}</span><strong>{empty ? '—' : formatValue(field, value, language, entryValues)}</strong></div>
}

// Notes about the FileMaker import belong to the register's definition, not to the form.
const formHelp = (text: string | undefined) => (/filemaker|ίδιος κανόνας σε όλα τα μητρώα|the same rule in every register/i.test(text || '') ? '' : text)

const selectText = (en: boolean) => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

// One field of a register, drawn with the shared controls.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a field's value: text, number, yes/no or a list
type FieldValue = any
interface RegisterFieldProps { field: RegisterField, value: FieldValue, onChange: (value: EntryValue) => void, disabled?: boolean, error?: string, warning?: string, required?: boolean, language: string, cards?: boolean, action?: ReactNode, entryValues?: EntryValues | null, fields?: RegisterField[] }
export function RegisterField({ field, value, onChange, disabled, error, warning, required = field.required, language, cards = false, action = null, entryValues = null, fields = [] }: RegisterFieldProps) {
  const en = language === 'en'
  const label = `${textOf(field, language)}${required ? ' *' : ''}`
  const help = formHelp(en ? field.helpEn || field.help : field.help)
  const hint = warning || help || ''
  const unit = en ? field.unitEn || field.unit : field.unit
  const options: { value: string, label: string }[] = (field.options || []).map((option: FieldOption) => ({ value: option.value, label: textOf(option, language) }))
  if (field.type === 'computed') return <div className="field register-computed"><span className="lo-field-label">{textOf(field, language)}</span>{value == null ? <output className="is-pending">{en ? 'Calculated automatically' : 'Υπολογίζεται αυτόματα'}</output> : <output><Calculator size={14} />{formatValue(field, value, language, entryValues)}</output>}{help && <span className="field-hint">{help}</span>}</div>
  if (field.type === 'time') return <div className={`register-field ${error ? 'has-error' : ''}`}><TimeField label={label} value={value || ''} disabled={disabled} onChange={next => onChange(next)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'date') return <div className={`register-field ${error ? 'has-error' : ''}`}><ManualDateField label={label} value={value || ''} disabled={disabled} onChange={next => onChange(next)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'yesNo') return <div className={`register-field ${error ? 'has-error' : ''}`}><ChoiceField label={label} value={value === true ? 'yes' : value === false ? 'no' : ''} options={[{ value: 'no', label: en ? 'No' : 'Όχι' }, { value: 'yes', label: en ? 'Yes' : 'Ναι' }]} onChange={next => !disabled && onChange(next === 'yes')} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'choice' && options.length <= 3) return <div className={`register-field ${error ? 'has-error' : ''}`}><ChoiceField label={label} value={value || ''} options={options} onChange={next => !disabled && onChange(next)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'choice') return <div className={`register-field ${error ? 'has-error' : ''}`}><SearchableSelect label={label} value={value || ''} options={options} disabled={disabled} onChange={next => onChange(next || '')} placeholder={en ? 'Choose…' : 'Επιλογή…'} {...selectText(en)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'multiChoice') {
    const selected = Array.isArray(value) ? value : []
    if (cards) return <div className={`register-field register-field-wide register-procedure-field ${error ? 'has-error' : ''}`}><span className="lo-field-label">{label}</span><div className="register-procedure-cards" role="group" aria-label={textOf(field, language)}>{options.map(option => { const on = selected.includes(option.value); return <button key={option.value} type="button" aria-pressed={on} disabled={disabled} className={on ? 'is-selected' : ''} onClick={() => onChange(on ? selected.filter(item => item !== option.value) : [...selected, option.value])}><i aria-hidden="true">{on && <Check size={14} />}</i><span>{option.label}</span></button> })}</div>{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
    return <div className={`register-field register-field-double ${error ? 'has-error' : ''}`}><MultiSelect label={label} options={options} selected={selected} disabled={disabled} onChange={next => onChange(next)} placeholder={en ? 'Choose…' : 'Επιλογή…'} searchPlaceholder={en ? 'Search…' : 'Αναζήτηση…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} selectAllLabel={en ? 'All' : 'Όλα'} clearAllLabel={en ? 'None' : 'Κανένα'} countLabel={count => (en ? `${count} selected` : `${count} επιλεγμένα`)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  }
  if (field.type === 'gestation') return <GestationField label={label} value={value} onChange={onChange} disabled={disabled} error={error} hint={hint} />
  if (field.type === 'text') return <div className="register-field register-field-wide"><Field label={label} error={error} hint={hint}><textarea rows={2} value={value || ''} disabled={disabled} onChange={event => onChange(event.target.value)} /></Field></div>
  // Hours with both times typed are calculated: the field shows them and is not typed over.
  const rule = field.type === 'number' ? hoursField(fields, field.key) : null
  const calculated = Boolean(rule && entryValues?.[rule.fromTime] && entryValues?.[rule.toTime])
  return <div className={`register-field ${warning ? 'has-warning' : ''}`}><Field label={label} error={error} hint={calculated ? (en ? 'Calculated from the birth and admission times.' : 'Υπολογίζεται από τις ώρες γέννησης και εισαγωγής.') : hint}><span className="register-number"><input inputMode="decimal" value={value ?? ''} disabled={disabled || calculated} onChange={event => { const text = event.target.value.replace(',', '.'); onChange(text === '' ? '' : Number.isFinite(Number(text)) ? Number(text) : text) }} />{unit && <em>{unit}</em>}</span></Field>{action}</div>
}

// Weeks + days typed as «37+4», stored as days.
interface GestationFieldProps { label: string, value: unknown, onChange: (value: EntryValue) => void, disabled?: boolean, error?: string, hint?: string }
function GestationField({ label, value, onChange, disabled, error, hint }: GestationFieldProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [text, setText] = useState(() => gestationText(value))
  useEffect(() => setText(gestationText(value)), [value])
  const bad = text.trim() && parseGestation(text) == null
  return <div className="register-field"><Field label={label} error={error || (bad ? (en ? 'Write weeks+days, e.g. 37+4' : 'Γράψτε εβδομάδες+ημέρες, π.χ. 37+4') : '')} hint={hint}><span className="register-number"><input value={text} disabled={disabled} placeholder="37+4" onChange={event => setText(event.target.value)} onBlur={() => { const days = parseGestation(text); if (!text.trim()) onChange(''); else if (days != null) onChange(days) }} /><em>{en ? 'wk+d' : 'εβδ.+ημ.'}</em></span></Field></div>
}
