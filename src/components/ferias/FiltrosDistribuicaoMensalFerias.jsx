import React, { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import IconeCatalogo from '@/components/funcoes-tags/IconeCatalogo';
import MultiSelectFiltro from '@/components/militar/MultiSelectFiltro';

/**
 * Barra de filtros da visão "Distribuição por mês" do Plano de Férias.
 *
 * Reaproveita o mesmo multisseletor hierárquico da aba de lista para a lotação e
 * lista as tags de militar ativas (com o ícone da tag) para o recorte por perfil.
 */
export default function FiltrosDistribuicaoMensalFerias({
  lotacaoOptions = [],
  lotacaoGroupedOptions = null,
  filtroLotacao = [],
  onFiltroLotacao,
  tags = [],
  filtroTags = [],
  onFiltroTags,
  exibidos = 0,
  total = 0,
}) {
  const tagOptions = useMemo(() => tags.map((tag) => ({
    value: String(tag.id),
    label: tag.nome || 'Tag',
    labelText: tag.nome || 'Tag',
    searchText: `${tag.nome || ''} ${tag.descricao || ''}`,
    icon: <IconeCatalogo value={tag.emoji || tag.icone} />,
  })), [tags]);

  const temFiltro = filtroLotacao.length > 0 || filtroTags.length > 0;

  const limpar = () => {
    onFiltroLotacao?.([]);
    onFiltroTags?.([]);
  };

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 xl:max-w-[660px]">
          <MultiSelectFiltro
            placeholder="Todas as lotações"
            options={lotacaoOptions}
            groupedOptions={lotacaoGroupedOptions}
            value={filtroLotacao}
            onChange={onFiltroLotacao}
            groupSearchPlaceholder="Buscar lotação..."
            triggerClassName="h-10 w-full bg-white border-slate-200"
          />
          <MultiSelectFiltro
            placeholder="Todas as tags"
            options={tagOptions}
            value={filtroTags}
            onChange={onFiltroTags}
            popoverClassName="min-w-72"
            triggerClassName="h-10 w-full bg-white border-slate-200"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:ml-auto">
          <span className="text-xs font-medium text-slate-500">
            <strong className="text-slate-700">{exibidos}</strong> de {total} militares no recorte
          </span>
          {temFiltro && (
            <Button
              type="button"
              variant="outline"
              onClick={limpar}
              className="h-10 border-slate-300 font-semibold text-slate-700"
            >
              <X className="w-4 h-4 mr-2" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}