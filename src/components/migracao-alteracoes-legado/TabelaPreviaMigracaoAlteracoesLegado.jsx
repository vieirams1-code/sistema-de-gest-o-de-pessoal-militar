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
      <table className="w-full table-fixed text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left p-3 w-12" />
            <th className="text-left p-3 w-36">Status</th>
            <th className="text-left p-3 w-[18%]">Militar legado</th>
            <th className="text-left p-3 w-[18%]">Militar vinculado</th>
            <th className="text-left p-3 w-[24%]">Matéria legado</th>
            <th className="text-left p-3 w-[15%]">Tipo confirmado</th>
            <th className="text-left p-3 w-[15%]">Destino final</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const expandida = linhaExpandida === linha.linhaNumero;
            return (
              <React.Fragment key={linha.linhaNumero}>
                <tr className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-2 align-top">
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
                  <td className="p-3 align-top">
                    <Badge className={statusClass[linha.status]}>{statusLabel[linha.status]}</Badge>
                  </td>
                  <td className="p-3 align-top min-w-0">
                    <p className="truncate" title={linha.transformado.nome_completo_legado || linha.transformado.nome_guerra_legado || ''}>
                      {linha.transformado.nome_completo_legado || linha.transformado.nome_guerra_legado || '—'}
                    </p>
                  </td>
                  <td className="p-3 align-top min-w-0">
                    <p className="truncate" title={linha.transformado.militar_nome || ''}>{linha.transformado.militar_nome || '—'}</p>
                  </td>
                  <td className="p-3 align-top min-w-0">
                    <p className="truncate" title={linha.transformado.materia_legado || ''}>{linha.transformado.materia_legado || '—'}</p>
                  </td>
                  <td className="p-3 align-top min-w-0">
                    <p className="truncate" title={linha.transformado.tipo_publicacao_confirmado || 'Pendente'}>{linha.transformado.tipo_publicacao_confirmado || 'Pendente'}</p>
                  </td>
                  <td className="p-3 align-top min-w-0">
                    <p className="truncate" title={linha.transformado.destino_final || 'IMPORTAR'}>{linha.transformado.destino_final || 'IMPORTAR'}</p>
                  </td>
                </tr>
                {expandida && (
                  <tr className="border-t border-slate-100 bg-slate-50/60">
                    <td colSpan={7} className="px-4 py-3">
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
  );
}
