'use client';

import { useState } from 'react';
import { AdminOnly } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { Alert, Field, Modal, PageHeader, TableState } from '@/components/ui';
import api, { asList, getErrorMessage } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { User } from '@/lib/types';

const selectUsers = (raw: unknown) => asList<User>(raw);
const EMPTY = { name: '', username: '', email: '', password: '', isAdmin: false };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AtendentesPage() {
  return (
    <AdminOnly>
      <Atendentes />
    </AdminOnly>
  );
}

function Atendentes() {
  const { user: me } = useAuth();
  const { data: users, loading, error, reload, setData } = useFetch<User[]>('/user', selectUsers, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function openForm(u: User | null) {
    setEditing(u);
    setFormError(null);
    setForm(
      u
        ? { name: u.name, username: u.username ?? '', email: u.email, password: '', isAdmin: u.isAdmin }
        : EMPTY,
    );
    setOpen(true);
  }

  function validate() {
    if (!form.name.trim()) return 'Informe o nome.';
    if (!form.username.trim()) return 'Informe o nome de usuário.';
    if (!EMAIL_RE.test(form.email.trim())) return 'E-mail inválido.';
    if (!editing && form.password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
    if (editing && form.password && form.password.length < 6) return 'A nova senha deve ter pelo menos 6 caracteres.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) return setFormError(msg);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      isAdmin: form.isAdmin,
    };
    if (form.password) payload.password = form.password;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.put(`/user/${editing.id}`, payload);
      else await api.post('/user', payload);
      setOpen(false);
      setFeedback({ kind: 'success', text: `Atendente ${editing ? 'atualizado' : 'cadastrado'} com sucesso.` });
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    const next = u.active === false;
    if (!next && !window.confirm(`Desativar ${u.name}? Ele(a) não conseguirá mais fazer login.`)) return;
    try {
      await api.patch(`/user/${u.id}/active`, { active: next });
      setData((list) => list.map((x) => (x.id === u.id ? { ...x, active: next } : x)));
      setFeedback({ kind: 'success', text: `${u.name} ${next ? 'ativado(a)' : 'desativado(a)'}.` });
    } catch (err) {
      setFeedback({ kind: 'error', text: getErrorMessage(err) });
    }
  }

  return (
    <>
      <PageHeader
        title="Atendentes"
        subtitle="Usuários com acesso ao sistema"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
            + Novo atendente
          </button>
        }
      />

      {feedback && (
        <Alert kind={feedback.kind} onClose={() => setFeedback(null)}>
          {feedback.text}
        </Alert>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Situação</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} error={error} empty={users.length === 0} colSpan={6} />
            {!loading &&
              !error &&
              users.map((u) => {
                const active = u.active !== false;
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong> {isMe && <span className="muted">(você)</span>}
                    </td>
                    <td>{u.username ?? '—'}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.isAdmin ? 'badge-warning' : 'badge-muted'}`}>
                        {u.isAdmin ? 'Administrador' : 'Atendente'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${active ? 'badge-success' : 'badge-danger'}`}>
                        {active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openForm(u)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${active ? 'btn-danger' : 'btn-success'}`}
                          disabled={isMe}
                          title={isMe ? 'Você não pode desativar a própria conta' : undefined}
                          onClick={() => toggleActive(u)}
                        >
                          {active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? 'Editar atendente' : 'Novo atendente'} open={open} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} noValidate>
          {formError && <Alert>{formError}</Alert>}
          <div className="form-grid">
            <div className="span-2">
              <Field label="Nome *" htmlFor="u-name">
                <input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <Field label="Usuário *" htmlFor="u-username">
              <input
                id="u-username"
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>
            <Field label="E-mail *" htmlFor="u-email">
              <input
                id="u-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <div className="span-2">
              <Field
                label={editing ? 'Nova senha' : 'Senha *'}
                htmlFor="u-password"
                hint={editing ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 6 caracteres.'}
              >
                <input
                  id="u-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
            </div>
            <label className="span-2 row">
              <input
                type="checkbox"
                checked={form.isAdmin}
                disabled={editing?.id === me?.id}
                onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })}
              />
              Administrador (gerencia acervo, atendentes e relatórios)
            </label>
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
