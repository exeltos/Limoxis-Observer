import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export { WHO_MOMENTS,WHO_PROFESSIONS } from './WhoHandHygieneEditor'

// Compatibility bridge for legacy callers in PreventionPage.
// Hand-hygiene create/edit is now a canonical routed screen, not a dialog/card.
export function WhoHandHygieneModal({initialRecord=null}){
 const navigate=useNavigate()
 useEffect(()=>{
  const target=initialRecord?.id
   ? `/prevention/handHygiene/${encodeURIComponent(initialRecord.id)}?edit=1`
   : '/prevention/handHygiene/new'
  navigate(target,{replace:false})
 },[initialRecord?.id,navigate])
 return null
}
