import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react'
import { findTourTarget } from './demoTours'
import './demoEvaluation.css'

const PAD=6
const NOTE_WIDTH=330
const nextFrame=callback=>typeof requestAnimationFrame==='function'?requestAnimationFrame(callback):setTimeout(callback,100)
const cancelFrame=id=>typeof cancelAnimationFrame==='function'?cancelAnimationFrame(id):clearTimeout(id)

// Where the stop's element is now, a little larger; none while it is not on screen.
function rectOf(target,language){
  const element=findTourTarget(target,language)
  if(!element)return null
  const box=element.getBoundingClientRect()
  if(!box.width&&!box.height)return null
  return {top:box.top-PAD,left:box.left-PAD,width:box.width+PAD*2,height:box.height+PAD*2}
}

// A guided tour of the active scenario over the real screen (as in SurgiTrack):
// the element each note is about stands out, the rest dims, and the note sits
// next to it. The screen stays usable: a note waits for the evaluator to press
// what it points at (or "Next"), and an element not on screen yet (a dialog
// still closed) is waited for. `stops` are the stops of the steps not yet done,
// so the tour moves on by itself when a screen checks a step off.
export function DemoGuidedTour({scenario,stops,stepNumber,stepTotal,language,onClose,onFinish}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [index,setIndex]=useState(0)
  const [rect,setRect]=useState(null)
  const stop=stops[Math.min(index,stops.length-1)]
  const last=index>=stops.length-1
  const next=()=>last?onFinish():setIndex(value=>value+1)
  const nextRef=useRef(next);nextRef.current=next

  // Follow the element as the screen scrolls, opens a dialog or changes.
  useLayoutEffect(()=>{let frame=0
    const follow=()=>{const now=rectOf(stop?.target,language);setRect(prev=>prev&&now&&prev.top===now.top&&prev.left===now.left&&prev.width===now.width&&prev.height===now.height?prev:now);frame=nextFrame(follow)}
    follow();return ()=>cancelFrame(frame)},[stop,language])
  // Brought into view once, when the note moves to it.
  const found=rect!==null
  useEffect(()=>{if(found)findTourTarget(stop?.target,language)?.scrollIntoView?.({block:'nearest',behavior:'smooth'})},[stop,language,found])
  // Pressing what the note points at moves the tour on, once the screen has answered.
  useEffect(()=>{if(stop?.advance!=='click'||!stop.target)return undefined
    const onClick=event=>{const element=findTourTarget(stop.target,language);if(element&&event.target instanceof Node&&element.contains(event.target))setTimeout(()=>nextRef.current(),350)}
    document.addEventListener('click',onClick,true);return ()=>document.removeEventListener('click',onClick,true)},[stop,language])
  useEffect(()=>{const onKey=event=>{if(event.key==='Escape')onClose()};window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey)},[onClose])
  if(!stop)return null

  const viewport={width:window.innerWidth||1024,height:window.innerHeight||768}
  const width=Math.min(NOTE_WIDTH,viewport.width-24)
  // Below the element when there is room, else above it; else (a large element) bottom left.
  const below=rect&&rect.top+rect.height+200<viewport.height
  const above=rect&&rect.top>210
  const note=!rect?{top:viewport.height/2,left:(viewport.width-width)/2,transform:'translateY(-50%)'}
    :below||above?{top:below?rect.top+rect.height+10:rect.top-10,left:Math.min(Math.max(12,rect.left),viewport.width-width-12),transform:below?undefined:'translateY(-100%)'}
    :{top:viewport.height-16,left:16,transform:'translateY(-100%)'}
  const waiting=Boolean(stop.target)&&!rect
  return <div className="demo-tour" role="dialog" aria-modal="false" aria-labelledby="demo-tour-title">
    {rect?<div className="demo-tour-spot" style={{top:rect.top,left:rect.left,width:rect.width,height:rect.height}}/>:<div className="demo-tour-dim"/>}
    <div className="demo-tour-note" style={{...note,width}}>
      <div className="demo-tour-head">
        <small><Compass size={13} aria-hidden="true"/>{en?scenario.titleEn:scenario.titleEl}{stepTotal>0&&` · ${tx(`βήμα ${stepNumber}/${stepTotal}`,`step ${stepNumber}/${stepTotal}`)}`}</small>
        <button type="button" onClick={onClose} aria-label={tx('Τέλος ξενάγησης','End the tour')}><X size={15}/></button>
      </div>
      <strong id="demo-tour-title">{en?stop.titleEn:stop.titleEl}</strong>
      <p>{en?stop.textEn:stop.textEl}</p>
      {waiting&&<small className="demo-tour-wait">{tx('Συνεχίζει μόλις εμφανιστεί στην οθόνη.','It goes on as soon as it is on the screen.')}</small>}
      <div className="demo-tour-actions">
        <span className="demo-tour-count">{index+1}/{stops.length}</span>
        {index>0&&<button type="button" onClick={()=>setIndex(value=>value-1)}><ArrowLeft size={14}/>{tx('Πίσω','Back')}</button>}
        <button type="button" className="is-primary" onClick={next}>{last?tx('Τέλος','Done'):stop.advance==='click'?tx('Παράλειψη','Skip'):tx('Επόμενο','Next')}{!last&&<ArrowRight size={14}/>}</button>
      </div>
    </div>
  </div>
}
