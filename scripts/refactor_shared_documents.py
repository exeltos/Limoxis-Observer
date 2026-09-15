from pathlib import Path

# One-time migration: both patient and employee records use the same documents workspace.
patient=Path('src/features/surveillance/PatientClinicalCanonicalPage.jsx')
s=patient.read_text()
s=s.replace("import { EntityAttachmentsPanel } from '../../design-system/EntityAttachmentsPanel'", "import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'")
old="""{activeTab==='documents'&&record&&(!isDemo&&record.recordId?<EntityAttachmentsPanel organizationId={tenant?.id} entityType=\"clinical_case\" entityRecordId={record.recordId} category=\"clinical_documentation\" canManage={has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)} t={t} notify={notify}/>:<div className=\"inline-empty\">{t('clinicalRecords.noAttachments')}</div>)}"""
new="""{activeTab==='documents'&&record&&(!isDemo&&record.recordId?<DocumentsWorkspace title={language==='en'?'Documents':'Έγγραφα'} subtitle={language==='en'?'All patient clinical documents are kept in one place.':'Όλα τα κλινικά έγγραφα του ασθενούς τηρούνται σε ένα σημείο.'} disabled={!has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)} organizationId={tenant?.id} entityType=\"clinical_case\" entityId={record.recordId}/>:<div className=\"inline-empty\">{t('clinicalRecords.noAttachments')}</div>)}"""
if old not in s: raise SystemExit('patient documents block not found')
s=s.replace(old,new)
patient.write_text(s)

employee=Path('src/features/employees/EmployeeRecordTabs.jsx')
s=employee.read_text()
s=s.replace("import { AttachmentField } from '../../design-system/AttachmentField'", "import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'")
old="""export function EmployeeCertificatesTab({employee,language,organizationId,canEdit=false}){
  return <section className=\"record-section employee-secondary-registry employee-documents-workspace\">
    <SectionTitle title={language==='en'?'Documents & certifications':'Έγγραφα & Πιστοποιήσεις'} subtitle={language==='en'?'All employee files are kept in one place. Each attachment is classified by document type when it is added.':'Όλα τα αρχεία του εργαζομένου τηρούνται σε ένα σημείο. Κάθε επισύναψη χαρακτηρίζεται κατά την προσθήκη με τον τύπο του εγγράφου.'}/>
    <AttachmentField disabled={!canEdit} value={[]} onChange={()=>{}} organizationId={organizationId} entityType=\"employee-certificate\" entityId={employee.dbId||employee.id}/>
  </section>
}"""
new="""export function EmployeeCertificatesTab({employee,language,organizationId,canEdit=false}){
  return <DocumentsWorkspace
    title={language==='en'?'Documents & certifications':'Έγγραφα & Πιστοποιήσεις'}
    subtitle={language==='en'?'All employee files are kept in one place. Each attachment is classified by document type when it is added.':'Όλα τα αρχεία του εργαζομένου τηρούνται σε ένα σημείο. Κάθε επισύναψη χαρακτηρίζεται κατά την προσθήκη με τον τύπο του εγγράφου.'}
    disabled={!canEdit}
    organizationId={organizationId}
    entityType=\"employee-certificate\"
    entityId={employee.dbId||employee.id}
  />
}"""
if old not in s: raise SystemExit('employee documents block not found')
s=s.replace(old,new)
employee.write_text(s)

css=Path('src/features/employees/employeeRecordTabsRefinements.css')
s=css.read_text()
s=s.replace('.employee-documents-workspace{display:grid;gap:14px}.employee-documents-workspace .attachment-field{margin-top:0}.employee-documents-workspace .attachment-heading{padding-top:2px}.employee-secondary-registry .record-section-header>div>p{max-width:760px}\n','')
s=s.replace(':not(.employee-documents-workspace)','')
css.write_text(s)
