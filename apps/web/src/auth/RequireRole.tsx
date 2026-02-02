import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

type RequireRoleProps = {
  role: string;
};

export default function RequireRole({ role }: RequireRoleProps) {
  const { user } = useAuth();

  if (!user) {
    // Falls jemals direkt genutzt (ohne RequireAuth drüber): sicherheitshalber
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}