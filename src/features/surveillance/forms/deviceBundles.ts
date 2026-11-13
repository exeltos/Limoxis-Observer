import { CAPABILITIES } from '../../../core/permissions/roles'
import { bundlesSection } from './sections/bundlesSection'
import { buildBundlePrefill, episodeReturn } from './formPrefill'
import { bundleStatusForDevice } from './formStatus'
import type { BundleAssessment, BundleDevice, EpisodeFormsCtx, FormsEpisode } from './formTypes'

// What the device row of the surveillance stage needs: the bundle of the device, its day and
// status, and the one place a new bundle check starts («Έλεγχος δέσμης»). Null when the user
// or the hospital has no bundles (the row then shows no bundle column).
export function makeDeviceBundles(ctx: EpisodeFormsCtx, assessments: BundleAssessment[] | null | undefined, reload: ((id: string) => unknown) | null = null) {
  if (!ctx || !bundlesSection.canSee(ctx)) return null
  return {
    canCheck: ctx.has(CAPABILITIES.RECORD_PREVENTION_BUNDLE),
    info: (device: BundleDevice) => bundleStatusForDevice({ device, assessments: assessments || [] }),
    // The bundle check opened on the surveillance sheet itself (owner, 8/11/2026): its locked context.
    prefill(device: BundleDevice, episode: FormsEpisode | null | undefined) {
      const info = bundleStatusForDevice({ device, assessments: assessments || [] })
      return buildBundlePrefill({ ctx, device, episode, info })
    },
    organizationId: ctx.organizationId || null,
    reload: () => reload?.('bundles'),
    check(device: BundleDevice, episode: FormsEpisode | null | undefined) {
      const info = bundleStatusForDevice({ device, assessments: assessments || [] })
      ctx.goTo('/prevention/bundles/new', {
        returnTab: 'surveillanceJourney',
        state: { episodeBundle: { prefill: buildBundlePrefill({ ctx, device, episode, info }), ...episodeReturn(ctx) } },
      })
    },
  }
}
// What the device row and the bundle check window receive.
export type DeviceBundles = NonNullable<ReturnType<typeof makeDeviceBundles>>
