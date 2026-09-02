import { useTenant } from '../../core/tenant/TenantContext'
import { IndicatorsPage as IndicatorsDemoPage } from './IndicatorsDemoPage'
import { IndicatorsCloudPage } from './IndicatorsCloudPage'

export function IndicatorsPage(){
  const {isDemo}=useTenant()
  return isDemo?<IndicatorsDemoPage/>:<IndicatorsCloudPage/>
}
