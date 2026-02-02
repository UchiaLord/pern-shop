import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../auth/useAuth';

function NavLink({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to;

  return (
    <Link
      to={to}
      className={[
        'rounded-2xl px-3 py-2 text-sm transition',
        active ? 'bg-white/10 border border-white/12' : 'hover:bg-white/8 border border-transparent',
      ].join(' ')}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgb(var(--bg))]/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="mr-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-2xl bg-white/10 border border-white/12" />
          <div className="font-semibold tracking-tight">PERN Shop</div>
        </Link>

        <div className="hidden md:block md:flex-1">
          <Input placeholder="Search products…" />
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/products" label="Products" />
          {user && <NavLink to="/orders" label="Orders" />}
          {isAdmin && <NavLink to="/admin/products" label="Admin" />}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/cart">
            <Button variant="ghost">Cart</Button>
          </Link>

          {!user ? (
            <>
              <Link to="/login">
                <Button>Login</Button>
              </Link>
              <Link to="/register">
                <Button variant="ghost">Register</Button>
              </Link>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={async () => {
                await logout();
              }}
              title={user.email}
            >
              Logout
            </Button>
          )}
        </div>
      </div>

      <div className="md:hidden px-4 pb-3">
        <Input placeholder="Search…" />
      </div>
    </header>
  );
}