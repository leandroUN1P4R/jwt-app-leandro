'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Alert, PageHeader, StatusBadge } from '@/components/ui';
import api, { asList, getErrorMessage } from '@/lib/api';
import { effectiveStatus, formatDate, formatMoney, normalizeLoan } from '@/lib/format';
import type { DashboardReport, Loan } from '@/lib/types';

type Loose = Record<string, unknown>;

/** Aceita variações de nome comuns que a API possa devolver. */
function pickNumber(obj: Loose, keys: string[]) {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]) || 0;
  return 0;
}

function normalizeReport(raw: Loose): DashboardReport {
  return {
    totalBooks: pickNumber(raw, ['totalBooks', 'books', 'totalLivros', 'livros']),
    activeLoans: pickNumber(raw, ['activeLoans', 'borrowed', 'loans', 'emprestados', 'ativos']),
    overdueLoans: pickNumber(raw, ['overdueLoans', 'overdue', 'late', 'atrasados']),
    totalFines: pickNumber(raw, ['totalFines', 'fines', 'multas']),
  };
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [overdue, setOverdue] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const overdueReq = api.get('/loans', { params: { status: 'ATRASADO' } });
        overdueReq.catch(() => {}); // evita "unhandled rejection" se o relatório falhar antes

        let data: DashboardReport;
        if (isAdmin) {
          const res = await api.get('/reports/dashboard');
          data = normalizeReport(res.data as Loose);
        } else {
          // Relatório é exclusivo do admin: o atendente vê totais calculados das listagens.
          const [books, active, late] = await Promise.all([
            api.get('/books'),
            api.get('/loans', { params: { status: 'ATIVO' } }),
            overdueReq,
          ]);
          data = {
            totalBooks: asList(books.data).length,
            activeLoans: asList(active.data).length,
            overdueLoans: asList(late.data).length,
            totalFines: NaN,
          };
        }
        const late = asList<Loose>((await overdueReq).data).map(normalizeLoan);
        if (!cancelled) {
          setReport(data);
          setOverdue(late);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const cards = [
    { label: 'Total de livros', value: report?.totalBooks, cls: '' },
    { label: 'Empréstimos ativos', value: report?.activeLoans, cls: 'stat-success' },
    { label: 'Empréstimos atrasados', value: report?.overdueLoans, cls: 'stat-danger' },
    {
      label: 'Multas',
      value:
        report == null ? undefined : Number.isNaN(report.totalFines) ? 'Só admin' : formatMoney(report.totalFines),
      cls: 'stat-warning',
    },
  ];

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle="Resumo do acervo e dos empréstimos"
        actions={
          <Link href="/dashboard/emprestimos" className="btn btn-primary">
            + Novo empréstimo
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      <div className="stats">
        {cards.map((c) => (
          <div key={c.label} className={`card stat ${c.cls}`}>
            <span className="stat-label">{c.label}</span>
            <span className="stat-value">{c.value ?? '…'}</span>
          </div>
        ))}
      </div>

      <section className="section">
        <h2>Empréstimos atrasados</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Livro</th>
                <th>Leitor</th>
                <th>Vencimento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {overdue.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-state muted">
                    {report ? 'Nenhum empréstimo atrasado. 🎉' : 'Carregando…'}
                  </td>
                </tr>
              ) : (
                overdue.slice(0, 8).map((l) => (
                  <tr key={l.id}>
                    <td>{l.book?.title ?? `#${l.bookId}`}</td>
                    <td>{l.reader?.name ?? `#${l.readerId}`}</td>
                    <td>{formatDate(l.dueDate)}</td>
                    <td>
                      <StatusBadge status={effectiveStatus(l)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
