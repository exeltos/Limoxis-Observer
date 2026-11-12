import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { sanitizeUserMessage, userFacingError } from './userFacingError'
import { diagnosticCodeFromError } from '../diagnostics/runtimeDiagnosticsService'
import type { ConfirmOptions, FeedbackContextValue, FeedbackMeta, FeedbackTone } from './feedbackTypes'

const FeedbackContext = createContext<FeedbackContextValue | null>(null)
let nextId = 1

interface ToastItem {
  id: number
  message: string
  tone: FeedbackTone
  actionLabel?: string
  onAction?: () => void
}

interface ConfirmState extends ConfirmOptions {
  resolve: (answer: boolean | string) => void
}

interface FeedbackDiagnostic {
  message: string
  severity: string
  operation: string | null
  eventType: string
  diagnosticCode: string | null
}

function emitDiagnostic(detail: FeedbackDiagnostic){
  if(typeof window==='undefined')return
  window.dispatchEvent(new CustomEvent('limoxis:feedback',{detail}))
}

export function FeedbackProvider({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmInput,setConfirmInput]=useState('')
  const { t, language } = useLanguage()
  // The timers that remove a message: cleared with the provider, so none fires after it is gone.
  const timers = useRef(new Set<number>())
  useEffect(() => { const pending = timers.current; return () => { pending.forEach(timer => window.clearTimeout(timer)); pending.clear() } }, [])
  const dismissLater = useCallback((id: number, delay: number) => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); setItems((current) => current.filter((item) => item.id !== id)) }, delay)
    timers.current.add(timer)
  }, [])
  const notify = useCallback((message: string, tone: FeedbackTone = 'info', meta: FeedbackMeta = {}) => {
    const id = nextId++
    const safeMessage=sanitizeUserMessage(message,{language})
    setItems((current) => [...current, { id, message:safeMessage, tone }])
    // A successful save ends the screen's unsaved changes (src/app/UnsavedChangesGuard.jsx).
    if(tone==='success')window.dispatchEvent(new Event('limoxis:saved'))
    emitDiagnostic({message:safeMessage,severity:tone==='danger'?'error':tone,operation:meta?.operation||null,eventType:meta?.eventType||'ui_feedback',diagnosticCode:meta?.diagnosticCode||null})
    dismissLater(id, 4200)
  }, [language, dismissLater])
  const notifyError = useCallback((error: unknown, context='generic', meta: FeedbackMeta = {}) => {
    const id = nextId++
    const message=userFacingError(error,{language,context})
    setItems((current) => [...current, { id, message, tone:'danger' }])
    emitDiagnostic({message,severity:meta?.severity||'error',operation:meta?.operation||context,eventType:meta?.eventType||'operation_error',diagnosticCode:diagnosticCodeFromError(error)})
    dismissLater(id, 5200)
  }, [language, dismissLater])
  const notifyUndo = useCallback((message: string, onUndo?: () => void, timeout = 7000) => {
    const id = nextId++
    const safeMessage=sanitizeUserMessage(message,{language})
    setItems((current) => [...current, { id, message:safeMessage, tone:'success', actionLabel:t('undo'), onAction:()=>{onUndo?.();setItems(rows=>rows.filter(x=>x.id!==id))} }])
    emitDiagnostic({message:safeMessage,severity:'success',operation:'undoable_action',eventType:'ui_feedback',diagnosticCode:null})
    dismissLater(id, timeout)
  }, [t,language,dismissLater])
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean | string>((resolve) => {
    setConfirmInput(options?.inputDefault||'')
    setConfirmState({ ...options, resolve })
  }), [])
  const finishConfirm = (answer: boolean) => {
    if(!confirmState)return
    confirmState.resolve(answer?(confirmState.input?confirmInput.trim():true):false)
    setConfirmState(null)
    setConfirmInput('')
  }
  const value = useMemo<FeedbackContextValue>(() => ({ notify, notifyError, notifyUndo, confirm }), [notify, notifyError, notifyUndo, confirm])
  const icons: Partial<Record<FeedbackTone, typeof Info>> = { success: CheckCircle2, warning: TriangleAlert, danger: XCircle, info: Info }
  const inputRequired=Boolean(confirmState?.input?.required)
  const inputInvalid=inputRequired&&!confirmInput.trim()
  return <FeedbackContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite">{items.map((item) => { const Icon = icons[item.tone] ?? Info; return <div className={`toast ${item.tone}`} key={item.id}><Icon size={18}/><span>{item.message}</span>{item.onAction&&<button className="toast-action" onClick={item.onAction}>{item.actionLabel}</button>}<button type="button" aria-label={t('close')} title={t('close')} onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))}><X size={15}/></button></div> })}</div>
    {confirmState && <div className="modal-backdrop"><div className="confirm-dialog" role="dialog" aria-modal="true"><h3>{confirmState.title ?? t('confirmAction')}</h3><p>{confirmState.message}</p>{confirmState.input&&<label className="field"><span>{confirmState.input.label}</span><textarea rows={3} autoFocus value={confirmInput} onChange={event=>setConfirmInput(event.target.value)} placeholder={confirmState.input.placeholder||''} maxLength={confirmState.input.maxLength||500}/></label>}<div className="dialog-actions"><button className="button secondary" onClick={() => finishConfirm(false)}>{t('cancel')}</button><button className={`button ${confirmState.danger ? 'danger' : 'primary'}`} disabled={inputInvalid} onClick={() => finishConfirm(true)}>{confirmState.confirmLabel ?? t('confirm')}</button></div></div></div>}
  </FeedbackContext.Provider>
}

export function useFeedback() {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider')
  return value
}

// For shared components that may also render outside the provider (tests, standalone pages).
export function useOptionalFeedback() {
  return useContext(FeedbackContext)
}
