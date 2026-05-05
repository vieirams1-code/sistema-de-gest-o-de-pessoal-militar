import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchScopedPeriodosAquisitivosBundle } from '@/services/getScopedPeriodosAquisitivosBundleClient';
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

function parseDateOnly(value) {
  if (!value) return null;
  const str = String(value).trim();
  // Formato ISO: yyyy-MM-dd
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(`${str}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Formato BR: dd/MM/yyyy
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    const date = new Date(`${ano}-${mes}-${dia}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Fallback: tenta parse nativo
  const fallback = new Date(`${str}T00:00:00`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
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
      let militaresIgnoradosSemData = 0;
      let militaresIgnoradosDataInvalida = 0;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

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

      for (const militar of militaresAlvo) {
        if (!militar.data_inclusao) {
          militaresIgnoradosSemData += 1;
          continue;
        }

        const dataInclusao = parseDateOnly(militar.data_inclusao);
        if (!dataInclusao) {
          militaresIgnoradosDataInvalida += 1;
          console.warn('[PeriodoAquisitivoGenerator] data_inclusao em formato inválido', {
            militar_id: militar.id,
            nome_completo: militar.nome_completo,
            data_inclusao: militar.data_inclusao,
          });
          continue;
        }
        const periodosDoMilitar = periodosFrescos.filter((p) => String(p.militar_id) === String(militar.id));
        const { inicio, fim } = getJanelaOperacional(dataInclusao, hoje);

        let dataInicio = new Date(inicio);

        while (dataInicio <= fim) {
          const dataFimPeriodo = addYears(dataInicio, 1);
          dataFimPeriodo.setDate(dataFimPeriodo.getDate() - 1);

          const periodoExiste = periodosDoMilitar.some((p) => {
            if (!p.inicio_aquisitivo) return false;
            return mesmaData(parseDateOnly(p.inicio_aquisitivo), dataInicio);
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

      const avisoIgnorados = [];
      if (militaresIgnoradosDataInvalida > 0) {
        avisoIgnorados.push(`${militaresIgnoradosDataInvalida} militar(es) ignorado(s) por data de inclusão em formato inválido`);
      }
      if (escopo === 'all' && militaresIgnoradosSemData > 0) {
        avisoIgnorados.push(`${militaresIgnoradosSemData} militar(es) sem data de inclusão`);
      }
      const sufixoAviso = avisoIgnorados.length ? ` (${avisoIgnorados.join('; ')}).` : '';

      if (novosPeriodos.length > 0) {
        await base44.entities.PeriodoAquisitivo.bulkCreate(novosPeriodos);
        queryClient.invalidateQueries({ queryKey: paBundleQueryKey });

        setResult({
          success: true,
          count: novosPeriodos.length,
          message: (escopo === 'all'
            ? `${novosPeriodos.length} período(s) aquisitivo(s) gerado(s) com sucesso!`
            : `${novosPeriodos.length} período(s) aquisitivo(s) gerado(s) para o militar selecionado.`) + sufixoAviso,
        });
      } else if (escopo === 'individual' && militaresIgnoradosDataInvalida > 0) {
        setResult({
          success: false,
          message: 'Não foi possível gerar períodos: a data de inclusão do militar está em formato inválido. Corrija o cadastro do militar (formato esperado: dd/mm/aaaa ou aaaa-mm-dd) e tente novamente.',
        });
      } else if (escopo === 'individual' && militaresIgnoradosSemData > 0) {
        setResult({
          success: false,
          message: 'Não foi possível gerar períodos: o militar não possui data de inclusão cadastrada.',
        });
      } else {
        setResult({
          success: true,
          count: 0,
          message: (escopo === 'all'
            ? 'Todos os períodos aquisitivos já estão atualizados.'
            : 'O militar selecionado já está com os períodos aquisitivos atualizados.') + sufixoAviso,
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
            ou apenas para um militar específico, com base na data de inclusão.
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