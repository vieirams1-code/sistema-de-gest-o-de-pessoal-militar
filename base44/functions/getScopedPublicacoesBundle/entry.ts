import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CHUNK = 200;
const normalizeTipo = (valor: unknown) => String(valor || '').trim().toLowerCase();

const PURPOSES: Record<string, { module: string; action: string; livro: boolean; exOfficio: boolean }> = {
  CONTROL: { module: 'controle_publicacoes', action: 'visualizar_controle_publicacoes', livro: true, exOfficio: true },
  LIVRO: { module: 'livro', action: 'visualizar_livro', livro: true, exOfficio: false },
  CONCILIACAO: { module: 'conciliacao_boletim', action: 'visualizar_conciliacao_boletim', livro: true, exOfficio: true },
  RP: { module: 'rp', action: 'visualizar_rp', livro: true, exOfficio: false },
};

const CAMPOS_MILITAR_APOIO = [
  'id', 'nome', 'nome_completo', 'nome_guerra', 'posto_graduacao', 'posto', 'graduacao',
  'quadro', 'matricula', 'matricula_atual',
];

function erro(status: number, message: string, requiredPermission?: string) {
  return Response.json({ error: message, ...(requiredPermission ? { requiredPermission } : {}) }, { status });
}

async function resolverAutorizacao(base44: any, effectiveEmail?: string) {
  const response = await base44.functions.invoke('getUserPermissions', effectiveEmail ? { effectiveEmail } : {});
  const body = response?.data ?? response ?? {};
  if (body?.error) throw Object.assign(new Error(body.error), { status: 403 });
  return body;
}

function temCapacidade(authz: any, config: { module: string; action: string }) {
  return authz?.isAdmin === true || (
    authz?.modules?.[config.module] === true && authz?.actions?.[config.action] === true
  );
}

async function listarMilitarIdsDoEscopo(base44: any, acessos: any[] = []) {
  const ids = new Set<string>();
  for (const acesso of acessos || []) {
    const tipo = normalizeTipo(acesso?.tipo_acesso);
    if (tipo === 'admin') return null;
    if (tipo === 'proprio') {
      if (acesso?.militar_id) ids.add(String(acesso.militar_id));
      continue;
    }
    const grupamentoId = acesso?.grupamento_id || null;
    const subgrupamentoId = acesso?.subgrupamento_id || null;
    const filtros: any[] = [];
    if (tipo === 'setor' && grupamentoId) {
      filtros.push({ grupamento_raiz_id: grupamentoId }, { grupamento_id: grupamentoId }, { estrutura_id: grupamentoId });
    } else if (tipo === 'subsetor' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
      const filhos = await base44.asServiceRole.entities.Subgrupamento.filter({ parent_id: subgrupamentoId }).catch(() => []);
      for (const filho of filhos || []) if (filho?.id) filtros.push({ estrutura_id: filho.id }, { subgrupamento_id: filho.id });
    } else if (tipo === 'unidade' && subgrupamentoId) {
      filtros.push({ estrutura_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId });
    }
    for (const filtro of filtros) {
      const militares = await base44.asServiceRole.entities.Militar.filter(filtro, undefined, 1000, 0, ['id']).catch(() => []);
      for (const militar of militares || []) if (militar?.id) ids.add(String(militar.id));
    }
  }
  return Array.from(ids);
}

async function listarEscopado(base44: any, entityName: string, militarIds: string[] | null, filtroExtra: any = {}) {
  if (militarIds === null) {
    return Object.keys(filtroExtra).length
      ? base44.asServiceRole.entities[entityName].filter(filtroExtra, '-created_date', 10000, 0)
      : base44.asServiceRole.entities[entityName].list('-created_date', 10000);
  }
  if (!militarIds.length) return [];
  const out: any[] = [];
  for (let i = 0; i < militarIds.length; i += CHUNK) {
    const chunk = militarIds.slice(i, i + CHUNK);
    const rows = await base44.asServiceRole.entities[entityName].filter(
      { ...filtroExtra, militar_id: { $in: chunk } }, '-created_date', 1000, 0,
    );
    out.push(...(rows || []));
  }
  return out;
}

