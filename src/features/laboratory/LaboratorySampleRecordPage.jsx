import { useTenant } from '../../core/tenant/TenantContext'
import { LaboratorySampleRecordPage as LaboratorySampleDemoRecordPage } from './LaboratorySampleDemoRecordPage'
import { LaboratorySampleCloudRecordPage } from './LaboratorySampleCloudRecordPage'

export function LaboratorySampleRecordPage(){
  const {isDemo}=useTenant()
  return isDemo?<LaboratorySampleDemoRecordPage/>:<LaboratorySampleCloudRecordPage/>
}
