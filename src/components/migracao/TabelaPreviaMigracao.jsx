import React from 'react';
import { Badge } from '@/components/ui/badge';

const statusLabel = {
  APTO: 'Apto',
  APTO_COM_ALERTA: 'Apto c/ alerta',
  DUPLICADO: 'Duplicado',
  ERRO: 'Erro',
};

const statusClass = {
  APTO: 'bg-emerald-100 text-emerald-800',
  APTO_COM_ALERTA: 'bg-amber-100 text-amber-800',
  DUPLICADO: 'bg-indigo-100 text-indigo-800',
  ERRO: 'bg-rose-100 text-rose-800',
};

export default function TabelaPreviaMigracao({ linhas, onSelectLinha }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Matrícula final</th>
              <th className="text-left p-3">Posto/Graduação</th>
              <th className="text-left p-3">Quadro</th>
              <th className="text-left p-3">Data inclusão</th>
              <th className="text-left p-3">CPF</th>
              <th className="text-left p-3">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.linhaNumero} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => onSelectLinha(linha)}>
                <td className="p-3"><Badge className={statusClass[linha.status]}>{statusLabel[linha.status]}</Badge></td>
                <td className="p-3">{linha.transformado.nome_completo || '—'}</td>
                <td className="p-3">{linha.transformado.matricula || '—'}</td>
                <td className="p-3">{linha.transformado.posto_graduacao || '—'}</td>
                <td className="p-3">{linha.transformado.quadro || '—'}</td>
                <td className="p-3">{linha.transformado.data_inclusao || '—'}</td>
                <td className="p-3">{linha.transformado.cpf || '—'}</td>
                <td className="p-3">{linha.alertas.slice(0, 1).join(' ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
