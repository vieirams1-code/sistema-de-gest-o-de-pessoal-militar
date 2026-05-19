import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { POSTOS_GRADUACOES_HIERARQUIA, QUADROS_PROMOCAO_FIXOS } from '@/constants/postosGraduacoes';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  buscarCandidatosProvaveis,
  dataFormatada,
  enriquecerHistoricos,
  filtrarCandidatosCompativeis,
  mensagemBloqueioExclusaoPromocao,
  publicarPromocaoOficial,
  reverterPublicacaoPromocaoMilitar,
  montarMilitarPorId,
  montarPatchPromocaoMilitar,
  montarPayloadAdicaoManualTurma,
  montarPayloadsPromocaoMilitarAgrupamento,
  nomeMilitar,
  statusNormalizado,
  normalizar,
  promocaoPermiteExclusao,
  normalizarItemTurmaOperacional,
  podeVincularProvavelAdministrativamente,
  texto,
  resultadoAplicacaoCadastro,
  sincronizarHistoricoPromocaoPublicada,
  validarPublicacaoPromocao,
  validarSalvarTurmaOperacional,
  valorOuTraco,
} from '@/services/promocaoService';
import { getSugestaoAtualizacaoCadastro } from '@/utils/postoGraduacaoHierarquia';

const DIAG_PREFIX = '[D17-L-DIAG]';
const diagLog = (evento, dados = {}) => console.info(`${DIAG_PREFIX} ${evento}`, dados);

const CAMPOS_PROMOCAO = [
  'posto_graduacao',
  'quadro',
  'status',
  'data_promocao',
  'data_publicacao',
  'boletim_referencia',
  'ato_referencia',
  'observacoes',
];

async function carregarPromocaoPorId(promocaoId) {
  if (!promocaoId) return null;

  if (typeof base44.entities.Promocao.get === 'function') {
    try {
      const promocao = await base44.entities.Promocao.get(promocaoId);
      if (promocao) return promocao;
    } catch (error) {
      console.warn('[DetalhePromocao] Promocao.get indisponível; usando busca alternativa.', error);
    }
  }

  if (typeof base44.entities.Promocao.filter === 'function') {
    const encontrados = await base44.entities.Promocao.filter({ id: promocaoId });
    if (encontrados?.[0]) return encontrados[0];
  }

  const promocoes = await base44.entities.Promocao.list();
  return promocoes.find((promocao) => String(promocao.id) === String(promocaoId)) || null;
}


async function listarPromocaoMilitarVinculados(promocaoId) {
  const entity = base44.entities.PromocaoMilitar;
  if (!entity) throw new Error('Entidade PromocaoMilitar indisponível para validar a exclusão.');
  if (typeof entity.filter === 'function') return entity.filter({ promocao_id: promocaoId });
  if (typeof entity.list === 'function') {
    const registros = await entity.list();
    return (registros || []).filter((registro) => String(registro?.promocao_id || '') === String(promocaoId));
  }
  throw new Error('Não foi possível validar militares vinculados antes da exclusão.');
}

function campoData(valor) {
  return String(valor || '').split('T')[0];
}

function montarRascunhoPromocao(promocao = {}) {
  return {
    posto_graduacao: texto(promocao.posto_graduacao),
    quadro: texto(promocao.quadro),
    status: texto(promocao.status),
    data_promocao: campoData(promocao.data_promocao),
    data_publicacao: campoData(promocao.data_publicacao),
    boletim_referencia: texto(promocao.boletim_referencia),
    ato_referencia: texto(promocao.ato_referencia),
    observacoes: texto(promocao.observacoes),
  };
}

function montarPatchPromocao(rascunho = {}) {
  return CAMPOS_PROMOCAO.reduce((patch, campo) => ({ ...patch, [campo]: rascunho[campo] || '' }), {});
}

function rotuloBoletim(valor) {
  const boletim = texto(valor);
  if (!boletim) return 'Boletim não informado';
  return normalizar(boletim).startsWith('bg') ? boletim : `BG ${boletim}`;
}

function rotuloSituacao(status, publicado) {
  if (publicado || status === 'publicado') return 'Publicado';
  if (status === 'bloqueado') return 'Bloqueado';
  if (status === 'cancelado') return 'Cancelado';
  return 'Na promoção';
}

function situacaoClass(status, publicado) {
  if (publicado || status === 'publicado') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'bloqueado') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (status === 'cancelado') return 'border-rose-300 bg-rose-50 text-rose-700';
  return 'border-indigo-300 bg-indigo-50 text-indigo-700';
}

function mensagemSimples(alerta) {
  const mensagens = {
    'ordem duplicada entre selecionados': 'Existe ordem repetida.',
    'ordem duplicada': 'Existe ordem repetida.',
    'militar duplicado na turma': 'Este militar já está na promoção.',
    'bloqueado/cancelado sem justificativa': 'Informe uma justificativa.',
  };
  return mensagens[alerta] || alerta;
}

function mensagensValidacaoSimples(validacao) {
  return [...new Set((validacao?.bloqueios || []).map(mensagemSimples))];
}

function explicarBloqueioSalvar({ salvando, valido, temAlteracoes, mensagens = [] }) {
  if (salvando) return 'Salvando alterações...';
  if (!valido) return mensagens[0] || 'Revise os militares sinalizados antes de salvar.';
  if (!temAlteracoes) return 'Sem alterações pendentes.';
  return 'Pronto para salvar.';
}


function montarRascunhoItemTurma(registro, promocao) {
  const normalizado = normalizarItemTurmaOperacional(registro);
  const efeito = getSugestaoAtualizacaoCadastro({ militar: registro?.militar, promocao });

  return {
    ...normalizado,
    militar: registro?.militar || null,
    atualizar_cadastro_militar: efeito.atualizar,
    motivo_atualizacao_cadastro: efeito.mensagem,
    resultado_aplicacao_cadastro: efeito.tipo,
  };
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}


