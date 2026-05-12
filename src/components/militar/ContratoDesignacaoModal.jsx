import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  aplicarRegraFeriasPorTipoPrazo,
  REGRA_GERACAO_PERIODOS_DESIGNACAO,
  TIPO_PRAZO_CONTRATO_DESIGNACAO,
  validarContratoDesignacaoPayload,
} from '@/services/contratosDesignacaoMilitarService';

const EMPTY_FORM = {
  matricula_militar_id: '',
  matricula_designacao: '',
  data_inicio_contrato: '',
  data_fim_contrato: '',
  data_inclusao_para_ferias: '',
  numero_contrato: '',
  boletim_publicacao: '',
  data_publicacao: '',
  fonte_legal: '',
  tipo_designacao: '',
  observacoes: '',
  status_contrato: 'ativo',
  tipo_prazo_contrato: TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO,
  gera_direito_ferias: true,
  regra_geracao_periodos: REGRA_GERACAO_PERIODOS_DESIGNACAO.NORMAL,
  motivo_nao_gera_ferias: '',
};

function formatDate(date) {
  if (!date) return '—';
  try { return new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR'); } catch (_e) { return date; }
}

export default function ContratoDesignacaoModal({ open, onOpenChange, militarId, militares = [], matriculas = [], contrato = null, readOnly = false, onSubmit, isSubmitting = false }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [militarSelecionadoId, setMilitarSelecionadoId] = useState(militarId || '');
  const [erros, setErros] = useState([]);

  useEffect(() => {
    if (!open) return;
    setErros([]);
    const proximoMilitarId = contrato?.militar_id || militarId || '';
    setMilitarSelecionadoId(proximoMilitarId);
    setForm(contrato ? { ...EMPTY_FORM, ...contrato } : { ...EMPTY_FORM });
  }, [open, contrato, militarId]);

  const militaresOptions = useMemo(() => (Array.isArray(militares) ? militares : []).filter((militar) => militar?.id), [militares]);
  const militarEscolhido = useMemo(() => militaresOptions.find((militar) => String(militar.id) === String(militarSelecionadoId)) || null, [militarSelecionadoId, militaresOptions]);
  const matriculasOptions = useMemo(() => (Array.isArray(matriculas) ? matriculas : [])
    .filter((mat) => (mat?.id || mat?.matricula) && (!militarSelecionadoId || String(mat?.militar_id || '') === String(militarSelecionadoId))), [matriculas, militarSelecionadoId]);

  const update = (field, value) => setForm((prev) => aplicarRegraFeriasPorTipoPrazo({ ...prev, [field]: value }));

  const handleMilitarChange = (value) => {
    setMilitarSelecionadoId(value);
    setForm((prev) => ({
      ...prev,
      matricula_militar_id: '',
      matricula_designacao: '',
    }));
  };

  const handleMatriculaChange = (value) => {
    const selected = matriculasOptions.find((mat) => String(mat.id) === String(value));
    setForm((prev) => ({
      ...prev,
      matricula_militar_id: value,
      matricula_designacao: selected?.matricula_formatada || selected?.matricula || prev.matricula_designacao,
    }));
  };

  const handleSubmit = async () => {
    const payload = aplicarRegraFeriasPorTipoPrazo({ ...form, militar_id: militarSelecionadoId || militarId, status_contrato: 'ativo' });
    const validacao = validarContratoDesignacaoPayload(payload);
    if (!validacao.valido) {
      setErros(validacao.erros);
      return;
    }
    try {
      await onSubmit?.(payload);
    } catch (error) {
      setErros([error?.message || 'Não foi possível salvar o contrato de designação.']);
    }
  };

  const title = contrato ? 'Detalhes do Contrato de Designação' : 'Novo Contrato de Designação';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            A data de inclusão original do militar será preservada. O contrato de designação será usado futuramente como data-base de férias, após integração da regra em lote posterior.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>Encerrar ou cancelar contrato não altera períodos aquisitivos já existentes neste lote.</p>
        </div>

        {erros.length > 0 && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p className="font-semibold">Corrija os campos abaixo:</p>
            <ul className="list-disc pl-5">
              {erros.map((erro) => <li key={erro}>{erro}</li>)}
            </ul>
          </div>
        )}

        {readOnly ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              ['Status', form.status_contrato],
              ['Tipo de prazo', form.tipo_prazo_contrato],
              ['Gera direito a férias', form.gera_direito_ferias ? 'Sim' : 'Não'],
              ['Regra de geração de períodos', form.regra_geracao_periodos],
              ['Matrícula de designação', form.matricula_designacao],
              ['Início do contrato', formatDate(form.data_inicio_contrato)],
              ['Fim/encerramento', formatDate(form.data_fim_contrato || form.data_encerramento_operacional)],
              ['Data-base futura de férias', formatDate(form.data_inclusao_para_ferias)],
              ['Número do contrato', form.numero_contrato],
              ['Boletim de publicação', form.boletim_publicacao],
              ['Data de publicação', formatDate(form.data_publicacao)],
              ['Fonte legal', form.fonte_legal],
              ['Tipo de designação', form.tipo_designacao],
              ['Motivo encerramento', form.motivo_encerramento],
              ['Motivo cancelamento', form.motivo_cancelamento],
              ['Motivo para não gerar férias', form.motivo_nao_gera_ferias],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="font-medium text-slate-700">{value || '—'}</p>
              </div>
            ))}
            <div className="md:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Observações</p>
              <p className="font-medium text-slate-700 whitespace-pre-wrap">{form.observacoes || '—'}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {militaresOptions.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <Label>Militar *</Label>
                <Select value={militarSelecionadoId || ''} onValueChange={handleMilitarChange}>
                  <SelectTrigger><SelectValue placeholder="Buscar/selecionar militar" /></SelectTrigger>
                  <SelectContent>
                    {militaresOptions.map((militar) => (
                      <SelectItem key={militar.id} value={String(militar.id)}>
                        {[militar.nome_completo || militar.nome_guerra, militar.posto_graduacao, militar.matricula].filter(Boolean).join(' • ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {militarEscolhido && <p className="text-xs text-slate-500">Matrículas existentes listadas abaixo para {militarEscolhido.nome_guerra || militarEscolhido.nome_completo}.</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label>Matrícula existente do militar</Label>
              <Select value={form.matricula_militar_id || ''} onValueChange={handleMatriculaChange} disabled={!militarSelecionadoId && militaresOptions.length > 0}>
                <SelectTrigger><SelectValue placeholder="Selecionar matrícula existente" /></SelectTrigger>
                <SelectContent>
                  {matriculasOptions.length === 0 && <SelectItem value="__empty" disabled>Nenhuma matrícula encontrada</SelectItem>}
                  {matriculasOptions.map((mat) => (
                    <SelectItem key={mat.id || mat.matricula} value={String(mat.id || mat.matricula)}>
                      {mat.matricula_formatada || mat.matricula} {mat.is_atual ? '(Atual)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Matrícula de designação *</Label>
              <Input value={form.matricula_designacao} onChange={(e) => update('matricula_designacao', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data de início *</Label>
              <Input type="date" value={form.data_inicio_contrato} onChange={(e) => update('data_inicio_contrato', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data-base futura para férias *</Label>
              <Input type="date" value={form.data_inclusao_para_ferias} onChange={(e) => update('data_inclusao_para_ferias', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de prazo do contrato *</Label>
              <Select value={form.tipo_prazo_contrato} onValueChange={(value) => update('tipo_prazo_contrato', value)}>
                <SelectTrigger><SelectValue placeholder="Selecionar tipo de prazo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO}>Indeterminado</SelectItem>
                  <SelectItem value={TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO}>Determinado (12 meses)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de fim {form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO ? '*' : ''}</Label>
              <Input type="date" value={form.data_fim_contrato} onChange={(e) => update('data_fim_contrato', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gera direito a férias *</Label>
              <Select
                value={form.gera_direito_ferias ? 'sim' : 'nao'}
                onValueChange={(value) => update('gera_direito_ferias', value === 'sim')}
                disabled={form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
              {form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO && <p className="text-xs text-slate-500">Contratos indeterminados geram direito a férias automaticamente.</p>}
            </div>
            <div className="space-y-2">
              <Label>Regra de geração de períodos *</Label>
              <Select
                value={form.regra_geracao_periodos}
                onValueChange={(value) => update('regra_geracao_periodos', value)}
                disabled={form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO && <SelectItem value={REGRA_GERACAO_PERIODOS_DESIGNACAO.NORMAL}>Normal</SelectItem>}
                  <SelectItem value={REGRA_GERACAO_PERIODOS_DESIGNACAO.BLOQUEADA}>Bloqueada</SelectItem>
                  <SelectItem value={REGRA_GERACAO_PERIODOS_DESIGNACAO.MANUAL}>Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!form.gera_direito_ferias && (
              <div className="space-y-2 md:col-span-2">
                <Label>Motivo para não gerar férias *</Label>
                <Textarea value={form.motivo_nao_gera_ferias} onChange={(e) => update('motivo_nao_gera_ferias', e.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Número do contrato</Label>
              <Input value={form.numero_contrato} onChange={(e) => update('numero_contrato', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Boletim de publicação</Label>
              <Input value={form.boletim_publicacao} onChange={(e) => update('boletim_publicacao', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data de publicação</Label>
              <Input type="date" value={form.data_publicacao} onChange={(e) => update('data_publicacao', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de designação</Label>
              <Input value={form.tipo_designacao} onChange={(e) => update('tipo_designacao', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Fonte legal</Label>
              <Input value={form.fonte_legal} onChange={(e) => update('fonte_legal', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!readOnly && <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar contrato'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
