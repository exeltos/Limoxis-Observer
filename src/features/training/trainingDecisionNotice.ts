// The requester's notice when a participation request is answered (owner, 21/11/2026): a personal announcement
// (audience «user») in the bell. In a hospital the database writes it in Greek inside the decision
// (private.training_decide_participation, 20261231607000); the Demo adds the same text to its own announcements. The
// bell shows it in the user's language: the decision is in the link, the programme between « » in the title and the
// reason after «Αιτιολογία: » in the message.
export type TrainingDecision = 'accepted' | 'rejected'
export const TRAINING_DECISION_LINK = '/training?request='

export function trainingDecisionNoticeLink(requestId: string, decision: TrainingDecision) {
  return `${TRAINING_DECISION_LINK}${requestId}&decision=${decision}`
}

export function trainingDecisionNoticeText(decision: TrainingDecision, programTitle: string, reason: string, language: string) {
  const en = language === 'en', title = programTitle || ''
  if (decision === 'accepted') return en
    ? { title: `Your request for “${title}” was accepted`, message: 'The training now appears under “Mine”.' }
    : { title: `Η αίτησή σας για «${title}» εγκρίθηκε`, message: 'Η εκπαίδευση εμφανίζεται στις «Οι δικές μου».' }
  return en
    ? { title: `Your request for “${title}” was rejected`, message: `Reason: ${reason}` }
    : { title: `Η αίτησή σας για «${title}» απορρίφθηκε`, message: `Αιτιολογία: ${reason}` }
}

// The notice in the user's language, or null for any other announcement.
export function localizeTrainingDecisionNotice(item: { title?: string, message?: string, linkPath?: string }, language: string) {
  const link = String(item.linkPath || '')
  if (!link.startsWith(TRAINING_DECISION_LINK)) return null
  const decision = /[?&]decision=(accepted|rejected)\b/.exec(link)?.[1] as TrainingDecision | undefined
  if (!decision) return null
  const title = String(item.title || ''), open = title.indexOf('«'), close = title.lastIndexOf('»')
  const program = open >= 0 && close > open ? title.slice(open + 1, close) : ''
  const message = String(item.message || ''), reason = message.startsWith('Αιτιολογία: ') ? message.slice('Αιτιολογία: '.length) : message
  return trainingDecisionNoticeText(decision, program, reason, language)
}
