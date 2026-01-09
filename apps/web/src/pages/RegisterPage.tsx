import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { extractErrorMessage } from '../lib/errors';

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState(() => `test+${Date.now()}@example.com`);
  const [password, setPassword] = useState('SehrSicheresPasswort123!');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(email, password);
      nav('/products');
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Register</h2>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <div>
        <label>E-Mail</label>
        <br />
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label>Passwort</label>
        <br />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit">Register</button>
    </form>
  );
}
