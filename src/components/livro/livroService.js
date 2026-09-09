import { base44 } from '@/api/base44Client';
import { getTextoPublicacaoRegistro, mapLivroRegistrosPresenter } from '@/components/livro/livroRegistrosMapper';
import { mapLivroRegistrosMetricasRP } from '@/components/livro/livroMetricasMapper';
import { TEMPLATE_EDIT_MODE, TEMPLATE_SOURCE_OF_TRUTH } from '@/constants/templateGovernance';
import { fetchScopedFeriasBundle } from '@/services/getScopedFeriasBundleClient';
import { fetchScopedPublicacoesBundle } from '@/services/getScopedPublicacoesBundleClient';

// GOVERNANÇA TEMPLATE (Livro persistido):
// source_of_truth = persistido
// edit_mode = imutavel
export const LIVRO_PERSISTIDO_TEMPLATE_GOVERNANCA = {
  source_of_truth: TEMPLATE_SOURCE_OF_TRUTH.PERSISTIDO,
  edit_mode: TEMPLATE_EDIT_MODE.IMUTAVEL,
};

function emptyLivroPresenterContrato() {
  return mapLivroRegistrosPresenter({ registros: [], militares: [], ferias: [], periodos: [] });
}

function emptyLivroMetricasRPContrato() {
  return mapLivroRegistrosMetricasRP({ registros: [] });
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
export async function getLivroRegistrosContrato() {
  const bundle = await fetchScopedPublicacoesBundle({ purpose: 'CONTROL' });
  const registros = bundle?.registrosLivro || [];
  if (!registros.length) return emptyLivroPresenterContrato();
  return mapLivroRegistrosPresenter({
    registros,
    militares: bundle?.militares || [],
    ferias: [],
    periodos: [],
  });
}

export async function getLivroTextoPublicacaoRegistro({ registroId } = {}) {
  if (!registroId) return { texto_publicacao: '' };

  const publicacoesBundle = await fetchScopedPublicacoesBundle({ purpose: 'CONTROL', registroLivroId: registroId });
  const registro = publicacoesBundle?.registrosLivro?.[0];
  if (!registro) return { texto_publicacao: '' };
  if (registro?.texto_publicacao) return { texto_publicacao: registro.texto_publicacao, congelado: true };

  const [feriasBundle, templates] = await Promise.all([
    registro?.ferias_id
      ? fetchScopedFeriasBundle({ supportPurpose: 'PUBLICACOES', feriasId: registro.ferias_id })
      : Promise.resolve({ ferias: [], periodosAquisitivos: [] }),
    base44.entities.TemplateTexto.filter({ ativo: true, modulo: 'Livro' }),
  ]);
  const militares = publicacoesBundle?.militares || [];

  const feriasRegistro = feriasBundle?.ferias?.[0] || null;
  const periodos = feriasBundle?.periodosAquisitivos || [];

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
export async function getLivroMetricasRPContrato() {
  const bundle = await fetchScopedPublicacoesBundle({ purpose: 'RP' });
  const registros = bundle?.registrosLivro || [];
  if (!registros.length) return emptyLivroMetricasRPContrato();
  return mapLivroRegistrosMetricasRP({ registros });
}
