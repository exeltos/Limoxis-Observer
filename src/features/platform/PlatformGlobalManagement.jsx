import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ManagementPage } from '../management/ManagementPage'

const GROUPS=['libraries','lira','sources']
// An old link without a group (#management, ?tab=…) opens the screen its tab belongs to.
const GROUP_OF_TAB={liraKnowledge:'lira',liraAi:'lira',references:'sources'}

// The platform's Central Management: the menu's sub-item (#management?group=…)
// picks the screen shown (Lists, LIRA & AI, or the external sources of «Legislation & sources»).
export function PlatformGlobalManagement(){
  const location=useLocation()
  const navigate=useNavigate()
  const asked=new URLSearchParams(location.hash.split('?')[1]||'').get('group')
  const known=GROUPS.includes(asked)
  const group=known?asked:null
  useEffect(()=>{if(!known)navigate({pathname:location.pathname,search:location.search,hash:`management?group=${GROUP_OF_TAB[new URLSearchParams(location.search).get('tab')]||'libraries'}`},{replace:true})},[known,location.pathname,location.search,navigate])
  return <ManagementPage global group={group}/>
}
