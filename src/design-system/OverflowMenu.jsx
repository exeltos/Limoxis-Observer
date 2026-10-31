import { useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown,MoreHorizontal } from 'lucide-react'
import { IconButton } from './IconButton'
import { useLanguage } from '../core/i18n/LanguageContext'

// trigger: optional visible content (icon + text) instead of the "…" icon button;
// triggerTone 'primary' makes it the page's main action.
export function OverflowMenu({items=[],label,className='',align='end',size='sm',trigger=null,triggerTone='secondary',width=260}){
  const {language}=useLanguage();const en=language==='en'
  const [open,setOpen]=useState(false)
  const [position,setPosition]=useState(null)
  const rootRef=useRef(null)
  const triggerRef=useRef(null)
  const popoverRef=useRef(null)
  const visibleItems=items.filter(item=>item&&item.hidden!==true)
  const visibleCount=visibleItems.length

  const updatePosition=useCallback(()=>{
    const trigger=triggerRef.current
    if(!trigger)return
    const rect=trigger.getBoundingClientRect()
    const viewportWidth=window.innerWidth||document.documentElement.clientWidth
    const menuWidth=Math.min(width,Math.max(0,viewportWidth-16))
    const preferredLeft=align==='start'?rect.left:rect.right-menuWidth
    const left=Math.max(8,Math.min(preferredLeft,viewportWidth-menuWidth-8))
    // Opens upwards when it would run past the bottom of the screen (a trigger in a dialog's footer).
    const viewportHeight=window.innerHeight||document.documentElement.clientHeight
    const height=popoverRef.current?.offsetHeight||visibleCount*40+12
    const below=rect.bottom+6
    const top=below+height>viewportHeight-8&&rect.top-6-height>=8?rect.top-6-height:below
    setPosition(current=>current&&current.top===top&&current.left===left&&current.width===menuWidth?current:{top,left,width:menuWidth})
  },[align,width,visibleCount])

  useLayoutEffect(()=>{if(open)updatePosition()},[open,updatePosition])
  // Once drawn, its real height decides above or below.
  const drawn=Boolean(position)
  useLayoutEffect(()=>{if(open&&drawn)updatePosition()},[open,drawn,updatePosition])
  // The first item takes the focus when the menu opens, so the keyboard continues inside it.
  const positioned=Boolean(position)
  useEffect(()=>{if(open&&positioned)popoverRef.current?.querySelector('button:not([disabled])')?.focus()},[open,positioned])

  useEffect(()=>{
    if(!open)return
    function onPointer(event){
      if(rootRef.current?.contains(event.target)||popoverRef.current?.contains(event.target))return
      setOpen(false)
    }
    function onKey(event){
      if(event.key==='Escape'){setOpen(false);triggerRef.current?.querySelector('button')?.focus();return}
      // Arrow keys, Home and End move through the items (the menu sits at the end of the page, so Tab would not reach it).
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||!popoverRef.current)return
      const buttons=[...popoverRef.current.querySelectorAll('button:not([disabled])')]
      if(!buttons.length)return
      event.preventDefault()
      const at=buttons.indexOf(document.activeElement)
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(at+1)%buttons.length:(at<=0?buttons.length-1:at-1)
      buttons[next].focus()
    }
    function onViewport(){updatePosition()}
    document.addEventListener('mousedown',onPointer)
    document.addEventListener('keydown',onKey)
    window.addEventListener('resize',onViewport)
    window.addEventListener('scroll',onViewport,true)
    return()=>{
      document.removeEventListener('mousedown',onPointer)
      document.removeEventListener('keydown',onKey)
      window.removeEventListener('resize',onViewport)
      window.removeEventListener('scroll',onViewport,true)
    }
  },[open,updatePosition])

  if(!visibleItems.length)return null
  const resolvedLabel=label||(en?'More actions':'Περισσότερες ενέργειες')
  const popover=open&&position?<div ref={popoverRef} className="lo-overflow-popover lo-overflow-popover-portal" style={{position:'fixed',top:position.top,left:position.left,width:position.width,zIndex:2400}} role="menu" aria-label={resolvedLabel} onClick={event=>event.stopPropagation()}>
    {visibleItems.map((item,index)=>{
      const Icon=item.icon
      return <div key={item.id||item.label||index} className={item.separatorBefore&&index>0?'lo-overflow-separated':''}>
        <button type="button" role="menuitem" aria-current={item.current||undefined} className={`lo-overflow-item ${item.tone==='danger'?'lo-overflow-item-danger':''} ${item.current?'lo-overflow-item-current':''}`.trim()} disabled={item.disabled} onClick={()=>{if(item.disabled)return;setOpen(false);item.onClick?.()}}>
          {Icon&&<Icon size={15}/>}<span>{item.label}{item.description&&<small>{item.description}</small>}</span>
        </button>
      </div>
    })}
  </div>:null

  return <div ref={rootRef} className={`lo-overflow-menu lo-overflow-menu-${align} ${className}`.trim()}>
    <span ref={triggerRef} className="lo-overflow-trigger-wrap">{trigger?<button type="button" className={`button button-${triggerTone==="primary"?"primary":"secondary"} lo-overflow-text-trigger`} aria-label={resolvedLabel} aria-haspopup="menu" aria-expanded={open} onClick={event=>{event.stopPropagation();setOpen(value=>!value)}}>{trigger}<ChevronDown size={14} aria-hidden="true"/></button>:<IconButton size={size} label={resolvedLabel} aria-haspopup="menu" aria-expanded={open} onClick={event=>{event.stopPropagation();setOpen(value=>!value)}}><MoreHorizontal size={18}/></IconButton>}</span>
    {popover&&createPortal(popover,document.body)}
  </div>
}
