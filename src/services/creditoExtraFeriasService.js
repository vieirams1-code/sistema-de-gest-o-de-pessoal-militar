import { base44 } from '../api/base44Client.js';
import {
  atualizarEscopado,
  criarEscopado,
} from './cudEscopadoClient.js';
import {
  TIPOS_CREDITO_EXTRA_FERIAS,
  STATUS_CREDITO_EXTRA_FERIAS,
  criarPayloadCreditoExtraFerias,
  calcularTotaisGozoComCreditos,
  validarCreditosSelecionadosParaGozo,
  formatarTipoCreditoExtra,
  filtrarCreditosExtraFerias,
  prepararAtualizacaoCreditoExtraFerias,
  prepararCancelamentoCreditoExtraFerias,
} from './creditoExtraFeriasRules.js';

// =====================================================================
// creditoExtraFeriasService — Backend Hardening
// ---------------------------------------------------------------------
// Toda leitura passa por getScopedCreditosExtraFerias (Deno function),
// que aplica filtro de escopo militar idêntico ao cudEscopado.
// Toda escrita (create/update) passa por cudEscopadoClient
// (criarEscopado/atualizarEscopado), que valida escopo no backend
// antes de executar via asServiceRole.
//
// Não há mais chamadas diretas a base44.entities.CreditoExtraFerias.*
// neste serviço.
// =====================================================================

async function invocarGetScopedCreditos(payload = {}) {
  const response = await base44.functions.invoke('getScopedCreditosExtraFerias', payload || {});
  const body = response?.data ?? response;
  if (body?.error) {
    throw new Error(body.error);
  }
  return Array.isArray(body?.creditos) ? body.creditos : [];
}

export async function listarCreditosExtraFerias(orderBy = '-data_referencia') {
  return invocarGetScopedCreditos({ orderBy });
}

export async function salvarCreditoExtraFerias({ form, militar }) {
  const payload = criarPayloadCreditoExtraFerias(form, militar);

  if (form?.id) {
    return atualizarEscopado('CreditoExtraFerias', form.id, payload);
  }

  return criarEscopado('CreditoExtraFerias', payload);
}

export {
  TIPOS_CREDITO_EXTRA_FERIAS,
  STATUS_CREDITO_EXTRA_FERIAS,
  criarPayloadCreditoExtraFerias,
  calcularTotaisGozoComCreditos,
  validarCreditosSelecionadosParaGozo,
  formatarTipoCreditoExtra,
  filtrarCreditosExtraFerias,
  prepararAtualizacaoCreditoExtraFerias,
  prepararCancelamentoCreditoExtraFerias,
};

export async function vincularCreditosAoGozo({ creditosSelecionados = [], gozoFeriasId }) {
  for (const credito of creditosSelecionados) {
    if (!credito?.id) continue;
    // eslint-disable-next-line no-await-in-loop
    await atualizarEscopado('CreditoExtraFerias', credito.id, {
      status: STATUS_CREDITO_EXTRA_FERIAS.USADO,
      gozo_ferias_id: gozoFeriasId,
    });
  }
}

export async function liberarCreditosDoGozo({ gozoFeriasId, idsCreditos = null }) {
  if (!gozoFeriasId) return;

  // Leitura escopada: somente créditos do gozo informado E dentro do escopo
  // do usuário são retornados pela função de backend.
  const creditos = await invocarGetScopedCreditos({ gozo_ferias_id: gozoFeriasId });
  const idsPermitidos = idsCreditos ? new Set(idsCreditos) : null;

  for (const credito of creditos) {
    if (credito.status === STATUS_CREDITO_EXTRA_FERIAS.CANCELADO) continue;
    if (idsPermitidos && !idsPermitidos.has(credito.id)) continue;
    // eslint-disable-next-line no-await-in-loop
    await atualizarEscopado('CreditoExtraFerias', credito.id, {
      status: STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL,
      gozo_ferias_id: '',
    });
  }
}