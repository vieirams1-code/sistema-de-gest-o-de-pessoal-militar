import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';
import { CANONICAL_PERMISSION_KEYS, PERMISSION_MODULES, PROFILE_MATRIX_VERSION } from './permissionManifest.ts';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

function extrairMatrizPermissoes(descricao: unknown): Record<string, boolean> {
  if (typeof descricao !== 'string' || !descricao) return {};
  const inicio = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const fim = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (inicio === -1 || fim === -1 || fim <= inicio) return {};
  const raw = descricao.slice(inicio + '[SGP_PERMISSIONS_MATRIX]'.length, fim).trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function limparDescricaoTecnica(descricao: unknown): string {
  return String(descricao || '')
    .replace(/\[SGP_PERMISSIONS_MATRIX\][\s\S]*?\[\/SGP_PERMISSIONS_MATRIX\]/g, '')
    .replace(/\[SGP_PERMISSIONS_VERSION\][\s\S]*?\[\/SGP_PERMISSIONS_VERSION\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function matrizesCanonicasIguais(a: Record<string, unknown> = {}, b: Record<string, unknown> = {}): boolean {
  const keysA = Object.keys(a || {});
  if (keysA.length !== CANONICAL_PERMISSION_KEYS.length) return false;
  if (keysA.some((key) => !CANONICAL_KEY_SET.has(key))) return false;
  return CANONICAL_PERMISSION_KEYS.every((key: string) => (a?.[key] === true) === (b?.[key] === true));
}

const CANONICAL_KEY_SET = new Set(CANONICAL_PERMISSION_KEYS as readonly string[]);
const PARENT_BY_ACTION = new Map(
  (PERMISSION_MODULES || []).flatMap((module: any) => (module.actions || []).map((action: string) => [action, module.key])),
);
const LEGACY_EXPANSIONS = Object.freeze({
  acesso_campanhas: ['acesso_campanhas_ferias', 'acesso_campanhas_gerais'],
  perm_visualizar_campanhas: ['perm_visualizar_campanhas_ferias', 'perm_visualizar_campanhas_gerais'],
  perm_gerir_campanhas: [
    'perm_visualizar_campanhas_ferias', 'perm_criar_campanhas_ferias', 'perm_admin_campanhas_ferias',
    'perm_editar_campanhas_ferias', 'perm_excluir_campanhas_ferias', 'perm_visualizar_planos_ferias',
    'perm_criar_planos_ferias', 'perm_editar_planos_ferias', 'perm_excluir_planos_ferias',
    'perm_visualizar_campanhas_gerais', 'perm_criar_campanhas', 'perm_admin_campanhas',
    'perm_editar_campanhas', 'perm_excluir_campanhas', 'perm_enviar_lembretes_campanhas',
  ],
  perm_gerir_respostas: [
    'perm_visualizar_respostas_ferias', 'perm_aprovar_ferias', 'perm_gerar_ferias_campanhas',
    'perm_atribuir_permissoes_ferias', 'perm_visualizar_respostas_campanhas',
    'perm_exportar_respostas_campanhas', 'perm_baixar_anexos_respostas_campanhas',
    'perm_visualizar_solicitacoes_cadastrais', 'perm_decidir_solicitacoes_cadastrais',
    'perm_aprovar_respostas_campanhas', 'perm_atribuir_permissoes_campanhas',
  ],
  perm_excluir_atestados: ['perm_excluir_atestado'],
  perm_gerir_fluxo_dom_pedro_ii: ['perm_gerir_dom_pedro_ii'],
});

function matrizEstruturadaValida(perfil: any): Record<string, boolean> | null {
  const matriz = perfil?.matriz_permissoes;
  if (!matriz || typeof matriz !== 'object' || Array.isArray(matriz)) return null;
  return Object.keys(matriz).some((key) => CANONICAL_KEY_SET.has(key)) ? matriz : null;
}

function canonicalizarMatriz(raw: Record<string, unknown> = {}): Record<string, boolean> {
  const canonical = Object.fromEntries(
    CANONICAL_PERMISSION_KEYS.map((key: string) => [key, raw?.[key] === true]),
  ) as Record<string, boolean>;

  for (const [legacyKey, targets] of Object.entries(LEGACY_EXPANSIONS)) {
    if (raw?.[legacyKey] !== true) continue;
    for (const target of targets) {
      if (CANONICAL_KEY_SET.has(target)) canonical[target] = true;
    }
  }

  for (const [actionKey, moduleKey] of PARENT_BY_ACTION.entries()) {
    if (canonical[actionKey] === true) canonical[moduleKey] = true;
  }
  return canonical;
}

function matrizFontePerfil(perfil: any): Record<string, boolean> {
  return matrizEstruturadaValida(perfil) || extrairMatrizPermissoes(perfil?.descricao);
}

function perfilTemPermissao(perfil: any, key: string): boolean {
  const matriz = matrizFontePerfil(perfil);
  if (Object.keys(matriz).length > 0) return canonicalizarMatriz(matriz)?.[key] === true;
  return perfil?.[key] === true;
}

async function backfillPerfis(base44: any, perfis: any[]) {
  const saida = [];
  for (const perfil of (perfis || [])) {
    if (!perfil) {
      saida.push(perfil);
      continue;
    }

    const estruturada = matrizEstruturadaValida(perfil);
    const legadoDescricao = extrairMatrizPermissoes(perfil?.descricao);
    const fonte = estruturada || legadoDescricao;
    const descricaoLimpa = limparDescricaoTecnica(perfil?.descricao);
    const patch: Record<string, unknown> = {};

    if (Object.keys(fonte).length > 0) {
      const matriz_permissoes = canonicalizarMatriz(fonte);
      if (!estruturada || !matrizesCanonicasIguais(estruturada, matriz_permissoes)) {
        patch.matriz_permissoes = matriz_permissoes;
      }
      if (String(perfil?.versao_matriz_permissoes || '') !== PROFILE_MATRIX_VERSION) {
        patch.versao_matriz_permissoes = PROFILE_MATRIX_VERSION;
      }
    }

    if (descricaoLimpa !== String(perfil?.descricao || '')) {
      patch.descricao = descricaoLimpa;
    }

    if (Object.keys(patch).length === 0) {
      saida.push(perfil);
      continue;
    }

    const atualizado = await base44.asServiceRole.entities.PerfilPermissao.update(perfil.id, patch);
    saida.push({ ...perfil, ...(atualizado || {}), ...patch });
  }
  return saida;
}

async function resolverCapacidadesAdministrativas(base44: any, user: any) {
  const isPlatformAdmin = String(user?.role || '').trim().toLowerCase() === 'admin';
  if (isPlatformAdmin) {
    return {
      isPlatformAdmin: true,
      gerirPerfis: true,
      gerirUsuarios: true,
    };
  }

  const email = normalizeEmail(user?.email);
  if (!email) return { isPlatformAdmin: false, gerirPerfis: false, gerirUsuarios: false };

  const acessos = await base44.asServiceRole.entities.UsuarioAcesso.filter(
    { user_email: user.email, ativo: true },
    undefined,
    100,
    0,
    ['id', 'perfil_id'],
  );
  const perfilIds = [...new Set((acessos || []).map((item: any) => item?.perfil_id).filter(Boolean))];
  if (perfilIds.length === 0) {
    return { isPlatformAdmin: false, gerirPerfis: false, gerirUsuarios: false };
  }

  const perfis = await base44.asServiceRole.entities.PerfilPermissao.filter({
    id: { $in: perfilIds },
    ativo: true,
  });

  const tem = (key: string) => (perfis || []).some((perfil: any) => perfilTemPermissao(perfil, key));
  const gerirTudo = tem('perm_gerir_permissoes');
  return {
    isPlatformAdmin: false,
    gerirPerfis: gerirTudo || tem('perm_gerir_perfis_permissao'),
    gerirUsuarios: gerirTudo || tem('perm_gerir_permissoes_usuarios'),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return json({ error: 'Usuário não autenticado.' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toUpperCase();
    const payload = body?.payload || {};
    const caps = await resolverCapacidadesAdministrativas(base44, user);

    if (action === 'LIST_PROFILES') {
      if (!caps.gerirPerfis && !caps.gerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar perfis de permissão.' }, 403);
      }
      const perfis = await base44.asServiceRole.entities.PerfilPermissao.list('nome_perfil', 1000, 0);
      const perfisMigrados = await backfillPerfis(base44, Array.isArray(perfis) ? perfis : []);
      return json({ ok: true, perfis: perfisMigrados });
    }

    if (action === 'GET_PROFILE') {
      if (!caps.gerirPerfis && !caps.gerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar perfis de permissão.' }, 403);
      }
      const profileId = String(payload?.profileId || '').trim();
      if (!profileId) return json({ error: 'profileId é obrigatório.' }, 400);
      const perfil = await base44.asServiceRole.entities.PerfilPermissao.get(profileId).catch(() => null);
      if (!perfil) return json({ error: 'Perfil de permissão não encontrado.' }, 404);
      const [perfilMigrado] = await backfillPerfis(base44, [perfil]);
      return json({ ok: true, perfil: perfilMigrado || perfil });
    }

    if (action === 'LIST_ACCESS') {
      if (!caps.gerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar acessos de usuários.' }, 403);
      }
      const acessos = await base44.asServiceRole.entities.UsuarioAcesso.list('nome_usuario', 1000, 0);
      return json({ ok: true, acessos: Array.isArray(acessos) ? acessos : [] });
    }

    if (action === 'GET_ACCESS') {
      if (!caps.gerirUsuarios) {
        return json({ error: 'Usuário sem permissão para consultar acessos de usuários.' }, 403);
      }
      const accessId = String(payload?.accessId || '').trim();
      if (!accessId) return json({ error: 'accessId é obrigatório.' }, 400);
      const acesso = await base44.asServiceRole.entities.UsuarioAcesso.get(accessId).catch(() => null);
      if (!acesso) return json({ error: 'Acesso de usuário não encontrado.' }, 404);
      return json({ ok: true, acesso });
    }

    if (action === 'LIST_PROFILE_USAGE') {
      if (!caps.gerirPerfis) {
        return json({ error: 'Usuário sem permissão para consultar uso dos perfis.' }, 403);
      }
      const acessos = await base44.asServiceRole.entities.UsuarioAcesso.list(undefined, 1000, 0);
      const uso = (acessos || []).map((item: any) => ({
        id: item?.id || '',
        perfil_id: item?.perfil_id || '',
        ativo: item?.ativo !== false,
        nome_usuario: item?.nome_usuario || '',
        user_email: item?.user_email || '',
      }));
      return json({ ok: true, uso });
    }

    return json({ error: 'Ação não reconhecida.' }, 400);
  } catch (error: any) {
    const status = error?.response?.status || error?.status || 500;
    const message = error?.message || 'Falha ao consultar dados administrativos de permissões.';
    console.error('[permissoesAdminGateway]', { status, message });
    return json({ error: message, errorStage: 'PERMISSIONS_ADMIN_GATEWAY' }, status >= 400 && status < 600 ? status : 500);
  }
});