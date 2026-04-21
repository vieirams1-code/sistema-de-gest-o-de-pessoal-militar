import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { DIAS_BASE_PADRAO } from './periodoSaldoUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Calendar, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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

const ANOS_RETROSPECTIVOS = 3;
const PERIODOS_FUTUROS = 2;

function parseDateOnly(value) {
  return new Date(`${value}T00:00:00`);
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
  const queryClient = useQueryClient();

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
  });

  const { data: matriculasMilitar = [] } = useQuery({
    queryKey: ['militares-ativos-matriculas'],
    queryFn: () => base44.entities.MatriculaMilitar.list('-created_date'),
  });

  const { data: periodosExistentes = [] } = useQuery({
    queryKey: ['periodos-aquisitivos'],
    queryFn: () => base44.entities.PeriodoAquisitivo.list(),
  });

  const militaresOperacionais = useMemo(() => {
    const indiceMatriculas = montarIndiceMatriculas(matriculasMilitar);
    return filtrarMilitaresOperacionais(
      (militares || []).map((militar) => enriquecerMilitarComMatriculas(militar, indiceMatriculas)),
      { incluirInativos: false }
    );
  }, [militares, matriculasMilitar]);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);

    try {
      const novosPeriodos = [];
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      for (const militar of militaresOperacionais) {
        if (!militar.data_inclusao) continue;

        const dataInclusao = parseDateOnly(militar.data_inclusao);
        const periodosDoMilitar = periodosExistentes.filter((p) => p.militar_id === militar.id);
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

      if (novosPeriodos.length > 0) {
        await base44.entities.PeriodoAquisitivo.bulkCreate(novosPeriodos);
        queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });

        setResult({
          success: true,
          count: novosPeriodos.length,
          message: `${novosPeriodos.length} período(s) aquisitivo(s) gerado(s) com sucesso!`,
        });
      } else {
        setResult({
          success: true,
          count: 0,
          message: 'Todos os períodos aquisitivos já estão atualizados.',
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
            Esta ação irá gerar automaticamente os períodos aquisitivos para todos os militares ativos
            com base na data de inclusão de cada um.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Calendar className="w-4 h-4" />
            <AlertDescription>
              <strong>{militaresOperacionais.length}</strong> militares ativos serão processados.
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
              disabled={generating}
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
