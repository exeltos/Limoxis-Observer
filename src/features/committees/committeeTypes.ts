// Τύποι των Επιτροπών: η επιτροπή με τα μέλη, τις συνεδριάσεις (θέματα, παρουσίες, εγκρίσεις
// πρακτικών), τις αποφάσεις, το ετήσιο σχέδιο, τα έγγραφα και το ιστορικό της, όπως τα
// διαβάζει η υπηρεσία (committeeService: fromRow και οι βοηθοί του) και όπως τα κρατά το demo
// (committeeData). Τα πεδία που λείπουν από τα δεδομένα του demo είναι προαιρετικά.
// Οι τύποι είναι `type` (όχι interface) ώστε να περνούν σε Record<string, unknown> και Json.
import type { Tables } from '../../core/supabase/database.types'

export type CommitteeMember = {
  id: string
  dbId?: string
  userId?: string | null
  employeeId?: string
  employeeDbId?: string | null
  name: string
  department?: string
  profession?: string
  email?: string
  committeeTitle?: string
  roles?: string[]
  inControlTeam?: boolean
  specialty?: string
  responsibilities?: string
  voting?: boolean
  memberType?: string
  approvalRequired?: boolean
  approvalStatus?: string
  external?: boolean
  active?: boolean
  startedAt?: string | null
  endedAt?: string | null
  endReason?: string
}

// Ένα θέμα της ημερήσιας διάταξης με την απόφασή του (αποθηκεύεται στο agenda της συνεδρίασης).
export type CommitteeTopic = {
  id?: string
  subject?: string
  decision?: string
  followUp?: boolean
  action?: string
  owner?: string
  ownerId?: string | null
  dueDate?: string
  priority?: string
}

export type CommitteeAttendance = {
  id?: string
  dbId?: string
  memberId?: string | null
  memberDbId?: string | null
  employeeDbId?: string | null
  name?: string
  status?: string
  voting?: boolean
  recordedById?: string | null
}

// Μια έγκριση πρακτικών: από μέλος με λογαριασμό ή εξωτερική (email/υπογραφή).
export type CommitteeApproval = {
  id: string
  approvalId?: string
  approverId?: string | null
  approverName?: string
  memberId?: string | null
  status: string
  comment?: string
  requestedAt?: string
  decidedAt?: string | null
  archivedAt?: string | null
  external?: boolean
  method?: string
  email?: string
  sentAt?: string | null
  sendCount?: number
  expiresAt?: string | null
}

export type CommitteeMeeting = {
  id: string
  dbId?: string
  date?: string
  time?: string
  scheduledAt?: string
  title: string
  meetingType?: string
  composition?: string
  location?: string
  status: string
  attendance?: number
  quorum?: boolean | null
  minutesNo?: string
  agenda?: string[] | CommitteeTopic[]
  topics?: CommitteeTopic[]
  notes?: string
  generalNotes?: string
  finalizedAt?: string | null
  finalizedById?: string | null
  attendanceRecords?: CommitteeAttendance[]
  approvalState?: string
  approvals?: CommitteeApproval[]
  approvalHistory?: CommitteeApproval[]
  cancellationReason?: string
  cancelledAt?: string | null
  cancelledBy?: string | null
}

export type CommitteeDecision = {
  id: string
  dbId?: string
  meetingId?: string | null
  meetingDbId?: string | null
  topicId?: string | null
  title: string
  action?: string
  ownerId?: string | null
  owner?: string
  dueDate?: string
  priority?: string
  status: string
  createdAt?: string
  updatedAt?: string
}

export type CommitteePlanItem = {
  id: string
  dbId?: string
  title: string
  indicator?: string
  baseline?: string
  target?: string
  ownerId?: string | null
  owner?: string
  dueDate?: string
  status: string
  createdAt?: string
  updatedAt?: string
}

export type CommitteeHistoryEntry = {
  id?: string
  at: string
  actorId?: string | null
  actor?: string
  action: string
  reason?: string
  eventData?: unknown
}

// Ένα έγγραφο της επιτροπής: ελεγχόμενο έγγραφο (documentId) ή συνημμένο αρχείο.
export type CommitteeDocument = {
  id: string
  dbId?: string
  documentId?: string | null
  documentCode?: string
  documentTitle?: string
  kind?: string
  attachment?: unknown
  createdById?: string | null
  createdAt?: string
  name?: string
}

// Οι μετρήσεις της λίστας (committee_overview_counts), όταν δεν διαβάστηκαν όλες οι γραμμές.
export type CommitteeOverview = { meetings: number, openMeetings: number, openDecisions: number, lastMeetingOn: string }

