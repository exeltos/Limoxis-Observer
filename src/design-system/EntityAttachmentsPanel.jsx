import { useEffect, useRef, useState } from 'react'
import { Eye, FileText, LoaderCircle, Paperclip, Trash2, Upload } from 'lucide-react'
import { AttachmentField } from './AttachmentField'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { OverflowMenu } from './OverflowMenu'
import { deleteAttachment, getAttachmentUrl, loadAttachments, uploadAttachment } from '../core/attachments/attachmentService'
import './AttachmentField.css'

const MAX_FILE_SIZE=25*1024*1024

export function EntityAttachmentsPanel({organizationId,entityType,entityRecordId,category='other',canManage,t,notify}){
  const categories=[
    ['generalDocument','generalDocument'],
    ['medicalReport','medicalReport'],
    ['laboratoryDocument','laboratoryDocument'],
    ['correspondence','correspondence'],
    ['photo','photo'],
    [category,'other'],
  ].filter((row,index,all)=>all.findIndex(item=>item[0]===row[0])===index)

  if(entityType!=='clinical_case')return <section className="clinical-panel full-panel"><AttachmentField disabled={!canManage} organizationId={organizationId} entityType={entityType} entityId={entityRecordId} categories={categories}/></section>

  return <PatientClinicalAttachments organizationId={organizationId} entityType={entityType} entityRecordId={entityRecordId} category={category} canManage={canManage} t={t} notify={notify}/>
}

function PatientClinicalAttachments({organizationId,entityType,entityRecordId,category,canManage,t,notify}){
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [uploading,setUploading]=useState(false)
  const [pendingDelete,setPendingDelete]=useState(null)
  const inputRef=useRef(null)

  async function reload(){
    setLoading(true)
    try{setRows(await loadAttachments(organizationId,entityType,entityRecordId))}
    catch(error){notify(error?.message||t('actionFailed'),'error')}
    finally{setLoading(false)}
  }
  useEffect(()=>{reload()},[organizationId,entityType,entityRecordId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(file){
    if(!file)return
    if(file.size>MAX_FILE_SIZE){notify(t('fileTooLarge'),'error');return}
    setBusy(true);setUploading(true)
    try{
      await uploadAttachment(organizationId,entityType,entityRecordId,file,{category})
      await reload();notify(t('saved'),'success')
    }catch(error){notify(error?.message||t('actionFailed'),'error')}
    finally{setBusy(false);setUploading(false);if(inputRef.current)inputRef.current.value=''}
  }
  async function view(row){
    try{const url=await getAttachmentUrl(row.storagePath);if(url)window.open(url,'_blank','noopener,noreferrer')}
    catch(error){notify(error?.message||t('actionFailed'),'error')}
  }
  async function remove(){
    if(!pendingDelete)return
    setBusy(true)
    try{await deleteAttachment(pendingDelete.id);setPendingDelete(null);await reload();notify(t('saved'),'success')}
    catch(error){notify(error?.message||t('actionFailed'),'error')}
    finally{setBusy(false)}
  }
  const size=value=>value>=1048576?`${(value/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(value/1024))} KB`

  return <>
    <section className="clinical-panel full-panel patient-clinical-attachments">
      <div className="record-section-header"><div><Paperclip size={17}/><strong>{t('attachments')}</strong><small>{rows.length}</small></div>{canManage&&<><input ref={inputRef} type="file" hidden onChange={event=>upload(event.target.files?.[0])}/><Button variant="secondary" disabled={busy} onClick={()=>inputRef.current?.click()}>{uploading?<LoaderCircle className="lo-inline-spinner" size={15}/>:<Upload size={15}/>} {uploading?(t('uploading')||t('loading')):t('addAttachment')}</Button></>}</div>
      {uploading&&<div className="attachment-upload-progress attachment-upload-progress-inline" role="status" aria-live="polite"><LoaderCircle size={22}/><span>{t('uploading')||t('loading')}</span></div>}
      {loading&&!uploading?<div className="patient-attachments-empty">{t('loading')}</div>:rows.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('document')}</th><th>{t('type')}</th><th>{t('size')}</th><th>{t('actions')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong><FileText size={14}/> {row.name}</strong></td><td>{row.type||'—'}</td><td>{size(row.size)}</td><td><OverflowMenu items={[
        {id:'view',label:t('view'),icon:Eye,onClick:()=>view(row)},
        {id:'delete',label:t('delete'),icon:Trash2,tone:'danger',separatorBefore:true,disabled:busy,onClick:()=>setPendingDelete(row),hidden:!canManage},
      ]}/></td></tr>)}</tbody></table></div>:<div className="patient-attachments-empty"><FileText size={18}/><span>{t('noData')}</span></div>}
    </section>
    <ConfirmDialog open={Boolean(pendingDelete)} title={t('delete')} description={pendingDelete?`${t('delete')} · ${pendingDelete.name}?`:''} confirmLabel={t('delete')} cancelLabel={t('cancel')} onConfirm={remove} onClose={()=>setPendingDelete(null)} busy={busy} tone="danger"/>
  </>
}
