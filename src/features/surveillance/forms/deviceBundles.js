import { CAPABILITIES } from '../../../core/permissions/roles'
import { bundlesSection } from './sections/bundlesSection'
import { buildBundlePrefill, episodeReturn } from './formPrefill'
import { bundleStatusForDevice } from './formStatus'

// What the device row of the surveillance stage needs: the bundle of the device, its day and
// status, and the one place a new bundle check starts («Έλεγχος δέσμης»). Null when the user
// or the hospital has no bundles (the row then shows no bundle column).
export function makeDeviceBundles(ctx, assessments) {
  if (!ctx || !bundlesSection.canSee(ctx)) return null
  return {
    canCheck: ctx.has(CAPABILITIES.RECORD_PREVENTION_BUNDLE),
    info: device => bundleStatusForDevice({ device, assessments: assessments || [] }),
    check(device, episode) {
      const info = bundleStatusForDevice({ device, assessments: assessments || [] })
      ctx.goTo('/prevention/bundles/new', {
        returnTab: 'surveillanceJourney',
        state: { episodeBundle: { prefill: buildBundlePrefill({ ctx, device, episode, info }), ...episodeReturn(ctx) } },
      })
    },
  }
}
