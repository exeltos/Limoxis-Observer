// Whether the screen guides run for the signed-in user in this hospital.
//   organizations.screen_guides_enabled: null = default (on for a Demo, off for
//     a hospital), true / false = set for the hospital;
//   organization_members.screen_guides: null = as the hospital, true / false =
//     set for this user in this hospital.
// The user can still turn the guides off for themselves from a guide.

export const SCREEN_GUIDE_CHOICES = ['default', 'on', 'off']

export const screenGuideChoice = value => (value === true ? 'on' : value === false ? 'off' : 'default')
export const screenGuideValue = choice => (choice === 'on' ? true : choice === 'off' ? false : null)

export function hospitalScreenGuidesOn(organization) {
  if (typeof organization?.screen_guides_enabled === 'boolean') return organization.screen_guides_enabled
  return Boolean(organization?.is_demo)
}

export function screenGuidesOn({ organization, membership }) {
  if (!organization || organization.mode === 'demo') return false
  if (typeof membership?.screen_guides === 'boolean') return membership.screen_guides
  return hospitalScreenGuidesOn(organization)
}
