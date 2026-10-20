import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Layers3 } from 'lucide-react'
import { sidebarLayout } from './navigation'
import { preloadRoute } from './routePreload'
import { forgetRegistryViewStates } from '../core/navigation/useRegistryMemory'

// Record pages of the merged sections keep their old address (/patients/:id): the menu entry they belong to.
const MENU_ALIASES=[['/patients','/surveillance'],['/committees','/meetings'],['/regulations','/documents'],['/legislation','/documents']]
const menuPathOf=pathname=>{const alias=MENU_ALIASES.find(([from])=>pathname===from||pathname.startsWith(`${from}/`));return alias?alias[1]:pathname}
const isUnder=(pathname,to)=>{const path=menuPathOf(pathname);return to==='/'?path==='/':path===to||path.startsWith(`${to}/`)}

function NavEntry({item,t,nested=false,onNavigate}){
  const Icon=item.icon
  const label=t(item.label||item.key)
  const {pathname}=useLocation()
  const here=isUnder(pathname,item.to)
  return <Link to={item.to} onClick={()=>{forgetRegistryViewStates();onNavigate?.()}} onPointerEnter={()=>void preloadRoute(item.to)} onFocus={()=>void preloadRoute(item.to)} title={label} aria-current={here?'page':undefined} className={`nav-item ${nested?'nested':''} ${here?'active':''}`}><Icon size={nested?16:18}/><span>{label}</span></Link>
}

// A headed group of the sidebar: the heading folds and unfolds it. One group is open at a time,
// so the menu never grows long enough to scroll; the group of the open screen stays marked.
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
  // One group is open at a time and it follows the open screen; the heading of the group the
  // open screen belongs to stays marked (dot, bold) even when another group is opened.
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
