import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calculator, ClipboardList, Lock, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { FormCard, FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { IconButton } from '../../design-system/IconButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { deleteEntry, loadEntry, loadRegister, saveEntry } from './registerService'
import { useRegisterAccess } from './registerAccess'
import { computeValues, fieldVisible, formatValue, gestationText, parseGestation, textOf, validateEntry } from './registerEngine'
import './registers.css'

// One case of a register (a neonate in the NICU): the identity the department
// keeps, then the register's fields section by section. Computed fields
// (length of stay, age) update as the dates are typed.
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
  const check = useMemo(() => (register ? validateEntry(register.fields, values, language) : { errors: {}, warnings: {}, valid: false }), [register, values, language])
  if (loading) return <Page fill><div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div></Page>
  if (!register || (!isNew && !entry) || !access.canSee(register)) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Case not found' : 'Το περιστατικό δεν βρέθηκε'}</strong></div></Page>

  const canEdit = access.canRecord(register) && !entry?.locked
  const showIdentity = Boolean(register.settings?.identity) && access.canSeeIdentity(register)
  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const sections = register.settings?.sections?.length ? register.settings.sections : [{ key: '', label: en ? 'Details' : 'Στοιχεία' }]
  const fieldsOf = section => register.fields.filter(field => (field.section || '') === section.key || (!sections.some(item => item.key === field.section) && section === sections[0]))

  async function save() {
    setTried(true)
    if (!check.valid || saving || !canEdit) return
    setSaving(true)
    try {
      await saveEntry(tenant?.id, register, { ...(entry || {}), values }, { identity: showIdentity ? identity : null, actorLabel: auditActorFromAuth({ profile, user }).name })
      notify(en ? 'Case saved.' : 'Το περιστατικό αποθηκεύτηκε.', 'success')
      back()
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
  const title = isNew ? (en ? 'New case' : 'Νέο περιστατικό') : (showIdentity && identity.patientName) || (en ? 'Case' : 'Περιστατικό')
  const errorCount = Object.keys(check.errors).length
  return <Page fill><EntityRecordShell className="register-record-shell register-entry-shell workspace-fill" avatar={<ClipboardList size={19} />} eyebrow={en ? register.nameEn : register.name} title={title} subtitle={showIdentity && identity.caseNumber ? `${en ? 'Case no.' : 'Αρ. περιστατικού'} ${identity.caseNumber}` : (en ? register.departmentEn : register.department)} tabs={[]} activeTab="" onTabChange={() => {}} onBack={back}
    headerActions={!isNew && canEdit && <IconButton label={en ? 'Delete case' : 'Διαγραφή περιστατικού'} tone="danger" onClick={remove}><Trash2 size={16} /></IconButton>}>
    <div className="record-section register-entry-form"><div className="lo-form-cards">
      {entry?.locked && <div className="governance-banner"><Lock size={16} /><span>{en ? 'This case belongs to a closed period and is read-only.' : 'Το περιστατικό ανήκει σε κλειστή περίοδο και δεν αλλάζει.'}</span></div>}
      {register.settings?.identity && (showIdentity ? <FormCard title={en ? 'Who' : 'Ταυτότητα'} icon={UserRound} hint={en ? 'Seen only inside the department; never in indicators or exports.' : 'Τη βλέπει μόνο το τμήμα· δεν εμφανίζεται σε δείκτες ή εξαγωγές.'}>
        <FormGrid columns={2}>
          {register.settings.identity.caseNumber && <Field label={en ? 'Case number' : 'Αριθμός περιστατικού'}><input value={identity.caseNumber} disabled={!canEdit} inputMode="numeric" onChange={event => setIdentity(current => ({ ...current, caseNumber: event.target.value }))} /></Field>}
          {register.settings.identity.patientName && <Field label={en ? 'Name' : 'Ονοματεπώνυμο'}><input value={identity.patientName} disabled={!canEdit} onChange={event => setIdentity(current => ({ ...current, patientName: event.target.value }))} /></Field>}
        </FormGrid>
      </FormCard> : <div className="governance-banner"><Lock size={16} /><span>{en ? 'The case number and name are kept by the department and are not shown here.' : 'Ο αριθμός περιστατικού και το όνομα μένουν στο τμήμα και δεν εμφανίζονται εδώ.'}</span></div>)}
      {sections.map(section => {
        const fields = fieldsOf(section).filter(field => fieldVisible(field, full))
        if (!fields.length) return null
        return <FormCard key={section.key || 'main'} wide title={textOf(section, language)} icon={ClipboardList}>
          <div className="register-entry-grid">{fields.map(field => <RegisterField key={field.key} field={field} value={full[field.key]} onChange={value => set(field.key, value)} disabled={!canEdit} error={tried || values[field.key] !== undefined ? check.errors[field.key] : ''} warning={check.warnings[field.key]} language={language} />)}</div>
        </FormCard>
      })}
    </div><div className="inline-edit-footer">{tried && errorCount > 0 && <span className="register-form-errors">{en ? `${errorCount} field(s) need attention` : `${errorCount} πεδί${errorCount === 1 ? 'ο θέλει' : 'α θέλουν'} διόρθωση`}</span>}<Button variant="secondary" onClick={back}>{en ? 'Cancel' : 'Ακύρωση'}</Button>{canEdit && <SaveButton loading={saving} disabled={saving} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</SaveButton>}</div></div>
  </EntityRecordShell></Page>
}

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })

// One field of a register, drawn with the shared controls.
export function RegisterField({ field, value, onChange, disabled, error, warning, language }) {
  const en = language === 'en'
  const label = `${textOf(field, language)}${field.required ? ' *' : ''}`
  const help = en ? field.helpEn || field.help : field.help
  const hint = warning || help || ''
  const unit = en ? field.unitEn || field.unit : field.unit
  const options = (field.options || []).map(option => ({ value: option.value, label: textOf(option, language) }))
  if (field.type === 'computed') return <div className="field register-computed"><span className="lo-field-label">{textOf(field, language)}</span><output><Calculator size={14} />{value == null ? (en ? 'Not yet computed' : 'Δεν υπολογίζεται ακόμη') : formatValue(field, value, language)}</output>{help && <span className="field-hint">{help}</span>}</div>
  if (field.type === 'date') return <div className={`register-field ${error ? 'has-error' : ''}`}><ManualDateField label={label} value={value || ''} disabled={disabled} onChange={next => onChange(next)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'yesNo') return <div className={`register-field ${error ? 'has-error' : ''}`}><ChoiceField label={label} value={value === true ? 'yes' : value === false ? 'no' : ''} options={[{ value: 'no', label: en ? 'No' : 'Όχι' }, { value: 'yes', label: en ? 'Yes' : 'Ναι' }]} onChange={next => !disabled && onChange(next === 'yes')} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'choice' && options.length <= 3) return <div className={`register-field ${error ? 'has-error' : ''}`}><ChoiceField label={label} value={value || ''} options={options} onChange={next => !disabled && onChange(next)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'choice') return <div className={`register-field ${error ? 'has-error' : ''}`}><SearchableSelect label={label} value={value || ''} options={options} disabled={disabled} onChange={next => onChange(next || '')} placeholder={en ? 'Choose…' : 'Επιλογή…'} {...selectText(en)} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
  if (field.type === 'multiChoice') {
    const selected = Array.isArray(value) ? value : []
    return <div className={`register-field register-field-wide ${error ? 'has-error' : ''}`}><ChoiceChips label={label} options={options} selected={selected} onToggle={item => !disabled && onChange(selected.includes(item) ? selected.filter(other => other !== item) : [...selected, item])} />{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>
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
