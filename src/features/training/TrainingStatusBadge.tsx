import { useLanguage } from '../../core/i18n/LanguageContext'

// The status of a programme or an assignment, in Greek and English (the programmes' list, the record, «Οι δικές μου»).
export const trainingStatusLabels: Record<string, [string, string]>={active:['Ενεργό','Active'],planned:['Προγραμματισμένο','Planned'],completed:['Ολοκληρωμένο','Completed'],assigned:['Ανατέθηκε','Assigned'],in_progress:['Σε εξέλιξη','In progress'],overdue:['Εκπρόθεσμο','Overdue'],cancelled:['Ακυρώθηκε','Cancelled']}
export function TrainingStatusBadge({status}: {status: string}){const {language}=useLanguage(),en=language==='en';return <span className={`status-badge ${status==='active'||status==='completed'?'active':''} ${status==='overdue'||status==='cancelled'?'danger':''}`.trim()}>{trainingStatusLabels[status]?.[en?1:0]||status||'—'}</span>}
