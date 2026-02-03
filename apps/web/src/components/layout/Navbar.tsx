import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';

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

  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();

  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const showSearch = useMemo(() => {
    // Search only makes sense on /products (or root redirecting there)
    return loc.pathname === '/products' || loc.pathname === '/';
  }, [loc.pathname]);

  function setQuery(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next.trim().length === 0) params.delete('q');
    else params.set('q', next);
    setSearchParams(params, { replace: true });
  }

  function focusProductsAndSearch(next: string) {
    if (loc.pathname !== '/products') {
      nav('/products', { replace: false });
    }
    setQuery(next);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgb(var(--bg))]/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link
          to="/"
          className="mr-1 flex items-center gap-2"
          onClick={() => {
            setMobileOpen(false);
          }}
        >
          <div className="h-8 w-8 rounded-2xl border border-white/12 bg-white/10" />
          <div className="font-semibold tracking-tight">PERN Shop</div>
        </Link>

        {/* Desktop search */}
        <div className="hidden md:block md:flex-1">
          {showSearch ? (
            <Input
              placeholder="Search products…"
              value={q}
              onChange={(e) => focusProductsAndSearch(e.target.value)}
            />
          ) : (
            <div />
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/products" label="Products" />
          {user && <NavLink to="/orders" label="Orders" />}
          {isAdmin && <NavLink to="/admin/products" label="Admin Products" />}
          {isAdmin && <NavLink to="/admin/orders" label="Admin Orders" />}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Mobile menu toggle */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              title="Menu"
            >
              {mobileOpen ? 'Close' : 'Menu'}
            </Button>
          </div>

          {/* Actions */}
          {user ? (
            <Link to="/cart">
              <Button variant="ghost">Cart</Button>
            </Link>
          ) : null}

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
                setMobileOpen(false);
              }}
              title={user.email}
            >
              Logout
            </Button>
          )}
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen ? (
        <div className="md:hidden border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          {showSearch ? (
            <Input
              placeholder="Search products…"
              value={q}
              onChange={(e) => focusProductsAndSearch(e.target.value)}
            />
          ) : null}

          <div className="grid gap-2">
            <Link to="/products" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                Products
              </Button>
            </Link>

            {user ? (
              <Link to="/orders" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  Orders
                </Button>
              </Link>
            ) : null}

            {isAdmin ? (
              <>
                <Link to="/admin/products" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    Admin Products
                  </Button>
                </Link>
                <Link to="/admin/orders" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    Admin Orders
                  </Button>
                </Link>
              </>
            ) : null}

            {user ? (
              <Link to="/cart" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  Cart
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}