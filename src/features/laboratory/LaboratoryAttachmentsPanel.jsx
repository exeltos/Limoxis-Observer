import { useEffect, useRef, useState } from 'react'
import { Eye, FileText, Paperclip, Trash2, Upload } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { EmptyState } from '../../design-system/EmptyState'
import { deleteAttachment, getAttachmentUrl, loadAttachments, uploadAttachment } from '../../core/attachments/attachmentService'

const MAX_FILE_SIZE=25*1024*1024

export function LaboratoryAttachmentsPanel({organizationId,sampleRecordId,canManage,t,notify}){
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const inputRef=useRef(null)

  async function reload(){
    setLoading(true)
    try{setRows(await loadAttachments(organizationId,'laboratory_sample',sampleRecordId))}
    catch(error){notify(error?.message||t('actionFailed'),'error')}
    finally{setLoading(false)}
  }
  useEffect(()=>{reload()},[organizationId,sampleRecordId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(file){
    if(!file)return
    if(file.size>MAX_FILE_SIZE){notify(t('fileTooLarge'),'error');return}
    setBusy(true)
    try{
      await uploadAttachment(organizationId,'laboratory_sample',sampleRecordId,file,{category:'laboratory_evidence'})
      await reload();notify(t('saved'),'success')
    }catch(error){notify(error?.message||t('actionFailed'),'error')}
    finally{setBusy(false);if(inputRef.current)inputRef.current.value=''}
  }
  async function view(row){
    try{const url=await getAttachmentUrl(row.storagePath);if(url)window.open(url,'_blank','noopener,noreferrer')}
    catch(error){notify(error?.message||t('actionFailed'),'error')}
  }
  async function remove(row){
    if(!window.confirm(`${t('delete')} · ${row.name}?`))return
    setBusy(true)
    try{await deleteAttachment(row.id);await reload();notify(t('saved'),'success')}
    catch(error){notify(error?.message||t('actionFailed'),'error')}
    finally{setBusy(false)}
  }
  const size=value=>value>=1048576?`${(value/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(value/1024))} KB`

  return <section className="clinical-panel full-panel">
    <div className="record-section-header"><div><Paperclip size={17}/><strong>{t('attachments')}</strong><small>{rows.length}</small></div>{canManage&&<><input ref={inputRef} type="file" hidden onChange={event=>upload(event.target.files?.[0])}/><Button variant="secondary" disabled={busy} onClick={()=>inputRef.current?.click()}><Upload size={15}/> {t('upload')}</Button></>}</div>
    {loading?<div className="inline-empty">{t('loading')}</div>:rows.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('document')}</th><th>{t('type')}</th><th>{t('size')}</th><th>{t('actions')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong><FileText size={14}/> {row.name}</strong></td><td>{row.type||'—'}</td><td>{size(row.size)}</td><td><div className="record-section-actions"><Button variant="secondary" onClick={()=>view(row)}><Eye size={14}/> {t('view')}</Button>{canManage&&<Button variant="secondary" disabled={busy} onClick={()=>remove(row)}><Trash2 size={14}/> {t('delete')}</Button>}</div></td></tr>)}</tbody></table></div>:<EmptyState title={t('noData')} description={t('attachments')}/>} 
  </section>
}
