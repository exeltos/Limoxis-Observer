import { BackButton } from '../../design-system/BackButton'
import { ManagementPage } from '../management/ManagementPage'

export function PlatformGlobalManagement({tx,onBack}){
  return <div className="platform-registry-shell">
    <div className="platform-registry-navigation"><BackButton onClick={onBack} label={tx('Dashboard','Dashboard')}/></div>
    <ManagementPage global/>
  </div>
}
