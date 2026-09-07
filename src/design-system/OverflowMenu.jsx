import { useEffect,useRef,useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { IconButton } from './IconButton'
import { useLanguage } from '../core/i18n/LanguageContext'

export function OverflowMenu({items=[],label,className='',align='end',size='sm'}){
  const {language}=useLanguage();const en=language==='en'
  const [open,setOpen]=useState(false)
  const rootRef=useRef(null)
  const visibleItems=items.filter(item=>item&&item.hidden!==true)

  useEffect(()=>{
    if(!open)return
    function onPointer(event){if(!rootRef.current?.contains(event.target))setOpen(false)}
    function onKey(event){if(event.key==='Escape')setOpen(false)}
    document.addEventListener('mousedown',onPointer)
    document.addEventListener('keydown',onKey)
    return()=>{document.removeEventListener('mousedown',onPointer);document.removeEventListener('keydown',onKey)}
  },[open])

  if(!visibleItems.length)return null
  const resolvedLabel=label||(en?'More actions':'Περισσότερες ενέργειες')
  return <div ref={rootRef} className={`lo-overflow-menu lo-overflow-menu-${align} ${className}`.trim()}>
    <IconButton size={size} label={resolvedLabel} aria-haspopup="menu" aria-expanded={open} onClick={event=>{event.stopPropagation();setOpen(value=>!value)}}><MoreHorizontal size={18}/></IconButton>
    {open&&<div className="lo-overflow-popover" role="menu" aria-label={resolvedLabel} onClick={event=>event.stopPropagation()}>
      {visibleItems.map((item,index)=>{
        const Icon=item.icon
        return <div key={item.id||item.label||index} className={item.separatorBefore?'lo-overflow-separated':''}>
          <button type="button" role="menuitem" className={`lo-overflow-item ${item.tone==='danger'?'lo-overflow-item-danger':''}`.trim()} disabled={item.disabled} onClick={()=>{if(item.disabled)return;setOpen(false);item.onClick?.()}}>
            {Icon&&<Icon size={15}/>}<span>{item.label}</span>
          </button>
        </div>
      })}
    </div>}
  </div>
}
