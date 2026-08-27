import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

const FeedbackContext = createContext(null)
let nextId = 1

export function FeedbackProvider({ children }) {
  const [items, setItems] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const { t } = useLanguage()
  const notify = useCallback((message, tone = 'info') => {
    const id = nextId++
    setItems((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200)
  }, [])
  const confirm = useCallback((options) => new Promise((resolve) => setConfirmState({ ...options, resolve })), [])
  const finishConfirm = (answer) => {
    confirmState?.resolve(answer)
    setConfirmState(null)
  }
  const value = useMemo(() => ({ notify, confirm }), [notify, confirm])
  const icons = { success: CheckCircle2, warning: TriangleAlert, danger: XCircle, info: Info }
  return <FeedbackContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite">{items.map((item) => { const Icon = icons[item.tone] ?? Info; return <div className={`toast ${item.tone}`} key={item.id}><Icon size={18}/><span>{item.message}</span><button onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))}><X size={15}/></button></div> })}</div>
    {confirmState && <div className="modal-backdrop"><div className="confirm-dialog" role="dialog" aria-modal="true"><h3>{confirmState.title ?? t('confirmAction')}</h3><p>{confirmState.message}</p><div className="dialog-actions"><button className="button secondary" onClick={() => finishConfirm(false)}>{t('cancel')}</button><button className={`button ${confirmState.danger ? 'danger' : 'primary'}`} onClick={() => finishConfirm(true)}>{confirmState.confirmLabel ?? t('confirm')}</button></div></div></div>}
  </FeedbackContext.Provider>
}

export function useFeedback() {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider')
  return value
}
