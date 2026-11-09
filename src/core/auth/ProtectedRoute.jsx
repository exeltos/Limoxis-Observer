import { BrandMark } from '../../design-system/BrandMark'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { ForcePasswordChangePage } from '../../features/auth/ForcePasswordChangePage'

export function ProtectedRoute() {
  const { isAuthenticated, loading, profile } = useAuth()
  const location = useLocation()
  if (loading) return <div className="boot-screen"><BrandMark size={50}/><span>Limoxis Observer</span></div>
  // A temporary password (account created active by the Platform Owner) is replaced before anything opens.
  if (isAuthenticated && profile?.mustChangePassword && !profile?.isDemo) return <ForcePasswordChangePage/>
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
}
