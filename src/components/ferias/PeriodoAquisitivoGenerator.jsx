import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export default function PeriodoAquisitivoGenerator() {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' })
  });

  const { data: periodosExistentes = [] } = useQuery({
    queryKey: ['periodos-aquisitivos'],
    queryFn: () => base44.entities.PeriodoAquisitivo.list()
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);

    try {
      const novosPeríodos = [];
      const hoje = new Date();
      
      for (const militar of militares) {
        if (!militar.data_inclusao) continue;

        const dataInclusao = new Date(militar.data_inclusao + 'T00:00:00');
        const periodosDoMilitar = periodosExistentes.filter(p => p.militar_id === militar.id);
        
        // Encontrar o período atual: o aniversário de inclusão que já passou neste ano
        let dataInicio = new Date(dataInclusao);
        
        // Avançar até o período corrente (onde hoje está dentro ou é o próximo)
        while (addYears(dataInicio, 1) <= hoje) {
          dataInicio = addYears(dataInicio, 1);
        }

        // Gerar período corrente + próximo (2 períodos futuros/atuais)
        for (let i = 0; i < 2; i++) {
          const dataFimPeriodo = new Date(addYears(dataInicio, 1));
          dataFimPeriodo.setDate(dataFimPeriodo.getDate() - 1);

          const periodoExiste = periodosDoMilitar.some(p => {
            const inicioExistente = new Date(p.inicio_aquisitivo + 'T00:00:00');
            return inicioExistente.getTime() === dataInicio.getTime();
          });

          if (!periodoExiste) {
            const dataLimiteGozo = addMonths(dataFimPeriodo, 24);
            novosPeríodos.push({
              militar_id: militar.id,
              militar_nome: militar.nome_completo,
              militar_posto: militar.posto_graduacao,
              militar_matricula: militar.matricula,
              inicio_aquisitivo: format(dataInicio, 'yyyy-MM-dd'),
              fim_aquisitivo: format(dataFimPeriodo, 'yyyy-MM-dd'),
              data_limite_gozo: format(dataLimiteGozo, 'yyyy-MM-dd'),
              dias_direito: 30,
              dias_gozados: 0,
              dias_previstos: 0,
              status: 'Disponível',
              ano_referencia: `${format(dataInicio, 'yyyy')}/${format(dataFimPeriodo, 'yyyy')}`
            });
          }

          dataInicio = addYears(dataInicio, 1);
        }
      }

      if (novosPeríodos.length > 0) {
        await base44.entities.PeriodoAquisitivo.bulkCreate(novosPeríodos);
        queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
        
        setResult({
          success: true,
          count: novosPeríodos.length,
          message: `${novosPeríodos.length} período(s) aquisitivo(s) gerado(s) com sucesso!`
        });
      } else {
        setResult({
          success: true,
          count: 0,
          message: 'Todos os períodos aquisitivos já estão atualizados.'
        });
      }
    } catch (error) {
      console.error('Erro ao gerar períodos:', error);
      setResult({
        success: false,
        message: 'Erro ao gerar períodos aquisitivos. Tente novamente.'
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
              <strong>{militares.length}</strong> militares ativos serão processados.
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
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={generating}
            >
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