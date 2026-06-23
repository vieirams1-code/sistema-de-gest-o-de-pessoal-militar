import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight } from 'lucide-react';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import PeriodoAquisitivoSelector from '@/components/descontos-ferias/PeriodoAquisitivoSelector';

const LIMITE_DIAS_PERIODO = 8;

function calcDataFim(dataInicio, dias) {
  if (!dataInicio || !Number.isFinite(Number(dias)) || Number(dias) <= 0) return '';
  const base = new Date(`${String(dataInicio).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + (Number(dias) - 1));
  return base.toISOString().slice(0, 10);
}

function formatarData(data) {
  if (!data) return '—';
  return String(data).slice(0, 10).split('-').reverse().join('/');
}

/**
 * Modal "Adicionar desconto" — coleta militar, período, dias, data e observações.
 * Ao clicar em "Gerar publicação", repassa os dados consolidados ao pai.
 */
export default function AdicionarDescontoModal({
  open,
  onClose,
  periodosPorMilitar = {},
  descontosExistentes = [],
  onGerarPublicacao,
}) {
  const [militarId, setMilitarId] = useState('');
  const [militarSnapshot, setMilitarSnapshot] = useState(null);
  const [periodoId, setPeriodoId] = useState('');
  const [dias, setDias] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const periodos = periodosPorMilitar[militarId] || [];
  const periodoSelecionado = periodos.find((p) => p.id === periodoId) || null;
  const diasNum = Number(dias);
  const dataFim = calcDataFim(dataInicio, diasNum);

  const diasAcumulados = useMemo(() => {
    if (!periodoId) return 0;
    return (descontosExistentes || [])
      .filter((d) => d.periodo_aquisitivo_id === periodoId && ['ativo', 'pendente_publicacao'].includes(d.status))
      .reduce((acc, d) => acc + Math.max(0, Number(d.dias) || 0), 0);
  }, [descontosExistentes, periodoId]);

  const erroValidacao = useMemo(() => {
    if (!militarId) return null;
    if (!periodoId) return null;
    if (diasNum > 0 && diasAcumulados + diasNum > LIMITE_DIAS_PERIODO) {
      return `Limite de ${LIMITE_DIAS_PERIODO} dias por período excedido. Já acumulados: ${diasAcumulados}d.`;
    }
    return null;
  }, [militarId, periodoId, diasNum, diasAcumulados]);

  const podeAvancar = militarId && periodoId && diasNum > 0 && dataInicio && !erroValidacao;

  const handleMilitarSelect = (snap) => {
    setMilitarSnapshot(snap?.id ? snap : null);
    setPeriodoId('');
  };

  const handleChange = (field, val) => {
    if (field === 'militar_id') {
      setMilitarId(val);
      if (!val) setMilitarSnapshot(null);
      setPeriodoId('');
    }
  };

  const resetAndClose = () => {
    setMilitarId('');
    setMilitarSnapshot(null);
    setPeriodoId('');
    setDias('');
    setDataInicio('');
    setObservacoes('');
    onClose();
  };

  const handleAvancar = () => {
    if (!podeAvancar) return;
    onGerarPublicacao({
      militar_id: militarId,
      militar_nome: militarSnapshot?.nome_completo || militarSnapshot?.militar_nome || '',
      militar_posto: militarSnapshot?.posto_graduacao || militarSnapshot?.militar_posto || '',
      militar_matricula: militarSnapshot?.matricula || militarSnapshot?.militar_matricula || '',
      periodo_aquisitivo_id: periodoId,
      periodo_aquisitivo_ref: periodoSelecionado?.ano_referencia || '',
      dias: diasNum,
      data_inicio: dataInicio,
      data_fim: dataFim,
      observacoes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1e3a5f]">Adicionar Desconto em Férias</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <MilitarSelector
            value={militarId}
            onChange={handleChange}
            onMilitarSelect={handleMilitarSelect}
          />

          {militarId && (
            <PeriodoAquisitivoSelector
              periodos={periodos}
              value={periodoId}
              onChange={setPeriodoId}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Quantidade de Dias <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={1}
                max={LIMITE_DIAS_PERIODO}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                placeholder="Ex: 2"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Data Inicial <span className="text-red-500">*</span>
              </Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Data Final (calculada)</Label>
            <div className="px-3 py-2 border rounded-md bg-slate-50 text-slate-700 text-sm">
              {dataFim ? formatarData(dataFim) : '—'}
            </div>
          </div>

          {periodoId && (
            <div className="text-xs text-slate-500">
              Acumulado no período: <span className="font-semibold">{diasAcumulados}d</span> de {LIMITE_DIAS_PERIODO}d.
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Observações (opcional)" />
          </div>

          {erroValidacao && <p className="text-sm text-red-600">{erroValidacao}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
          <Button onClick={handleAvancar} disabled={!podeAvancar} className="bg-[#1e3a5f] hover:bg-[#16304f]">
            Gerar publicação <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}