function ordemParaOrdenacao(ordem) {
  if (ordem === '' || ordem === null || ordem === undefined) return Number.POSITIVE_INFINITY;
  const numero = Number(ordem);
  return Number.isFinite(numero) ? numero : Number.POSITIVE_INFINITY;
}

function ordenarPorOrdemCrescente(a, b) {
  return (ordemParaOrdenacao(a?.ordem) - ordemParaOrdenacao(b?.ordem)) || nomeMilitar(a?.militar).localeCompare(nomeMilitar(b?.militar));
}


function classeBadgeEfeito(tipo) {
  const classes = {
    historica: 'border-slate-300 bg-slate-50 text-slate-700',
    atual: 'border-blue-300 bg-blue-50 text-blue-700',
    imediatamente_superior: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    incompativel: 'border-rose-300 bg-rose-50 text-rose-700',
    revisao: 'border-amber-300 bg-amber-50 text-amber-700',
  };
  return classes[tipo] || classes.revisao;
}

function efeitoCadastroVisualPorRegistro({ registro, militar, promocao }) {
  const status = statusNormalizado(registro?.status);
  if (status === 'cancelado' || status === 'retificado') {
    return {
      titulo: 'Registro cancelado',
      mensagem: 'Este item não deve ser considerado para promoção atual.',
      tipo: 'historica',
    };
  }
  return getSugestaoAtualizacaoCadastro({ militar, promocao });
}

const SELECT_VAZIO = '__vazio__';

