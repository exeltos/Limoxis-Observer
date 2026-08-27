import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="boot-screen"><div className="boot-mark">H+</div><span>Limoxis Observer</span></div>
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
