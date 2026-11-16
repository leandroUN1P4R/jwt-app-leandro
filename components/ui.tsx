'use client';

import { useEffect, useRef } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Alert({
  kind = 'error',
  children,
  onClose,
}: {
  kind?: 'error' | 'success' | 'info';
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      )}
    </div>
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal-wide' : ''}`}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <div className="modal-body">
          <div className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}

export function TableState({
  loading,
  error,
  empty,
  colSpan,
  emptyText = 'Nenhum registro encontrado.',
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  colSpan: number;
  emptyText?: string;
}) {
  if (loading)
    return (
      <tr>
        <td colSpan={colSpan} className="table-state">Carregando…</td>
      </tr>
    );
  if (error)
    return (
      <tr>
        <td colSpan={colSpan} className="table-state text-danger">{error}</td>
      </tr>
    );
  if (empty)
    return (
      <tr>
        <td colSpan={colSpan} className="table-state muted">{emptyText}</td>
      </tr>
    );
  return null;
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'ATRASADO' ? 'badge-danger' : status === 'DEVOLVIDO' ? 'badge-muted' : 'badge-success';
  return <span className={`badge ${cls}`}>{status}</span>;
}
