import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchScopedPeriodosAquisitivosBundle } from '@/services/getScopedPeriodosAquisitivosBundleClient';
import { parseDateOnlyStrict } from '@/services/dateOnlyService';
import { resolverDataBaseFerias, ORIGENS_DATA_BASE_FERIAS } from '@/services/resolverDataBaseFerias';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { DIAS_BASE_PADRAO } from './periodoSaldoUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar, Zap, CheckCircle, AlertCircle, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { addYears, addMonths, format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  enriquecerMilitarComMatriculas,
  filtrarMilitaresOperacionais,
  montarIndiceMatriculas,
} from '@/services/matriculaMilitarViewService';
import { abreviarPostoGraduacao } from '@/components/folha-alteracoes/postoGraduacao';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

const ANOS_RETROSPECTIVOS = 3;
const PERIODOS_FUTUROS = 2;

function agruparContratosDesignacaoPorMilitarId(contratos) {
  return (Array.isArray(contratos) ? contratos : []).reduce((map, contrato) => {
    if (!contrato?.militar_id) return map;

    const militarId = String(contrato.militar_id);
    const contratosDoMilitar = map.get(militarId) || [];
    contratosDoMilitar.push(contrato);
    map.set(militarId, contratosDoMilitar);
    return map;
  }, new Map());
}

function incrementarContador(contadores, codigo) {
  contadores.set(codigo, (contadores.get(codigo) || 0) + 1);
}

function getDescricaoCodigoBloqueio(codigo) {
  const descricoes = {
    MILITAR_SEM_DATA_INCLUSAO: 'sem data de inclusão',
    CONTRATO_ATIVO_SEM_DATA_BASE: 'com contrato ativo sem data-base',
    CONTRATO_ATIVO_DUPLICADO: 'com contrato ativo duplicado',
    DATA_BASE_FERIAS_INVALIDA: 'com data-base de férias inválida',
    DATA_BASE_CONTRATO_ANTERIOR_INICIO_CONTRATO: 'com data-base do contrato anterior ao início do contrato',
    CONTRATO_ATIVO_NAO_GERA_FERIAS: 'com contrato ativo que não gera férias',
    CONTRATO_ATIVO_GERACAO_BLOQUEADA: 'com geração automática bloqueada pelo contrato',
  };

  return descricoes[codigo] || `com bloqueio ${codigo || 'não identificado'}`;
}

function montarResumoBloqueios(contadoresBloqueio) {
  return Array.from(contadoresBloqueio.entries())
    .map(([codigo, total]) => `${total} ${getDescricaoCodigoBloqueio(codigo)}`)
    .join('; ');
}

function getMensagemOrigemDataBase(origem) {
  if (origem === ORIGENS_DATA_BASE_FERIAS.CONTRATO_DESIGNACAO) {
    return 'Períodos gerados com base na data-base de férias do contrato de designação ativo.';
  }

  return 'Períodos gerados com base na data de inclusão do militar.';
}

function montarResumoOrigens(origemMilitarDataInclusao, origemContratoDesignacao) {
  return `Origem das datas-base: ${origemMilitarDataInclusao} por data de inclusão do militar; ${origemContratoDesignacao} por contrato de designação ativo.`;
}

function mesmaData(a, b) {
  return a.getTime() === b.getTime();
}

function getAniversarioFuncionalNoAno(dataInclusao, anoAlvo) {
  const mes = dataInclusao.getMonth();
  const dia = dataInclusao.getDate();
  const ultimoDiaDoMes = new Date(anoAlvo, mes + 1, 0).getDate();
  const diaAjustado = Math.min(dia, ultimoDiaDoMes);
  const aniversario = new Date(anoAlvo, mes, diaAjustado);

  aniversario.setHours(0, 0, 0, 0);
  return aniversario;
}

function getInicioPeriodoAtual(dataInclusao, hoje) {
  const aniversarioNoAnoAtual = getAniversarioFuncionalNoAno(dataInclusao, hoje.getFullYear());

  const inicio = hoje >= aniversarioNoAnoAtual
    ? aniversarioNoAnoAtual
    : getAniversarioFuncionalNoAno(dataInclusao, hoje.getFullYear() - 1);

  return inicio < dataInclusao ? new Date(dataInclusao) : inicio;
}

function getJanelaOperacional(dataInclusao, hoje) {
  const inicioPeriodoAtual = getInicioPeriodoAtual(dataInclusao, hoje);
  const inicioJanela = addYears(inicioPeriodoAtual, -ANOS_RETROSPECTIVOS);
  const inicioUtil = inicioJanela < dataInclusao ? new Date(dataInclusao) : inicioJanela;
  const fimJanela = addYears(inicioPeriodoAtual, PERIODOS_FUTUROS);

  return { inicio: inicioUtil, fim: fimJanela };
}