export type Committee = {
  id: string
  dbId?: string
  organizationId?: string
  templateId?: string
  name: string
  shortName?: string
  nameEn?: string
  shortNameEn?: string
  type?: string
  status?: string
  chair?: string
  secretary?: string
  termStart?: string
  termEnd?: string
  committeeRole?: string
  legalBasis?: string
  mandate?: string
  decisionNumber?: string
  meetingFrequency?: string
  quorumRule?: string
  notes?: string
  members?: string[]
  memberRefs: CommitteeMember[]
  meetings: CommitteeMeeting[]
  decisions: CommitteeDecision[]
  annualPlan: CommitteePlanItem[]
  documents?: CommitteeDocument[]
  history: CommitteeHistoryEntry[]
  partial?: boolean
  overview?: CommitteeOverview
  createdAt?: string
  updatedAt?: string
}

// Οι γραμμές της βάσης όπως τις διαβάζει η υπηρεσία (με τις ενωμένες στήλες).
export type CommitteeMemberRow = Partial<Tables<'committee_members'>> & { employee?: { employee_code?: string | null, department_name?: string | null, profession_name?: string | null, email?: string | null } | null }
export type CommitteeRow = Partial<Tables<'committees'>> & { committee_members?: CommitteeMemberRow[] | null }
export type CommitteeDocumentRow = Partial<Tables<'committee_documents'>> & { document?: { code?: string | null, title?: string | null, status?: string | null } | null }
// Μια έγκριση πρακτικών (τρέχουσα, ιστορικό ή εξωτερική).
export type CommitteeApprovalRow = Partial<Tables<'committee_minutes_approvals'>> & Partial<Tables<'committee_minutes_approval_history'>> & Partial<Tables<'committee_minutes_external_approvals'>>
export type CommitteeWorkflowRows = {
  meetings?: Partial<Tables<'committee_meetings'>>[]
  attendance?: Partial<Tables<'committee_meeting_attendance'>>[]
  decisions?: Partial<Tables<'committee_decisions'>>[]
  approvals?: CommitteeApprovalRow[]
  approvalHistory?: CommitteeApprovalRow[]
  plan?: Partial<Tables<'committee_plan_items'>>[]
  documents?: CommitteeDocumentRow[]
  history?: Partial<Tables<'committee_history'>>[]
  external?: CommitteeApprovalRow[]
}

// Ένα μέλος χωρίς λογαριασμό που εγκρίνει τα πρακτικά με email ή με υπογραφή (membersWithoutAccount).
export type ExternalApprover = { memberId: string, memberDbId?: string | null, name?: string, email?: string, method?: string }
// Η επιλογή στο παράθυρο: ο τρόπος και η διεύθυνση.
export type ExternalApproverChoice = ExternalApprover & { method: string, email: string }

// Ο εργαζόμενος όπως τον διαβάζουν οι Επιτροπές (η ενότητα των εργαζομένων δεν έχει ακόμη τύπους)
// και το πρόσωπο του προσωπικού που διαλέγεται ως μέλος.
export type CommitteeEmployee = { id: string, dbId?: string | null, firstName?: string, lastName?: string, department?: string, profession?: string, email?: string, employmentStatus?: string }
export type CommitteeStaffMember = { id: string, dbId: string | null, name: string, department: string, profession: string, email: string }

// Ό,τι στέλνουν τα παράθυρα της καρτέλας (νέα εγγραφή: χωρίς id).
export type CommitteeMemberDraft = Partial<CommitteeMember> & { manualName?: string, memberName?: string }
export type CommitteeMeetingDraft = Pick<CommitteeMeeting, 'title'> & Partial<CommitteeMeeting>
export type CommitteeDecisionDraft = Pick<CommitteeDecision, 'title'> & Partial<CommitteeDecision>
export type CommitteePlanDraft = Pick<CommitteePlanItem, 'title'> & Partial<CommitteePlanItem>
// Η εγγραφή για την οποία άνοιξε ένα παράθυρο (μέλος, συνεδρίαση, απόφαση ή στόχος).
export type CommitteeDialogValue = CommitteeMember | CommitteeMeeting | CommitteeDecision | CommitteePlanItem

// Τα πρακτικά όπως τα δείχνει ο προσωπικός σύνδεσμος email (committee_minutes_external_access).
export type ExternalMinutes = {
  status: string
  organizationName?: string
  memberName?: string
  committeeName?: string
  meetingTitle?: string
  scheduledAt?: string | null
  minutesNumber?: string | null
  location?: string | null
  quorumMet?: boolean | null
  topics: CommitteeTopic[]
  notes?: string | null
  attendees: string[]
  comment?: string | null
  decidedAt?: string | null
  expiresAt?: string | null
}
