import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clipboard,
  Database,
  FileSearch,
  MoreHorizontal,
  RefreshCw,
  SearchX,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import MilitarAvatar from '@/pages/extracaoEfetivo/components/MilitarAvatar';
import StatusBadge from '@/pages/extracaoEfetivo/components/StatusBadge';

function getRowKey(militar = {}, getValorCampoEfetivo) {
  return (
    militar.id ||
    `${militar.nome_completo}-${getValorCampoEfetivo(militar, 'matricula')}`
  );
}

function isIdentificationColumn(column, selectedColumns) {
  if (column.id === 'nome_guerra') return true;

  const hasNomeGuerra = selectedColumns.some((selectedColumn) => selectedColumn.id === 'nome_guerra');
  return column.id === 'nome_completo' && !hasNomeGuerra;
}

function copyText(value) {
  const text = String(value || '').trim();
  if (!text || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;

  navigator.clipboard.writeText(text);
}

export default function ExtractionDataGrid({
  hasExecutedExtraction,
  isAccessResolved,
  isInitialPageBusy,
  isError,
  isRateLimitError,
  militaresError,
  selectedColumns,
  sortedMilitares,
  sortConfig,
  toggleSort,
  getSortIcon,
  getValorCampoEfetivo,
  textoOuTraco,
  totalRetornado,
  totalFiltrado,
  hasMoreMilitares,
  isLoadingMore,
  isLoadingMilitares,
  loadMoreMilitares,
  onRetry,
}) {
  const [selectedRowKeys, setSelectedRowKeys] = useState(() => new Set());

  const rowKeys = useMemo(
    () => sortedMilitares.map((militar) => getRowKey(militar, getValorCampoEfetivo)),
    [getValorCampoEfetivo, sortedMilitares],
  );
  const selectedVisibleCount = rowKeys.filter((rowKey) => selectedRowKeys.has(rowKey)).length;
  const allVisibleSelected = rowKeys.length > 0 && selectedVisibleCount === rowKeys.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const toggleRowSelection = (rowKey, checked) => {
    setSelectedRowKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (checked) {
        nextKeys.add(rowKey);
      } else {
        nextKeys.delete(rowKey);
      }

      return nextKeys;
    });
  };

  const toggleVisibleRows = (checked) => {
    setSelectedRowKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      rowKeys.forEach((rowKey) => {
        if (checked) {
          nextKeys.add(rowKey);
        } else {
          nextKeys.delete(rowKey);
        }
      });

      return nextKeys;
    });
  };

  const renderValue = (militar, column) => {
    const value = getValorCampoEfetivo(militar, column.id);

    if (column.renderAs === 'statusBadge') {
      return (
        <StatusBadge status={value || 'Ativo'}>
          {textoOuTraco(value || 'Ativo')}
        </StatusBadge>
      );
    }

    if (isIdentificationColumn(column, selectedColumns)) {
      const nomeCompleto = getValorCampoEfetivo(militar, 'nome_completo');
      const nomeGuerra = getValorCampoEfetivo(militar, 'nome_guerra');

      return (
        <div className="flex min-w-64 items-center gap-3">
          <MilitarAvatar nome={nomeCompleto || nomeGuerra} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">
              {textoOuTraco(nomeGuerra || nomeCompleto || value)}
            </p>
            <p className="truncate text-xs text-slate-500">
              {textoOuTraco(nomeCompleto && nomeCompleto !== nomeGuerra ? nomeCompleto : value)}
            </p>
          </div>
        </div>
      );
    }

    return textoOuTraco(value);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-slate-100 p-2.5 text-[#1e3a5f]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Resultado da listagem</h2>
            <p className="text-sm text-slate-500">
              {hasExecutedExtraction
                ? `${totalFiltrado} registro${totalFiltrado === 1 ? '' : 's'} na listagem de ${totalRetornado} carregado${totalRetornado === 1 ? '' : 's'}.`
                : 'Nenhum registro carregado. Monte uma listagem para visualizar o efetivo.'}
            </p>
          </div>
        </div>
        {hasExecutedExtraction && sortedMilitares.length > 0 && (
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {hasMoreMilitares ? 'Resultado parcial' : 'Resultado completo'}
          </div>
        )}
      </div>

      {!isAccessResolved ? (
        <div className="p-12 text-center text-sm text-slate-500">
          Resolvendo contexto de acesso para liberar a listagem.
        </div>
      ) : !hasExecutedExtraction ? (
        <div className="p-12 text-center">
          <FileSearch className="mx-auto mb-4 h-14 w-14 text-slate-300" />
          <h3 className="mb-2 text-lg font-semibold text-slate-700">
            Configure os critérios e clique em Montar listagem.
          </h3>
          <p className="text-sm text-slate-500">
            Nenhum militar será carregado até a listagem ser montada manualmente.
          </p>
        </div>
      ) : isInitialPageBusy ? (
        <div className="p-12 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#1e3a5f]" />
          <p className="text-slate-600">Carregando listagem...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col gap-4 bg-amber-50 p-6 text-amber-900 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Não foi possível carregar a listagem.</p>
              <p className="text-sm">
                {isRateLimitError
                  ? 'Limite de requisições excedido. Aguarde alguns instantes e tente novamente.'
                  : militaresError?.message || 'Ocorreu uma falha ao consultar o efetivo disponível para seu acesso.'}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      ) : sortedMilitares.length === 0 ? (
        <div className="p-12 text-center">
          <SearchX className="mx-auto mb-4 h-14 w-14 text-slate-300" />
          <h3 className="mb-2 text-lg font-semibold text-slate-700">
            Nenhum registro encontrado
          </h3>
          <p className="text-sm text-slate-500">
            Ajuste os filtros ou verifique se há militares ativos no seu escopo.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-xs text-slate-600">
            Exibindo {totalFiltrado} registro{totalFiltrado === 1 ? '' : 's'} na listagem,
            de {totalRetornado} registro{totalRetornado === 1 ? '' : 's'} carregado
            {totalRetornado === 1 ? '' : 's'}. O resultado está{' '}
            {hasMoreMilitares ? 'parcial' : 'completo'}.
            {selectedVisibleCount > 0
              ? ` ${selectedVisibleCount} linha${selectedVisibleCount === 1 ? '' : 's'} selecionada${selectedVisibleCount === 1 ? '' : 's'} visualmente.`
              : ''}
          </div>
          <Table>
            <TableHeader className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <TableRow className="hover:bg-slate-50">
                <TableHead className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allVisibleSelected || (someVisibleSelected && 'indeterminate')}
                    onCheckedChange={(checked) => toggleVisibleRows(checked === true)}
                    aria-label="Selecionar linhas visíveis apenas visualmente"
                  />
                </TableHead>
                {selectedColumns.map((column) => {
                  const isSortable = column.sortable === true;
                  const isActiveSort = sortConfig.fieldId === column.id;

                  return (
                    <TableHead key={column.id} className="px-4 py-3 text-left font-semibold">
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md text-left hover:text-[#1e3a5f]',
                            isActiveSort && 'text-[#1e3a5f]',
                          )}
                          title="Ordenar localmente o resultado carregado"
                        >
                          <span>{column.label}</span>
                          {getSortIcon(column.id)}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  );
                })}
                <TableHead className="w-14 px-4 py-3 text-right font-semibold">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {sortedMilitares.map((militar) => {
                const rowKey = getRowKey(militar, getValorCampoEfetivo);
                const matricula = getValorCampoEfetivo(militar, 'matricula');
                const nome = getValorCampoEfetivo(militar, 'nome_completo') || getValorCampoEfetivo(militar, 'nome_guerra');

                return (
                  <TableRow key={rowKey} className="hover:bg-slate-50/80">
                    <TableCell className="px-4 py-3">
                      <Checkbox
                        checked={selectedRowKeys.has(rowKey)}
                        onCheckedChange={(checked) => toggleRowSelection(rowKey, checked === true)}
                        aria-label="Selecionar linha apenas visualmente"
                      />
                    </TableCell>
                    {selectedColumns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn('px-4 py-3', column.cellClassName)}
                      >
                        {renderValue(militar, column)}
                      </TableCell>
                    ))}
                    <TableCell className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Abrir ações passivas da linha">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Ações passivas</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => copyText(matricula)} disabled={!String(matricula || '').trim()}>
                            <Clipboard className="h-4 w-4" />
                            Copiar matrícula
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => copyText(nome)} disabled={!String(nome || '').trim()}>
                            <Clipboard className="h-4 w-4" />
                            Copiar nome
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {hasMoreMilitares
                ? 'Há mais registros disponíveis para carregar neste resultado parcial.'
                : 'Não há mais registros a carregar para a consulta executada.'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={loadMoreMilitares}
              disabled={!hasMoreMilitares || isLoadingMore || isLoadingMilitares}
            >
              {isLoadingMore ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {isLoadingMore ? 'Carregando...' : 'Carregar mais'}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
