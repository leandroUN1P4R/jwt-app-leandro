'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Field, Modal, PageHeader, StatusBadge, TableState } from '@/components/ui';
import api, { asList, getErrorMessage } from '@/lib/api';
import {
  daysLate,
  effectiveStatus,
  estimatedFine,
  formatCpf,
  formatDate,
  formatMoney,
  normalizeBook,
  normalizeLoan,
} from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import type { Book, Loan, LoanStatus, Reader } from '@/lib/types';

const LOAN_DAYS = 7;
const MAX_ACTIVE = 3;
const STATUSES: { value: '' | LoanStatus; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'ATIVO', label: 'Ativos' },
  { value: 'ATRASADO', label: 'Atrasados' },
  { value: 'DEVOLVIDO', label: 'Devolvidos' },
];

const selectLoans = (raw: unknown) => asList<Record<string, unknown>>(raw).map(normalizeLoan);
const selectReaders = (raw: unknown) => asList<Reader>(raw);
const selectBooks = (raw: unknown) => asList<Record<string, unknown>>(raw).map(normalizeBook);

export default function EmprestimosPage() {
  const [status, setStatus] = useState<'' | LoanStatus>('');
  const { data: loans, loading, error, reload } = useFetch<Loan[]>(
    status ? `/loans?status=${status}` : '/loans',
    selectLoans,
    [],
  );
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [returning, setReturning] = useState<Loan | null>(null);

  return (
    <>
      <PageHeader
        title="Empréstimos"
        subtitle={`Prazo padrão de ${LOAN_DAYS} dias · multa de R$ 1,00 por dia de atraso`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}>
            + Novo empréstimo
          </button>
        }
      />

      {feedback && (
        <Alert kind={feedback.kind} onClose={() => setFeedback(null)}>
          {feedback.text}
        </Alert>
      )}

      <div className="row" style={{ marginBottom: 14 }} role="tablist" aria-label="Filtrar por status">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={status === s.value}
            className={`btn btn-sm ${status === s.value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatus(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Livro</th>
              <th>Leitor</th>
              <th>Empréstimo</th>
              <th>Vencimento</th>
              <th>Devolução</th>
              <th>Status</th>
              <th>Multa</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} error={error} empty={loans.length === 0} colSpan={8} />
            {!loading &&
              !error &&
              loans.map((l) => {
                const st = effectiveStatus(l);
                return (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.book?.title ?? `#${l.bookId}`}</strong>
                    </td>
                    <td>{l.reader?.name ?? `#${l.readerId}`}</td>
                    <td>{formatDate(l.loanDate)}</td>
                    <td>{formatDate(l.dueDate)}</td>
                    <td>{formatDate(l.returnDate)}</td>
                    <td>
                      <StatusBadge status={st} />
                    </td>
                    <td className="nowrap">
                      {st === 'DEVOLVIDO' ? (
                        formatMoney(l.fine)
                      ) : st === 'ATRASADO' ? (
                        <span className="text-danger">{formatMoney(estimatedFine(l))}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {st !== 'DEVOLVIDO' && (
                          <button type="button" className="btn btn-success btn-sm" onClick={() => setReturning(l)}>
                            Devolver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Montado só enquanto aberto: o estado do formulário zera a cada abertura */}
      {newOpen && (
        <NewLoanModal
          onClose={() => setNewOpen(false)}
          onCreated={(msg) => {
            setNewOpen(false);
            setFeedback({ kind: 'success', text: msg });
            reload();
          }}
        />
      )}

      <ReturnModal
        key={returning?.id ?? 'none'}
        loan={returning}
        onClose={() => setReturning(null)}
        onReturned={(msg) => {
          setReturning(null);
          setFeedback({ kind: 'success', text: msg });
          reload();
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Novo empréstimo: buscar leitor + livro                              */
/* ------------------------------------------------------------------ */
function NewLoanModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
  const readers = useFetch<Reader[]>('/readers', selectReaders, []);
  const [readerQuery, setReaderQuery] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [debouncedBook, setDebouncedBook] = useState('');
  const [reader, setReader] = useState<Reader | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBook(bookQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [bookQuery]);

  const booksUrl = `/books?available=true${debouncedBook ? `&title=${encodeURIComponent(debouncedBook)}` : ''}`;
  const books = useFetch<Book[]>(booksUrl, selectBooks, []);

  // Situação do leitor selecionado (pré-validação; a regra oficial é da API)
  const readerLoans = useFetch<Loan[]>(reader ? `/readers/${reader.id}/loans` : null, selectLoans, []);
  const openLoans = readerLoans.data.filter((l) => effectiveStatus(l) !== 'DEVOLVIDO');
  const hasOverdue = openLoans.some((l) => effectiveStatus(l) === 'ATRASADO');
  const atLimit = openLoans.length >= MAX_ACTIVE;
  const blocked = Boolean(reader) && !readerLoans.loading && (hasOverdue || atLimit);

  const readerMatches = useMemo(() => {
    const q = readerQuery.trim().toLowerCase();
    if (!q) return readers.data.slice(0, 8);
    const digits = q.replace(/\D/g, '');
    return readers.data
      .filter((r) => r.name.toLowerCase().includes(q) || (digits && r.cpf.replace(/\D/g, '').includes(digits)))
      .slice(0, 8);
  }, [readers.data, readerQuery]);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + LOAN_DAYS);

  async function handleSubmit() {
    if (!reader || !book) return setError('Selecione o leitor e o livro.');
    setSaving(true);
    setError(null);
    try {
      await api.post('/loans', { bookId: book.id, readerId: reader.id });
      onCreated(`Empréstimo de "${book.title}" para ${reader.name} registrado. Devolver até ${dueDate.toLocaleDateString('pt-BR')}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Novo empréstimo" open onClose={onClose} wide>
      {error && <Alert>{error}</Alert>}
      <div className="form-grid">
        <div>
          <Field label="1. Leitor" htmlFor="loan-reader">
            {reader ? (
              <div className="selected-box">
                <span>
                  <strong>{reader.name}</strong>
                  <br />
                  <small className="muted">{formatCpf(reader.cpf)}</small>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReader(null)}>
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  id="loan-reader"
                  type="search"
                  placeholder="Nome ou CPF…"
                  value={readerQuery}
                  onChange={(e) => setReaderQuery(e.target.value)}
                />
                <ul className="picker-list">
                  {readers.loading && <li className="table-state muted">Carregando…</li>}
                  {!readers.loading && readerMatches.length === 0 && (
                    <li className="table-state muted">Nenhum leitor encontrado.</li>
                  )}
                  {readerMatches.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setReader(r)}>
                        <span>{r.name}</span>
                        <small className="muted">{formatCpf(r.cpf)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Field>
          {reader && !readerLoans.loading && (
            <p style={{ marginBottom: 0 }} className={blocked ? 'text-danger' : 'muted'}>
              {hasOverdue
                ? 'Este leitor tem empréstimo atrasado e não pode pegar livros.'
                : atLimit
                  ? `Este leitor já tem ${MAX_ACTIVE} empréstimos ativos (limite).`
                  : `${openLoans.length} de ${MAX_ACTIVE} empréstimos ativos.`}
            </p>
          )}
        </div>

        <div>
          <Field label="2. Livro (somente disponíveis)" htmlFor="loan-book">
            {book ? (
              <div className="selected-box">
                <span>
                  <strong>{book.title}</strong>
                  <br />
                  <small className="muted">
                    {book.availableCopies} de {book.totalCopies} disponível(is)
                  </small>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBook(null)}>
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  id="loan-book"
                  type="search"
                  placeholder="Título…"
                  value={bookQuery}
                  onChange={(e) => setBookQuery(e.target.value)}
                />
                <ul className="picker-list">
                  {books.loading && <li className="table-state muted">Carregando…</li>}
                  {!books.loading && books.data.length === 0 && (
                    <li className="table-state muted">Nenhum livro disponível.</li>
                  )}
                  {books.data.slice(0, 8).map((b) => (
                    <li key={b.id}>
                      <button type="button" disabled={b.availableCopies <= 0} onClick={() => setBook(b)}>
                        <span>{b.title}</span>
                        <small className="muted">{b.availableCopies} disp.</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Field>
        </div>
      </div>

      <p className="muted">
        Data do empréstimo: <strong>{new Date().toLocaleDateString('pt-BR')}</strong> · Devolver até:{' '}
        <strong>{dueDate.toLocaleDateString('pt-BR')}</strong>
      </p>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!reader || !book || saving || blocked}
          onClick={handleSubmit}
        >
          {saving ? 'Registrando…' : 'Registrar empréstimo'}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Devolução com multa                                                 */
/* ------------------------------------------------------------------ */
function ReturnModal({
  loan,
  onClose,
  onReturned,
}: {
  loan: Loan | null;
  onClose: () => void;
  onReturned: (msg: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const late = loan ? daysLate(loan) : 0;
  const fine = loan ? estimatedFine(loan) : 0;

  async function handleConfirm() {
    if (!loan) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.patch(`/loans/${loan.id}/return`);
      const raw = (data?.loan ?? data) as Record<string, unknown> | undefined;
      const charged = raw && raw.fine !== undefined ? Number(raw.fine) : fine;
      onReturned(
        charged > 0
          ? `Devolução registrada. Multa cobrada: ${formatMoney(charged)}.`
          : 'Devolução registrada dentro do prazo. Sem multa.',
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Registrar devolução" open={Boolean(loan)} onClose={onClose}>
      {loan && (
        <>
          {error && <Alert>{error}</Alert>}
          <dl className="summary">
            <dt>Livro</dt>
            <dd>{loan.book?.title ?? `#${loan.bookId}`}</dd>
            <dt>Leitor</dt>
            <dd>{loan.reader?.name ?? `#${loan.readerId}`}</dd>
            <dt>Empréstimo</dt>
            <dd>{formatDate(loan.loanDate)}</dd>
            <dt>Vencimento</dt>
            <dd>{formatDate(loan.dueDate)}</dd>
            <dt>Devolução</dt>
            <dd>{new Date().toLocaleDateString('pt-BR')} (hoje)</dd>
          </dl>
          <div className={`fine-box${fine > 0 ? '' : ' ok'}`}>
            {fine > 0
              ? `${late} dia(s) de atraso · Multa: ${formatMoney(fine)}`
              : 'Dentro do prazo · Sem multa'}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleConfirm}>
              {saving ? 'Registrando…' : 'Confirmar devolução'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
