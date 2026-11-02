import './RecordFacts.css'

// The key figures of a record tab as one quiet line of text («5/5 forms sent · 88% average»):
// what the cards above a list used to say, without taking the height of cards.
export function RecordFacts({items=[],label}){
  const shown=items.filter(item=>item&&item.value!=null&&item.value!=='')
  if(!shown.length)return null
  return <p className="record-facts" aria-label={label}>{shown.map(item=><span key={item.label}><b>{item.value}</b> {item.label}</span>)}</p>
}
