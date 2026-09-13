import { useEffect, useState } from 'react'
import { Eye, FilePlus2, LoaderCircle, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'
import { useFeedback } from '../core/feedback/FeedbackContext'
import { cloudAttachmentsEnabled, loadAttachments, uploadAttachment, updateAttachmentMetadata, deleteAttachment, getAttachmentUrl } from '../core/attachments/attachmentService'
import { ActionButton } from './ActionButton'
import { OverflowMenu } from './OverflowMenu'
import { ObserverDialog, DialogActions } from './ObserverDialog'
import './AttachmentField.css'

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
  organizationId=null,
  entityType=null,
  entityId=null,
}){
  const {t}=useLanguage()
  const {confirm,notify}=useFeedback()
  const cloudMode = cloudAttachmentsEnabled() && Boolean(organizationId) && Boolean(entityType) && Boolean(entityId)
  const [files,setFiles]=useState(value)
  const [cloudLoading,setCloudLoading]=useState(cloudMode)
  const [cloudError,setCloudError]=useState(null)
  const [editor,setEditor]=useState(null)
  const [busy,setBusy]=useState(false)

  useEffect(()=>{ if(!cloudMode) setFiles(value) },[value,cloudMode])

  useEffect(()=>{
    if(!cloudMode)return
    let cancelled=false
    setCloudLoading(true); setCloudError(null)
    loadAttachments(organizationId,entityType,entityId)
      .then(rows=>{ if(!cancelled)setFiles(rows) })
      .catch(err=>{ if(!cancelled)setCloudError(err) })
      .finally(()=>{ if(!cancelled)setCloudLoading(false) })
    return ()=>{ cancelled=true }
  },[cloudMode,organizationId,entityType,entityId])

  function beginAdd(){
    setEditor({mode:'add',id:null,file:null,name:'',category:categories[0]?.[0]||'other',description:'',stagedAttachment:null,dataUrl:''})
  }
  function beginEdit(file){
    setEditor({
      mode:'edit',
      id:file.id,
      file:null,
      name:file.name||'',
      category:file.category||categories[0]?.[0]||'other',
      description:file.description||'',
      stagedAttachment:null,
    })
  }
  async function chooseFile(event){
    const file=event.target.files?.[0]||null
    event.target.value=''
    if(!file||busy)return
    setEditor(current=>current?{...current,file,name:file.name,dataUrl:'',stagedAttachment:null}:current)
    if(cloudMode){
      setBusy(true)
      try{
        const snapshot=editor
        const added=await uploadAttachment(organizationId,entityType,entityId,file,{category:snapshot?.category||categories[0]?.[0]||'other',description:(snapshot?.description||'').trim()})
        setEditor(current=>current?{...current,file:null,id:added.id,name:added.name||file.name,stagedAttachment:added}:current)
      }catch{
        setEditor(current=>current?{...current,file:null,name:'',stagedAttachment:null}:current)
        notify(t('actionFailed')||'Upload failed.','danger')
      }finally{
        setBusy(false)
      }
      return
    }
    if(file.size<=4*1024*1024){
      setBusy(true)
      const reader=new FileReader()
      reader.onload=()=>{setEditor(current=>current?{...current,dataUrl:String(reader.result||'')}:current);setBusy(false)}
      reader.onerror=()=>setBusy(false)
      reader.readAsDataURL(file)
    }
  }
  async function closeEditor(){
    if(busy)return
    if(cloudMode&&editor?.mode==='add'&&editor?.stagedAttachment?.id){
      setBusy(true)
      try{await deleteAttachment(editor.stagedAttachment.id)}catch(error){void error}finally{setBusy(false);setEditor(null)}
      return
    }
    setEditor(null)
  }
  async function saveEditor(){
    if(!editor||busy)return
    if(editor.mode==='add'&&cloudMode&&!editor.stagedAttachment)return
    if(editor.mode==='add'&&!cloudMode&&!editor.file)return
    if(cloudMode){
      setBusy(true)
      try{
        if(editor.mode==='add'){
          const updated=await updateAttachmentMetadata(editor.stagedAttachment.id,{category:editor.category,description:editor.description.trim()})
          const next=[...files,updated]
          setFiles(next); onChange(next)
        }else{
          const updated=await updateAttachmentMetadata(editor.id,{category:editor.category,description:editor.description.trim()})
          const next=files.map(f=>f.id===editor.id?updated:f)
          setFiles(next); onChange(next)
        }
        setEditor(null)
      }catch{
        notify(t('actionFailed')||(editor.mode==='add'?'Upload failed.':'Update failed.'),'danger')
      }finally{
        setBusy(false)
      }
      return
    }
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
    if(cloudMode){
      setBusy(true)
      try{
        await deleteAttachment(id)
        const next=files.filter(file=>file.id!==id)
        setFiles(next); onChange(next)
        notify(t('actionCompleted'),'success')
      }catch{
        notify(t('actionFailed')||'Could not delete the file.','danger')
      }finally{
        setBusy(false)
      }
      return
    }
    const target=files.find(file=>file.id===id)
    if(target?.objectUrl)URL.revokeObjectURL(target.objectUrl)
    const next=files.filter(file=>file.id!==id)
    setFiles(next)
    onChange(next)
    notify(t('actionCompleted'),'success')
  }
  async function view(file){
    if(cloudMode&&file.storagePath){
      const previewWindow=window.open('about:blank','_blank')
      try{
        const url=await getAttachmentUrl(file.storagePath)
        if(!url){previewWindow?.close();return}
        if(previewWindow){
          previewWindow.opener=null
          previewWindow.location.href=url
        }else{
          window.location.assign(url)
        }
      }catch{
        previewWindow?.close()
        notify(t('actionFailed')||'Could not open the file.','danger')
      }
      return
    }
    if(file.dataUrl||file.objectUrl||file.url)window.open(file.dataUrl||file.objectUrl||file.url,'_blank','noopener,noreferrer')
  }
  const categoryLabel=code=>{
    const row=categories.find(([value])=>value===code)
    return t(row?.[1]||code||'other')
  }
  const canView=file=>cloudMode?Boolean(file.storagePath):Boolean(file.dataUrl||file.objectUrl||file.url)
  const addReady=editor?.mode==='add'?(cloudMode?Boolean(editor.stagedAttachment):Boolean(editor.file)):true

  return <div className="attachment-field attachment-field-v2">
    <div className="attachment-heading"><Paperclip size={16}/><strong>{t('attachments')}</strong><span>{files.length}</span></div>

    {cloudMode&&cloudLoading&&<div className="inline-empty">{t('loading')||'…'}</div>}
    {cloudMode&&cloudError&&<div className="data-access-state error" role="alert">{t('loadFailed')||'Could not load attachments.'}</div>}

    {!cloudLoading&&files.length>0&&<div className="attachment-list">
      {files.map(file=><div key={file.id} className="attachment-row attachment-row-v2">
        <div className="attachment-file-info">
          <strong className={canView(file)?'attachment-open-target':''} title={file.name} role={canView(file)?'button':undefined} tabIndex={canView(file)?0:undefined} onClick={()=>canView(file)&&view(file)} onKeyDown={event=>{if(canView(file)&&(event.key==='Enter'||event.key===' ')){event.preventDefault();view(file)}}}>{file.name}</strong>
          <div><span className="attachment-category">{categoryLabel(file.category)}</span>{file.description&&<small>{file.description}</small>}</div>
        </div>
        <div className="attachment-actions">
          <OverflowMenu label={t('attachmentActionsLabel')} items={[
            {id:'view',label:t('viewAttachment'),icon:Eye,disabled:busy||!canView(file),onClick:()=>view(file)},
            !disabled&&{id:'edit',label:t('edit'),icon:Pencil,disabled:busy,onClick:()=>beginEdit(file)},
            !disabled&&{id:'delete',label:t('delete'),icon:Trash2,tone:'danger',separatorBefore:true,disabled:busy,onClick:()=>remove(file.id)},
          ]}/>
        </div>
      </div>)}
    </div>}

    {!disabled&&!cloudLoading&&<div className="attachment-add-row"><ActionButton tone="neutral" label={t('addAttachment')} disabled={busy} onClick={beginAdd}><FilePlus2 size={15}/><span>{t('addAttachment')}</span></ActionButton></div>}

    {editor&&<ObserverDialog
      eyebrow={t('attachments')}
      title={editor.mode==='add'?t('newAttachment'):t('editAttachment')}
      onClose={closeEditor}
      width="standard"
      className="attachment-editor-dialog"
      footer={<DialogActions onSave={saveEditor} saveLabel={t('save')} disabled={busy||!addReady} showCancel onCancel={closeEditor} cancelLabel={t('cancel')}/>}>
      <div className="attachment-editor-grid">
        {editor.mode==='add'&&<label className="attachment-file-picker field">
          <span>{t('file')}</span>
          <input type="file" accept={accept} disabled={busy} onChange={chooseFile}/>
          <div className={(editor.file||editor.stagedAttachment)?'has-file':''}>{busy?<LoaderCircle className="lo-inline-spinner" size={16}/>:<FilePlus2 size={16}/>}<strong>{editor.name||t('selectFile')}</strong></div>
        </label>}
        {editor.mode==='edit'&&<div className="attachment-current-file"><span>{t('file')}</span><strong>{editor.name}</strong></div>}
        <label className="field"><span>{t('documentCategory')}</span><select disabled={busy} value={editor.category} onChange={e=>setEditor(x=>({...x,category:e.target.value}))}>{categories.map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
        <label className="attachment-editor-description field"><span>{t('description')}</span><textarea disabled={busy} rows={3} value={editor.description} onChange={e=>setEditor(x=>({...x,description:e.target.value}))} placeholder={t('attachmentDescriptionPlaceholder')}/></label>
        {busy&&<div className="attachment-upload-progress" role="status" aria-live="polite"><LoaderCircle size={22}/><span>{editor.mode==='add'?(t('uploading')||'Μεταφόρτωση…'):(t('saving')||'Αποθήκευση…')}</span></div>}
      </div>
    </ObserverDialog>}
  </div>
}
