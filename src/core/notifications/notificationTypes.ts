// Η τιμή του NotificationContext (NotificationProvider), για τα αρχεία TypeScript.

// Items of many services (committees, controls, clusters, legislation,
// announcements, birthdays), each with its own fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each source keeps its own fields
export type NotificationItem = Record<string, any>

export interface NotificationContextValue {
  announcements: NotificationItem[]
  visibleAnnouncements: NotificationItem[]
  notificationItems: NotificationItem[]
  unreadItems: NotificationItem[]
  unreadCount: number
  birthday: NotificationItem[]
  operational: NotificationItem[]
  committeeMemberships: NotificationItem[]
  committeeMinutesApprovals: NotificationItem[]
  answerCommitteeMembership: (item: NotificationItem, status: string) => Promise<void>
  answerCommitteeMinutesApproval: (item: NotificationItem, status: string, comment?: string) => Promise<void>
  reloadCommitteeMinutesApprovals: () => Promise<void>
  reloadAnnouncements: () => Promise<void>
  acknowledgeAnnouncement: (id: string) => Promise<void>
  markRead: (id: string) => void
  markUnread: (id: string) => void
  markAllRead: () => void
  addAnnouncement: (announcement: NotificationItem) => void
  updateAnnouncement: (announcement: NotificationItem) => void
  removeAnnouncement: (id: string) => void
  resetDemoReads: () => void
}
