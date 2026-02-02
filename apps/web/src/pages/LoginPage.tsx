import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { ErrorBanner } from '../components/Status';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { extractErrorMessage } from '../lib/errors';

function getNextFromSearch(search: string): string {
  const sp = new URLSearchParams(search);
  const next = sp.get('next');
  if (!next) return '/products';

  // minimal safety: only allow internal paths
  if (!next.startsWith('/')) return '/products';
  if (next.startsWith('//')) return '/products';
  return next;
}

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const next = useMemo(() => getNextFromSearch(loc.search), [loc.search]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      nav(next, { replace: true });
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="text-xs tracking-widest text-[rgb(var(--muted))]">ACCOUNT</div>
        <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">Login</h1>
        <p className="text-sm text-[rgb(var(--muted))]">
          No account?{' '}
          <Link className="hover:underline" to={`/register?next=${encodeURIComponent(next)}`}>
            Register
          </Link>
        </p>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-[rgb(var(--muted))]">E-Mail</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-[rgb(var(--muted))]">Passwort</div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Logging in…' : 'Login'}
            </Button>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-[rgb(var(--muted))]">
            Tipp: Wenn du aus einem Guard kommst, wirst du nach dem Login automatisch zu <span className="text-[rgb(var(--fg))]/80">{next}</span>{' '}
            zurückgeführt.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}