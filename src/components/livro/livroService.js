import { base44 } from '@/api/base44Client';
import { mapLivroRegistrosPresenter } from '@/components/livro/livroRegistrosMapper';

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
    return mapLivroRegistrosPresenter({ registros: [], militares: [], ferias: [], periodos: [] });
  }

  if (isAdmin) {
    const [registros, militares, ferias, periodos] = await Promise.all([
      base44.entities.RegistroLivro.list('-created_date'),
      base44.entities.Militar.list(),
      base44.entities.Ferias.list(),
      base44.entities.PeriodoAquisitivo.list(),
    ]);
    return mapLivroRegistrosPresenter({ registros, militares, ferias, periodos });
  }

  const scopeFilters = getMilitarScopeFilters();
  if (!scopeFilters || !scopeFilters.length) {
    return mapLivroRegistrosPresenter({ registros: [], militares: [], ferias: [], periodos: [] });
  }

  const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
  const militares = militarQueries.flat();
  const militarIds = [...new Set(militares.map((m) => m.id).filter(Boolean))];

  if (!militarIds.length) {
    return mapLivroRegistrosPresenter({ registros: [], militares: [], ferias: [], periodos: [] });
  }

  const [registrosArrays, feriasArrays, periodosArrays] = await Promise.all([
    Promise.all(militarIds.map((id) => base44.entities.RegistroLivro.filter({ militar_id: id }, '-created_date'))),
    Promise.all(militarIds.map((id) => base44.entities.Ferias.filter({ militar_id: id }))),
    Promise.all(militarIds.map((id) => base44.entities.PeriodoAquisitivo.filter({ militar_id: id }))),
  ]);

  const deduplicate = (arrays) => {
    const map = new Map();
    arrays.flat().forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  };

  const registros = deduplicate(registrosArrays).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  const ferias = deduplicate(feriasArrays);
  const periodos = deduplicate(periodosArrays);

  return mapLivroRegistrosPresenter({
    registros,
    militares,
    ferias,
    periodos,
  });
}
