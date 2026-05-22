const QUICK_ACCESS_CONTEXT = 'quick_access_widget';

let quickAccessClientPromise = null;

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

function normalizePayload(payload = {}) {
  return {
    itens_fixados: normalizePinnedItems(payload?.itens_fixados),
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

export async function saveQuickAccessPreference({ userEmail, itensFixados = [] } = {}) {
  const email = String(userEmail || '').trim().toLowerCase();
  if (!email) return null;

  const client = await getClient();
  const entity = client?.entities?.PreferenciaUsuario;
  if (!entity || typeof entity.filter !== 'function') return null;

  const valorJson = normalizePayload({ itens_fixados: itensFixados });
  const payload = {
    user_email: email,
    contexto: QUICK_ACCESS_CONTEXT,
    valor_json: valorJson,
    updated_at: new Date().toISOString(),
  };

  const registros = await entity.filter({ user_email: email, contexto: QUICK_ACCESS_CONTEXT }, '-updated_date');
  const preferenciaExistente = Array.isArray(registros) ? registros[0] : null;

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

export { QUICK_ACCESS_CONTEXT, normalizePinnedItems };
