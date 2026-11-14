import { Suspense } from 'react'
import { BrandMark } from '../../design-system/BrandMark'
import { lazyPage } from '../errors/chunkRecovery'
import { RouteLoading } from '../../design-system/RouteLoading'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

// Η δημόσια «Σελίδα παρουσίασης»: μόνο στο «/» και μόνο για όποιον δεν έχει συνδεθεί.
const LandingPage = lazyPage(() => import('../../features/auth/LandingPage'), 'LandingPage')
// Η αλλαγή προσωρινού κωδικού φορτώνεται μόνο όταν χρειαστεί (μαζί με το CSS των σελίδων σύνδεσης).
const ForcePasswordChangePage = lazyPage(() => import('../../features/auth/ForcePasswordChangePage'), 'ForcePasswordChangePage')

export function ProtectedRoute() {
  const { isAuthenticated, loading, profile } = useAuth()
  const location = useLocation()
  if (loading) return <div className="boot-screen"><BrandMark size={50}/><span>Limoxis Observer</span></div>
  // A temporary password (account created active by the Platform Owner) is replaced before anything opens.
  if (isAuthenticated && profile?.mustChangePassword && !profile?.isDemo) return <Suspense fallback={<RouteLoading/>}><ForcePasswordChangePage/></Suspense>
  if (!isAuthenticated && location.pathname === '/') return <Suspense fallback={<RouteLoading/>}><LandingPage/></Suspense>
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
}
