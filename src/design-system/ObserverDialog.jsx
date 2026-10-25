import { useEffect,useRef } from 'react'
import { ArrowLeft,X } from 'lucide-react'
import { IconButton } from './IconButton'
import { SaveButton } from './SaveButton'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useOptionalFeedback } from '../core/feedback/FeedbackContext'

// Search and filter boxes inside a dialog are not data the user would lose.
const isSearchField=el=>el?.type==='search'||/search|αναζήτ/i.test(`${el?.className||''} ${el?.placeholder||''}`)

export function ObserverDialog({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width='standard',
  presentation='modal',
  // Forms whose content switches (existing/new, single/batch) do not shrink
  // back when the choice changes, so the window does not jump; they still open
  // at the height of their content, never at a fixed tall height.
  fixedHeight=false,
  className='',
}){
  const {language}=useLanguage();const en=language==='en'
  // Sizes: small / medium / large (= compact / standard / wide), or workspace.
  // A dialog is as tall as its content up to the screen; the header and the
  // footer with its buttons stay in view and only the body scrolls.
  const widthAliases={small:'compact',medium:'standard',large:'wide'}
  const allowedWidths=new Set(['compact','standard','wide','workspace'])
  const allowedPresentations=new Set(['modal','workspace'])
  const dialogWidth=allowedWidths.has(widthAliases[width]||width)?(widthAliases[width]||width):'standard'
  const sectionRef=useRef(null)
  useEffect(()=>{
    const node=sectionRef.current
    if(!fixedHeight||!node||typeof ResizeObserver==='undefined')return undefined
    let tallest=0
    const observer=new ResizeObserver(()=>{const height=Math.round(node.getBoundingClientRect().height);if(height>tallest){tallest=height;node.style.minHeight=`min(${height}px, var(--lo-dialog-max-height, 86vh))`}})
    observer.observe(node)
    return()=>observer.disconnect()
  },[fixedHeight])
  const dialogPresentation=allowedPresentations.has(presentation)?presentation:'modal'
  const workspace=dialogPresentation==='workspace'
  // Once the user has typed into the dialog, closing it with ×, Back or a click outside
  // asks before the changes are lost; leaving or reloading the page asks too.
  // Save buttons call onClose themselves and are not affected.
  const confirm=useOptionalFeedback()?.confirm
  const dirty=useRef(false)
  const markDirty=event=>{if(!isSearchField(event.target))dirty.current=true}
  useEffect(()=>{
    const warn=event=>{if(dirty.current){event.preventDefault();event.returnValue=''}}
    window.addEventListener('beforeunload',warn)
    return()=>window.removeEventListener('beforeunload',warn)
  },[])
  const requestClose=async()=>{
    if(dirty.current&&confirm&&!await confirm({title:en?'Discard changes?':'Απόρριψη αλλαγών;',message:en?'The changes you made in this window have not been saved.':'Οι αλλαγές που κάνατε σε αυτό το παράθυρο δεν έχουν αποθηκευτεί.',confirmLabel:en?'Discard':'Απόρριψη',danger:true}))return
    onClose?.()
  }
  // Escape closes the window like ×, with the same «discard changes?» question. A list or menu open inside
  // it closes first (they stop the key), and only the window that holds the focus answers.
  const closeOnEscape=event=>{
    if(event.key!=='Escape'||event.defaultPrevented)return
    event.preventDefault()
    event.stopPropagation()
    void requestClose()
  }
  // The window takes the focus when it opens (unless a field inside already has it), so Escape works at once.
  useEffect(()=>{
    const node=sectionRef.current
    if(node&&!node.contains(document.activeElement))node.focus({preventScroll:true})
  },[])
  return <div className={`modal-backdrop observer-dialog-backdrop observer-dialog-backdrop-${dialogPresentation}`} role="presentation" onMouseDown={e=>{if(!workspace&&e.target===e.currentTarget)requestClose()}}>
    <section ref={sectionRef} className={`entry-card observer-dialog observer-dialog-${dialogWidth} observer-dialog-presentation-${dialogPresentation} ${fixedHeight?'observer-dialog-fixed-height':''} ${className}`.trim()} role="dialog" aria-modal={!workspace} aria-label={title} tabIndex={-1} onKeyDown={closeOnEscape} onChangeCapture={markDirty} onInputCapture={markDirty}>
      <header>
        <div className={workspace?'observer-dialog-workspace-heading':''}>
          {workspace&&<IconButton label={en?'Back':'Πίσω'} tone="neutral" className="entity-record-icon-button" onClick={requestClose}><ArrowLeft size={19}/></IconButton>}
          <div>
            {eyebrow&&<span className="eyebrow">{eyebrow}</span>}
            <h3>{title}</h3>
            {subtitle&&<p>{subtitle}</p>}
          </div>
        </div>
        {!workspace&&<IconButton label={en?'Close':'Κλείσιμο'} tone="neutral" className="entity-record-icon-button" onClick={requestClose}><X size={17}/></IconButton>}
      </header>
      <div className="observer-dialog-body">{children}</div>
      {footer&&<footer>{footer}</footer>}
    </section>
  </div>
}

// A dialog closes one way: the header × (or Back in a workspace). The footer
// carries only what does something; `onCancel` / `showCancel` are accepted for
// older callers and render nothing.
export function DialogActions({onSave,saveLabel,disabled=false,children}){
  const {language}=useLanguage();const en=language==='en';const resolvedSaveLabel=saveLabel||(en?'Save':'Αποθήκευση')
  return <>
    {children}
    {onSave&&<SaveButton disabled={disabled} onClick={onSave}>{resolvedSaveLabel}</SaveButton>}
  </>
}
