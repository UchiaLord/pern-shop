import { Navigate, Outlet } from 'react-router-dom';

import { ErrorBanner, Loading } from '../components/Status';
import { useAuth } from './useAuth';

export default function RequireRole({ role }: { role: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading />;

  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== role) {
    return <ErrorBanner message="FORBIDDEN: Keine Berechtigung." />;
  }

  return <Outlet />;
}
