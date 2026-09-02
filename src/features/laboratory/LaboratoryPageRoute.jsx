import { useTenant } from '../../core/tenant/TenantContext'
import { LaboratoryPage } from './LaboratoryPage'
import { LaboratoryCloudPage } from './LaboratoryCloudPage'

export function LaboratoryPageRoute(){
  const {isDemo}=useTenant()
  return isDemo?<LaboratoryPage/>:<LaboratoryCloudPage/>
}
