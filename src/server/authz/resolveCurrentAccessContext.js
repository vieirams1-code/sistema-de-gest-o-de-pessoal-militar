import {
  AccessContextNotFoundError,
  AuthRequiredError,
  InvalidAccessConfigurationError,
  MultipleActiveAccessFoundError,
} from './errors';
import { ACCESS_MODES } from './constants';
import {
  buildActionAccessSet,
  buildModuleAccessSet,
  getBase44Client,
  isLegacyAdminUser,
  listByFilter,
  loadSubgrupamentos,
  normalizeEmail,
} from './utils';

function deriveFallbackMode(authUser) {
  if (isLegacyAdminUser(authUser)) return 'admin';
  if (authUser?.subgrupamento_tipo === 'Grupamento') return 'setor';
  if (authUser?.subgrupamento_tipo === 'Subgrupamento') return 'subsetor';
  if (authUser?.subgrupamento_tipo === 'Unidade') return 'unidade';
  return 'proprio';
}

function collectDescendantUnitIds(scopeRootId, estrutura = []) {
  return estrutura
    .filter((item) => item?.tipo === 'Unidade' && item?.grupamento_id === scopeRootId)
    .map((item) => item.id)
    .filter(Boolean);
}

export async function resolveCurrentAccessContext(options = {}) {
  const base44Client = getBase44Client(options);
  const authUser = options.authUser || await base44Client.auth.me();

  if (!authUser?.email) {
    throw new AuthRequiredError();
  }

  const rawAuthEmail = typeof authUser.email === 'string' ? authUser.email.trim() : authUser.email;
  const authEmail = normalizeEmail(rawAuthEmail);
  let activeAccesses = await listByFilter('UsuarioAcesso', { user_email: rawAuthEmail, ativo: true }, options);
  if (!activeAccesses.length && authEmail && authEmail !== rawAuthEmail) {
    activeAccesses = await listByFilter('UsuarioAcesso', { user_email: authEmail, ativo: true }, options);
  }

  if (activeAccesses.length > 1) {
    throw new MultipleActiveAccessFoundError({ authEmail, count: activeAccesses.length });
  }

  const usuarioAcesso = activeAccesses[0] || null;
  const fallbackAdmin = !usuarioAcesso && isLegacyAdminUser(authUser);
  if (!usuarioAcesso && !fallbackAdmin) {
    throw new AccessContextNotFoundError({ authEmail });
  }

  const modoAcesso = usuarioAcesso?.tipo_acesso || deriveFallbackMode(authUser);
  if (!ACCESS_MODES.includes(modoAcesso)) {
    throw new InvalidAccessConfigurationError('Modo de acesso invalido no contexto atual.', {
      authEmail,
      modoAcesso,
    });
  }

  const isAdmin = modoAcesso === 'admin';
  const linkedMilitarId = usuarioAcesso?.militar_id || authUser?.militar_id || null;
  const linkedMilitarEmail = normalizeEmail(
    usuarioAcesso?.militar_email || authUser?.militar_email || authUser?.email
  );
  const scopeRootId =
    usuarioAcesso?.subgrupamento_id ||
    usuarioAcesso?.grupamento_id ||
    authUser?.subgrupamento_id ||
    null;
  const scopeType = usuarioAcesso?.subgrupamento_tipo || authUser?.subgrupamento_tipo || null;

  let scopeSubgrupamentoIds = [];
  if (modoAcesso === 'subsetor' && scopeRootId) {
    const estrutura = await loadSubgrupamentos(options);
    scopeSubgrupamentoIds = collectDescendantUnitIds(scopeRootId, estrutura);
  }

  return {
    authUser,
    authEmail,
    usuarioAcesso,
    modoAcesso,
    isAdmin,
    linkedMilitarId,
    linkedMilitarEmail,
    scopeRootId,
    scopeType,
    scopeSubgrupamentoIds,
    moduleAccess: buildModuleAccessSet(usuarioAcesso, fallbackAdmin),
    actionAccess: buildActionAccessSet(usuarioAcesso, fallbackAdmin),
    isFallbackAdmin: fallbackAdmin,
  };
}
