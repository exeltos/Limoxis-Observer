import { useLocation } from 'react-router-dom'
import { ManagementPage } from '../management/ManagementPage'

// The platform's Central Management: the menu's sub-item (#management?group=…)
// picks the group of tabs shown.
export function PlatformGlobalManagement(){
  const location=useLocation()
  const group=new URLSearchParams(location.hash.split('?')[1]||'').get('group')
  return <ManagementPage global group={group}/>
}
