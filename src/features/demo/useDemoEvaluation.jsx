import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { readSessionValue, removeSessionValue, writeSessionValue } from '../../core/storage/browserStorage'
import { DemoGuideDialog } from './DemoGuideDialog'
import { DemoApplicationDialog } from './DemoApplicationDialog'
import { DemoActiveScenario, DemoScenarioRating } from './DemoScenarioCards'
import { DEMO_SCENARIOS, demoScenarioDoneCount } from './demoScenarios'
import { DEMO_SCENARIO_EVENT, demoScenarioForPath, nextDemoScenario } from './demoScenarioSignals'
import { loadMyDemoApplicationRequests, loadMyDemoProgress, loadMyDemoRatings, rateDemoEvaluationStep, requestDemoApplication, setDemoEvaluationStep } from './demoEvaluationService'

const ACTIVE_KEY='lo.demo.activeScenario'
const OVERALL='guide_opened'
const scenarioByKey=key=>DEMO_SCENARIOS.find(scenario=>scenario.key===key)||null

const errorText=(error,en)=>/Too many requests/i.test(String(error?.message||''))
  ?(en?'You have already sent several requests today. We will contact you shortly.':'Έχετε ήδη στείλει αρκετά αιτήματα σήμερα. Θα επικοινωνήσουμε μαζί σας σύντομα.')
  :(en?'The request could not be sent. Please try again.':'Το αίτημα δεν στάλθηκε. Δοκιμάστε ξανά.')

