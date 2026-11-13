import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { useLocation } from 'react-router-dom'
import { readSessionJson, readSessionValue, removeSessionValue, writeSessionJson, writeSessionValue } from '../../core/storage/browserStorage'
import { lazyPage, type LazyPage } from '../../core/errors/chunkRecovery'
import { DEMO_ALL_SCENARIOS, demoScenarioDoneCount, demoScenariosForRole, demoStepsComplete, type DemoScenario } from './demoScenarios'
import { DEMO_SCENARIO_EVENT, DEMO_STEP_EVENT, demoScenarioForPath, nextDemoScenario } from './demoScenarioSignals'
import { hasExtendedDemoSchema, loadMyDemoApplicationRequests, loadMyDemoProgress, loadMyDemoRatings, rateDemoEvaluationStep, requestDemoApplication, setDemoEvaluationStep, submitDemoScenarioFeedback, type DemoRating } from './demoEvaluationService'

const ACTIVE_KEY='lo.demo.activeScenario'
const STEPS_KEY='lo.demo.scenarioSteps'
const STARTED_KEY='lo.demo.scenarioStarted' // { scenario: started at (ms) }, for the time it took
const TOUR_KEY='lo.demo.tour' // the scenario whose guided tour is on
// The evaluation's windows and the tours load when a Demo evaluation is on, never for a hospital.
// Each window has its own boundary: one that is still loading must not hide the others.
// The window's own props, from its module (the lazy page itself takes any).
const alone=<P extends object>(Lazy: LazyPage)=>function Alone(props: P){return <Suspense fallback={null}><Lazy {...props}/></Suspense>}
const DemoGuideDialog=alone<ComponentProps<typeof import('./DemoGuideDialog')['DemoGuideDialog']>>(lazyPage(()=>import('./DemoGuideDialog').then(({DemoGuideDialog})=>({DemoGuideDialog})),'DemoGuideDialog'))
const DemoApplicationDialog=alone<ComponentProps<typeof import('./DemoApplicationDialog')['DemoApplicationDialog']>>(lazyPage(()=>import('./DemoApplicationDialog'),'DemoApplicationDialog'))
const DemoActiveScenario=alone<ComponentProps<typeof import('./DemoScenarioCards')['DemoActiveScenario']>>(lazyPage(()=>import('./DemoScenarioCards'),'DemoActiveScenario'))
const DemoScenarioRating=alone<ComponentProps<typeof import('./DemoScenarioCards')['DemoScenarioRating']>>(lazyPage(()=>import('./DemoScenarioCards'),'DemoScenarioRating'))
const DemoStepSpotlight=alone<ComponentProps<typeof import('./DemoStepSpotlight')['DemoStepSpotlight']>>(lazyPage(()=>import('./DemoStepSpotlight'),'DemoStepSpotlight'))
const DemoGuidedTour=alone<ComponentProps<typeof import('./DemoGuidedTour')['DemoGuidedTour']>>(lazyPage(()=>import('./DemoGuidedTour'),'DemoGuidedTour'))
const DemoWelcome=alone<ComponentProps<typeof import('./DemoWelcome')['DemoWelcome']>>(lazyPage(()=>import('./DemoWelcome'),'DemoWelcome'))
const OVERALL='guide_opened' // as OVERALL_RATING in DemoGuideDialog
const scenarioByKey=(key: string|null|undefined): DemoScenario|null=>DEMO_ALL_SCENARIOS.find(scenario=>scenario.key===key)||null

const errorText=(error: unknown,en: boolean)=>/Too many requests/i.test(String((error as {message?: string}|null)?.message||''))
  ?(en?'You have already sent several requests today. We will contact you shortly.':'Έχετε ήδη στείλει αρκετά αιτήματα σήμερα. Θα επικοινωνήσουμε μαζί σας σύντομα.')
  :(en?'The request could not be sent. Please try again.':'Το αίτημα δεν στάλθηκε. Δοκιμάστε ξανά.')

