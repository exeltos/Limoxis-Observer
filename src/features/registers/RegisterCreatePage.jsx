import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CalendarRange, ClipboardList, LayoutTemplate } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { FormCard } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { QualityDepartmentField, departmentRef } from '../quality/QualityFields'
import { REGISTER_TEMPLATES, registerFromTemplate } from './registerTemplates'
import { saveRegister } from './registerService'
import { useRegisterAccess } from './registerAccess'
import { registerKindLabel } from './registerText'
import './registers.css'

// A new register: pick a template (NICU, Endoscopy, Ophthalmology, or empty),
// the department it belongs to and its name; the fields and indicators are
// then adjusted in its «Definition» tab.
export function RegisterCreatePage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { goBack } = useContextualNavigation('/registers')
  const { notify } = useFeedback()
  const { user, profile } = useAuth()
  const { tenant } = useTenant()
  const access = useRegisterAccess()
  const [templateKey, setTemplateKey] = useState('nicu')
  const [department, setDepartment] = useState({ departmentId: '', department: '', departmentEn: '' })
  const template = REGISTER_TEMPLATES.find(item => item.key === templateKey)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  if (!access.canDefine) return <Navigate to="/registers" replace />
  const shownName = name || (en ? template.nameEn : template.name)
  const valid = Boolean(department.departmentId && shownName.trim())
  async function save() {
    if (!valid || saving) return
    setSaving(true)
    try {
      const draft = registerFromTemplate(templateKey, department)
      const saved = await saveRegister(tenant?.id, { ...draft, name: name.trim() || draft.name, nameEn: name.trim() || draft.nameEn }, { actor: auditActorFromAuth({ profile, user }).name, action: 'created' })
      notify(en ? 'Register created.' : 'Το μητρώο δημιουργήθηκε.', 'success')
      navigate(`/registers/${saved.id}`, { replace: true, state: { registerTab: templateKey.startsWith('blank') ? 'definition' : 'entries' } })
    } catch (error) {
      console.error(error)
      notify(en ? 'The register could not be created.' : 'Δεν ήταν δυνατή η δημιουργία του μητρώου.', 'error')
    } finally { setSaving(false) }
  }
  return <Page fill><EntityRecordShell className="register-record-shell workspace-fill" avatar={<LayoutTemplate size={19} />} eyebrow={en ? 'Department registers' : 'Μητρώα τμημάτων'} title={en ? 'New register' : 'Νέο μητρώο'} subtitle={en ? 'Start from a template and adjust it to the department.' : 'Ξεκινήστε από πρότυπο και προσαρμόστε το στο τμήμα.'} tabs={[]} activeTab="" onTabChange={() => {}} onBack={goBack}>
    <div className="register-form-page register-create"><div className="lo-form-cards">
      <FormCard wide title={en ? 'Template' : 'Πρότυπο'} icon={LayoutTemplate} hint={en ? 'Every field, list and indicator can be changed afterwards.' : 'Κάθε πεδίο, λίστα και δείκτης αλλάζει και αργότερα.'}>
        <div className="register-templates" role="radiogroup" aria-label={en ? 'Template' : 'Πρότυπο'}>
          {REGISTER_TEMPLATES.map(item => <button key={item.key} type="button" role="radio" aria-checked={item.key === templateKey} className={item.key === templateKey ? 'active' : ''} onClick={() => setTemplateKey(item.key)}>
            <span className="register-template-kind">{item.kind === 'sheet' ? <CalendarRange size={15} /> : <ClipboardList size={15} />}{registerKindLabel(item.kind, language)}</span>
            <strong>{en ? item.nameEn : item.name}</strong>
            <small>{en ? item.descriptionEn : item.description}</small>
            <em>{item.kind === 'sheet' ? (en ? `${item.sheet.rows.length} rows · ${item.indicators.length} indicators` : `${item.sheet.rows.length} γραμμές · ${item.indicators.length} δείκτες`) : (en ? `${item.fields.length} fields · ${item.indicators.length} indicators` : `${item.fields.length} πεδία · ${item.indicators.length} δείκτες`)}</em>
          </button>)}
        </div>
      </FormCard>
      <FormCard wide title={en ? 'Register' : 'Μητρώο'} icon={ClipboardList}>
        <QualityDepartmentField required value={departmentRef(department)} onChange={setDepartment} />
        <Field label={`${en ? 'Name' : 'Όνομα'} *`}><input value={name} placeholder={en ? template.nameEn : template.name} onChange={event => setName(event.target.value)} /></Field>
      </FormCard>
    </div><div className="inline-edit-footer"><Button variant="secondary" onClick={goBack}>{en ? 'Cancel' : 'Ακύρωση'}</Button><SaveButton loading={saving} disabled={!valid || saving} onClick={save}>{en ? 'Create register' : 'Δημιουργία μητρώου'}</SaveButton></div></div>
  </EntityRecordShell></Page>
}
