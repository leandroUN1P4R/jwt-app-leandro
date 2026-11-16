'use client';

import { useMemo, useState } from 'react';
import { Alert, Field, Modal, PageHeader, StatusBadge, TableState } from '@/components/ui';
import api, { asList, getErrorMessage } from '@/lib/api';
import {
  effectiveStatus,
  estimatedFine,
  formatCpf,
  formatDate,
  formatMoney,
  formatPhone,
  normalizeLoan,
} from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import type { Loan, Reader } from '@/lib/types';

const selectReaders = (raw: unknown) => asList<Reader>(raw);
const selectLoans = (raw: unknown) => asList<Record<string, unknown>>(raw).map(normalizeLoan);

const EMPTY = { name: '', cpf: '', email: '', phone: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LeitoresPage() {
  const { data: readers, loading, error, reload } = useFetch<Reader[]>('/readers', selectReaders, []);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reader | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<Reader | null>(null);

  const history = useFetch<Loan[]>(historyOf ? `/readers/${historyOf.id}/loans` : null, selectLoans, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    if (!q) return readers;
    return readers.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (qDigits && r.cpf.replace(/\D/g, '').includes(qDigits)),
    );
  }, [readers, search]);

  function openForm(reader: Reader | null) {
    setEditing(reader);
    setFormError(null);
    setForm(
      reader
        ? {
            name: reader.name,
            cpf: formatCpf(reader.cpf),
            email: reader.email ?? '',
            phone: reader.phone ? formatPhone(reader.phone) : '',
          }
        : EMPTY,
    );
    setOpen(true);
  }

  function validate() {
    if (!form.name.trim()) return 'Informe o nome.';
    if (form.cpf.replace(/\D/g, '').length !== 11) return 'O CPF deve ter 11 dígitos.';
    if (form.email && !EMAIL_RE.test(form.email.trim())) return 'E-mail inválido.';
    const phone = form.phone.replace(/\D/g, '');
    if (phone && phone.length < 10) return 'Telefone inválido (DDD + número).';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) return setFormError(msg);
    const payload = {
      name: form.name.trim(),
      cpf: form.cpf.replace(/\D/g, ''),
      email: form.email.trim() || null,
      phone: form.phone.replace(/\D/g, '') || null,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.put(`/readers/${editing.id}`, payload);
      else await api.post('/readers', payload);
      setOpen(false);
      setFeedback(`Leitor ${editing ? 'atualizado' : 'cadastrado'} com sucesso.`);
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const activeCount = history.data.filter((l) => effectiveStatus(l) !== 'DEVOLVIDO').length;
  const totalFines = history.data.reduce((sum, l) => sum + Number(l.fine ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Leitores"
        subtitle="Cadastro de leitores e histórico de empréstimos"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
            + Novo leitor
          </button>
        }
      />

      {feedback && (
        <Alert kind="success" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      <div className="filters" style={{ gridTemplateColumns: '1fr' }}>
        <input
          type="search"
          placeholder="Buscar por nome, CPF ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar leitor"
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>E-mail</th>
              <th>Telefone</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} error={error} empty={filtered.length === 0} colSpan={5} />
            {!loading &&
              !error &&
              filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td className="nowrap">{formatCpf(r.cpf)}</td>
                  <td>{r.email || <span className="muted">—</span>}</td>
                  <td className="nowrap">{r.phone ? formatPhone(r.phone) : <span className="muted">—</span>}</td>
                  <td>
                    <div className="actions-cell">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHistoryOf(r)}>
                        Histórico
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openForm(r)}>
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? 'Editar leitor' : 'Novo leitor'} open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} noValidate>
          {formError && <Alert>{formError}</Alert>}
          <div className="form-grid">
            <div className="span-2">
              <Field label="Nome *" htmlFor="r-name">
                <input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <Field label="CPF *" htmlFor="r-cpf">
              <input
                id="r-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
              />
            </Field>
            <Field label="Telefone" htmlFor="r-phone">
              <input
                id="r-phone"
                inputMode="tel"
                placeholder="(44) 99999-9999"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
              />
            </Field>
            <div className="span-2">
              <Field label="E-mail" htmlFor="r-email">
                <input
                  id="r-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={`Histórico de ${historyOf?.name ?? ''}`}
        open={Boolean(historyOf)}
        onClose={() => setHistoryOf(null)}
        wide
      >
        {!history.loading && !history.error && (
          <p className="muted" style={{ marginTop: 0 }}>
            {history.data.length} empréstimo(s) · {activeCount} em aberto (máx. 3) · multas pagas: {formatMoney(totalFines)}
          </p>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Livro</th>
                <th>Empréstimo</th>
                <th>Vencimento</th>
                <th>Devolução</th>
                <th>Status</th>
                <th>Multa</th>
              </tr>
            </thead>
            <tbody>
              <TableState
                loading={history.loading}
                error={history.error}
                empty={history.data.length === 0}
                colSpan={6}
                emptyText="Este leitor ainda não fez empréstimos."
              />
              {!history.loading &&
                !history.error &&
                history.data.map((l) => {
                  const status = effectiveStatus(l);
                  return (
                    <tr key={l.id}>
                      <td>{l.book?.title ?? `#${l.bookId}`}</td>
                      <td>{formatDate(l.loanDate)}</td>
                      <td>{formatDate(l.dueDate)}</td>
                      <td>{formatDate(l.returnDate)}</td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td>
                        {status === 'DEVOLVIDO'
                          ? formatMoney(l.fine)
                          : status === 'ATRASADO'
                            ? <span className="text-danger">{formatMoney(estimatedFine(l))} (prévia)</span>
                            : '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
