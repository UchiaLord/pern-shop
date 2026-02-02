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
  if (!next.startsWith('/')) return '/products';
  if (next.startsWith('//')) return '/products';
  return next;
}

export default function RegisterPage() {
  const { register } = useAuth();
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
      await register(email.trim(), password);
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
        <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">Register</h1>
        <p className="text-sm text-[rgb(var(--muted))]">
          Already have an account?{' '}
          <Link className="hover:underline" to={`/login?next=${encodeURIComponent(next)}`}>
            Login
          </Link>
        </p>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
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
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creating…' : 'Register'}
            </Button>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-[rgb(var(--muted))]">
            Nach erfolgreichem Register wirst du zu <span className="text-[rgb(var(--fg))]/80">{next}</span> weitergeleitet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}