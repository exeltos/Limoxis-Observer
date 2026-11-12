import type { ReactNode } from 'react'

// Η τιμή του FeedbackContext (FeedbackProvider), για τα αρχεία TypeScript που
// δείχνουν μηνύματα ή ζητούν επιβεβαίωση. Το FeedbackContext.jsx τη δηλώνει με JSDoc.
export type FeedbackTone = 'success' | 'info' | 'warning' | 'danger' | 'error'

export interface FeedbackMeta {
  operation?: string | null
  eventType?: string
  diagnosticCode?: string | null
  severity?: string
}

export interface ConfirmOptions {
  title?: ReactNode
  message?: ReactNode
  confirmLabel?: ReactNode
  danger?: boolean
  // Πεδίο κειμένου μέσα στην ερώτηση: η απάντηση είναι τότε το κείμενο.
  input?: { label?: ReactNode; placeholder?: string; required?: boolean; maxLength?: number }
  inputDefault?: string
}

export interface FeedbackContextValue {
  notify: (message: string, tone?: FeedbackTone, meta?: FeedbackMeta) => void
  notifyError: (error: unknown, context?: string, meta?: FeedbackMeta) => void
  notifyUndo: (message: string, onUndo?: () => void, timeout?: number) => void
  // true / false, ή το κείμενο που γράφτηκε όταν η ερώτηση έχει `input`.
  confirm: (options: ConfirmOptions) => Promise<boolean | string>
}
