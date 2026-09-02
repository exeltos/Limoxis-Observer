export function LaboratoryStatus({text,kind}){
  return <span className={`status-badge status-${kind||'neutral'}`}>{text}</span>
}
