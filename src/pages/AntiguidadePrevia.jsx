import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL,
  calcularPreviaAntiguidadeGeral,
} from '@/utils/antiguidade/calcularPreviaAntiguidadeGeral';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const TODOS = '__todos__';

const filtroInicial = {
  busca: '',
  postoGraduacao: TODOS,
  quadro: TODOS,
  somenteAptos: false,
  somenteComPendencias: false,
  somenteComAlertas: false,
};

const pendenciasCriticas = new Set([
  PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_POSTO,
  PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_QUADRO,
  PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_PROMOCAO_ATUAL_ATIVA,
  PENDENCIAS_PREVIA_ANTIGUIDADE_GERAL.SEM_DATA_PROMOCAO,
]);

const resumoCards = [
  ['totalMilitaresEntrada', 'Militares na entrada'],
  ['totalMilitaresConsiderados', 'Militares considerados'],
  ['totalOrdenadosSemPendenciaCritica', 'Ordenados sem pendência crítica'],
  ['totalComPendencias', 'Com pendências'],
  ['totalComAlertas', 'Com alertas'],
];

function valorTexto(valor) {
  return String(valor ?? '').trim();
}

function normalizarBusca(valor) {
  return valorTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatarData(data) {
  if (!data) return '—';
  const [ano, mes, dia] = String(data).split('T')[0].split('-');
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

function opcoesUnicas(itens, campo) {
  return Array.from(new Set((itens || []).map((item) => valorTexto(item[campo])).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}


const CAMPOS_DATA_CONFIGURACAO = [
  'updated_date',
  'updatedAt',
  'updated_at',
  'data_atualizacao',
  'dataAtualizacao',
  'created_date',
  'createdAt',
  'created_at',
  'data_criacao',
  'dataCriacao',
];

function timestampConfiguracao(configuracao) {
  for (const campo of CAMPOS_DATA_CONFIGURACAO) {
    const valor = configuracao?.[campo];
    if (!valor) continue;
    const timestamp = Date.parse(valor);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

function dataConfiguracao(configuracao) {
  const campo = CAMPOS_DATA_CONFIGURACAO.find((nomeCampo) => {
    const valor = configuracao?.[nomeCampo];
    return valor && Number.isFinite(Date.parse(valor));
  });
  return campo ? configuracao[campo] : null;
}

function idConfiguracao(configuracao) {
  return valorTexto(configuracao?.id ?? configuracao?._id ?? configuracao?.uid ?? configuracao?.nome ?? configuracao?.name);
}

function compararConfiguracoes(a, b) {
  const timestampA = timestampConfiguracao(a);
  const timestampB = timestampConfiguracao(b);
  if (timestampA !== null || timestampB !== null) {
    if (timestampA !== timestampB) return (timestampB ?? Number.NEGATIVE_INFINITY) - (timestampA ?? Number.NEGATIVE_INFINITY);
  }

  return idConfiguracao(a).localeCompare(idConfiguracao(b), 'pt-BR', { numeric: true });
}

function selecionarConfiguracaoAntiguidade(configuracoes) {
  const validas = (configuracoes || []).filter((configuracao) => (
    configuracao?.ativo === true
    && Array.isArray(configuracao?.ordem_quadros)
    && configuracao.ordem_quadros.length > 0
  ));

  if (validas.length === 0) {
    return {
      configuracao: null,
      metadado: {
        origem: 'fallback',
        totalValidas: 0,
        criterio: 'fallback técnico padrão',
      },
    };
  }

  const ordenadas = [...validas].sort(compararConfiguracoes);
  const configuracao = ordenadas[0];
  const possuiDataConfiavel = validas.some((item) => timestampConfiguracao(item) !== null);

  return {
    configuracao,
    metadado: {
      origem: 'configuracao',
      totalValidas: validas.length,
      criterio: possuiDataConfiavel ? 'mais recente por data disponível' : 'determinístico por id/string',
      multiplasAtivas: validas.length > 1,
      nome: valorTexto(configuracao?.nome ?? configuracao?.name ?? configuracao?.titulo ?? configuracao?.title),
      data: dataConfiguracao(configuracao),
      grupos: configuracao.ordem_quadros.length,
    },
  };
}

function ContadorDetalhes({ tipo, itens }) {
  const quantidade = itens?.length || 0;
  const estilos = tipo === 'pendencias'
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-blue-200 bg-blue-50 text-blue-800';

  return (
    <Badge variant="outline" className={estilos}>
      {quantidade}
    </Badge>
  );
}

function LoadingState() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export default function AntiguidadePrevia() {
  const [filtros, setFiltros] = useState(filtroInicial);
  const [linhasExpandidas, setLinhasExpandidas] = useState({});

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['antiguidade-previa-geral'],
    queryFn: async () => {
      const [militares, historicos, configuracoesAntiguidade] = await Promise.all([
        base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
        base44.entities.HistoricoPromocaoMilitarV2.list(),
        base44.entities.ConfiguracaoAntiguidade.filter({ ativo: true }),
      ]);

      return {
        militares: militares || [],
        historicos: historicos || [],
        configuracoesAntiguidade: configuracoesAntiguidade || [],
      };
    },
  });

  const selecaoConfiguracao = useMemo(() => (
    selecionarConfiguracaoAntiguidade(data?.configuracoesAntiguidade)
  ), [data?.configuracoesAntiguidade]);

  const resultado = useMemo(() => {
    if (!data) return null;
    return calcularPreviaAntiguidadeGeral({
      militares: data.militares,
      historicoPromocoes: data.historicos,
      config: {
        ordem_quadros: selecaoConfiguracao.configuracao?.ordem_quadros,
      },
    });
  }, [data, selecaoConfiguracao]);

  const opcoesPosto = useMemo(() => opcoesUnicas(resultado?.itens, 'posto_graduacao'), [resultado]);
  const opcoesQuadro = useMemo(() => opcoesUnicas(resultado?.itens, 'quadro'), [resultado]);

  const itensFiltrados = useMemo(() => {
    const termo = normalizarBusca(filtros.busca);
    return (resultado?.itens || []).filter((item) => {
      if (termo) {
        const alvo = normalizarBusca([
          item.nome,
          item.matricula,
          item.militar_id,
        ].join(' '));
        if (!alvo.includes(termo)) return false;
      }

      if (filtros.postoGraduacao !== TODOS && item.posto_graduacao !== filtros.postoGraduacao) return false;
      if (filtros.quadro !== TODOS && item.quadro !== filtros.quadro) return false;
      if (filtros.somenteAptos && item.pendencias?.some((pendencia) => pendenciasCriticas.has(pendencia))) return false;
      if (filtros.somenteComPendencias && (item.pendencias?.length || 0) === 0) return false;
      if (filtros.somenteComAlertas && (item.alertas?.length || 0) === 0) return false;

      return true;
    });
  }, [resultado, filtros]);

  const atualizarFiltro = (campo, valor) => setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
  const limparFiltros = () => setFiltros(filtroInicial);
  const alternarLinha = (id) => setLinhasExpandidas((atuais) => ({ ...atuais, [id]: !atuais[id] }));

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha ao carregar a prévia</AlertTitle>
          <AlertDescription>
            Não foi possível ler Militar, HistoricoPromocaoMilitarV2 ou ConfiguracaoAntiguidade. Nenhuma escrita foi tentada. {error?.message || ''}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const semMilitares = (data?.militares?.length || 0) === 0;
  const semItens = !semMilitares && (resultado?.itens?.length || 0) === 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Prévia da Listagem de Antiguidade Geral</h1>
          <div className="flex flex-wrap gap-2">
            {[
              'Prévia não oficial',
              'Read-only',
              'Não gera publicação',
              'Não grava snapshot',
              'Sem persistência',
              'Fonte: HistoricoPromocaoMilitarV2',
            ].map((chip) => (
              <Badge key={chip} variant="secondary" className="bg-slate-100 text-slate-700">
                {chip}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar prévia
          </Button>
          <Button variant="ghost" onClick={limparFiltros}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      </div>

      <Alert className="border-amber-300 bg-amber-50 text-amber-950">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="font-bold tracking-wide">PRÉVIA NÃO OFICIAL</AlertTitle>
        <AlertDescription>
          Esta tela calcula a listagem em memória para conferência interna. Não gera publicação, não grava snapshot e não altera dados cadastrais. O resultado depende da qualidade dos dados em Militar e HistoricoPromocaoMilitarV2.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
            {selecaoConfiguracao.metadado.origem === 'configuracao'
              ? 'Regra de quadros: configuração ativa'
              : 'Regra de quadros: fallback técnico padrão'}
          </Badge>
          {selecaoConfiguracao.metadado.nome && <span>{selecaoConfiguracao.metadado.nome}</span>}
          {selecaoConfiguracao.metadado.data && <span>Data: {formatarData(selecaoConfiguracao.metadado.data)}</span>}
          <span>Grupos usados: {selecaoConfiguracao.metadado.grupos ?? 0}</span>
        </div>
      </div>

      {selecaoConfiguracao.metadado.multiplasAtivas && (
        <Alert className="border-slate-200 bg-slate-50 text-slate-700">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Múltiplas configurações ativas</AlertTitle>
          <AlertDescription>
            Foram encontradas {selecaoConfiguracao.metadado.totalValidas} configurações ativas válidas; a seleção usou o critério {selecaoConfiguracao.metadado.criterio}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {resumoCards.map(([campo, titulo]) => (
          <Card key={campo}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{titulo}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[#1e3a5f]">{resultado?.resumo?.[campo] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros da prévia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="busca-antiguidade-previa">Nome ou matrícula</Label>
              <Input
                id="busca-antiguidade-previa"
                value={filtros.busca}
                onChange={(event) => atualizarFiltro('busca', event.target.value)}
                placeholder="Buscar por nome, matrícula ou ID..."
              />
            </div>
            <div className="space-y-2">
              <Label>Posto/graduação</Label>
              <Select value={filtros.postoGraduacao} onValueChange={(value) => atualizarFiltro('postoGraduacao', value)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {opcoesPosto.map((posto) => <SelectItem key={posto} value={posto}>{posto}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quadro</Label>
              <Select value={filtros.quadro} onValueChange={(value) => atualizarFiltro('quadro', value)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {opcoesQuadro.map((quadro) => <SelectItem key={quadro} value={quadro}>{quadro}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={filtros.somenteAptos} onCheckedChange={(value) => atualizarFiltro('somenteAptos', Boolean(value))} />
              Somente aptos
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={filtros.somenteComPendencias} onCheckedChange={(value) => atualizarFiltro('somenteComPendencias', Boolean(value))} />
              Somente com pendências
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={filtros.somenteComAlertas} onCheckedChange={(value) => atualizarFiltro('somenteComAlertas', Boolean(value))} />
              Somente com alertas
            </label>
          </div>
        </CardContent>
      </Card>

      {(semMilitares || semItens) && (
        <Alert>
          <AlertTitle>Prévia sem itens</AlertTitle>
          <AlertDescription>
            {semMilitares
              ? 'Não há militares ativos retornados por Militar.filter({ status_cadastro: \'Ativo\' }).'
              : 'A prévia foi calculada, mas não retornou itens para exibição.'}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resultado em memória ({itensFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {itensFiltrados.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-600">
              Nenhum item encontrado para os filtros atuais.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-3">Posição</th>
                    <th className="px-2 py-3">Militar</th>
                    <th className="px-2 py-3">Matrícula</th>
                    <th className="px-2 py-3">Posto/graduação</th>
                    <th className="px-2 py-3">Quadro</th>
                    <th className="px-2 py-3">Data promoção atual</th>
                    <th className="px-2 py-3">Ordem na data</th>
                    <th className="px-2 py-3">Pendências</th>
                    <th className="px-2 py-3">Alertas</th>
                    <th className="px-2 py-3">registroPromocaoAtualId</th>
                    <th className="px-2 py-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map((item) => {
                    const chaveLinha = item.militar_id || `${item.posicao}-${item.matricula}`;
                    const expandida = Boolean(linhasExpandidas[chaveLinha]);
                    return (
                      <React.Fragment key={chaveLinha}>
                        <tr className="border-b align-top hover:bg-slate-50">
                          <td className="px-2 py-3 font-semibold">{item.posicao ?? '—'}</td>
                          <td className="px-2 py-3">{item.nome || '—'}</td>
                          <td className="px-2 py-3">{item.matricula || '—'}</td>
                          <td className="px-2 py-3">{item.posto_graduacao || '—'}</td>
                          <td className="px-2 py-3">{item.quadro || '—'}</td>
                          <td className="px-2 py-3">{formatarData(item.data_promocao)}</td>
                          <td className="px-2 py-3">{item.antiguidade_referencia_ordem ?? '—'}</td>
                          <td className="px-2 py-3"><ContadorDetalhes tipo="pendencias" itens={item.pendencias} /></td>
                          <td className="px-2 py-3"><ContadorDetalhes tipo="alertas" itens={item.alertas} /></td>
                          <td className="px-2 py-3 font-mono text-xs">{item.registroPromocaoAtualId || '—'}</td>
                          <td className="px-2 py-3">
                            <Button variant="ghost" size="sm" onClick={() => alternarLinha(chaveLinha)}>
                              {expandida ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <span className="sr-only">Ver detalhes</span>
                            </Button>
                          </td>
                        </tr>
                        {expandida && (
                          <tr className="border-b bg-slate-50">
                            <td colSpan={11} className="px-4 py-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div>
                                  <p className="mb-2 font-semibold text-slate-700">Pendências</p>
                                  {item.pendencias?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                      {item.pendencias.map((pendencia) => <Badge key={pendencia} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{pendencia}</Badge>)}
                                    </div>
                                  ) : <p className="text-slate-500">Sem pendências.</p>}
                                </div>
                                <div>
                                  <p className="mb-2 font-semibold text-slate-700">Alertas</p>
                                  {item.alertas?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                      {item.alertas.map((alerta) => <Badge key={alerta} variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">{alerta}</Badge>)}
                                    </div>
                                  ) : <p className="text-slate-500">Sem alertas.</p>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
