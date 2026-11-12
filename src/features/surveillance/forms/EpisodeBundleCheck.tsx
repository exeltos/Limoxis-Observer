import { useEffect, useState } from 'react'
import { BundleExecutionEditor } from '../../prevention/BundleExecutionEditor'
import { loadBundleSupportData, saveBundleAssessment } from '../../prevention/bundleCloudService'
import { ObserverDialog } from '../../../design-system/ObserverDialog'
import { RouteLoading } from '../../../design-system/RouteLoading'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useOptionalFeedback } from '../../../core/feedback/FeedbackContext'
import type { AnyRecord } from '../../../types/featureTypes'
import type { Handler } from '../surveillanceTypes'

interface EpisodeBundleCheckProps {
  deviceBundles: AnyRecord
  device: AnyRecord
  episode: AnyRecord
  onClose: Handler
  onSaved: Handler
}
// The bundle check of a device, on the surveillance sheet under the device (owner, 8/11/2026): the same editor
// as Prevention › Bundles, with the patient, episode, device and day locked; Save keeps the user on the sheet.
export function EpisodeBundleCheck({ deviceBundles, device, episode, onClose, onSaved }: EpisodeBundleCheckProps) {
  const { t } = useLanguage()
  const notify = useOptionalFeedback()?.notify
  const organizationId = deviceBundles?.organizationId
  const [support, setSupport] = useState<AnyRecord | null>(null)
  useEffect(() => {
    let alive = true
    loadBundleSupportData(organizationId)
      .then(data => alive && setSupport(data))
      .catch(error => {
        if (!alive) return
        setSupport({ departments: [], templates: [] })
        notify?.(error?.message || t('actionFailed'), 'danger')
      })
    return () => {
      alive = false
    }
  }, [organizationId, notify, t])
  const prefill = deviceBundles.prefill(device, episode)
  return (
    <ObserverDialog title={t('episodeForms.bundles.check')} subtitle={prefill.deviceLabel} onClose={onClose}>
      {/* The editor's look lives under Prevention's record shell: the same class keeps it identical here. */}
      <div className="prevention-record-shell episode-bundle-check">
      {support ? (
        <BundleExecutionEditor
          departments={support.departments}
          templates={support.templates}
          prefill={prefill}
          onSave={async (payload: AnyRecord) => {
            try {
              await saveBundleAssessment(organizationId, payload, { existingId: null })
              notify?.(t('actionCompleted'), 'success')
              await deviceBundles.reload?.()
              onSaved?.()
            } catch (error) {
              notify?.(error?.message || t('actionFailed'), 'danger')
            }
          }}
        />
      ) : (
        <RouteLoading />
      )}
      </div>
    </ObserverDialog>
  )
}