// State of the Demo bar's guide and "I want the application" for the signed-in
// evaluator of a Demo organization. The guide opens by itself the first time.
// The Platform Owner looks at the guide without tracking progress.
// A scenario started from the guide stays beside the screen; when it is done
// (the screen signals it, its record opens, or "I'm done"), the evaluator is
// asked to rate it there and then, and after the last one to rate the whole.
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
  const [ratings,setRatings]=useState({})
  const [activeKey,setActiveKey]=useState(()=>readSessionValue(ACTIVE_KEY,null))
  const [ratingFor,setRatingFor]=useState(null) // scenario key, OVERALL, or null
  const {pathname}=useLocation()
  const state=useRef({progress,ratings,loaded});state.current={progress,ratings,loaded}
  // The first visit opens the guide, after the sign-in briefing has closed.
  const [autoOpen,setAutoOpen]=useState(false)
  useEffect(()=>{if(autoOpen&&!holdAutoOpen){setAutoOpen(false);setGuideOpen(true)}},[autoOpen,holdAutoOpen])

  useEffect(()=>{let active=true
    setLoaded(false)
    if(!tracks){setProgress({});setRatings({});setRequested(false);return undefined}
    Promise.all([loadMyDemoProgress(organizationId,userId),loadMyDemoApplicationRequests(organizationId,userId),loadMyDemoRatings(organizationId,userId).catch(()=>({}))]).then(([next,requests,rated])=>{
      if(!active)return
      setProgress(next);setRequested(requests.length>0);setRatings(rated);setLoaded(true)
      if(!next.guide_opened){setAutoOpen(true);setDemoEvaluationStep(organizationId,'guide_opened').then(value=>active&&setProgress(value)).catch(()=>{})}
    }).catch(()=>{if(active)setLoaded(true)})
    return ()=>{active=false}
  },[tracks,organizationId,userId])

  // "I did it" in the guide: the rating is asked once the guide closes.
  const toggleStep=useCallback(async(step,done)=>{if(!tracks)return;setWorking(true);try{setProgress(await setDemoEvaluationStep(organizationId,step,done));if(done&&!state.current.ratings[step])setRatingFor(step)}catch{/* the mark stays as it was */}finally{setWorking(false)}},[tracks,organizationId])
  const setActive=useCallback(key=>{setActiveKey(key);if(key)writeSessionValue(ACTIVE_KEY,key);else removeSessionValue(ACTIVE_KEY)},[])
  const openScenario=useCallback((scenario)=>{setGuideOpen(false);setRatingFor(null);if(tracks)setActive(scenario.key);navigate(scenario.to)},[navigate,tracks,setActive])

  // A scenario is completed: mark it and ask for its rating (once).
  const complete=useCallback(async(key)=>{
    if(!tracks||!state.current.loaded||!scenarioByKey(key))return
    const {progress:done,ratings:rated}=state.current
    setActiveKey(current=>{if(current===key){removeSessionValue(ACTIVE_KEY);return null}return current})
    if(!done[key]){try{setProgress(await setDemoEvaluationStep(organizationId,key,true))}catch{return}}
    if(!rated[key])setRatingFor(key)
  },[tracks,organizationId])
  useEffect(()=>{if(!tracks)return undefined;const listener=event=>void complete(event.detail?.key);window.addEventListener(DEMO_SCENARIO_EVENT,listener);return ()=>window.removeEventListener(DEMO_SCENARIO_EVENT,listener)},[tracks,complete])
  // Looking at a record completes its scenario only while that scenario is on.
  useEffect(()=>{const key=demoScenarioForPath(pathname);if(key&&key===activeKey&&loaded)void complete(key)},[pathname,activeKey,loaded,complete])

  const submitRating=useCallback(async(rating,comment)=>{if(!ratingFor)return;setWorking(true);try{setRatings(await rateDemoEvaluationStep(organizationId,ratingFor,rating,comment))}finally{setWorking(false)}},[organizationId,ratingFor])
  // After a scenario's rating (or "Later"): every scenario done and the guide
  // not yet rated → the overall rating.
  const closeRating=useCallback(()=>{setRatingFor(current=>current&&current!==OVERALL&&demoScenarioDoneCount(state.current.progress)===DEMO_SCENARIOS.length&&!state.current.ratings[OVERALL]?OVERALL:null)},[])
  const ratingScenario=ratingFor&&ratingFor!==OVERALL?scenarioByKey(ratingFor):null
  const nextScenario=ratingScenario?nextDemoScenario(ratingFor,progress):null
  const activeScenario=tracks&&activeKey&&!ratingFor&&!progress[activeKey]?scenarioByKey(activeKey):null
  const submitApplication=useCallback(async(values)=>{setWorking(true);setError('');try{const result=await requestDemoApplication(organizationId,values);setSentAt(result?.createdAt||new Date().toISOString());setRequested(true)}catch(caught){setError(errorText(caught,en))}finally{setWorking(false)}},[organizationId,en])

  const dialogs=<>
    {guideOpen&&<DemoGuideDialog language={language} progress={progress} ratings={ratings} onRate={tracks?key=>{setGuideOpen(false);setRatingFor(key)}:null} working={working} onOpenScenario={openScenario} onToggle={tracks?toggleStep:null} onClose={()=>setGuideOpen(false)}/>}
    {activeScenario&&!guideOpen&&<DemoActiveScenario scenario={activeScenario} language={language} working={working} onDone={()=>void complete(activeScenario.key)} onClose={()=>setActive(null)}/>}
    {tracks&&ratingFor&&!guideOpen&&!applicationOpen&&<DemoScenarioRating key={ratingFor} scenario={ratingScenario} next={nextScenario} language={language} working={working} canRequest={!requested}
      onSubmit={submitRating} onLater={closeRating} onNext={scenario=>{setRatingFor(null);openScenario(scenario)}} onRequestApplication={()=>{setRatingFor(null);setSentAt(null);setError('');setApplicationOpen(true)}}/>}
    {applicationOpen&&<DemoApplicationDialog language={language} organizationName={organizationName} defaultName={profile?.fullName||''} email={profile?.email||''} working={working} sentAt={sentAt} error={error} onSubmit={submitApplication} onClose={()=>{setApplicationOpen(false);setSentAt(null);setError('')}}/>}
  </>
  return {
    guideDone:demoScenarioDoneCount(progress),
    requested,
    canRequest:tracks,
    // Something of the evaluation is on screen or about to open (screen guides wait).
    busy:guideOpen||applicationOpen||autoOpen||Boolean(tracks&&ratingFor)||(tracks&&!loaded),
    openGuide:()=>setGuideOpen(true),
    openApplication:()=>{setSentAt(null);setError('');setApplicationOpen(true)},
    dialogs,
  }
}
