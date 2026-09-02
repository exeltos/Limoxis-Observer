import { useTenant } from '../../core/tenant/TenantContext'
import { LaboratoryPage as LaboratoryDemoPage } from './LaboratoryDemoPage'
import { LaboratoryCloudPage } from './LaboratoryCloudPage'
import { LaboratoryStatus } from './LaboratoryStatus'

export function LaboratoryPage(){
  const {isDemo}=useTenant()
  return isDemo?<LaboratoryDemoPage/>:<LaboratoryCloudPage/>
}

export { LaboratoryStatus as Status }
