import { useMemo, useState } from 'react';
import { Briefcase, CalendarDays, CheckSquare2, ChevronDown, Columns3, FileSearch, ListChecks, Search, SlidersHorizontal, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { classificarPostoGraduacao, classificarQuadro } from '@/utils/postoQuadroCompatibilidade';

function findLabel(options = [], value) {
  return options.find((option) => option.value === value)?.label || '';
}

function getLotacaoLabel({ lotacaoFilter, lotacoesDisponiveis, todosValue, semLotacaoValue }) {
  if (lotacaoFilter === todosValue) return '';
  if (lotacaoFilter === semLotacaoValue) return 'Sem lotação informada';
  return lotacoesDisponiveis.find((lotacao) => lotacao.id === lotacaoFilter)?.nome || '';
}

function pluralizePosto(posto = '') {
  if (!posto) return '';
  if (posto.endsWith('l')) return `${posto.slice(0, -1)}is`;
  if (posto.endsWith('o')) return `${posto}s`;
  return `${posto}s`;
}

function isGraduacaoPraca(label = '') {
  return /sargento|subtenente|cabo|soldado/i.test(label);
}

function joinDisplayList(values = [], limit = 2) {
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  if (values.length <= limit) {
    const firstItems = values.slice(0, -1).join(', ');
    return `${firstItems} e ${values[values.length - 1]}`;
  }
  return `${values.slice(0, limit).join(', ')} +${values.length - limit}`;
}

function summarizePostos(postos = [], postosDisponiveis = []) {
  if (!postos.length) return 'Todos os postos/graduações';
  const todosCompativeisSelecionados = postosDisponiveis.length > 0 && postos.length === postosDisponiveis.length;
  if (todosCompativeisSelecionados && postos.every(isGraduacaoPraca)) return 'Todas as praças';
  if (todosCompativeisSelecionados) return 'Todos os oficiais';
  if (postos.length <= 2) return joinDisplayList(postos);
  const hasOnlyPracas = postos.every(isGraduacaoPraca);
  return `${postos.length} ${hasOnlyPracas ? 'graduações' : 'postos/graduações'}`;
}

function summarizeQuadros(quadros = []) {
  if (!quadros.length) return 'Todos os quadros';
  if (quadros.length <= 2) return joinDisplayList(quadros);
  return `${quadros.length} quadros`;
}

function summarizeList(values = [], emptyLabel, limit = 3) {
  if (!values.length) return emptyLabel;
  if (values.length <= limit) return joinDisplayList(values, limit);
  return `${values.slice(0, limit).join(', ')} +${values.length - limit}`;
}

function buildResumoListagem({
  categoriaFilter,
  postoFilters,
  quadroFilters,
  statusFilter,
  feriasPresencaFilter,
  feriasStatusFilter,
  feriasPeriodoFilter,
  categoriaOptions,
  feriasPeriodoOptions,
  todosValue,
  categoriaTodasValue,
  feriasTodosStatusValue,
}) {
  const partes = [];
  const posto = postoFilters?.length === 1 ? postoFilters[0] : '';
  const categoria = findLabel(categoriaOptions, categoriaFilter);
  const selectedFeriasPeriodoLabel = findLabel(feriasPeriodoOptions, feriasPeriodoFilter).toLowerCase();

  if (posto) {
    partes.push(pluralizePosto(posto));
  } else if (categoriaFilter !== categoriaTodasValue && categoria) {
    partes.push(categoria);
  } else {
    partes.push('militares');
  }

  if (!posto && postoFilters?.length > 1) partes.push(summarizePostos(postoFilters).toLowerCase());
  if (statusFilter !== todosValue) partes.push(`${String(statusFilter).toLowerCase()}s`);
  if (quadroFilters?.length) partes.push(`dos quadros ${summarizeList(quadroFilters, '').toLowerCase()}`);
  if (feriasPresencaFilter === 'com_periodo') {
    partes.push(`com férias ${selectedFeriasPeriodoLabel || 'no período selecionado'}`);
  } else if (feriasPresencaFilter === 'sem_periodo') {
    partes.push(`sem férias ${selectedFeriasPeriodoLabel || 'no período selecionado'}`);
  } else if (feriasPresencaFilter === 'em_curso') {
    partes.push('com férias em curso');
  }
  if (feriasStatusFilter !== feriasTodosStatusValue) {
    partes.push(`com férias ${String(feriasStatusFilter).toLowerCase()}`);
  }

  return `Listando ${partes.join(' ')}.`;
}

function pluralizeStatus(status = '') {
  if (!status) return '';
  if (status.endsWith('o')) return `${status}s`;
  if (status.endsWith('a')) return `${status}s`;
  return status;
}

function makeListagemToken(key, label, value, displayValue = value) {
  return { key, label, value, displayValue };
}

function buildListagemTokens({
  searchTerm,
  categoriaFilter,
  postoFilters,
  quadroFilters,
  statusFilter,
  situacaoMilitarFilter,
  funcaoFilter,
  condicaoFilter,
  lotacaoFilter,
  feriasPresencaFilter,
  feriasStatusFilter,
  feriasPeriodoFilter,
  categoriaOptions,
  feriasPresencaOptions,
  feriasPeriodoOptions,
  lotacoesDisponiveis,
  todosValue,
  semLotacaoValue,
  categoriaTodasValue,
  feriasTodasPresencasValue,
  feriasTodosStatusValue,
}) {
  const tokens = [];
  const trimmedSearch = searchTerm.trim();

  if (trimmedSearch) tokens.push(makeListagemToken('busca', 'Busca', trimmedSearch, `Busca por ${trimmedSearch}`));
  if (categoriaFilter !== categoriaTodasValue) {
    const categoria = findLabel(categoriaOptions, categoriaFilter);
    tokens.push(makeListagemToken('categoria', 'Grupo', categoria));
  }
  if (postoFilters?.length) {
    tokens.push(makeListagemToken('posto', 'Posto/graduação', summarizeList(postoFilters, ''), summarizePostos(postoFilters)));
  }
  if (quadroFilters?.length) {
    tokens.push(makeListagemToken('quadro', 'Quadro', summarizeList(quadroFilters, ''), summarizeQuadros(quadroFilters)));
  }
  if (statusFilter !== todosValue) tokens.push(makeListagemToken('status', 'Situação', statusFilter, pluralizeStatus(statusFilter)));
  if (situacaoMilitarFilter !== todosValue) {
    tokens.push(makeListagemToken('situacaoMilitar', 'Situação militar', situacaoMilitarFilter));
  }
  if (funcaoFilter !== todosValue) tokens.push(makeListagemToken('funcao', 'Função', funcaoFilter));
  if (condicaoFilter !== todosValue) tokens.push(makeListagemToken('condicao', 'Condição', condicaoFilter));

  const lotacaoLabel = getLotacaoLabel({ lotacaoFilter, lotacoesDisponiveis, todosValue, semLotacaoValue });
  if (lotacaoLabel) tokens.push(makeListagemToken('lotacao', 'Lotação', lotacaoLabel));

  if (feriasPresencaFilter !== feriasTodasPresencasValue) {
    const feriasPresenca = findLabel(feriasPresencaOptions, feriasPresencaFilter);
    tokens.push(makeListagemToken('ferias', 'Férias', feriasPresenca));
  }
  if (feriasPeriodoFilter) {
    const feriasPeriodo = findLabel(feriasPeriodoOptions, feriasPeriodoFilter);
    tokens.push(makeListagemToken('periodoFerias', 'Período de férias', feriasPeriodo));
  }
  if (feriasStatusFilter !== feriasTodosStatusValue) {
    tokens.push(makeListagemToken('statusFerias', 'Situação das férias', feriasStatusFilter, `Férias ${String(feriasStatusFilter).toLowerCase()}`));
  }

  return tokens.filter((token) => token.value);
}

function getCareerLabel(type) {
  if (type === 'oficial') return 'Oficial';
  if (type === 'praca') return 'Praça';
  return 'Geral';
}

function getOptionCareer(type, option) {
  if (type === 'posto') return classificarPostoGraduacao(option);
  if (type === 'quadro') return classificarQuadro(option);
  return null;
}

function ChecklistMultiSelect({
  label,
  triggerLabel,
  options = [],
  selectedValues = [],
  onChange,
  emptyMessage = 'Nenhuma opção disponível',
  helperText = 'Marque uma ou mais opções. Sem marcação significa todos.',
  optionType = null,
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const toggleValue = (value, checked) => {
    const nextValues = checked
      ? [...selectedValues, value].filter((item, index, array) => array.indexOf(item) === index)
      : selectedValues.filter((selectedValue) => selectedValue !== value);
    onChange(nextValues);
    setOpen(true);
  };

  const clearSelection = () => {
    onChange([]);
    setOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 w-full justify-between gap-3 border-slate-300 bg-white px-3 py-2 text-left font-normal text-slate-800 shadow-sm hover:border-blue-300 hover:bg-blue-50/40"
          aria-label={`${label}: ${triggerLabel}`}
        >
          <span className="min-w-0 space-y-0.5">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
            <span className="block truncate text-sm font-semibold text-slate-900">{triggerLabel}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {selectedValues.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                {selectedValues.length}
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(94vw,36rem)] rounded-2xl border-slate-200 p-0 shadow-2xl"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="overflow-hidden rounded-2xl bg-white">
          <div className="border-b border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <CheckSquare2 className="h-4 w-4 text-blue-600" />
                  {label}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{helperText}</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {selectedValues.length ? `${selectedValues.length} marcado${selectedValues.length === 1 ? '' : 's'}` : 'Todos'}
              </span>
            </div>
            {selectedValues.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedValues.slice(0, 4).map((value) => (
                  <span key={value} className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    {value}
                  </span>
                ))}
                {selectedValues.length > 4 && (
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    +{selectedValues.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="max-h-[22rem] space-y-2 overflow-y-auto p-3 pr-2">
            {options.length ? options.map((option) => {
              const checked = selectedSet.has(option);
              const id = `${label}-${option}`.replace(/\s+/g, '-').toLowerCase();
              const carreira = getOptionCareer(optionType, option);

              return (
                <label
                  key={option}
                  htmlFor={id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                    checked
                      ? 'border-blue-300 bg-blue-50 text-blue-950 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(nextChecked) => toggleValue(option, nextChecked === true)}
                    className="h-5 w-5 shrink-0 border-slate-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-5">{option}</span>
                    {carreira && (
                      <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                        Compatível com {getCareerLabel(carreira)}
                      </span>
                    )}
                  </span>
                </label>
              );
            }) : (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">{emptyMessage}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs text-slate-500">O menu permanece aberto para seleção contínua.</p>
            {selectedValues.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                Limpar seleção
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ToolbarPopover({ icon: Icon, label, children, contentClassName = 'w-[min(92vw,42rem)]' }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/10 text-slate-100 shadow-none hover:bg-white/15 hover:text-white"
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`${contentClassName} rounded-2xl border-slate-200 p-4 shadow-xl`}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export default function CommandCenter({
  values,
  setters,
  options,
  columnState,
  quickPresets,
  onQuickPreset,
  onExecute,
  onClear,
  isAccessResolved,
  isBusy,
  filtersChangedAfterExecution,
  shouldShowLotacaoFilter,
  isLoadingLotacoes,
  isErrorLotacoes,
  lotacoesError,
  constants,
}) {
  const {
    searchTerm,
    categoriaFilter,
    postoFilters = [],
    quadroFilters = [],
    compatibilityNotice,
    statusFilter,
    situacaoMilitarFilter,
    funcaoFilter,
    condicaoFilter,
    lotacaoFilter,
    feriasPresencaFilter,
    feriasStatusFilter,
    feriasPeriodoFilter,
  } = values;

  const {
    setSearchTerm,
    setCategoriaFilter,
    setPostoFilters,
    setQuadroFilters,
    setStatusFilter,
    setSituacaoMilitarFilter,
    setFuncaoFilter,
    setCondicaoFilter,
    setLotacaoFilter,
    setFeriasPresencaFilter,
    setFeriasStatusFilter,
    setFeriasPeriodoFilter,
  } = setters;

  const {
    categoriaOptions,
    postosDisponiveis,
    statusDisponiveis,
    quadrosDisponiveis,
    situacoesMilitaresDisponiveis,
    funcoesDisponiveis,
    condicoesDisponiveis,
    lotacoesDisponiveis,
    feriasPresencaOptions,
    feriasPeriodoOptions,
    feriasStatusDisponiveis,
  } = options;

  const {
    selectedColumnsResumo,
    selectableColumns,
    selectedColumnIdsResolved,
    showColumnCustomizer,
    setShowColumnCustomizer,
    toggleSelectedColumn,
    resetSelectedColumns,
  } = columnState;

  const {
    todosValue,
    semLotacaoValue,
    categoriaTodasValue,
    feriasTodasPresencasValue,
    feriasTodosStatusValue,
  } = constants;

  const listagemTokens = useMemo(
    () =>
      buildListagemTokens({
        ...values,
        categoriaOptions,
        feriasPresencaOptions,
        feriasPeriodoOptions,
        lotacoesDisponiveis,
        todosValue,
        semLotacaoValue,
        categoriaTodasValue,
        feriasTodasPresencasValue,
        feriasTodosStatusValue,
      }),
    [
      values,
      categoriaOptions,
      feriasPresencaOptions,
      feriasPeriodoOptions,
      lotacoesDisponiveis,
      todosValue,
      semLotacaoValue,
      categoriaTodasValue,
      feriasTodasPresencasValue,
      feriasTodosStatusValue,
    ],
  );

  const resumoListagem = useMemo(
    () =>
      buildResumoListagem({
        categoriaFilter,
        postoFilters,
        quadroFilters,
        statusFilter,
        feriasPresencaFilter,
        feriasStatusFilter,
        feriasPeriodoFilter,
        categoriaOptions,
        feriasPeriodoOptions,
        todosValue,
        categoriaTodasValue,
        feriasTodosStatusValue,
      }),
    [
      categoriaFilter,
      postoFilters,
      quadroFilters,
      statusFilter,
      feriasPresencaFilter,
      feriasStatusFilter,
      feriasPeriodoFilter,
      categoriaOptions,
      feriasPeriodoOptions,
      todosValue,
      categoriaTodasValue,
      feriasTodosStatusValue,
    ],
  );

  const descricaoAcessivelListagem = listagemTokens.length
    ? `Resumo da listagem: ${resumoListagem} Critérios aplicados: ${listagemTokens.map((token) => token.displayValue).join(', ')}.`
    : `Resumo da listagem: ${resumoListagem} Sem filtros adicionais.`;

  return (
    <section className="rounded-3xl bg-[#1E293B] p-4 text-white shadow-2xl shadow-slate-900/20 md:p-6">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Montagem da listagem
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-7 text-slate-100 md:text-base">
              <p className="text-xl font-semibold leading-snug text-white md:text-2xl">{resumoListagem}</p>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Listagem atual</p>
                <div className="flex flex-wrap gap-2">
                  {listagemTokens.length
                    ? listagemTokens.map((token) => (
                      <span
                        key={token.key}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100"
                        title={`${token.label}: ${token.value}`}
                      >
                        {token.displayValue}
                      </span>
                    ))
                    : (
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                        Todos os militares disponíveis
                      </span>
                    )}
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Use os atalhos e os grupos abaixo para ajustar a listagem. O carregamento só começa ao montar a listagem.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 xl:max-w-md xl:justify-end">
            {quickPresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onQuickPreset(preset.id)}
                className="border-white/10 bg-white/10 text-slate-100 shadow-none hover:bg-white/15 hover:text-white"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {listagemTokens.length ? (
            listagemTokens.map((token) => (
              <span
                key={token.key}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100"
                title={`${token.label}: ${token.value}`}
              >
                {token.displayValue}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
              Sem filtros adicionais
            </span>
          )}
        </div>

        <div className="grid gap-3 border-y border-white/10 py-4 lg:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="border-white/10 bg-white/10 pl-9 text-white placeholder:text-slate-400 focus-visible:ring-cyan-300"
              placeholder="Buscar por nome, matrícula, quadro, função..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" onClick={onExecute} disabled={!isAccessResolved || isBusy}>
              {isBusy ? (
                <FileSearch className="h-4 w-4 animate-pulse" />
              ) : (
                <FileSearch className="h-4 w-4" />
              )}
              Montar listagem
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClear}
              disabled={isBusy}
              className="border-white/10 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white"
            >
              Limpar listagem
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ToolbarPopover icon={Briefcase} label="Carreira" contentClassName="w-[min(96vw,62rem)]">
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-slate-900">Carreira</p>
                <p className="text-sm text-slate-500">Use checklists reais para combinar postos/graduações e quadros compatíveis.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.2fr_1.2fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Categoria</p>
                  <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                    <SelectTrigger className="min-h-12 bg-white"><SelectValue placeholder="Grupo" /></SelectTrigger>
                    <SelectContent>
                      {categoriaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Oficiais e Praças reduzem imediatamente os postos e quadros disponíveis.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Postos/graduações</p>
                  <ChecklistMultiSelect
                    label="Postos e graduações"
                    triggerLabel={summarizePostos(postoFilters, postosDisponiveis)}
                    options={postosDisponiveis}
                    selectedValues={postoFilters}
                    onChange={setPostoFilters}
                    optionType="posto"
                    helperText="Selecione múltiplos postos/graduações compatíveis. Ao marcar Soldado, Cabo ou oficiais, a categoria é ajustada visualmente."
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Quadros</p>
                  <ChecklistMultiSelect
                    label="Quadros"
                    triggerLabel={summarizeQuadros(quadroFilters)}
                    options={quadrosDisponiveis}
                    selectedValues={quadroFilters}
                    onChange={setQuadroFilters}
                    optionType="quadro"
                    helperText="Marque múltiplos quadros. A lista mostra apenas quadros compatíveis com a categoria/postos atuais."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Situação</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Situação no cadastro" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={todosValue}>Todas as situações</SelectItem>
                      {statusDisponiveis.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={situacaoMilitarFilter} onValueChange={setSituacaoMilitarFilter}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Situação militar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={todosValue}>Todas as situações militares</SelectItem>
                      {situacoesMilitaresDisponiveis.map((situacao) => (
                        <SelectItem key={situacao} value={situacao}>{situacao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {compatibilityNotice && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                  {compatibilityNotice}
                </div>
              )}
            </div>
          </ToolbarPopover>

          <ToolbarPopover icon={UserRound} label="Pessoal">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-slate-900">Pessoal</p>
                <p className="text-sm text-slate-500">Função, condição e lotação disponíveis no seu acesso.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select value={funcaoFilter} onValueChange={setFuncaoFilter}>
                  <SelectTrigger><SelectValue placeholder="Função" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={todosValue}>Todas as funções</SelectItem>
                    {funcoesDisponiveis.map((funcao) => (
                      <SelectItem key={funcao} value={funcao}>{funcao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={condicaoFilter} onValueChange={setCondicaoFilter}>
                  <SelectTrigger><SelectValue placeholder="Condição" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={todosValue}>Todas as condições</SelectItem>
                    {condicoesDisponiveis.map((condicao) => (
                      <SelectItem key={condicao} value={condicao}>{condicao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {shouldShowLotacaoFilter && (
                  <div className="md:col-span-2">
                    <Select
                      value={lotacaoFilter}
                      onValueChange={setLotacaoFilter}
                      disabled={isLoadingLotacoes || isErrorLotacoes}
                    >
                      <SelectTrigger><SelectValue placeholder="Lotação" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={todosValue}>Todas as lotações disponíveis</SelectItem>
                        <SelectItem value={semLotacaoValue}>Sem lotação informada</SelectItem>
                        {lotacoesDisponiveis.map((lotacao) => (
                          <SelectItem key={lotacao.id} value={lotacao.id}>{lotacao.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {shouldShowLotacaoFilter && isErrorLotacoes && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  O filtro de lotação não pôde ser carregado com segurança pelo escopo atual. A listagem permanece disponível sem filtrar por lotação.
                  {lotacoesError?.message ? ` Detalhe: ${lotacoesError.message}` : ''}
                </div>
              )}
            </div>
          </ToolbarPopover>

          <ToolbarPopover icon={CalendarDays} label="Férias">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-slate-900">Férias</p>
                <p className="text-sm text-slate-500">Presença, período e situação de férias para a listagem.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Select value={feriasPresencaFilter} onValueChange={setFeriasPresencaFilter}>
                  <SelectTrigger><SelectValue placeholder="Férias no período" /></SelectTrigger>
                  <SelectContent>
                    {feriasPresencaOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={feriasPeriodoFilter} onValueChange={setFeriasPeriodoFilter}>
                  <SelectTrigger><SelectValue placeholder="Período de férias" /></SelectTrigger>
                  <SelectContent>
                    {feriasPeriodoOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={feriasStatusFilter} onValueChange={setFeriasStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Situação das férias" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={feriasTodosStatusValue}>Todas as situações de férias</SelectItem>
                    {feriasStatusDisponiveis.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ToolbarPopover>

          <ToolbarPopover icon={Columns3} label="Colunas" contentClassName="w-[min(92vw,56rem)]">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <ListChecks className="h-4 w-4" />
                    O que mostrar na tabela?
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{selectedColumnsResumo}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowColumnCustomizer((current) => !current)}
                  >
                    {showColumnCustomizer ? 'Concluir personalização' : 'Personalizar colunas'}
                  </Button>
                  {showColumnCustomizer && (
                    <Button type="button" variant="ghost" size="sm" onClick={resetSelectedColumns}>
                      Restaurar padrão
                    </Button>
                  )}
                </div>
              </div>

              {showColumnCustomizer && (
                <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {selectableColumns.map((column) => {
                    const isChecked = selectedColumnIdsResolved.has(column.id);
                    const isLocked = column.required === true;

                    return (
                      <label
                        key={column.id}
                        htmlFor={`coluna-${column.id}`}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 hover:border-blue-200 hover:bg-blue-50/40"
                      >
                        <Checkbox
                          id={`coluna-${column.id}`}
                          checked={isChecked}
                          disabled={isLocked}
                          onCheckedChange={(checked) => toggleSelectedColumn(column.id, checked === true)}
                          className="mt-0.5"
                        />
                        <span className="space-y-1">
                          <span className="block font-medium leading-none">{column.label}</span>
                          <span className="block text-xs text-slate-500">
                            {isLocked ? 'Obrigatória' : column.category || 'Campo comum'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </ToolbarPopover>
        </div>

        {filtersChangedAfterExecution && (
          <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-50">
            Os critérios foram alterados depois da última execução. Clique em Montar listagem para gerar um novo resultado com os parâmetros atuais.
          </div>
        )}

        <span className="sr-only">{descricaoAcessivelListagem}</span>
      </div>
    </section>
  );
}
