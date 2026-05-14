import { base44 } from '@/api/base44Client';
import { mapLivroRegistrosPresenter } from '@/components/livro/livroRegistrosMapper';
import { mapLivroRegistrosMetricasRP } from '@/components/livro/livroMetricasMapper';

function emptyLivroPresenterContrato() {
  return mapLivroRegistrosPresenter({ registros: [], militares: [], ferias: [], periodos: [] });
}

function emptyLivroMetricasRPContrato() {
  return mapLivroRegistrosMetricasRP({ registros: [] });
}

function deduplicateById(arrays) {
  const map = new Map();
  arrays.flat().forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function sortByCreatedDateDesc(items = []) {
  return [...items].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
}

async function listarMilitarIdsLivroPorEscopo({ getMilitarScopeFilters } = {}) {
  const scopeFilters = getMilitarScopeFilters?.();
  if (!scopeFilters || !scopeFilters.length) return [];

  const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
  return [...new Set(militarQueries.flat().map((m) => m.id).filter(Boolean))];
}

/**
 * Carrega todos os registros do livro para montar a visão de publicações.
 *
 * NOTA DE SEGURANÇA: Esta função é chamada somente quando o módulo 'publicacoes'
 * está autorizado (enabled: isAccessResolved && hasPublicacoesAccess em Publicacoes.jsx).
 * A filtragem por escopo organizacional ocorre no nível do chamador (queries de
 * publicacoesExOfficio e atestados em Publicacoes.jsx). RegistroLivro não possui
 * campo de escopo padronizado, portanto a consulta ampla é necessária aqui — o
 * acesso já foi validado pela camada de módulo antes de invocar esta função.
 */
export async function getLivroRegistrosContrato({ isAdmin, getMilitarScopeFilters } = {}) {
  if (!isAdmin && !getMilitarScopeFilters) {
    return emptyLivroPresenterContrato();
  }

  if (isAdmin) {
    const [registros, militares, ferias, periodos, templates] = await Promise.all([
      base44.entities.RegistroLivro.list('-created_date'),
      base44.entities.Militar.list(),
      base44.entities.Ferias.list(),
      base44.entities.PeriodoAquisitivo.list(),
      base44.entities.TemplateTexto.filter({ ativo: true, modulo: 'Livro' }),
    ]);
    return mapLivroRegistrosPresenter({ registros, militares, ferias, periodos, templates });
  }

  const scopeFilters = getMilitarScopeFilters();
  if (!scopeFilters || !scopeFilters.length) {
    return emptyLivroPresenterContrato();
  }

  const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
  const militares = militarQueries.flat();
  const militarIds = [...new Set(militares.map((m) => m.id).filter(Boolean))];

  if (!militarIds.length) {
    return emptyLivroPresenterContrato();
  }

  const [registrosArrays, feriasArrays, periodosArrays, templates] = await Promise.all([
    Promise.all(militarIds.map((id) => base44.entities.RegistroLivro.filter({ militar_id: id }, '-created_date'))),
    Promise.all(militarIds.map((id) => base44.entities.Ferias.filter({ militar_id: id }))),
    Promise.all(militarIds.map((id) => base44.entities.PeriodoAquisitivo.filter({ militar_id: id }))),
    base44.entities.TemplateTexto.filter({ ativo: true, modulo: 'Livro' }),
  ]);

  const registros = sortByCreatedDateDesc(deduplicateById(registrosArrays));
  const ferias = deduplicateById(feriasArrays);
  const periodos = deduplicateById(periodosArrays);

  return mapLivroRegistrosPresenter({
    registros,
    militares,
    ferias,
    periodos,
    templates,
  });
}

/**
 * Carrega o contrato reduzido de métricas do Livro para o painel RP.
 *
 * Este caminho evita o bundle operacional de Publicações: não busca férias,
 * períodos aquisitivos, templates ativos do Livro nem executa o mapper que
 * monta vínculos, cadeia de eventos completa e texto_publicacao renderizado.
 */
export async function getLivroMetricasRPContrato({ isAdmin, getMilitarScopeFilters } = {}) {
  if (!isAdmin && !getMilitarScopeFilters) {
    return emptyLivroMetricasRPContrato();
  }

  if (isAdmin) {
    const registros = await base44.entities.RegistroLivro.list('-created_date');
    return mapLivroRegistrosMetricasRP({ registros });
  }

  const militarIds = await listarMilitarIdsLivroPorEscopo({ getMilitarScopeFilters });
  if (!militarIds.length) {
    return emptyLivroMetricasRPContrato();
  }

  const registrosArrays = await Promise.all(
    militarIds.map((id) => base44.entities.RegistroLivro.filter({ militar_id: id }, '-created_date'))
  );
  const registros = sortByCreatedDateDesc(deduplicateById(registrosArrays));

  return mapLivroRegistrosMetricasRP({ registros });
}
