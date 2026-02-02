import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Loading } from '../components/Status';
import { useAuth } from './useAuth';

export default function RequireAuth() {
  const { user, isLoading } = useAuth();
  const loc = useLocation();

  if (isLoading) return <Loading />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <Outlet />;
}