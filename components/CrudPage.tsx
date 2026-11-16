'use client';

import { useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import { Alert, Field, Modal, PageHeader, TableState } from './ui';
import api, { asList, getErrorMessage } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';

export interface CrudField {
  name: string;
  label: string;
  type?: 'text' | 'date' | 'textarea';
  required?: boolean;
  span?: boolean;
  placeholder?: string;
}

export interface CrudColumn<T> {
  label: string;
  render: (item: T) => React.ReactNode;
}

interface Props<T extends { id: number }> {
  title: string;
  subtitle: string;
  singular: string;
  endpoint: string;
  fields: CrudField[];
  columns: CrudColumn<T>[];
  searchKeys: (keyof T)[];
}

const selectList = (raw: unknown) => asList<never>(raw);

/**
 * CRUD genérico (listagem + busca + cadastro/edição em modal + exclusão).
 * Leitura liberada para todos; escrita só aparece para administradores.
 * Erros da API (ex.: 409 ao excluir com vínculos) são exibidos no alerta.
 */
export function CrudPage<T extends { id: number }>({
  title,
  subtitle,
  singular,
  endpoint,
  fields,
  columns,
  searchKeys,
}: Props<T>) {
  const { isAdmin } = useAuth();
  const { data: items, loading, error, reload } = useFetch<T[]>(endpoint, selectList, []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => searchKeys.some((k) => String(it[k] ?? '').toLowerCase().includes(q)));
  }, [items, search, searchKeys]);

  function openForm(item: T | null) {
    setEditing(item);
    setFormError(null);
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const v = item ? (item as Record<string, unknown>)[f.name] : '';
      initial[f.name] = v == null ? '' : f.type === 'date' ? String(v).slice(0, 10) : String(v);
    }
    setForm(initial);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = fields.find((f) => f.required && !form[f.name]?.trim());
    if (missing) {
      setFormError(`O campo "${missing.label}" é obrigatório.`);
      return;
    }
    const payload: Record<string, string | null> = {};
    for (const f of fields) payload[f.name] = form[f.name]?.trim() || null;

    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.put(`${endpoint}/${editing.id}`, payload);
      else await api.post(endpoint, payload);
      setOpen(false);
      setFeedback({ kind: 'success', text: `${singular} ${editing ? 'atualizado(a)' : 'cadastrado(a)'} com sucesso.` });
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: T) {
    const label = String((item as Record<string, unknown>).name ?? `#${item.id}`);
    if (!window.confirm(`Excluir "${label}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`${endpoint}/${item.id}`);
      setFeedback({ kind: 'success', text: `"${label}" excluído(a).` });
      reload();
    } catch (err) {
      setFeedback({ kind: 'error', text: getErrorMessage(err) });
    }
  }

  const colSpan = columns.length + (isAdmin ? 1 : 0);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          isAdmin && (
            <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
              + Novo(a) {singular.toLowerCase()}
            </button>
          )
        }
      />

      {feedback && (
        <Alert kind={feedback.kind} onClose={() => setFeedback(null)}>
          {feedback.text}
        </Alert>
      )}

      <div className="filters" style={{ gridTemplateColumns: '1fr' }}>
        <input
          type="search"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar"
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.label}>{c.label}</th>
              ))}
              {isAdmin && <th className="text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} error={error} empty={filtered.length === 0} colSpan={colSpan} />
            {!loading &&
              !error &&
              filtered.map((item) => (
                <tr key={item.id}>
                  {columns.map((c) => (
                    <td key={c.label}>{c.render(item)}</td>
                  ))}
                  {isAdmin && (
                    <td>
                      <div className="actions-cell">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openForm(item)}>
                          Editar
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal title={`${editing ? 'Editar' : 'Novo(a)'} ${singular.toLowerCase()}`} open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} noValidate>
          {formError && <Alert>{formError}</Alert>}
          <div className="form-grid">
            {fields.map((f) => (
              <div key={f.name} className={f.span ? 'span-2' : undefined}>
                <Field label={`${f.label}${f.required ? ' *' : ''}`} htmlFor={`f-${f.name}`}>
                  {f.type === 'textarea' ? (
                    <textarea
                      id={`f-${f.name}`}
                      rows={3}
                      value={form[f.name] ?? ''}
                      placeholder={f.placeholder}
                      onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    />
                  ) : (
                    <input
                      id={`f-${f.name}`}
                      type={f.type ?? 'text'}
                      value={form[f.name] ?? ''}
                      placeholder={f.placeholder}
                      required={f.required}
                      onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    />
                  )}
                </Field>
              </div>
            ))}
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
    </>
  );
}
