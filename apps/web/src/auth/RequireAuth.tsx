import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function RequireAuth() {
  const { user } = useAuth();
  const loc = useLocation();

  if (!user) {
    const next = `${loc.pathname}${loc.search}${loc.hash}`;
    const params = new URLSearchParams();
    params.set('next', next);

    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  return <Outlet />;
}