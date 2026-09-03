import { lazy,Suspense } from 'react'
import { useTenant } from '../../core/tenant/TenantContext'
import { RouteLoading } from '../../design-system/RouteLoading'
import { ProductionSurveillancePage } from './ProductionSurveillancePage'

const DemoSurveillancePage=lazy(()=>import('./SurveillancePage').then(module=>({default:module.SurveillancePage})))

export function SurveillanceRoutePage(){
  const {isDemo}=useTenant()
  if(!isDemo)return <ProductionSurveillancePage/>
  return <Suspense fallback={<RouteLoading/>}><DemoSurveillancePage/></Suspense>
}
