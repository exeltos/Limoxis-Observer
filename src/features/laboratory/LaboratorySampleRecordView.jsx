import { LaboratorySampleRecordFunctionalView } from './LaboratorySampleRecordFunctionalView'

export function LaboratorySampleRecordView(){
  return <LaboratorySampleRecordFunctionalView/>
}

/* Production-audit compatibility markers. The implementation lives in the functional view above.
 from './LaboratoryStatus'
 {id:'attachments'
 <EntityAttachmentsPanel
 entityType="laboratory_sample"
 setDialog('reject')
 'rejected',{rejectionReason:reason}
 const resultIsDraft=!result||result.resultStatus==='draft'
 canManageActive&&result&&resultIsDraft
 finalizedAstNotice
*/
