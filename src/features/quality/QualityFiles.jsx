import { useEffect,useRef,useState } from 'react'
import { Eye,Paperclip,Plus,X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { FormCard } from '../../design-system/FormCard'
import { cloudAttachmentsEnabled,getAttachmentUrl,loadAttachments,uploadAttachment } from '../../core/attachments/attachmentService'

// Files of a quality record: the line on its first tab, and the picker of the create form.

export const MAX_FILES=10
const MAX_FILE_MB=15
const fileSize=bytes=>bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`

// «Files (N)»: each name opens the file in a new tab; the button goes to the Documents tab, where they are added.
const SHOWN_FILES=4
export function QualityFilesRow({record,recordType,organizationId,canAdd,onOpen,en}){
 const {notify}=useFeedback()
 const [loaded,setLoaded]=useState(null)
 const entityId=record.dbId||record.id
 useEffect(()=>{
  let active=true
  loadAttachments(organizationId,`quality_${recordType}`,entityId).then(rows=>{if(active)setLoaded(rows)}).catch(()=>{if(active)setLoaded([])})
  return()=>{active=false}
 },[organizationId,recordType,entityId])
 const files=loaded?.length?loaded:(record.attachments||[])
 const canView=file=>Boolean(file.storagePath||file.dataUrl||file.objectUrl||file.url)
 async function view(file){
  const direct=file.dataUrl||file.objectUrl||file.url
  if(!file.storagePath){if(direct)window.open(direct,'_blank','noopener,noreferrer');return}
  const tab=window.open('about:blank','_blank')
  try{
   const url=await getAttachmentUrl(file.storagePath)
   if(!url){tab?.close();return}
   if(tab){tab.opener=null;tab.location.href=url}else window.location.assign(url)
  }catch{
   tab?.close()
   notify(en?'The file could not be opened.':'Δεν ήταν δυνατό το άνοιγμα του αρχείου.','error')
  }
 }
 return <div className="quality-files-row">
  <Paperclip size={15} aria-hidden="true"/>
  <strong>{en?'Files':'Αρχεία'} ({files.length})</strong>
  <span className="quality-files-list">
   {files.length?files.slice(0,SHOWN_FILES).map((file,index)=>canView(file)
    ?<button type="button" key={file.id||index} title={en?`Open ${file.name}`:`Άνοιγμα: ${file.name}`} onClick={()=>view(file)}><Eye size={13} aria-hidden="true"/>{file.name}</button>
    :<em key={file.id||index}>{file.name}</em>)
    :(en?'No files attached.':'Δεν υπάρχουν επισυνάψεις.')}
   {files.length>SHOWN_FILES&&<em>+{files.length-SHOWN_FILES}</em>}
  </span>
  <Button variant="secondary" onClick={onOpen}>{canAdd?<><Plus size={14}/>{en?'Add':'Προσθήκη'}</>:(en?'All files':'Όλα τα αρχεία')}</Button>
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
