import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { readSessionJson, readSessionValue, removeSessionValue, writeSessionJson, writeSessionValue } from '../../core/storage/browserStorage'
import { DemoGuideDialog } from './DemoGuideDialog'
import { DemoApplicationDialog } from './DemoApplicationDialog'
import { DemoActiveScenario, DemoScenarioRating } from './DemoScenarioCards'
import { DemoStepSpotlight } from './DemoStepSpotlight'
import { DemoGuidedTour } from './DemoGuidedTour'
import { DemoWelcome } from './DemoWelcome'
import { demoTourStops, hasDemoTour } from './demoTours'
import { DEMO_ALL_SCENARIOS, demoScenarioDoneCount, demoScenariosForRole, demoStepsComplete } from './demoScenarios'
import { DEMO_SCENARIO_EVENT, DEMO_STEP_EVENT, demoScenarioForPath, nextDemoScenario } from './demoScenarioSignals'
import { hasExtendedDemoSchema, loadMyDemoApplicationRequests, loadMyDemoProgress, loadMyDemoRatings, rateDemoEvaluationStep, requestDemoApplication, setDemoEvaluationStep, submitDemoScenarioFeedback } from './demoEvaluationService'

const ACTIVE_KEY='lo.demo.activeScenario'
const STEPS_KEY='lo.demo.scenarioSteps'
const STARTED_KEY='lo.demo.scenarioStarted' // { scenario: started at (ms) }, for the time it took
const TOUR_KEY='lo.demo.tour' // the scenario whose guided tour is on
const OVERALL='guide_opened'
const scenarioByKey=key=>DEMO_ALL_SCENARIOS.find(scenario=>scenario.key===key)||null

const errorText=(error,en)=>/Too many requests/i.test(String(error?.message||''))
  ?(en?'You have already sent several requests today. We will contact you shortly.':'Έχετε ήδη στείλει αρκετά αιτήματα σήμερα. Θα επικοινωνήσουμε μαζί σας σύντομα.')
  :(en?'The request could not be sent. Please try again.':'Το αίτημα δεν στάλθηκε. Δοκιμάστε ξανά.')

