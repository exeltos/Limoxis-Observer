import { useEffect,useState } from 'react'

export function DataAccessStatus(){
  const [state,setState]=useState(null)
  useEffect(()=>{
    let timer
    const onOperation=(event)=>{
      clearTimeout(timer)
      const next=event.detail
      if(next?.status==='success'){timer=setTimeout(()=>setState(null),900);return}
      setState(next)
    }
    window.addEventListener('limoxis:data-operation',onOperation)
    return ()=>{clearTimeout(timer);window.removeEventListener('limoxis:data-operation',onOperation)}
  },[])
  if(!state)return null
  const greek=document.documentElement.lang!=='en'
  if(state.status==='loading')return <div className="data-access-state loading" role="status">{greek?'Φόρτωση δεδομένων…':'Loading data…'}</div>
  if(state.status==='saving')return <div className="data-access-state saving" role="status">{greek?'Αποθήκευση…':'Saving…'}</div>
  if(state.status==='error')return <div className="data-access-state error" role="alert">
    <span>{greek?'Η αποθήκευση/φόρτωση απέτυχε. Τα δεδομένα δεν θεωρούνται αποθηκευμένα.':'Load/save failed. Data is not considered saved.'}</span>
    {state.retry&&<button type="button" onClick={()=>state.retry()}>{greek?'Επανάληψη':'Retry'}</button>}
  </div>
  return null
}
