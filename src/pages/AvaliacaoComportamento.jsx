import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, FileText, History, Search, Scale, ShieldAlert, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { PRACAS, calcularComportamento, calcularProximaMelhoria } from '@/utils/calcularComportamento';
import { gerarLinhaTempoComportamento } from '@/utils/linhaTempoComportamento';
import {
  criarPendenciaComportamentoSemDuplicidade,
  getPunicaoEntity,
  obterHistoricoComportamentoMilitar,
} from '@/services/justicaDisciplinaService';
import { gerarPublicacaoRPAutomaticaPorHistoricoComportamento } from '@/services/comportamentoRPService';
import { aplicarPendenciasComportamentoEmLote } from '@/services/comportamentoService';
import { carregarMilitaresComMatriculas, filtrarMilitaresOperacionais, militarCorrespondeBusca } from '@/services/matriculaMilitarViewService';
import { useScopedMilitarIds, filtrarPorMilitarIdsPermitidos } from '@/hooks/useScopedMilitarIds';
import { useUsuarioPodeAgirSobreMilitar } from '@/hooks/useUsuarioPodeAgirSobreMilitar';

const COMPORTAMENTO_STYLES = {
  Excepcional: 'border-blue-300 bg-blue-100 text-blue-800',
  Ótimo: 'border-green-300 bg-green-100 text-green-800',
  Bom: 'border-yellow-300 bg-yellow-100 text-yellow-800',
  Insuficiente: 'border-orange-300 bg-orange-100 text-orange-800',
  Mau: 'border-red-300 bg-red-100 text-red-800',
};

const SITUACAO_STYLES = {
  Regular: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Divergente: 'border-amber-200 bg-amber-50 text-amber-800',
  Inconsistente: 'border-red-200 bg-red-50 text-red-700',
};

