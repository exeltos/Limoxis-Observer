// Structured roles of a committee member (committee_members.member_roles).
// The Greek title as written in the official roster stays in `title`
// (committeeTitle); the roles drive the badges, the ordering of the members
// list and who is shown as chair.
import type { AnyRecord } from '../../types/featureTypes'
export const MEMBER_ROLES = [
  'chair',
  'vice_chair',
  'deputy_chair',
  'coordinator',
  'secretary',
  'member',
]

const ROLE_LABELS: Record<string, string[]> = {
  chair: ['Πρόεδρος', 'Chair'],
  vice_chair: ['Αντιπρόεδρος', 'Vice chair'],
  deputy_chair: ['Αναπληρωτής Προέδρου', 'Deputy chair'],
  coordinator: ['Συντονιστής', 'Coordinator'],
  secretary: ['Γραμματέας', 'Secretary'],
  member: ['Μέλος', 'Member'],
}

// Roles that get a badge in the members list (plain membership does not).
export const BADGE_ROLES = ['chair', 'vice_chair', 'deputy_chair', 'coordinator', 'secretary']

export const memberRoleLabel = (role: string, en: boolean) => ROLE_LABELS[role]?.[en ? 1 : 0] || role

export function normalizeMemberRoles(value: unknown) {
  const list = Array.isArray(value) ? value : []
  const roles = MEMBER_ROLES.filter(role => list.includes(role))
  return roles.length ? roles : ['member']
}

// Roles as stored, for mapping a database row: an empty (or unknown-only) list
// stays empty, so effectiveMemberRoles still falls back to the title.
export function storedMemberRoles(value: unknown) {
  const list = Array.isArray(value) ? value : []
  return MEMBER_ROLES.filter(role => list.includes(role))
}

const fold = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleUpperCase('el-GR')

// Roles implied by a free Greek title, e.g. "Πρόεδρος & Συντονιστής" →
// chair + coordinator, "Μέλος – Αναπληρωτής Προέδρου" → deputy_chair.
export function rolesFromTitle(title: unknown) {
  const text = fold(title)
  const roles = new Set<string>()
  const deputy = /ΑΝΑΠΛΗΡΩΤ\S*\s+ΠΡΟΕΔΡ/.test(text)
  if (deputy) roles.add('deputy_chair')
  if (/ΑΝΤΙΠΡΟΕΔΡ/.test(text)) roles.add('vice_chair')
  else if (!deputy && /(^|[^Α-Ω])ΠΡΟΕΔΡ/.test(text)) roles.add('chair')
  if (/ΣΥΝ?Τ?ΟΝΙΣΤ/.test(text)) roles.add('coordinator')
  if (/ΓΡΑΜΜΑΤΕ/.test(text)) roles.add('secretary')
  return normalizeMemberRoles([...roles])
}

// Stored roles, or for members saved before roles existed the ones their title implies.
export const effectiveMemberRoles = (member: AnyRecord | null | undefined) =>
  Array.isArray(member?.roles) && member.roles.length
    ? normalizeMemberRoles(member.roles)
    : rolesFromTitle(member?.committeeTitle)

export const memberBadgeRoles = (member: AnyRecord | null | undefined) =>
  effectiveMemberRoles(member).filter(role => BADGE_ROLES.includes(role))

const rank = (member: AnyRecord) =>
  Math.min(...effectiveMemberRoles(member).map(role => MEMBER_ROLES.indexOf(role)))

// Chair first, then vice/deputy chair, coordinators, secretary, members;
// active members before former ones; the original order otherwise.
export function sortMembersByRole(rows: AnyRecord[] = []) {
  return rows
    .map((member, index) => ({ member, index }))
    .sort(
      (a, b) =>
        Number(a.member.active === false) - Number(b.member.active === false) ||
        rank(a.member) - rank(b.member) ||
        a.index - b.index,
    )
    .map(x => x.member)
}

// Name of the active member holding a role; falls back to the title text
// for members saved before roles existed.
export function officerName(rows: AnyRecord[] = [], role: string, titlePattern?: RegExp | null) {
  const active = rows.filter(x => x.active !== false)
  const byRole = active.find(x => Array.isArray(x.roles) && x.roles.includes(role))
  if (byRole) return byRole.name || ''
  const byTitle = titlePattern ? active.find(x => titlePattern.test(x.committeeTitle || '')) : null
  return byTitle?.name || ''
}
