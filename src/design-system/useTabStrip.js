import { useEffect,useRef } from 'react'

// A tab bar that is one sideways-scrolling line (tablets, phones): keeps the active tab in view and
// marks the edges that hide more tabs (tab-strip-more-start / tab-strip-more-end), which the stylesheet fades.
export function useTabStrip(activeKey){
  const ref=useRef(null)
  useEffect(()=>{
    const nav=ref.current
    if(!nav)return undefined
    const mark=()=>{const end=nav.scrollWidth-nav.clientWidth;nav.classList.toggle('tab-strip-more-start',end>1&&nav.scrollLeft>1);nav.classList.toggle('tab-strip-more-end',end>1&&nav.scrollLeft<end-1)}
    mark()
    nav.addEventListener('scroll',mark,{passive:true})
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(mark):null
    observer?.observe(nav)
    return()=>{nav.removeEventListener('scroll',mark);observer?.disconnect()}
  },[])
  useEffect(()=>{
    const nav=ref.current
    const tab=nav?.querySelector('[aria-selected="true"]')
    if(!tab||nav.scrollWidth<=nav.clientWidth)return
    const box=nav.getBoundingClientRect(),own=tab.getBoundingClientRect(),edge=28
    if(own.left<box.left+edge)nav.scrollLeft-=box.left+edge-own.left
    else if(own.right>box.right-edge)nav.scrollLeft+=own.right-box.right+edge
  },[activeKey])
  return ref
}
