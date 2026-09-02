const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR')
const has=(text,terms)=>terms.some(term=>text.includes(normalize(term)))

export const LIRA_INTENTS=Object.freeze({
 OVERVIEW:'overview',COUNT:'count',STATUS:'status',TREND:'trend',COMPARISON:'comparison',RANKING:'ranking',CLUSTER:'cluster',OVERDUE:'overdue',EXPLANATION:'explanation',FOLLOW_UP:'follow_up',
})
export const LIRA_TOPICS=Object.freeze({
 INFECTIONS:'infections',AMR:'amr',LABORATORY:'laboratory',HAND_HYGIENE:'hand_hygiene',BUNDLES:'bundles',SURVEILLANCE:'surveillance',ISOLATION:'isolation',QUALITY:'quality',CAPA:'capa',INCIDENTS:'incidents',TRAINING:'training',DOCUMENTS:'documents',COMMITTEES:'committees',INDICATORS:'indicators',GENERAL:'general',
})

const topicRules=[
 [LIRA_TOPICS.AMR,['mdr','xdr','pdr','amr','ανθεκ','αντοχ']],
 [LIRA_TOPICS.HAND_HYGIENE,['υγιεινη χεριων','hand hygiene','αλκοολουχο','συμμορφωση χεριων']],
 [LIRA_TOPICS.BUNDLES,['bundle','bundles','δεσμη μετρων']],
 [LIRA_TOPICS.LABORATORY,['εργαστηρ','καλλιεργ','δειγμα','microbiology','laboratory','critical result','κρισιμο αποτελεσμα']],
 [LIRA_TOPICS.ISOLATION,['απομονωσ','isolation','precaution']],
 [LIRA_TOPICS.SURVEILLANCE,['επιτηρησ','surveillance','reassessment','επανεκτιμ']],
 [LIRA_TOPICS.CAPA,['capa','διορθωτικ','προληπτικη ενεργεια','corrective action']],
 [LIRA_TOPICS.INCIDENTS,['συμβαν','incident','adverse event']],
 [LIRA_TOPICS.QUALITY,['ποιοτητα','quality','audit','ευρημα','finding']],
 [LIRA_TOPICS.TRAINING,['εκπαιδευ','training','σεμιναρ']],
 [LIRA_TOPICS.DOCUMENTS,['εγγραφ','document','διαδικασ','πολιτικη']],
 [LIRA_TOPICS.COMMITTEES,['επιτροπ','committee','πρακτικ']],
 [LIRA_TOPICS.INDICATORS,['δεικτ','indicator','1000 patient','patient-days','patient days']],
 [LIRA_TOPICS.INFECTIONS,['λοιμωξ','infection','μικροοργαν','organism','klebsiella','acinetobacter','pseudomonas','enterococcus','staphylococcus']],
]

const intentFrom=text=>{
 if(has(text,['γιατι','why','εξηγησε','explain','τι σημαινει','πως προκυπτ']))return LIRA_INTENTS.EXPLANATION
 if(has(text,['συρρο','εξαρσ','outbreak','cluster','συσσωρευση']))return LIRA_INTENTS.CLUSTER
 if(has(text,['σε σχεση','συγκρι','compare','versus',' vs ','προηγουμεν','last month compared']))return LIRA_INTENTS.COMPARISON
 if(has(text,['αυξη','μειω','ταση','trend','increas','decreas','μεταβολ']))return LIRA_INTENTS.TREND
 if(has(text,['ποιο τμημα','ποια μοναδα','χειροτερ','καλυτερ','περισσοτερ','λιγοτερ','ranking','rank']))return LIRA_INTENTS.RANKING
 if(has(text,['εκπροθεσ','εκκρεμ','overdue','pending','καθυστερ']))return LIRA_INTENTS.OVERDUE
 if(has(text,['ποσοι','ποσες','ποσα','how many','count']))return LIRA_INTENTS.COUNT
 if(has(text,['κατασταση','status','ενεργ','active','ανοικτ','open']))return LIRA_INTENTS.STATUS
 if(has(text,['και στη','και σε','μονο για','μόνο για','what about','and in','και τον','και την']))return LIRA_INTENTS.FOLLOW_UP
 return LIRA_INTENTS.OVERVIEW
}

const topicFrom=text=>topicRules.find(([,terms])=>has(text,terms))?.[0]||LIRA_TOPICS.GENERAL
const entityFrom=text=>{
 const organisms=['klebsiella','acinetobacter','pseudomonas','enterococcus','staphylococcus','candida','clostridioides','e. coli','escherichia coli','enterobacter']
 const found=organisms.find(x=>text.includes(x));if(found)return found
 const greek=[['κλεμπσιελλα','klebsiella'],['ακινετομπακτερ','acinetobacter'],['ψευδομοναδα','pseudomonas'],['εντεροκοκκο','enterococcus'],['σταφυλοκοκκο','staphylococcus']]
 return greek.find(([label])=>text.includes(label))?.[1]||null
}

export function interpretLiraQuestion(question,{scope={},previousPlan=null}={}){
 const text=normalize(question)
 const intent=intentFrom(text)
 const topic=topicFrom(text)
 const entity=entityFrom(text)
 const followUp=intent===LIRA_INTENTS.FOLLOW_UP||(!entity&&topic===LIRA_TOPICS.GENERAL&&Boolean(previousPlan))
 return {
  intent:followUp&&previousPlan?.intent?previousPlan.intent:intent,
  topic:topic===LIRA_TOPICS.GENERAL&&previousPlan?.topic?previousPlan.topic:topic,
  entity:entity||previousPlan?.entity||null,
  department:scope.department&&scope.department!=='all'?scope.department:(followUp?previousPlan?.department||'all':'all'),
  periodDays:scope.periodDays||((followUp&&previousPlan?.periodDays)?previousPlan.periodDays:0),
  comparison: intent===LIRA_INTENTS.COMPARISON||Boolean(previousPlan?.comparison&&followUp),
  followUp,
  rawQuestion:question,
 }
}

export function describeLiraPlan(plan,language='el'){
 const en=language==='en'
 const parts=[]
 if(plan.department&&plan.department!=='all')parts.push(plan.department)
 if(plan.entity)parts.push(plan.entity)
 if(plan.periodDays===1)parts.push(en?'today':'σήμερα')
 else if(plan.periodDays)parts.push(`${plan.periodDays} ${en?'days':'ημέρες'}`)
 const intentLabel={
  overview:en?'overview':'γενική εικόνα',count:en?'count':'πλήθος',status:en?'status':'κατάσταση',trend:en?'trend':'τάση',comparison:en?'comparison':'σύγκριση',ranking:en?'ranking':'κατάταξη',cluster:en?'cluster assessment':'αξιολόγηση συρροής',overdue:en?'overdue follow-up':'εκκρεμότητες',explanation:en?'explanation':'επεξήγηση',follow_up:en?'follow-up':'συνέχεια',
 }[plan.intent]
 if(intentLabel)parts.push(intentLabel)
 return parts.join(' · ')
}
