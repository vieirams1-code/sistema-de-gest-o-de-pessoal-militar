import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const statusLabel = {
  APTO: 'Apto',
  APTO_COM_ALERTA: 'Apto com alerta',
  REVISAR: 'Revisar',
  IGNORADO: 'Ignorado',
  EXCLUIDO_DO_LOTE: 'Excluído do lote',
  ERRO: 'Erro',
};

const statusClass = {
  APTO: 'bg-emerald-100 text-emerald-800',
  APTO_COM_ALERTA: 'bg-amber-100 text-amber-800',
  REVISAR: 'bg-indigo-100 text-indigo-800',
  IGNORADO: 'bg-slate-100 text-slate-700',
  EXCLUIDO_DO_LOTE: 'bg-zinc-200 text-zinc-700',
  ERRO: 'bg-rose-100 text-rose-800',
};

const destinos = [
  { value: 'IMPORTAR', label: 'Importar' },
  { value: 'PENDENTE_CLASSIFICACAO', label: 'Pendente classificação' },
  { value: 'IGNORAR', label: 'Ignorar' },
  { value: 'EXCLUIDO_DO_LOTE', label: 'Excluir do lote' },
];

function motivoPrincipal(linha) {
  if (linha.erros?.length) return linha.erros[0];
  if (linha.revisoes?.length) return linha.revisoes[0];
  if (linha.alertas?.length) return linha.alertas[0];
  if (linha.transformado?.motivo_destino) return linha.transformado.motivo_destino;
  return '—';
}

export default function TabelaPreviaMigracaoAlteracoesLegado({
  linhas,
  tiposPublicacaoValidos = [],
  onSelectLinha,
  onSelecionarTipoPublicacao,
  onSelecionarDestinoFinal,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Militar legado</th>
              <th className="text-left p-3">Militar vinculado</th>
              <th className="text-left p-3">Matéria legado</th>
              <th className="text-left p-3">Tipo BG legado</th>
              <th className="text-left p-3">Tipo sugerido</th>
              <th className="text-left p-3">Confiança</th>
              <th className="text-left p-3">Tipo confirmado</th>
              <th className="text-left p-3">Destino sugerido</th>
              <th className="text-left p-3">Destino final</th>
              <th className="text-left p-3">Ações</th>
              <th className="text-left p-3">Motivo principal</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.linhaNumero} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => onSelectLinha(linha)}>
                <td className="p-3"><Badge className={statusClass[linha.status]}>{statusLabel[linha.status]}</Badge></td>
                <td className="p-3">{linha.transformado.nome_completo_legado || linha.transformado.nome_guerra_legado || '—'}</td>
                <td className="p-3">{linha.transformado.militar_nome || '—'}</td>
                <td className="p-3">{linha.transformado.materia_legado || '—'}</td>
                <td className="p-3">{linha.transformado.tipo_bg_legado || '—'}</td>
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
                <td className="p-3">{linha.transformado.destino_sugerido || '—'}</td>
                <td className="p-3">
                  <div onClick={(event) => event.stopPropagation()}>
                    <Select
                      value={linha.transformado.destino_final || 'IMPORTAR'}
                      onValueChange={(valor) => onSelecionarDestinoFinal?.(linha, valor)}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Selecionar destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {destinos.map((destino) => (
                          <SelectItem key={destino.value} value={destino.value}>{destino.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => onSelecionarDestinoFinal?.(linha, 'IMPORTAR')}>Restaurar</Button>
                    <Button size="sm" variant="outline" onClick={() => onSelecionarDestinoFinal?.(linha, 'PENDENTE_CLASSIFICACAO')}>Pendente</Button>
                  </div>
                </td>
                <td className="p-3">{motivoPrincipal(linha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
