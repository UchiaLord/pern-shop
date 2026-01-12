import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { ErrorBanner } from '../components/Status';
import { extractErrorMessage } from '../lib/errors';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState('test+buyer@example.com');
  const [password, setPassword] = useState('SehrSicheresPasswort123!');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      nav('/products');
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <h2>Login</h2>

      {error ? <ErrorBanner message={error} /> : null}

      <div>
        <label>E-Mail</label>
        <br />
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>

      <div>
        <label>Passwort</label>
        <br />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Login...' : 'Login'}
      </button>
    </form>
  );
}
