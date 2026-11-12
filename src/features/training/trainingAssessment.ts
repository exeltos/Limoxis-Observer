import type { AnyRecord } from '../../types/featureTypes'

export const TRAINING_ASSESSMENT_TYPES: Record<string, {el: string, en: string, scored: boolean}>={
 single_choice:{el:'Μία επιλογή',en:'Single choice',scored:true},
 multiple_choice:{el:'Πολλαπλή επιλογή',en:'Multiple choice',scored:true},
 true_false:{el:'Σωστό / Λάθος',en:'True / False',scored:true},
 free_text:{el:'Ελεύθερο κείμενο',en:'Free text',scored:false},
}

const makeId=(prefix: string)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
const choice=()=>({id:makeId('OPT'),text:'',correct:false})

// A question of the knowledge assessment.
export interface TrainingQuestion { id: string, type: string, text: string, points: number, required: boolean, options: {id: string, text: string, correct: boolean}[], correctBoolean: boolean, modelAnswer: string, manualReview: boolean }

export function createTrainingQuestion(type='single_choice'){
 const base: TrainingQuestion={id:makeId('Q'),type,text:'',points:1,required:true,options:[],correctBoolean:true,modelAnswer:'',manualReview:false}
 if(type==='single_choice'||type==='multiple_choice')base.options=[choice(),choice()]
 return base
}

export function normalizeTrainingQuestion(question: AnyRecord={}): TrainingQuestion{
 const type=TRAINING_ASSESSMENT_TYPES[question.type]?question.type:'single_choice'
 const normalized: TrainingQuestion={...createTrainingQuestion(type),...question,type,points:Math.max(0,Number(question.points)||0),required:question.required!==false,manualReview:Boolean(question.manualReview)}
 if(type==='single_choice'||type==='multiple_choice')normalized.options=(Array.isArray(question.options)?question.options:[]).map((option: AnyRecord)=>({id:option.id||makeId('OPT'),text:String(option.text||''),correct:Boolean(option.correct)}))
 else normalized.options=[]
 return normalized
}

export function trainingQuestionIsValid(question: AnyRecord){
 const q=normalizeTrainingQuestion(question)
 if(!q.text.trim())return false
 if(q.type==='single_choice'||q.type==='multiple_choice'){
  if(q.options.length<2||q.options.some(option=>!option.text.trim()))return false
  const correct=q.options.filter(option=>option.correct).length
  if(q.type==='single_choice'&&correct!==1)return false
  if(q.type==='multiple_choice'&&correct<1)return false
 }
 return q.points>=0
}

export function trainingAssessmentIsValid(questions: AnyRecord[]=[]){return questions.every(trainingQuestionIsValid)}
export function trainingAssessmentMaxScore(questions: (AnyRecord|null|undefined)[]=[]){return questions.reduce((sum,item)=>sum+(TRAINING_ASSESSMENT_TYPES[item?.type]?.scored?Math.max(0,Number(item?.points)||0):0),0)}
export function trainingAssessmentTypeLabel(type: string,language='el'){const meta=TRAINING_ASSESSMENT_TYPES[type]||TRAINING_ASSESSMENT_TYPES.single_choice;return meta[language==='en'?'en':'el']}
export function addTrainingQuestionOption(question: AnyRecord){const q=normalizeTrainingQuestion(question);return {...q,options:[...q.options,choice()]}}
export function removeTrainingQuestionOption(question: AnyRecord,optionId: string){const q=normalizeTrainingQuestion(question);return {...q,options:q.options.filter(option=>option.id!==optionId)}}
