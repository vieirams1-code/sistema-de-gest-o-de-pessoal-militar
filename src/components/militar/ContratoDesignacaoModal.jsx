import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronsUpDown, LockKeyhole } from 'lucide-react';
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
  normalizarDataIsoDateOnly,
  derivarDataBaseFeriasDaDataInicio,
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

const CIENCIA_PERIODOS_ITEMS = [
  'Estou ciente de que a nova data-base poderá alterar a cadeia futura de períodos aquisitivos.',
  'Estou ciente de que períodos incompatíveis já gerados deverão ser revisados manualmente.',
  'Estou ciente de que períodos com férias vinculadas exigem reversão/análise antes de exclusão.',
  'Estou ciente de que lançamentos publicados no Livro/publicações exigem atuação do administrador.',
];

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

function resolverMatriculaAtualParaContrato(militar, matriculaAtual) {
  return {
    id: matriculaAtual?.id ? sanitizarIdMatricula(matriculaAtual.id) : '',
    texto: getMatriculaMilitar(militar) || getMatriculaTexto(matriculaAtual),
  };
}

function sanitizarIdMatricula(value) {
  const texto = String(value ?? '').trim();
  const posicaoSeparador = texto.indexOf(':');
  return posicaoSeparador >= 0 ? texto.slice(0, posicaoSeparador).trim() : texto;
}

