import { Component } from 'react'
import { TriangleAlert } from 'lucide-react'

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
    return <main className="app-error-boundary" role="alert">
      <div className="app-error-card">
        <TriangleAlert aria-hidden="true" size={32}/>
        <div>
          <h1>{english?'Something went wrong':'Παρουσιάστηκε πρόβλημα'}</h1>
          <p>{english
            ?'The application could not display this screen. Your stored records have not been changed.'
            :'Η εφαρμογή δεν μπόρεσε να εμφανίσει αυτή την οθόνη. Οι αποθηκευμένες εγγραφές σας δεν έχουν τροποποιηθεί.'}</p>
        </div>
        <button type="button" className="button primary" onClick={this.reload}>
          {english?'Reload application':'Επαναφόρτωση εφαρμογής'}
        </button>
      </div>
    </main>
  }
}
