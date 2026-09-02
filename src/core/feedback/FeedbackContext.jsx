import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { sanitizeUserMessage, userFacingError } from './userFacingError'
import { diagnosticCodeFromError } from '../diagnostics/runtimeDiagnosticsService'

const FeedbackContext = createContext(null)
let nextId = 1

function emitDiagnostic(detail){
  if(typeof window==='undefined')return
  window.dispatchEvent(new CustomEvent('limoxis:feedback',{detail}))
}

export function FeedbackProvider({ children }) {
  const [items, setItems] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const { t, language } = useLanguage()
  const notify = useCallback((message, tone = 'info', meta={}) => {
    const id = nextId++
    const safeMessage=sanitizeUserMessage(message,{language})
    setItems((current) => [...current, { id, message:safeMessage, tone }])
    emitDiagnostic({message:safeMessage,severity:tone==='danger'?'error':tone,operation:meta?.operation||null,eventType:meta?.eventType||'ui_feedback',diagnosticCode:meta?.diagnosticCode||null})
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200)
  }, [language])
  const notifyError = useCallback((error, context='generic', meta={}) => {
    const id = nextId++
    const message=userFacingError(error,{language,context})
    setItems((current) => [...current, { id, message, tone:'danger' }])
    emitDiagnostic({message,severity:meta?.severity||'error',operation:meta?.operation||context,eventType:meta?.eventType||'operation_error',diagnosticCode:diagnosticCodeFromError(error)})
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 5200)
  }, [language])
  const notifyUndo = useCallback((message, onUndo, timeout = 7000) => {
    const id = nextId++
    const safeMessage=sanitizeUserMessage(message,{language})
    setItems((current) => [...current, { id, message:safeMessage, tone:'success', actionLabel:t('undo'), onAction:()=>{onUndo?.();setItems(rows=>rows.filter(x=>x.id!==id))} }])
    emitDiagnostic({message:safeMessage,severity:'success',operation:'undoable_action',eventType:'ui_feedback',diagnosticCode:null})
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), timeout)
  }, [t,language])
  const confirm = useCallback((options) => new Promise((resolve) => setConfirmState({ ...options, resolve })), [])
  const finishConfirm = (answer) => {
    confirmState?.resolve(answer)
    setConfirmState(null)
  }
  const value = useMemo(() => ({ notify, notifyError, notifyUndo, confirm }), [notify, notifyError, notifyUndo, confirm])
  const icons = { success: CheckCircle2, warning: TriangleAlert, danger: XCircle, info: Info }
  return <FeedbackContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite">{items.map((item) => { const Icon = icons[item.tone] ?? Info; return <div className={`toast ${item.tone}`} key={item.id}><Icon size={18}/><span>{item.message}</span>{item.onAction&&<button className="toast-action" onClick={item.onAction}>{item.actionLabel}</button>}<button onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))}><X size={15}/></button></div> })}</div>
    {confirmState && <div className="modal-backdrop"><div className="confirm-dialog" role="dialog" aria-modal="true"><h3>{confirmState.title ?? t('confirmAction')}</h3><p>{confirmState.message}</p><div className="dialog-actions"><button className="button secondary" onClick={() => finishConfirm(false)}>{t('cancel')}</button><button className={`button ${confirmState.danger ? 'danger' : 'primary'}`} onClick={() => finishConfirm(true)}>{confirmState.confirmLabel ?? t('confirm')}</button></div></div></div>}
  </FeedbackContext.Provider>
}

export function useFeedback() {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider')
  return value
}