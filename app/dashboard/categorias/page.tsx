'use client';

import { CrudPage } from '@/components/CrudPage';
import type { Category } from '@/lib/types';

export default function CategoriasPage() {
  return (
    <CrudPage<Category>
      title="Categorias"
      subtitle="Organização do acervo por assunto"
      singular="Categoria"
      endpoint="/categories"
      searchKeys={['name', 'description']}
      fields={[
        { name: 'name', label: 'Nome', required: true, span: true },
        { name: 'description', label: 'Descrição', type: 'textarea', span: true },
      ]}
      columns={[
        { label: 'Nome', render: (c) => <strong>{c.name}</strong> },
        { label: 'Descrição', render: (c) => c.description || <span className="muted">—</span> },
      ]}
    />
  );
}
