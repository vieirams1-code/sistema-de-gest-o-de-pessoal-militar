import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, FileText, History, Pin, Search, Scale, ShieldAlert, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { gerarPublicacaoComportamento } from '@/services/comportamentoRPService';
import { aplicarPendenciasComportamentoEmLote } from '@/services/comportamentoService';
import { carregarMilitaresComMatriculas, filtrarMilitaresOperacionais, militarCorrespondeBusca } from '@/services/matriculaMilitarViewService';
import { useScopedMilitarIds, filtrarPorMilitarIdsPermitidos } from '@/hooks/useScopedMilitarIds';
import { useUsuarioPodeAgirSobreMilitar } from '@/hooks/useUsuarioPodeAgirSobreMilitar';
import ComportamentoTimelineCalculada from '@/components/militar/ComportamentoTimelineCalculada';

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

function obterDataPunicao(punicao = {}) {
  return punicao.data_base_iso || punicao.data_fim_cumprimento || punicao.data_base || punicao.data || punicao.created_date;
}

function obterImpactoPunicao(punicao = {}, comportamentoSegmento) {
  if (punicao.impacto_visual || punicao.impacto_texto || punicao.impacto_comportamento_texto) {
    return punicao.impacto_visual || punicao.impacto_texto || punicao.impacto_comportamento_texto;
  }
  if (punicao.impacto_comportamento === false) return 'Mantém comportamento';
  if (comportamentoSegmento && ['Bom', 'Ótimo'].includes(comportamentoSegmento)) return `Permanece ${comportamentoSegmento}`;
  if (comportamentoSegmento) return `Cai para ${comportamentoSegmento}`;
  return 'Impacta comportamento';
}

function obterDescricaoPunicao(punicao = {}) {
  return punicao.observacao || punicao.motivo || punicao.descricao || punicao.fundamento || punicao.justificativa || '';
}

function normalizarEventosDoSegmento(segmento = {}, eventos = []) {
  const inicio = segmento.inicio;
  const fim = segmento.fim;
  const eventosPeriodo = eventos.filter((evento) => {
    const data = evento.data || evento.data_base_iso || evento.data_fim_cumprimento;
    const tipo = evento.tipo;
    const tipoPunicao = tipo === 'PUNICAO';
    const tipoAdvertencia = tipo === 'ADVERTENCIA' || tipo === 'ADVERTENCIA_INFORMATIVA';
    return data && inicio && fim && data >= inicio && data <= fim && (tipoPunicao || tipoAdvertencia);
  });

  const punicoesDiretas = segmento.punicoesConsideradas || segmento.punicoes || [];
  const advertenciasDiretas = segmento.advertenciasInformativas || [];
  const punicoesPorEvento = eventosPeriodo.filter((evento) => evento.tipo === 'PUNICAO' || evento.impacto_comportamento === true);
  const advertenciasPorEvento = eventosPeriodo.filter((evento) => evento.tipo !== 'PUNICAO' || evento.impacto_comportamento === false);

  return {
    punicoes: punicoesDiretas.length ? punicoesDiretas : punicoesPorEvento,
    advertencias: advertenciasDiretas.length ? advertenciasDiretas : advertenciasPorEvento,
  };
}

const TIPO_PUBLICACAO_COMPORTAMENTO = {
  MELHORIA: 'melhoria_comportamento',
  REGISTRO_FUNCIONAL: 'registro_funcional_comportamento',
};

const MODOS_APROVACAO = {
  CORRIGIR_SEM_PUBLICACAO: 'corrigir_sem_publicacao',
  APROVAR_COM_PUBLICACAO_MELHORIA: 'aprovar_com_publicacao_melhoria',
  APROVAR_COM_PUBLICACAO_REGISTRO_FUNCIONAL: 'aprovar_com_publicacao_registro_funcional',
};

