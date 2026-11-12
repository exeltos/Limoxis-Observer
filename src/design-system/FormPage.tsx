import type { ReactNode } from 'react'
import { Page } from './Page'
import { Button } from './Button'
import { useLanguage } from '../core/i18n/LanguageContext'
import './FormPage.css'

// A form that is big enough for a whole screen (a visit, an application, the hiring) opens as a page in place of the
// one that called it, with Cancel and the save actions pinned at the bottom: not as a window over it.
interface FormPageProps { title?: ReactNode; subtitle?: ReactNode; onClose?: () => void; footer?: ReactNode; children?: ReactNode; className?: string }

export function FormPage({ title, subtitle, onClose, footer, children, className = '' }: FormPageProps) {
  const { language } = useLanguage()
  return <Page fill className={`lo-form-page ${className}`.trim()} title={title} subtitle={subtitle}>
    <section className="surface registry-workspace workspace-column workspace-fill">
      <div className="lo-form-page-body entity-record-body">{children}</div>
      <div className="lo-form-page-footer"><Button variant="secondary" onClick={onClose}>{language === 'en' ? 'Cancel' : 'Ακύρωση'}</Button>{footer}</div>
    </section>
  </Page>
}
