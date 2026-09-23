import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';

// Grupos exibidos no filtro, na ordem hierárquica da estrutura organizacional.
const GRUPOS = [
  { id: 'Grupamento', label: 'Setores' },
  { id: 'Subgrupamento', label: 'Subsetores' },
  { id: 'Unidade', label: 'Unidades' },
];

const rotuloLotacao = (lotacao) => (
  lotacao?.sigla ? `${lotacao.nome} (${lotacao.sigla})` : (lotacao?.nome || lotacao?.id || '')
);

/**
 * Filtro por lotação do Painel Plano de Férias.
 *
 * Carrega as lotações do escopo do usuário (getScopedLotacoes) e devolve as
 * opções do MultiSelectFiltro, além do conjunto de IDs selecionados já
 * expandido com os descendentes — ao escolher um setor, as unidades abaixo
 * dele entram no filtro automaticamente.
 */
export default function useLotacaoFiltro(selecionadas, userEmail) {
  const query = useQuery({
    queryKey: ['lotacoes-escopo-ferias', userEmail],
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { lotacoes, lotacoesTree } = await fetchScopedLotacoes({});
      return { lotacoes, lotacoesTree };
    },
  });

  const lotacoes = query.data?.lotacoes || [];
  const lotacoesTree = query.data?.lotacoesTree || [];

  const grupos = useMemo(() => GRUPOS.map(({ id, label }) => {
    const options = lotacoes
      .filter((lotacao) => String(lotacao?.tipo || '') === id)
      .map((lotacao) => ({
        value: String(lotacao.id),
        label: rotuloLotacao(lotacao),
        labelText: rotuloLotacao(lotacao),
        searchText: `${lotacao?.nome || ''} ${lotacao?.sigla || ''}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return { id, label, title: label, count: options.length, options };
  }).filter((grupo) => grupo.count > 0), [lotacoes]);

  const options = useMemo(() => grupos.flatMap((grupo) => grupo.options), [grupos]);

  const idsSelecionados = useMemo(() => {
    if (!selecionadas.length) return null;

    const porId = new Map();
    const indexar = (nos) => (nos || []).forEach((no) => {
      porId.set(String(no.id), no);
      indexar(no.children);
    });
    indexar(lotacoesTree);

    const ids = new Set(selecionadas.map(String));
    const incluirDescendentes = (no) => (no.children || []).forEach((filho) => {
      const id = String(filho.id);
      if (ids.has(id)) return;
      ids.add(id);
      incluirDescendentes(filho);
    });
    selecionadas.forEach((id) => {
      const no = porId.get(String(id));
      if (no) incluirDescendentes(no);
    });

    return ids;
  }, [selecionadas, lotacoesTree]);

  return {
    options,
    groupedOptions: { groups: grupos },
    carregando: query.isLoading,
    idsSelecionados,
  };
}