function calcularDiasDesde(dataInicio) {
  if (!dataInicio) return 0;
  const inicio = new Date(`${String(dataInicio).slice(0, 10)}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (Number.isNaN(inicio.getTime())) return 0;
  return Math.floor((hoje.getTime() - inicio.getTime()) / 86400000);
}

function obterTipoPublicacaoSugerido(segmentoAtual) {
  return calcularDiasDesde(segmentoAtual?.inicio) > 30
    ? TIPO_PUBLICACAO_COMPORTAMENTO.REGISTRO_FUNCIONAL
    : TIPO_PUBLICACAO_COMPORTAMENTO.MELHORIA;
}

function obterTemplateLabel(tipoPublicacao) {
  return tipoPublicacao === TIPO_PUBLICACAO_COMPORTAMENTO.REGISTRO_FUNCIONAL
    ? 'registro_funcional_comportamento'
    : 'melhoria_comportamento';
}

function gerarTextoPublicacaoComportamento({ militar = {}, comportamento, dataInicio, tipoPublicacao = TIPO_PUBLICACAO_COMPORTAMENTO.REGISTRO_FUNCIONAL }) {
  const postoGraduacao = militar.posto_graduacao || '—';
  const nomeCompleto = militar.nome_completo || '—';
  const matricula = obterMatricula(militar);
  if (tipoPublicacao === TIPO_PUBLICACAO_COMPORTAMENTO.MELHORIA) {
    return `Passa a integrar o comportamento ${comportamento || '—'}, a contar de ${formatarData(dataInicio)}, o militar ${postoGraduacao} ${nomeCompleto}, matrícula ${matricula}, conforme apuração dos assentamentos disciplinares e critérios previstos no Decreto nº 1.260, de 02 de outubro de 1981.`;
  }
  return `Para fins de assentamento e registro funcional, fica consignado que o militar ${postoGraduacao} ${nomeCompleto}, matrícula ${matricula}, passou a integrar o comportamento ${comportamento || '—'} a contar de ${formatarData(dataInicio)}, conforme apuração realizada com base nos assentamentos disciplinares constantes em seus registros funcionais e nos critérios previstos no Decreto nº 1.260, de 02 de outubro de 1981.`;
}

function PunicaoApensa({ punicao, comportamentoSegmento }) {
  const [aberta, setAberta] = useState(false);
  const data = obterDataPunicao(punicao);
  const impacto = obterImpactoPunicao(punicao, comportamentoSegmento);
  const descricao = obterDescricaoPunicao(punicao);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 shadow-sm">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs"
        onClick={() => setAberta((atual) => !atual)}
      >
        <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{punicao.tipo_resolvido || punicao.tipo || 'Punição'} • {formatarData(data)}</span>
          <span className="block text-red-700">{impacto}</span>
        </span>
        {aberta ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      </button>
      {aberta ? (
        <div className="space-y-1 border-t border-red-200 px-3 py-2 text-xs text-red-900">
          <p><strong>Data-base:</strong> {formatarData(data)}</p>
          <p><strong>Prisão equivalente:</strong> {punicao.prisao_equivalente ?? 0}</p>
          <p><strong>Detenção equivalente:</strong> {punicao.detencao_equivalente ?? 0}</p>
          <p><strong>Status:</strong> {punicao.status_resolvido || punicao.status_punicao || punicao.status || '—'}</p>
          <p><strong>Impacto no comportamento:</strong> {impacto}</p>
          {descricao ? <p><strong>Descrição/motivo:</strong> {descricao}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function TimelineCards({ segmentos, eventos = [] }) {
  return (
    <div className="overflow-x-auto pb-3">
      <div className="relative flex min-w-max gap-5 pt-8">
        <div className="absolute left-8 right-8 top-4 h-0.5 bg-slate-200" />
        {segmentos.map((seg, index) => {
          const { punicoes: punicoesSegmento, advertencias } = normalizarEventosDoSegmento(seg, eventos);
          const semApensos = !punicoesSegmento.length && !advertencias.length;
          return (
            <div key={`${seg.inicio}-${index}`} className="relative w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`absolute -top-6 left-6 h-4 w-4 rounded-full border-4 border-white shadow ${seg.isAtual ? 'bg-blue-700' : 'bg-slate-300'}`} />
              <div className="flex flex-wrap items-center gap-2">
                <ComportamentoBadge valor={seg.comportamento} destaque={seg.isAtual} />
                {seg.isAtual ? <Badge className="border-blue-200 bg-blue-50 text-blue-700">ATUAL</Badge> : null}
                {seg.isProjetado ? <Badge className="border-violet-200 bg-violet-50 text-violet-700">PROJEÇÃO</Badge> : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">{formatarData(seg.inicio)} — {formatarData(seg.fim)}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{seg.fundamento || 'Período calculado conforme histórico disciplinar.'}</p>
              <div className="mt-4 space-y-2">
                {punicoesSegmento.map((punicao, punicaoIndex) => (
                  <PunicaoApensa
                    key={`${punicao.id || punicao.punicao_id || obterDataPunicao(punicao)}-${punicaoIndex}`}
                    punicao={punicao}
                    comportamentoSegmento={seg.comportamento}
                  />
                ))}
                {advertencias.map((advertencia, advertenciaIndex) => (
                  <div key={`${advertencia.id || advertencia.punicao_id || obterDataPunicao(advertencia)}-${advertenciaIndex}`} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-3.5 w-3.5" /> Advertência — sem impacto no comportamento</div>
                    <p className="mt-1 text-blue-600">{formatarData(obterDataPunicao(advertencia))} • {advertencia.status_resolvido || advertencia.status || 'Informativa'}</p>
                  </div>
                ))}
                {semApensos ? <p className="text-xs text-slate-400">Sem punições vinculadas ao período.</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetalhesAuditoria({ linha }) {
  const [viewMode, setViewMode] = useState('bar');
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const { toast } = useToast();
  const detalhes = linha.calculado?.detalhes || {};
  const segmentos = linha.timeline?.segmentos || [];
  const segmentoAtual = linha.timeline?.segmentoAtual;
  const punicoesConsideradas = detalhes.janela_8_anos?.punicoes || [];
  const advertencias = linha.timeline?.segmentoAtual?.advertenciasInformativas || [];
  const inconsistencias = linha.calculado?.inconsistencias || [];
  const tipoPublicacaoSugerido = obterTipoPublicacaoSugerido(segmentoAtual);
  const textoPublicacaoPreview = gerarTextoPublicacaoComportamento({
    militar: linha.militar,
    comportamento: linha.calculado?.comportamento || segmentoAtual?.comportamento,
    dataInicio: segmentoAtual?.inicio,
    tipoPublicacao: tipoPublicacaoSugerido,
  });
  const comportamentoCalculado = linha.calculado?.comportamento || segmentoAtual?.comportamento;
  const comportamentoCadastrado = linha.militar.comportamento || 'Bom';
  const temInconsistencia = linha.inconsistenteCalculo || inconsistencias.length > 0;
  const mensagemAcaoSugerida = temInconsistencia
    ? 'Ação indisponível até correção das inconsistências cadastrais.'
    : !segmentoAtual
      ? 'Não foi possível identificar o período vigente do comportamento.'
      : comportamentoCalculado
        ? `Ação sugerida: gerar publicação de ${tipoPublicacaoSugerido === TIPO_PUBLICACAO_COMPORTAMENTO.REGISTRO_FUNCIONAL ? 'registro funcional' : 'melhoria de comportamento'}.`
        : 'Não foi possível identificar o comportamento calculado atual.';

  const copiarTextoPublicacao = async () => {
    const clipboardDisponivel = typeof navigator !== 'undefined' && navigator?.clipboard?.writeText;
    if (!clipboardDisponivel) {
      toast({
        title: 'Copie manualmente',
        description: 'A área de transferência não está disponível neste navegador. Selecione o texto da prévia e copie manualmente.',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(textoPublicacaoPreview);
      toast({
        title: 'Texto copiado',
        description: 'A prévia de publicação foi copiada para a área de transferência.',
      });
    } catch {
      toast({
        title: 'Copie manualmente',
        description: 'Não foi possível copiar automaticamente. Selecione o texto da prévia e copie manualmente.',
      });
    }
  };

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
          {segmentos.length ? (viewMode === 'bar' ? (
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              <ComportamentoTimelineCalculada timelineCalculada={linha.timeline} compacto />
            </div>
          ) : <TimelineCards segmentos={segmentos} eventos={linha.timeline?.eventos || []} />) : (
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

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-700"><FileText className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Regularização funcional</h2>
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">Prévia</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">Diagnóstico operacional para preparar o fluxo administrativo de publicação.</p>
            </div>
          </div>
          <Badge className="border-amber-200 bg-amber-50 text-amber-800">Verificação pendente</Badge>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <p><strong>Comportamento calculado atual:</strong> {comportamentoCalculado || '—'}</p>
            <p><strong>Vigente desde:</strong> {formatarData(segmentoAtual?.inicio)}</p>
            <p><strong>Comportamento cadastrado:</strong> {comportamentoCadastrado}</p>
            <p><strong>Divergência cadastral:</strong> {linha.divergente ? 'Sim' : 'Não'}</p>
            <p><strong>Situação da publicação funcional:</strong> Verificação pendente</p>
          </div>
          <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            A verificação automática de publicação existente será habilitada em etapa futura.
          </p>
          <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-semibold ${temInconsistencia || !segmentoAtual ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {mensagemAcaoSugerida}
          </p>
        </div>

        {comportamentoCalculado && segmentoAtual ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Texto de publicação — prévia</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-800">{textoPublicacaoPreview}</p>
                <p className="mt-3 text-xs font-semibold text-amber-800">Template sugerido: {obterTemplateLabel(tipoPublicacaoSugerido)}. Confirme se já não existe publicação anterior para este fato.</p>
              </div>
              <Button type="button" variant="outline" onClick={copiarTextoPublicacao}>
                <FileText className="mr-2 h-4 w-4" />
                Copiar texto
              </Button>
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

  const aplicarSugestao = async (linha, { modoAprovacao = MODOS_APROVACAO.CORRIGIR_SEM_PUBLICACAO } = {}) => {
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

      const dataInicioCalculada = linha.timeline?.segmentoAtual?.inicio || new Date().toISOString().slice(0, 10);
      const resultadoAplicacao = await aplicarPendenciasComportamentoEmLote({
        pendencias: [pendenciaParaAplicacao.id],
        usuarioAtual: { canAccessAction },
        options: { dataReferencia: dataInicioCalculada },
      });

      if (resultadoAplicacao.totalAplicadas !== 1) {
        const motivoFalha = resultadoAplicacao.falhas?.[0]?.erro
          || resultadoAplicacao.falhas?.[0]?.motivo
          || resultadoAplicacao.ignoradas?.[0]?.motivo
          || 'Falha ao aplicar pendência de comportamento.';
        throw new Error(motivoFalha);
      }

      let resultadoRPAutomatico = null;
      const deveGerarPublicacao = modoAprovacao !== MODOS_APROVACAO.CORRIGIR_SEM_PUBLICACAO;
      let falhaPublicacao = null;
      if (deveGerarPublicacao) {
        try {
          const historicoMilitar = await obterHistoricoComportamentoMilitar(linha.militar.id, { ordem: 'desc' });
          const marcoAplicado = resultadoAplicacao.aplicadas?.[0]?.marco || null;
          const marcoParaPublicacao = marcoAplicado?.id
            ? marcoAplicado
            : historicoMilitar.find((marco) => (
              marco?.comportamento_novo === linha.calculado.comportamento
              && String(marco?.data_alteracao || '').slice(0, 10) === String(dataInicioCalculada).slice(0, 10)
            )) || null;
          const tipoPublicacao = modoAprovacao === MODOS_APROVACAO.APROVAR_COM_PUBLICACAO_REGISTRO_FUNCIONAL
            ? TIPO_PUBLICACAO_COMPORTAMENTO.REGISTRO_FUNCIONAL
            : TIPO_PUBLICACAO_COMPORTAMENTO.MELHORIA;
          const texto = gerarTextoPublicacaoComportamento({
            militar: linha.militar,
            comportamento: linha.calculado.comportamento,
            dataInicio: dataInicioCalculada,
            tipoPublicacao,
          });

          resultadoRPAutomatico = await gerarPublicacaoComportamento({
            militar: linha.militar,
            comportamento: linha.calculado.comportamento,
            dataInicio: dataInicioCalculada,
            fundamento: linha.calculado.fundamento,
            tipoPublicacao,
            texto,
            marcoHistorico: marcoParaPublicacao,
            geradoPor: userEmail || '',
          });

          const houveFalhaPublicacao = !resultadoRPAutomatico?.ok
            && resultadoRPAutomatico?.motivo !== 'publicacao_ja_existente';
          if (houveFalhaPublicacao) {
            falhaPublicacao = resultadoRPAutomatico?.motivo || 'Falha ao gerar publicação automática.';
          }
        } catch (error) {
          falhaPublicacao = error?.message || 'Falha ao gerar publicação automática.';
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['avaliacao-comportamento-militares'] }),
        queryClient.invalidateQueries({ queryKey: ['militares'] }),
        queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
      ]);

      const descricaoPublicacao = !deveGerarPublicacao
        ? 'Comportamento aplicado com sucesso.'
        : falhaPublicacao
          ? `Comportamento aplicado, mas houve falha ao gerar publicação: ${falhaPublicacao}.`
          : resultadoRPAutomatico?.motivo === 'publicacao_ja_existente'
            ? 'Comportamento aplicado e publicação já existente foi reaproveitada (sem duplicidade).'
            : 'Comportamento aplicado e publicação gerada com sucesso.';

      toast({
        variant: falhaPublicacao ? 'destructive' : undefined,
        title: falhaPublicacao ? 'Comportamento aplicado com alerta' : 'Operação concluída',
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

  const confirmarAprovacao = async ({ modoAprovacao = MODOS_APROVACAO.CORRIGIR_SEM_PUBLICACAO } = {}) => {
    if (!canAprovarMudanca) return;
    if (!aprovacaoModal.linha) return;
    await aplicarSugestao(aprovacaoModal.linha, { modoAprovacao });
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
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Aprovar mudança de comportamento</DialogTitle>
            <DialogDescription>
              Escolha o tratamento administrativo para {aprovacaoModal.linha?.militar?.nome_completo || 'o militar selecionado'}.
            </DialogDescription>
          </DialogHeader>

          {aprovacaoModal.linha ? (() => {
            const linha = aprovacaoModal.linha;
            const segmentoAtual = linha.timeline?.segmentoAtual;
            const tipoSugerido = obterTipoPublicacaoSugerido(segmentoAtual);
            const opcoes = [
              {
                modo: MODOS_APROVACAO.CORRIGIR_SEM_PUBLICACAO,
                titulo: 'Corrigir cadastro sem publicação',
                descricao: 'Use quando a publicação já existe e o sistema apenas precisa refletir o comportamento correto.',
                tipoPublicacao: null,
              },
              {
                modo: MODOS_APROVACAO.APROVAR_COM_PUBLICACAO_MELHORIA,
                titulo: 'Aprovar e gerar publicação de melhoria',
                descricao: 'Use quando o militar atingiu agora o tempo para melhoria de comportamento.',
                tipoPublicacao: TIPO_PUBLICACAO_COMPORTAMENTO.MELHORIA,
              },
              {
                modo: MODOS_APROVACAO.APROVAR_COM_PUBLICACAO_REGISTRO_FUNCIONAL,
                titulo: 'Aprovar e gerar publicação de registro funcional',
                descricao: 'Use quando a correção é retroativa ou não há publicação anterior localizada.',
                tipoPublicacao: TIPO_PUBLICACAO_COMPORTAMENTO.REGISTRO_FUNCIONAL,
              },
            ];

            return (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Confirme se já não existe publicação anterior para este fato.
                </div>
                {opcoes.map((opcao) => {
                  const template = opcao.tipoPublicacao ? obterTemplateLabel(opcao.tipoPublicacao) : 'sem publicação';
                  const sugerida = opcao.tipoPublicacao === tipoSugerido || (!opcao.tipoPublicacao && !tipoSugerido);
                  return (
                    <div key={opcao.modo} className={`rounded-xl border p-4 ${sugerida && opcao.tipoPublicacao ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">{opcao.titulo}</h3>
                            {sugerida && opcao.tipoPublicacao ? <Badge className="border-blue-200 bg-white text-blue-700">Sugerido</Badge> : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{opcao.descricao}</p>
                          <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                            <p><strong>Comportamento atual cadastrado:</strong> {linha.militar.comportamento || 'Bom'}</p>
                            <p><strong>Comportamento calculado:</strong> {linha.calculado?.comportamento || '—'}</p>
                            <p><strong>Data de vigência calculada:</strong> {formatarData(segmentoAtual?.inicio)}</p>
                            <p><strong>Template:</strong> {template}</p>
                          </div>
                        </div>
                        <Button onClick={() => confirmarAprovacao({ modoAprovacao: opcao.modo })} disabled={!canAprovarMudanca} variant={opcao.tipoPublicacao ? 'default' : 'outline'}>
                          {opcao.tipoPublicacao ? <FileText className="w-4 h-4 mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
