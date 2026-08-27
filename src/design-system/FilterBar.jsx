import { ManualDateField } from './ManualDateField'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Filter, Search, X } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'

const POPOVER_GAP = 8
const VIEWPORT_MARGIN = 12

export function FilterBar({query='',onQueryChange,placeholder,children,advanced,activeAdvancedCount=0,onClear,compact=false}){
  const {t}=useLanguage()
  const [open,setOpen]=useState(false)
  const [placement,setPlacement]=useState(null)
  const triggerRef=useRef(null)
  const popoverRef=useRef(null)

  const positionPopover=()=>{
    const trigger=triggerRef.current
    const popover=popoverRef.current
    if(!trigger||!popover)return
    const rect=trigger.getBoundingClientRect()
    const pop=popover.getBoundingClientRect()
    const roomBelow=window.innerHeight-rect.bottom-VIEWPORT_MARGIN
    const roomAbove=rect.top-VIEWPORT_MARGIN
    const openAbove=roomBelow<pop.height+POPOVER_GAP&&roomAbove>roomBelow
    let top=openAbove?rect.top-pop.height-POPOVER_GAP:rect.bottom+POPOVER_GAP
    let left=rect.right-pop.width
    left=Math.max(VIEWPORT_MARGIN,Math.min(left,window.innerWidth-pop.width-VIEWPORT_MARGIN))
    top=Math.max(VIEWPORT_MARGIN,Math.min(top,window.innerHeight-pop.height-VIEWPORT_MARGIN))
    setPlacement({top,left,side:openAbove?'above':'below'})
  }

  useLayoutEffect(()=>{if(open)positionPopover()},[open,activeAdvancedCount])

  useEffect(()=>{
    if(!open)return undefined
    const onPointerDown=(event)=>{
      if(triggerRef.current?.contains(event.target)||popoverRef.current?.contains(event.target))return
      setOpen(false)
    }
    const onKeyDown=(event)=>{if(event.key==='Escape')setOpen(false)}
    const onViewportChange=()=>positionPopover()
    document.addEventListener('pointerdown',onPointerDown)
    document.addEventListener('keydown',onKeyDown)
    window.addEventListener('resize',onViewportChange)
    window.addEventListener('scroll',onViewportChange,true)
    return ()=>{
      document.removeEventListener('pointerdown',onPointerDown)
      document.removeEventListener('keydown',onKeyDown)
      window.removeEventListener('resize',onViewportChange)
      window.removeEventListener('scroll',onViewportChange,true)
    }
  },[open])

  const filterContent=(children||advanced)?<>{children}{advanced}</>:null
  const showClear=Boolean(onClear&&(query||activeAdvancedCount>0))

  const popover=filterContent&&open&&createPortal(
    <div
      ref={popoverRef}
      className={`filter-popover ${placement?.side??'below'}`}
      style={placement?{top:placement.top,left:placement.left}:undefined}
      role="dialog"
      aria-label={t('filters')}
    >
      <div className="filter-popover-fields">{filterContent}</div>
      {onClear&&activeAdvancedCount>0&&<div className="filter-popover-footer"><button type="button" className="filter-popover-clear" onClick={()=>{onClear();setOpen(false)}}><X size={14}/><span>{t('clearFilters')}</span></button></div>}
    </div>,
    document.body
  )

  return <div className={`filter-system ${compact?'compact':''}`}>
    <div className="filter-primary-row">
      {onQueryChange&&<label className="filter-search"><Search size={16}/><input value={query} onChange={e=>onQueryChange(e.target.value)} placeholder={placeholder||`${t('search')}...`}/></label>}
      {filterContent&&<button ref={triggerRef} type="button" className={`filter-trigger ${open||activeAdvancedCount?'active':''}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Filter size={16}/><span>{t('filters')}</span>{activeAdvancedCount>0&&<b>{activeAdvancedCount}</b>}</button>}
      {showClear&&<button type="button" className="filter-clear-button" onClick={onClear}><X size={14}/><span>{t('clearFilters')}</span></button>}
    </div>
    {popover}
  </div>
}

export function FilterSelect({label,value,onChange,children}){return <label className="filter-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select></label>}
export function FilterDate({label,value,onChange}){return <ManualDateField className="filter-field" label={label} value={value} onChange={onChange}/>}