function deduplicar(registros: any[]) {
  const porId = new Map<string, any>();
  for (const registro of registros || []) if (registro?.id) porId.set(String(registro.id), registro);
  return Array.from(porId.values()).sort(
    (a, b) => new Date(b?.created_date || 0).getTime() - new Date(a?.created_date || 0).getTime(),
  );
}

async function listarMilitaresApoio(base44: any, registros: any[]) {
  const ids = Array.from(new Set((registros || []).map((item) => String(item?.militar_id || '')).filter(Boolean)));
  if (!ids.length) return [];
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const rows = await base44.asServiceRole.entities.Militar.filter(
      { id: { $in: ids.slice(i, i + CHUNK) } }, undefined, 1000, 0, CAMPOS_MILITAR_APOIO,
    );
    out.push(...(rows || []));
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!await base44.auth.me()) return erro(401, 'Não autenticado.');

    const body = await req.json().catch(() => ({}));
    const purpose = String(body?.purpose || 'CONTROL').trim().toUpperCase();
    const config = PURPOSES[purpose];
    if (!config) return erro(400, 'Finalidade de leitura inválida.');

    const authz = await resolverAutorizacao(base44, body?.effectiveEmail);
    if (!temCapacidade(authz, config)) {
      return erro(403, 'Sem permissão para esta leitura de Livro/Publicações.', config.action);
    }

    const militarIds = authz?.isAdmin === true || authz?.hasGlobalScope === true
      ? null
      : await listarMilitarIdsDoEscopo(base44, authz?.acessos || []);

    const registroLivroId = String(body?.registroLivroId || '').trim();
    const publicacaoId = String(body?.publicacaoId || '').trim();
    const militarId = String(body?.militarId || '').trim();
    if (militarId && militarIds !== null && !militarIds.includes(militarId)) {
      return erro(403, 'Militar fora do escopo organizacional autorizado.');
    }

    const filtroLivro: any = {};
    const filtroExOfficio: any = {};
    if (registroLivroId) filtroLivro.id = registroLivroId;
    if (publicacaoId) filtroExOfficio.id = publicacaoId;
    if (militarId) {
      filtroLivro.militar_id = militarId;
      filtroExOfficio.militar_id = militarId;
    }

    const [registrosLivroBase, publicacoesEscopo] = await Promise.all([
      config.livro ? listarEscopado(base44, 'RegistroLivro', militarIds, filtroLivro) : Promise.resolve([]),
      config.exOfficio ? listarEscopado(base44, 'PublicacaoExOfficio', militarIds, filtroExOfficio) : Promise.resolve([]),
    ]);

    let publicacoesExOfficio = publicacoesEscopo || [];
    if (purpose === 'CONTROL' && config.exOfficio && !publicacaoId && !militarId) {
      const emailAutor = String(authz?.effectiveUserEmail || '').trim().toLowerCase();
      if (emailAutor) {
        const autor = await base44.asServiceRole.entities.PublicacaoExOfficio
          .filter({ criado_por_email: emailAutor }, '-created_date', 10000, 0)
          .catch(() => []);
        publicacoesExOfficio = deduplicar([...(publicacoesExOfficio || []), ...(autor || [])]);
      }
    }

    const registrosLivro = deduplicar(registrosLivroBase || []);
    publicacoesExOfficio = deduplicar(publicacoesExOfficio || []);
    const militares = await listarMilitaresApoio(base44, [...registrosLivro, ...publicacoesExOfficio]);

    return Response.json({
      registrosLivro,
      publicacoesExOfficio,
      militares,
      meta: {
        purpose,
        hasGlobalScope: militarIds === null,
        totalMilitaresEscopo: militarIds === null ? null : militarIds.length,
      },
    });
  } catch (error: any) {
    console.error('[getScopedPublicacoesBundle]', error?.message || error);
    return erro(Number(error?.status || 500), error?.message || 'Erro interno ao carregar Livro/Publicações.');
  }
});
