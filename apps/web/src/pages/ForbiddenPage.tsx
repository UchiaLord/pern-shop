import { Link, useLocation } from 'react-router-dom';

import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export default function ForbiddenPage() {
  const loc = useLocation();

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="space-y-1">
        <div className="text-xs tracking-widest text-[rgb(var(--muted))]">ACCESS</div>
        <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">Forbidden</h1>
        <p className="text-sm text-[rgb(var(--muted))]">
          Keine Berechtigung für diese Seite.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>403</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-[rgb(var(--muted))]">
            Path: <span className="text-[rgb(var(--fg))]/80">{loc.pathname}</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/products" className="flex-1">
              <Button className="w-full">Go to Products</Button>
            </Link>
            <Link to="/orders" className="flex-1">
              <Button variant="ghost" className="w-full">
                My Orders
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}