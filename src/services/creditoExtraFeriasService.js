import { base44 } from '../api/base44Client.js';
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


export async function listarCreditosExtraFerias(orderBy = '-data_referencia') {
  return base44.entities.CreditoExtraFerias.list(orderBy);
}

export async function salvarCreditoExtraFerias({ form, militar }) {
  const payload = criarPayloadCreditoExtraFerias(form, militar);

  if (form?.id) {
    return base44.entities.CreditoExtraFerias.update(form.id, payload);
  }

  return base44.entities.CreditoExtraFerias.create(payload);
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
    // eslint-disable-next-line no-await-in-loop
    await base44.entities.CreditoExtraFerias.update(credito.id, {
      status: STATUS_CREDITO_EXTRA_FERIAS.USADO,
      gozo_ferias_id: gozoFeriasId,
    });
  }
}

export async function liberarCreditosDoGozo({ gozoFeriasId, idsCreditos = null }) {
  const creditos = await base44.entities.CreditoExtraFerias.filter({ gozo_ferias_id: gozoFeriasId });
  const idsPermitidos = idsCreditos ? new Set(idsCreditos) : null;

  for (const credito of creditos) {
    if (credito.status === STATUS_CREDITO_EXTRA_FERIAS.CANCELADO) continue;
    if (idsPermitidos && !idsPermitidos.has(credito.id)) continue;
    // eslint-disable-next-line no-await-in-loop
    await base44.entities.CreditoExtraFerias.update(credito.id, {
      status: STATUS_CREDITO_EXTRA_FERIAS.DISPONIVEL,
      gozo_ferias_id: '',
    });
  }
}
