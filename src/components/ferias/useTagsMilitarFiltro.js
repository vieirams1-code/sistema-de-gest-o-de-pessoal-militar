import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { isRegistroAtivo } from '@/utils/funcoesTags/contratoCampos';
import { APLICABILIDADE_TAG_MILITAR } from '@/utils/funcoesTags/militarTags';

const TAMANHO_PAGINA = 500;

/**
 * Tags de militar ativas (catálogo aplicável ao efetivo) e os militares vinculados
 * a cada uma. Alimenta o filtro por tags da Distribuição por mês do Plano de Férias.
 *
 * O carregamento é opcional (enabled) para não custar consultas a quem nunca abre
 * a visão de distribuição.
 */
export default function useTagsMilitarFiltro(tagsSelecionadas = [], enabled = true) {
  const [estado, setEstado] = useState({ tags: [], idsPorTag: new Map(), carregando: false });

  useEffect(() => {
    if (!enabled) return undefined;

    let ativo = true;
    setEstado((prev) => ({ ...prev, carregando: true }));

    const carregar = async () => {
      try {
        const catalogo = await base44.entities.Tag.list('nome', 500);
        const tags = (catalogo || [])
          .filter((tag) => isRegistroAtivo(tag)
            && APLICABILIDADE_TAG_MILITAR.has(String(tag?.aplicabilidade || '').trim().toLowerCase()))
          .sort((a, b) => Number(a?.ordem_exibicao || 0) - Number(b?.ordem_exibicao || 0)
            || String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR'));

        const entradas = await Promise.all(tags.map(async (tag) => {
          const vinculos = [];
          for (let skip = 0; ; skip += TAMANHO_PAGINA) {
            const pagina = await base44.entities.MilitarTag.filter(
              { tag_id: tag.id, status: 'ativa' },
              'id',
              TAMANHO_PAGINA,
              skip,
            );
            vinculos.push(...pagina);
            if (pagina.length < TAMANHO_PAGINA) break;
          }
          const ids = new Set(vinculos.map((v) => String(v.militar_id || '')).filter(Boolean));
          return [String(tag.id), ids];
        }));

        if (!ativo) return;
        setEstado({ tags, idsPorTag: new Map(entradas), carregando: false });
      } catch (_err) {
        // O filtro é auxiliar: uma falha aqui não pode impedir a distribuição.
        if (!ativo) return;
        setEstado({ tags: [], idsPorTag: new Map(), carregando: false });
      }
    };

    carregar();
    return () => { ativo = false; };
  }, [enabled]);

  // União dos militares de todas as tags escolhidas (basta pertencer a uma delas).
  const idsSelecionados = useMemo(() => {
    if (!tagsSelecionadas.length) return null;
    const ids = new Set();
    tagsSelecionadas.forEach((tagId) => {
      const vinculados = estado.idsPorTag.get(String(tagId));
      if (vinculados) vinculados.forEach((id) => ids.add(id));
    });
    return ids;
  }, [tagsSelecionadas, estado.idsPorTag]);

  return {
    tags: estado.tags,
    carregando: estado.carregando,
    idsSelecionados,
  };
}