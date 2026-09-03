import { X } from 'lucide-react'
import { Button } from './Button'
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
  className='',
}){
  const {language}=useLanguage();const en=language==='en'
  const allowedWidths=new Set(['compact','standard','wide','workspace'])
  const dialogWidth=allowedWidths.has(width)?width:'standard'
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
    <section className={`entry-card observer-dialog observer-dialog-${dialogWidth} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
      <header>
        <div>
          {eyebrow&&<span className="eyebrow">{eyebrow}</span>}
          <h3>{title}</h3>
          {subtitle&&<p>{subtitle}</p>}
        </div>
        <button type="button" className="entity-record-icon-button" onClick={onClose} title={en?'Close':'Κλείσιμο'} aria-label={en?'Close':'Κλείσιμο'}><X size={17}/></button>
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
