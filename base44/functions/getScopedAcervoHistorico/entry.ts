import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// =====================================================================
// getScopedAcervoHistorico — Sprint P0 Segurança
// ---------------------------------------------------------------------
// Busca escopada de documentos do Acervo Funcional Histórico para a
// Busca Global. Substitui as chamadas diretas no frontend a
// AcervoFuncionalHistorico.list() + Militar.list(), que vazavam nome,
// matrícula e lotação de militares fora do escopo do usuário.
//
// Regras:
//   - Exige usuário autenticado.
//   - Exige permissão de ação `visualizar_acervo_historico` (ou admin).
//   - Aplica o escopo do USUÁRIO EFETIVO (impersonação não amplia escopo).
//   - Retorna apenas documentos vinculados a militares dentro do escopo.
// =====================================================================

const LIMIT_MAX = 1000;
const RESULT_LIMIT = 10;
const normalizeTipo = (t) => String(t || '').trim().toLowerCase();
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

function corresponde(texto, termo) {
  return String(texto || '').toLowerCase().includes(termo);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const termo = String(payload?.search || '').trim().toLowerCase();
    if (!termo) return Response.json({ documentos: [], meta: { warnings: ['SEM_TERMO'] } });

    // 1. Permissões consolidadas do usuário efetivo (impersonação validada lá).
    const permsResponse = await base44.functions.invoke('getUserPermissions', payload);
    const perms = permsResponse?.data ?? permsResponse ?? {};
    const isAdmin = Boolean(perms?.isAdmin);
    const actions = perms?.actions || {};
    const podeVerAcervo = isAdmin || actions?.visualizar_acervo_historico === true;
    if (!podeVerAcervo) {
      return Response.json({ error: 'Sem permissão para visualizar acervo histórico.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const scope = perms?.scope || {};
    const estruturaIds = Array.isArray(scope?.estruturaIds) ? scope.estruturaIds : [];
    const militarIdProprio = scope?.militarId || null;

    // 2. Resolve conjunto de militares dentro do escopo do usuário efetivo.
    let militaresEscopo = [];
    if (isAdmin) {
      militaresEscopo = await base44.asServiceRole.entities.Militar.list(undefined, LIMIT_MAX);
    } else if (estruturaIds.length) {
      militaresEscopo = await base44.asServiceRole.entities.Militar.filter(
        { estrutura_id: { $in: estruturaIds } }, undefined, LIMIT_MAX, 0,
      );
    } else if (militarIdProprio) {
      militaresEscopo = await base44.asServiceRole.entities.Militar.filter({ id: militarIdProprio });
    }

    militaresEscopo = militaresEscopo || [];
    if (!militaresEscopo.length) {
      return Response.json({ documentos: [], meta: { totalEscopo: 0, warnings: ['SEM_ESCOPO'] } });
    }

    const militarPorId = new Map(militaresEscopo.map((m) => [String(m.id), m]));
    const militarIds = [...militarPorId.keys()];

    // 3. Busca documentos ATIVOS apenas dos militares no escopo.
    const documentos = await base44.asServiceRole.entities.AcervoFuncionalHistorico.filter(
      { militar_id: { $in: militarIds }, ativo: true, status_documento: 'ATIVO' },
      '-data_documento', LIMIT_MAX, 0,
    );

    const resultados = (documentos || [])
      .map((doc) => {
        const militar = militarPorId.get(String(doc.militar_id)) || null;
        return { ...doc, militar };
      })
      .filter((doc) => {
        const militar = doc.militar || {};
        const blob = [doc.titulo, doc.observacoes, doc.tipo_documento, militar.nome_guerra, militar.nome_completo, militar.matricula]
          .filter(Boolean).join(' ');
        return corresponde(blob, termo);
      })
      .slice(0, RESULT_LIMIT)
      .map((doc) => ({
        id: doc.id,
        militar_id: doc.militar_id,
        titulo: doc.titulo || '',
        observacoes: doc.observacoes || '',
        tipo_documento: doc.tipo_documento || '',
        data_documento: doc.data_documento || '',
        militar: doc.militar
          ? {
            id: doc.militar.id,
            nome_guerra: doc.militar.nome_guerra || '',
            nome_completo: doc.militar.nome_completo || '',
            matricula: doc.militar.matricula || '',
          }
          : null,
      }));

    return Response.json({
      documentos: resultados,
      meta: {
        totalEscopo: militarIds.length,
        totalDocumentos: resultados.length,
        isImpersonating: Boolean(perms?.isImpersonating),
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    return Response.json({ error: error?.message || 'Erro ao buscar acervo histórico escopado.' }, { status });
  }
});