// State of the Demo bar's guide and "I want the application" for the signed-in
// evaluator of a Demo organization. The guide opens by itself the first time.
// The Platform Owner goes through the same guide, scenario cards and ratings
// as a trial run: nothing is stored, and it ends with the session.
// A scenario started from the guide stays beside the screen; when it is done
// (the screen signals it, its record opens, or "I'm done"), the evaluator is
// asked to rate it there and then, and after the last one to rate the whole.
// The guide shows the scenarios of the evaluator's current role; a scenario
// with steps is done once its screens have checked off every step (kept for
// the session), or with "I'm done". The first visit opens a welcome that
// starts the guided tour of the role's first scenario; a scenario started from
// the guide runs its tour over the screen too, and can be toured again from its
// card.
export function useDemoEvaluation({enabled,organizationId,organizationName,userId,profile,isPlatformOwner,role=null,language,navigate,holdAutoOpen=false}){
  const en=language==='en'
  const flow=Boolean(enabled&&organizationId&&userId)
  const tracks=flow&&!isPlatformOwner
  const trial=flow&&Boolean(isPlatformOwner)
  const [progress,setProgress]=useState({})
  const [guideOpen,setGuideOpen]=useState(false)
  const [welcomeOpen,setWelcomeOpen]=useState(false)
  const [tourKey,setTourKeyState]=useState(()=>readSessionValue(TOUR_KEY,null))
  const [applicationOpen,setApplicationOpen]=useState(false)
  const [working,setWorking]=useState(false)
  const [sentAt,setSentAt]=useState(null)
  const [requested,setRequested]=useState(false)
  const [error,setError]=useState('')
  const [loaded,setLoaded]=useState(false)
  const [ratings,setRatings]=useState({})
  const [activeKey,setActiveKey]=useState(()=>readSessionValue(ACTIVE_KEY,null))
  const [ratingFor,setRatingFor]=useState(null) // scenario key, OVERALL, or null
  const [stepsDone,setStepsDone]=useState(()=>readSessionJson(STEPS_KEY,{})||{}) // { scenario: { step: true } }
  // Every role's scenarios once the database accepts their keys; the Platform
  // Owner's trial stores nothing, so it always sees them.
  const [extended,setExtended]=useState(false)
  const scenarios=useMemo(()=>demoScenariosForRole(role,{extended:extended||trial}),[role,extended,trial])
  const {pathname}=useLocation()
  const state=useRef({progress,ratings,loaded,activeKey,stepsDone,scenarios});state.current={progress,ratings,loaded,activeKey,stepsDone,scenarios}
  // The first visit opens the welcome, after the sign-in briefing has closed.
  const [autoOpen,setAutoOpen]=useState(false)
  useEffect(()=>{if(autoOpen&&!holdAutoOpen){setAutoOpen(false);setWelcomeOpen(true)}},[autoOpen,holdAutoOpen])

  useEffect(()=>{let active=true
    setLoaded(false)
    if(!tracks){setProgress({});setRatings({});setRequested(false);setLoaded(trial);return undefined}
    Promise.all([loadMyDemoProgress(organizationId,userId),loadMyDemoApplicationRequests(organizationId,userId),loadMyDemoRatings(organizationId,userId).catch(()=>({}))]).then(([next,requests,rated])=>{
      if(!active)return
      setProgress(next);setRequested(requests.length>0);setRatings(rated);setExtended(hasExtendedDemoSchema()===true);setLoaded(true)
      if(!next.guide_opened){setAutoOpen(true);setDemoEvaluationStep(organizationId,'guide_opened').then(value=>active&&setProgress(value)).catch(()=>{})}
    }).catch(()=>{if(active)setLoaded(true)})
    return ()=>{active=false}
  },[tracks,trial,organizationId,userId])

  // "I did it" in the guide: the rating is asked once the guide closes.
  const toggleStep=useCallback(async(step,done)=>{if(!flow)return
    if(trial){setProgress(current=>{const next={...current};if(done)next[step]=new Date().toISOString();else delete next[step];return next});if(done&&!state.current.ratings[step])setRatingFor(step);return}
    setWorking(true);try{setProgress(await setDemoEvaluationStep(organizationId,step,done));if(done&&!state.current.ratings[step])setRatingFor(step)}catch{/* the mark stays as it was */}finally{setWorking(false)}},[flow,trial,organizationId])
  const setActive=useCallback(key=>{setActiveKey(key);if(key)writeSessionValue(ACTIVE_KEY,key);else removeSessionValue(ACTIVE_KEY)},[])
  const setTourKey=useCallback(key=>{setTourKeyState(key);if(key)writeSessionValue(TOUR_KEY,key);else removeSessionValue(TOUR_KEY)},[])
  const openScenario=useCallback((scenario)=>{setGuideOpen(false);setWelcomeOpen(false);setRatingFor(null);if(flow){setActive(scenario.key);setTourKey(hasDemoTour(scenario.key)?scenario.key:null);const started=readSessionJson(STARTED_KEY,{})||{};if(!started[scenario.key])writeSessionJson(STARTED_KEY,{...started,[scenario.key]:Date.now()})}navigate(scenario.to)},[navigate,flow,setActive,setTourKey])

  // A scenario is completed: mark it and ask for its rating (once).
  const complete=useCallback(async(key)=>{
    if(!flow||!state.current.loaded||!scenarioByKey(key))return
    const {progress:done,ratings:rated}=state.current
    setActiveKey(current=>{if(current===key){removeSessionValue(ACTIVE_KEY);return null}return current})
    setStepsDone(current=>{if(!current[key])return current;const next={...current};delete next[key];writeSessionJson(STEPS_KEY,next);return next})
    if(!done[key]){if(trial)setProgress(current=>({...current,[key]:new Date().toISOString()}));else try{setProgress(await setDemoEvaluationStep(organizationId,key,true))}catch{return}}
    if(!rated[key])setRatingFor(key)
  },[flow,trial,organizationId])
  useEffect(()=>{if(!flow)return undefined;const listener=event=>void complete(event.detail?.key);window.addEventListener(DEMO_SCENARIO_EVENT,listener);return ()=>window.removeEventListener(DEMO_SCENARIO_EVENT,listener)},[flow,complete])
  // A step counts only for the scenario on: when its last step is done, so is the scenario.
  const markStep=useCallback((key,step)=>{
    const {activeKey:current,stepsDone:done,loaded:ready}=state.current
    const scenario=scenarioByKey(key)
    if(!flow||!ready||key!==current||!scenario?.steps?.some(item=>item.id===step)||done[key]?.[step])return
    const next={...done,[key]:{...done[key],[step]:true}}
    setStepsDone(next);writeSessionJson(STEPS_KEY,next)
    if(demoStepsComplete(scenario,next[key]))void complete(key)
  },[flow,complete])
  useEffect(()=>{if(!flow)return undefined;const listener=event=>markStep(event.detail?.key,event.detail?.step);window.addEventListener(DEMO_STEP_EVENT,listener);return ()=>window.removeEventListener(DEMO_STEP_EVENT,listener)},[flow,markStep])
  // Looking at a record completes its scenario only while that scenario is on;
  // for a scenario with steps it checks off the record step.
  useEffect(()=>{const key=demoScenarioForPath(pathname);if(!key||key!==activeKey||!loaded)return
    const routeStep=scenarioByKey(key)?.steps?.find(step=>step.route===true)
    if(routeStep)markStep(key,routeStep.id);else void complete(key)},[pathname,activeKey,loaded,complete,markStep])
  // Steps that are a screen to open (`route` a pattern) are checked off when it opens.
  useEffect(()=>{if(!activeKey||!loaded)return
    for(const step of scenarioByKey(activeKey)?.steps||[])if(step.route instanceof RegExp&&step.route.test(pathname))markStep(activeKey,step.id)},[pathname,activeKey,loaded,markStep])

  // The questionnaire: usefulness, ease, clarity, comment, and the seconds since
  // the scenario was started from the guide (none for the overall rating).
  const submitRating=useCallback(async(rating,comment,{ease=null,clarity=null}={})=>{if(!ratingFor)return
    const started=ratingFor!==OVERALL?(readSessionJson(STARTED_KEY,{})||{})[ratingFor]:null
    const durationSeconds=started?Math.round((Date.now()-started)/1000):null
    const answer={rating,comment,ease,clarity,durationSeconds}
    if(trial){setRatings(current=>({...current,[ratingFor]:answer}));return}
    setWorking(true);try{setRatings(ratingFor===OVERALL?await rateDemoEvaluationStep(organizationId,ratingFor,rating,comment):await submitDemoScenarioFeedback(organizationId,ratingFor,answer))}finally{setWorking(false)}},[organizationId,ratingFor,trial])
  // After a scenario's rating (or "Later"): every scenario done and the guide
  // not yet rated → the overall rating.
  const closeRating=useCallback(()=>{setRatingFor(current=>current&&current!==OVERALL&&demoScenarioDoneCount(state.current.progress,state.current.scenarios)===state.current.scenarios.length&&!state.current.ratings[OVERALL]?OVERALL:null)},[])
  const ratingScenario=ratingFor&&ratingFor!==OVERALL?scenarioByKey(ratingFor):null
  const nextScenario=ratingScenario?nextDemoScenario(ratingFor,progress,scenarios):null
  const activeScenario=flow&&activeKey&&!ratingFor&&!progress[activeKey]?scenarioByKey(activeKey):null
  // The next step not yet done is outlined on screen, when the screen marks it.
  const nextStep=activeScenario?.steps?.find(step=>!stepsDone[activeScenario.key]?.[step.id])||null
  // The guided tour of the active scenario, over the steps not yet done.
  const tourStops=activeScenario&&tourKey===activeScenario.key?demoTourStops(activeScenario.key,stepsDone[activeScenario.key]||{}):[]
  const touring=tourStops.length>0&&!guideOpen
  const tourStepIndex=activeScenario?.steps?.findIndex(step=>step.id===tourStops[0]?.step)??-1
  const spotlight=activeScenario&&nextStep?.target&&!guideOpen&&!touring?`${activeScenario.key}:${nextStep.id}`:null
  const submitApplication=useCallback(async(values)=>{setWorking(true);setError('');try{const result=await requestDemoApplication(organizationId,values);setSentAt(result?.createdAt||new Date().toISOString());setRequested(true)}catch(caught){setError(errorText(caught,en))}finally{setWorking(false)}},[organizationId,en])

  const dialogs=<>
    {guideOpen&&<DemoGuideDialog language={language} scenarios={scenarios} progress={progress} ratings={ratings} onRate={flow?key=>{setGuideOpen(false);setRatingFor(key)}:null} working={working} onOpenScenario={openScenario} onToggle={flow?toggleStep:null} onClose={()=>setGuideOpen(false)}/>}
    {welcomeOpen&&<DemoWelcome language={language} organizationName={organizationName} scenarios={scenarios} onTour={openScenario} onScenarios={()=>{setWelcomeOpen(false);setGuideOpen(true)}}/>}
    <DemoStepSpotlight target={spotlight}/>
    {touring&&<DemoGuidedTour key={`${activeScenario.key}:${tourStops.length}`} scenario={activeScenario} stops={tourStops} stepNumber={tourStepIndex+1} stepTotal={tourStepIndex>=0?activeScenario.steps.length:0} language={language} onClose={()=>setTourKey(null)} onFinish={()=>setTourKey(null)}/>}
    {activeScenario&&!guideOpen&&!touring&&<DemoActiveScenario scenario={activeScenario} scenarios={scenarios} stepsDone={stepsDone[activeScenario.key]||{}} language={language} trial={trial} working={working} onDone={()=>void complete(activeScenario.key)} onClose={()=>setActive(null)} onTour={hasDemoTour(activeScenario.key)?()=>setTourKey(activeScenario.key):null}/>}
    {flow&&ratingFor&&!guideOpen&&!applicationOpen&&<DemoScenarioRating key={ratingFor} scenario={ratingScenario} next={nextScenario} language={language} trial={trial} working={working} canRequest={tracks&&!requested}
      onSubmit={submitRating} onLater={closeRating} onNext={scenario=>{setRatingFor(null);openScenario(scenario)}} onRequestApplication={()=>{setRatingFor(null);setSentAt(null);setError('');setApplicationOpen(true)}}/>}
    {applicationOpen&&<DemoApplicationDialog language={language} organizationName={organizationName} defaultName={profile?.fullName||''} email={profile?.email||''} working={working} sentAt={sentAt} error={error} onSubmit={submitApplication} onClose={()=>{setApplicationOpen(false);setSentAt(null);setError('')}}/>}
  </>
  return {
    guideDone:demoScenarioDoneCount(progress,scenarios),
    guideTotal:scenarios.length,
    requested,
    canRequest:tracks,
    // Something of the evaluation is on screen or about to open (screen guides wait).
    busy:guideOpen||welcomeOpen||applicationOpen||autoOpen||Boolean(flow&&ratingFor)||(tracks&&!loaded),
    openGuide:()=>setGuideOpen(true),
    openApplication:()=>{setSentAt(null);setError('');setApplicationOpen(true)},
    dialogs,
  }
}
