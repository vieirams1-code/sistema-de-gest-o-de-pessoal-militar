import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DetalheLinhaMigracaoAlteracaoLegado from '@/components/migracao-alteracoes-legado/DetalheLinhaMigracaoAlteracaoLegado';

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

function motivoPrincipal(linha) {
  if (linha.erros?.length) return linha.erros[0];
  if (linha.revisoes?.length) return linha.revisoes[0];
  if (linha.alertas?.length) return linha.alertas[0];
  if (linha.transformado?.motivo_destino) return linha.transformado.motivo_destino;
  return '—';
}

export default function TabelaPreviaMigracaoAlteracoesLegado({
  linhas,
  militares = [],
  tiposPublicacaoValidos = [],
  onSelecionarMilitar,
  onSelecionarTipoPublicacao,
  onSelecionarDestinoFinal,
  onAlterarMotivoDestino,
}) {
  const [linhaExpandida, setLinhaExpandida] = useState(null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 w-10" />
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Militar legado</th>
              <th className="text-left p-3">Militar vinculado</th>
              <th className="text-left p-3">Matéria legado</th>
              <th className="text-left p-3">Tipo BG legado</th>
              <th className="text-left p-3">Trecho legado</th>
              <th className="text-left p-3">Tipo sugerido</th>
              <th className="text-left p-3">Tipo confirmado</th>
              <th className="text-left p-3">Tipo final importação</th>
              <th className="text-left p-3">Destino final</th>
              <th className="text-left p-3">Motivo principal</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const expandida = linhaExpandida === linha.linhaNumero;
              return (
                <React.Fragment key={linha.linhaNumero}>
                  <tr className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 align-top">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setLinhaExpandida(expandida ? null : linha.linhaNumero)}
                        aria-label={expandida ? `Recolher linha ${linha.linhaNumero}` : `Expandir linha ${linha.linhaNumero}`}
                      >
                        {expandida ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </td>
                    <td className="p-3 align-top"><Badge className={statusClass[linha.status]}>{statusLabel[linha.status]}</Badge></td>
                    <td className="p-3 align-top">{linha.transformado.nome_completo_legado || linha.transformado.nome_guerra_legado || '—'}</td>
                    <td className="p-3 align-top">{linha.transformado.militar_nome || '—'}</td>
                    <td className="p-3 align-top">{linha.transformado.materia_legado || '—'}</td>
                    <td className="p-3 align-top">{linha.transformado.tipo_bg_legado || '—'}</td>
                    <td className="p-3 align-top max-w-[260px] truncate" title={linha.transformado.conteudo_trecho_legado || ''}>{linha.transformado.conteudo_trecho_legado || '—'}</td>
                    <td className="p-3 align-top">{linha.transformado.tipo_publicacao_sugerido || '—'}</td>
                    <td className="p-3 align-top">{linha.transformado.tipo_publicacao_confirmado || 'Pendente'}</td>
                    <td className="p-3 align-top">{linha.transformado.tipo_publicacao || 'LEGADO_NAO_CLASSIFICADO'}</td>
                    <td className="p-3 align-top">{linha.transformado.destino_final || 'IMPORTAR'}</td>
                    <td className="p-3 align-top max-w-[280px] truncate" title={motivoPrincipal(linha)}>{motivoPrincipal(linha)}</td>
                  </tr>
                  {expandida && (
                    <tr className="border-t border-slate-100 bg-slate-50/70">
                      <td colSpan={12} className="p-4">
                        <DetalheLinhaMigracaoAlteracaoLegado
                          linha={linha}
                          modoInline
                          militares={militares}
                          tiposPublicacaoValidos={tiposPublicacaoValidos}
                          onSelecionarMilitar={onSelecionarMilitar}
                          onSelecionarTipoPublicacao={onSelecionarTipoPublicacao}
                          onSelecionarDestinoFinal={onSelecionarDestinoFinal}
                          onAlterarMotivoDestino={onAlterarMotivoDestino}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
