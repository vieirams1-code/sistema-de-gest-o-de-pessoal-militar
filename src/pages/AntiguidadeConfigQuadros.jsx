import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Search,
  Save,
  Trash2,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { QUADROS_FIXOS } from '@/utils/postoQuadroCompatibilidade';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const VERSAO_REGRA_RASCUNHO = 'antiguidade.quadros.rascunho.v1';
const OBSERVACAO_PADRAO = 'Confirmar precedência institucional.';
const MOTIVO_INICIAL = 'Configuração inicial a partir dos quadros oficiais do sistema e valores reais cadastrados.';
const TEXTO_PENDENCIA = 'Configuração pendente de confirmação institucional. Esta configuração ainda não gera listagem oficial e não cria snapshot.';

function texto(valor) {
  return String(valor ?? '').trim();
}

function slugLocal(valor, indice = 0) {
  const base = texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `grupo-${indice + 1}`;
}

function ordenarQuadros(a, b) {
  return a.valor.localeCompare(b.valor, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function calcularQuadrosReais(militares) {
  const mapa = new Map();

  (militares || []).forEach((militar) => {
    const valorOriginal = militar?.quadro;
    const valor = valorOriginal === null || valorOriginal === undefined ? '' : String(valorOriginal);
    const chave = valor;
    const atual = mapa.get(chave) || { valor, quantidade: 0, vazio: !texto(valor) };
    atual.quantidade += 1;
    mapa.set(chave, atual);
  });

  return Array.from(mapa.values()).sort((a, b) => {
    if (a.vazio !== b.vazio) return a.vazio ? 1 : -1;
    return ordenarQuadros(a, b);
  });
}

function montarQuadrosDisponiveisParaConfiguracao(quadrosReais) {
  const oficiaisSet = new Set(QUADROS_FIXOS);
  const reaisPorValor = new Map(quadrosReais.map((quadro) => [quadro.valor, quadro]));
  const disponiveis = QUADROS_FIXOS.map((valor, indiceOficial) => {
    const real = reaisPorValor.get(valor);
    return {
      valor,
      quantidade: real?.quantidade || 0,
      vazio: false,
      oficial: true,
      legado: false,
      origem: real ? 'opcao_sistema_e_valor_real' : 'opcao_sistema',
      indiceOficial,
    };
  });

  quadrosReais.forEach((quadro) => {
    if (quadro.vazio || !texto(quadro.valor) || oficiaisSet.has(quadro.valor)) return;
    disponiveis.push({
      ...quadro,
      oficial: false,
      legado: true,
      origem: 'legado_base',
      indiceOficial: Number.POSITIVE_INFINITY,
    });
  });

  quadrosReais.forEach((quadro) => {
    if (!quadro.vazio) return;
    disponiveis.push({
      ...quadro,
      oficial: false,
      legado: false,
      origem: 'valor_real_vazio',
      indiceOficial: Number.POSITIVE_INFINITY,
    });
  });

  return disponiveis.sort((a, b) => {
    if (a.vazio !== b.vazio) return a.vazio ? 1 : -1;
    if (a.oficial !== b.oficial) return a.oficial ? -1 : 1;
    if (a.indiceOficial !== b.indiceOficial) return a.indiceOficial - b.indiceOficial;
    return ordenarQuadros(a, b);
  });
}

function sanitizarMembrosReais(membros, quadrosConfiguraveisSet) {
  if (!Array.isArray(membros)) return [];
  const vistos = new Set();
  return membros
    .map((membro) => String(membro ?? ''))
    .filter((membro) => texto(membro) && quadrosConfiguraveisSet.has(membro) && !vistos.has(membro) && vistos.add(membro));
}

function normalizarGrupoConfigurado(grupo, posicao, quadrosConfiguraveisSet) {
  const nomeGrupo = texto(grupo?.nome_grupo || grupo?.grupo || grupo?.nome);
  const membrosReais = sanitizarMembrosReais(grupo?.membros_reais || grupo?.membros, quadrosConfiguraveisSet);
  return {
    id_local: texto(grupo?.id_local) || slugLocal(nomeGrupo || membrosReais[0], posicao),
    nome_grupo: nomeGrupo || membrosReais[0] || '',
    indice: Number.isFinite(Number(grupo?.indice)) ? Number(grupo.indice) : posicao,
    membros_reais: membrosReais,
    observacao: texto(grupo?.observacao) || OBSERVACAO_PADRAO,
    ativo: grupo?.ativo !== false,
    pendente_confirmacao_institucional: grupo?.pendente_confirmacao_institucional !== false,
    motivo_alteracao: texto(grupo?.motivo_alteracao || grupo?.motivo) || '',
    atualizado_em: texto(grupo?.atualizado_em) || new Date().toISOString(),
  };
}

function criarSugestaoInicial(quadrosDisponiveis) {
  return quadrosDisponiveis
    .filter((quadro) => !quadro.vazio && texto(quadro.valor))
    .map((quadro, indice) => ({
      id_local: slugLocal(quadro.valor, indice),
      nome_grupo: quadro.valor,
      indice,
      membros_reais: [quadro.valor],
      observacao: OBSERVACAO_PADRAO,
      ativo: true,
      pendente_confirmacao_institucional: true,
      motivo_alteracao: MOTIVO_INICIAL,
      atualizado_em: new Date().toISOString(),
    }));
}

function obterConfiguracaoAtiva(configuracoes) {
  return (configuracoes || []).find((config) => config?.ativo === true && Array.isArray(config?.ordem_quadros));
}

function montarRascunhoInicial(configuracoes, quadrosDisponiveis) {
  const quadrosConfiguraveisSet = new Set(quadrosDisponiveis.filter((quadro) => !quadro.vazio).map((quadro) => quadro.valor));
  const configuracaoAtiva = obterConfiguracaoAtiva(configuracoes);

  if (configuracaoAtiva) {
    const grupos = configuracaoAtiva.ordem_quadros
      .map((grupo, posicao) => normalizarGrupoConfigurado(grupo, posicao, quadrosConfiguraveisSet))
      .filter((grupo) => grupo.ativo !== false || grupo.membros_reais.length > 0)
      .sort((a, b) => a.indice - b.indice || a.nome_grupo.localeCompare(b.nome_grupo, 'pt-BR'));

    return {
      configuracaoAtiva,
      grupos: grupos.length ? grupos : criarSugestaoInicial(quadrosDisponiveis),
      motivoAlteracao: texto(grupos.find((grupo) => texto(grupo.motivo_alteracao))?.motivo_alteracao) || '',
      origem: grupos.length ? 'configuracao_ativa' : 'sugestao',
    };
  }

  return {
    configuracaoAtiva: null,
    grupos: criarSugestaoInicial(quadrosDisponiveis),
    motivoAlteracao: MOTIVO_INICIAL,
    origem: 'sugestao',
  };
}

function calcularValidacoes(grupos, quadrosDisponiveis, motivoAlteracao) {
  const alertas = [];
  const indices = new Map();
  const membros = new Map();
  const quadrosClassificaveis = quadrosDisponiveis.filter((quadro) => !quadro.vazio && texto(quadro.valor)).map((quadro) => quadro.valor);
  const quadrosClassificados = new Set();

  grupos.forEach((grupo, posicao) => {
    if (grupo.ativo === false) return;
    const identificador = texto(grupo.nome_grupo) || `Grupo sem nome #${posicao + 1}`;
    const membrosGrupo = Array.isArray(grupo.membros_reais) ? grupo.membros_reais.filter((membro) => texto(membro)) : [];

    if (!texto(grupo.nome_grupo)) alertas.push(`Grupo na posição ${posicao + 1} está sem nome.`);
    if (membrosGrupo.length === 0) alertas.push(`${identificador} está ativo e sem quadros cobertos.`);

    const indiceKey = String(grupo.indice ?? '');
    if (!indiceKey || Number.isNaN(Number(indiceKey))) {
      alertas.push(`${identificador} está sem índice válido.`);
    } else {
      const gruposMesmoIndice = indices.get(indiceKey) || [];
      gruposMesmoIndice.push(identificador);
      indices.set(indiceKey, gruposMesmoIndice);
    }

    membrosGrupo.forEach((membro) => {
      const ocorrencias = membros.get(membro) || [];
      ocorrencias.push(identificador);
      membros.set(membro, ocorrencias);
      quadrosClassificados.add(membro);
    });
  });

  indices.forEach((gruposMesmoIndice, indice) => {
    if (gruposMesmoIndice.length > 1) alertas.push(`Índice duplicado ${indice} nos grupos: ${gruposMesmoIndice.join(', ')}.`);
  });

  membros.forEach((ocorrencias, membro) => {
    const gruposUnicos = Array.from(new Set(ocorrencias));
    if (gruposUnicos.length > 1) alertas.push(`Quadro coberto repetido (${membro}) nos grupos: ${gruposUnicos.join(', ')}.`);
  });

  const naoClassificados = quadrosClassificaveis.filter((quadro) => !quadrosClassificados.has(quadro));
  if (naoClassificados.length > 0) {
    alertas.push(`Há quadros oficiais ou legados reais não classificados: ${naoClassificados.join(', ')}.`);
  }

  if (!texto(motivoAlteracao)) alertas.push('Motivo da alteração é obrigatório.');

  return { alertas, naoClassificados, classificados: quadrosClassificados };
}

function ordenarGruposPorIndice(grupos) {
  return [...grupos].sort((a, b) => Number(a.indice) - Number(b.indice) || a.nome_grupo.localeCompare(b.nome_grupo, 'pt-BR'));
}

export default function AntiguidadeConfigQuadros() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [grupos, setGrupos] = useState([]);
  const [motivoAlteracao, setMotivoAlteracao] = useState('');
  const [estadoInicial, setEstadoInicial] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [termoPesquisaQuadros, setTermoPesquisaQuadros] = useState('');

  const {
    data: militaresAtivos = [],
    isLoading: militaresLoading,
    error: militaresErro,
  } = useQuery({
    queryKey: ['antiguidade-config-quadros-militares-ativos'],
    queryFn: async () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
  });

  const {
    data: configuracoesAtivas = [],
    isLoading: configuracoesLoading,
    error: configuracoesErro,
  } = useQuery({
    queryKey: ['antiguidade-config-quadros-configuracao-ativa'],
    queryFn: async () => base44.entities.ConfiguracaoAntiguidade.filter({ ativo: true }),
  });

  const quadrosReais = useMemo(() => calcularQuadrosReais(militaresAtivos), [militaresAtivos]);
  const quadrosDisponiveis = useMemo(() => montarQuadrosDisponiveisParaConfiguracao(quadrosReais), [quadrosReais]);
  const quadrosConfiguraveisSet = useMemo(() => new Set(quadrosDisponiveis.filter((quadro) => !quadro.vazio).map((quadro) => quadro.valor)), [quadrosDisponiveis]);

  useEffect(() => {
    if (militaresLoading || configuracoesLoading) return;
    const inicial = montarRascunhoInicial(configuracoesAtivas, quadrosDisponiveis);
    setGrupos(inicial.grupos);
    setMotivoAlteracao(inicial.motivoAlteracao);
    setEstadoInicial(inicial);
    setSelectedGroupId((idAtual) => (inicial.grupos.some((grupo) => grupo.id_local === idAtual) ? idAtual : inicial.grupos[0]?.id_local || null));
  }, [configuracoesAtivas, configuracoesLoading, militaresLoading, quadrosDisponiveis]);

  const validacoes = useMemo(() => calcularValidacoes(grupos, quadrosDisponiveis, motivoAlteracao), [grupos, motivoAlteracao, quadrosDisponiveis]);
  const gruposAtivos = useMemo(() => grupos.filter((grupo) => grupo.ativo !== false), [grupos]);
  const gruposOrdenados = useMemo(() => ordenarGruposPorIndice(gruposAtivos), [gruposAtivos]);
  const podeSalvar = validacoes.alertas.length === 0 && !militaresErro && !configuracoesErro;

  const grupoPorQuadro = useMemo(() => {
    const mapa = new Map();
    gruposAtivos.forEach((grupo) => {
      (grupo.membros_reais || []).forEach((membro) => {
        if (texto(membro)) mapa.set(membro, grupo);
      });
    });
    return mapa;
  }, [gruposAtivos]);

  const quadrosVisiveis = useMemo(() => {
    const termo = texto(termoPesquisaQuadros).toLowerCase();
    return quadrosDisponiveis
      .filter((quadro) => !quadro.vazio && texto(quadro.valor))
      .filter((quadro) => {
        if (!termo) return true;
        const grupo = grupoPorQuadro.get(quadro.valor);
        return quadro.valor.toLowerCase().includes(termo) || texto(grupo?.nome_grupo).toLowerCase().includes(termo);
      });
  }, [grupoPorQuadro, quadrosDisponiveis, termoPesquisaQuadros]);

  const quadrosNaoClassificados = useMemo(
    () => quadrosVisiveis.filter((quadro) => !validacoes.classificados.has(quadro.valor)),
    [quadrosVisiveis, validacoes.classificados],
  );

  const quadrosClassificados = useMemo(
    () => quadrosVisiveis
      .filter((quadro) => validacoes.classificados.has(quadro.valor))
      .map((quadro) => ({ ...quadro, grupo: grupoPorQuadro.get(quadro.valor) })),
    [grupoPorQuadro, quadrosVisiveis, validacoes.classificados],
  );

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const agora = new Date().toISOString();
      const ordemQuadros = ordenarGruposPorIndice(gruposAtivos).map((grupo, posicao) => ({
        id_local: texto(grupo.id_local) || slugLocal(grupo.nome_grupo, posicao),
        nome_grupo: texto(grupo.nome_grupo),
        indice: Number(grupo.indice),
        // Neste editor, membros_reais significa valores de quadro cobertos pela configuração,
        // incluindo opções oficiais do sistema e valores legados reais encontrados na base.
        membros_reais: sanitizarMembrosReais(grupo.membros_reais, quadrosConfiguraveisSet),
        observacao: texto(grupo.observacao),
        ativo: true,
        pendente_confirmacao_institucional: grupo.pendente_confirmacao_institucional !== false,
        motivo_alteracao: texto(motivoAlteracao),
        atualizado_em: agora,
      }));

      const payloadAtualizacao = {
        ordem_quadros: ordemQuadros,
      };

      const idConfiguracao = estadoInicial?.configuracaoAtiva?.id;
      if (idConfiguracao) return base44.entities.ConfiguracaoAntiguidade.update(idConfiguracao, payloadAtualizacao);

      return base44.entities.ConfiguracaoAntiguidade.create({
        nome_configuracao: 'Rascunho de configuração de quadros disponíveis para antiguidade',
        ativo: true,
        versao_regra: VERSAO_REGRA_RASCUNHO,
        ordem_quadros: ordemQuadros,
        observacoes: TEXTO_PENDENCIA,
      });
    },
    onSuccess: async () => {
      toast({ title: 'Rascunho salvo', description: 'A configuração pendente foi gravada em ConfiguracaoAntiguidade.ordem_quadros.' });
      await queryClient.invalidateQueries({ queryKey: ['antiguidade-config-quadros-configuracao-ativa'] });
    },
    onError: (error) => {
      toast({ title: 'Falha ao salvar rascunho', description: error?.message || 'Não foi possível gravar a configuração.', variant: 'destructive' });
    },
  });

  function atualizarGrupo(idLocal, patch) {
    setGrupos((atuais) => atuais.map((grupo) => (grupo.id_local === idLocal ? { ...grupo, ...patch } : grupo)));
  }

  function adicionarGrupo() {
    const indice = grupos.length ? Math.max(...grupos.map((grupo) => Number(grupo.indice) || 0)) + 1 : 0;
    const novoId = `novo-grupo-${Date.now()}`;
    setGrupos((atuais) => [...atuais, {
      id_local: novoId,
      nome_grupo: '',
      indice,
      membros_reais: [],
      observacao: OBSERVACAO_PADRAO,
      ativo: true,
      pendente_confirmacao_institucional: true,
      motivo_alteracao: texto(motivoAlteracao),
      atualizado_em: new Date().toISOString(),
    }]);
    setSelectedGroupId(novoId);
  }

  function removerGrupo(idLocal) {
    setGrupos((atuais) => atuais.filter((grupo) => grupo.id_local !== idLocal));
    setSelectedGroupId((idAtual) => (idAtual === idLocal ? null : idAtual));
  }

  function adicionarMembro(idLocal, membro) {
    if (!texto(membro) || !quadrosConfiguraveisSet.has(membro)) return;
    setSelectedGroupId(idLocal);
    setGrupos((atuais) => atuais.map((grupo) => {
      if (grupo.id_local !== idLocal) return grupo;
      const membros = Array.isArray(grupo.membros_reais) ? grupo.membros_reais : [];
      if (membros.includes(membro)) return grupo;
      return { ...grupo, membros_reais: [...membros, membro] };
    }));
  }

  function removerMembro(idLocal, membro) {
    setGrupos((atuais) => atuais.map((grupo) => (grupo.id_local === idLocal
      ? { ...grupo, membros_reais: (grupo.membros_reais || []).filter((item) => item !== membro) }
      : grupo)));
  }

  function moverGrupo(idLocal, direcao) {
    const ordenados = ordenarGruposPorIndice(grupos);
    const indiceAtual = ordenados.findIndex((grupo) => grupo.id_local === idLocal);
    const indiceDestino = indiceAtual + direcao;
    if (indiceAtual < 0 || indiceDestino < 0 || indiceDestino >= ordenados.length) return;
    const grupoAtual = ordenados[indiceAtual];
    const grupoDestino = ordenados[indiceDestino];
    setGrupos((atuais) => atuais.map((grupo) => {
      if (grupo.id_local === grupoAtual.id_local) return { ...grupo, indice: Number(grupoDestino.indice) };
      if (grupo.id_local === grupoDestino.id_local) return { ...grupo, indice: Number(grupoAtual.indice) };
      return grupo;
    }));
  }

  function salvarRascunho() {
    if (!podeSalvar) {
      toast({ title: 'Rascunho inválido', description: 'Corrija as validações antes de salvar.', variant: 'destructive' });
      return;
    }
    salvarMutation.mutate();
  }

  const carregando = militaresLoading || configuracoesLoading;

  return (
    <div className="space-y-6 p-[clamp(1rem,1.4vw,1.5rem)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Antiguidade • editor de rascunho</p>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Configuração de Quadros para Antiguidade</h1>
        </div>

        <Button type="button" onClick={salvarRascunho} disabled={!podeSalvar || salvarMutation.isPending} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
          {salvarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar organização
        </Button>
      </div>

      {(militaresErro || configuracoesErro) && (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertCircle className="h-4 w-4 text-red-700" />
          <AlertTitle>Falha ao carregar dados</AlertTitle>
          <AlertDescription>{militaresErro?.message || configuracoesErro?.message || 'Não foi possível carregar militares ou configurações ativas.'}</AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100vh-220px)]">
        <div className="flex w-1/3 min-w-[320px] flex-col border-r border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-bold text-slate-800">Banco de Quadros</h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={termoPesquisaQuadros}
                onChange={(event) => setTermoPesquisaQuadros(event.target.value)}
                placeholder="Procurar quadro..."
                className="w-full border-slate-300 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {carregando ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando quadros disponíveis...
              </div>
            ) : (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase text-amber-600">Não Classificados</h3>
                    <span className="text-[11px] font-semibold text-amber-700">{quadrosNaoClassificados.length}</span>
                  </div>
                  <div className="space-y-2">
                    {quadrosNaoClassificados.length === 0 ? (
                      <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        Todos os quadros visíveis estão classificados.
                      </div>
                    ) : quadrosNaoClassificados.map((quadro) => {
                      const grupoSelecionadoExiste = gruposOrdenados.some((grupo) => grupo.id_local === selectedGroupId);
                      return (
                        <div key={quadro.valor} className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-white p-2.5 shadow-sm">
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-slate-700">{quadro.valor}</span>
                            <span className="text-[11px] text-slate-500">{quadro.quantidade} militar(es)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!grupoSelecionadoExiste) {
                                toast({ title: 'Selecione um grupo', description: 'Abra ou crie um grupo de antiguidade antes de atribuir o quadro.', variant: 'destructive' });
                                return;
                              }
                              adicionarMembro(selectedGroupId, quadro.valor);
                            }}
                            className="shrink-0 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800 transition-colors hover:bg-amber-200"
                          >
                            Atribuir →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 mt-6 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase text-slate-400">Já Classificados</h3>
                    <span className="text-[11px] font-semibold text-slate-500">{quadrosClassificados.length}</span>
                  </div>
                  <div className="space-y-2 opacity-70">
                    {quadrosClassificados.length === 0 ? (
                      <p className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-500">Nenhum quadro classificado corresponde à pesquisa.</p>
                    ) : quadrosClassificados.map((quadro) => (
                      <div key={quadro.valor} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white p-2">
                        <span className="min-w-0 truncate text-sm font-medium text-slate-600">{quadro.valor}</span>
                        <span className="shrink-0 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500" title={quadro.grupo?.nome_grupo || 'Grupo não identificado'}>
                          {quadro.grupo?.nome_grupo || 'Grupo não identificado'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex w-2/3 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
            <div>
              <h2 className="font-bold text-slate-800">Grupos de Antiguidade</h2>
              <p className="text-xs text-slate-500">Selecione um cartão para editar e receber quadros do banco lateral.</p>
            </div>
            <button
              type="button"
              onClick={adicionarGrupo}
              className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
            >
              + Novo Grupo
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
            {gruposOrdenados.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
                Nenhum grupo criado. Use “Novo Grupo” para iniciar a configuração.
              </div>
            ) : (
              <div className="space-y-3">
                {gruposOrdenados.map((grupo, posicao) => {
                  const selecionado = selectedGroupId === grupo.id_local;
                  const membros = Array.isArray(grupo.membros_reais) ? grupo.membros_reais : [];
                  const podeRemoverGrupo = membros.length === 0;

                  return (
                    <div
                      key={grupo.id_local}
                      onClick={() => setSelectedGroupId(selecionado ? null : grupo.id_local)}
                      className={`cursor-pointer rounded-lg border transition-all ${
                        selecionado
                          ? 'border-blue-400 bg-white shadow-md ring-1 ring-blue-400'
                          : 'border-slate-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 p-4">
                        <div className="flex min-w-0 items-center">
                          <div className={`mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${selecionado ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {posicao + 1}
                          </div>
                          <div className="min-w-0">
                            <h3 className={`truncate font-bold ${selecionado ? 'text-blue-900' : 'text-slate-700'}`}>
                              {texto(grupo.nome_grupo) || 'Grupo sem nome'}
                            </h3>
                            <div className="mt-0.5 text-xs text-slate-500">Índice atual: {grupo.indice}</div>
                          </div>
                        </div>

                        <div className="flex max-w-[55%] flex-wrap justify-end gap-1">
                          {membros.slice(0, 6).map((membro) => (
                            <span key={`${grupo.id_local}-preview-${membro}`} className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                              {membro}
                            </span>
                          ))}
                          {membros.length > 6 && <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">+{membros.length - 6}</span>}
                        </div>
                      </div>

                      {selecionado && (
                        <div className="rounded-b-lg border-t border-slate-100 bg-blue-50/30 p-4" onClick={(event) => event.stopPropagation()}>
                          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_120px_1.5fr]">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-500">Nome do Grupo</label>
                              <Input value={grupo.nome_grupo} onChange={(event) => atualizarGrupo(grupo.id_local, { nome_grupo: event.target.value })} placeholder="Ex.: QOBM" className="w-full border-slate-300 p-2 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-500">Índice</label>
                              <Input type="number" value={grupo.indice} onChange={(event) => atualizarGrupo(grupo.id_local, { indice: event.target.value })} className="w-full border-slate-300 p-2 text-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-500">Observação Institucional</label>
                              <Input value={grupo.observacao} onChange={(event) => atualizarGrupo(grupo.id_local, { observacao: event.target.value })} placeholder={OBSERVACAO_PADRAO} className="w-full border-slate-300 p-2 text-sm" />
                            </div>
                          </div>

                          <div className="mb-4 flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={grupo.pendente_confirmacao_institucional !== false}
                                onChange={(event) => atualizarGrupo(grupo.id_local, { pendente_confirmacao_institucional: event.target.checked })}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              Pendente de confirmação institucional
                            </label>
                            <Button type="button" variant="outline" size="sm" onClick={() => moverGrupo(grupo.id_local, -1)} disabled={posicao === 0}>
                              <ArrowUp className="h-4 w-4" />
                              Subir
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => moverGrupo(grupo.id_local, 1)} disabled={posicao === gruposOrdenados.length - 1}>
                              <ArrowDown className="h-4 w-4" />
                              Descer
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => removerGrupo(grupo.id_local)} disabled={!podeRemoverGrupo} className="text-red-700 hover:text-red-800">
                              <Trash2 className="h-4 w-4" />
                              Remover grupo vazio
                            </Button>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-medium text-slate-500">Quadros vinculados (remova clicando na lixeira)</label>
                            <div className="flex min-h-[60px] flex-wrap gap-2 rounded border border-slate-200 bg-white p-3">
                              {membros.map((membro) => (
                                <div key={`${grupo.id_local}-${membro}`} className="flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                                  {membro}
                                  <button
                                    type="button"
                                    onClick={() => removerMembro(grupo.id_local, membro)}
                                    aria-label={`Remover ${membro}`}
                                    className="ml-2 rounded-full bg-blue-200 p-0.5 text-blue-500 hover:text-red-500"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              <div className="flex items-center px-2 text-sm text-slate-400">
                                ← Use a lista lateral para adicionar mais
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
