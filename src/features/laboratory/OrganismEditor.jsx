import { Trash2 } from 'lucide-react'
import { useFeedback } from '../../core/feedback/FeedbackContext'

export function OrganismEditor({organisms,onChange,options,t,canClassify}){
  const {confirm,notify}=useFeedback()
  const rows=organisms?.length?organisms:[{name:'',resistance:''}]
  const update=(index,key,value)=>onChange(rows.map((row,i)=>i===index?{...row,[key]:value}:row))
  const add=()=>onChange([...rows,{name:'',resistance:''}])
  const remove=async index=>{
    const ok=await confirm({title:t('delete'),message:t('deleteConfirm'),confirmLabel:t('delete'),danger:true})
    if(!ok)return
    onChange(rows.filter((_,i)=>i!==index))
    notify(t('actionCompleted'),'success')
  }
  return <div className="organism-editor-list">{rows.map((row,index)=><div className="organism-editor-row" key={index}><input list="lab-microorganisms" value={row.name||''} onChange={e=>update(index,'name',e.target.value)} placeholder={t('organism')}/>{canClassify&&<select value={row.resistance||''} onChange={e=>update(index,'resistance',e.target.value)}><option value="">—</option><option>MDR</option><option>XDR</option><option>PDR</option></select>}{rows.length>1&&<button type="button" className="danger" title={t('delete')} onClick={()=>remove(index)}><Trash2 size={14}/></button>}<datalist id="lab-microorganisms">{options.map(option=><option key={option} value={option}/>)}</datalist></div>)}<button type="button" className="inline-add-button" onClick={add}>+ {t('laboratoryRecords.addOrganism')}</button></div>
}
