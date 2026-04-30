import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Play, Wand2 } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { criarPendenciaComportamentoSemDuplicidade } from '@/services/justicaDisciplinaService';
import AuditoriaComportamentoTable from '@/components/auditoria-comportamento/AuditoriaComportamentoTable';
import AuditoriaComportamentoConfirmModal from '@/components/auditoria-comportamento/AuditoriaComportamentoConfirmModal';

const ORIGEM_AUDITORIA = 'AUDITORIA_MANUAL';

/**
 * Lote 1D-D — Auditoria de Comportamento (admin only).
 *
 * Fluxo:
 *  1) Admin clica em "Executar dry-run" → chama verificarComportamentoDisciplinarDryRun.
 *  2) Tabela mostra sugestões (apenas praças, já filtradas pela função).
 *  3) Admin marca os militares desejados (linhas com pendência ativa ficam desabilitadas).
 *  4) Admin clica em "Criar Pendências Selecionadas" → modal de confirmação.
 *  5) Confirmação → cria PendenciaComportamento via serviço com proteção contra duplicidade.
 *
 * Garantias:
 *  - Não altera regras de cálculo (só consome o dry-run).
 *  - Não altera a Deno Function existente.
 *  - Apenas cria PendenciaComportamento dos selecionados (uma a uma, com guarda de duplicidade).
 *  - Página protegida por RequireAdmin no roteador.
 */
