import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BriefcaseMedical, ChevronDown, Eye, Layers3, Medal, UsersRound, Wrench, type LucideIcon } from 'lucide-react'
import { sidebarLayout, type NavItem, type SidebarBlock } from './navigation'
import { preloadRoute } from './routePreload'
import { forgetRegistryViewStates } from '../core/navigation/useRegistryMemory'

// Record pages of the merged sections keep their old address (/patients/:id): the menu entry they belong to.
// The department registers, objectives and surveys open from «Indicators & objectives» for those who see it
// (the staff of a department have their own «/registers» entry; a role with an «/indicators» entry keeps it).
const MENU_ALIASES=[['/patients','/surveillance'],['/committees','/meetings'],['/regulations','/documents'],['/legislation','/documents'],['/registers','/quality/measures'],['/quality/objectives','/quality/measures'],['/quality/surveys','/quality/measures'],['/indicators','/quality/measures']]
const menuPathOf=(pathname: string)=>{const alias=MENU_ALIASES.find(([from])=>pathname===from||pathname.startsWith(`${from}/`));return alias?alias[1]:pathname}
const under=(path: string,to: string)=>to==='/'?path==='/':path===to||path.startsWith(`${to}/`)
// A page of «Indicators & objectives» is not also under «Quality Center» (/quality is its parent path); the department's calendar,
// suppliers and self-assessment are not also «My department».
const isUnder=(pathname: string,to: string)=>{const path=menuPathOf(pathname);if(to==='/quality'&&under(path,'/quality/measures'))return false;if(to==='/controls'&&under(path,'/controls/cultures'))return false;if(to==='/my-department'&&['/my-department/calendar','/my-department/meetings','/my-department/suppliers','/my-department/self-assessment'].some(child=>under(path,child)))return false;return under(pathname,to)||under(path,to)}

type T=(key: string)=>string
function NavEntry({item,t,nested:nestedEntry=false,onNavigate}: { item: NavItem, t: T, nested?: boolean, onNavigate?: () => void }){
  // An entry with a parent («Cultures» under «Controls») follows it on the same line as the others (owner, 8/11/2026).
  const nested=nestedEntry
  const Icon=item.icon
  const label=t(item.label||item.key)
  const {pathname}=useLocation()
  const here=isUnder(pathname,item.to)
  return <Link to={item.to} onClick={()=>{forgetRegistryViewStates();onNavigate?.()}} onPointerEnter={()=>void preloadRoute(item.to)} onFocus={()=>void preloadRoute(item.to)} title={label} aria-current={here?'page':undefined} className={`nav-item ${nested?'nested':''} ${here?'active':''}`}><Icon size={nested?16:18}/><span>{label}</span></Link>
}

// The folded rail (a 13" laptop, owner 8/11/2026): one icon per group, and only the open group's entries under it,
// so the rail fits without scrolling; a click on a group's icon opens it.
// Icons of their own, never one of an entry's, so a group never reads as a screen.
const GROUP_ICONS: Record<string, LucideIcon>={overview:Eye,clinical:BriefcaseMedical,operations:Wrench,quality:Medal,staff:UsersRound}

