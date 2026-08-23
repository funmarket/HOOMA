import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../features/auth/api';
import { setWebSession } from '../features/auth/session';

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login({ username, password });
      setWebSession({ token: result.token, expiresAt: result.expiresAt });
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to log in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell min-h-screen">
      <section className="surface-card mx-auto mt-10 max-w-md p-6">
        <div className="section-kicker">HOOMA</div>
        <h1 className="section-title mt-2">Log in</h1>
        <p className="mt-2 muted">Use your HOOMA web username and password.</p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-sm">Username</span>
            <input
              className="hooma-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={3}
              maxLength={30}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Password</span>
            <input
              className="hooma-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              maxLength={128}
            />
          </label>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button className="accent-button w-full" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm muted">
          New to HOOMA?{' '}
          <Link className="underline" to="/register">
            Create account
          </Link>
        </p>
      </section>
    </main>
  );
}
