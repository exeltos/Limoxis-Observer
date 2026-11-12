import { DocumentsWorkspace } from './DocumentsWorkspace'
import { useLanguage } from '../core/i18n/LanguageContext'

export function EntityAttachmentsPanel({organizationId,entityType,entityRecordId,category='other',canManage}){
  const {language}=useLanguage()
  const categories=[
    ['generalDocument',language==='en'?'General document':'Γενικό έγγραφο'],
    ['medicalReport',language==='en'?'Medical report':'Ιατρική γνωμάτευση'],
    ['laboratoryDocument',language==='en'?'Laboratory document':'Εργαστηριακό έγγραφο'],
    ['correspondence',language==='en'?'Correspondence':'Αλληλογραφία'],
    ['photo',language==='en'?'Photo':'Φωτογραφία'],
    [category,language==='en'?'Other document':'Άλλο έγγραφο'],
  ].filter((row,index,all)=>all.findIndex(item=>item[0]===row[0])===index)

  return <DocumentsWorkspace
    title={language==='en'?'Documents':'Έγγραφα'}
    disabled={!canManage}
    organizationId={organizationId}
    entityType={entityType}
    entityId={entityRecordId}
    categories={categories}
  />
}
