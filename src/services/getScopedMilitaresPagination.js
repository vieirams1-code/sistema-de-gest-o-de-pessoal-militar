const FETCH_ALL_PAGE_LIMIT = 100;
const FETCH_ALL_MAX_PAGES = 1000;

function getMilitarKey(militar) {
  const id = String(militar?.id || '').trim();
  return id || null;
}

/**
 * Carrega todas as páginas de militares escopados sem alterar o contrato
 * paginado do backend. O invokePage deve devolver { militares, meta }.
 */
export async function fetchAllScopedMilitaresPages(payload, invokePage) {
  const initialOffset = Number.isFinite(Number(payload?.offset)) && Number(payload.offset) >= 0
    ? Number(payload.offset)
    : 0;
  const pageLimit = Number.isFinite(Number(payload?.limit)) && Number(payload.limit) > 0
    ? Number(payload.limit)
    : FETCH_ALL_PAGE_LIMIT;
  const pagePayload = { ...payload, limit: pageLimit };
  delete pagePayload.fetchAll;

  const militares = [];
  const militarIds = new Set();
  let offset = initialOffset;
  let lastMeta = {};
  let pagesFetched = 0;

  while (pagesFetched < FETCH_ALL_MAX_PAGES) {
    const page = await invokePage({ ...pagePayload, offset });
    const pageMilitares = Array.isArray(page?.militares) ? page.militares : [];
    lastMeta = page?.meta || {};
    pagesFetched += 1;

    pageMilitares.forEach((militar) => {
      const key = getMilitarKey(militar);
      if (!key || !militarIds.has(key)) {
        militares.push(militar);
        if (key) militarIds.add(key);
      }
    });

    if (!lastMeta.hasMore) {
      return {
        militares,
        meta: {
          ...lastMeta,
          returned: militares.length,
          offset: initialOffset,
          hasMore: false,
          pagesFetched,
        },
      };
    }

    if (pageMilitares.length === 0) {
      throw new Error('getScopedMilitares informou hasMore sem retornar militares na página atual.');
    }

    offset += pageMilitares.length;
  }

  throw new Error(`getScopedMilitares excedeu o limite de segurança de ${FETCH_ALL_MAX_PAGES} páginas.`);
}
