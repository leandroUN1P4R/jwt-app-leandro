'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Alert } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login, status, sessionExpired } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Informe o e-mail.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'E-mail inválido.';
    if (!password) next.password = 'Informe a senha.';
    else if (password.length < 6) next.password = 'A senha tem no mínimo 6 caracteres.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setPending(true);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'E-mail ou senha inválidos.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card card">
        <div className="login-brand">
          <span className="brand-mark brand-mark-lg">B</span>
          <div>
            <h1>Biblioteca</h1>
            <p className="muted">Entre com sua conta de atendente ou administrador</p>
          </div>
        </div>

        {sessionExpired && !noticeDismissed && (
          <Alert kind="info" onClose={() => setNoticeDismissed(true)}>
            Sua sessão expirou. Faça login novamente.
          </Alert>
        )}
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

        <form onSubmit={handleSubmit} noValidate className="stack">
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
              autoFocus
            />
            {errors.email && <small className="text-danger">{errors.email}</small>}
          </div>

          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password && <small className="text-danger">{errors.password}</small>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
