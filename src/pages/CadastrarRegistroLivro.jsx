import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { isRegistroFilhoDePublicacaoCompilada } from '@/components/publicacao/publicacaoCompiladaService';

const MENSAGEM_BLOQUEIO = 'Registro vinculado a publicação compilada. Edite o lote pai.';

export default function CadastrarRegistroLivro() {
  const [searchParams] = useSearchParams();

  const id = searchParams.get('id');
  const dest = id ? `${createPageUrl('CadastrarRegistroRP')}?id=${id}` : createPageUrl('CadastrarRegistroRP');

  const { data: registro, isLoading } = useQuery({
    queryKey: ['registro-livro-redirecionamento', id],
    queryFn: async () => {
      const registros = await base44.entities.RegistroLivro.filter({ id });
      return registros?.[0] || null;
    },
    enabled: !!id,
  });

  if (!id) {
    return <Navigate to={dest} replace />;
  }

  if (isLoading) {
    return null;
  }

  if (isRegistroFilhoDePublicacaoCompilada(registro)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xl rounded-2xl border border-indigo-200 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-indigo-900">{MENSAGEM_BLOQUEIO}</p>
        </div>
      </div>
    );
  }

  return <Navigate to={dest} replace />;
}
