import { AttachmentField } from './AttachmentField'

export function EntityAttachmentsPanel({organizationId,entityType,entityRecordId,category='other',canManage}){
  const categories=[
    ['generalDocument','generalDocument'],
    ['medicalReport','medicalReport'],
    ['laboratoryDocument','laboratoryDocument'],
    ['correspondence','correspondence'],
    ['photo','photo'],
    [category,'other'],
  ].filter((row,index,all)=>all.findIndex(item=>item[0]===row[0])===index)

  return <section className="clinical-panel full-panel">
    <AttachmentField
      disabled={!canManage}
      organizationId={organizationId}
      entityType={entityType}
      entityId={entityRecordId}
      categories={categories}
    />
  </section>
}
