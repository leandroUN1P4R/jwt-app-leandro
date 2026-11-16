import type { Book, Loan } from './types';

export const FINE_PER_DAY = 1;
const DAY = 24 * 60 * 60 * 1000;

export function formatDate(value?: string | null) {
  if (!value) return '—';
  // "2026-11-16" (DATEONLY) deve ser lido como data local, não UTC
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR');
}

export function formatMoney(value?: number | string | null) {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

/** Dias de atraso em relação a hoje (ou à data de devolução). */
export function daysLate(loan: Loan, reference = new Date()) {
  const due = startOfDay(parseDate(loan.dueDate));
  const end = startOfDay(loan.returnDate ? parseDate(loan.returnDate) : reference);
  return Math.max(0, Math.round((end.getTime() - due.getTime()) / DAY));
}

/** Prévia da multa no front (o valor oficial é o que a API grava em `fine`). */
export function estimatedFine(loan: Loan) {
  return daysLate(loan) * FINE_PER_DAY;
}

/** Status efetivo: ATRASADO quando dueDate < hoje e não há devolução. */
export function effectiveStatus(loan: Loan) {
  if (loan.returnDate || loan.status === 'DEVOLVIDO') return 'DEVOLVIDO';
  return daysLate(loan) > 0 ? 'ATRASADO' : loan.status;
}

/* Sequelize pode serializar associações com alias minúsculo ou maiúsculo
   (book / Book, authors / Authors). Normalizamos aqui para as telas. */
type Loose = Record<string, unknown>;

export function normalizeBook(raw: Loose): Book {
  return {
    ...(raw as unknown as Book),
    category: (raw.category ?? raw.Category ?? null) as Book['category'],
    authors: (raw.authors ?? raw.Authors ?? []) as Book['authors'],
  };
}

export function normalizeLoan(raw: Loose): Loan {
  const book = (raw.book ?? raw.Book) as Loose | undefined;
  return {
    ...(raw as unknown as Loan),
    book: book ? normalizeBook(book) : null,
    reader: (raw.reader ?? raw.Reader ?? null) as Loan['reader'],
    user: (raw.user ?? raw.User ?? null) as Loan['user'],
  };
}
