function safeName(value='record'){
  return String(value||'record').trim().replace(/[^\p{L}\p{N}._-]+/gu,'_').replace(/^_+|_+$/g,'')||'record'
}
export function downloadRecordJson(record,{filename}={}){
  if(!record)return
  const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=`${safeName(filename||record.id||'record')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
