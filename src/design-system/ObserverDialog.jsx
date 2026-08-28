import { X } from 'lucide-react'
import { Button } from './Button'

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
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
    <section className={`entry-card observer-dialog observer-dialog-${width} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
      <header>
        <div>
          {eyebrow&&<span className="eyebrow">{eyebrow}</span>}
          <h3>{title}</h3>
          {subtitle&&<p>{subtitle}</p>}
        </div>
        <button type="button" className="entity-record-icon-button" onClick={onClose} title="Κλείσιμο" aria-label="Κλείσιμο"><X size={17}/></button>
      </header>
      <div className="observer-dialog-body">{children}</div>
      {footer&&<footer>{footer}</footer>}
    </section>
  </div>
}

export function DialogActions({onCancel,onSave,saveLabel='Αποθήκευση',disabled=false,children}){
  return <>
    {children}
    <Button variant="secondary" onClick={onCancel}>Ακύρωση</Button>
    <Button disabled={disabled} onClick={onSave}>{saveLabel}</Button>
  </>
}
