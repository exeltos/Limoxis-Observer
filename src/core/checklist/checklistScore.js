// The answers of a checklist (a control entry, an audit): yes, no or not
// applicable; compliance is yes over the applicable answers.
export const CHECKLIST_ANSWERS=['yes','no','na']
export function checklistScore(rows=[]){
 const answered=rows.filter(row=>row.answer==='yes'||row.answer==='no')
 const yes=answered.filter(row=>row.answer==='yes').length
 return {applicable:answered.length,yes,no:answered.length-yes,unanswered:rows.filter(row=>!row.answer).length,rate:answered.length?Math.round(yes*100/answered.length):null}
}
export function checklistSummary(rows=[],language='el'){
 const {applicable,yes,rate}=checklistScore(rows)
 if(!applicable)return language==='en'?'No applicable items':'Κανένα εφαρμόσιμο σημείο'
 return language==='en'?`${yes}/${applicable} compliant (${rate}%)`:`${yes}/${applicable} συμμόρφωση (${rate}%)`
}
