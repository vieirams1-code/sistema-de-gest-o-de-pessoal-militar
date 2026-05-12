import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
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

function normalizarBusca(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getMatriculaMilitar(militar) {
  return militar?.matricula_formatada || militar?.matricula || '';
}

function formatMilitarSearchText(militar, matriculasMilitar = []) {
  return [
    militar?.nome_completo,
    militar?.nome_guerra,
    getMatriculaMilitar(militar),
    militar?.cpf,
    militar?.posto_graduacao,
    ...matriculasMilitar.map((mat) => mat?.matricula_formatada || mat?.matricula),
  ].filter(Boolean).join(' ');
}

function somenteDigitos(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizarSituacaoMatricula(value) {
  return normalizarBusca(value);
}

function getMatriculaTexto(matricula) {
  return matricula?.matricula_formatada || matricula?.matricula || '';
}

function encontrarMatriculaAtual(matriculasMilitar = []) {
  const candidatas = (Array.isArray(matriculasMilitar) ? matriculasMilitar : []).filter((mat) => mat?.id);
  return candidatas.find((mat) => mat?.is_atual === true)
    || candidatas.find((mat) => normalizarSituacaoMatricula(mat?.situacao) === 'ativa')
    || null;
}

function MilitarSearchResult({ militar, selected = false }) {
  const detalhes = [
    militar?.nome_guerra ? <strong key="guerra" className="font-bold text-slate-700">{militar.nome_guerra}</strong> : null,
    militar?.posto_graduacao || null,
    getMatriculaMilitar(militar) || null,
  ].filter(Boolean);

  return (
    <div className="min-w-0 flex-1 text-left">
      <p className="truncate text-sm font-medium text-slate-900">{militar?.nome_completo || militar?.nome_guerra || 'Militar sem nome'}</p>
      <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        {detalhes.length > 0 ? detalhes.map((item, index) => (
          <React.Fragment key={typeof item === 'string' ? `${item}-${index}` : item.key}>
            {index > 0 && <span className="text-slate-300">•</span>}
            <span className="truncate">{item}</span>
          </React.Fragment>
        )) : 'Sem dados complementares'}
      </p>
      {selected && <span className="sr-only">Militar selecionado</span>}
    </div>
  );
}

export default function ContratoDesignacaoModal({ open, onOpenChange, militarId, militares = [], matriculas = [], militaresLoading = false, contrato = null, readOnly = false, onSubmit, isSubmitting = false }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [militarSelecionadoId, setMilitarSelecionadoId] = useState(militarId || '');
  const [erros, setErros] = useState([]);
  const [militarPopoverOpen, setMilitarPopoverOpen] = useState(false);
  const [buscaMilitar, setBuscaMilitar] = useState('');

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
    .filter((mat) => mat?.id && (!militarSelecionadoId || String(mat?.militar_id || '') === String(militarSelecionadoId))), [matriculas, militarSelecionadoId]);
  const matriculaAtualSelecionada = useMemo(() => encontrarMatriculaAtual(matriculasOptions), [matriculasOptions]);
  const militarSemMatriculaAtual = Boolean(militarSelecionadoId) && !matriculaAtualSelecionada;
  const militaresFiltradosBusca = useMemo(() => {
    const termo = normalizarBusca(buscaMilitar);
    const termoNumerico = somenteDigitos(buscaMilitar);
    if (!termo) return militaresOptions.slice(0, 30);
    return militaresOptions
      .filter((militar) => {
        const matriculasMilitar = (Array.isArray(matriculas) ? matriculas : [])
          .filter((mat) => String(mat?.militar_id || '') === String(militar.id));
        const textoBusca = formatMilitarSearchText(militar, matriculasMilitar);
        return normalizarBusca(textoBusca).includes(termo)
          || (termoNumerico && somenteDigitos(textoBusca).includes(termoNumerico));
      })
      .slice(0, 30);
  }, [buscaMilitar, matriculas, militaresOptions]);

  const update = (field, value) => setForm((prev) => {
    const next = aplicarRegraFeriasPorTipoPrazo({ ...prev, [field]: value });
    if (field === 'data_inicio_contrato' && !prev.data_inclusao_para_ferias) {
      next.data_inclusao_para_ferias = value;
    }
    if (next.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO) {
      next.data_fim_contrato = '';
    }
    return next;
  });

  const sincronizarMatriculaAtualNoFormulario = (matriculaAtual) => {
    setForm((prev) => ({
      ...prev,
      matricula_militar_id: matriculaAtual?.id ? String(matriculaAtual.id) : '',
      matricula_designacao: getMatriculaTexto(matriculaAtual),
    }));
  };

  const handleMilitarChange = (value) => {
    const matriculasMilitar = (Array.isArray(matriculas) ? matriculas : []).filter((mat) => mat?.id
      && String(mat?.militar_id || '') === String(value));
    const matriculaAtual = encontrarMatriculaAtual(matriculasMilitar);

    setMilitarSelecionadoId(value);
    sincronizarMatriculaAtualNoFormulario(matriculaAtual);
    setMilitarPopoverOpen(false);
    setBuscaMilitar('');
  };

  useEffect(() => {
    if (!open || readOnly || contrato || !militarSelecionadoId) return;
    sincronizarMatriculaAtualNoFormulario(matriculaAtualSelecionada);
  }, [open, readOnly, contrato, militarSelecionadoId, matriculaAtualSelecionada]);

  const handleSubmit = async () => {
    const matriculaAtual = matriculaAtualSelecionada;
    if (!matriculaAtual?.id || militarSemMatriculaAtual) {
      setErros(['Cadastre uma matrícula atual/ativa na ficha do militar antes de registrar o contrato de designação.']);
      return;
    }
    const payload = aplicarRegraFeriasPorTipoPrazo({
      ...form,
      militar_id: militarSelecionadoId || militarId,
      matricula_militar_id: String(matriculaAtual.id),
      matricula_designacao: getMatriculaTexto(matriculaAtual),
      data_inclusao_para_ferias: form.data_inclusao_para_ferias || form.data_inicio_contrato,
      status_contrato: 'ativo',
    });
    if (payload.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO) {
      payload.data_fim_contrato = '';
    }
    if (String(payload.matricula_militar_id || '').includes(':')) {
      setErros(['Erro técnico: matricula_militar_id deve conter somente o ID real da matrícula, sem o formato id:matricula.']);
      return;
    }
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
          <div className="space-y-1">
            <p>Encerrar ou cancelar contrato não altera períodos aquisitivos já existentes neste lote.</p>
            <p>Se este contrato gerou nova matrícula, cadastre a nova matrícula na ficha do militar antes de registrar o contrato.</p>
          </div>
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
              ['Data-base de férias', formatDate(form.data_inclusao_para_ferias || form.data_inicio_contrato)],
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
            <div className="space-y-2 md:col-span-2">
              <Label>Pesquisar militar *</Label>
              <Popover open={militarPopoverOpen} onOpenChange={setMilitarPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={militarPopoverOpen}
                    disabled={militaresLoading || militaresOptions.length === 0}
                    className="h-auto min-h-11 w-full justify-between px-3 py-2 font-normal"
                  >
                    {militarEscolhido ? (
                      <MilitarSearchResult militar={militarEscolhido} selected />
                    ) : (
                      <span className="text-sm text-slate-500">
                        {militaresLoading ? 'Carregando militares do escopo...' : 'Pesquise por nome, nome de guerra, matrícula ou CPF...'}
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(42rem,calc(100vw-2rem))] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Pesquise por nome, nome de guerra, matrícula ou CPF..."
                      value={buscaMilitar}
                      onValueChange={setBuscaMilitar}
                    />
                    <CommandList>
                      {militaresLoading && <CommandEmpty>Carregando militares do escopo...</CommandEmpty>}
                      {!militaresLoading && <CommandEmpty>Nenhum militar ativo encontrado no seu escopo.</CommandEmpty>}
                      <CommandGroup className="max-h-72 overflow-auto">
                        {militaresFiltradosBusca.map((militar) => (
                          <CommandItem
                            key={militar.id}
                            value={formatMilitarSearchText(militar)}
                            onSelect={() => handleMilitarChange(String(militar.id))}
                            className="items-start gap-2 py-2"
                          >
                            <Check className={cn('mt-1 h-4 w-4 shrink-0', String(militarSelecionadoId) === String(militar.id) ? 'opacity-100' : 'opacity-0')} />
                            <MilitarSearchResult militar={militar} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {militarEscolhido && <p className="text-xs text-slate-500">A matrícula atual do contrato será puxada da ficha de {militarEscolhido.nome_guerra || militarEscolhido.nome_completo}.</p>}
              {!militaresLoading && militaresOptions.length === 0 && <p className="text-xs text-slate-500">Não há militares ativos disponíveis para criação de contrato no seu escopo atual.</p>}
            </div>
            {militarSemMatriculaAtual && (
              <div className="md:col-span-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Este militar não possui matrícula atual/ativa cadastrada. Cadastre a matrícula na ficha do militar antes de registrar o contrato.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Matrícula atual vinculada *</Label>
              <Input value={form.matricula_militar_id ? getMatriculaTexto(matriculaAtualSelecionada) : ''} placeholder="Puxada automaticamente da ficha do militar" readOnly disabled />
              {form.matricula_militar_id && <p className="text-xs text-slate-500">ID da matrícula: {form.matricula_militar_id}</p>}
            </div>
            <div className="space-y-2">
              <Label>Matrícula de designação *</Label>
              <Input value={form.matricula_designacao} placeholder="Puxada automaticamente da matrícula atual" readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>Data de início *</Label>
              <Input type="date" value={form.data_inicio_contrato} onChange={(e) => update('data_inicio_contrato', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Data-base diferente para férias</summary>
                <div className="mt-3 space-y-2">
                  <Label>Data-base de férias opcional</Label>
                  <Input type="date" value={form.data_inclusao_para_ferias} onChange={(e) => update('data_inclusao_para_ferias', e.target.value)} />
                  <p className="text-xs text-slate-500">Se não informada, será salva igual à data de início do contrato.</p>
                </div>
              </details>
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
              <Label>Data de fim {form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO ? '(recomendada)' : ''}</Label>
              <Input type="date" value={form.data_fim_contrato} onChange={(e) => update('data_fim_contrato', e.target.value)} disabled={form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO} />
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
          {!readOnly && <Button onClick={handleSubmit} disabled={isSubmitting || militaresLoading || militarSemMatriculaAtual}>{isSubmitting ? 'Salvando...' : 'Salvar contrato'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
