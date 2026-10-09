import { useCallback, useEffect, useState } from 'react'
import { DemoGuideDialog } from './DemoGuideDialog'
import { DemoApplicationDialog } from './DemoApplicationDialog'
import { demoScenarioDoneCount } from './demoScenarios'
import { loadMyDemoApplicationRequests, loadMyDemoProgress, requestDemoApplication, setDemoEvaluationStep } from './demoEvaluationService'

const errorText=(error,en)=>/Too many requests/i.test(String(error?.message||''))
  ?(en?'You have already sent several requests today. We will contact you shortly.':'Έχετε ήδη στείλει αρκετά αιτήματα σήμερα. Θα επικοινωνήσουμε μαζί σας σύντομα.')
  :(en?'The request could not be sent. Please try again.':'Το αίτημα δεν στάλθηκε. Δοκιμάστε ξανά.')

// State of the Demo bar's guide and "I want the application" for the signed-in
// evaluator of a Demo organization. The guide opens by itself the first time.
// The Platform Owner looks at the guide without tracking progress.
export function useDemoEvaluation({enabled,organizationId,organizationName,userId,profile,isPlatformOwner,language,navigate,holdAutoOpen=false}){
  const en=language==='en'
  const tracks=Boolean(enabled&&organizationId&&userId&&!isPlatformOwner)
  const [progress,setProgress]=useState({})
  const [guideOpen,setGuideOpen]=useState(false)
  const [applicationOpen,setApplicationOpen]=useState(false)
  const [working,setWorking]=useState(false)
  const [sentAt,setSentAt]=useState(null)
  const [requested,setRequested]=useState(false)
  const [error,setError]=useState('')
  const [loaded,setLoaded]=useState(false)
  // The first visit opens the guide, after the sign-in briefing has closed.
  const [autoOpen,setAutoOpen]=useState(false)
  useEffect(()=>{if(autoOpen&&!holdAutoOpen){setAutoOpen(false);setGuideOpen(true)}},[autoOpen,holdAutoOpen])

  useEffect(()=>{let active=true
    setLoaded(false)
    if(!tracks){setProgress({});setRequested(false);return undefined}
    Promise.all([loadMyDemoProgress(organizationId,userId),loadMyDemoApplicationRequests(organizationId,userId)]).then(([next,requests])=>{
      if(!active)return
      setProgress(next);setRequested(requests.length>0);setLoaded(true)
      if(!next.guide_opened){setAutoOpen(true);setDemoEvaluationStep(organizationId,'guide_opened').then(value=>active&&setProgress(value)).catch(()=>{})}
    }).catch(()=>{if(active)setLoaded(true)})
    return ()=>{active=false}
  },[tracks,organizationId,userId])

  const toggleStep=useCallback(async(step,done)=>{if(!tracks)return;setWorking(true);try{setProgress(await setDemoEvaluationStep(organizationId,step,done))}catch{/* the mark stays as it was */}finally{setWorking(false)}},[tracks,organizationId])
  const openScenario=useCallback((scenario)=>{setGuideOpen(false);navigate(scenario.to)},[navigate])
  const submitApplication=useCallback(async(values)=>{setWorking(true);setError('');try{const result=await requestDemoApplication(organizationId,values);setSentAt(result?.createdAt||new Date().toISOString());setRequested(true)}catch(caught){setError(errorText(caught,en))}finally{setWorking(false)}},[organizationId,en])

  const dialogs=<>
    {guideOpen&&<DemoGuideDialog language={language} progress={progress} working={working} onOpenScenario={openScenario} onToggle={tracks?toggleStep:null} onClose={()=>setGuideOpen(false)}/>}
    {applicationOpen&&<DemoApplicationDialog language={language} organizationName={organizationName} defaultName={profile?.fullName||''} email={profile?.email||''} working={working} sentAt={sentAt} error={error} onSubmit={submitApplication} onClose={()=>{setApplicationOpen(false);setSentAt(null);setError('')}}/>}
  </>
  return {
    guideDone:demoScenarioDoneCount(progress),
    requested,
    canRequest:tracks,
    // Something of the evaluation is on screen or about to open (screen guides wait).
    busy:guideOpen||applicationOpen||autoOpen||(tracks&&!loaded),
    openGuide:()=>setGuideOpen(true),
    openApplication:()=>{setSentAt(null);setError('');setApplicationOpen(true)},
    dialogs,
  }
}
