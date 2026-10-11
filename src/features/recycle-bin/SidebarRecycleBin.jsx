import { useEffect } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { setRecycleBinActor } from '../../core/recycleBin/recycleBinService'
import { useRecycleBin } from './useRecycleBin'
import { RecycleBinIcon } from './RecycleBinIcon'
import './recycleBin.css'

// The recycle bin sits at the bottom left of the menu, like a desktop bin: full when something was deleted.
export function SidebarRecycleBin({organizationId,role,actorName,label,onOpen}){
  const navigate=useNavigate(),location=useLocation()
  const {allowed,entries}=useRecycleBin(organizationId,role)
  useEffect(()=>{setRecycleBinActor({name:actorName})},[actorName])
  if(!allowed)return null
  const count=entries.length,active=location.pathname==='/recycle-bin'
  return <button type="button" className={`sidebar-bin${active?' active':''}`} aria-current={active?'page':undefined} aria-label={count?`${label} · ${count}`:label} title={label} onClick={()=>{onOpen?.();navigate('/recycle-bin')}}>
    <span className="sidebar-bin-icon"><RecycleBinIcon full={count>0}/>{count>0&&<em>{count}</em>}</span>
    <span>{label}</span>
  </button>
}
