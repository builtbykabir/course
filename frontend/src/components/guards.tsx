import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { authClient } from '../lib/auth-client'
import { PageState } from './ui'

export function RequireAuth() {
  const { data: session, isPending } = authClient.useSession()
  const location = useLocation()

  if (isPending) {
    return <PageState>Checking your session…</PageState>
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}

export function RequireAdmin() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <PageState>Checking admin access…</PageState>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (session.user.role !== 'admin') {
    return <Navigate to="/purchases" replace />
  }

  return <Outlet />
}
