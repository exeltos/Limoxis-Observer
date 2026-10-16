import { StatusBadge } from '../../design-system/StatusBadge'

// The one laboratory status label (sample status, result, result validation),
// on the shared StatusBadge: done / negative green, in progress blue,
// positive / critical / rejected red, anything else neutral.
const TONES={completed:'success',negative:'success',validated:'success',amended:'success',requested:'info',received:'info',processing:'info',draft:'info',positive:'danger',critical:'danger',rejected:'danger'}
export const laboratoryStatusTone=kind=>TONES[kind]||'neutral'

export function LaboratoryStatus({text,kind,tone}){
  return <StatusBadge tone={tone||laboratoryStatusTone(kind)}>{text}</StatusBadge>
}
