import type { ReactNode } from 'react'
import { AttachmentField, type AttachmentFile, type CategoryList } from './AttachmentField'
import { useLanguage } from '../core/i18n/LanguageContext'
import './DocumentsWorkspace.css'

// Every record's documents tab opens the same way: one line saying what it holds,
// then the shared attachment box, inside the record's own frame (no second card;
// the tab already names it, so the title is there for screen readers only).
interface DocumentsWorkspaceProps {
  title?: ReactNode
  subtitle?: ReactNode
  disabled?: boolean
  organizationId?: string | null
  entityType?: string | null
  entityId?: string | null
  categories?: CategoryList
  value?: AttachmentFile[]
  onChange?: (files: AttachmentFile[]) => void
}

export function DocumentsWorkspace({
  title,
  subtitle,
  disabled=false,
  organizationId=null,
  entityType,
  entityId,
  categories,
  value=[],
  onChange=()=>{},
}: DocumentsWorkspaceProps){
  const {t}=useLanguage()
  // Every documents card has the same shape: title, one line saying what it holds, then the files (or one line and the button).
  const shownTitle=title||t('documents'),shownSubtitle=subtitle||t('documentsSubtitle')
  return <div className="documents-workspace">
    <h3 className="lo-visually-hidden">{shownTitle}</h3>
    <p className="documents-workspace-note">{shownSubtitle}</p>
    <AttachmentField
      disabled={disabled}
      value={value}
      onChange={onChange}
      categories={categories}
      organizationId={organizationId}
      entityType={entityType}
      entityId={entityId}
    />
  </div>
}