function formatarData(data) {
  if (!data) return '—';
  const date = new Date(`${String(data).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(data);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function obterMatricula(militar = {}) {
  return militar.matricula || militar.matricula_formatada || militar.numero_matricula || '—';
}

function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function ComportamentoBadge({ valor, destaque = false }) {
  return <Badge className={`${COMPORTAMENTO_STYLES[valor] || 'border-slate-200 bg-slate-50 text-slate-600'} ${destaque ? 'ring-2 ring-blue-200 ring-offset-1' : ''}`}>{valor || '—'}</Badge>;
}

function SituacaoBadge({ situacao }) {
  return <Badge className={SITUACAO_STYLES[situacao] || SITUACAO_STYLES.Regular}>{situacao}</Badge>;
}

function ResumoAuditoriaCard({ titulo, valor, icon: Icon, className = '', destaque = false }) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${destaque ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
          <p className={`mt-2 text-2xl font-bold ${className}`}>{valor}</p>
        </div>
        {Icon ? (
          <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function JanelaResumo({ titulo, janela }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-xs text-slate-500">{formatarData(janela?.inicio)} a {formatarData(janela?.fim)}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div><p className="font-bold text-slate-800">{janela?.quantidade ?? 0}</p><p className="text-slate-500">punições</p></div>
        <div><p className="font-bold text-slate-800">{janela?.prisao_equivalente ?? 0}</p><p className="text-slate-500">prisão eq.</p></div>
        <div><p className="font-bold text-slate-800">{janela?.detencao_equivalente ?? 0}</p><p className="text-slate-500">detenção eq.</p></div>
      </div>
    </div>
  );
}

function TimelineBarra({ segmentos }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-center gap-3 py-3">
        {segmentos.map((seg, index) => (
          <div key={`${seg.inicio}-${index}`} className="flex items-center gap-3">
            <div className="min-w-48 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <ComportamentoBadge valor={seg.comportamento} destaque={seg.isAtual} />
              <p className="mt-2 text-slate-600">{formatarData(seg.inicio)} até {formatarData(seg.fim)}</p>
              {seg.isAtual ? <p className="mt-1 font-semibold text-blue-700">Período atual</p> : null}
            </div>
            {index < segmentos.length - 1 ? <div className="h-0.5 w-12 bg-slate-200" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineCards({ segmentos }) {
  return (
    <div className="overflow-x-auto pb-3">
      <div className="relative flex min-w-max gap-5 pt-8">
        <div className="absolute left-8 right-8 top-4 h-0.5 bg-slate-200" />
        {segmentos.map((seg, index) => (
          <div key={`${seg.inicio}-${index}`} className="relative w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`absolute -top-6 left-6 h-4 w-4 rounded-full border-4 border-white shadow ${seg.isAtual ? 'bg-blue-700' : 'bg-slate-300'}`} />
            <ComportamentoBadge valor={seg.comportamento} destaque={seg.isAtual} />
            <p className="mt-3 text-sm font-semibold text-slate-800">{formatarData(seg.inicio)} — {formatarData(seg.fim)}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{seg.fundamento || 'Período calculado conforme histórico disciplinar.'}</p>
            {(seg.punicoes || []).length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {seg.punicoes.map((punicao, punicaoIndex) => (
                  <button
                    key={punicao.id || punicaoIndex}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <AlertCircle className="h-3 w-3" />
                    {punicao.tipo || 'Punição'}
                  </button>
                ))}
              </div>
            ) : <p className="mt-3 text-xs text-slate-400">Sem punições vinculadas ao período.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetalhesAuditoria({ linha }) {
  const [viewMode, setViewMode] = useState('bar');
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const detalhes = linha.calculado?.detalhes || {};
  const segmentos = linha.timeline?.segmentos || [];
  const punicoesConsideradas = detalhes.janela_8_anos?.punicoes || [];
  const advertencias = linha.timeline?.segmentoAtual?.advertenciasInformativas || [];
  const inconsistencias = linha.calculado?.inconsistencias || [];

  return (
    <div className="border-t border-blue-100 bg-slate-50 p-6">
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <ResumoAuditoriaCard titulo="Comportamento Calculado" valor={linha.calculado?.comportamento || '—'} icon={Scale} className="text-blue-900" />
        <ResumoAuditoriaCard titulo="Comportamento Atual" valor={linha.militar.comportamento || 'Bom'} icon={FileText} className="text-slate-800" />
        <ResumoAuditoriaCard titulo="Divergência Cadastral" valor={linha.divergente ? 'Sim' : 'Não'} icon={AlertTriangle} className={linha.divergente ? 'text-amber-700' : 'text-emerald-700'} />
        <ResumoAuditoriaCard titulo="Próxima Melhoria Prevista" valor={linha.proxima?.data ? `${formatarData(linha.proxima.data)} • ${linha.proxima.comportamento_futuro}` : '—'} icon={Wand2} className="text-green-800" destaque={Boolean(linha.proxima?.data)} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-800"><History className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Linha do Tempo Calculada</h2>
              <p className="text-sm text-slate-500">Histórico horizontal de punições e mudança de status.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-1">
              <Button type="button" size="sm" variant={viewMode === 'bar' ? 'default' : 'ghost'} onClick={() => setViewMode('bar')}>Barra Contínua</Button>
              <Button type="button" size="sm" variant={viewMode === 'cards' ? 'default' : 'ghost'} onClick={() => setViewMode('cards')}>Trilha de Cards</Button>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setMostrarDetalhes((atual) => !atual)}>Detalhes do Cálculo</Button>
          </div>
        </div>

        <div className="mt-6">
          {segmentos.length ? (viewMode === 'bar' ? <TimelineBarra segmentos={segmentos} /> : <TimelineCards segmentos={segmentos} />) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Linha do tempo indisponível para este militar.</p>
          )}
        </div>

        {mostrarDetalhes ? (
          <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fundamento legal</p>
              <p className="mt-1 text-sm text-slate-700">{linha.calculado?.fundamento || '—'}</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              <JanelaResumo titulo="Janela de 1 ano" janela={detalhes.janela_1_ano} />
              <JanelaResumo titulo="Janela de 2 anos" janela={detalhes.janela_2_anos} />
              <JanelaResumo titulo="Janela de 4 anos" janela={detalhes.janela_4_anos} />
              <JanelaResumo titulo="Janela de 8 anos" janela={detalhes.janela_8_anos} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold text-slate-800">Punições consideradas</p>
                {punicoesConsideradas.length ? (
                  <div className="mt-2 space-y-2">
                    {punicoesConsideradas.map((p, index) => (
                      <div key={p.id || index} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span>{p.tipo || 'Punição'} • {formatarData(p.data_fim_cumprimento)}</span>
                        <span className="text-slate-500">P.eq {p.prisao_equivalente} / D.eq {p.detencao_equivalente}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-2 text-sm text-slate-500">Nenhuma punição impactante na janela principal.</p>}
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold text-slate-800">Advertências e inconsistências</p>
                {advertencias.length ? advertencias.map((a) => <p key={a.id || a.data_fim_cumprimento} className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{a.descricao}</p>) : <p className="mt-2 text-sm text-slate-500">Nenhuma advertência informativa disponível.</p>}
                {inconsistencias.length ? inconsistencias.map((i, index) => <p key={`${i.campo || i.labelCampo}-${index}`} className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{i.labelCampo || i.campo || 'Inconsistência cadastral'}</p>) : <p className="mt-2 text-sm text-emerald-600">Sem inconsistências de cálculo.</p>}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function AvaliacaoComportamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    isLoading: loadingUser,
    isAccessResolved,
    canAccessAction,
    isAdmin,
    modoAcesso,
    userEmail,
    getMilitarScopeFilters,
  } = useCurrentUser();
  const canGerarPendencias = canAccessAction('gerar_pendencias_comportamento');
  const canAprovarMudanca = canAccessAction('aprovar_mudanca_comportamento');
  const { validar: validarEscopoMilitar } = useUsuarioPodeAgirSobreMilitar();
  const [filtro, setFiltro] = useState('');
  const [aprovacaoModal, setAprovacaoModal] = useState({
    open: false,
    linha: null,
  });
  const [linhaExpandidaId, setLinhaExpandidaId] = useState(null);
  const punicaoEntity = getPunicaoEntity();

  // Lote 1D-E: escopo transversal — substitui Militar.list() global por
  // listagem escopada via getMilitarScopeFilters().
  const { ids: scopedIds, isAdmin: scopedIsAdmin, isReady: scopedReady } = useScopedMilitarIds();
  const scopeKey = scopedIsAdmin ? 'admin' : (scopedIds || []).join(',');

  const { data: militares = [], isLoading } = useQuery({
    queryKey: ['avaliacao-comportamento-militares', isAdmin, modoAcesso, userEmail],
    queryFn: async () => {
      let lista = [];
      if (isAdmin) {
        lista = await base44.entities.Militar.list();
      } else {
        const filters = getMilitarScopeFilters();
        if (!filters.length) return [];
        const batches = await Promise.all(
          filters.map((filtro) => base44.entities.Militar.filter(filtro))
        );
        const ids = new Set();
        for (const m of batches.flat()) {
          if (m?.id && !ids.has(m.id)) {
            ids.add(m.id);
            lista.push(m);
          }
        }
      }
      const enriquecidos = await carregarMilitaresComMatriculas(lista);
      return filtrarMilitaresOperacionais(enriquecidos, { incluirInativos: false });
    },
    enabled: isAccessResolved,
  });
  const { data: punicoes = [], isLoading: loadingPunicoes } = useQuery({
    queryKey: ['avaliacao-comportamento-punicoes', scopeKey],
    queryFn: async () => {
      const lista = await punicaoEntity.list();
      return filtrarPorMilitarIdsPermitidos(lista, scopedIds);
    },
    enabled: scopedReady,
  });
  const { data: pendencias = [] } = useQuery({
    queryKey: ['pendencias-comportamento', scopeKey],
    queryFn: async () => {
      const lista = base44.entities.PendenciaComportamento?.list
        ? await base44.entities.PendenciaComportamento.list('-created_date')
        : [];
      return filtrarPorMilitarIdsPermitidos(lista, scopedIds);
    },
    enabled: scopedReady,
  });

  const avaliacao = useMemo(() => {
    return militares
      .filter((m) => PRACAS.has(m.posto_graduacao))
      .filter((m) => militarCorrespondeBusca(m, filtro))
      .map((militar) => {
        const punicoesMilitar = punicoes.filter((p) => p.militar_id === militar.id);
        const calculado = calcularComportamento(punicoesMilitar, militar.posto_graduacao, new Date(), {
          dataInclusaoMilitar: militar.data_inclusao,
        });
        const proxima = calcularProximaMelhoria(punicoesMilitar, militar.posto_graduacao, new Date(), {
          dataInclusaoMilitar: militar.data_inclusao,
        });
        const timeline = gerarLinhaTempoComportamento({
          punicoes: punicoesMilitar,
          postoGraduacao: militar.posto_graduacao,
          dataInclusaoMilitar: militar.data_inclusao,
          comportamentoCadastrado: militar.comportamento || 'Bom',
          hoje: new Date(),
        });
        const pendenciaExistente = pendencias.find(
          (p) => p.militar_id === militar.id && p.status_pendencia === 'Pendente',
        );
        const inconsistenteCalculo = Boolean(calculado?.inconsistente_para_calculo);
        const divergente = (militar.comportamento || 'Bom') !== calculado?.comportamento;
        return {
          militar,
          calculado,
          proxima,
          timeline,
          pendenciaExistente,
          inconsistenteCalculo,
          divergente,
          situacao: inconsistenteCalculo ? 'Inconsistente' : divergente ? 'Divergente' : 'Regular',
          temAcaoPendente: divergente && !inconsistenteCalculo,
        };
      })
      .sort((a, b) => {
        if (a.temAcaoPendente !== b.temAcaoPendente) return a.temAcaoPendente ? -1 : 1;
        return String(a.militar?.nome_completo || '').localeCompare(String(b.militar?.nome_completo || ''), 'pt-BR');
      });
  }, [militares, punicoes, filtro, pendencias]);

  const resumoAuditoria = useMemo(() => ({
    total: avaliacao.length,
    divergencias: avaliacao.filter((a) => a.situacao === 'Divergente').length,
    regulares: avaliacao.filter((a) => a.situacao === 'Regular').length,
    inconsistencias: avaliacao.filter((a) => a.situacao === 'Inconsistente').length,
  }), [avaliacao]);

  const aplicarSugestao = async (linha, { gerarPublicacao = false } = {}) => {
    if (!canAprovarMudanca) return;
    if (!linha.calculado?.comportamento) return;

    const escopo = validarEscopoMilitar(linha?.militar?.id);
    if (!escopo.permitido) {
      toast({ variant: 'destructive', title: 'Acesso negado', description: escopo.motivo });
      return;
    }

    try {
      let pendenciaParaAplicacao = linha.pendenciaExistente;
      if (!pendenciaParaAplicacao?.id) {
        const { registro } = await criarPendenciaComportamentoSemDuplicidade({
          militar_id: linha.militar.id,
          militar_nome: linha.militar.nome_completo,
          comportamento_atual: linha.militar.comportamento || 'Bom',
          comportamento_sugerido: linha.calculado.comportamento,
          fundamento_legal: linha.calculado.fundamento,
          detalhes_calculo: JSON.stringify(linha.calculado.detalhes || {}),
          data_detectada: new Date().toISOString().slice(0, 10),
          status_pendencia: 'Pendente',
          confirmado_por: null,
          data_confirmacao: null,
        });
        pendenciaParaAplicacao = registro;
      }

      if (!pendenciaParaAplicacao?.id) {
        throw new Error('Não foi possível identificar a pendência de comportamento para aprovação.');
      }

      const resultadoAplicacao = await aplicarPendenciasComportamentoEmLote({
        pendencias: [pendenciaParaAplicacao.id],
        usuarioAtual: { canAccessAction },
      });

      if (resultadoAplicacao.totalAplicadas !== 1) {
        const motivoFalha = resultadoAplicacao.falhas?.[0]?.erro
          || resultadoAplicacao.falhas?.[0]?.motivo
          || resultadoAplicacao.ignoradas?.[0]?.motivo
          || 'Falha ao aplicar pendência de comportamento.';
        throw new Error(motivoFalha);
      }

      let resultadoRPAutomatico = null;
      if (gerarPublicacao) {
        const historicoMilitar = await obterHistoricoComportamentoMilitar(linha.militar.id, { ordem: 'desc' });
        const marcoParaPublicacao = historicoMilitar.find((marco) => marco?.comportamento_novo === linha.calculado.comportamento) || null;

        if (!marcoParaPublicacao?.id) {
          throw new Error('Não foi possível localizar o marco histórico para vincular a publicação.');
        }

        resultadoRPAutomatico = await gerarPublicacaoRPAutomaticaPorHistoricoComportamento({
          militar: linha.militar,
          marco: {
            ...marcoParaPublicacao,
            motivo_mudanca: 'Mudança efetiva de comportamento aprovada na Avaliação de Comportamento.',
            fundamento_legal: linha.calculado.fundamento,
          },
          geradoPor: '',
        });


        const houveFalhaPublicacao = !resultadoRPAutomatico?.ok
          && resultadoRPAutomatico?.motivo !== 'publicacao_ja_existente';
        if (houveFalhaPublicacao) {
          throw new Error(resultadoRPAutomatico?.motivo || 'Falha ao gerar publicação automática.');
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['avaliacao-comportamento-militares'] }),
        queryClient.invalidateQueries({ queryKey: ['militares'] }),
        queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
      ]);

      const descricaoPublicacao = !gerarPublicacao
        ? 'Comportamento aplicado com sucesso.'
        : resultadoRPAutomatico?.motivo === 'publicacao_ja_existente'
          ? 'Comportamento aplicado e publicação já existente foi reaproveitada (sem duplicidade).'
          : 'Comportamento aplicado e publicação gerada com sucesso.';

      toast({
        title: 'Operação concluída',
        description: descricaoPublicacao,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao aplicar alteração',
        description: error?.message || 'Não foi possível concluir a operação.',
      });
      throw error;
    }
  };

  const gerarPendencia = async (linha) => {
    if (!linha.divergente || linha.pendenciaExistente || !linha.calculado?.comportamento || linha.inconsistenteCalculo) return;
    const escopo = validarEscopoMilitar(linha?.militar?.id);
    if (!escopo.permitido) {
      toast({ variant: 'destructive', title: 'Acesso negado', description: escopo.motivo });
      return;
    }
    await criarPendenciaComportamentoSemDuplicidade({
      militar_id: linha.militar.id,
      militar_nome: linha.militar.nome_completo,
      comportamento_atual: linha.militar.comportamento || 'Bom',
      comportamento_sugerido: linha.calculado.comportamento,
      fundamento_legal: linha.calculado.fundamento,
      detalhes_calculo: JSON.stringify(linha.calculado.detalhes || {}),
      data_detectada: new Date().toISOString().slice(0, 10),
      status_pendencia: 'Pendente',
      confirmado_por: null,
      data_confirmacao: null,
    });
  };

  const gerarPendencias = async () => {
    if (!canGerarPendencias) return;
    const alvos = avaliacao.filter((a) => a.divergente && !a.pendenciaExistente && !a.inconsistenteCalculo);

    // ⚡ [Performance]: Execute generation tasks concurrently.
    // Sequential await in a loop was replaced by Promise.all mapping for faster batch execution.
    await Promise.all(alvos.map((linha) => gerarPendencia(linha)));

    await queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] });
  };

  const abrirModalAprovacao = (linha) => {
    if (!canAprovarMudanca) return;
    setAprovacaoModal({
      open: true,
      linha,
    });
  };

  const fecharModalAprovacao = () => {
    setAprovacaoModal({
      open: false,
      linha: null,
    });
  };

  const confirmarAprovacao = async ({ gerarPublicacao = false } = {}) => {
    if (!canAprovarMudanca) return;
    if (!aprovacaoModal.linha) return;
    await aplicarSugestao(aprovacaoModal.linha, { gerarPublicacao });
    fecharModalAprovacao();
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!canGerarPendencias && !canAprovarMudanca) {
    return <AccessDenied modulo="Avaliação de Comportamento" />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-8 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-blue-950 p-3 text-white shadow-sm">
              <Scale className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Avaliação de Comportamento</h1>
              <p className="mt-1 text-sm text-slate-500">Verificação automática conforme Decreto nº 1.260/1981</p>
            </div>
          </div>
          <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={gerarPendencias} disabled={!canGerarPendencias}>
            <Wand2 className="mr-2 h-4 w-4" />
            Gerar pendências
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input className="h-12 rounded-lg border-slate-200 pl-12 text-base" placeholder="Buscar por nome ou matrícula..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <ResumoAuditoriaCard titulo="Total avaliados" valor={resumoAuditoria.total} icon={Scale} className="text-blue-900" />
          <ResumoAuditoriaCard titulo="Divergências" valor={resumoAuditoria.divergencias} icon={AlertTriangle} className="text-amber-700" />
          <ResumoAuditoriaCard titulo="Regulares" valor={resumoAuditoria.regulares} icon={CheckCircle2} className="text-emerald-700" />
          <ResumoAuditoriaCard titulo="Inconsistências" valor={resumoAuditoria.inconsistencias} icon={ShieldAlert} className="text-red-700" />
        </div>

        {!isLoading && !loadingPunicoes && resumoAuditoria.divergencias === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Nenhuma divergência encontrada no conjunto filtrado.
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-w-[1040px] grid-cols-12 items-center bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div className="col-span-4">Militar</div>
            <div className="col-span-2 text-center">Status Atual</div>
            <div className="col-span-2 text-center">Status Calculado</div>
            <div className="col-span-1 text-center">Melhoria</div>
            <div className="col-span-3 text-right">Ações</div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1040px] divide-y divide-slate-100">
              {isLoading || loadingPunicoes ? (
                <div className="p-6 text-sm text-slate-500">Carregando...</div>
              ) : avaliacao.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">Nenhum militar encontrado para os filtros informados.</div>
              ) : avaliacao.map((linha) => {
                const expandida = linhaExpandidaId === linha.militar.id;
                return (
                  <div key={linha.militar.id}>
                    <button
                      type="button"
                      className={`grid w-full grid-cols-12 items-center gap-3 p-4 text-left transition hover:bg-blue-50/50 ${expandida ? 'bg-blue-50/30' : 'bg-white'}`}
                      onClick={() => setLinhaExpandidaId(expandida ? null : linha.militar.id)}
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600">
                          {String(linha.militar.nome_completo || '?').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">{linha.militar.posto_graduacao} {linha.militar.nome_completo}</p>
                          <p className="mt-1 text-xs text-slate-500">Matrícula {obterMatricula(linha.militar)}</p>
                        </div>
                      </div>
                      <div className="col-span-2 flex justify-center"><ComportamentoBadge valor={linha.militar.comportamento || 'Bom'} /></div>
                      <div className="col-span-2 flex items-center justify-center gap-2">
                        {linha.divergente ? <ArrowRight className="h-4 w-4 text-blue-600" /> : null}
                        <ComportamentoBadge valor={linha.calculado?.comportamento} destaque={linha.divergente && !linha.inconsistenteCalculo} />
                      </div>
                      <div className="col-span-1 text-center text-xs font-semibold text-slate-600">
                        {linha.proxima?.data ? formatarData(linha.proxima.data) : '—'}
                      </div>
                      <div className="col-span-3 flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                        {linha.divergente && !linha.inconsistenteCalculo ? (
                          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => abrirModalAprovacao(linha)} disabled={!canAprovarMudanca}>
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Aprovar Mudança
                          </Button>
                        ) : linha.inconsistenteCalculo ? (
                          <SituacaoBadge situacao="Inconsistente" />
                        ) : (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Regular</Badge>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setLinhaExpandidaId(expandida ? null : linha.militar.id)} aria-label={expandida ? 'Recolher detalhes' : 'Expandir detalhes'}>
                          {expandida ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                      </div>
                    </button>
                    {expandida ? <DetalhesAuditoria linha={linha} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Dialog open={aprovacaoModal.open} onOpenChange={(open) => (!open ? fecharModalAprovacao() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar mudança de comportamento</DialogTitle>
            <DialogDescription>
              Escolha como deseja concluir a aprovação para {aprovacaoModal.linha?.militar?.nome_completo || 'o militar selecionado'}.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
            <strong>Mudança:</strong>{' '}
            {aprovacaoModal.linha
              ? `${aprovacaoModal.linha.militar.comportamento || 'Bom'} → ${aprovacaoModal.linha.calculado?.comportamento || '—'}`
              : '—'}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => confirmarAprovacao({ gerarPublicacao: false })} disabled={!canAprovarMudanca}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Aprovar sem publicação
            </Button>
            <Button onClick={() => confirmarAprovacao({ gerarPublicacao: true })} disabled={!canAprovarMudanca}>
              <FileText className="w-4 h-4 mr-1" />
              Aprovar e gerar publicação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
