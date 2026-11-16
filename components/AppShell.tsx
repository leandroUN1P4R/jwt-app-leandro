'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', exact: true },
  { href: '/dashboard/livros', label: 'Livros' },
  { href: '/dashboard/categorias', label: 'Categorias' },
  { href: '/dashboard/autores', label: 'Autores' },
  { href: '/dashboard/leitores', label: 'Leitores' },
  { href: '/dashboard/emprestimos', label: 'Empréstimos' },
  { href: '/dashboard/atendentes', label: 'Atendentes', adminOnly: true },
];

/**
 * Layout protegido: sem sessão válida redireciona para o login.
 * Menus de administrador ficam ocultos para atendentes, mas a proteção
 * real é feita pela API (403).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, status, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return <div className="fullscreen-center muted">Verificando sessão…</div>;
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark">B</span>
            Biblioteca
          </Link>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>

          <nav className={`nav${menuOpen ? ' nav-open' : ''}`}>
            {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? 'active' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="user-box">
            <div className="user-info">
              <strong>{user.name}</strong>
              <small>{isAdmin ? 'Administrador' : 'Atendente'}</small>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

/** Bloqueia telas de administrador no front (a API também deve responder 403). */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <div className="card empty-card">
        <h2>Acesso restrito</h2>
        <p className="muted">Esta área é exclusiva de administradores.</p>
        <Link href="/dashboard" className="btn btn-primary">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
