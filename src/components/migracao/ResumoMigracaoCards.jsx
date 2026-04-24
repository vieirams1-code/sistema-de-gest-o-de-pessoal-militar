import React from 'react';

const itensMigracao = [
  { key: 'total_linhas', label: 'Total de registros', cor: 'text-slate-700' },
  { key: 'total_aptas', label: 'Aptas', cor: 'text-emerald-700' },
  { key: 'total_aptas_com_alerta', label: 'Aptas com alerta', cor: 'text-amber-700' },
  { key: 'total_duplicadas', label: 'Duplicadas', cor: 'text-indigo-700' },
  { key: 'total_erros', label: 'Com erro', cor: 'text-rose-700' },
];

const itensConferencia = [
  { key: 'total_linhas', label: 'Total de linhas', cor: 'text-slate-700' },
  { key: 'encontrados_por_cpf', label: 'Encontrados CPF', cor: 'text-emerald-700' },
  { key: 'encontrados_por_matricula', label: 'Encontrados matrícula', cor: 'text-indigo-700' },
  { key: 'encontrados_por_nome', label: 'Encontrados nome', cor: 'text-amber-700' },
  { key: 'nao_encontrados', label: 'Não encontrados', cor: 'text-slate-700' },
  { key: 'divergentes', label: 'Divergentes', cor: 'text-rose-700' },
  { key: 'possiveis_duplicidades', label: 'Possíveis duplicidades', cor: 'text-fuchsia-700' },
];

export default function ResumoMigracaoCards({ resumo, modo = 'IMPORTAR' }) {
  const itens = modo === 'CONFERIR' ? itensConferencia : itensMigracao;
  return (
    <div className={`grid grid-cols-1 ${modo === 'CONFERIR' ? 'md:grid-cols-7' : 'md:grid-cols-5'} gap-3`}>
      {itens.map((item) => (
        <div key={item.key} className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">{item.label}</p>
          <p className={`text-2xl font-bold mt-1 ${item.cor}`}>{resumo?.[item.key] || 0}</p>
        </div>
      ))}
    </div>
  );
}
