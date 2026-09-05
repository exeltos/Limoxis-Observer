import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function isPublicSecureTokenRoute(pathname='') {
  return /^\/training-access\/[^/]+\/?$/.test(pathname)
}

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  // Training invitations use a single-use personal token as the access credential.
  // No Limoxis account or authenticated session is required for this public flow.
  if (isPublicSecureTokenRoute(location.pathname)) return <Outlet />

  if (loading) return <div className="boot-screen"><div className="boot-mark">L+</div><span>Limoxis Observer</span></div>
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
}
