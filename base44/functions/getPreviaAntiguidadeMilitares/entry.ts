import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =====================================================================
// getPreviaAntiguidadeMilitares
// ---------------------------------------------------------------------
// Retorna os registros de HistoricoPromocaoMilitarV2 necessários para
// alimentar o motor `calcularPreviaAntiguidadeGeral` no frontend, dado
// um conjunto de militar_ids já carregados (ex.: página Militares).
//
// Por que existe: o motor de prévia é grande e a fonte da verdade está
// no frontend (compartilhada com a Antiguidade Prévia). Esta função
// apenas substitui a query SDK direta a HistoricoPromocaoMilitarV2 por
// uma chamada server-side com service role, com projeção mínima de
// campos para reduzir payload.
//
// Não calcula prévia, não grava dados, não consulta Militar.
// =====================================================================

const LIMIT_MAX = 500;
const CHUNK_SIZE = 200;

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Campos mínimos consumidos por `calcularPreviaAntiguidadeGeral`.
const CAMPOS_HISTORICO = [
  'id',
  'militar_id',
  'posto_graduacao_anterior',
  'quadro_anterior',
  'posto_graduacao_novo',
  'quadro_novo',
  'data_promocao',
  'antiguidade_referencia_ordem',
  'antiguidade_referencia_id',
  'status_registro',
  'tipo_promocao',
  'tipo_movimentacao',
  'natureza',
  'motivo',
  'origem_dado',
  'observacoes',
];

async function fetchWithRetry(queryFn, label = 'query') {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || 0;
      const isRetryable = RETRY_STATUS.has(status);
      console.warn(
        `[getPreviaAntiguidadeMilitares] step=${label} attempt=${attempt}/${RETRY_MAX_ATTEMPTS} status=${status || 'N/A'} retryable=${isRetryable}`,
      );
      if (!isRetryable || attempt === RETRY_MAX_ATTEMPTS) break;
      const wait = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((res) => setTimeout(res, wait));
    }
  }
  throw lastError;
}

function sanitizeIds(raw) {
  if (!Array.isArray(raw)) return [];
  const set = new Set();
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ error: 'Não autenticado', historicoPromocoes: [] }, { status: 401 });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch (_e) {
      payload = {};
    }

    const idsMilitares = sanitizeIds(payload?.idsMilitares);

    if (idsMilitares.length === 0) {
      return Response.json({
        historicoPromocoes: [],
        meta: { total: 0, militaresSolicitados: 0 },
      });
    }

    // Particiona em chunks para evitar payloads grandes em `$in`.
    const chunks = [];
    for (let i = 0; i < idsMilitares.length; i += CHUNK_SIZE) {
      chunks.push(idsMilitares.slice(i, i + CHUNK_SIZE));
    }

    const resultados = await Promise.all(
      chunks.map((chunk, idx) =>
        fetchWithRetry(
          () =>
            base44.asServiceRole.entities.HistoricoPromocaoMilitarV2.filter(
              { militar_id: { $in: chunk } },
              undefined,
              LIMIT_MAX,
              0,
              CAMPOS_HISTORICO,
            ),
          `historicoPromocaoMilitarV2.filter.chunk_${idx}`,
        ),
      ),
    );

    const historicoPromocoes = resultados.flat();

    return Response.json({
      historicoPromocoes,
      meta: {
        total: historicoPromocoes.length,
        militaresSolicitados: idsMilitares.length,
        chunks: chunks.length,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[getPreviaAntiguidadeMilitares] erro fatal:', {
      message: error?.message,
      status,
    });
    return Response.json(
      { error: error?.message || 'Erro interno ao buscar histórico de promoções.', historicoPromocoes: [] },
      { status },
    );
  }
});