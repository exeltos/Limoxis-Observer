export const DEFAULT_TRAINER_FEEDBACK_TEMPLATE={
 id:'TRAINER-FEEDBACK-DEFAULT',
 titleEl:'Αξιολόγηση εκπαιδευτή',
 titleEn:'Trainer evaluation',
 questions:[
  {id:'clarity',labelEl:'Σαφήνεια παρουσίασης',labelEn:'Clarity of presentation'},
  {id:'knowledge',labelEl:'Γνώση και επάρκεια εκπαιδευτή',labelEn:'Trainer knowledge and competence'},
  {id:'usefulness',labelEl:'Χρησιμότητα για την εργασία μου',labelEn:'Usefulness for my work'},
  {id:'organization',labelEl:'Οργάνωση της εκπαίδευσης',labelEn:'Organization of the training'},
  {id:'materials',labelEl:'Ποιότητα εκπαιδευτικού υλικού',labelEn:'Quality of training material'},
 ],
}

export function normalizeTrainerFeedbackTemplate(value={}){
 const source=value&&typeof value==='object'?value:{}
 const questions=Array.isArray(source.questions)?source.questions:DEFAULT_TRAINER_FEEDBACK_TEMPLATE.questions
 return {
  id:source.id||DEFAULT_TRAINER_FEEDBACK_TEMPLATE.id,
  titleEl:source.titleEl||DEFAULT_TRAINER_FEEDBACK_TEMPLATE.titleEl,
  titleEn:source.titleEn||DEFAULT_TRAINER_FEEDBACK_TEMPLATE.titleEn,
  questions:questions.map((item,index)=>({
   id:item?.id||`feedback-${index+1}`,
   labelEl:String(item?.labelEl||item?.label||'').trim(),
   labelEn:String(item?.labelEn||item?.label||item?.labelEl||'').trim(),
  })).filter(item=>item.labelEl),
 }
}

export function trainerFeedbackQuestionsForProgram(program,language='el'){
 const template=normalizeTrainerFeedbackTemplate(program?.trainerFeedbackTemplate||DEFAULT_TRAINER_FEEDBACK_TEMPLATE)
 return template.questions.map(q=>({id:q.id,label:language==='en'?(q.labelEn||q.labelEl):q.labelEl}))
}
