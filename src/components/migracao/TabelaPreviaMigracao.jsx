import React from 'react';
import { Badge } from '@/components/ui/badge';

const statusLabel = {
  APTO: 'Apto',
  APTO_COM_ALERTA: 'Apto c/ alerta',
  DUPLICADO: 'Duplicado',
  ERRO: 'Erro',
  ENCONTRADO_POR_CPF: 'Encontrado por CPF',
  ENCONTRADO_POR_MATRICULA: 'Encontrado por Matrícula',
  ENCONTRADO_POR_NOME: 'Encontrado por Nome',
  ENCONTRADO_MULTIPLO: 'Encontrado Múltiplo',
  NAO_ENCONTRADO: 'Não encontrado',
  DIVERGENTE: 'Divergente',
};

const statusClass = {
  APTO: 'bg-emerald-100 text-emerald-800',
  APTO_COM_ALERTA: 'bg-amber-100 text-amber-800',
  DUPLICADO: 'bg-indigo-100 text-indigo-800',
  ERRO: 'bg-rose-100 text-rose-800',
  ENCONTRADO_POR_CPF: 'bg-emerald-100 text-emerald-800',
  ENCONTRADO_POR_MATRICULA: 'bg-indigo-100 text-indigo-800',
  ENCONTRADO_POR_NOME: 'bg-amber-100 text-amber-800',
  ENCONTRADO_MULTIPLO: 'bg-fuchsia-100 text-fuchsia-800',
  NAO_ENCONTRADO: 'bg-slate-100 text-slate-800',
  DIVERGENTE: 'bg-rose-100 text-rose-800',
};

export default function TabelaPreviaMigracao({ linhas, onSelectLinha, modo = 'IMPORTAR' }) {
  const isConferencia = modo === 'CONFERIR';
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Matrícula</th>
              {isConferencia ? <th className="text-left p-3">Campo match</th> : <th className="text-left p-3">Posto/Graduação</th>}
              <th className="text-left p-3">Data inclusão</th>
              <th className="text-left p-3">CPF</th>
              <th className="text-left p-3">{isConferencia ? 'Divergências' : 'Alertas'}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.linhaNumero} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => onSelectLinha(linha)}>
                <td className="p-3"><Badge className={statusClass[linha.status || linha.status_conferencia]}>{statusLabel[linha.status || linha.status_conferencia]}</Badge></td>
                <td className="p-3">{(linha.transformado?.nome_completo || linha.dados_planilha?.nome_completo) || '—'}</td>
                <td className="p-3">{(linha.transformado?.matricula || linha.dados_planilha?.matricula) || '—'}</td>
                {isConferencia ? <td className="p-3">{linha.campo_match || '—'}</td> : <td className="p-3">{linha.transformado?.posto_graduacao || '—'}</td>}
                <td className="p-3">{(linha.transformado?.data_inclusao || linha.dados_planilha?.data_inclusao) || '—'}</td>
                <td className="p-3">{(linha.transformado?.cpf || linha.dados_planilha?.cpf) || '—'}</td>
                <td className="p-3">{(isConferencia ? linha.divergencias : linha.alertas)?.slice(0, 1).join(' ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
