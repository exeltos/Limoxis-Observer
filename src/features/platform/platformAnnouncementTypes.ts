import type { Tables } from '../../core/supabase/database.types'

// The platform owner's announcements to the hospital administrators (platformAnnouncementsService translates the
// platform_announcements rows of database.types to and from the shape the screens keep).

// A row as read; mapAnnouncement also reads partial rows (older rows, tests), so every column but the id may be missing.
export type AnnouncementRow = Tables<'platform_announcements'>
export type AnnouncementRowInput = Partial<AnnouncementRow> & { id: string }

// An announcement as the screens keep it. The image position, the attached file and «every registered hospital» are not
// in the owner's preview list (ownerPreview): read there as «top», no file, and «an empty list is every hospital».
export interface PlatformAnnouncement {
  id: string
  kind: string
  titleEl: string
  titleEn: string
  bodyEl: string
  bodyEn: string
  ctaLabelEl: string
  ctaLabelEn: string
  ctaUrl: string
  imageUrl: string
  attachmentPath: string
  attachmentName: string
  attachmentType: string
  documentPath?: string | null
  documentName?: string
  documentType?: string
  imagePosition?: string
  showInDemo: boolean
  startsAt: string | null
  endsAt: string | null
  audience: string[]
  allHospitals?: boolean
  frequency: string
  status: string
  createdAt: string | null
}
// The owner's list: with how many administrators have seen each one.
export type ListedAnnouncement = PlatformAnnouncement & { seenCount: number }

// The owner's form: the dates as yyyy-mm-dd ('' for none); a new one has no id yet.
export interface AnnouncementForm extends Omit<PlatformAnnouncement, 'id' | 'ctaLabelEn' | 'startsAt' | 'endsAt' | 'createdAt'> {
  id?: string
  ctaLabelEn?: string
  startsAt: string
  endsAt: string
  createdAt?: string | null
  seenCount?: number
}
// What announcementPayload saves: any part of the form (missing fields are saved empty or with their default).
export type AnnouncementDraft = Partial<Omit<AnnouncementForm, 'startsAt' | 'endsAt'>> & { startsAt?: string | null, endsAt?: string | null }

// What the card reads (the gate shows a loaded announcement, the owner's page the form as a preview).
export type AnnouncementCard = Pick<PlatformAnnouncement, 'kind' | 'titleEl' | 'titleEn' | 'bodyEl' | 'bodyEn' | 'ctaLabelEl' | 'ctaUrl' | 'imageUrl' | 'attachmentPath' | 'attachmentType' | 'imagePosition' | 'documentPath' | 'documentName'> & { ctaLabelEn?: string }

// Who an announcement is for (pendingFor, meantForDemo, audienceSummary read only these).
export interface AnnouncementAudience { audience: string[], allHospitals?: boolean, showInDemo?: boolean }
export interface AnnouncementSchedule extends AnnouncementAudience { id: string, status: string, startsAt?: string | null, endsAt?: string | null, frequency: string }

// The uploaded image or file, as it goes into the form.
export interface UploadedAttachment { attachmentPath: string, attachmentName: string, attachmentType: string }
export interface UploadedDocument { documentPath: string, documentName: string, documentType: string }

// A hospital or demo hospital the owner can address (the owner's memberships and every organization of the platform).
export interface AnnouncementOrganization { id: string, name: string, is_demo?: boolean | null, mode?: string | null }