function MilitarCard({ registro, original, promocao, editavel, onAtualizar, onRemover, canReverterPublicacao, onReverterPublicacao }) {
  const militar = original?.militar || registro?.militar;
  const posto = valorOuTraco(militar?.posto_graduacao || militar?.posto_graduacao_atual);
  const quadro = valorOuTraco(militar?.quadro || militar?.quadro_atual);
  const nomeCompleto = valorOuTraco(militar?.nome_completo || nomeMilitar(militar));
  const nomeGuerra = valorOuTraco(militar?.nome_guerra);
  const efeitoCadastro = efeitoCadastroVisualPorRegistro({ registro, militar, promocao });
  const resultadoCadastro = resultadoAplicacaoCadastro(efeitoCadastro);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="xl:w-24 xl:shrink-0">
          <p className="sr-only">Ordem</p>
          {editavel ? (
            <div className="flex h-12 w-24 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 text-blue-700 shadow-sm">
              <span className="text-lg font-bold">#</span>
              <Input
                className="h-10 border-0 bg-transparent px-1 text-center text-lg font-bold shadow-none focus-visible:ring-0"
                type="number"
                value={registro.ordem}
                onChange={(event) => onAtualizar(registro.id, 'ordem', event.target.value === '' ? '' : Number(event.target.value))}
                aria-label={`Ordem de antiguidade de ${nomeMilitar(militar)}`}
              />
            </div>
          ) : (
            <div className="flex h-12 w-24 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-lg font-bold text-blue-700 shadow-sm">
              #{registro.ordem || '—'}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nome completo</p>
            <p className="truncate text-lg font-bold text-slate-950">{nomeCompleto}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nome de guerra</p>
              <p className="mt-1 font-semibold text-slate-800">{nomeGuerra}</p>
              <p className="mt-1 text-sm text-slate-600">{valorOuTraco(militar?.matricula)} • {posto} • {quadro}</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Promoção destino</p>
              <p className="mt-1 font-semibold text-slate-900">{valorOuTraco(promocao?.posto_graduacao)} • {valorOuTraco(promocao?.quadro)}</p>
              <Badge variant="outline" className={`mt-2 ${classeBadgeEfeito(efeitoCadastro.tipo)}`}>
                {efeitoCadastro.titulo}
              </Badge>
              <p className="mt-2 text-xs text-slate-600">{resultadoCadastro}. {efeitoCadastro.mensagem}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Badge variant="outline" className={situacaoClass(registro.status, registro.publicado)}>
            {rotuloSituacao(registro.status, registro.publicado)}
          </Badge>
          {editavel ? (
            Boolean(registro.publicado) ? (
              canReverterPublicacao ? (
                <Button size="sm" variant="destructive" onClick={() => onReverterPublicacao({ ...registro, militar })}>
                  Reverter publicação
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled title="Apenas admin pode reverter publicação">
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remover
                </Button>
              )
            ) : (
              <Button size="sm" variant="outline" onClick={() => onRemover({ ...registro, militar })}>
                <Trash2 className="mr-1 h-4 w-4" />
                Remover
              </Button>
            )
          ) : (
            <span className="text-sm text-slate-500">Aguarde</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DetalhePromocao() {
  const { isAdmin, user } = useCurrentUser();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const promocaoId = searchParams.get('id');
  const listasPreparadasAutomaticamente = useRef(new Set());

  const [rascunhoPromocao, setRascunhoPromocao] = useState(montarRascunhoPromocao());
  const [promocaoBaseComparacao, setPromocaoBaseComparacao] = useState(null);
  const [rascunhoTurma, setRascunhoTurma] = useState([]);
  const [turmaBaseComparacao, setTurmaBaseComparacao] = useState([]);
  const [registroParaRemover, setRegistroParaRemover] = useState(null);
  const [registroParaReverter, setRegistroParaReverter] = useState(null);
  const [confirmacaoReversao, setConfirmacaoReversao] = useState('');
  const [motivoReversao, setMotivoReversao] = useState('');
  const [observacaoReversao, setObservacaoReversao] = useState('');
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [buscaAdicionar, setBuscaAdicionar] = useState('');

  const promocaoQuery = useQuery({
    queryKey: ['detalhe-promocao', promocaoId],
    queryFn: () => carregarPromocaoPorId(promocaoId),
    enabled: Boolean(promocaoId),
  });

  const historicosQuery = useQuery({
    queryKey: ['detalhe-promocao-historicos-v2'],
    queryFn: () => base44.entities.HistoricoPromocaoMilitarV2.list(),
  });

  const promocaoMilitarQuery = useQuery({
    queryKey: ['detalhe-promocao-promocao-militar'],
    queryFn: async () => {
      const entity = base44.entities.PromocaoMilitar;
      if (!entity || typeof entity.list !== 'function') return [];
      try {
        return await entity.list();
      } catch (error) {
        console.warn('[DetalhePromocao] PromocaoMilitar indisponível; lista principal usará registros já vinculados.', error);
        return [];
      }
    },
  });

  const militaresQuery = useQuery({
    queryKey: ['detalhe-promocao-militares'],
    queryFn: () => base44.entities.Militar.list(),
  });

  const promocao = promocaoQuery.data;
  useEffect(() => {
    if (!promocao) return;
    setPromocaoBaseComparacao(promocao);
  }, [promocao]);

  const promocaoConsolidada = promocaoBaseComparacao || promocao;
  const promocaoReferenciaCadastro = useMemo(() => (
    promocaoConsolidada ? { ...promocaoConsolidada, ...montarPatchPromocao(rascunhoPromocao) } : promocaoConsolidada
  ), [promocaoConsolidada, rascunhoPromocao]);
  const militarPorId = useMemo(() => montarMilitarPorId(militaresQuery.data || []), [militaresQuery.data]);

  const historicosVinculados = useMemo(() => {
    if (!promocao) return [];
    return enriquecerHistoricos(
      (historicosQuery.data || []).filter((historico) => (
        String(historico?.promocao_id || '') === String(promocao.id)
        && statusNormalizado(historico?.status_registro) === 'ativo'
      )),
      militarPorId,
    );
  }, [historicosQuery.data, militarPorId, promocao]);

  const turma = useMemo(() => {
    if (!promocao) return [];
    return (promocaoMilitarQuery.data || [])
      .filter((registro) => String(registro?.promocao_id || '') === String(promocao.id))
      .map((registro) => ({
        ...registro,
        militar: militarPorId.get(String(registro?.militar_id || '')) || null,
      }))
      .sort(ordenarPorOrdemCrescente);
  }, [militarPorId, promocao, promocaoMilitarQuery.data]);
  const diagnosticoDuplicidadeTurma = useMemo(() => {
    const grupos = new Map();
    turma.forEach((registro) => {
      const chave = `${String(registro?.promocao_id || '')}|${String(registro?.militar_id || '')}`;
      if (!registro?.militar_id) return;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(registro);
    });
    const duplicados = [...grupos.values()].filter((grupo) => grupo.length > 1);
    return {
      temDuplicidade: duplicados.length > 0,
      duplicados,
    };
  }, [turma]);
  useEffect(() => {
    setTurmaBaseComparacao(turma);
  }, [turma]);

  const listaExibida = useMemo(() => {
    if (turma.length > 0) return turma;
    return historicosVinculados
      .map((historico) => ({
        id: `historico-${historico.id}`,
        promocao_id: promocao?.id || '',
        militar_id: historico.militar_id || '',
        historico_promocao_v2_id: historico.id || '',
        ordem: Number(historico.antiguidade_referencia_ordem) || 0,
        status: 'publicado',
        selecionado: true,
        publicado: true,
        origem: 'legado_historico_v2',
        militar: historico.militar || null,
      }))
      .sort(ordenarPorOrdemCrescente);
  }, [historicosVinculados, promocao, turma]);

  const candidatosHistorico = useMemo(() => {
    if (!promocao) return [];
    const fortes = filtrarCandidatosCompativeis({ promocao, historicos: historicosQuery.data || [] });
    const provaveis = buscarCandidatosProvaveis({ promocao, historicos: historicosQuery.data || [] })
      .filter((historico) => podeVincularProvavelAdministrativamente(historico, promocao));
    const porMilitar = new Map();
    enriquecerHistoricos([...fortes, ...provaveis], militarPorId).forEach((historico) => {
      const militarId = String(historico?.militar_id || '');
      if (militarId && !porMilitar.has(militarId)) porMilitar.set(militarId, historico);
    });
    return [...porMilitar.values()];
  }, [historicosQuery.data, militarPorId, promocao]);

  const candidatosAdicionar = useMemo(() => {
    const idsNaPromocao = new Set(turma.map((registro) => String(registro?.militar_id || '')).filter(Boolean));
    const porMilitar = new Map();

    candidatosHistorico.forEach((historico) => {
      const militarId = String(historico?.militar_id || '');
      if (!militarId || idsNaPromocao.has(militarId)) return;
      porMilitar.set(militarId, {
        id: `historico-${historico.id}`,
        militarId,
        militar: historico.militar || militarPorId.get(militarId) || null,
        historico,
      });
    });

    const termo = normalizar(buscaAdicionar);
    if (termo.length >= 2) {
      (militaresQuery.data || []).forEach((militar) => {
        const militarId = String(militar?.id || '');
        if (!militarId || idsNaPromocao.has(militarId) || porMilitar.has(militarId)) return;
        const buscaMilitar = normalizar(`${nomeMilitar(militar)} ${militar?.nome_completo || ''} ${militar?.matricula || ''}`);
        if (!buscaMilitar.includes(termo)) return;
        const quadroCombina = !texto(promocaoReferenciaCadastro?.quadro) || normalizar(militar?.quadro || militar?.quadro_atual) === normalizar(promocaoReferenciaCadastro?.quadro);
        if (!quadroCombina) return;
        const postoAtual = militar?.posto_graduacao || militar?.posto_graduacao_atual;
        const postoCombinaDestino = !texto(promocaoReferenciaCadastro?.posto_graduacao) || normalizar(postoAtual) === normalizar(promocaoReferenciaCadastro?.posto_graduacao);
        porMilitar.set(militarId, {
          id: `militar-${militarId}`,
          militarId,
          militar,
          historico: null,
          avisoCompatibilidade: postoCombinaDestino
            ? ''
            : `Cadastro atual: ${valorOuTraco(postoAtual)}. Ao adicionar, o sistema vai comparar com o posto da promoção.`,
        });
      });
    }

    return [...porMilitar.values()]
      .filter((item) => {
        if (!termo) return true;
        return normalizar(`${nomeMilitar(item.militar)} ${item.militar?.nome_completo || ''} ${item.militar?.matricula || ''}`).includes(termo);
      })
      .sort((a, b) => Number(Boolean(a.historico) === false) - Number(Boolean(b.historico) === false))
      .slice(0, 30);
  }, [buscaAdicionar, candidatosHistorico, militarPorId, militaresQuery.data, promocao, promocaoReferenciaCadastro, turma]);


  useEffect(() => {
    if (promocao) setRascunhoPromocao(montarRascunhoPromocao(promocao));
  }, [promocao]);

  useEffect(() => {
    setRascunhoTurma(turma.map((registro) => montarRascunhoItemTurma(registro, promocao)));
  }, [promocao, turma]);

  const validacaoSalvarTurma = useMemo(() => validarSalvarTurmaOperacional(
    rascunhoTurma,
    { promocao: promocaoReferenciaCadastro },
  ), [promocaoReferenciaCadastro, rascunhoTurma]);
  const mensagensValidacao = useMemo(() => mensagensValidacaoSimples(validacaoSalvarTurma), [validacaoSalvarTurma]);
  const rascunhoTurmaOrdenado = useMemo(() => (
    [...rascunhoTurma].sort((a, b) => {
      const originalA = turma.find((item) => String(item.id) === String(a.id));
      const originalB = turma.find((item) => String(item.id) === String(b.id));
      return ordenarPorOrdemCrescente(
        { ...a, militar: originalA?.militar },
        { ...b, militar: originalB?.militar },
      );
    })
  ), [rascunhoTurma, turma]);

  const existemAlteracoesPromocao = useMemo(() => {
    if (!promocaoConsolidada) return false;
    return JSON.stringify(montarPatchPromocao(rascunhoPromocao)) !== JSON.stringify(montarPatchPromocao(montarRascunhoPromocao(promocaoConsolidada)));
  }, [promocaoConsolidada, rascunhoPromocao]);

  const existemAlteracoesTurma = useMemo(() => {
    const origem = new Map(turmaBaseComparacao.map((registro) => [String(registro.id), montarPatchPromocaoMilitar(registro, { promocao: promocaoReferenciaCadastro })]));
    return rascunhoTurma.some((registro) => (
      JSON.stringify(montarPatchPromocaoMilitar(registro, { promocao: promocaoReferenciaCadastro })) !== JSON.stringify(origem.get(String(registro.id)) || {})
    ));
  }, [promocaoReferenciaCadastro, rascunhoTurma, turmaBaseComparacao]);

  const atualizarCampoPromocao = (campo, valor) => {
    setRascunhoPromocao((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarRascunhoTurma = (registroId, campo, valor) => {
    setRascunhoTurma((atuais) => atuais.map((registro) => {
      if (String(registro.id) !== String(registroId)) return registro;
      if (typeof campo === 'object' && campo !== null) return { ...registro, ...campo };
      return { ...registro, [campo]: valor };
    }));
  };

  const invalidarDados = async () => {
    diagLog('cache:invalidacao:inicio');
    const keys = [
      ['detalhe-promocao', promocaoId],
      ['detalhe-promocao-promocao-militar'],
      ['detalhe-promocao-militares'],
      ['antiguidade-previa'],
      ['previa-antiguidade-geral'],
      ['antiguidade-previa-geral'],
      ['promocoes-operacionais'],
      ['promocoes-operacionais-historicos-v2'],
      ['historico-promocoes'],
    ];

    diagLog('cache:queryKeys', { keys });
    await Promise.all(keys.map(async (queryKey) => {
      diagLog('cache:invalidate:executando', { queryKey });
      const retorno = await queryClient.invalidateQueries({ queryKey });
      diagLog('cache:invalidate:retorno', { queryKey, retorno });
    }));
    await Promise.all(keys.map(async (queryKey) => {
      diagLog('cache:refetch:executando', { queryKey, type: 'active' });
      const retorno = await queryClient.refetchQueries({ queryKey, type: 'active' });
      diagLog('cache:refetch:retorno', { queryKey, retorno });
    }));
  };

  const salvarPromocaoMutation = useMutation({
    mutationFn: async () => {
      if (!promocao) throw new Error('Promoção não carregada.');
      const patchPromocao = montarPatchPromocao(rascunhoPromocao);
      const promocaoAtualizada = { ...promocao, ...patchPromocao };
      diagLog('salvar-promocao-publicada:promocao-update:enviando', { promocaoId: promocao.id, status: promocao.status, patchPromocao });
      const retornoPromocao = await base44.entities.Promocao.update(promocao.id, patchPromocao);
      diagLog('salvar-promocao-publicada:promocao-update:retorno', { promocaoId: promocao.id, retornoPromocao });
      diagLog('salvar-promocao-publicada:sincronizacao:chamada', { chamada: true });
      const sincronizacao = await sincronizarHistoricoPromocaoPublicada({
        promocaoAntes: promocao,
        promocaoDepois: promocaoAtualizada,
        entities: base44.entities,
      });
      return { sincronizacao };
    },
    onSuccess: async (resultado) => {
      setPromocaoBaseComparacao((atual) => (atual ? { ...atual, ...montarPatchPromocao(rascunhoPromocao) } : atual));
      const totalSincronizado = Number(resultado?.sincronizacao?.atualizados) || 0;
      const descricao = totalSincronizado > 0
        ? `Os dados da promoção foram atualizados e ${totalSincronizado} histórico(s) oficial(is) foram sincronizados.`
        : 'Os dados da promoção foram atualizados.';
      toast({ title: 'Dados salvos', description: descricao });
      await invalidarDados();
    },
    onError: (error) => toast({ title: 'Falha ao salvar dados', description: error.message, variant: 'destructive' }),
  });

  const excluirPromocaoMutation = useMutation({
    mutationFn: async () => {
      if (!promocao) throw new Error('Promoção não carregada.');
      const bloqueio = mensagemBloqueioExclusaoPromocao(promocao, { turma });
      if (bloqueio) throw new Error(bloqueio);
      const vinculadosAtuais = await listarPromocaoMilitarVinculados(promocao.id);
      if ((vinculadosAtuais || []).length > 0) {
        throw new Error('Exclusão bloqueada: a promoção possui militares vinculados em PromocaoMilitar.');
      }
      await base44.entities.Promocao.delete(promocao.id);
    },
    onSuccess: () => {
      toast({ title: 'Promoção excluída', description: 'A promoção vazia foi removida.' });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais'] });
      navigate(createPageUrl('Promocoes'));
    },
    onError: (error) => toast({ title: 'Falha ao excluir promoção', description: error.message, variant: 'destructive' }),
  });

  const confirmarExclusaoPromocao = () => {
    const bloqueio = mensagemBloqueioExclusaoPromocao(promocao, { turma });
    if (bloqueio) {
      toast({ title: 'Exclusão não permitida', description: bloqueio, variant: 'destructive' });
      return;
    }
    const confirmou = window.confirm('Esta promoção não possui militares vinculados. Deseja excluir?');
    if (confirmou) excluirPromocaoMutation.mutate();
  };

  const prepararListaMutation = useMutation({
    mutationFn: async () => {
      if (!promocao) throw new Error('Promoção não carregada.');
      if (turma.length > 0) return { listaPreparada: false };

      const entity = base44.entities.PromocaoMilitar;
      if (!entity || typeof entity.create !== 'function') {
        throw new Error('Não foi possível organizar a lista de militares.');
      }

      const registrosAtuais = typeof entity.list === 'function'
        ? await entity.list()
        : (promocaoMilitarQuery.data || []);
      const payloads = montarPayloadsPromocaoMilitarAgrupamento({
        promocao,
        historicos: historicosVinculados,
        registrosExistentes: registrosAtuais || [],
        militarPorId,
      });
      await Promise.all(payloads.map((payload) => entity.create({ ...payload, origem: 'backfill_historico_v2' })));
      return { listaPreparada: payloads.length > 0 };
    },
    onSuccess: async (resultado) => {
      if (resultado?.listaPreparada) toast({ title: 'Lista de militares preparada.' });
      await invalidarDados();
    },
    onError: (error) => {
      listasPreparadasAutomaticamente.current.delete(String(promocao?.id || promocaoId || ''));
      toast({ title: 'Falha ao organizar lista', description: error.message, variant: 'destructive' });
    },
  });

  const salvarTurmaMutation = useMutation({
    mutationFn: async () => {
      if (!base44.entities.PromocaoMilitar || typeof base44.entities.PromocaoMilitar.update !== 'function') {
        throw new Error('Não foi possível salvar a lista.');
      }
      const turmaComEfeito = rascunhoTurma.map((registro) => montarRascunhoItemTurma(registro, promocaoReferenciaCadastro));
      const validacao = validarSalvarTurmaOperacional(turmaComEfeito, { promocao: promocaoReferenciaCadastro });
      if (!validacao.valido) throw new Error(mensagensValidacaoSimples(validacao).join(' '));
      const originais = new Map(turmaBaseComparacao.map((registro) => [String(registro.id), montarPatchPromocaoMilitar(registro, { promocao: promocaoReferenciaCadastro })]));
      const alterados = turmaComEfeito.filter((registro) => (
        JSON.stringify(montarPatchPromocaoMilitar(registro, { promocao: promocaoReferenciaCadastro })) !== JSON.stringify(originais.get(String(registro.id)) || {})
      ));
      await Promise.all(alterados.map((registro) => base44.entities.PromocaoMilitar.update(registro.id, montarPatchPromocaoMilitar(registro, { promocao: promocaoReferenciaCadastro }))));
      return alterados;
    },
    onSuccess: async (alterados = []) => {
      if (alterados.length > 0) {
        const atualizacoes = new Map(alterados.map((registro) => [String(registro.id), registro]));
        setTurmaBaseComparacao((atuais) => atuais.map((registro) => (
          atualizacoes.has(String(registro.id))
            ? { ...registro, ...atualizacoes.get(String(registro.id)) }
            : registro
        )));
      }
      toast({ title: 'Rascunho salvo', description: 'A lista de militares foi atualizada.' });
      await invalidarDados();
    },
    onError: (error) => toast({ title: 'Falha ao salvar rascunho', description: error.message, variant: 'destructive' }),
  });

  const salvarRascunho = async () => {
    if (existemAlteracoesPromocao) await salvarPromocaoMutation.mutateAsync();
    if (existemAlteracoesTurma) await salvarTurmaMutation.mutateAsync();
    if (!existemAlteracoesPromocao && !existemAlteracoesTurma) {
      toast({ title: 'Nada para salvar', description: 'Não há alterações pendentes.' });
    }
  };

  const removerMutation = useMutation({
    mutationFn: async (registro) => {
      if (!registro) throw new Error('Selecione um militar.');
      const statusRegistro = String(registro?.status || '').toLowerCase();
      if (registro.publicado) throw new Error('Não é possível remover militar publicado.');
      if (registro?.historico_promocao_v2_id || ['cancelado', 'retificado'].includes(statusRegistro)) {
        throw new Error('Não é possível remover item com histórico oficial/cancelado; mantenha para preservar rastreabilidade.');
      }
      await base44.entities.PromocaoMilitar.delete(registro.id);
    },
    onSuccess: async () => {
      toast({ title: 'Militar removido', description: 'O militar saiu da lista desta promoção.' });
      setRegistroParaRemover(null);
      await invalidarDados();
    },
    onError: (error) => toast({ title: 'Falha ao remover militar', description: error.message, variant: 'destructive' }),
  });

  const reverterPublicacaoMutation = useMutation({
    mutationFn: async (registro) => {
      if (!isAdmin) throw new Error('Apenas administrador pode reverter publicação.');
      if (!registro?.publicado) throw new Error('Somente item publicado pode ser revertido.');
      return reverterPublicacaoPromocaoMilitar({
        promocao,
        item: registro,
        itensPromocao: listaExibida,
        entities: base44.entities,
        motivo: motivoReversao,
        observacoes: observacaoReversao,
        usuario: user,
      });
    },
    onSuccess: async (resultado) => {
      const partes = ['Histórico cancelado'];
      if (resultado?.cadastroRestaurado) partes.push('Cadastro restaurado');
      partes.push('Promoção reaberta');
      toast({ title: 'Reversão concluída', description: partes.join(' • ') });
      setRegistroParaReverter(null);
      setConfirmacaoReversao('');
      setMotivoReversao('');
      setObservacaoReversao('');
      await invalidarDados();
      if (registro?.militar_id) {
        await queryClient.invalidateQueries({ queryKey: ['militar', registro.militar_id] });
        await queryClient.invalidateQueries({ queryKey: ['ver-historico-promocoes', registro.militar_id] });
        await queryClient.refetchQueries({ queryKey: ['militar', registro.militar_id], type: 'active' });
        await queryClient.refetchQueries({ queryKey: ['ver-historico-promocoes', registro.militar_id], type: 'active' });
      }
      await queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais'] });
    },
    onError: (error) => toast({ title: 'Falha ao reverter publicação', description: error.message, variant: 'destructive' }),
  });

  const adicionarMutation = useMutation({
    mutationFn: async (item) => {
      if (!promocao) throw new Error('Promoção não carregada.');
      if (!item?.militarId) throw new Error('Militar não selecionado.');
      const jaExiste = turma.some((registro) => String(registro?.militar_id || '') === String(item.militarId));
      if (jaExiste) throw new Error('Este militar já está na promoção.');
      const usuario = typeof base44.auth?.me === 'function' ? await base44.auth.me() : null;
      const payload = montarPayloadAdicaoManualTurma({
        promocao,
        historico: item.historico || {},
        militarId: item.militarId,
        usuario,
        registrosExistentes: turma,
        militar: item.militar,
      });
      await base44.entities.PromocaoMilitar.create(payload);
    },
    onSuccess: async () => {
      toast({ title: 'Militar adicionado', description: 'O militar foi incluído na lista desta promoção.' });
      setModalAdicionarAberto(false);
      setBuscaAdicionar('');
      await invalidarDados();
    },
    onError: (error) => toast({ title: 'Falha ao adicionar militar', description: error.message, variant: 'destructive' }),
  });

  const publicarPromocaoMutation = useMutation({
    mutationFn: async () => {
      if (!promocao) throw new Error('Promoção não carregada.');
      const itensPublicacao = rascunhoTurma.map((registro) => ({
        ...montarRascunhoItemTurma(registro, promocao),
        militar: turma.find((item) => String(item.id) === String(registro.id))?.militar || registro.militar || null,
      }));
      return publicarPromocaoOficial({
        promocao,
        itens: itensPublicacao,
        entities: base44.entities,
        temAlteracoesPendentes,
      });
    },
    onSuccess: async (resultado) => {
      toast({
        title: 'Promoção publicada',
        description: `${resultado?.publicados || 0} militar(es) publicado(s) oficialmente.`,
      });
      await invalidarDados();
      await queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais'] });
    },
    onError: (error) => toast({ title: 'Falha ao publicar promoção', description: error.message, variant: 'destructive' }),
  });

  const confirmarPublicacaoPromocao = () => {
    const confirmou = window.confirm('Publicar promoção?\n\nEsta ação registrará a promoção no Histórico V2, atualizará o cadastro do militar quando aplicável e fará a Prévia Geral refletir a nova situação.\n\nDeseja continuar?');
    if (confirmou) publicarPromocaoMutation.mutate();
  };

  const isLoading = promocaoQuery.isLoading || historicosQuery.isLoading || promocaoMilitarQuery.isLoading || militaresQuery.isLoading;
  const error = promocaoQuery.error || historicosQuery.error || promocaoMilitarQuery.error || militaresQuery.error;
  const salvando = salvarPromocaoMutation.isPending || salvarTurmaMutation.isPending || excluirPromocaoMutation.isPending || publicarPromocaoMutation.isPending;
  const temAlteracoesPendentes = existemAlteracoesPromocao || existemAlteracoesTurma;
  const bloqueioSalvarTexto = explicarBloqueioSalvar({
    salvando,
    valido: validacaoSalvarTurma.valido,
    temAlteracoes: temAlteracoesPendentes,
    mensagens: mensagensValidacao,
  });
  const salvarBloqueado = salvando || !validacaoSalvarTurma.valido || !temAlteracoesPendentes;
  const itensValidacaoPublicacao = useMemo(() => rascunhoTurma.map((registro) => ({
    ...registro,
    militar: turma.find((item) => String(item.id) === String(registro.id))?.militar || registro.militar || null,
  })), [rascunhoTurma, turma]);
  const validacaoPublicacao = useMemo(() => validarPublicacaoPromocao({
    promocao: promocaoReferenciaCadastro,
    itens: itensValidacaoPublicacao,
    temAlteracoesPendentes,
  }), [itensValidacaoPublicacao, promocaoReferenciaCadastro, temAlteracoesPendentes]);
  const publicarBloqueado = isLoading || salvando || !validacaoPublicacao.valido;
  const bloqueioPublicarTexto = publicarBloqueado
    ? (isLoading ? 'Carregando dados da promoção.' : validacaoPublicacao.bloqueios[0] || 'Revise a promoção antes de publicar.')
    : 'Pronto para publicar oficialmente.';
  const precisaPrepararLista = turma.length === 0 && historicosVinculados.length > 0;

  useEffect(() => {
    if (historicosQuery.isLoading || promocaoMilitarQuery.isLoading) return;
    if (!promocao || !precisaPrepararLista || prepararListaMutation.isPending) return;
    const chavePromocao = String(promocao.id || '');
    if (!chavePromocao || listasPreparadasAutomaticamente.current.has(chavePromocao)) return;
    listasPreparadasAutomaticamente.current.add(chavePromocao);
    prepararListaMutation.mutate();
  }, [
    historicosQuery.isLoading,
    precisaPrepararLista,
    prepararListaMutation,
    promocao,
    promocaoMilitarQuery.isLoading,
  ]);

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Promoção</p>
          <h1 className="text-3xl font-bold text-slate-900">
            Promoção para {valorOuTraco(promocao?.posto_graduacao)}
          </h1>
          <p className="mt-2 text-slate-700">
            {valorOuTraco(promocao?.quadro)} • {listaExibida.length} militares
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {rotuloBoletim(promocao?.boletim_referencia)} • {dataFormatada(promocao?.data_publicacao || promocao?.data_promocao)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Fluxo: confira os dados à esquerda, adicione militares à direita e salve as alterações.
          </p>
          {diagnosticoDuplicidadeTurma.temDuplicidade && (
            <p className="mt-2 text-sm font-semibold text-amber-700">
              Duplicidade detectada em PromocaoMilitar: revise os vínculos antes de nova publicação.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(createPageUrl('Promocoes'))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button variant="outline" onClick={invalidarDados} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={confirmarPublicacaoPromocao}
            disabled={publicarBloqueado}
            title={bloqueioPublicarTexto}
            className={publicarBloqueado ? 'cursor-not-allowed bg-slate-200 text-slate-500 hover:bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Publicar promoção
          </Button>
          {promocaoPermiteExclusao(promocao, { turma }) && (
            <Button variant="destructive" onClick={confirmarExclusaoPromocao} disabled={excluirPromocaoMutation.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir promoção vazia
            </Button>
          )}
        </div>
      </div>

      {!promocaoId && (
        <Alert variant="destructive">
          <AlertTitle>Promoção não informada</AlertTitle>
          <AlertDescription>Acesse esta tela pela listagem de promoções.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar</AlertTitle>
          <AlertDescription>{error.message || 'Não foi possível carregar os dados da promoção.'}</AlertDescription>
        </Alert>
      )}

      {!isLoading && promocaoId && !promocao && (
        <Alert variant="destructive">
          <AlertTitle>Promoção não encontrada</AlertTitle>
          <AlertDescription>Nenhuma promoção foi localizada para o endereço informado.</AlertDescription>
        </Alert>
      )}

      {promocao && (
        <>
          <div className="grid gap-6 pb-32 lg:grid-cols-[minmax(18rem,30%)_minmax(0,70%)]">
            <Card className="h-fit border-slate-200 bg-white shadow-sm lg:sticky lg:top-8">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Dados da Promoção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Posto/graduação">
                  <Select value={rascunhoPromocao.posto_graduacao || SELECT_VAZIO} onValueChange={(valor) => atualizarCampoPromocao('posto_graduacao', valor === SELECT_VAZIO ? '' : valor)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o posto/graduação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_VAZIO} disabled>Selecione</SelectItem>
                      {POSTOS_GRADUACOES_HIERARQUIA.map((posto) => <SelectItem key={posto} value={posto}>{posto}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quadro">
                  <Select value={rascunhoPromocao.quadro || SELECT_VAZIO} onValueChange={(valor) => atualizarCampoPromocao('quadro', valor === SELECT_VAZIO ? '' : valor)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o quadro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_VAZIO} disabled>Selecione</SelectItem>
                      {QUADROS_PROMOCAO_FIXOS.map((quadro) => <SelectItem key={quadro} value={quadro}>{quadro}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label="Data promoção">
                    <Input type="date" value={rascunhoPromocao.data_promocao} onChange={(event) => atualizarCampoPromocao('data_promocao', event.target.value)} />
                  </Field>
                  <Field label="Data publicação">
                    <Input type="date" value={rascunhoPromocao.data_publicacao} onChange={(event) => atualizarCampoPromocao('data_publicacao', event.target.value)} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label="Boletim">
                    <Input value={rascunhoPromocao.boletim_referencia} onChange={(event) => atualizarCampoPromocao('boletim_referencia', event.target.value)} />
                  </Field>
                  <Field label="Ato">
                    <Input value={rascunhoPromocao.ato_referencia} onChange={(event) => atualizarCampoPromocao('ato_referencia', event.target.value)} />
                  </Field>
                </div>
                <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">Observações</summary>
                  <Textarea
                    className="mt-3 min-h-20 bg-white"
                    value={rascunhoPromocao.observacoes}
                    onChange={(event) => atualizarCampoPromocao('observacoes', event.target.value)}
                  />
                </details>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle>Militares da Promoção ({listaExibida.length})</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Adicione militares e confira a ordem operacional da promoção.</p>
                </div>
                <Button onClick={() => setModalAdicionarAberto(true)} disabled={prepararListaMutation.isPending}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar Militar
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {mensagensValidacao.length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTitle>Revise antes de salvar</AlertTitle>
                    <AlertDescription>
                      Corrija os pontos abaixo para liberar o salvamento.
                      <ul className="mt-2 list-disc pl-5">
                        {mensagensValidacao.map((mensagem) => <li key={mensagem}>{mensagem}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {listaExibida.length === 0 && (
                  <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-8 text-center shadow-sm">
                    <UserPlus className="mx-auto h-10 w-10 text-blue-600" />
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">Nenhum militar incluído</h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
                      Clique em “Adicionar Militar” para montar a lista desta promoção. Depois confira a ordem e salve as alterações.
                    </p>
                    <Button className="mt-4" onClick={() => setModalAdicionarAberto(true)} disabled={prepararListaMutation.isPending}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Adicionar Militar
                    </Button>
                  </div>
                )}

                <div className="space-y-3">
                  {turma.length === 0 && listaExibida.map((registro) => (
                    <MilitarCard
                      key={registro.id}
                      registro={registro}
                      editavel={false}
                      promocao={promocaoReferenciaCadastro}
                      onAtualizar={atualizarRascunhoTurma}
                      onRemover={setRegistroParaRemover}
                      canReverterPublicacao={isAdmin === true}
                      onReverterPublicacao={setRegistroParaReverter}
                    />
                  ))}

                  {turma.length > 0 && rascunhoTurmaOrdenado.map((registro) => {
                    const original = turma.find((item) => String(item.id) === String(registro.id));
                    return (
                      <MilitarCard
                        key={registro.id}
                        registro={registro}
                        original={original}
                        editavel
                        promocao={promocaoReferenciaCadastro}
                        onAtualizar={atualizarRascunhoTurma}
                        onRemover={setRegistroParaRemover}
                        canReverterPublicacao={isAdmin === true}
                        onReverterPublicacao={setRegistroParaReverter}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur md:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-sm">
                <div className="font-medium text-slate-800">{listaExibida.length} militares vinculados</div>
                <div className={salvarBloqueado ? 'text-slate-500' : 'text-emerald-700'}>
                  {bloqueioSalvarTexto}
                </div>
                <div className={publicarBloqueado ? 'text-slate-500' : 'text-emerald-700'}>
                  Publicação: {bloqueioPublicarTexto}
                </div>
              </div>
              <Button
                onClick={salvarRascunho}
                disabled={salvarBloqueado}
                className={salvarBloqueado ? 'cursor-not-allowed bg-slate-200 text-slate-500 hover:bg-slate-200' : ''}
              >
                {!salvarBloqueado && <CheckCircle2 className="mr-2 h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={modalAdicionarAberto} onOpenChange={setModalAdicionarAberto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adicionar militar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Pesquisar militar">
              <Input value={buscaAdicionar} onChange={(event) => setBuscaAdicionar(event.target.value)} placeholder="Digite nome, nome de guerra ou matrícula" />
            </Field>
            <div className="max-h-96 space-y-3 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              {candidatosAdicionar.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
                  Nenhum militar disponível. Digite ao menos duas letras para buscar manualmente ou revise os dados da promoção.
                </div>
              )}
              {candidatosAdicionar.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="truncate text-base font-bold text-slate-950">{valorOuTraco(item.militar?.nome_completo || nomeMilitar(item.militar))}</p>
                        <Badge variant="outline" className="mt-1 border-slate-200 bg-slate-50 text-slate-700">
                          Nome de guerra: {valorOuTraco(item.militar?.nome_guerra)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        {valorOuTraco(item.militar?.matricula)} • {valorOuTraco(item.militar?.posto_graduacao || item.militar?.posto_graduacao_atual)} • {valorOuTraco(item.militar?.quadro || item.militar?.quadro_atual)}
                      </p>
                      {item.avisoCompatibilidade && <p className="mt-2 text-xs text-amber-700">{item.avisoCompatibilidade}</p>}
                    </div>
                    <Button size="sm" onClick={() => adicionarMutation.mutate(item)} disabled={adicionarMutation.isPending}>
                      Adicionar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAdicionarAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(registroParaRemover)} onOpenChange={(open) => !open && setRegistroParaRemover(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover militar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Remover {nomeMilitar(registroParaRemover?.militar)} desta promoção? Militares já publicados não podem ser removidos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistroParaRemover(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => removerMutation.mutate(registroParaRemover)} disabled={!registroParaRemover || registroParaRemover.publicado || removerMutation.isPending}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(registroParaReverter)} onOpenChange={(open) => !open && setRegistroParaReverter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ATENÇÃO</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Você está revertendo uma promoção oficial.</p>
            <p>Esta ação poderá cancelar histórico oficial, restaurar posto/quadro anterior, alterar Prévia Geral e reabrir esta promoção para edição.</p>
            <Label>Digite: REVERTER PROMOÇÃO</Label>
            <Input value={confirmacaoReversao} onChange={(event) => setConfirmacaoReversao(event.target.value)} />
            <Label>Motivo obrigatório</Label>
            <Select value={motivoReversao || SELECT_VAZIO} onValueChange={(value) => setMotivoReversao(value === SELECT_VAZIO ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_VAZIO}>Selecione...</SelectItem>
                <SelectItem value="Erro material">Erro material</SelectItem>
                <SelectItem value="Retificação administrativa">Retificação administrativa</SelectItem>
                <SelectItem value="Publicação indevida">Publicação indevida</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Label>Observações</Label>
            <Textarea value={observacaoReversao} onChange={(event) => setObservacaoReversao(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistroParaReverter(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={confirmacaoReversao.trim() !== 'REVERTER PROMOÇÃO' || !motivoReversao || reverterPublicacaoMutation.isPending}
              onClick={() => reverterPublicacaoMutation.mutate(registroParaReverter)}
            >
              Confirmar reversão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
