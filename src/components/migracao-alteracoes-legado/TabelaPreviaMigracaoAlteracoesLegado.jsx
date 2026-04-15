import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function resumoTrecho(texto) {
  const valor = String(texto || '').trim();
  if (!valor) return 'Sem trecho legado';
  return valor.length > 100 ? `${valor.slice(0, 100)}...` : valor;
}

export default function TabelaPreviaMigracaoAlteracoesLegado({
  linhas,
  tiposPublicacaoValidos = [],
  onSelectLinha,
  onSelecionarTipoPublicacao,
}) {
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
              <th className="text-left p-3">Tipo sugerido</th>
              <th className="text-left p-3">Confiança</th>
              <th className="text-left p-3">Tipo final</th>
              <th className="text-left p-3">Revisão tipo</th>
              <th className="text-left p-3">Trecho legado</th>
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
                <td className="p-3">{linha.transformado.tipo_publicacao_sugerido || '—'}</td>
                <td className="p-3">{linha.transformado.confianca_classificacao || '—'}</td>
                <td className="p-3">
                  <div onClick={(event) => event.stopPropagation()}>
                    <Select
                      value={linha.transformado.tipo_publicacao_confirmado || '__none__'}
                      onValueChange={(valor) => onSelecionarTipoPublicacao?.(linha, valor === '__none__' ? '' : valor)}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Selecionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Pendente de classificação</SelectItem>
                        {tiposPublicacaoValidos.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>
                <td className="p-3">
                  {(linha.transformado.tipo_publicacao_confirmado || '').trim() ? (
                    <Badge className="bg-emerald-100 text-emerald-800">Sem revisão</Badge>
                  ) : (
                    <Badge className="bg-indigo-100 text-indigo-800">Revisar</Badge>
                  )}
                </td>
                <td className="p-3">{resumoTrecho(linha.transformado.conteudo_trecho_legado)}</td>
                <td className="p-3">{motivoPrincipal(linha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
