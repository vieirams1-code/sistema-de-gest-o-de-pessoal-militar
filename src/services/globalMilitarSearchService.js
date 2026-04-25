import { militarCorrespondeBusca } from './matriculaMilitarViewService.js';

function toLower(value) {
  return String(value || '').toLowerCase();
}

export function ordenarResultadosMilitar(militares = []) {
  return [...militares].sort((a, b) => {
    const postoA = toLower(a?.posto_graduacao);
    const postoB = toLower(b?.posto_graduacao);
    if (postoA !== postoB) return postoA.localeCompare(postoB, 'pt-BR');

    const guerraA = toLower(a?.nome_guerra || a?.nome_completo);
    const guerraB = toLower(b?.nome_guerra || b?.nome_completo);
    return guerraA.localeCompare(guerraB, 'pt-BR');
  });
}

export function filtrarMilitaresGlobal(militares = [], termo = '', { limit = 10 } = {}) {
  const query = String(termo || '').trim();
  if (!query) return [];

  const filtrados = militares.filter((militar) => militarCorrespondeBusca(militar, query));
  const ordenados = ordenarResultadosMilitar(filtrados);
  return ordenados.slice(0, Math.max(1, limit));
}

export function construirAtalhosMilitar({ militarId, canAccessAction }) {
  const atalhos = [];

  if (canAccessAction('visualizar_militares')) {
    atalhos.push({
      key: 'perfil',
      label: 'Ver Perfil',
      page: 'VerMilitar',
      query: `?id=${militarId}`,
    });
  }

  if (canAccessAction('visualizar_ferias')) {
    atalhos.push({
      key: 'ferias',
      label: 'Férias',
      page: 'VerMilitar',
      query: `?id=${militarId}&tab=ferias`,
    });
  }

  if (canAccessAction('visualizar_medalhas')) {
    atalhos.push({
      key: 'medalhas',
      label: 'Medalhas',
      page: 'VerMilitar',
      query: `?id=${militarId}&tab=medalhas`,
    });
  }

  if (canAccessAction('visualizar_registros_militar')) {
    atalhos.push({
      key: 'registros',
      label: 'Registros do Militar',
      page: 'RegistrosMilitar',
      query: `?militar_id=${militarId}`,
    });
  }

  return atalhos;
}

export function filtrarMilitaresPorEscopo(militares = [], { hasAccess, hasSelfAccess }) {
  return militares.filter((militar) => hasAccess?.(militar) || hasSelfAccess?.(militar));
}
