import { useEffect,useRef } from 'react'
import { ArrowLeft,X } from 'lucide-react'
import { Button } from './Button'
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
  className='',
}){
  const {language}=useLanguage();const en=language==='en'
  const allowedWidths=new Set(['compact','standard','wide','workspace'])
  const allowedPresentations=new Set(['modal','workspace'])
  const dialogWidth=allowedWidths.has(width)?width:'standard'
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
  return <div className={`modal-backdrop observer-dialog-backdrop observer-dialog-backdrop-${dialogPresentation}`} role="presentation" onMouseDown={e=>{if(!workspace&&e.target===e.currentTarget)requestClose()}}>
    <section className={`entry-card observer-dialog observer-dialog-${dialogWidth} observer-dialog-presentation-${dialogPresentation} ${className}`.trim()} role="dialog" aria-modal={!workspace} aria-label={title} onChangeCapture={markDirty} onInputCapture={markDirty}>
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

export function DialogActions({onCancel,onSave,saveLabel,disabled=false,children,cancelLabel,showCancel=false}){
  const {language}=useLanguage();const en=language==='en';const resolvedSaveLabel=saveLabel||(en?'Save':'Αποθήκευση')
  return <>
    {children}
    {showCancel&&onCancel&&<Button variant="secondary" onClick={onCancel}>{cancelLabel||(en?'Cancel':'Ακύρωση')}</Button>}
    {onSave&&<SaveButton disabled={disabled} onClick={onSave}>{resolvedSaveLabel}</SaveButton>}
  </>
}
