import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { IconButton } from './IconButton'
import { useLanguage } from '../core/i18n/LanguageContext'

export function OverflowMenu({items=[],label,className='',align='end',size='sm'}){
  const {language}=useLanguage();const en=language==='en'
  const [open,setOpen]=useState(false)
  const [position,setPosition]=useState(null)
  const rootRef=useRef(null)
  const triggerRef=useRef(null)
  const popoverRef=useRef(null)
  const visibleItems=items.filter(item=>item&&item.hidden!==true)

  function updatePosition(){
    const trigger=triggerRef.current
    if(!trigger)return
    const rect=trigger.getBoundingClientRect()
    const estimatedWidth=220
    const left=align==='start'?rect.left:Math.max(8,rect.right-estimatedWidth)
    setPosition({top:rect.bottom+6,left})
  }

  useLayoutEffect(()=>{if(open)updatePosition()},[open,align])

  useEffect(()=>{
    if(!open)return
    function onPointer(event){
      if(rootRef.current?.contains(event.target)||popoverRef.current?.contains(event.target))return
      setOpen(false)
    }
    function onKey(event){if(event.key==='Escape')setOpen(false)}
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
  },[open,align])

  if(!visibleItems.length)return null
  const resolvedLabel=label||(en?'More actions':'Περισσότερες ενέργειες')
  const popover=open&&position?<div ref={popoverRef} className="lo-overflow-popover lo-overflow-popover-portal" style={{top:position.top,left:position.left}} role="menu" aria-label={resolvedLabel} onClick={event=>event.stopPropagation()}>
    {visibleItems.map((item,index)=>{
      const Icon=item.icon
      return <div key={item.id||item.label||index} className={item.separatorBefore?'lo-overflow-separated':''}>
        <button type="button" role="menuitem" className={`lo-overflow-item ${item.tone==='danger'?'lo-overflow-item-danger':''}`.trim()} disabled={item.disabled} onClick={()=>{if(item.disabled)return;setOpen(false);item.onClick?.()}}>
          {Icon&&<Icon size={15}/>}<span>{item.label}</span>
        </button>
      </div>
    })}
  </div>:null

  return <div ref={rootRef} className={`lo-overflow-menu lo-overflow-menu-${align} ${className}`.trim()}>
    <span ref={triggerRef} className="lo-overflow-trigger-wrap"><IconButton size={size} label={resolvedLabel} aria-haspopup="menu" aria-expanded={open} onClick={event=>{event.stopPropagation();setOpen(value=>!value)}}><MoreHorizontal size={18}/></IconButton></span>
    {popover&&createPortal(popover,document.body)}
  </div>
}
