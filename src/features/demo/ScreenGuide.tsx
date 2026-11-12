import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpen, Check, GraduationCap, Lightbulb } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { helpManual } from '../../core/help/helpManual'
import { helpManualEn } from '../../core/help/helpManualEn'
import { helpExtras } from '../../core/help/helpExtras'
import { loadSeenScreenGuides, markScreenGuidesSeen } from './screenGuideService'
import './demoEvaluation.css'

export const ALL_SCREEN_GUIDES='*'

// The Help Center manual section of a path: exact, else the longest matching
// prefix; the dashboard ("/") only for "/" itself.
export function screenGuideKey(pathname){
  const path=String(pathname||'/')
  if(helpManual[path])return path
  return Object.keys(helpManual).filter(key=>key!=='/'&&(path===key||path.startsWith(`${key}/`))).sort((a,b)=>b.length-a.length)[0]||null
}

// The first time a user opens a screen of a Demo, the excerpt of the Help
// Center manual for that screen appears in front of it: what the screen is
// for, the steps to try, and a tip. Each guide is shown once per user; the
// Help Center can show them again.
export function ScreenGuide({enabled,userId,language,hold=false,onOpenHelp,resetToken=0}){
  const {pathname}=useLocation()
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [seen,setSeen]=useState(null)
  const [stopAll,setStopAll]=useState(false)
  const [closedKey,setClosedKey]=useState('')

  useEffect(()=>{let active=true
    setSeen(null)
    if(!enabled||!userId)return undefined
    loadSeenScreenGuides(userId).then(keys=>{if(active)setSeen(keys)}).catch(()=>{if(active)setSeen(new Set([ALL_SCREEN_GUIDES]))})
    return ()=>{active=false}
  },[enabled,userId,resetToken])

  const key=screenGuideKey(pathname)
  const manual=key?(en?helpManualEn:helpManual)[key]:null
  const extras=key?helpExtras[key]:null
  const total=Object.keys(helpManual).length
  const seenCount=useMemo(()=>seen?[...seen].filter(k=>k!==ALL_SCREEN_GUIDES).length:0,[seen])
  const show=Boolean(enabled&&!hold&&seen&&manual&&!seen.has(ALL_SCREEN_GUIDES)&&!seen.has(key)&&closedKey!==key)
  if(!show)return null

  async function close(openHelp=false){
    const keys=stopAll?[key,ALL_SCREEN_GUIDES]:[key]
    setClosedKey(key)
    setSeen(current=>new Set([...(current||[]),...keys]))
    setStopAll(false)
    try{await markScreenGuidesSeen(userId,keys)}catch{/* shown again next time */}
    if(openHelp)onOpenHelp?.()
  }

  const chapters=manual.chapters.slice(0,3)
  const tip=extras?.tip?.[en?'en':'el']
  return <ObserverDialog width="wide" className="screen-guide-dialog" eyebrow={tx(`Οδηγός οθόνης · ${seenCount+1} από ${total}`,`Screen guide · ${seenCount+1} of ${total}`)} title={manual.title} subtitle={manual.summary} onClose={()=>close(false)} footer={<div className="screen-guide-footer">
      <label className="screen-guide-stop"><input type="checkbox" checked={stopAll} onChange={e=>setStopAll(e.target.checked)}/><span>{tx('Να μην εμφανίζονται άλλοι οδηγοί','Do not show other guides')}</span></label>
      <Button variant="secondary" onClick={()=>close(true)}><BookOpen size={15}/>{tx('Όλο το κεφάλαιο στη Βοήθεια','Full chapter in Help')}</Button>
      <Button onClick={()=>close(false)}><Check size={15}/>{tx('Κατάλαβα, ξεκινάω','Got it, let me try')}</Button>
    </div>}>
    <div className="screen-guide">
      <div className="screen-guide-chapters">
        {chapters.map(([title,text])=><section key={title}><strong>{title}</strong><p>{text}</p></section>)}
      </div>
      <aside className="screen-guide-steps">
        <strong><GraduationCap size={16}/>{tx('Δοκιμάστε τώρα','Try it now')}</strong>
        <ol>{manual.steps.map(step=><li key={step}>{step}</li>)}</ol>
        {tip&&<p className="screen-guide-tip"><Lightbulb size={15}/>{tip}</p>}
      </aside>
    </div>
    <p className="screen-guide-note">{tx('Τα δεδομένα είναι συνθετικά: πειραματιστείτε ελεύθερα. Ο οδηγός βρίσκεται πάντα στο Κέντρο Βοήθειας (εικονίδιο βιβλίου, πάνω δεξιά).','The data is synthetic: experiment freely. The guide is always in the Help Center (book icon, top right).')}</p>
  </ObserverDialog>
}