// A headed group of the sidebar: the heading folds and unfolds it. One group is open at a time,
// so the menu never grows long enough to scroll; the group of the open screen stays marked.
function NavGroup({block,t,open,onToggle,pathname}: { block: SidebarBlock, t: T, open: boolean, onToggle: (id: string) => void, pathname: string }){
  const active=block.items.some(item=>isUnder(pathname,item.to))
  const listId=`sidebar-group-${block.id}`
  const label=t(block.label||'')
  const GroupIcon=GROUP_ICONS[block.id||'']||Layers3
  // A group of one entry («Management») is not a menu to unfold: its heading opens the screen at once
  // (the folded rail still shows the entry's icon, as it does for every folded group).
  if(block.items.length===1){const item=block.items[0];return <div className={`sidebar-nav-section collapsed sidebar-nav-section-single ${active?'has-active':''}`.trim()}><Link to={item.to} id={`${listId}-heading`} className="nav-section-heading" title={label} aria-current={active?'page':undefined} onClick={()=>forgetRegistryViewStates()} onPointerEnter={()=>void preloadRoute(item.to)} onFocus={()=>void preloadRoute(item.to)}><span>{label}</span></Link><div id={listId} className="sidebar-nav-section-items">{block.items.map(entry=><NavEntry key={entry.to} item={entry} t={t}/>)}</div></div>}
  return <div className={`sidebar-nav-section ${open?'open':'collapsed'} ${active?'has-active':''}`.trim()} role="group" aria-labelledby={`${listId}-heading`}>
    <button type="button" id={`${listId}-heading`} className="nav-section-heading" aria-expanded={open} aria-controls={listId} title={label} onClick={()=>onToggle(block.id||'')}><GroupIcon className="nav-section-icon" size={18} aria-hidden="true"/><span>{label}</span><ChevronDown className="nav-group-chevron" size={13} aria-hidden="true"/></button>
    <div id={listId} className="sidebar-nav-section-items">{block.items.map(item=><NavEntry key={item.to} item={item} t={t}/>)}</div>
  </div>
}

// The hospital menu: headed groups for the roles that have them (see
// sidebarLayout in navigation.js), else the main list, «More» and the Management Center.
const MORE='__more'

export function SidebarNavigation({role,items,t,userKey}: { role: string | null | undefined, items: NavItem[], t: T, userKey?: string | null }){
  const {pathname}=useLocation()
  const layout=sidebarLayout(role,items)
  // One group is open at a time and it follows the open screen; the heading of the group the
  // open screen belongs to stays marked (dot, bold) even when another group is opened.
  // «More» is one of these groups too, so opening it folds «Staff» and the menu never scrolls.
  const activeBlock=layout.find(block=>(block.kind==='group'||block.kind==='more')&&block.items.some(item=>isUnder(pathname,item.to)))
  const activeGroup=activeBlock?(activeBlock.kind==='more'?MORE:activeBlock.id):null
  const [openGroup,setOpenGroup]=useState<string|null|undefined>(activeGroup)
  const [openFor,setOpenFor]=useState(`${userKey}|${activeGroup}`)
  if(openFor!==`${userKey}|${activeGroup}`){setOpenFor(`${userKey}|${activeGroup}`);setOpenGroup(activeGroup)}
  const toggleGroup=(id: string)=>setOpenGroup(current=>current===id?null:id)
  return layout.map((block,index)=>{
    if(block.kind==='group')return <NavGroup key={block.id} block={block} t={t} open={openGroup===block.id} onToggle={toggleGroup} pathname={pathname}/>
    // Plain entries after a headed group start under a divider, so they never read as part of the group.
    if(block.kind==='list')return [layout[index-1]?.kind==='group'&&<div key={`divider-${index}`} className="sidebar-nav-divider" aria-hidden="true"/>,...block.items.map(item=><NavEntry key={item.to} item={item} t={t} />)]
    if(block.kind==='management')return <div key="management" className="sidebar-nav-management">{block.items.map(item=><NavEntry key={item.to} item={item} t={t} />)}</div>
    const moreActive=block.items.some(item=>isUnder(pathname,item.to))
    const moreExpanded=openGroup===MORE
    const more=<div key="more" className={`sidebar-nav-group ${moreExpanded?'open':''}`}><button type="button" title={t('sidebarNav.more')} className={`nav-item nav-group-trigger ${moreActive?'active-group':''}`} onClick={()=>toggleGroup(MORE)} aria-expanded={moreExpanded}><Layers3 size={18}/><span>{t('sidebarNav.more')}</span><ChevronDown className="nav-group-chevron" size={14}/></button>{moreExpanded&&<div className="sidebar-nav-children">{block.items.map(item=><NavEntry key={item.to} item={item} t={t} nested/>)}</div>}</div>
    return layout[index-1]?.kind==='group'?[<div key={`divider-${index}`} className="sidebar-nav-divider" aria-hidden="true"/>,more]:more
  })
}
