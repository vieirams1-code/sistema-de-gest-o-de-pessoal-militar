import React from 'react';
import { Badge } from '@/components/ui/badge';

const statusLabel = {
  APTO: 'Apto',
  APTO_COM_ALERTA: 'Apto com alerta',
  REVISAR: 'Revisar',
  IGNORADO: 'Ignorado',
  ERRO: 'Erro',
};

const statusClass = {
  APTO: 'bg-emerald-100 text-emerald-800',
  APTO_COM_ALERTA: 'bg-amber-100 text-amber-800',
  REVISAR: 'bg-indigo-100 text-indigo-800',
  IGNORADO: 'bg-slate-100 text-slate-700',
  ERRO: 'bg-rose-100 text-rose-800',
};

function motivoPrincipal(linha) {
  if (linha.erros?.length) return linha.erros[0];
  if (linha.revisoes?.length) return linha.revisoes[0];
  if (linha.alertas?.length) return linha.alertas[0];
  return '—';
}

export default function TabelaPreviaMigracaoAlteracoesLegado({ linhas, onSelectLinha }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Militar legado</th>
              <th className="text-left p-3">Matrícula legado</th>
              <th className="text-left p-3">Militar vinculado</th>
              <th className="text-left p-3">Matéria legado</th>
              <th className="text-left p-3">Tipo BG legado</th>
              <th className="text-left p-3">BG número</th>
              <th className="text-left p-3">Data publicação</th>
              <th className="text-left p-3">Motivo principal</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.linhaNumero} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => onSelectLinha(linha)}>
                <td className="p-3"><Badge className={statusClass[linha.status]}>{statusLabel[linha.status]}</Badge></td>
                <td className="p-3">{linha.transformado.nome_completo_legado || linha.transformado.nome_guerra_legado || '—'}</td>
                <td className="p-3">{linha.transformado.matricula_legado || '—'}</td>
                <td className="p-3">{linha.transformado.militar_nome || '—'}</td>
                <td className="p-3">{linha.transformado.materia_legado || '—'}</td>
                <td className="p-3">{linha.transformado.tipo_bg_legado || '—'}</td>
                <td className="p-3">{linha.transformado.numero_bg || '—'}</td>
                <td className="p-3">{linha.transformado.data_bg_br || '—'}</td>
                <td className="p-3">{motivoPrincipal(linha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
