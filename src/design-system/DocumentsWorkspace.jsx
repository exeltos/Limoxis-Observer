import { AttachmentField } from './AttachmentField'
import { useLanguage } from '../core/i18n/LanguageContext'
import './DocumentsWorkspace.css'

// Every record's documents tab opens the same way (as in Quality): a
// record-section card with the title and the shared attachment box.
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
}){
  const {t}=useLanguage()
  // Every documents card has the same shape: title, one line saying what it holds, then the files (or one line and the button).
  const shownTitle=title||t('documents'),shownSubtitle=subtitle||t('documentsSubtitle')
  return <div className="record-section documents-workspace">
    <div className="record-section-header lo-section-header"><div><h3>{shownTitle}</h3><p>{shownSubtitle}</p></div></div>
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
