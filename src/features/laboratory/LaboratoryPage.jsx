import { useTenant } from '../../core/tenant/TenantContext'
import { LaboratoryPage as LaboratoryDemoPage, Status } from './LaboratoryDemoPage'
import { LaboratoryCloudPage } from './LaboratoryCloudPage'

export function LaboratoryPage(){
  const {isDemo}=useTenant()
  return isDemo?<LaboratoryDemoPage/>:<LaboratoryCloudPage/>
}

export { Status }
