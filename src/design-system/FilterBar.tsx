import { ManualDateField } from './ManualDateField'
import { ActionButton } from './ActionButton'
import { Button } from './Button'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Filter, Search, X } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'

const POPOVER_GAP = 8
const VIEWPORT_MARGIN = 12

// end: optional content at the right of the row (e.g. a view switch).
// activeFilters: [{ key, label, onRemove }] — the filters in force, as removable chips under the search row.
// A filter in force, as a removable chip under the search row.
export interface ActiveFilter { key: string; label: ReactNode; onRemove: () => void }

interface FilterBarProps {
  query?: string
  onQueryChange?: (query: string) => void
  placeholder?: string
  // the fields of the filters window
  children?: ReactNode
  advanced?: ReactNode
  activeAdvancedCount?: number
  onClear?: () => void
  compact?: boolean
  end?: ReactNode
  activeFilters?: ActiveFilter[]
}

export function FilterBar({query='',onQueryChange,placeholder,children,advanced,activeAdvancedCount=0,onClear,compact=false,end=null,activeFilters=[]}: FilterBarProps){
  const {t}=useLanguage()
  const [open,setOpen]=useState(false)
  const [placement,setPlacement]=useState<{top:number,left:number,side:'above'|'below'}|null>(null)
  const triggerRef=useRef<HTMLButtonElement>(null)
  const popoverRef=useRef<HTMLDivElement>(null)

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
    const onPointerDown=(event: PointerEvent)=>{
      if(triggerRef.current?.contains(event.target as Node)||popoverRef.current?.contains(event.target as Node))return
      setOpen(false)
    }
    const onKeyDown=(event: KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)}
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
  const clearLabel=t('clearFilters')

  const popover=filterContent&&open&&createPortal(
    <div
      ref={popoverRef}
      className={`filter-popover ${placement?.side??'below'}`}
      style={placement?{top:placement.top,left:placement.left}:undefined}
      role="dialog"
      aria-label={t('filters')}
    >
      <div className="filter-popover-fields">{filterContent}</div>
      {/* The window closes with its own «OK» (not only by a click elsewhere on the screen); «Clear filters» sits right beside it while a filter is set. */}
      <div className="filter-popover-footer">
        {onClear&&activeAdvancedCount>0&&<ActionButton label={clearLabel} tone="neutral" className="filter-popover-clear" onClick={()=>{onClear();setOpen(false)}}><X size={14}/><span>{clearLabel}</span></ActionButton>}
        <Button className="filter-popover-done" onClick={()=>setOpen(false)}>{t('filtersDone')}</Button>
      </div>
    </div>,
    document.body
  )

  return <div className={`filter-system ${compact?'compact':''}`}>
    <div className="filter-primary-row">
      {onQueryChange&&<label className="filter-search"><Search size={16}/><input value={query} onChange={e=>onQueryChange(e.target.value)} placeholder={placeholder||`${t('search')}...`}/></label>}
      {filterContent&&<button ref={triggerRef} type="button" className={`filter-trigger ${open||activeAdvancedCount?'active':''}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Filter size={16}/><span>{t('filters')}</span>{activeAdvancedCount>0&&<b>{activeAdvancedCount}</b>}</button>}
      {activeFilters.length>0&&<div className="filter-active-row">{activeFilters.map(item=><button key={item.key} type="button" className="filter-active-chip" onClick={item.onRemove} aria-label={`${clearLabel}: ${item.label}`}>{item.label}<X size={12} aria-hidden="true"/></button>)}</div>}
      {showClear&&<ActionButton label={clearLabel} tone="neutral" className="filter-clear-button" onClick={onClear}><X size={14}/><span>{clearLabel}</span></ActionButton>}
      {end&&<div className="filter-end">{end}</div>}
    </div>
    {popover}
  </div>
}

interface FilterSelectProps { label?: ReactNode; value?: string; onChange: (value: string) => void; children?: ReactNode; className?: string }

export function FilterSelect({label,value,onChange,children,className=''}: FilterSelectProps){return <label className={`filter-field ${className}`.trim()}><span className="lo-field-label">{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select></label>}
export function FilterDate({label,value,onChange}: { label?: ReactNode; value?: string | null; onChange: (value: string) => void }){return <ManualDateField className="filter-field" label={label} value={value} onChange={onChange}/>}
