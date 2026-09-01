import { TrainingPage } from './TrainingPage'
import { TrainingProductionPage } from './TrainingProductionPage'
import { useTenant } from '../../core/tenant/TenantContext'

export function TrainingPageRoute(){
  const {isDemo}=useTenant()
  return isDemo?<TrainingPage/>:<TrainingProductionPage/>
}
