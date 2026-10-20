import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Layers3 } from 'lucide-react'
import { sidebarLayout } from './navigation'
import { preloadRoute } from './routePreload'

const isUnder=(pathname,to)=>to==='/'?pathname==='/':pathname===to||pathname.startsWith(`${to}/`)

function NavEntry({item,t,nested=false,onNavigate}){
  const Icon=item.icon
  const label=t(item.label||item.key)
  return <NavLink to={item.to} end={item.to==='/'} onClick={onNavigate} onPointerEnter={()=>void preloadRoute(item.to)} onFocus={()=>void preloadRoute(item.to)} title={label} className={({isActive})=>`nav-item ${nested?'nested':''} ${isActive?'active':''}`}><Icon size={nested?16:18}/><span>{label}</span></NavLink>
}

// A headed group of the sidebar: the heading folds and unfolds it. One group is
// open at a time, so the menu never grows long enough to scroll.
function NavGroup({block,t,open,onToggle,pathname}){
  const active=block.items.some(item=>isUnder(pathname,item.to))
  const listId=`sidebar-group-${block.id}`
  const label=t(block.label)
  return <div className={`sidebar-nav-section ${open?'open':'collapsed'} ${active?'has-active':''}`.trim()} role="group" aria-labelledby={`${listId}-heading`}>
    <button type="button" id={`${listId}-heading`} className="nav-section-heading" aria-expanded={open} aria-controls={listId} title={label} onClick={()=>onToggle(block.id)}><span>{label}</span><ChevronDown className="nav-group-chevron" size={13} aria-hidden="true"/></button>
    <div id={listId} className="sidebar-nav-section-items">{block.items.map(item=><NavEntry key={item.to} item={item} t={t}/>)}</div>
  </div>
}

// The hospital menu: headed groups for the roles that have them (see
// sidebarLayout in navigation.js), else the main list, «More» and the Management Center.
export function SidebarNavigation({role,items,t,userKey}){
  const {pathname}=useLocation()
  const [moreOpen,setMoreOpen]=useState(false)
  const layout=sidebarLayout(role,items)
  // The open group follows the open screen; opening another closes it.
  const activeGroup=layout.find(block=>block.kind==='group'&&block.items.some(item=>isUnder(pathname,item.to)))?.id||null
  const [openGroup,setOpenGroup]=useState(activeGroup)
  const [openFor,setOpenFor]=useState(`${userKey}|${activeGroup}`)
  if(openFor!==`${userKey}|${activeGroup}`){setOpenFor(`${userKey}|${activeGroup}`);setOpenGroup(activeGroup)}
  const toggleGroup=id=>setOpenGroup(current=>current===id?null:id)
  const closeMore=()=>setMoreOpen(false)
  return layout.map(block=>{
    if(block.kind==='group')return <NavGroup key={block.id} block={block} t={t} open={openGroup===block.id} onToggle={toggleGroup} pathname={pathname}/>
    if(block.kind==='list')return block.items.map(item=><NavEntry key={item.to} item={item} t={t} onNavigate={closeMore}/>)
    if(block.kind==='management')return <div key="management" className="sidebar-nav-management">{block.items.map(item=><NavEntry key={item.to} item={item} t={t} onNavigate={closeMore}/>)}</div>
    const moreActive=block.items.some(item=>isUnder(pathname,item.to))
    const moreExpanded=moreOpen||moreActive
    return <div key="more" className={`sidebar-nav-group ${moreExpanded?'open':''}`}><button type="button" title={t('more')} className={`nav-item nav-group-trigger ${moreActive?'active-group':''}`} onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreExpanded}><Layers3 size={18}/><span>{t('more')}</span><ChevronDown className="nav-group-chevron" size={14}/></button>{moreExpanded&&<div className="sidebar-nav-children">{block.items.map(item=><NavEntry key={item.to} item={item} t={t} nested/>)}</div>}</div>
  })
}