// State of the Demo bar's guide and "I want the application" for the signed-in
// evaluator of a Demo organization. The guide opens by itself the first time.
// The Platform Owner goes through the same guide, scenario cards and ratings
// as a trial run: nothing is stored, and it ends with the session.
// A scenario started from the guide stays beside the screen; when it is done
// (the screen signals it or its record opens; a quiet link covers what a
// screen could not tell), a card in front of the screen asks for its rating there
// and then, and after the last one for the whole.
// The guide shows the scenarios of the evaluator's current role; a scenario
// with steps is done once its screens have checked off every step (kept for
// the session). The first visit opens a welcome that
// starts the guided tour of the role's first scenario; a scenario started from
// the guide runs its tour over the screen too, and can be toured again from its
// card.
type Answer={rating: number,comment: string,ease: number|null,clarity: number|null,durationSeconds: number|null}
type StepsDone=Record<string, Record<string, boolean>>
interface DemoEvaluationOptions {enabled: boolean,organizationId: string|null|undefined,organizationName: string,userId: string|null|undefined,profile?: {fullName?: string|null,email?: string|null}|null,isPlatformOwner?: boolean,role?: string|null,language: string,navigate: (to: string)=>void,holdAutoOpen?: boolean}

export function useDemoEvaluation({enabled,organizationId,organizationName,userId,profile,isPlatformOwner,role=null,language,navigate,holdAutoOpen=false}: DemoEvaluationOptions){
  const en=language==='en'
  const flow=Boolean(enabled&&organizationId&&userId)
  const tracks=flow&&!isPlatformOwner
  const trial=flow&&Boolean(isPlatformOwner)
  // The guided tours (their stops are a large table) load once a Demo evaluation runs.
  const [tours,setTours]=useState<typeof import('./demoTours')|null>(null)
  useEffect(()=>{if(!flow||tours)return undefined;let active=true;import('./demoTours').then(module=>{if(active)setTours(module)}).catch(()=>{});return()=>{active=false}},[flow,tours])
  const hasDemoTour=useCallback((key: string)=>Boolean(tours?.hasDemoTour(key)),[tours])
  const [progress,setProgress]=useState<Record<string, unknown>>({})
  const [guideOpen,setGuideOpen]=useState(false)
  const [welcomeOpen,setWelcomeOpen]=useState(false)
  const [tourKey,setTourKeyState]=useState<string|null>(()=>readSessionValue(TOUR_KEY,null))
  const [applicationOpen,setApplicationOpen]=useState(false)
  const [working,setWorking]=useState(false)
  const [sentAt,setSentAt]=useState<string|null>(null)
  const [requested,setRequested]=useState(false)
  const [error,setError]=useState('')
  const [loaded,setLoaded]=useState(false)
  const [ratings,setRatings]=useState<Record<string, DemoRating|Answer|unknown>>({})
  const [activeKey,setActiveKey]=useState<string|null>(()=>readSessionValue(ACTIVE_KEY,null))
  const [ratingFor,setRatingFor]=useState<string|null>(null) // scenario key, OVERALL, or null
  const [stepsDone,setStepsDone]=useState<StepsDone>(()=>readSessionJson(STEPS_KEY,{})||{}) // { scenario: { step: true } }
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

  const setActive=useCallback((key: string|null)=>{setActiveKey(key);if(key)writeSessionValue(ACTIVE_KEY,key);else removeSessionValue(ACTIVE_KEY)},[])
  const setTourKey=useCallback((key: string|null)=>{setTourKeyState(key);if(key)writeSessionValue(TOUR_KEY,key);else removeSessionValue(TOUR_KEY)},[])
  const openScenario=useCallback((scenario: DemoScenario)=>{setGuideOpen(false);setWelcomeOpen(false);setRatingFor(null);if(flow){setActive(scenario.key);setTourKey(scenario.key);const started=readSessionJson(STARTED_KEY,{})||{};if(!started[scenario.key])writeSessionJson(STARTED_KEY,{...started,[scenario.key]:Date.now()})}navigate(scenario.to)},[navigate,flow,setActive,setTourKey])

  // A scenario is completed: mark it and ask for its rating (once).
  const complete=useCallback(async(key: string)=>{
    if(!flow||!state.current.loaded||!scenarioByKey(key))return
    const {progress:done,ratings:rated}=state.current
    setActiveKey(current=>{if(current===key){removeSessionValue(ACTIVE_KEY);return null}return current})
    setStepsDone(current=>{if(!current[key])return current;const next={...current};delete next[key];writeSessionJson(STEPS_KEY,next);return next})
    if(!done[key]){if(trial)setProgress(current=>({...current,[key]:new Date().toISOString()}));else try{setProgress(await setDemoEvaluationStep(organizationId,key,true))}catch{return}}
    if(!rated[key])setRatingFor(key)
  },[flow,trial,organizationId])
  useEffect(()=>{if(!flow)return undefined;const listener=(event: Event)=>void complete((event as CustomEvent).detail?.key);window.addEventListener(DEMO_SCENARIO_EVENT,listener);return ()=>window.removeEventListener(DEMO_SCENARIO_EVENT,listener)},[flow,complete])
  // A step counts only for the scenario on: when its last step is done, so is the scenario.
  const markStep=useCallback((key: string,step: string)=>{
    const {activeKey:current,stepsDone:done,loaded:ready}=state.current
    const scenario=scenarioByKey(key)
    if(!flow||!ready||key!==current||!scenario?.steps?.some(item=>item.id===step)||done[key]?.[step])return
    const next={...done,[key]:{...done[key],[step]:true}}
    setStepsDone(next);writeSessionJson(STEPS_KEY,next)
    if(demoStepsComplete(scenario,next[key]))void complete(key)
  },[flow,complete])
  useEffect(()=>{if(!flow)return undefined;const listener=(event: Event)=>markStep((event as CustomEvent).detail?.key,(event as CustomEvent).detail?.step);window.addEventListener(DEMO_STEP_EVENT,listener);return ()=>window.removeEventListener(DEMO_STEP_EVENT,listener)},[flow,markStep])
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
  const submitRating=useCallback(async(rating: number,comment: string,{ease=null,clarity=null}:{ease?: number|null,clarity?: number|null}={})=>{if(!ratingFor)return
    const started=ratingFor!==OVERALL?(readSessionJson(STARTED_KEY,{})||{})[ratingFor]:null
    const durationSeconds=started?Math.round((Date.now()-started)/1000):null
    const answer: Answer={rating,comment,ease,clarity,durationSeconds}
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
  const tourStops=tours&&activeScenario&&tourKey===activeScenario.key?tours.demoTourStops(activeScenario.key,stepsDone[activeScenario.key]||{}):[]
  const touring=tourStops.length>0&&!guideOpen
  const tourStepIndex=activeScenario?.steps?.findIndex(step=>step.id===tourStops[0]?.step)??-1
  const spotlight=activeScenario&&nextStep?.target&&!guideOpen&&!touring?`${activeScenario.key}:${nextStep.id}`:null
  const submitApplication=useCallback(async(values: {contactName: string,contactPhone?: string,message?: string})=>{setWorking(true);setError('');try{const result=await requestDemoApplication(organizationId,values);setSentAt((result as {createdAt?: string}|null)?.createdAt||new Date().toISOString());setRequested(true)}catch(caught){setError(errorText(caught,en))}finally{setWorking(false)}},[organizationId,en])

  const dialogs=<>
    {guideOpen&&<DemoGuideDialog language={language} scenarios={scenarios} progress={progress} ratings={ratings} stepsDone={stepsDone} activeKey={activeKey} onRate={flow?(key: string)=>{setGuideOpen(false);setRatingFor(key)}:null} onOpenScenario={openScenario} onClose={()=>setGuideOpen(false)}/>}
    {welcomeOpen&&<DemoWelcome language={language} organizationName={organizationName} scenarios={scenarios} onTour={openScenario} onScenarios={()=>{setWelcomeOpen(false);setGuideOpen(true)}}/>}
    <DemoStepSpotlight target={spotlight}/>
    {touring&&activeScenario&&tours&&<DemoGuidedTour key={`${activeScenario.key}:${tourStops.length}`} scenario={activeScenario} stops={tourStops} totalStops={tours.DEMO_TOURS[activeScenario.key].length} stepNumber={tourStepIndex+1} stepTotal={tourStepIndex>=0?activeScenario.steps?.length??0:0} language={language} onClose={()=>setTourKey(null)} onFinish={()=>setTourKey(null)}/>}
    {activeScenario&&!guideOpen&&!touring&&<DemoActiveScenario scenario={activeScenario} scenarios={scenarios} stepsDone={stepsDone[activeScenario.key]||{}} language={language} trial={trial} working={working} onDone={()=>void complete(activeScenario.key)} onClose={()=>setActive(null)} onTour={hasDemoTour(activeScenario.key)?()=>setTourKey(activeScenario.key):null}/>}
    {flow&&ratingFor&&!guideOpen&&!applicationOpen&&<DemoScenarioRating key={ratingFor} scenario={ratingScenario} next={nextScenario} language={language} trial={trial} working={working} canRequest={tracks&&!requested}
      onSubmit={submitRating} onLater={closeRating} onNext={(scenario: DemoScenario)=>{setRatingFor(null);openScenario(scenario)}} onRequestApplication={()=>{setRatingFor(null);setSentAt(null);setError('');setApplicationOpen(true)}}/>}
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
