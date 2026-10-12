import { BookOpen,ExternalLink } from 'lucide-react'
import './liraPassages.css'

// Passages LIRA found in its approved knowledge, each with its source. Shown
// without a provider key; with one, the written answer cites them.
export function LiraPassages({passages,en}){
 if(!passages?.length)return null
 return <div className="lira-passages">{passages.map(p=><blockquote className="lira-passage" key={p.chunkId}>
  <p>{p.excerpt}</p>
  <footer><BookOpen size={12} aria-hidden="true"/><span title={p.title}>{String(p.label||'').startsWith(p.authority)?p.label:`${p.authority} · ${p.label}`}{p.pageStart?` · ${en?'p.':'σελ.'} ${p.pageStart}`:''}</span>{p.url&&<a href={p.url} target="_blank" rel="noreferrer" aria-label={en?`Open source: ${p.title}`:`Άνοιγμα πηγής: ${p.title}`}><ExternalLink size={12}/></a>}</footer>
 </blockquote>)}</div>
}

export function LiraModeBadge({item,en}){
 if(item.ai)return <span className="lira-mode-badge ai">{en?'Written with AI':'Με σύνθεση AI'}</span>
 if(item.passages?.length)return <span className="lira-mode-badge">{en?'Internal · no external service':'Εσωτερική λειτουργία'}</span>
 return null
}