export default function PeriodoAquisitivoGenerator() {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [escopo, setEscopo] = useState('all');
  const [militarSelecionadoId, setMilitarSelecionadoId] = useState('');
  const [militarSelectorOpen, setMilitarSelectorOpen] = useState(false);
  const [militarSearch, setMilitarSearch] = useState('');
  const queryClient = useQueryClient();
  const { isAdmin = false, user = {}, modoAcesso = null } = useCurrentUser();

  const effectiveEmail = getEffectiveEmail();
  const paBundleQueryKey = ['pa-bundle', Boolean(isAdmin), modoAcesso || null, user?.email || null, effectiveEmail || null];

  const { data: paBundle = {} } = useQuery({
    queryKey: paBundleQueryKey,
    queryFn: () => fetchScopedPeriodosAquisitivosBundle(),
  });

  const militares = paBundle?.militares || [];
  const matriculasMilitar = paBundle?.matriculasMilitar || [];
  const contratosDesignacaoMilitar = paBundle?.contratosDesignacaoMilitar || [];

  const militaresOperacionais = useMemo(() => {
    const indiceMatriculas = montarIndiceMatriculas(matriculasMilitar);
    return filtrarMilitaresOperacionais(
      (militares || []).map((militar) => enriquecerMilitarComMatriculas(militar, indiceMatriculas)),
      { incluirInativos: false }
    );
  }, [militares, matriculasMilitar]);

  const militaresSelecionaveis = useMemo(
    () => [...militaresOperacionais].sort((a, b) => (a?.nome_completo || '').localeCompare(b?.nome_completo || '')),
    [militaresOperacionais]
  );

  const militarSelecionado = useMemo(
    () => militaresSelecionaveis.find((militar) => String(militar.id) === String(militarSelecionadoId)) || null,
    [militarSelecionadoId, militaresSelecionaveis]
  );

  const normalizarBusca = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizarMatricula = (texto) => String(texto || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

  const montarTextoBuscaMilitar = (militar) => {
    const postoAbreviado = abreviarPostoGraduacao(militar?.posto_graduacao);
    const lotacao = militar?.lotacao_atual || militar?.lotacao || militar?.estrutura_nome || militar?.subgrupamento_nome || militar?.grupamento_nome || '';
    const matriculaAtual = militar?.matricula_atual || '';
    const matriculaLegada = militar?.matricula || '';

    return [
      militar?.nome,
      militar?.nome_completo,
      militar?.nome_guerra,
      matriculaAtual,
      matriculaLegada,
      normalizarMatricula(matriculaAtual),
      normalizarMatricula(matriculaLegada),
      militar?.posto_graduacao,
      postoAbreviado,
      militar?.quadro,
      lotacao,
    ].filter(Boolean).join(' ');
  };

  const militaresFiltrados = useMemo(() => {
    const termo = normalizarBusca(militarSearch);
    if (!termo) return militaresSelecionaveis;

    return militaresSelecionaveis.filter((militar) => {
      const textoBusca = normalizarBusca(montarTextoBuscaMilitar(militar));
      const termoSemPontuacao = normalizarMatricula(termo);
      return textoBusca.includes(termo) || (termoSemPontuacao && textoBusca.includes(termoSemPontuacao));
    });
  }, [militarSearch, militaresSelecionaveis]);

  const formatarMilitarPrincipal = (militar) => {
    const posto = abreviarPostoGraduacao(militar?.posto_graduacao);
    const quadro = String(militar?.quadro || '').trim().toUpperCase();
    const nomeCompleto = String(militar?.nome_completo || '').trim();
    const matricula = String(militar?.matricula_atual || militar?.matricula || '').trim();
    const lotacao = String(militar?.lotacao_atual || militar?.lotacao || '').trim();
    return [posto, quadro, nomeCompleto].filter(Boolean).join(' ')
      + (matricula ? ` — Mat. ${matricula}` : '')
      + (lotacao ? ` — ${lotacao}` : '');
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);

    try {
      const novosPeriodos = [];
      const bloqueiosGeracao = [];
      const contadoresBloqueio = new Map();
      let origemMilitarDataInclusao = 0;
      let origemContratoDesignacao = 0;
      let origemDataBaseIndividual = null;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const registrarBloqueio = ({ militar, resolucaoDataBase, codigoBloqueio, mensagem }) => {
        const bloqueio = {
          militarId: militar?.id ?? militar?._id ?? null,
          militarNome: militar?.nome_completo || militar?.nome || '',
          codigoBloqueio: codigoBloqueio || resolucaoDataBase?.codigoBloqueio || 'DATA_BASE_FERIAS_INVALIDA',
          mensagem: mensagem || resolucaoDataBase?.mensagem || 'Data-base de férias inválida para geração de períodos.',
          origem: resolucaoDataBase?.origem || null,
          contratoId: resolucaoDataBase?.contratoId || null,
        };

        bloqueiosGeracao.push(bloqueio);
        incrementarContador(contadoresBloqueio, bloqueio.codigoBloqueio);
        console.warn('[PeriodoAquisitivoGenerator] geração bloqueada por data-base de férias', bloqueio);
      };

      const militaresAlvo = escopo === 'all'
        ? militaresSelecionaveis
        : militaresSelecionaveis.filter((militar) => String(militar.id) === String(militarSelecionadoId));

      if (militaresAlvo.length === 0) {
        setResult({
          success: false,
          message: 'Militar selecionado não encontrado entre os operacionais ativos.',
        });
        return;
      }

      // Refetch fresco dos períodos existentes para evitar cache stale bloquear a geração.
      const periodosFrescosBundle = await queryClient.fetchQuery({
        queryKey: paBundleQueryKey,
        queryFn: () => fetchScopedPeriodosAquisitivosBundle(),
        staleTime: 0,
      });
      const periodosFrescos = periodosFrescosBundle?.periodosAquisitivos || [];
      // Usa contratos do refetch fresco; o fallback local cobre respostas antigas/temporárias sem o novo campo.
      const contratosDesignacaoFrescos = periodosFrescosBundle?.contratosDesignacaoMilitar || contratosDesignacaoMilitar;
      const contratosFrescosPorMilitarId = agruparContratosDesignacaoPorMilitarId(contratosDesignacaoFrescos);

      for (const militar of militaresAlvo) {
        const contratosDoMilitar = contratosFrescosPorMilitarId.get(String(militar.id)) || [];
        const resolucaoDataBase = resolverDataBaseFerias({
          militar,
          contratosDesignacao: contratosDoMilitar,
        });

        if (resolucaoDataBase.bloqueado) {
          registrarBloqueio({ militar, resolucaoDataBase });
          continue;
        }

        const dataInclusao = parseDateOnlyStrict(resolucaoDataBase.dataBase);
        if (!dataInclusao) {
          registrarBloqueio({
            militar,
            resolucaoDataBase,
            codigoBloqueio: 'DATA_BASE_FERIAS_INVALIDA',
            mensagem: 'Data-base de férias resolvida em formato inválido para geração de períodos.',
          });
          continue;
        }

        if (resolucaoDataBase.origem === ORIGENS_DATA_BASE_FERIAS.CONTRATO_DESIGNACAO) {
          origemContratoDesignacao += 1;
        } else {
          origemMilitarDataInclusao += 1;
        }
        if (escopo === 'individual') {
          origemDataBaseIndividual = resolucaoDataBase.origem;
        }

        const periodosDoMilitar = periodosFrescos.filter((p) => String(p.militar_id) === String(militar.id));
        const { inicio, fim } = getJanelaOperacional(dataInclusao, hoje);

        let dataInicio = new Date(inicio);

        while (dataInicio <= fim) {
          const dataFimPeriodo = addYears(dataInicio, 1);
          dataFimPeriodo.setDate(dataFimPeriodo.getDate() - 1);

          const periodoExiste = periodosDoMilitar.some((p) => {
            if (!p.inicio_aquisitivo) return false;
            const inicioAquisitivo = parseDateOnlyStrict(p.inicio_aquisitivo);
            return inicioAquisitivo ? mesmaData(inicioAquisitivo, dataInicio) : false;
          });

          if (!periodoExiste) {
            const dataLimiteGozo = addMonths(dataFimPeriodo, 24);

            novosPeriodos.push({
              militar_id: militar.id,
              militar_nome: militar.nome_completo,
              militar_posto: militar.posto_graduacao,
              militar_matricula: militar.matricula_atual || militar.matricula || '',
              inicio_aquisitivo: format(dataInicio, 'yyyy-MM-dd'),
              fim_aquisitivo: format(dataFimPeriodo, 'yyyy-MM-dd'),
              data_limite_gozo: format(dataLimiteGozo, 'yyyy-MM-dd'),
              dias_base: DIAS_BASE_PADRAO,
              dias_total: DIAS_BASE_PADRAO,
              dias_gozados: 0,
              dias_previstos: 0,
              dias_saldo: DIAS_BASE_PADRAO,
              status: 'Disponível',
              ano_referencia: `${format(dataInicio, 'yyyy')}/${format(dataFimPeriodo, 'yyyy')}`,
            });
          }

          dataInicio = addYears(dataInicio, 1);
        }
      }

      const totalBloqueados = bloqueiosGeracao.length;
      const resumoBloqueios = montarResumoBloqueios(contadoresBloqueio);
      const resumoOrigens = montarResumoOrigens(origemMilitarDataInclusao, origemContratoDesignacao);
      const sufixoBloqueios = totalBloqueados > 0
        ? ` ${totalBloqueados} militar(es) bloqueado(s): ${resumoBloqueios}.`
        : '';
      const mensagemOrigemIndividual = getMensagemOrigemDataBase(origemDataBaseIndividual);

      if (novosPeriodos.length > 0) {
        await base44.entities.PeriodoAquisitivo.bulkCreate(novosPeriodos);
        queryClient.invalidateQueries({ queryKey: paBundleQueryKey });

        setResult({
          success: true,
          count: novosPeriodos.length,
          message: escopo === 'all'
            ? `${novosPeriodos.length} período(s) aquisitivo(s) gerado(s) com sucesso. ${resumoOrigens}${sufixoBloqueios}`
            : `${novosPeriodos.length} período(s) aquisitivo(s) gerado(s) para o militar selecionado. ${mensagemOrigemIndividual}`,
        });
      } else if (escopo === 'individual' && totalBloqueados > 0) {
        setResult({
          success: false,
          message: bloqueiosGeracao[0]?.mensagem || 'Não foi possível gerar períodos: data-base de férias bloqueada.',
        });
      } else if (escopo === 'all' && totalBloqueados > 0 && totalBloqueados === militaresAlvo.length) {
        setResult({
          success: false,
          count: 0,
          message: `0 período(s) aquisitivo(s) gerado(s) com sucesso. ${resumoOrigens}${sufixoBloqueios}`,
        });
      } else {
        setResult({
          success: true,
          count: 0,
          message: escopo === 'all'
            ? `0 período(s) aquisitivo(s) gerado(s) com sucesso. Todos os períodos aquisitivos já estão atualizados. ${resumoOrigens}${sufixoBloqueios}`
            : `O militar selecionado já está com os períodos aquisitivos atualizados. ${mensagemOrigemIndividual}`,
        });
      }
    } catch (error) {
      console.error('Erro ao gerar períodos:', error);
      setResult({
        success: false,
        message: 'Erro ao gerar períodos aquisitivos. Tente novamente.',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white">
          <Zap className="w-4 h-4 mr-2" />
          Gerar Períodos Automáticos
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar Períodos Aquisitivos</DialogTitle>
          <DialogDescription>
            Gere períodos aquisitivos automaticamente para todos os militares operacionais
            ou apenas para um militar específico, respeitando contratos de designação ativos e a data-base de férias resolvida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Escopo de geração</p>
            <Select value={escopo} onValueChange={setEscopo} disabled={generating}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o escopo da geração" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os militares operacionais</SelectItem>
                <SelectItem value="individual">Militar específico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {escopo === 'individual' && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Militar</p>
              <Popover open={militarSelectorOpen} onOpenChange={setMilitarSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={generating}
                    className="w-full justify-between min-h-10 h-auto"
                  >
                    <div className="text-left truncate">
                      {militarSelecionado ? formatarMilitarPrincipal(militarSelecionado) : 'Selecione o militar'}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar por nome, guerra, matrícula, posto ou quadro..."
                      value={militarSearch}
                      onValueChange={setMilitarSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum militar encontrado.</CommandEmpty>
                      <CommandGroup>
                        {militaresFiltrados.map((militar) => (
                          <CommandItem
                            key={militar.id}
                            value={montarTextoBuscaMilitar(militar)}
                            onSelect={() => {
                              setMilitarSelecionadoId(String(militar.id));
                              setMilitarSelectorOpen(false);
                              setMilitarSearch('');
                            }}
                            className="flex items-start gap-2 py-2"
                          >
                            <Check className={`mt-0.5 h-4 w-4 ${militarSelecionadoId === String(militar.id) ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="min-w-0">
                              <p className="truncate text-sm text-slate-900">{formatarMilitarPrincipal(militar)}</p>
                              {String(militar?.nome_guerra || '').trim() && (
                                <p className="truncate text-xs font-bold text-slate-700">{String(militar.nome_guerra).trim()}</p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Alert>
            <Calendar className="w-4 h-4" />
            <AlertDescription>
              <strong>{escopo === 'all' ? militaresSelecionaveis.length : 1}</strong> militar(es) será(ão) processado(s).
              Apenas períodos que ainda não existem serão criados.
            </AlertDescription>
          </Alert>

          {result && (
            <Alert className={result.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
              {result.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <AlertDescription className={result.success ? 'text-emerald-700' : 'text-red-700'}>
                {result.message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>
              Cancelar
            </Button>

            <Button
              onClick={handleGenerate}
              disabled={generating || (escopo === 'individual' && !militarSelecionadoId)}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Gerar Períodos
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}