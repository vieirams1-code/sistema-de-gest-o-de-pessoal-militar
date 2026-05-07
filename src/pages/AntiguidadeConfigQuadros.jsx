import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, Info, Loader2, LockKeyhole, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  ORDEM_GRUPOS_QUADROS_ANTIGUIDADE,
  isQuadroConhecidoNaAntiguidade,
  normalizarQuadroParaAntiguidade,
  obterDetalheAntiguidadeQuadro,
} from '@/utils/antiguidade/ordemQuadrosAntiguidade';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS_PADRAO = 'Pendente de confirmação institucional';

const badgesInstitucionais = [
  'Read-only',
  'Prévia não oficial',
  'Pendente de confirmação institucional',
  'Fonte: regra técnica do código',
  'Sem persistência',
];

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizarMembro(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function obterStatus(grupo) {
  return texto(grupo?.status || grupo?.situacao || grupo?.confirmacaoInstitucional || grupo?.statusConfirmacao) || STATUS_PADRAO;
}

function formatarBooleano(valor) {
  return valor ? 'Sim' : 'Não';
}

function classeBadgeBooleano(valor, tipo = 'neutro') {
  if (!valor) return 'border-slate-200 bg-slate-50 text-slate-600';
  if (tipo === 'alerta') return 'border-red-300 bg-red-50 text-red-800';
  if (tipo === 'aviso') return 'border-amber-300 bg-amber-50 text-amber-800';
  if (tipo === 'positivo') return 'border-blue-300 bg-blue-50 text-blue-800';
  return 'border-emerald-300 bg-emerald-50 text-emerald-800';
}

function descreverQuadroVazio(valorOriginal) {
  if (valorOriginal === null || valorOriginal === undefined) return 'Quadro vazio (nulo)';
  return 'Quadro vazio';
}

function criarDetalheQuadroVazio(chave, valorOriginal, quantidade) {
  return {
    chave,
    quadroCadastrado: descreverQuadroVazio(valorOriginal),
    quantidade,
    quadroNormalizado: '—',
    grupoAntiguidadeQuadro: '—',
    quadroIndice: '—',
    conhecido: false,
    foiNormalizado: false,
    foiAgrupado: false,
    foraDosGrupos: false,
    quadroVazio: true,
  };
}

function calcularAuditoriaQuadros(militares) {
  const contagemPorQuadro = new Map();

  (militares || []).forEach((militar) => {
    const valorOriginal = militar?.quadro;
    const chave = valorOriginal === null || valorOriginal === undefined ? '__valor_nulo__' : String(valorOriginal);
    const atual = contagemPorQuadro.get(chave) || { valorOriginal, quantidade: 0 };
    atual.quantidade += 1;
    contagemPorQuadro.set(chave, atual);
  });

  const linhas = Array.from(contagemPorQuadro.values()).map(({ valorOriginal, quantidade }) => {
    if (!texto(valorOriginal)) {
      const chave = valorOriginal === null || valorOriginal === undefined ? '__valor_nulo__' : `__quadro_vazio__${String(valorOriginal)}`;
      return criarDetalheQuadroVazio(chave, valorOriginal, quantidade);
    }

    const detalhe = obterDetalheAntiguidadeQuadro(valorOriginal);
    const conhecido = detalhe.conhecido && isQuadroConhecidoNaAntiguidade(valorOriginal);
    const quadroNormalizado = detalhe.quadroNormalizado || normalizarQuadroParaAntiguidade(valorOriginal) || '—';

    return {
      chave: String(valorOriginal),
      quadroCadastrado: String(valorOriginal),
      quantidade,
      quadroNormalizado,
      grupoAntiguidadeQuadro: detalhe.grupoAntiguidadeQuadro || '—',
      quadroIndice: Number.isFinite(detalhe.quadroIndice) ? detalhe.quadroIndice : '—',
      conhecido,
      foiNormalizado: detalhe.foiNormalizado === true,
      foiAgrupado: detalhe.foiAgrupado === true,
      foraDosGrupos: conhecido === false,
      quadroVazio: false,
    };
  }).sort((a, b) => {
    if (a.foraDosGrupos !== b.foraDosGrupos) return a.foraDosGrupos ? -1 : 1;
    if (a.quadroVazio !== b.quadroVazio) return a.quadroVazio ? -1 : 1;
    if (a.foiNormalizado !== b.foiNormalizado) return a.foiNormalizado ? -1 : 1;
    return a.quadroCadastrado.localeCompare(b.quadroCadastrado, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });

  const totais = linhas.reduce((acc, linha) => {
    acc.militaresAtivosAnalisados += linha.quantidade;
    if (linha.quadroVazio) acc.militaresComQuadroVazio += linha.quantidade;
    if (linha.foraDosGrupos) acc.valoresForaDosGrupos += 1;
    if (linha.foiNormalizado) acc.valoresNormalizadosPorAlias += 1;
    if (linha.foiAgrupado) acc.valoresAgrupados += 1;
    return acc;
  }, {
    militaresAtivosAnalisados: 0,
    valoresDistintosQuadro: linhas.length,
    militaresComQuadroVazio: 0,
    valoresForaDosGrupos: 0,
    valoresNormalizadosPorAlias: 0,
    valoresAgrupados: 0,
  });

  return { linhas, totais };
}

function calcularValidacoes(grupos) {
  const alertas = [];
  const indices = new Map();
  const membros = new Map();

  grupos.forEach((grupo, posicao) => {
    const identificador = texto(grupo?.grupo) || `Grupo sem nome #${posicao + 1}`;
    const indice = grupo?.indice;
    const indiceKey = indice === undefined || indice === null ? '' : String(indice);
    const membrosGrupo = Array.isArray(grupo?.membros) ? grupo.membros : [];

    if (!texto(grupo?.grupo)) {
      alertas.push(`Grupo na posição ${posicao + 1} está sem nome.`);
    }

    if (membrosGrupo.length === 0) {
      alertas.push(`${identificador} está sem membros equivalentes.`);
    }

    if (indiceKey) {
      const gruposMesmoIndice = indices.get(indiceKey) || [];
      gruposMesmoIndice.push(identificador);
      indices.set(indiceKey, gruposMesmoIndice);
    }

    membrosGrupo.forEach((membro) => {
      const membroNormalizado = normalizarMembro(membro);
      if (!membroNormalizado) return;
      const ocorrencias = membros.get(membroNormalizado) || [];
      ocorrencias.push({ membro: texto(membro), grupo: identificador });
      membros.set(membroNormalizado, ocorrencias);
    });
  });

  indices.forEach((gruposMesmoIndice, indice) => {
    if (gruposMesmoIndice.length > 1) {
      alertas.push(`Índice duplicado ${indice} nos grupos: ${gruposMesmoIndice.join(', ')}.`);
    }
  });

  membros.forEach((ocorrencias, membroNormalizado) => {
    const gruposUnicos = Array.from(new Set(ocorrencias.map((ocorrencia) => ocorrencia.grupo)));
    if (gruposUnicos.length > 1) {
      const membrosOriginais = Array.from(new Set(ocorrencias.map((ocorrencia) => ocorrencia.membro))).join(', ');
      alertas.push(`Membro repetido após normalização (${membroNormalizado}; originais: ${membrosOriginais}) nos grupos: ${gruposUnicos.join(', ')}.`);
    }
  });

  return alertas;
}

export default function AntiguidadeConfigQuadros() {
  const grupos = ORDEM_GRUPOS_QUADROS_ANTIGUIDADE;
  const validacoes = useMemo(() => calcularValidacoes(grupos), [grupos]);
  const {
    data: militaresAtivos = [],
    isLoading: auditoriaLoading,
    isFetching: auditoriaFetching,
    error: auditoriaErro,
    refetch: atualizarAuditoria,
  } = useQuery({
    queryKey: ['antiguidade-config-quadros-auditoria-runtime'],
    queryFn: async () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
  });
  const auditoria = useMemo(() => calcularAuditoriaQuadros(militaresAtivos), [militaresAtivos]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-3 text-white shadow-sm">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Antiguidade • conferência técnica</p>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Configuração de Quadros para Antiguidade</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {badgesInstitucionais.map((badge) => (
              <Badge key={badge} variant="outline" className="border-slate-300 bg-white text-slate-700">
                {badge}
              </Badge>
            ))}
          </div>
        </div>

        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link to={createPageUrl('AntiguidadePrevia')}>
            Abrir Prévia Geral
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <AlertCircle className="h-4 w-4 text-amber-700" />
        <AlertTitle>Configuração técnica inicial. Necessita confirmação institucional antes de uso em listagem oficial.</AlertTitle>
        <AlertDescription>
          Esta tela apenas exibe a regra técnica atualmente usada na prévia. Não permite edição, não grava dados e não altera a listagem oficial.
        </AlertDescription>
      </Alert>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <Info className="h-5 w-5 text-slate-600" />
            Validações informativas
          </CardTitle>
          <p className="text-sm text-slate-600">
            As verificações abaixo são calculadas localmente a partir da regra técnica do código e não bloqueiam nenhum fluxo.
          </p>
        </CardHeader>
        <CardContent>
          {validacoes.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Nenhum conflito encontrado.
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="mb-2 font-semibold">Inconsistências informativas encontradas:</p>
              <ul className="list-disc space-y-1 pl-5">
                {validacoes.map((validacao) => (
                  <li key={validacao}>{validacao}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>


      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Auditoria runtime dos quadros reais cadastrados
              </CardTitle>
              <p className="text-sm text-slate-600">
                Consulta somente <code className="rounded bg-slate-100 px-1 font-mono">Militar.filter({"{ status_cadastro: 'Ativo' }"})</code> no runtime autenticado Base44 e compara os valores reais de militar.quadro com a regra técnica atual.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => atualizarAuditoria()} disabled={auditoriaFetching} className="w-full lg:w-auto">
              {auditoriaFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar auditoria
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <Info className="h-4 w-4 text-blue-700" />
            <AlertDescription>
              Esta auditoria apenas lê os quadros reais dos militares ativos e compara com a regra técnica atual. Não altera dados.
            </AlertDescription>
          </Alert>

          {auditoriaLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando militares ativos para auditoria read-only...
            </div>
          ) : auditoriaErro ? (
            <Alert className="border-red-200 bg-red-50 text-red-900">
              <AlertCircle className="h-4 w-4 text-red-700" />
              <AlertTitle>Falha ao consultar militares ativos</AlertTitle>
              <AlertDescription>{auditoriaErro?.message || 'Não foi possível carregar a auditoria runtime dos quadros.'}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                {[
                  ['Militares ativos analisados', auditoria.totais.militaresAtivosAnalisados, 'text-slate-900'],
                  ['Valores distintos de quadro', auditoria.totais.valoresDistintosQuadro, 'text-slate-900'],
                  ['Militares com quadro vazio/nulo', auditoria.totais.militaresComQuadroVazio, 'text-red-700'],
                  ['Valores fora dos grupos', auditoria.totais.valoresForaDosGrupos, 'text-red-700'],
                  ['Valores normalizados por alias', auditoria.totais.valoresNormalizadosPorAlias, 'text-amber-700'],
                  ['Valores agrupados', auditoria.totais.valoresAgrupados, 'text-blue-700'],
                ].map(([rotulo, valor, classe]) => (
                  <div key={rotulo} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
                    <p className={`mt-2 text-2xl font-bold ${classe}`}>{valor}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead>Quadro cadastrado</TableHead>
                      <TableHead className="text-right">Quantidade de militares</TableHead>
                      <TableHead>Quadro normalizado</TableHead>
                      <TableHead>Grupo de antiguidade</TableHead>
                      <TableHead>Índice do grupo</TableHead>
                      <TableHead>Conhecido?</TableHead>
                      <TableHead>Normalizado?</TableHead>
                      <TableHead>Agrupado?</TableHead>
                      <TableHead>Fora dos grupos?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditoria.linhas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-6 text-center text-slate-500">
                          Nenhum militar ativo retornado pela consulta read-only.
                        </TableCell>
                      </TableRow>
                    ) : auditoria.linhas.map((linha) => (
                      <TableRow
                        key={linha.chave}
                        className={linha.foraDosGrupos || linha.quadroVazio ? 'bg-red-50/70 hover:bg-red-50' : linha.foiAgrupado ? 'bg-blue-50/60 hover:bg-blue-50' : linha.foiNormalizado ? 'bg-amber-50/60 hover:bg-amber-50' : undefined}
                      >
                        <TableCell className="font-semibold text-slate-900">
                          {linha.quadroVazio ? (
                            <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">{linha.quadroCadastrado}</Badge>
                          ) : linha.quadroCadastrado}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-slate-800">{linha.quantidade}</TableCell>
                        <TableCell className="font-mono text-slate-700">{linha.quadroNormalizado}</TableCell>
                        <TableCell className="font-semibold text-slate-800">{linha.grupoAntiguidadeQuadro}</TableCell>
                        <TableCell className="font-mono text-slate-700">{linha.quadroIndice}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={classeBadgeBooleano(linha.conhecido)}>{formatarBooleano(linha.conhecido)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={classeBadgeBooleano(linha.foiNormalizado, 'aviso')}>{formatarBooleano(linha.foiNormalizado)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={classeBadgeBooleano(linha.foiAgrupado, 'positivo')}>{formatarBooleano(linha.foiAgrupado)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={classeBadgeBooleano(linha.foraDosGrupos || linha.quadroVazio, 'alerta')}>
                            {linha.quadroVazio ? 'Quadro vazio' : formatarBooleano(linha.foraDosGrupos)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>


      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Grupos de equivalência de quadros</CardTitle>
          <p className="text-sm text-slate-600">
            Fonte única desta tela: ORDEM_GRUPOS_QUADROS_ANTIGUIDADE em src/utils/antiguidade/ordemQuadrosAntiguidade.js.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-24">Índice</TableHead>
                <TableHead className="w-36">Grupo</TableHead>
                <TableHead>Membros equivalentes</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-64">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map((grupo, posicao) => {
                const membros = Array.isArray(grupo?.membros) ? grupo.membros : [];
                const nomeGrupo = texto(grupo?.grupo) || '—';

                return (
                  <TableRow key={`${nomeGrupo}-${grupo?.indice ?? posicao}`}>
                    <TableCell className="font-mono font-semibold text-slate-800">{grupo?.indice ?? '—'}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{nomeGrupo}</TableCell>
                    <TableCell>
                      {membros.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {membros.map((membro) => (
                            <Badge key={`${nomeGrupo}-${membro}`} variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-100">
                              {membro}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">Sem membros informados</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xl text-slate-700">{texto(grupo?.observacao) || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                        {obterStatus(grupo)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
