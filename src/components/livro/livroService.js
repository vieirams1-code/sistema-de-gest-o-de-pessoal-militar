import { base44 } from '@/api/base44Client';
import { getTextoPublicacaoRegistro, mapLivroRegistrosPresenter } from '@/components/livro/livroRegistrosMapper';
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
    const [registros, militares, ferias] = await Promise.all([
      base44.entities.RegistroLivro.list('-created_date'),
      base44.entities.Militar.list(),
      base44.entities.Ferias.list(),
    ]);
    return mapLivroRegistrosPresenter({ registros, militares, ferias, periodos: [] });
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

  const [registrosArrays, feriasArrays] = await Promise.all([
    Promise.all(militarIds.map((id) => base44.entities.RegistroLivro.filter({ militar_id: id }, '-created_date'))),
    Promise.all(militarIds.map((id) => base44.entities.Ferias.filter({ militar_id: id }))),
  ]);

  const registros = sortByCreatedDateDesc(deduplicateById(registrosArrays));
  const ferias = deduplicateById(feriasArrays);

  return mapLivroRegistrosPresenter({
    registros,
    militares,
    ferias,
    periodos: [],
  });
}

export async function getLivroTextoPublicacaoRegistro({ registroId } = {}) {
  if (!registroId) return { texto_publicacao: '' };

  const registros = await base44.entities.RegistroLivro.filter({ id: registroId });
  const registro = registros?.[0];
  if (!registro) return { texto_publicacao: '' };
  if (registro?.texto_publicacao) return { texto_publicacao: registro.texto_publicacao, congelado: true };

  const [militares, ferias, templates] = await Promise.all([
    registro?.militar_id ? base44.entities.Militar.filter({ id: registro.militar_id }) : Promise.resolve([]),
    registro?.ferias_id ? base44.entities.Ferias.filter({ id: registro.ferias_id }) : Promise.resolve([]),
    base44.entities.TemplateTexto.filter({ ativo: true, modulo: 'Livro' }),
  ]);

  const feriasRegistro = ferias?.[0] || null;
  const periodoAquisitivoId = registro?.periodo_aquisitivo_id || feriasRegistro?.periodo_aquisitivo_id;
  const periodos = periodoAquisitivoId
    ? await base44.entities.PeriodoAquisitivo.filter({ id: periodoAquisitivoId })
    : [];

  return {
    texto_publicacao: getTextoPublicacaoRegistro({
      registro,
      ferias: feriasRegistro,
      periodo: periodos?.[0] || null,
      militar: militares?.[0] || null,
      templatesAtivosLivro: (templates || []).filter((template) => template?.ativo !== false),
    }),
    congelado: false,
  };
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
