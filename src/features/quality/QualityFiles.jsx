import { useEffect,useRef,useState } from 'react'
import { Paperclip,Plus,X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FormCard } from '../../design-system/FormCard'
import { cloudAttachmentsEnabled,loadAttachments,uploadAttachment } from '../../core/attachments/attachmentService'

// Files of a quality record: the line on its first tab, and the picker of the create form.

export const MAX_FILES=10
const MAX_FILE_MB=15
const fileSize=bytes=>bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`

// «Files (N)» with the first names and a button to the Documents tab, where they are added.
export function QualityFilesRow({record,recordType,organizationId,canAdd,onOpen,en}){
 const [loaded,setLoaded]=useState(null)
 const entityId=record.dbId||record.id
 useEffect(()=>{
  let active=true
  loadAttachments(organizationId,`quality_${recordType}`,entityId).then(rows=>{if(active)setLoaded(rows)}).catch(()=>{if(active)setLoaded([])})
  return()=>{active=false}
 },[organizationId,recordType,entityId])
 const files=loaded?.length?loaded:(record.attachments||[])
 const names=files.slice(0,3).map(file=>file.name).filter(Boolean)
 return <div className="quality-files-row">
  <Paperclip size={15} aria-hidden="true"/>
  <strong>{en?'Files':'Αρχεία'} ({files.length})</strong>
  <span>{names.length?`${names.join(', ')}${files.length>names.length?'…':''}`:(en?'No files attached.':'Δεν υπάρχουν επισυνάψεις.')}</span>
  <Button variant="secondary" onClick={onOpen}>{canAdd?<><Plus size={14}/>{en?'Add':'Προσθήκη'}</>:(en?'Open':'Άνοιγμα')}</Button>
 </div>
}

// Files picked before the record exists; they upload once it is saved.
export function usePendingFiles(notify,en){
 const [files,setFiles]=useState([])
 const add=picked=>{
  const list=[...picked]
  if(list.some(file=>file.size>MAX_FILE_MB*1048576))notify(en?`Files over ${MAX_FILE_MB} MB were left out.`:`Αρχεία πάνω από ${MAX_FILE_MB} MB δεν προστέθηκαν.`,'warning')
  setFiles(current=>[...current,...list.filter(file=>file.size<=MAX_FILE_MB*1048576)].slice(0,MAX_FILES))
 }
 const remove=index=>setFiles(current=>current.filter((_,at)=>at!==index))
 // Returns how many could not be attached.
 async function upload(organizationId,recordType,recordId){
  let failed=0
  if(!files.length||!recordId||!cloudAttachmentsEnabled())return 0
  for(const file of files){
   try{await uploadAttachment(organizationId,`quality_${recordType}`,recordId,file,{category:file.type.startsWith('image/')?'photo':'other'})}catch(error){console.error(error);failed+=1}
  }
  return failed
 }
 return {files,add,remove,upload}
}

export function PendingFilesCard({pending,saving,en}){
 const input=useRef(null)
 const on=cloudAttachmentsEnabled()
 return <FormCard wide title={en?'Attachments':'Επισυνάψεις'} icon={Paperclip} hint={on?(en?`Optional. Up to ${MAX_FILES} files of ${MAX_FILE_MB} MB.`:`Προαιρετικά. Έως ${MAX_FILES} αρχεία των ${MAX_FILE_MB} MB.`):(en?'Files are not stored in the demo.':'Στο demo δεν αποθηκεύονται αρχεία.')}>
  <input ref={input} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={event=>{pending.add(event.target.files||[]);event.target.value=''}}/>
  {pending.files.length>0&&<ul className="quality-report-files">{pending.files.map((file,index)=><li key={`${file.name}-${index}`}><Paperclip size={14} aria-hidden="true"/><span>{file.name}</span><small>{fileSize(file.size)}</small><button type="button" aria-label={en?`Remove ${file.name}`:`Αφαίρεση ${file.name}`} onClick={()=>pending.remove(index)}><X size={14}/></button></li>)}</ul>}
  <div><Button variant="secondary" disabled={!on||pending.files.length>=MAX_FILES||saving} onClick={()=>input.current?.click()}><Plus size={15}/>{en?'Add files':'Προσθήκη αρχείων'}</Button></div>
 </FormCard>
}
