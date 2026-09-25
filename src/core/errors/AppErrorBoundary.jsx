import { Component } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '../../design-system/Button'

// A browser that blocks site data (strict privacy settings, some private modes,
// embedded third-party frames) makes every localStorage access throw. That is
// not an application fault, so tell the user how to fix it instead of showing
// the generic crash card.
export function isBrowserStorageBlocked(error) {
  const cause = error?.cause ?? error
  if (cause?.name === 'SecurityError') return true
  return /localStorage|sessionStorage|access is denied for this document/i.test(String(cause?.message || ''))
}

export class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    globalThis.console?.error?.('Limoxis Observer render failure', error, info)
  }

  reload = () => {
    globalThis.location?.reload?.()
  }

  render() {
    if (!this.state.error) return this.props.children

    const english = typeof document !== 'undefined' && document.documentElement.lang === 'en'
    const storageBlocked = isBrowserStorageBlocked(this.state.error)
    const title = storageBlocked
      ? (english ? 'Browser storage is blocked' : 'Ο browser μπλοκάρει την αποθήκευση δεδομένων')
      : (english ? 'Something went wrong' : 'Παρουσιάστηκε πρόβλημα')
    const message = storageBlocked
      ? (english
        ? 'Limoxis Observer needs to store data on this device. Allow cookies and site data for this site (or leave private browsing), then reload.'
        : 'Το Limoxis Observer χρειάζεται να αποθηκεύει δεδομένα σε αυτή τη συσκευή. Επιτρέψτε τα cookies και τα δεδομένα ιστότοπου για αυτή τη σελίδα (ή βγείτε από την ιδιωτική περιήγηση) και επαναφορτώστε.')
      : (english
        ? 'The application could not display this screen. Your stored records have not been changed.'
        : 'Η εφαρμογή δεν μπόρεσε να εμφανίσει αυτή την οθόνη. Οι αποθηκευμένες εγγραφές σας δεν έχουν τροποποιηθεί.')
    return <main className="app-error-boundary" role="alert">
      <div className="app-error-card">
        <TriangleAlert aria-hidden="true" size={32}/>
        <div>
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
        <Button onClick={this.reload}>
          {english?'Reload application':'Επαναφόρτωση εφαρμογής'}
        </Button>
      </div>
    </main>
  }
}
