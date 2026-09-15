import { AttachmentField } from './AttachmentField'
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

  return <section className="record-section attachment-documents-workspace">
    <div className="record-section-header">
      <div>
        <span className="eyebrow">LIMOXIS OBSERVER</span>
        <h3>{language==='en'?'Documents':'Έγγραφα'}</h3>
        <p>{language==='en'?'All files are kept in one place. Each attachment is classified by document type when it is added.':'Όλα τα αρχεία τηρούνται σε ένα σημείο. Κάθε επισύναψη χαρακτηρίζεται κατά την προσθήκη με τον τύπο του εγγράφου.'}</p>
      </div>
    </div>
    <AttachmentField
      disabled={!canManage}
      organizationId={organizationId}
      entityType={entityType}
      entityId={entityRecordId}
      categories={categories}
    />
  </section>
}
