import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Baby, Calculator, Check, ClipboardList, Lock, Pencil, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { MultiSelect } from '../../design-system/MultiSelect'
import { IconButton } from '../../design-system/IconButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { formatDay } from '../../core/i18n/formatDay'
import { auditActorFromAuth } from '../../core/audit/actor'
import { deleteEntry, loadEntry, loadRegister, saveEntry } from './registerService'
import { useRegisterAccess } from './registerAccess'
import { computeValues, fieldVisible, formatValue, gestationText, isRequired, parseGestation, textOf, validateEntry } from './registerEngine'
import './registers.css'

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
  const { tenant } = useTenant()
  const access = useRegisterAccess()
  const [register, setRegister] = useState(null)
  const [entry, setEntry] = useState(null)
  const [values, setValues] = useState({})
  const [identity, setIdentity] = useState({ caseNumber: '', patientName: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const [editing, setEditing] = useState(false)
  // The section the page is at (the side index follows the scrolling).
  const [activeSection, setActiveSection] = useState(null)
  const pageRef = useRef(null)
  const back = () => navigate(`/registers/${registerId}`, { replace: true })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const next = await loadRegister(tenant?.id, registerId)
        if (!active) return
        setRegister(next)
        if (next && !isNew) {
          const found = await loadEntry(tenant?.id, entryId, { withIdentity: access.canSeeIdentity(next), register: next })
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
  const entryDate = (register && full[register.settings?.entryDateField]) || entry?.entryDate || ''
  const check = useMemo(() => (register ? validateEntry(register.fields, values, language, entryDate) : { errors: {}, warnings: {}, valid: false }), [register, values, language, entryDate])
  // The index follows the scrolling: the section whose top is the last one above the fold.
  useEffect(() => {
    const box = pageRef.current
    if (!box) return undefined
    const onScroll = () => {
      const top = box.getBoundingClientRect().top + 90
      let current = null
      for (const item of box.querySelectorAll('[data-register-section]')) if (item.getBoundingClientRect().top <= top) current = item.dataset.registerSection
      setActiveSection(current)
    }
    onScroll()
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => box.removeEventListener('scroll', onScroll)
  }, [loading, register?.id, entry?.id, editing])
  if (loading) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (!register || (!isNew && !entry) || !access.canSee(register)) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Case not found' : 'Το περιστατικό δεν βρέθηκε'}</strong></div></Page>

  const canEdit = access.canRecord(register) && !entry?.locked
  const editable = canEdit && (isNew || editing)
  const showIdentity = Boolean(register.settings?.identity) && access.canSeeIdentity(register)
  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const sections = register.settings?.sections?.length ? register.settings.sections : [{ key: '', label: en ? 'Details' : 'Στοιχεία' }]
  const fieldsOf = section => register.fields.filter(field => (field.section || '') === section.key || (!sections.some(item => item.key === field.section) && section === sections[0]))

  const shownSections = sections.map(section => ({ section, fields: fieldsOf(section).filter(field => fieldVisible(field, full)) })).filter(item => item.fields.length)
  const isBlank = value => value == null || value === '' || (Array.isArray(value) && !value.length)
  // «Admission 5/8»: the fields filled of those that are typed (computed ones fill themselves); after a failed save, how many to correct.
  const sectionIndex = shownSections.map(({ section, fields }, position) => {
    const typed = fields.filter(field => field.type !== 'computed')
    const filled = typed.filter(field => !isBlank(full[field.key])).length
    return { id: section.key || 'main', no: position + 1, label: textOf(section, language), filled, total: typed.length, wrong: tried ? fields.filter(field => check.errors[field.key]).length : 0 }
  })
  const goToSection = id => { setActiveSection(id); document.getElementById(`register-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const theme = register && (register.templateKey === 'nicu' || /ΜΕΝΝ|NICU/i.test(`${register.name} ${register.nameEn} ${register.department}`)) ? 'nicu' : ''
  async function save() {
    setTried(true)
    // The first section with a field to correct opens.
    if (!check.valid) { const bad = shownSections.find(item => item.fields.some(field => check.errors[field.key])); if (bad) goToSection(bad.section.key || 'main') }
    if (!check.valid || saving || !editable) return
    setSaving(true)
    try {
      await saveEntry(tenant?.id, register, { ...(entry || {}), values }, { identity: showIdentity ? identity : null, actorLabel: auditActorFromAuth({ profile, user }).name })
      notify(en ? 'Case saved.' : 'Το περιστατικό αποθηκεύτηκε.', 'success')
      if (isNew) back()
      else { setEntry(current => ({ ...current, values, identity: showIdentity ? identity : current.identity })); setEditing(false); setTried(false) }
    } catch (error) {
      console.error(error)
      notify(en ? 'The case could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση του περιστατικού.', 'error')
    } finally { setSaving(false) }
  }
  async function remove() {
    const ok = await confirm({ title: en ? 'Delete case' : 'Διαγραφή περιστατικού', message: en ? 'The case and its values are deleted from the register and its indicators.' : 'Το περιστατικό και οι τιμές του διαγράφονται από το μητρώο και τους δείκτες του.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })
    if (!ok) return
    try { await deleteEntry(tenant?.id, register, entry.id); notify(en ? 'Case deleted.' : 'Το περιστατικό διαγράφηκε.', 'success'); back() } catch (error) { console.error(error); notify(en ? 'The case could not be deleted.' : 'Δεν ήταν δυνατή η διαγραφή.', 'error') }
  }
  const cancelEdit = () => { setValues(entry?.values || {}); setIdentity(entry?.identity || { caseNumber: '', patientName: '' }); setEditing(false); setTried(false) }
  const caseCode = entry ? String(entry.id).slice(-6).toUpperCase() : ''
  const title = isNew ? (en ? 'New case' : 'Νέο περιστατικό') : (showIdentity && identity.patientName) || `${en ? 'Case' : 'Περιστατικό'} ${caseCode}`
  const subtitle = [showIdentity && identity.caseNumber ? `${en ? 'Case no.' : 'Αρ. περιστατικού'} ${identity.caseNumber}` : '', !isNew && entryDate ? `${en ? 'admitted' : 'εισαγωγή'} ${formatDay(entryDate, language)}` : '', en ? register.departmentEn : register.department].filter(Boolean).join(' · ')
  const errorCount = Object.keys(check.errors).length
  return <Page fill><EntityRecordShell className="register-record-shell register-entry-shell workspace-fill" avatar={theme === 'nicu' ? <Baby size={19} /> : <ClipboardList size={19} />} eyebrow={en ? register.nameEn : register.name} title={title} subtitle={subtitle} recordId={isNew ? undefined : entry.id} tabs={[]} activeTab="" onTabChange={() => {}} onBack={back}
    headerActions={!isNew && canEdit && !editing && <><IconButton label={en ? 'Edit' : 'Επεξεργασία'} tone="edit" onClick={() => setEditing(true)}><Pencil size={16} /></IconButton><IconButton label={en ? 'Delete case' : 'Διαγραφή περιστατικού'} tone="danger" onClick={remove}><Trash2 size={16} /></IconButton></>}>
    <div className={`register-form-page register-entry-form${theme ? ` is-theme-${theme}` : ''}`}><div className="lo-form-cards register-entry-scroll" ref={pageRef}>
      {entry?.locked && <div className="governance-banner"><Lock size={16} /><span>{en ? 'This case belongs to a closed period and is read-only.' : 'Το περιστατικό ανήκει σε κλειστή περίοδο και δεν αλλάζει.'}</span></div>}
      <div className="register-entry-layout">
        {sectionIndex.length > 1 && <nav className="register-entry-rail" aria-label={en ? 'Sections of the entry' : 'Ενότητες της καταχώρισης'}>
          <span className="register-entry-rail-title">{theme === 'nicu' ? <Baby size={16} aria-hidden="true" /> : <ClipboardList size={16} aria-hidden="true" />}{en ? 'Entry' : 'Καταχώριση'}</span>
          {sectionIndex.map(item => <button key={item.id} type="button" className={`${activeSection === item.id || (!activeSection && item.no === 1) ? 'is-active' : ''} ${item.wrong ? 'has-errors' : item.total && item.filled === item.total ? 'is-done' : ''}`.trim()} onClick={() => goToSection(item.id)}>
            <i>{item.wrong ? '!' : item.total && item.filled === item.total ? <Check size={13} aria-hidden="true" /> : item.no}</i>
            <span>{item.label}</span><small>{item.filled}/{item.total}</small>
          </button>)}
        </nav>}
        <div className="register-entry-main">
          {register.settings?.identity && (showIdentity ? <section className="register-entry-identity">
            <header><span className="register-entry-badge">{theme === 'nicu' ? <Baby size={20} aria-hidden="true" /> : <UserRound size={20} aria-hidden="true" />}</span><div><h3>{en ? 'Who' : 'Ταυτότητα'}</h3><small><Lock size={12} aria-hidden="true" />{en ? 'Seen only inside the department; never in indicators or exports.' : 'Τη βλέπει μόνο το τμήμα· δεν εμφανίζεται σε δείκτες ή εξαγωγές.'}</small></div></header>
            <div className="register-entry-identity-fields">
              {register.settings.identity.caseNumber && <Field label={en ? 'Case number' : 'Αριθμός περιστατικού'}><input value={identity.caseNumber} disabled={!editable} inputMode="numeric" onChange={event => setIdentity(current => ({ ...current, caseNumber: event.target.value }))} /></Field>}
              {register.settings.identity.patientName && <Field label={en ? 'Name' : 'Ονοματεπώνυμο'}><input value={identity.patientName} disabled={!editable} onChange={event => setIdentity(current => ({ ...current, patientName: event.target.value }))} /></Field>}
            </div>
          </section> : <div className="governance-banner"><Lock size={16} /><span>{en ? 'The case number and name are kept by the department and are not shown here.' : 'Ο αριθμός περιστατικού και το όνομα μένουν στο τμήμα και δεν εμφανίζονται εδώ.'}</span></div>)}
          {shownSections.map(({ section, fields }, position) => {
            const info = sectionIndex[position]
            return <section key={section.key || 'main'} id={`register-section-${info.id}`} data-register-section={info.id} className="register-entry-section">
              <header><span className="register-entry-badge">{info.no}</span><h3>{info.label}</h3>{info.wrong > 0 ? <small className="is-wrong">{en ? `to correct ${info.wrong}` : `προς διόρθωση ${info.wrong}`}</small> : <small>{info.filled}/{info.total}</small>}</header>
              <div className={`register-entry-grid${editable ? '' : ' is-readonly'}`}>{fields.map(field => !editable ? <RegisterValue key={field.key} field={field} value={full[field.key]} language={language} /> : <RegisterField key={field.key} field={field} value={full[field.key]} onChange={value => set(field.key, value)} disabled={!editable} error={tried || values[field.key] !== undefined ? check.errors[field.key] : ''} warning={check.warnings[field.key]} required={isRequired(field, entryDate)} language={language} />)}</div>
            </section>
          })}
        </div>
      </div>
    </div>{editable && <div className="inline-edit-footer">{tried && errorCount > 0 && <span className="register-form-errors">{en ? `${errorCount} field(s) need attention` : `${errorCount} πεδί${errorCount === 1 ? 'ο θέλει' : 'α θέλουν'} διόρθωση`}</span>}<Button variant="secondary" onClick={isNew ? back : cancelEdit}>{en ? 'Cancel' : 'Ακύρωση'}</Button><SaveButton loading={saving} disabled={saving} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton></div>}</div>
  </EntityRecordShell></Page>
}

// A field of a saved case, read-only: its label and value, compact.
function RegisterValue({ field, value, language }) {
  const empty = value == null || value === '' || (Array.isArray(value) && !value.length)
  return <div className="register-value"><span className="lo-field-label">{textOf(field, language)}</span><strong>{empty ? '—' : formatValue(field, value, language)}</strong></div>
}

// Notes about the FileMaker import belong to the register's definition, not to the form.
const formHelp = text => (/filemaker/i.test(text || '') ? '' : text)

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

// One field of a register, drawn with the shared controls.
export function RegisterField({ field, value, onChange, disabled, error, warning, required = field.required, language }) {
  const en = language === 'en'
  const label = `${textOf(field, language)}${required ? ' *' : ''}`
  const help = formHelp(en ? field.helpEn || field.help : field.help)
  const hint = warning || help || ''
  const unit = en ? field.unitEn || field.unit : field.unit
  const options = (field.options || []).map(option => ({ value: option.value, label: textOf(option, language) }))
  if (field.type === 'computed') return <div className="field register-computed"><span className="lo-field-label">{textOf(field, language)}</span>{value == null ? <output className="is-pending">{en ? 'Calculated automatically' : 'Υπολογίζεται αυτόματα'}</output> : <output><Calculator size={14} />{formatValue(field, value, language)}</output>}{help && <span className="field-hint">{help}</span>}</div>
  if (field.type === 'date') return <div className={`register-field ${error ? 'has-error' : ''}`}><ManualDateField label={label} value={value || ''} disabled={disabled} onChange={next => onChange(next)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'yesNo') return <div className={`register-field ${error ? 'has-error' : ''}`}><ChoiceField label={label} value={value === true ? 'yes' : value === false ? 'no' : ''} options={[{ value: 'no', label: en ? 'No' : 'Όχι' }, { value: 'yes', label: en ? 'Yes' : 'Ναι' }]} onChange={next => !disabled && onChange(next === 'yes')} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'choice' && options.length <= 3) return <div className={`register-field ${error ? 'has-error' : ''}`}><ChoiceField label={label} value={value || ''} options={options} onChange={next => !disabled && onChange(next)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'choice') return <div className={`register-field ${error ? 'has-error' : ''}`}><SearchableSelect label={label} value={value || ''} options={options} disabled={disabled} onChange={next => onChange(next || '')} placeholder={en ? 'Choose…' : 'Επιλογή…'} {...selectText(en)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'multiChoice') {
    const selected = Array.isArray(value) ? value : []
    return <div className={`register-field ${error ? 'has-error' : ''}`}><MultiSelect label={label} options={options} selected={selected} disabled={disabled} onChange={next => onChange(next)} placeholder={en ? 'Choose…' : 'Επιλογή…'} searchPlaceholder={en ? 'Search…' : 'Αναζήτηση…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} selectAllLabel={en ? 'All' : 'Όλα'} clearAllLabel={en ? 'None' : 'Κανένα'} countLabel={count => (en ? `${count} selected` : `${count} επιλεγμένα`)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  }
  if (field.type === 'gestation') return <GestationField label={label} value={value} onChange={onChange} disabled={disabled} error={error} hint={hint} />
  if (field.type === 'text') return <div className="register-field register-field-wide"><Field label={label} error={error} hint={hint}><textarea rows={2} value={value || ''} disabled={disabled} onChange={event => onChange(event.target.value)} /></Field></div>
  return <div className={`register-field ${warning ? 'has-warning' : ''}`}><Field label={label} error={error} hint={hint}><span className="register-number"><input inputMode="decimal" value={value ?? ''} disabled={disabled} onChange={event => { const text = event.target.value.replace(',', '.'); onChange(text === '' ? '' : Number.isFinite(Number(text)) ? Number(text) : text) }} />{unit && <em>{unit}</em>}</span></Field></div>
}

// Weeks + days typed as «37+4», stored as days.
function GestationField({ label, value, onChange, disabled, error, hint }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [text, setText] = useState(() => gestationText(value))
  useEffect(() => setText(gestationText(value)), [value])
  const bad = text.trim() && parseGestation(text) == null
  return <div className="register-field"><Field label={label} error={error || (bad ? (en ? 'Write weeks+days, e.g. 37+4' : 'Γράψτε εβδομάδες+ημέρες, π.χ. 37+4') : '')} hint={hint}><span className="register-number"><input value={text} disabled={disabled} placeholder="37+4" onChange={event => setText(event.target.value)} onBlur={() => { const days = parseGestation(text); if (!text.trim()) onChange(''); else if (days != null) onChange(days) }} /><em>{en ? 'wk+d' : 'εβδ.+ημ.'}</em></span></Field></div>
}
