import React, { useMemo } from 'react';
import { Briefcase, CalendarDays, Columns3, FileSearch, ListChecks, Search, SlidersHorizontal, UserRound } from 'lucide-react';

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

function buildResumoListagem({
  categoriaFilter,
  postoFilter,
  quadroFilter,
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
  const posto = postoFilter !== todosValue ? postoFilter : '';
  const categoria = findLabel(categoriaOptions, categoriaFilter);
  const selectedFeriasPeriodoLabel = findLabel(feriasPeriodoOptions, feriasPeriodoFilter).toLowerCase();

  if (posto) {
    partes.push(pluralizePosto(posto));
  } else if (categoriaFilter !== categoriaTodasValue && categoria) {
    partes.push(categoria);
  } else {
    partes.push('militares');
  }

  if (statusFilter !== todosValue) partes.push(`${String(statusFilter).toLowerCase()}s`);
  if (quadroFilter !== todosValue) partes.push(`do quadro ${quadroFilter}`);
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

  return `Listar ${partes.join(' ')}.`;
}

function buildCommandTokens({
  searchTerm,
  categoriaFilter,
  postoFilter,
  quadroFilter,
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

  if (trimmedSearch) tokens.push({ key: 'busca', label: 'busca', value: trimmedSearch });
  if (categoriaFilter !== categoriaTodasValue) {
    tokens.push({ key: 'categoria', label: 'grupo', value: findLabel(categoriaOptions, categoriaFilter) });
  }
  if (postoFilter !== todosValue) tokens.push({ key: 'posto', label: 'posto', value: postoFilter });
  if (quadroFilter !== todosValue) tokens.push({ key: 'quadro', label: 'quadro', value: quadroFilter });
  if (statusFilter !== todosValue) tokens.push({ key: 'status', label: 'situação', value: statusFilter });
  if (situacaoMilitarFilter !== todosValue) {
    tokens.push({ key: 'situacaoMilitar', label: 'condição militar', value: situacaoMilitarFilter });
  }
  if (funcaoFilter !== todosValue) tokens.push({ key: 'funcao', label: 'função', value: funcaoFilter });
  if (condicaoFilter !== todosValue) tokens.push({ key: 'condicao', label: 'condição', value: condicaoFilter });

  const lotacaoLabel = getLotacaoLabel({ lotacaoFilter, lotacoesDisponiveis, todosValue, semLotacaoValue });
  if (lotacaoLabel) tokens.push({ key: 'lotacao', label: 'lotação', value: lotacaoLabel });

  if (feriasPresencaFilter !== feriasTodasPresencasValue) {
    tokens.push({ key: 'ferias', label: 'férias', value: findLabel(feriasPresencaOptions, feriasPresencaFilter) });
  }
  if (feriasPeriodoFilter) {
    tokens.push({ key: 'periodoFerias', label: 'período', value: findLabel(feriasPeriodoOptions, feriasPeriodoFilter) });
  }
  if (feriasStatusFilter !== feriasTodosStatusValue) {
    tokens.push({ key: 'statusFerias', label: 'situação férias', value: feriasStatusFilter });
  }

  return tokens.filter((token) => token.value);
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
    postoFilter,
    quadroFilter,
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
    setPostoFilter,
    setQuadroFilter,
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

  const commandTokens = useMemo(
    () =>
      buildCommandTokens({
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
        postoFilter,
        quadroFilter,
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
      postoFilter,
      quadroFilter,
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

  const commandPhrase = commandTokens.length
    ? `SELECT militares WHERE ${commandTokens.map((token) => `${token.label}="${token.value}"`).join(' AND ')}`
    : 'SELECT militares WHERE escopo="disponível"';

  return (
    <section className="rounded-3xl bg-[#1E293B] p-4 text-white shadow-2xl shadow-slate-900/20 md:p-6">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Command Center
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 font-mono text-sm leading-7 text-slate-100 md:text-base">
              <span className="text-cyan-300">SELECT</span>{' '}
              <span className="text-white">militares</span>{' '}
              <span className="text-cyan-300">WHERE</span>{' '}
              <span className="break-words text-slate-200">
                {commandTokens.length
                  ? commandTokens.map((token, index) => (
                    <React.Fragment key={token.key}>
                      {index > 0 && <span className="text-cyan-300"> AND </span>}
                      <span>{token.label}=</span>
                      <span className="text-emerald-300">&quot;{token.value}&quot;</span>
                    </React.Fragment>
                  ))
                  : <span>escopo=<span className="text-emerald-300">&quot;disponível&quot;</span></span>}
              </span>
            </div>
            <p className="text-lg font-semibold text-white">{resumoListagem}</p>
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
          {commandTokens.length ? (
            commandTokens.map((token) => (
              <span
                key={token.key}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100"
              >
                <span className="text-slate-300">{token.label}</span> {token.value}
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
          <ToolbarPopover icon={Briefcase} label="Carreira">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-slate-900">Carreira</p>
                <p className="text-sm text-slate-500">Grupo, posto, quadro e situação do militar.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                  <SelectTrigger><SelectValue placeholder="Grupo" /></SelectTrigger>
                  <SelectContent>
                    {categoriaOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={postoFilter} onValueChange={setPostoFilter}>
                  <SelectTrigger><SelectValue placeholder="Posto/graduação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={todosValue}>Todos os postos</SelectItem>
                    {postosDisponiveis.map((posto) => (
                      <SelectItem key={posto} value={posto}>{posto}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={quadroFilter} onValueChange={setQuadroFilter}>
                  <SelectTrigger><SelectValue placeholder="Quadro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={todosValue}>Todos os quadros</SelectItem>
                    {quadrosDisponiveis.map((quadro) => (
                      <SelectItem key={quadro} value={quadro}>{quadro}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Situação no cadastro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={todosValue}>Todas as situações</SelectItem>
                    {statusDisponiveis.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={situacaoMilitarFilter} onValueChange={setSituacaoMilitarFilter}>
                  <SelectTrigger><SelectValue placeholder="Situação militar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={todosValue}>Todas as situações militares</SelectItem>
                    {situacoesMilitaresDisponiveis.map((situacao) => (
                      <SelectItem key={situacao} value={situacao}>{situacao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

        <span className="sr-only">{commandPhrase}</span>
      </div>
    </section>
  );
}
