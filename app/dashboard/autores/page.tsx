'use client';

import { CrudPage } from '@/components/CrudPage';
import { formatDate } from '@/lib/format';
import type { Author } from '@/lib/types';

export default function AutoresPage() {
  return (
    <CrudPage<Author>
      title="Autores"
      subtitle="Autores cadastrados no acervo"
      singular="Autor"
      endpoint="/authors"
      searchKeys={['name', 'nationality']}
      fields={[
        { name: 'name', label: 'Nome', required: true, span: true },
        { name: 'nationality', label: 'Nacionalidade', placeholder: 'Ex.: Brasileira' },
        { name: 'birthDate', label: 'Data de nascimento', type: 'date' },
      ]}
      columns={[
        { label: 'Nome', render: (a) => <strong>{a.name}</strong> },
        { label: 'Nacionalidade', render: (a) => a.nationality || <span className="muted">—</span> },
        { label: 'Nascimento', render: (a) => formatDate(a.birthDate) },
      ]}
    />
  );
}
