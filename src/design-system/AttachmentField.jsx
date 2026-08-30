import { useEffect, useState } from 'react'
import { Eye, FilePlus2, Paperclip, Pencil, Trash2, X } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { Button } from './Button'
import { SaveButton } from './SaveButton'

const defaultCategories=[
  ['generalDocument','generalDocument'],
  ['medicalReport','medicalReport'],
  ['laboratoryDocument','laboratoryDocument'],
  ['correspondence','correspondence'],
  ['photo','photo'],
  ['other','other'],
]

export function AttachmentField({
  disabled=false,
  value=[],
  onChange=()=>{},
  accept,
  categories=defaultCategories,
}){
  const {t}=useLanguage()
  const {confirm,notify}=useFeedback()
  const [files,setFiles]=useState(value)
  const [editor,setEditor]=useState(null)
  useEffect(()=>setFiles(value),[value])

  function beginAdd(){
    setEditor({mode:'add',id:null,file:null,name:'',category:categories[0]?.[0]||'other',description:''})
  }
  function beginEdit(file){
    setEditor({
      mode:'edit',
      id:file.id,
      file:null,
      name:file.name||'',
      category:file.category||categories[0]?.[0]||'other',
      description:file.description||'',
    })
  }
  function chooseFile(event){
    const file=event.target.files?.[0]||null
    if(!file)return
    setEditor(current=>({...current,file,name:file.name,dataUrl:''}))
    if(file.size<=4*1024*1024){
      const reader=new FileReader()
      reader.onload=()=>setEditor(current=>current?{...current,dataUrl:String(reader.result||'')}:current)
      reader.readAsDataURL(file)
    }
    event.target.value=''
  }
  function saveEditor(){
    if(!editor)return
    if(editor.mode==='add'&&!editor.file)return
    let next
    if(editor.mode==='add'){
      const file=editor.file
      const added={
        id:`${file.name}-${file.lastModified}-${file.size}-${Date.now()}`,
        name:file.name,
        size:file.size,
        type:file.type,
        objectUrl:URL.createObjectURL(file),
        dataUrl:editor.dataUrl||'',
        category:editor.category,
        description:editor.description.trim(),
      }
      next=[...files,added]
    }else{
      next=files.map(file=>file.id===editor.id?{
        ...file,
        category:editor.category,
        description:editor.description.trim(),
      }:file)
    }
    setFiles(next)
    onChange(next)
    setEditor(null)
  }
  async function remove(id){
    const ok=await confirm({title:t('delete'),message:t('deleteConfirm'),confirmLabel:t('delete'),danger:true})
    if(!ok)return
    const target=files.find(file=>file.id===id)
    if(target?.objectUrl)URL.revokeObjectURL(target.objectUrl)
    const next=files.filter(file=>file.id!==id)
    setFiles(next)
    onChange(next)
    notify(t('actionCompleted'),'success')
  }
  function view(file){
    if(file.dataUrl||file.objectUrl||file.url)window.open(file.dataUrl||file.objectUrl||file.url,'_blank','noopener,noreferrer')
  }
  const categoryLabel=code=>{
    const row=categories.find(([value])=>value===code)
    return t(row?.[1]||code||'other')
  }

  return <div className="attachment-field attachment-field-v2">
    <div className="attachment-heading"><Paperclip size={16}/><strong>{t('attachments')}</strong><span>{files.length}</span></div>

    {files.length>0&&<div className="attachment-list">
      {files.map(file=><div key={file.id} className="attachment-row attachment-row-v2">
        <div className="attachment-file-info">
          <strong title={file.name}>{file.name}</strong>
          <div><span className="attachment-category">{categoryLabel(file.category)}</span>{file.description&&<small>{file.description}</small>}</div>
        </div>
        <div className="attachment-actions">
          <button disabled={!file.dataUrl&&!file.objectUrl&&!file.url} onClick={()=>view(file)} title={t('viewAttachment')} aria-label={t('viewAttachment')}><Eye size={14}/></button>
          {!disabled&&<button className="edit" onClick={()=>beginEdit(file)} title={t('edit')} aria-label={t('edit')}><Pencil size={14}/></button>}
          {!disabled&&<button className="danger" onClick={()=>remove(file.id)} title={t('delete')} aria-label={t('delete')}><Trash2 size={14}/></button>}
        </div>
      </div>)}
    </div>}

    {!disabled&&<button type="button" className="attachment-add attachment-add-button" onClick={beginAdd}><FilePlus2 size={15}/>{t('addAttachment')}</button>}

    {editor&&<div className="attachment-editor-backdrop">
      <div className="attachment-editor-card" role="dialog" aria-modal="true">
        <header>
          <div><span className="eyebrow">{t('attachments')}</span><h3>{editor.mode==='add'?t('newAttachment'):t('editAttachment')}</h3></div>
          <button className="icon-close" onClick={()=>setEditor(null)} aria-label={t('close')}><X size={18}/></button>
        </header>
        <div className="attachment-editor-grid">
          {editor.mode==='add'&&<label className="attachment-file-picker">
            <span>{t('file')}</span>
            <input type="file" accept={accept} onChange={chooseFile}/>
            <div className={editor.file?'has-file':''}><FilePlus2 size={16}/><strong>{editor.file?.name||t('selectFile')}</strong></div>
          </label>}
          {editor.mode==='edit'&&<div className="attachment-current-file"><span>{t('file')}</span><strong>{editor.name}</strong></div>}
          <label><span>{t('documentCategory')}</span><select value={editor.category} onChange={e=>setEditor(x=>({...x,category:e.target.value}))}>{categories.map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label className="attachment-editor-description"><span>{t('description')}</span><textarea rows={3} value={editor.description} onChange={e=>setEditor(x=>({...x,description:e.target.value}))} placeholder={t('attachmentDescriptionPlaceholder')}/></label>
        </div>
        <footer><Button variant="secondary" onClick={()=>setEditor(null)}>{t('cancel')}</Button><SaveButton disabled={editor.mode==='add'&&!editor.file} onClick={saveEditor}>{t('save')}</SaveButton></footer>
      </div>
    </div>}
  </div>
}
