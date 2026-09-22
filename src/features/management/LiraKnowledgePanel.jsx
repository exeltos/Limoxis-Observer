import { useEffect,useState } from 'react'
import { BookOpen,CheckCircle2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { supabase } from '../../core/supabase/client'
export function LiraKnowledgePanel(){
 const {language}=useLanguage(),en=language==='en';const {tenant}=useTenant();const {notify}=useFeedback();const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true)
 async function load(){setLoading(true);const {data,error}=await supabase.from('lira_knowledge_sources').select('id,title,authority,source_version,status,ingestion_status,effective_from,effective_to,approved_at').order('authority');if(error)notify(error.message,'error');else setRows(data||[]);setLoading(false)}
 useEffect(()=>{load()},[tenant?.id])
 async function approve(id){const {error}=await supabase.rpc('approve_lira_knowledge_source',{p_source_id:id,p_review_notes:'Approved from LIRA Knowledge Center'});if(error)return notify(error.message,'error');notify(en?'Knowledge source approved.':'Η πηγή γνώσης εγκρίθηκε.','success');load()}
 return <section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>{en?'LIRA Knowledge':'Γνώση LIRA'}</h2><p>{en?'Governed clinical sources used by LIRA. Review sources before making them available to AI retrieval.':'Ελεγχόμενες κλινικές πηγές που χρησιμοποιεί η LIRA. Οι πηγές εγκρίνονται πριν διατεθούν στην ανάκτηση AI.'}</p></div><BookOpen size={22}/></div>
 {loading?<div className="inline-empty">{en?'Loading…':'Φόρτωση…'}</div>:<div className="management-table-wrap"><table className="management-table"><thead><tr><th>{en?'Authority':'Φορέας'}</th><th>{en?'Source':'Πηγή'}</th><th>{en?'Version':'Έκδοση'}</th><th>{en?'Status':'Κατάσταση'}</th><th>{en?'Ingestion':'Εισαγωγή'}</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.authority}</td><td>{x.title}</td><td>{x.source_version||'—'}</td><td>{x.status==='approved'?<span className="status-badge success"><CheckCircle2 size={13}/>{en?'Approved':'Εγκεκριμένη'}</span>:x.status}</td><td>{x.ingestion_status}</td><td>{x.status==='review'&&<Button variant="secondary" onClick={()=>approve(x.id)}>{en?'Approve':'Έγκριση'}</Button>}</td></tr>)}</tbody></table></div>}</section>
}
