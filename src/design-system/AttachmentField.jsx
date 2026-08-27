import { useEffect, useState } from 'react'
import { Eye, FilePlus2, Paperclip, Trash2 } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'

export function AttachmentField({ disabled = false, value = [], onChange = () => {}, accept }) {
  const { t } = useLanguage()
  const [files, setFiles] = useState(value)
  useEffect(()=>setFiles(value),[value])
  function addFiles(event) {
    const added = Array.from(event.target.files ?? []).map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      size: file.size,
      type: file.type,
      objectUrl: URL.createObjectURL(file),
    }))
    const next = [...files, ...added]
    setFiles(next); onChange(next); event.target.value = ''
  }
  function remove(id) {
    const target=files.find(file=>file.id===id)
    if(target?.objectUrl) URL.revokeObjectURL(target.objectUrl)
    const next = files.filter((file) => file.id !== id)
    setFiles(next); onChange(next)
  }
  function view(file){
    if(file.objectUrl || file.url) window.open(file.objectUrl || file.url,'_blank','noopener,noreferrer')
  }
  return <div className="attachment-field">
    <div className="attachment-heading"><Paperclip size={16}/><strong>{t('attachments')}</strong></div>
    {files.length > 0 && <div className="attachment-list">{files.map((file) => <div key={file.id} className="attachment-row">
      <span title={file.name}>{file.name}</span>
      <div className="attachment-actions">
        <button disabled={!file.objectUrl&&!file.url} onClick={() => view(file)} title={t('viewAttachment')} aria-label={t('viewAttachment')}><Eye size={14}/></button>
        {!disabled && <button onClick={() => remove(file.id)} title={t('delete')} aria-label={t('delete')}><Trash2 size={14}/></button>}
      </div>
    </div>)}</div>}
    {!disabled && <label className="attachment-add"><FilePlus2 size={15}/>{t('addAttachment')}<input type="file" multiple accept={accept} onChange={addFiles}/></label>}
  </div>
}
