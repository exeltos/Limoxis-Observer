import { useEffect,useLayoutEffect,useReducer,useRef,useState } from 'react'
import { ChevronDown,MoreHorizontal } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useTabStrip } from './useTabStrip'
import './CanonicalTabs.css'

// On a desktop the tabs stay on one line: the ones that do not fit go under «Περισσότερα ▾»
// at the end (it shows the active tab's name while that tab is among them). Tablets and
// phones keep the one sideways-scrolling line of useTabStrip.
const DESKTOP='(min-width:1101px)'
const GAP=2

// How many tabs fit, from the widths of the tabs measured while all of them were shown.
function useTabsThatFit(navRef,items,value,alwaysMore){
  const [visible,setVisible]=useState(null)
  const widths=useRef([])
  const signature=items.map(item=>`${item.value}:${item.label}:${item.count||0}`).join('|')
  const [tick,remeasure]=useReducer(x=>x+1,0)
  // New labels or counts: show every tab again to measure it.
  useLayoutEffect(()=>{widths.current=[];setVisible(null)},[signature])
  useEffect(()=>{
    const nav=navRef.current
    if(!nav||typeof ResizeObserver!=='function')return undefined
    const observer=new ResizeObserver(remeasure)
    observer.observe(nav)
    return()=>observer.disconnect()
  },[navRef])
  useLayoutEffect(()=>{
    const nav=navRef.current
    if(!nav)return
    const desktop=typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia(DESKTOP).matches
    if(!desktop){if(visible!==null)setVisible(null);return}
    nav.querySelectorAll('[data-tab-index]').forEach(tab=>{widths.current[Number(tab.dataset.tabIndex)]=tab.offsetWidth})
    if(widths.current.length<items.length||widths.current.some(width=>width==null))return
    const style=getComputedStyle(nav)
    const room=nav.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0)
    const more=nav.querySelector('.lo-tabs-more')?.offsetWidth||150
    const total=widths.current.reduce((sum,width)=>sum+width+GAP,0)+(alwaysMore?more:0)
    let next=null
    if(total>room){
      let used=more,count=0
      for(const width of widths.current){if(used+width+GAP>room)break;used+=width+GAP;count+=1}
      next=Math.max(1,count)
    }
    if(next!==visible)setVisible(next)
  },[navRef,items.length,visible,tick,value,signature,alwaysMore])
  return visible
}

function MoreTabs({items,value,onChange}){
  const {language}=useLanguage()
  const label=language==='en'?'More':'Περισσότερα'
  const [open,setOpen]=useState(false)
  const rootRef=useRef(null),triggerRef=useRef(null)
  useEffect(()=>{
    if(!open)return undefined
    rootRef.current?.querySelector('[role="menuitem"]')?.focus()
    const onPointer=event=>{if(!rootRef.current?.contains(event.target))setOpen(false)}
    document.addEventListener('mousedown',onPointer)
    return()=>document.removeEventListener('mousedown',onPointer)
  },[open])
  const active=items.find(item=>item.value===value)
  const onKey=event=>{
    const menu=[...(rootRef.current?.querySelectorAll('[role="menuitem"]')??[])]
    const index=menu.indexOf(document.activeElement)
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();menu[(index+(event.key==='ArrowDown'?1:-1)+menu.length)%menu.length]?.focus()}
    else if(event.key==='Escape'){event.preventDefault();setOpen(false);triggerRef.current?.focus()}
  }
  // The trigger names the active tab with its own count; otherwise it sums what the folded tabs hold.
  const count=active?active.count||0:items.reduce((sum,item)=>sum+(item.count>0?item.count:0),0)
  // Inside the tablist the trigger is itself a tab (selected while the open tab is folded in it).
  return <div ref={rootRef} className="lo-tabs-more" role="presentation" onKeyDown={onKey}>
    <button ref={triggerRef} type="button" role="tab" aria-selected={Boolean(active)} className={`lo-tabs-more-trigger${active?' active':''}`} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      {active?.icon?<active.icon aria-hidden="true"/>:<MoreHorizontal aria-hidden="true"/>}<span>{active?active.label:label}</span>{count>0&&<b className="canonical-tab-count">{count}</b>}<ChevronDown className="lo-tabs-more-chevron" aria-hidden="true"/>
    </button>
    {open&&<div className="lo-tabs-more-menu" role="menu" aria-label={label}>{items.map(item=>{const Icon=item.icon;return <button key={item.value} type="button" role="menuitem" tabIndex={-1} aria-current={item.value===value?'true':undefined} onClick={()=>{setOpen(false);onChange(item.value)}}>{Icon&&<Icon aria-hidden="true"/>}<span>{item.label}</span>{item.count>0&&<b className="canonical-tab-count">{item.count}</b>}</button>})}</div>}
  </div>
}

// item.count: an optional number that needs attention, shown next to the label.
// moreItems: tabs that always sit under «Περισσότερα» (seldom used ones).
export function CanonicalTabs({items,moreItems=[],value,onChange,ariaLabel,className=''}){
  const stripRef=useTabStrip(value)
  const visible=useTabsThatFit(stripRef,items,value,moreItems.length>0)
  const shown=visible==null?items:items.slice(0,visible)
  const folded=[...(visible==null?[]:items.slice(visible)),...moreItems]
  return <nav ref={stripRef} className={`canonical-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
    {shown.map((item,index)=>{const Icon=item.icon;return <button key={item.value} data-tab-index={index} type="button" role="tab" className={`canonical-tab ${value===item.value?'active':''}`} aria-selected={value===item.value} onClick={()=>onChange(item.value)}>{Icon&&<Icon aria-hidden="true"/>}<span>{item.label}</span>{item.count>0&&<b className="canonical-tab-count">{item.count}</b>}</button>})}
    {folded.length>0&&<MoreTabs items={folded} value={value} onChange={onChange}/>}
  </nav>
}
