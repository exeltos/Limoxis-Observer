import { DocumentsWorkspace } from './DocumentsWorkspace'
import type { CategoryList } from './AttachmentField'
import { useLanguage } from '../core/i18n/LanguageContext'

interface EntityAttachmentsPanelProps {
  organizationId?: string | null
  entityType?: string | null
  entityRecordId?: string | null
  category?: string
  canManage?: boolean
}

export function EntityAttachmentsPanel({organizationId,entityType,entityRecordId,category='other',canManage}: EntityAttachmentsPanelProps){
  const {language}=useLanguage()
  const categories=([
    ['generalDocument',language==='en'?'General document':'Γενικό έγγραφο'],
    ['medicalReport',language==='en'?'Medical report':'Ιατρική γνωμάτευση'],
    ['laboratoryDocument',language==='en'?'Laboratory document':'Εργαστηριακό έγγραφο'],
    ['correspondence',language==='en'?'Correspondence':'Αλληλογραφία'],
    ['photo',language==='en'?'Photo':'Φωτογραφία'],
    [category,language==='en'?'Other document':'Άλλο έγγραφο'],
  ] as CategoryList).filter((row,index,all)=>all.findIndex(item=>item[0]===row[0])===index)

  return <DocumentsWorkspace
    title={language==='en'?'Documents':'Έγγραφα'}
    disabled={!canManage}
    organizationId={organizationId}
    entityType={entityType}
    entityId={entityRecordId}
    categories={categories}
  />
}
