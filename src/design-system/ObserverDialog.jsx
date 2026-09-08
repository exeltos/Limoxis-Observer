import { X } from 'lucide-react'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { SaveButton } from './SaveButton'
import { useLanguage } from '../core/i18n/LanguageContext'

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
  return <div className={`modal-backdrop observer-dialog-backdrop observer-dialog-backdrop-${dialogPresentation}`} role="presentation" onMouseDown={e=>{if(dialogPresentation==='modal'&&e.target===e.currentTarget)onClose?.()}}>
    <section className={`entry-card observer-dialog observer-dialog-${dialogWidth} observer-dialog-presentation-${dialogPresentation} ${className}`.trim()} role="dialog" aria-modal={dialogPresentation==='modal'} aria-label={title}>
      <header>
        <div>
          {eyebrow&&<span className="eyebrow">{eyebrow}</span>}
          <h3>{title}</h3>
          {subtitle&&<p>{subtitle}</p>}
        </div>
        <IconButton label={en?'Close':'Κλείσιμο'} tone="neutral" className="entity-record-icon-button" onClick={onClose}><X size={17}/></IconButton>
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
