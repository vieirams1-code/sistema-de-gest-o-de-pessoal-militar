import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format } from 'date-fns';
import { Check, ChevronDown, ChevronRight, Circle, Eye, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';


export function parseDadosAdministrativosJiso(observacoes) {
  if (!observacoes || typeof observacoes !== 'string') {
    return { numero_tars: '', hora_jiso: '', local_jiso: '' };
  }

  const blocoAdmin = observacoes.match(/\[JISO_ADMIN\]\s*([\s\S]*?)\s*\[\/JISO_ADMIN\]/i)?.[1] || '';
  const origem = blocoAdmin || observacoes;
  const numero_tars = (origem.match(/(?:^|\n)TARS:\s*(.+)/i)?.[1] || '').trim();
  const hora_jiso = (origem.match(/(?:^|\n)HORA_JISO:\s*(.+)/i)?.[1] || '').trim();
  const local_jiso = (origem.match(/(?:^|\n)LOCAL_JISO:\s*(.+)/i)?.[1] || '').trim();

  return { numero_tars, hora_jiso, local_jiso };
}

export function buildObservacoesJiso({ observacoesBase = '', numero_tars = '', hora_jiso = '', local_jiso = '' } = {}) {
  const textoBase = String(observacoesBase || '');
  const semBlocoAdmin = textoBase.replace(/\n?---\n?\[JISO_ADMIN\][\s\S]*?\[\/JISO_ADMIN\]\n?---\n?/gi, '\n').trimEnd();

  const linhasAdmin = [];
  if (numero_tars?.trim()) linhasAdmin.push(`TARS: ${numero_tars.trim()}`);
  if (hora_jiso?.trim()) linhasAdmin.push(`HORA_JISO: ${hora_jiso.trim()}`);
  if (local_jiso?.trim()) linhasAdmin.push(`LOCAL_JISO: ${local_jiso.trim()}`);

  if (!linhasAdmin.length) return semBlocoAdmin;

  const blocoAdmin = ['---', '[JISO_ADMIN]', ...linhasAdmin, '[/JISO_ADMIN]', '---'].join('\n');
  return [semBlocoAdmin, blocoAdmin].filter(Boolean).join('\n');
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(value) {
  const date = parseDateOnly(value);
  if (!date) return '—';
  return format(date, 'dd/MM/yyyy');
}

function getStatusJisoDerivado({ jiso }) {
  if (!jiso) return 'Sem JISO';
  if (jiso.resultado_jiso || jiso.ata_jiso || jiso.data_ata) return 'Decisão registrada';
  if (jiso.data_jiso || jiso.data_agendamento) return 'Sessão agendada';
  if (jiso.id) return 'Encaminhado';
  return 'Sem JISO';
}

function getJisoBadgeClass(statusJiso) {
  if (statusJiso === 'Encaminhado') return 'border-purple-200 bg-purple-50 text-purple-700';
  if (statusJiso === 'Sessão agendada') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (statusJiso === 'Decisão registrada') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}


function buildHistorico(atestado, jiso) {
  const eventos = [
    atestado?.data_inicio && { label: 'Atestado iniciado', data: atestado.data_inicio },
    (jiso?.data_agendamento || jiso?.data_jiso) && { label: 'JISO agendada', data: jiso.data_agendamento || jiso.data_jiso },
    (jiso?.data_ata || jiso?.ata_jiso) && { label: 'Ata registrada', data: jiso.data_ata || jiso.ata_jiso },
    atestado?.data_termino && { label: 'Término previsto', data: atestado.data_termino },
  ].filter(Boolean);

  return eventos.sort((a, b) => (a.data > b.data ? 1 : -1));
}

export default function AtestadosJisoListaView({
  atestados: atestadosProp = [],
  jisos: jisosProp = [],
  loading = false,
  onRegistrarDecisaoJiso,
  onVisualizarJiso,
  onPublicarHomologacao,
  onPublicarAtaJiso,
  canRegistrarDecisaoJiso = false,
  canPublicarHomologacao = false,
  canPublicarAtaJiso = false,
  getStatusDocumentalAtaJiso,
  hasHomologacaoGerada,
  hasHomologacaoAtiva,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState(null);
  const [draftByAtestado, setDraftByAtestado] = useState({});
  const [generatedTextByAtestado, setGeneratedTextByAtestado] = useState({});
  const atestados = Array.isArray(atestadosProp) ? atestadosProp : [];
  const jisos = Array.isArray(jisosProp) ? jisosProp : [];

  const jisoPorAtestado = useMemo(() => {
    const mapa = new Map();
    jisos.forEach((jiso) => {
      if (jiso?.atestado_id) mapa.set(jiso.atestado_id, jiso);
    });
    return mapa;
  }, [jisos]);

  const updateDraft = (atestadoId, field, value) => {
    setDraftByAtestado((prev) => ({
      ...prev,
      [atestadoId]: {
        ...(prev[atestadoId] || {}),
        [field]: value,
      },
    }));
  };

  const salvarDadosAdministrativosMutation = useMutation({
    mutationFn: async ({ atestado, jiso, draft }) => {
      const dadosAtuais = parseDadosAdministrativosJiso(jiso?.observacoes);
      const atual = {
        numero_tars: (dadosAtuais?.numero_tars || '').trim(),
        hora_jiso: (dadosAtuais?.hora_jiso || '').trim(),
        local_jiso: (dadosAtuais?.local_jiso || '').trim(),
        data_jiso: (jiso?.data_jiso || jiso?.data_agendamento || '').trim(),
      };
      const proximo = {
        numero_tars: (draft?.numero_tars || '').trim(),
        hora_jiso: (draft?.hora_jiso || '').trim(),
        local_jiso: (draft?.local_jiso || '').trim(),
        data_jiso: (draft?.data_jiso || '').trim(),
      };
      const hasChanges = Object.keys(proximo).some((chave) => atual[chave] !== proximo[chave]);

      if (!hasChanges) {
        toast({
          title: 'Nada para salvar',
          description: 'Nenhuma alteração detectada nos campos administrativos da JISO.',
        });
        console.warn('[JISO-TARS] Salvamento ignorado: sem alterações nos dados administrativos.');
        return null;
      }

      const observacoes = buildObservacoesJiso({
        observacoesBase: jiso?.observacoes || '',
        numero_tars: draft?.numero_tars || '',
        hora_jiso: draft?.hora_jiso || '',
        local_jiso: draft?.local_jiso || '',
      });

      if (jiso?.id) {
        const payload = {
          observacoes,
          data_jiso: proximo.data_jiso,
        };
        if (proximo.data_jiso && !jiso?.resultado_jiso && !jiso?.ata_jiso && !jiso?.data_ata) {
          payload.status = 'Agendada';
        }
        return base44.entities.JISO.update(jiso.id, payload);
      }

      if (!atestado?.id) return null;

      return base44.entities.JISO.create({
        atestado_id: atestado.id,
        militar_id: atestado.militar_id,
        militar_nome: atestado.militar_nome,
        militar_posto: atestado.militar_posto,
        militar_matricula: atestado.militar_matricula_atual || atestado.militar_matricula,
        militar_matricula_atual: atestado.militar_matricula_atual || atestado.militar_matricula,
        militar_matricula_vinculo: atestado.militar_matricula_vinculo || atestado.militar_matricula,
        data_jiso: proximo.data_jiso,
        observacoes,
        status: proximo.data_jiso
          ? 'Agendada'
          : proximo.numero_tars
            ? 'Encaminhado'
            : 'Pendente',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['atestados'] });
      await queryClient.invalidateQueries({ queryKey: ['cards'] });
      await queryClient.invalidateQueries({ queryKey: ['atestados-jiso'] });
      await queryClient.invalidateQueries({ queryKey: ['atestados-jiso-bundle'] });
      await queryClient.invalidateQueries({ queryKey: ['jisos'] });
      await queryClient.invalidateQueries({ queryKey: ['jiso'] });
      await queryClient.invalidateQueries({ queryKey: ['agenda-saude'] });
    },
    onError: (error) => {
      toast({
        title: 'Falha ao salvar dados administrativos',
        description: error?.message || 'Não foi possível persistir os dados da JISO/TARS.',
        variant: 'destructive',
      });
      console.error('[JISO-TARS] Falha ao persistir dados administrativos.', error);
    },
  });

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Carregando lista...</div>;
  }

  if (!atestados.length) {
    return <div className="py-10 text-center text-slate-500">Nenhum atestado encaminhado para JISO.</div>;
  }

  return (
    <div className="space-y-3">
      {atestados.map((atestado, index) => {
        const atestadoId = atestado?.id ?? `sem-id-${index}`;
        const jiso = jisoPorAtestado.get(atestado?.id);
        const statusJiso = getStatusJisoDerivado({ atestado, jiso });
        const dias = Number(atestado?.dias || atestado?.quantidade_dias || 0);
        const inicio = parseDateOnly(atestado?.data_inicio);
        const fim = parseDateOnly(atestado?.data_retorno || atestado?.data_termino);
        const hoje = parseDateOnly(new Date().toISOString().slice(0, 10));
        const diasRestantes = fim ? differenceInCalendarDays(fim, hoje) : null;
        const diasDecorridos = inicio ? Math.max(0, differenceInCalendarDays(hoje, inicio)) : 0;
        const progresso = dias > 0 ? Math.max(0, Math.min(100, (diasDecorridos / dias) * 100)) : 0;
        const isExpanded = expandedId === atestadoId;
        const historico = buildHistorico(atestado, jiso);
        const hasJisoRegistro = Boolean(jiso?.id);
        const hasJisoData = Boolean((jiso?.data_jiso || jiso?.data_agendamento || atestado?.data_jiso_agendada || '').trim?.() || (jiso?.data_jiso || jiso?.data_agendamento || atestado?.data_jiso_agendada));
        const isFluxoJiso = atestado?.fluxo_homologacao === 'jiso' || dias > 15;
        const exibirBlocoJisoAdministrativo = isFluxoJiso || hasJisoRegistro || hasJisoData;
        const isFluxoComandante = atestado?.fluxo_homologacao === 'comandante';
        const homologacaoGerada = hasHomologacaoGerada?.(atestado) === true;
        const homologacaoAtiva = hasHomologacaoAtiva?.(atestado) === true;
        const statusAtaJiso = getStatusDocumentalAtaJiso?.(atestado, jiso);
        const bloqueiaPublicacaoAta = statusAtaJiso?.bloqueiaNovaPublicacao === true;
        const disableRegistrarJiso = canRegistrarDecisaoJiso === false || !onRegistrarDecisaoJiso;
        const disablePublicarHomologacao = homologacaoAtiva || canPublicarHomologacao === false || !onPublicarHomologacao;
        const disablePublicarAtaJiso = bloqueiaPublicacaoAta || canPublicarAtaJiso === false || !onPublicarAtaJiso;
        const tituloBotaoRegistrarJiso = disableRegistrarJiso ? 'Sem permissão para esta ação' : undefined;
        const tituloBotaoPublicarHomologacao = homologacaoAtiva
          ? 'Homologação já existente'
          : (canPublicarHomologacao === false ? 'Sem permissão para esta ação' : undefined);
        const tituloBotaoPublicarAtaJiso = bloqueiaPublicacaoAta
          ? 'Publicação bloqueada por documento ativo'
          : (canPublicarAtaJiso === false ? 'Sem permissão para esta ação' : undefined);
        const dadosAdmin = parseDadosAdministrativosJiso(jiso?.observacoes);
        const draft = {
          numero_tars: dadosAdmin.numero_tars || '',
          hora_jiso: dadosAdmin.hora_jiso || '',
          local_jiso: dadosAdmin.local_jiso || '',
          data_jiso: jiso?.data_jiso || jiso?.data_agendamento || atestado?.data_jiso_agendada || '',
          ...(draftByAtestado[atestadoId] || {}),
        };
        const dadosAtuais = {
          numero_tars: (dadosAdmin?.numero_tars || '').trim(),
          hora_jiso: (dadosAdmin?.hora_jiso || '').trim(),
          local_jiso: (dadosAdmin?.local_jiso || '').trim(),
          data_jiso: (jiso?.data_jiso || jiso?.data_agendamento || atestado?.data_jiso_agendada || '').trim(),
        };
        const dadosDraft = {
          numero_tars: (draft?.numero_tars || '').trim(),
          hora_jiso: (draft?.hora_jiso || '').trim(),
          local_jiso: (draft?.local_jiso || '').trim(),
          data_jiso: (draft?.data_jiso || '').trim(),
        };
        const hasPendingAdminChanges = Object.keys(dadosDraft).some((chave) => dadosAtuais[chave] !== dadosDraft[chave]);
        const timelineEtapas = [
          { label: 'Atestado', done: Boolean(atestado?.id) },
          { label: 'TARS', done: Boolean((draft?.numero_tars || '').trim()) },
          { label: 'JISO', done: Boolean((draft?.data_jiso || '').trim() || jiso?.data_jiso || jiso?.data_agendamento || atestado?.data_jiso_agendada) },
          { label: 'Decisão', done: Boolean(jiso?.resultado_jiso || jiso?.data_ata || jiso?.ata_jiso) },
          { label: 'Publicação', done: atestado?.status_publicacao === 'Publicado' },
        ];

        return (
          <div key={atestadoId} className="space-y-3">
            <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${isExpanded ? 'border-blue-200 ring-1 ring-blue-100' : ''}`}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_auto] lg:items-start">
                <div className="flex min-w-0 gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="mt-1 h-9 w-9 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => setExpandedId((prev) => (prev === atestadoId ? null : atestadoId))}
                    aria-label={isExpanded ? 'Recolher linha' : 'Expandir linha'}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Militar</p>
                      <p className="truncate text-base font-semibold text-slate-900">{atestado.militar_nome || '—'}</p>
                      <p className="text-sm text-slate-600">{atestado.militar_posto || '—'} • {atestado.militar_matricula_label || atestado.militar_matricula_atual || atestado.militar_matricula || '—'}</p>
                      <p className="text-sm text-slate-500">{atestado.militar_lotacao || atestado.lotacao || 'Lotação não informada'}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Período</p>
                      <p className="text-sm text-slate-700">{formatDate(atestado.data_inicio)} → {formatDate(atestado.data_retorno || atestado.data_termino)}</p>
                                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${progresso}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {diasRestantes === null ? 'Dias restantes não calculáveis' : diasRestantes < 0 ? `${Math.abs(diasRestantes)} dia(s) em atraso` : `${diasRestantes} dia(s) restantes`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{atestado.status || '—'}</Badge>
                      <Badge variant="outline">{atestado.tipo_afastamento || '—'}</Badge>
                      <Badge className={getJisoBadgeClass(statusJiso)}>{statusJiso}</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button size="sm" variant="outline" className="rounded-xl border-slate-200 bg-white hover:bg-slate-50" onClick={() => onVisualizarJiso?.(atestado, jiso)}>
                    <Eye className="mr-1 h-4 w-4" />Visualizar
                  </Button>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline derivada JISO</p>
                    <div className="mt-3 space-y-2">
                      {timelineEtapas.map((etapa) => (
                        <div key={etapa.label} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${etapa.done ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                            {etapa.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          </span>
                          <span className="text-xs font-medium text-slate-700">{etapa.label}</span>
                          <span className={`ml-auto text-[11px] font-semibold ${etapa.done ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {etapa.done ? 'Concluído' : 'Pendente'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico simples</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">
                      {historico.length ? historico.map((evento) => (
                        <li key={`${evento.label}-${evento.data}`}>• {formatDate(evento.data)} — {evento.label}</li>
                      )) : <li>Sem eventos adicionais.</li>}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    {exibirBlocoJisoAdministrativo && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 space-y-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dados administrativos da JISO</p>
                        <p className="mt-1 text-xs text-slate-500">TARS de solicitação e agendamento informado pela Diretoria de Saúde.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Nº TARS</Label>
                          <Input value={draft.numero_tars || ''} onChange={(e) => updateDraft(atestadoId, 'numero_tars', e.target.value)} placeholder="231/2026" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data JISO</Label>
                          <Input type="date" value={draft.data_jiso || ''} onChange={(e) => updateDraft(atestadoId, 'data_jiso', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Hora JISO</Label>
                          <Input type="time" value={draft.hora_jiso || ''} onChange={(e) => updateDraft(atestadoId, 'hora_jiso', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Local JISO</Label>
                          <Input value={draft.local_jiso || ''} onChange={(e) => updateDraft(atestadoId, 'local_jiso', e.target.value)} placeholder="Diretoria de Saúde" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                        const posto = atestado?.militar_posto || '—';
                        const nome = atestado?.militar_nome || '—';
                        const matricula = atestado?.militar_matricula_label || atestado?.militar_matricula_atual || atestado?.militar_matricula || '—';
                        const diasAfastamento = atestado?.dias || atestado?.quantidade_dias || '—';
                        const dataInicio = formatDate(atestado?.data_inicio);
                        const dataFim = formatDate(atestado?.data_retorno || atestado?.data_termino);
                        const lotacao = atestado?.militar_lotacao || atestado?.lotacao || atestado?.lotacao || 'lotação não informada';
                        const cid = atestado?.cid || atestado?.codigo_cid || 'não informado';
                        const texto = `Solicito a essa Diretoria de Saúde a marcação de Junta de Inspeção de Saúde para o militar ${posto} ${nome}, matrícula ${matricula}, lotado em ${lotacao}, em razão de atestado médico de ${diasAfastamento} dias, CID ${cid}, referente ao período de ${dataInicio} a ${dataFim}.`;
                        setGeneratedTextByAtestado((prev) => ({ ...prev, [atestadoId]: texto }));
                        console.warn('[JISO-TARS][visual-only] Preview local do texto TARS gerado sem persistência.', { atestadoId });
                      }}>Gerar preview TARS</Button>
                        <Button size="sm" variant="outline" disabled title="Fluxo de ofício de apresentação na JISO não encontrado nos cards atuais.">
                          Gerar ofício de apresentação
                        </Button>
                        <Button
                          size="sm"
                          variant={hasPendingAdminChanges ? 'default' : 'outline'}
                          disabled={salvarDadosAdministrativosMutation.isPending || !canRegistrarDecisaoJiso}
                          title={!canRegistrarDecisaoJiso ? 'Sem permissão para salvar dados administrativos da JISO' : undefined}
                          onClick={() => salvarDadosAdministrativosMutation.mutate({ atestado, jiso, draft })}
                        >
                          Salvar dados da JISO
                        </Button>
                      </div>
                      {generatedTextByAtestado[atestadoId] && (
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{generatedTextByAtestado[atestadoId]}</pre>
                      )}
                      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Próxima etapa
                      </p>
                      Após a realização da sessão, utilize o fluxo atual da JISO para lançar a decisão, aplicar reflexos no atestado, tratar ata e publicação.
                    </div>
                    )}
                    {(isFluxoJiso || (isFluxoComandante && !homologacaoGerada)) && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ações operacionais</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {isFluxoJiso && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={disableRegistrarJiso}
                              title={tituloBotaoRegistrarJiso}
                              onClick={() => onRegistrarDecisaoJiso?.(atestado, jiso)}
                            >
                              Registrar decisão JISO
                            </Button>
                          )}
                          {isFluxoJiso && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={disablePublicarAtaJiso}
                              title={tituloBotaoPublicarAtaJiso}
                              onClick={() => onPublicarAtaJiso?.(atestado, jiso)}
                            >
                              Publicar ata JISO
                            </Button>
                          )}
                          {isFluxoComandante && !homologacaoGerada && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={disablePublicarHomologacao}
                              title={tituloBotaoPublicarHomologacao}
                              onClick={() => onPublicarHomologacao?.(atestado)}
                            >
                              Publicar Homologação
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
