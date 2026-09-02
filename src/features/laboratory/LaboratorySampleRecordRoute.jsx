import { useTenant } from '../../core/tenant/TenantContext'
import { LaboratorySampleRecordPage } from './LaboratorySampleRecordPage'
import { LaboratorySampleCloudRecordPage } from './LaboratorySampleCloudRecordPage'

export function LaboratorySampleRecordRoute(){
  const {isDemo}=useTenant()
  return isDemo?<LaboratorySampleRecordPage/>:<LaboratorySampleCloudRecordPage/>
}