export default function AuditoriaComportamento() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoading: loadingUser, isAdmin, isAccessResolved } = useCurrentUser();

  const [dryRunExecutado, setDryRunExecutado] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [criando, setCriando] = useState(false);

  // Busca pendências existentes em status "Pendente" para evitar duplicar visualmente.
  const { data: pendenciasExistentes = [] } = useQuery({
    queryKey: ['auditoria-comportamento-pendencias'],
    queryFn: () => base44.entities.PendenciaComportamento.filter({ status_pendencia: 'Pendente' }, '-created_date'),
    enabled: dryRunExecutado,
  });

  const pendenciasExistentesPorMilitar = useMemo(() => {
    const set = new Set();
    for (const p of pendenciasExistentes) {
      if (p?.militar_id) set.add(p.militar_id);
    }
    return set;
  }, [pendenciasExistentes]);

  const sugestoes = resultado?.sugestoes || [];

  const sugestoesMudancaReal = useMemo(() => (
    sugestoes.filter((s) => s.comportamento_calculado !== s.comportamento_atual)
  ), [sugestoes]);

  const resumoSelecionado = useMemo(() => (
    sugestoesMudancaReal.filter((s) => selecionados.has(s.militar_id))
  ), [sugestoesMudancaReal, selecionados]);

  const executarDryRun = async () => {
    setCarregando(true);
    setSelecionados(new Set());
    try {
      const response = await base44.functions.invoke('verificarComportamentoDisciplinarDryRun', {});
      const data = response?.data;
      if (!data || data.dryRun !== true) {
        throw new Error('Resposta inesperada do dry-run.');
      }
      setResultado(data);
      setDryRunExecutado(true);
      toast({
        title: 'Dry-run concluído',
        description: `${data.total_sugestoes || 0} sugestões geradas. Nenhum dado foi alterado.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao executar dry-run',
        description: error?.message || 'Não foi possível executar a auditoria.',
      });
    } finally {
      setCarregando(false);
    }
  };

  const onToggle = (militarId) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(militarId)) {
        novo.delete(militarId);
      } else {
        novo.add(militarId);
      }
      return novo;
    });
  };

  const onToggleAll = () => {
    setSelecionados((prev) => {
      const selecionaveis = sugestoesMudancaReal
        .filter((s) => !pendenciasExistentesPorMilitar.has(s.militar_id))
        .map((s) => s.militar_id);
      if (prev.size === selecionaveis.length && selecionaveis.length > 0) {
        return new Set();
      }
      return new Set(selecionaveis);
    });
  };

  const abrirModalConfirmacao = () => {
    if (selecionados.size === 0) return;
    setModalAberto(true);
  };

  const confirmarCriacao = async () => {
    if (resumoSelecionado.length === 0) return;
    setCriando(true);
    let criadas = 0;
    let duplicadas = 0;
    let falhas = 0;
    const dataCalculo = new Date().toISOString().slice(0, 10);

    for (const linha of resumoSelecionado) {
      // Marca origem AUDITORIA_MANUAL e mantém detalhes do cálculo.
      const detalhesPayload = {
        origem: ORIGEM_AUDITORIA,
        data_calculo: dataCalculo,
        ...(linha.detalhes_calculo || {}),
      };
      try {
        const resp = await criarPendenciaComportamentoSemDuplicidade({
          militar_id: linha.militar_id,
          militar_nome: linha.militar_nome,
          comportamento_atual: linha.comportamento_atual,
          comportamento_sugerido: linha.comportamento_calculado,
          fundamento_legal: linha.fundamento_legal,
          detalhes_calculo: JSON.stringify(detalhesPayload),
          data_detectada: dataCalculo,
          status_pendencia: 'Pendente',
        });

        if (resp.criada) {
          criadas += 1;
          // eslint-disable-next-line no-console
          console.info('[AUDITORIA_MANUAL] pendência criada', {
            militar_id: linha.militar_id,
            militar_nome: linha.militar_nome,
            comportamento_atual: linha.comportamento_atual,
            comportamento_sugerido: linha.comportamento_calculado,
            origem: ORIGEM_AUDITORIA,
          });
        } else if (resp.motivo === 'duplicada') {
          duplicadas += 1;
        } else {
          falhas += 1;
        }
      } catch (error) {
        falhas += 1;
        // eslint-disable-next-line no-console
        console.error('[AUDITORIA_MANUAL] falha ao criar pendência', {
          militar_id: linha.militar_id,
          erro: error?.message || error,
        });
      }
    }

    setCriando(false);
    setModalAberto(false);
    setSelecionados(new Set());
    await queryClient.invalidateQueries({ queryKey: ['auditoria-comportamento-pendencias'] });
    await queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] });

    toast({
      title: 'Operação concluída',
      description: `Criadas: ${criadas} · Já existentes: ${duplicadas}${falhas > 0 ? ` · Falhas: ${falhas}` : ''}.`,
      variant: falhas > 0 ? 'destructive' : 'default',
    });
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!isAdmin) {
    return <AccessDenied modulo="Auditoria de Comportamento" />;
  }

  const totalLidos = resultado?.total_militares_lidos || 0;
  const totalSugestoes = resultado?.total_sugestoes || 0;
  const totalMudancas = sugestoesMudancaReal.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Auditar Comportamento</h1>
              <p className="text-sm text-slate-500">
                Visualiza o resultado do dry-run e cria pendências apenas para os militares selecionados.
                Não altera comportamentos automaticamente.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={executarDryRun} disabled={carregando}>
              <Play className="w-4 h-4 mr-2" />
              {carregando ? 'Executando…' : 'Executar dry-run'}
            </Button>
            <Button
              variant="default"
              onClick={abrirModalConfirmacao}
              disabled={selecionados.size === 0 || criando}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Criar Pendências Selecionadas{selecionados.size > 0 ? ` (${selecionados.size})` : ''}
            </Button>
          </div>
        </div>

        {dryRunExecutado && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <CardResumo titulo="Militares lidos" valor={totalLidos} />
            <CardResumo titulo="Sugestões" valor={totalSugestoes} />
            <CardResumo titulo="Com mudança real" valor={totalMudancas} />
            <CardResumo titulo="Selecionadas" valor={selecionados.size} destaque />
          </div>
        )}

        {!dryRunExecutado ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            Clique em <strong>Executar dry-run</strong> para gerar a lista de sugestões.
            Esta operação não altera nenhum dado.
          </div>
        ) : (
          <AuditoriaComportamentoTable
            sugestoes={sugestoesMudancaReal}
            selecionados={selecionados}
            onToggle={onToggle}
            onToggleAll={onToggleAll}
            pendenciasExistentesPorMilitar={pendenciasExistentesPorMilitar}
          />
        )}
      </div>

      <AuditoriaComportamentoConfirmModal
        open={modalAberto}
        onOpenChange={(open) => (!criando ? setModalAberto(open) : null)}
        total={resumoSelecionado.length}
        resumo={resumoSelecionado}
        isProcessing={criando}
        onConfirm={confirmarCriacao}
      />
    </div>
  );
}

function CardResumo({ titulo, valor, destaque = false }) {
  return (
    <div className={`rounded-xl border p-4 ${destaque ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`text-2xl font-bold ${destaque ? 'text-blue-700' : 'text-slate-800'}`}>{valor}</p>
    </div>
  );
}