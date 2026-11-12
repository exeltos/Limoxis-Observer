// Controls whose name is the same in essence as the one being typed: the same words in another
// order, with another case, accents or punctuation, or with a few words more or less. A new control
// with such a name is usually a department that should be added to the existing control instead.
const STOP=new Set(['και','του','της','των','το','η','ο','τα','στο','στη','στα','σε','για','απο','με','the','of','and','for'])

export function nameTokens(title){
 return String(title||'')
  .toLocaleLowerCase('el')
  .normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/ς/g,'σ')
  .replace(/[^\p{L}\p{N}]+/gu,' ')
  .split(' ')
  .filter(word=>word&&!STOP.has(word))
}

function overlap(a,b){
 if(!a.length||!b.length)return 0
 const set=new Set(b)
 const shared=a.filter(word=>set.has(word)).length
 return shared/new Set([...a,...b]).size
}

// The existing controls whose name is the same or alike, the same ones first. Needs two words
// (or the whole name) in common so that «Θερμοκρασία» alone does not flag every temperature control.
export function similarControls(title,controls=[],{selfId=''}={}){
 const tokens=nameTokens(title)
 if(tokens.join('').length<5)return []
 const key=tokens.slice().sort().join(' ')
 return controls
  .filter(control=>control&&control.id!==selfId&&control.dbId!==selfId&&control.status!=='archived')
  .map(control=>{
   const other=nameTokens(control.title)
   const same=other.slice().sort().join(' ')===key
   const score=same?1:overlap(tokens,other)
   return {control,same,score}
  })
  .filter(({same,score})=>same||score>=0.75)
  .sort((a,b)=>b.score-a.score)
  .slice(0,3)
}
