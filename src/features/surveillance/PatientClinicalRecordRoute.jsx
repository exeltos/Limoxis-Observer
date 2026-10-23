import { useEffect, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useTenant } from '../../core/tenant/TenantContext'
import { createClinicalRepository } from './clinicalRepository'
import { PatientClinicalCanonicalPage } from './PatientClinicalCanonicalPage'

export function PatientClinicalRecordRoute({ patientMode = false }) {
  const location = useLocation()
  const { caseId } = useParams()
  const { tenant, isDemo } = useTenant()
  const fromPatientRegistry =
    !patientMode && location.state?.limoxisFrom?.registry === 'surveillance-patients'
  const [target, setTarget] = useState(null)
  const [resolved, setResolved] = useState(!fromPatientRegistry)

  useEffect(() => {
    if (!fromPatientRegistry) {
      setTarget(null)
      setResolved(true)
      return undefined
    }

    let alive = true
    setTarget(null)
    setResolved(false)
    const repository = createClinicalRepository({
      isDemo,
      organizationId: tenant?.id,
      actor: null,
    })

    repository
      .loadCase(caseId)
      .then(record => {
        if (!alive) return
        setTarget(
          record?.patientRecordId
            ? {
                patientRecordId: record.patientRecordId,
                admissionId: record.admissionId || null,
              }
            : null,
        )
        setResolved(true)
      })
      .catch(() => {
        if (!alive) return
        setTarget(null)
        setResolved(true)
      })

    return () => {
      alive = false
    }
  }, [caseId, fromPatientRegistry, isDemo, tenant?.id])

  if (patientMode) return <PatientClinicalCanonicalPage patientMode />
  if (fromPatientRegistry && !resolved) return <RouteLoading />
  if (fromPatientRegistry && target?.patientRecordId) {
    return (
      <Navigate
        replace
        to={`/patients/${target.patientRecordId}`}
        state={{
          ...(location.state || {}),
          admissionId: target.admissionId || location.state?.admissionId || '',
        }}
      />
    )
  }
  return <PatientClinicalCanonicalPage />
}
