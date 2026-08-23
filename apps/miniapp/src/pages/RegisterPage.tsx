import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../features/auth/api';
import { setWebSession } from '../features/auth/session';

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await register({
        username,
        password,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setWebSession({ token: result.token, expiresAt: result.expiresAt });
      navigate('/profile', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell min-h-screen">
      <section className="surface-card mx-auto mt-10 max-w-md p-6">
        <div className="section-kicker">HOOMA</div>
        <h1 className="section-title mt-2">Create your account</h1>
        <p className="mt-2 muted">Telegram is not required for a web account.</p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-sm">Username *</span>
            <input
              className="hooma-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_.]+"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Password *</span>
            <input
              className="hooma-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Display Name</span>
            <input
              className="hooma-input"
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Email (optional)</span>
            <input
              className="hooma-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={320}
            />
          </label>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button className="accent-button w-full" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm muted">
          Already have a web account?{' '}
          <Link className="underline" to="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
