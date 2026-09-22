const normalize=value=>String(value??'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').trim()
export function chunkLiraKnowledge(sections,{maxChars=2400,overlapChars=240}={}){
 const chunks=[];let index=0
 for(const section of sections||[]){
  const heading=normalize(section.heading);const body=normalize(section.content)
  if(!body)continue
  let start=0
  while(start<body.length){
   let end=Math.min(body.length,start+maxChars)
   if(end<body.length){const boundary=Math.max(body.lastIndexOf('\n',end),body.lastIndexOf('. ',end));if(boundary>start+Math.floor(maxChars*.6))end=boundary+1}
   const content=body.slice(start,end).trim()
   if(content)chunks.push({chunk_index:index++,heading:heading||null,content,citation_label:section.citationLabel||heading||null,page_start:section.pageStart??null,page_end:section.pageEnd??null,token_count:Math.ceil(content.length/4),metadata:{section_id:section.id||null}})
   if(end>=body.length)break
   start=Math.max(end-overlapChars,start+1)
  }
 }
 return chunks
}
export function validateLiraIngestion(source,chunks){
 const errors=[]
 if(!source?.id)errors.push('source_id_required')
 if(!['review','approved'].includes(source?.status))errors.push('source_not_reviewable')
 if(!source?.authority)errors.push('authority_required')
 if(!source?.source_version)errors.push('source_version_required')
 if(!Array.isArray(chunks)||chunks.length===0)errors.push('chunks_required')
 if((chunks||[]).some(x=>!String(x.content||'').trim()))errors.push('empty_chunk')
 return {ok:errors.length===0,errors}
}
