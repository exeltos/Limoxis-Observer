export function buildLiraCitation(source,chunk){
 if(!source||!chunk)return null
 return {sourceId:source.id,chunkId:chunk.id,authority:source.authority,title:source.title,version:source.source_version||null,url:source.source_url||null,label:chunk.citation_label||chunk.heading||source.title,pageStart:chunk.page_start??null,pageEnd:chunk.page_end??null}
}
export function formatLiraCitation(citation){
 if(!citation)return ''
 const version=citation.version?` v${citation.version}`:''
 const pages=citation.pageStart?` · p. ${citation.pageStart}${citation.pageEnd&&citation.pageEnd!==citation.pageStart?`–${citation.pageEnd}`:''}`:''
 return `${citation.authority} · ${citation.title}${version}${pages}`
}
export function canUseLiraKnowledgeSource(source,{today=new Date().toISOString().slice(0,10)}={}){
 if(!source||source.status!=='approved')return false
 if(source.effective_from&&source.effective_from>today)return false
 if(source.effective_to&&source.effective_to<today)return false
 return true
}