function sanitizarFormContrato(form = {}) {
  return {
    ...form,
    matricula_militar_id: sanitizarIdMatricula(form.matricula_militar_id),
    data_inicio_contrato: normalizarDataIsoDateOnly(form.data_inicio_contrato),
    data_inclusao_para_ferias: normalizarDataIsoDateOnly(form.data_inclusao_para_ferias),
    data_fim_contrato: normalizarDataIsoDateOnly(form.data_fim_contrato),
    data_publicacao: normalizarDataIsoDateOnly(form.data_publicacao),
  };
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

export default function ContratoDesignacaoModal({ open, onOpenChange, militarId, militares = [], matriculas = [], militaresLoading = false, contrato = null, readOnly = false, bloqueiaCadeiaFerias = false, onSubmit, isSubmitting = false }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [militarSelecionadoId, setMilitarSelecionadoId] = useState(militarId || '');
  const [erros, setErros] = useState([]);
  const [militarPopoverOpen, setMilitarPopoverOpen] = useState(false);
  const [buscaMilitar, setBuscaMilitar] = useState('');
  const [cienciaPeriodos, setCienciaPeriodos] = useState(() => CIENCIA_PERIODOS_ITEMS.map(() => false));

  useEffect(() => {
    if (!open) return;
    setErros([]);
    setCienciaPeriodos(CIENCIA_PERIODOS_ITEMS.map(() => false));
    const proximoMilitarId = contrato?.militar_id || militarId || '';
    setMilitarSelecionadoId(proximoMilitarId);
    setForm(sanitizarFormContrato(contrato ? { ...EMPTY_FORM, ...contrato } : { ...EMPTY_FORM }));
  }, [open, contrato, militarId]);

  const militaresOptions = useMemo(() => (Array.isArray(militares) ? militares : []).filter((militar) => militar?.id), [militares]);
  const militarSelectOptions = useMemo(() => militaresOptions.map((militar) => ({
    value: String(militar.id),
    label: formatMilitarSearchText(militar),
    militar,
  })), [militaresOptions]);
  const militarEscolhido = useMemo(() => militaresOptions.find((militar) => String(militar.id) === String(militarSelecionadoId)) || null, [militarSelecionadoId, militaresOptions]);
  const matriculasOptions = useMemo(() => (Array.isArray(matriculas) ? matriculas : [])
    .map((mat) => ({ ...mat, id: sanitizarIdMatricula(mat?.id) }))
    .filter((mat) => mat?.id && (!militarSelecionadoId || String(mat?.militar_id || '') === String(militarSelecionadoId))), [matriculas, militarSelecionadoId]);
  const matriculaAtualSelecionada = useMemo(() => encontrarMatriculaAtual(matriculasOptions), [matriculasOptions]);
  const matriculaAtualContrato = useMemo(
    () => resolverMatriculaAtualParaContrato(militarEscolhido, matriculaAtualSelecionada),
    [militarEscolhido, matriculaAtualSelecionada],
  );
  const militaresFiltradosBusca = useMemo(() => {
    const termo = normalizarBusca(buscaMilitar);
    const termoNumerico = somenteDigitos(buscaMilitar);
    if (!termo) return militarSelectOptions.slice(0, 30);
    return militarSelectOptions
      .filter(({ militar, label }) => {
        const matriculasMilitar = (Array.isArray(matriculas) ? matriculas : [])
          .filter((mat) => String(mat?.militar_id || '') === String(militar.id));
        const textoBusca = [label, formatMilitarSearchText(militar, matriculasMilitar)].filter(Boolean).join(' ');
        return normalizarBusca(textoBusca).includes(termo)
          || (termoNumerico && somenteDigitos(textoBusca).includes(termoNumerico));
      })
      .slice(0, 30);
  }, [buscaMilitar, matriculas, militarSelectOptions]);

  const isEditing = Boolean(contrato?.id);
  const exigeCienciaPeriodos = !readOnly && !isEditing;
  const cienciaPeriodosCompleta = !exigeCienciaPeriodos || cienciaPeriodos.every(Boolean);
  const campoCadeiaBloqueado = (field) => bloqueiaCadeiaFerias && [
    'data_inicio_contrato',
    'data_inclusao_para_ferias',
    'gera_direito_ferias',
    'regra_geracao_periodos',
  ].includes(field);

  const update = (field, value) => setForm((prev) => {
    if (campoCadeiaBloqueado(field)) return prev;
    const valorSeguro = field === 'matricula_militar_id' ? sanitizarIdMatricula(value) : value;
    const next = aplicarRegraFeriasPorTipoPrazo({ ...prev, [field]: valorSeguro });
    if (field === 'data_inicio_contrato' && !prev.data_inclusao_para_ferias) {
      next.data_inclusao_para_ferias = derivarDataBaseFeriasDaDataInicio(valorSeguro);
    }
    if (next.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO) {
      next.data_fim_contrato = '';
    }
    return sanitizarFormContrato(next);
  });

  const sincronizarMatriculaAtualNoFormulario = (militar, matriculaAtual) => {
    const matriculaContrato = resolverMatriculaAtualParaContrato(militar, matriculaAtual);
    setForm((prev) => ({
      ...prev,
      matricula_militar_id: matriculaContrato.id,
      matricula_designacao: matriculaContrato.texto,
    }));
  };

  const handleMilitarChange = (value) => {
    const militarIdSelecionado = String(value || '');
    const matriculasMilitar = (Array.isArray(matriculas) ? matriculas : [])
      .map((mat) => ({ ...mat, id: sanitizarIdMatricula(mat?.id) }))
      .filter((mat) => mat?.id
        && String(mat?.militar_id || '') === militarIdSelecionado);
    const matriculaAtual = encontrarMatriculaAtual(matriculasMilitar);
    const militar = militaresOptions.find((item) => String(item.id) === militarIdSelecionado) || null;

    setMilitarSelecionadoId(militarIdSelecionado);
    sincronizarMatriculaAtualNoFormulario(militar, matriculaAtual);
    setMilitarPopoverOpen(false);
    setBuscaMilitar('');
  };

  useEffect(() => {
    if (!open || readOnly || contrato || !militarSelecionadoId) return;
    sincronizarMatriculaAtualNoFormulario(militarEscolhido, matriculaAtualSelecionada);
  }, [open, readOnly, contrato, militarSelecionadoId, militarEscolhido, matriculaAtualSelecionada]);

  const handleSubmit = async () => {
    if (!cienciaPeriodosCompleta) {
      setErros(['Confirme todos os itens de ciência sobre revisão manual de períodos aquisitivos antes de salvar.']);
      return;
    }
    const matriculaAtual = matriculaAtualContrato;
    const matriculaMilitarId = isEditing
      ? sanitizarIdMatricula(form.matricula_militar_id || contrato?.matricula_militar_id || matriculaAtual.id)
      : sanitizarIdMatricula(matriculaAtual.id);
    const matriculaDesignacao = isEditing
      ? String(form.matricula_designacao || contrato?.matricula_designacao || matriculaAtual.texto || '')
      : String(matriculaAtual.texto || '');
    const payload = aplicarRegraFeriasPorTipoPrazo(sanitizarFormContrato({
      ...form,
      militar_id: contrato?.militar_id || militarSelecionadoId || militarId,
      matricula_militar_id: matriculaMilitarId,
      matricula_designacao: matriculaDesignacao,
      data_inclusao_para_ferias: form.data_inclusao_para_ferias || derivarDataBaseFeriasDaDataInicio(form.data_inicio_contrato),
      status_contrato: form.status_contrato || 'ativo',
    }));
    if (payload.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO) {
      payload.data_fim_contrato = '';
    }
    if (bloqueiaCadeiaFerias && contrato) {
      payload.militar_id = contrato.militar_id;
      payload.data_inicio_contrato = normalizarDataIsoDateOnly(contrato.data_inicio_contrato);
      payload.data_inclusao_para_ferias = normalizarDataIsoDateOnly(contrato.data_inclusao_para_ferias || contrato.data_inicio_contrato);
      payload.gera_direito_ferias = contrato.gera_direito_ferias;
      payload.regra_geracao_periodos = contrato.regra_geracao_periodos;
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

  const title = contrato ? 'Editar Contrato de Designação' : 'Novo Contrato de Designação';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border-0 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Cadastre ou edite o registro administrativo do contrato de designação. Datas são salvas em ISO yyyy-MM-dd e exibidas em dd/MM/yyyy nos detalhes.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p>Encerrar ou cancelar contrato não altera períodos aquisitivos já existentes neste lote.</p>
            <p>{isEditing ? 'A matrícula textual salva no contrato será preservada nesta edição.' : 'A matrícula será puxada da ficha atual do militar. Se este contrato gerou nova matrícula, cadastre-a previamente na ficha do militar para que ela seja usada neste contrato.'}</p>
            {bloqueiaCadeiaFerias && <p>Este contrato já possui efeitos em períodos aquisitivos; campos que afetam a cadeia de férias estão bloqueados.</p>}
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
          <div className="space-y-5 px-6 pb-2">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Dados do Militar</h3>
                <p className="text-xs text-slate-500">Selecione o militar pelo componente de pesquisa; matrículas são resolvidas pela ficha.</p>
              </div>
              {isEditing && militarEscolhido ? (
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <LockKeyhole className="mt-1 h-4 w-4 text-slate-500" />
                  <div className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-slate-500">Nome completo</p>
                      <p className="font-semibold text-slate-950">{militarEscolhido.nome_completo || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Nome de guerra</p>
                      <p className="font-medium text-slate-800">{militarEscolhido.nome_guerra || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Posto/graduação</p>
                      <p className="font-medium text-slate-800">{militarEscolhido.posto_graduacao || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Matrícula</p>
                      <p className="font-medium text-slate-800">{form.matricula_designacao || getMatriculaMilitar(militarEscolhido) || '—'}</p>
                    </div>
                    <p className="text-xs text-slate-500 sm:col-span-2">Militar bloqueado para edição direta neste modal.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Pesquisar militar *</Label>
                  <Popover open={militarPopoverOpen} onOpenChange={setMilitarPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={militarPopoverOpen}
                        disabled={isEditing || militaresLoading || militaresOptions.length === 0}
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
                            {militaresFiltradosBusca.map((option) => (
                              <CommandItem
                                key={option.value}
                                value={option.value}
                                onSelect={() => handleMilitarChange(option.value)}
                                className="items-start gap-2 py-2"
                              >
                                <Check className={cn('mt-1 h-4 w-4 shrink-0', String(militarSelecionadoId) === option.value ? 'opacity-100' : 'opacity-0')} />
                                <MilitarSearchResult militar={option.militar} />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {militarEscolhido && <p className="text-xs text-slate-500">A matrícula será puxada da ficha atual do militar.</p>}
                  {!isEditing && !militaresLoading && militaresOptions.length === 0 && <p className="text-xs text-slate-500">Não há militares ativos disponíveis para criação de contrato no seu escopo atual.</p>}
                </div>
              )}
            </section>

            <hr className="border-slate-200" />

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Prazos e Regras</h3>
                <p className="text-xs text-slate-500">Datas e configurações que alimentam a cadeia de férias.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data de início *</Label>
                  <Input type="date" value={form.data_inicio_contrato} onChange={(e) => update('data_inicio_contrato', e.target.value)} disabled={campoCadeiaBloqueado('data_inicio_contrato')} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de prazo *</Label>
                  <Select value={form.tipo_prazo_contrato} onValueChange={(value) => update('tipo_prazo_contrato', value)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar tipo de prazo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO}>Indeterminado</SelectItem>
                      <SelectItem value={TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO}>Determinado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data de fim {form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.DETERMINADO ? '*' : ''}</Label>
                  <Input type="date" value={form.data_fim_contrato} onChange={(e) => update('data_fim_contrato', e.target.value)} disabled={form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO} />
                </div>
                <div className="space-y-2">
                  <Label>Gera direito a férias</Label>
                  <Select value="sim" disabled>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="sim">Sim</SelectItem></SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Contratos indeterminados geram férias automaticamente.</p>
                </div>
                <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">Configurar data-base diferente para férias</summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Data-base de férias opcional</Label>
                      <Input type="date" value={form.data_inclusao_para_ferias} onChange={(e) => update('data_inclusao_para_ferias', e.target.value)} disabled={campoCadeiaBloqueado('data_inclusao_para_ferias')} />
                      <p className="text-xs text-slate-500">Se não informada, será salva igual à data de início do contrato.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Regra de geração de períodos *</Label>
                      <Select
                        value={form.regra_geracao_periodos}
                        onValueChange={(value) => update('regra_geracao_periodos', value)}
                        disabled={campoCadeiaBloqueado('regra_geracao_periodos') || form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {form.tipo_prazo_contrato === TIPO_PRAZO_CONTRATO_DESIGNACAO.INDETERMINADO && <SelectItem value={REGRA_GERACAO_PERIODOS_DESIGNACAO.NORMAL}>Normal</SelectItem>}
                          <SelectItem value={REGRA_GERACAO_PERIODOS_DESIGNACAO.BLOQUEADA}>Bloqueada</SelectItem>
                          <SelectItem value={REGRA_GERACAO_PERIODOS_DESIGNACAO.MANUAL}>Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </details>
                {!form.gera_direito_ferias && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Motivo para não gerar férias *</Label>
                    <Textarea value={form.motivo_nao_gera_ferias} onChange={(e) => update('motivo_nao_gera_ferias', e.target.value)} />
                  </div>
                )}
              </div>
            </section>

            <hr className="border-slate-200" />

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Dados de Publicação</h3>
                <p className="text-xs text-slate-500">Identificação administrativa e observações do contrato.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            </section>

            {exigeCienciaPeriodos && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="space-y-3">
                    <p>Ao cadastrar este contrato, a data-base de férias do militar poderá alterar a cadeia futura de períodos aquisitivos. Após salvar, revise os períodos do militar quando necessário.</p>
                    <div className="space-y-2">
                      {CIENCIA_PERIODOS_ITEMS.map((texto, index) => (
                        <label key={texto} className="flex items-start gap-3 rounded-lg border border-blue-100 bg-white/70 p-3 text-blue-950">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-blue-300"
                            checked={cienciaPeriodos[index]}
                            onChange={(event) => setCienciaPeriodos((prev) => prev.map((checked, itemIndex) => (itemIndex === index ? event.target.checked : checked)))}
                          />
                          <span>{texto}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button variant="outline" className="border-slate-300 text-slate-700" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {!readOnly && <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={handleSubmit} disabled={isSubmitting || militaresLoading || !cienciaPeriodosCompleta}>{isSubmitting ? 'Salvando...' : (isEditing ? 'Salvar edição' : 'Salvar contrato')}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
