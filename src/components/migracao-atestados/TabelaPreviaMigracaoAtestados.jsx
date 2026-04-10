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

export default function TabelaPreviaMigracaoAtestados({ linhas, onSelectLinha }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Militar</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Médico</th>
              <th className="text-left p-3">CID</th>
              <th className="text-left p-3">Data início</th>
              <th className="text-left p-3">Data término</th>
              <th className="text-left p-3">Dias</th>
              <th className="text-left p-3">Status publicação</th>
              <th className="text-left p-3">Motivo principal</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.linhaNumero} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => onSelectLinha(linha)}>
                <td className="p-3"><Badge className={statusClass[linha.status]}>{statusLabel[linha.status]}</Badge></td>
                <td className="p-3">{linha.transformado.militar_nome || linha.original.militar || '—'}</td>
                <td className="p-3">{linha.transformado.tipo_afastamento || '—'}</td>
                <td className="p-3">{linha.transformado.medico || '—'}</td>
                <td className="p-3">{[linha.transformado.cid_10, linha.transformado.cid_descricao].filter(Boolean).join(' - ') || '—'}</td>
                <td className="p-3">{linha.transformado.data_inicio_br || '—'}</td>
                <td className="p-3">{linha.transformado.data_termino_br || '—'}</td>
                <td className="p-3">{linha.transformado.dias || '—'}</td>
                <td className="p-3">{linha.transformado.status_publicacao || '—'}</td>
                <td className="p-3">{motivoPrincipal(linha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
