import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const VERSAO_REGRA_RASCUNHO = 'antiguidade.quadros.rascunho.v1';
const OBSERVACAO_PADRAO = 'Confirmar precedência institucional.';
const MOTIVO_INICIAL = 'Configuração inicial a partir dos quadros reais cadastrados.';
const TEXTO_PENDENCIA = 'Configuração pendente de confirmação institucional. Esta configuração ainda não gera listagem oficial e não cria snapshot.';

const badgesInstitucionais = [
  'Rascunho controlado',
  'Pendente de confirmação institucional',
  'Somente quadros reais de Militar.quadro',
  'Sem snapshot',
];

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

function sanitizarMembrosReais(membros, quadrosReaisSet) {
  if (!Array.isArray(membros)) return [];
  const vistos = new Set();
  return membros
    .map((membro) => String(membro ?? ''))
    .filter((membro) => texto(membro) && quadrosReaisSet.has(membro) && !vistos.has(membro) && vistos.add(membro));
}

function normalizarGrupoConfigurado(grupo, posicao, quadrosReaisSet) {
  const nomeGrupo = texto(grupo?.nome_grupo || grupo?.grupo || grupo?.nome);
  const membrosReais = sanitizarMembrosReais(grupo?.membros_reais || grupo?.membros, quadrosReaisSet);
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

function criarSugestaoInicial(quadrosReais) {
  return quadrosReais
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

function montarRascunhoInicial(configuracoes, quadrosReais) {
  const quadrosReaisSet = new Set(quadrosReais.filter((quadro) => !quadro.vazio).map((quadro) => quadro.valor));
  const configuracaoAtiva = obterConfiguracaoAtiva(configuracoes);

  if (configuracaoAtiva) {
    const grupos = configuracaoAtiva.ordem_quadros
      .map((grupo, posicao) => normalizarGrupoConfigurado(grupo, posicao, quadrosReaisSet))
      .filter((grupo) => grupo.ativo !== false || grupo.membros_reais.length > 0)
      .sort((a, b) => a.indice - b.indice || a.nome_grupo.localeCompare(b.nome_grupo, 'pt-BR'));

    return {
      configuracaoAtiva,
      grupos: grupos.length ? grupos : criarSugestaoInicial(quadrosReais),
      motivoAlteracao: texto(grupos.find((grupo) => texto(grupo.motivo_alteracao))?.motivo_alteracao) || '',
      origem: grupos.length ? 'configuracao_ativa' : 'sugestao',
    };
  }

  return {
    configuracaoAtiva: null,
    grupos: criarSugestaoInicial(quadrosReais),
    motivoAlteracao: MOTIVO_INICIAL,
    origem: 'sugestao',
  };
}

function calcularValidacoes(grupos, quadrosReais, motivoAlteracao) {
  const alertas = [];
  const indices = new Map();
  const membros = new Map();
  const quadrosClassificaveis = quadrosReais.filter((quadro) => !quadro.vazio && texto(quadro.valor)).map((quadro) => quadro.valor);
  const quadrosClassificados = new Set();

  grupos.forEach((grupo, posicao) => {
    if (grupo.ativo === false) return;
    const identificador = texto(grupo.nome_grupo) || `Grupo sem nome #${posicao + 1}`;
    const membrosGrupo = Array.isArray(grupo.membros_reais) ? grupo.membros_reais.filter((membro) => texto(membro)) : [];

    if (!texto(grupo.nome_grupo)) alertas.push(`Grupo na posição ${posicao + 1} está sem nome.`);
    if (membrosGrupo.length === 0) alertas.push(`${identificador} está ativo e sem membros reais.`);

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
    if (gruposUnicos.length > 1) alertas.push(`Membro real repetido (${membro}) nos grupos: ${gruposUnicos.join(', ')}.`);
  });

  const naoClassificados = quadrosClassificaveis.filter((quadro) => !quadrosClassificados.has(quadro));
  if (naoClassificados.length > 0) {
    alertas.push(`Há quadros reais não classificados: ${naoClassificados.join(', ')}.`);
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

  const {
    data: militaresAtivos = [],
    isLoading: militaresLoading,
    isFetching: militaresFetching,
    error: militaresErro,
    refetch: refetchMilitares,
  } = useQuery({
    queryKey: ['antiguidade-config-quadros-militares-ativos'],
    queryFn: async () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
  });

  const {
    data: configuracoesAtivas = [],
    isLoading: configuracoesLoading,
    isFetching: configuracoesFetching,
    error: configuracoesErro,
    refetch: refetchConfiguracoes,
  } = useQuery({
    queryKey: ['antiguidade-config-quadros-configuracao-ativa'],
    queryFn: async () => base44.entities.ConfiguracaoAntiguidade.filter({ ativo: true }),
  });

  const quadrosReais = useMemo(() => calcularQuadrosReais(militaresAtivos), [militaresAtivos]);
  const quadrosReaisSet = useMemo(() => new Set(quadrosReais.filter((quadro) => !quadro.vazio).map((quadro) => quadro.valor)), [quadrosReais]);

  useEffect(() => {
    if (militaresLoading || configuracoesLoading) return;
    const inicial = montarRascunhoInicial(configuracoesAtivas, quadrosReais);
    setGrupos(inicial.grupos);
    setMotivoAlteracao(inicial.motivoAlteracao);
    setEstadoInicial(inicial);
  }, [configuracoesAtivas, configuracoesLoading, militaresLoading, quadrosReais]);

  const validacoes = useMemo(() => calcularValidacoes(grupos, quadrosReais, motivoAlteracao), [grupos, motivoAlteracao, quadrosReais]);
  const gruposAtivos = useMemo(() => grupos.filter((grupo) => grupo.ativo !== false), [grupos]);
  const gruposOrdenados = useMemo(() => ordenarGruposPorIndice(gruposAtivos), [gruposAtivos]);
  const podeSalvar = validacoes.alertas.length === 0 && !militaresErro && !configuracoesErro;

  const totais = useMemo(() => ({
    reais: quadrosReais.filter((quadro) => !quadro.vazio && texto(quadro.valor)).length,
    classificados: Array.from(validacoes.classificados).filter((quadro) => quadrosReaisSet.has(quadro)).length,
    naoClassificados: validacoes.naoClassificados.length,
    grupos: gruposAtivos.length,
  }), [gruposAtivos.length, quadrosReais, quadrosReaisSet, validacoes]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const agora = new Date().toISOString();
      const ordemQuadros = ordenarGruposPorIndice(gruposAtivos).map((grupo, posicao) => ({
        id_local: texto(grupo.id_local) || slugLocal(grupo.nome_grupo, posicao),
        nome_grupo: texto(grupo.nome_grupo),
        indice: Number(grupo.indice),
        membros_reais: sanitizarMembrosReais(grupo.membros_reais, quadrosReaisSet),
        observacao: texto(grupo.observacao),
        ativo: true,
        pendente_confirmacao_institucional: grupo.pendente_confirmacao_institucional !== false,
        motivo_alteracao: texto(motivoAlteracao),
        atualizado_em: agora,
      }));

      const payload = {
        nome_configuracao: 'Rascunho de configuração de quadros reais para antiguidade',
        ativo: true,
        versao_regra: VERSAO_REGRA_RASCUNHO,
        ordem_quadros: ordemQuadros,
        observacoes: TEXTO_PENDENCIA,
      };

      let usuario = null;
      try {
        usuario = await base44.auth.me();
      } catch {
        usuario = null;
      }

      if (usuario?.email) payload.updated_by = usuario.email;

      const idConfiguracao = estadoInicial?.configuracaoAtiva?.id;
      if (idConfiguracao) return base44.entities.ConfiguracaoAntiguidade.update(idConfiguracao, payload);
      return base44.entities.ConfiguracaoAntiguidade.create(payload);
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
    setGrupos((atuais) => [...atuais, {
      id_local: `novo-grupo-${Date.now()}`,
      nome_grupo: '',
      indice,
      membros_reais: [],
      observacao: OBSERVACAO_PADRAO,
      ativo: true,
      pendente_confirmacao_institucional: true,
      motivo_alteracao: texto(motivoAlteracao),
      atualizado_em: new Date().toISOString(),
    }]);
  }

  function removerGrupo(idLocal) {
    setGrupos((atuais) => atuais.filter((grupo) => grupo.id_local !== idLocal));
  }

  function adicionarMembro(idLocal, membro) {
    if (!texto(membro) || !quadrosReaisSet.has(membro)) return;
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

  function recarregarDados() {
    refetchMilitares();
    refetchConfiguracoes();
  }

  function limparAlteracoesLocais() {
    if (!estadoInicial) return;
    setGrupos(estadoInicial.grupos);
    setMotivoAlteracao(estadoInicial.motivoAlteracao);
  }

  function salvarRascunho() {
    if (!podeSalvar) {
      toast({ title: 'Rascunho inválido', description: 'Corrija as validações antes de salvar.', variant: 'destructive' });
      return;
    }
    salvarMutation.mutate();
  }

  const carregando = militaresLoading || configuracoesLoading;
  const atualizando = militaresFetching || configuracoesFetching;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Antiguidade • editor de rascunho</p>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Configuração de Quadros para Antiguidade</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {badgesInstitucionais.map((badge) => (
              <Badge key={badge} variant="outline" className="border-slate-300 bg-white text-slate-700">{badge}</Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={recarregarDados} disabled={atualizando}>
            {atualizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recarregar dados
          </Button>
          <Button type="button" variant="outline" onClick={limparAlteracoesLocais} disabled={!estadoInicial || salvarMutation.isPending}>
            Limpar alterações locais
          </Button>
          <Button asChild variant="outline">
            <Link to={createPageUrl('AntiguidadePrevia')}>
              Abrir Prévia Geral
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <AlertCircle className="h-4 w-4 text-amber-700" />
        <AlertTitle>Esta configuração ainda não gera listagem oficial e não cria snapshot.</AlertTitle>
        <AlertDescription>
          O rascunho usa exclusivamente valores literais encontrados em Militar.quadro de militares ativos e fica pendente de confirmação institucional.
        </AlertDescription>
      </Alert>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <Info className="h-5 w-5 text-slate-600" />
            Validações visuais do rascunho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              ['Quadros reais', totais.reais],
              ['Classificados', totais.classificados],
              ['Não classificados', totais.naoClassificados],
              ['Grupos', totais.grupos],
              ['Apto para salvar', podeSalvar ? 'Sim' : 'Não'],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{valor}</p>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="motivo-alteracao" className="text-sm font-semibold text-slate-800">Motivo da alteração</label>
            <Textarea
              id="motivo-alteracao"
              value={motivoAlteracao}
              onChange={(event) => setMotivoAlteracao(event.target.value)}
              placeholder="Informe o motivo da alteração do rascunho."
              className="mt-2 min-h-20"
            />
          </div>

          {validacoes.alertas.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Rascunho apto para salvar como configuração pendente.
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="mb-2 font-semibold">Pendências que bloqueiam salvamento:</p>
              <ul className="list-disc space-y-1 pl-5">
                {validacoes.alertas.map((validacao) => <li key={validacao}>{validacao}</li>)}
              </ul>
            </div>
          )}

          <Button type="button" onClick={salvarRascunho} disabled={!podeSalvar || salvarMutation.isPending} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            {salvarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar rascunho da configuração
          </Button>
        </CardContent>
      </Card>

      {(militaresErro || configuracoesErro) && (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertCircle className="h-4 w-4 text-red-700" />
          <AlertTitle>Falha ao carregar dados</AlertTitle>
          <AlertDescription>{militaresErro?.message || configuracoesErro?.message || 'Não foi possível carregar militares ou configurações ativas.'}</AlertDescription>
        </Alert>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Quadros reais encontrados</CardTitle>
          <p className="text-sm text-slate-600">Fonte: base44.entities.Militar.filter({"{ status_cadastro: 'Ativo' }"}) e valores distintos de militar.quadro.</p>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando quadros reais...
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Valor do quadro</TableHead>
                    <TableHead className="text-right">Quantidade de militares</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quadrosReais.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="py-6 text-center text-slate-500">Nenhum quadro encontrado.</TableCell></TableRow>
                  ) : quadrosReais.map((quadro) => {
                    const classificado = !quadro.vazio && validacoes.classificados.has(quadro.valor);
                    return (
                      <TableRow key={quadro.valor || '__vazio__'}>
                        <TableCell className="font-semibold text-slate-900">{quadro.vazio ? <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">Quadro vazio</Badge> : quadro.valor}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-slate-800">{quadro.quantidade}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={classificado ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800'}>
                            {quadro.vazio ? 'não classificado' : classificado ? 'classificado' : 'não classificado'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Grupos de antiguidade</CardTitle>
              <p className="text-sm text-slate-600">Edite nomes, índices, observações e vincule somente membros reais ainda não classificados.</p>
            </div>
            <Button type="button" variant="outline" onClick={adicionarGrupo}>
              <Plus className="h-4 w-4" />
              Criar novo grupo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {gruposOrdenados.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">Nenhum grupo criado.</div>
          ) : gruposOrdenados.map((grupo, posicao) => {
            const membros = Array.isArray(grupo.membros_reais) ? grupo.membros_reais : [];
            const podeRemoverGrupo = membros.length === 0;
            const opcoesAdicionar = validacoes.naoClassificados;

            return (
              <div key={grupo.id_local} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_120px_1.5fr]">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nome do grupo</label>
                    <Input value={grupo.nome_grupo} onChange={(event) => atualizarGrupo(grupo.id_local, { nome_grupo: event.target.value })} placeholder="Ex.: QOBM" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Índice</label>
                    <Input type="number" value={grupo.indice} onChange={(event) => atualizarGrupo(grupo.id_local, { indice: event.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observação</label>
                    <Input value={grupo.observacao} onChange={(event) => atualizarGrupo(grupo.id_local, { observacao: event.target.value })} placeholder={OBSERVACAO_PADRAO} className="mt-1" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
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

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Membros reais vinculados</p>
                    {membros.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">Sem membros reais vinculados.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {membros.map((membro) => (
                          <Badge key={`${grupo.id_local}-${membro}`} variant="secondary" className="gap-1 bg-slate-100 text-slate-800 hover:bg-slate-100">
                            {membro}
                            <button type="button" onClick={() => removerMembro(grupo.id_local, membro)} aria-label={`Remover ${membro}`} className="rounded-full hover:bg-slate-200">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"
                      defaultValue=""
                      onChange={(event) => {
                        adicionarMembro(grupo.id_local, event.target.value);
                        event.target.value = '';
                      }}
                    >
                      <option value="">Adicionar membro real ainda não classificado</option>
                      {opcoesAdicionar.map((quadro) => <option key={`${grupo.id_local}-${quadro}`} value={quadro}>{quadro}</option>)}
                    </select>
                    {opcoesAdicionar.length === 0 && <span className="text-sm text-slate-500">Não há membros reais livres para adicionar.</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Não classificados</CardTitle>
          <p className="text-sm text-slate-600">Todo valor real não vazio de Militar.quadro que ainda não esteja em nenhum grupo ativo.</p>
        </CardHeader>
        <CardContent>
          {validacoes.naoClassificados.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Todos os quadros reais não vazios estão classificados.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {validacoes.naoClassificados.map((quadro) => <Badge key={quadro} variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">{quadro}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
