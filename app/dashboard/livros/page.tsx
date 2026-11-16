'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Alert, Field, Modal, PageHeader, TableState } from '@/components/ui';
import api, { asList, getErrorMessage } from '@/lib/api';
import { normalizeBook } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import type { Author, Book, Category } from '@/lib/types';

const selectBooks = (raw: unknown) => asList<Record<string, unknown>>(raw).map(normalizeBook);
const selectCategories = (raw: unknown) => asList<Category>(raw);
const selectAuthors = (raw: unknown) => asList<Author>(raw);

interface BookForm {
  title: string;
  isbn: string;
  year: string;
  totalCopies: string;
  categoryId: string;
  authorIds: number[];
}

const EMPTY_FORM: BookForm = { title: '', isbn: '', year: '', totalCopies: '1', categoryId: '', authorIds: [] };

export default function LivrosPage() {
  const { isAdmin } = useAuth();

  // Filtros enviados para a API: /books?title=&categoryId=&authorId=&available=true
  const [title, setTitle] = useState('');
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTitle(title.trim()), 350);
    return () => clearTimeout(t);
  }, [title]);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedTitle) p.set('title', debouncedTitle);
    if (categoryId) p.set('categoryId', categoryId);
    if (authorId) p.set('authorId', authorId);
    if (available) p.set('available', 'true');
    const qs = p.toString();
    return qs ? `/books?${qs}` : '/books';
  }, [debouncedTitle, categoryId, authorId, available]);

  const { data: books, loading, error, reload } = useFetch<Book[]>(url, selectBooks, []);
  const { data: categories } = useFetch<Category[]>('/categories', selectCategories, []);
  const { data: authors } = useFetch<Author[]>('/authors', selectAuthors, []);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<BookForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function openForm(book: Book | null) {
    setEditing(book);
    setFormError(null);
    setForm(
      book
        ? {
            title: book.title,
            isbn: book.isbn,
            year: book.year ? String(book.year) : '',
            totalCopies: String(book.totalCopies ?? 1),
            categoryId: String(book.categoryId ?? book.category?.id ?? ''),
            authorIds: (book.authors ?? []).map((a) => a.id),
          }
        : EMPTY_FORM,
    );
    setOpen(true);
  }

  function toggleAuthor(id: number) {
    setForm((f) => ({
      ...f,
      authorIds: f.authorIds.includes(id) ? f.authorIds.filter((x) => x !== id) : [...f.authorIds, id],
    }));
  }

  function validate(): string | null {
    if (!form.title.trim()) return 'Informe o título.';
    if (!form.isbn.trim()) return 'Informe o ISBN.';
    const digits = form.isbn.replace(/[^0-9Xx]/g, '');
    if (digits.length !== 10 && digits.length !== 13) return 'O ISBN deve ter 10 ou 13 dígitos.';
    const year = Number(form.year);
    if (form.year && (!Number.isInteger(year) || year < 0 || year > new Date().getFullYear() + 1))
      return 'Ano inválido.';
    const total = Number(form.totalCopies);
    if (!Number.isInteger(total) || total < 1) return 'O total de exemplares deve ser pelo menos 1.';
    if (editing) {
      const borrowed = editing.totalCopies - editing.availableCopies;
      if (total < borrowed) return `Há ${borrowed} exemplar(es) emprestado(s); o total não pode ser menor que isso.`;
    }
    if (!form.categoryId) return 'Selecione a categoria.';
    if (form.authorIds.length === 0) return 'Selecione pelo menos um autor.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setFormError(msg);
      return;
    }
    const payload = {
      title: form.title.trim(),
      isbn: form.isbn.trim(),
      year: form.year ? Number(form.year) : null,
      totalCopies: Number(form.totalCopies),
      categoryId: Number(form.categoryId),
      authorIds: form.authorIds,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.put(`/books/${editing.id}`, payload);
      else await api.post('/books', payload);
      setOpen(false);
      setFeedback({ kind: 'success', text: `Livro ${editing ? 'atualizado' : 'cadastrado'} com sucesso.` });
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(book: Book) {
    if (!window.confirm(`Excluir o livro "${book.title}"?`)) return;
    try {
      await api.delete(`/books/${book.id}`);
      setFeedback({ kind: 'success', text: `"${book.title}" excluído.` });
      reload();
    } catch (err) {
      setFeedback({ kind: 'error', text: getErrorMessage(err) });
    }
  }

  const colSpan = isAdmin ? 7 : 6;

  return (
    <>
      <PageHeader
        title="Livros"
        subtitle="Acervo com busca por título, categoria, autor e disponibilidade"
        actions={
          isAdmin && (
            <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
              + Novo livro
            </button>
          )
        }
      />

      {feedback && (
        <Alert kind={feedback.kind} onClose={() => setFeedback(null)}>
          {feedback.text}
        </Alert>
      )}

      <div className="filters">
        <input
          type="search"
          placeholder="Buscar por título…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Buscar por título"
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} aria-label="Autor">
          <option value="">Todos os autores</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
          Só disponíveis
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Autor(es)</th>
              <th>Categoria</th>
              <th>ISBN</th>
              <th>Ano</th>
              <th>Disponíveis</th>
              {isAdmin && <th className="text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} error={error} empty={books.length === 0} colSpan={colSpan} />
            {!loading &&
              !error &&
              books.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.title}</strong>
                  </td>
                  <td>{b.authors?.map((a) => a.name).join(', ') || <span className="muted">—</span>}</td>
                  <td>{b.category?.name ?? categories.find((c) => c.id === b.categoryId)?.name ?? '—'}</td>
                  <td className="nowrap">{b.isbn}</td>
                  <td>{b.year ?? '—'}</td>
                  <td>
                    <span className={`badge ${b.availableCopies > 0 ? 'badge-success' : 'badge-danger'}`}>
                      {b.availableCopies} de {b.totalCopies}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="actions-cell">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openForm(b)}>
                          Editar
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(b)}>
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

      <Modal title={editing ? 'Editar livro' : 'Novo livro'} open={open} onClose={() => setOpen(false)} wide>
        <form onSubmit={handleSubmit} noValidate>
          {formError && <Alert>{formError}</Alert>}
          <div className="form-grid">
            <div className="span-2">
              <Field label="Título *" htmlFor="b-title">
                <input id="b-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
            </div>
            <Field label="ISBN *" htmlFor="b-isbn" hint="10 ou 13 dígitos">
              <input id="b-isbn" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            </Field>
            <Field label="Ano" htmlFor="b-year">
              <input
                id="b-year"
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              />
            </Field>
            <Field
              label="Total de exemplares *"
              htmlFor="b-total"
              hint={editing ? `Disponíveis hoje: ${editing.availableCopies}` : undefined}
            >
              <input
                id="b-total"
                type="number"
                min={1}
                value={form.totalCopies}
                onChange={(e) => setForm({ ...form, totalCopies: e.target.value })}
              />
            </Field>
            <Field label="Categoria *" htmlFor="b-cat">
              <select
                id="b-cat"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Selecione…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="span-2">
              <Field label={`Autores * (${form.authorIds.length} selecionado(s))`}>
                <div className="check-list">
                  {authors.length === 0 && <span className="muted">Cadastre autores primeiro.</span>}
                  {authors.map((a) => (
                    <label key={a.id}>
                      <input
                        type="checkbox"
                        checked={form.authorIds.includes(a.id)}
                        onChange={() => toggleAuthor(a.id)}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
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
    </>
  );
}
