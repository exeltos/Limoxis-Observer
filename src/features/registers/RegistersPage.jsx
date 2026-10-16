import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { RegistersPanel, useRegisterList } from './RegistersPanel'
import { useRegisterAccess } from './registerAccess'

// The department's registers (NICU neonates, monthly procedure sheets): what
// a department records, outside the Quality Center.
export function RegistersPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const list = useRegisterList()
  const access = useRegisterAccess()
  return <Page fill title={en ? 'Department registers' : 'Μητρώα τμήματος'} subtitle={en ? 'The cases and monthly sheets your department records, and the indicators computed from them.' : 'Τα περιστατικά και τα μηνιαία φύλλα που καταχωρεί το τμήμα σας και οι δείκτες που προκύπτουν από αυτά.'} actions={access.canDefine && <ActionButton tone="primary" label={en ? 'New register' : 'Νέο μητρώο'} onClick={() => navigate('/registers/new')}><Plus size={18} /><span>{en ? 'New register' : 'Νέο μητρώο'}</span></ActionButton>}>
    <section className="surface registry-workspace workspace-column workspace-fill registers-workspace"><RegistersPanel list={list} /></section>
  </Page>
}
