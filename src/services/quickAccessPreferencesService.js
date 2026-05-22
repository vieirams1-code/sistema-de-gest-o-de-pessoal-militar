const QUICK_ACCESS_CONTEXT = 'quick_access_widget';

let quickAccessClientPromise = null;

const DEFAULT_WIDGET = {
  x: 420,
  y: 180,
  orientacao: 'vertical',
  densidade: 'expanded',
  minimized: false,
};

async function getClient() {
  if (!quickAccessClientPromise) {
    quickAccessClientPromise = import('../api/base44Client.js').then((mod) => mod.base44);
  }
  return quickAccessClientPromise;
}

function normalizePinnedItems(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      page: String(item?.page || '').trim(),
      tab: item?.tab ? String(item.tab).trim() : null,
    }))
    .filter((item) => item.page)
    .filter((item, index, arr) => arr.findIndex((candidate) => (
      candidate.page === item.page && (candidate.tab || null) === (item.tab || null)
    )) === index);
}

function normalizeWidgetPreferences(value = {}) {
  const x = Number.isFinite(Number(value?.x)) ? Number(value.x) : DEFAULT_WIDGET.x;
  const y = Number.isFinite(Number(value?.y)) ? Number(value.y) : DEFAULT_WIDGET.y;
  const orientacao = value?.orientacao === 'horizontal' ? 'horizontal' : 'vertical';
  const densidade = value?.densidade === 'compact' ? 'compact' : 'expanded';
  const minimized = Boolean(value?.minimized);

  return { x, y, orientacao, densidade, minimized };
}

function normalizePayload(payload = {}) {
  return {
    itens_fixados: normalizePinnedItems(payload?.itens_fixados),
    widget: normalizeWidgetPreferences(payload?.widget),
  };
}

export async function fetchQuickAccessPreference(userEmail) {
  const email = String(userEmail || '').trim().toLowerCase();
  if (!email) return null;

  const client = await getClient();
  const entity = client?.entities?.PreferenciaUsuario;
  if (!entity || typeof entity.filter !== 'function') return null;

  const registros = await entity.filter({ user_email: email, contexto: QUICK_ACCESS_CONTEXT }, '-updated_date');
  const preferencia = Array.isArray(registros) ? registros[0] : null;
  if (!preferencia) return null;

  return {
    id: preferencia.id,
    user_email: preferencia.user_email,
    contexto: preferencia.contexto,
    valor_json: normalizePayload(preferencia.valor_json),
    updated_at: preferencia.updated_at || preferencia.updated_date || null,
  };
}

export async function saveQuickAccessPreference({ userEmail, itensFixados = [], widget = undefined } = {}) {
  const email = String(userEmail || '').trim().toLowerCase();
  if (!email) return null;

  const client = await getClient();
  const entity = client?.entities?.PreferenciaUsuario;
  if (!entity || typeof entity.filter !== 'function') return null;

  const registros = await entity.filter({ user_email: email, contexto: QUICK_ACCESS_CONTEXT }, '-updated_date');
  const preferenciaExistente = Array.isArray(registros) ? registros[0] : null;

  const currentValorJson = normalizePayload(preferenciaExistente?.valor_json || {});
  const nextValorJson = normalizePayload({
    itens_fixados: itensFixados,
    widget: widget === undefined ? currentValorJson.widget : widget,
  });

  const payload = {
    user_email: email,
    contexto: QUICK_ACCESS_CONTEXT,
    valor_json: nextValorJson,
    updated_at: new Date().toISOString(),
  };

  if (preferenciaExistente?.id && typeof entity.update === 'function') {
    await entity.update(preferenciaExistente.id, payload);
    return { ...preferenciaExistente, ...payload, id: preferenciaExistente.id };
  }

  if (typeof entity.create === 'function') {
    const created = await entity.create(payload);
    return created;
  }

  return null;
}

export { QUICK_ACCESS_CONTEXT, DEFAULT_WIDGET, normalizePinnedItems, normalizeWidgetPreferences };
