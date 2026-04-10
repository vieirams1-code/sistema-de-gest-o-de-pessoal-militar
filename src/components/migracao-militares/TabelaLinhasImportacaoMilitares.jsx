import React from 'react';
import { Badge } from '@/components/ui/badge';

const STATUS_CLASS = {
  APTO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  APTO_COM_ALERTA: 'bg-amber-100 text-amber-800 border-amber-200',
  REVISAR: 'bg-orange-100 text-orange-800 border-orange-200',
  IGNORADO: 'bg-slate-100 text-slate-700 border-slate-200',
  ERRO: 'bg-rose-100 text-rose-800 border-rose-200',
};

function StatusBadge({ status }) {
  return <Badge className={STATUS_CLASS[status] || 'bg-slate-100 text-slate-700 border-slate-200'}>{status}</Badge>;
}

export default function TabelaLinhasImportacaoMilitares({ linhas, onSelecionarLinha }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Matrícula</th>
              <th className="text-left p-2">Posto/Graduação</th>
              <th className="text-left p-2">CPF</th>
              <th className="text-left p-2">Principal motivo</th>
              <th className="text-left p-2">Observações</th>
              <th className="text-left p-2">Importada</th>
              <th className="text-left p-2">Ajustes automáticos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr
                key={linha.id}
                onClick={() => onSelecionarLinha(linha)}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <td className="p-2"><StatusBadge status={linha.status} /></td>
                <td className="p-2">{linha.nome || '—'}</td>
                <td className="p-2">{linha.matricula || '—'}</td>
                <td className="p-2">{linha.posto || '—'}</td>
                <td className="p-2">{linha.cpf || '—'}</td>
                <td className="p-2 max-w-[320px] truncate" title={linha.principalMotivo}>{linha.principalMotivo}</td>
                <td className="p-2 max-w-[240px] truncate" title={linha.observacoes.join(' | ')}>{linha.observacoes[0] || '—'}</td>
                <td className="p-2">{linha.importada ? 'Sim' : 'Não'}</td>
                <td className="p-2 max-w-[240px] truncate" title={linha.ajustesAutomaticos.join(' | ')}>{linha.ajustesAutomaticos[0] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
