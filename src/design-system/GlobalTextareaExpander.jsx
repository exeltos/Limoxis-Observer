import { useEffect, useRef, useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

function fieldLabel(textarea){
  const parent=textarea.closest('label')
  const label=parent?.querySelector(':scope > span')?.textContent?.trim()
  return label?.replace(/\s*\*\s*$/,'') || textarea.getAttribute('aria-label') || textarea.getAttribute('placeholder') || 'Μεγάλο πεδίο κειμένου'
}

export function GlobalTextareaExpander(){
  const [active,setActive]=useState(null)
  const [value,setValue]=useState('')
  const activeRef=useRef(null)

  useEffect(()=>{ activeRef.current=active },[active])

  useEffect(()=>{
    const listeners=new Map()
    const positionButton=(textarea,button)=>{
      const parent=textarea.parentElement
      if(!parent)return
      const parentRect=parent.getBoundingClientRect()
      const rect=textarea.getBoundingClientRect()
      button.style.top=`${Math.max(3,rect.top-parentRect.top+6)}px`
      button.style.right=`${Math.max(5,parentRect.right-rect.right+6)}px`
    }
    const enhance=(textarea)=>{
      if(!(textarea instanceof HTMLTextAreaElement)||textarea.dataset.limoxisExpandable==='true'||textarea.closest('.global-textarea-editor'))return
      const parent=textarea.parentElement
      if(!parent)return
      textarea.dataset.limoxisExpandable='true'
      parent.classList.add('has-textarea-expander')
      textarea.classList.add('limoxis-expandable-textarea')
      const button=document.createElement('button')
      button.type='button'
      button.className='textarea-expand-trigger'
      button.title='Μεγέθυνση πεδίου'
      button.setAttribute('aria-label',`Μεγέθυνση: ${fieldLabel(textarea)}`)
      button.innerHTML='<span aria-hidden="true">⛶</span>'
      const open=(event)=>{
        event.preventDefault();event.stopPropagation()
        setActive({textarea,label:fieldLabel(textarea),readOnly:textarea.readOnly||textarea.disabled})
        setValue(textarea.value||'')
      }
      button.addEventListener('click',open)
      parent.appendChild(button)
      positionButton(textarea,button)
      listeners.set(textarea,{button,open})
    }
    const scan=()=>document.querySelectorAll('textarea').forEach(enhance)
    scan()
    const observer=new MutationObserver(scan)
    observer.observe(document.body,{childList:true,subtree:true})
    const reposition=()=>listeners.forEach(({button},textarea)=>{ if(document.body.contains(textarea)&&document.body.contains(button))positionButton(textarea,button) })
    window.addEventListener('resize',reposition)
    return ()=>{
      observer.disconnect();window.removeEventListener('resize',reposition)
      listeners.forEach(({button,open},textarea)=>{button.removeEventListener('click',open);button.remove();textarea.removeAttribute('data-limoxis-expandable');textarea.classList.remove('limoxis-expandable-textarea');textarea.parentElement?.classList.remove('has-textarea-expander')})
    }
  },[])

  useEffect(()=>{
    if(!active)return
    const onKey=(e)=>{if(e.key==='Escape')setActive(null)}
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  },[active])

  function apply(){
    const textarea=activeRef.current?.textarea
    if(!textarea||activeRef.current?.readOnly){setActive(null);return}
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set
    if(setter)setter.call(textarea,value);else textarea.value=value
    textarea.dispatchEvent(new Event('input',{bubbles:true}))
    textarea.dispatchEvent(new Event('change',{bubbles:true}))
    setActive(null)
    requestAnimationFrame(()=>textarea.focus())
  }

  if(!active)return null
  return createPortal(<div className="global-textarea-editor-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setActive(null)}}>
    <section className="global-textarea-editor" role="dialog" aria-modal="true" aria-labelledby="global-textarea-title">
      <header><div><span>Επεξεργασία μεγάλου κειμένου</span><h2 id="global-textarea-title">{active.label}</h2></div><button type="button" className="global-textarea-editor-close" onClick={()=>setActive(null)} aria-label="Κλείσιμο"><X size={18}/></button></header>
      <div className="global-textarea-editor-body"><textarea autoFocus value={value} readOnly={active.readOnly} onChange={e=>setValue(e.target.value)} aria-label={active.label}/><div className="global-textarea-editor-hint"><Maximize2 size={14}/><span>{active.readOnly?'Προβολή μεγάλου κειμένου. Το πεδίο είναι μόνο για ανάγνωση.':'Γράψε ή επεξεργάσου άνετα το κείμενο. Η αλλαγή εφαρμόζεται στο αρχικό πεδίο όταν πατήσεις «Εφαρμογή».'}</span></div></div>
      <footer><Button variant="secondary" onClick={()=>setActive(null)}>{active.readOnly?'Κλείσιμο':'Ακύρωση'}</Button>{!active.readOnly&&<Button onClick={apply}>Εφαρμογή</Button>}</footer>
    </section>
  </div>,document.body)
}
