import { selecionarHistoricoAtivoMaisRecente } from './selecionarHistoricoAtivoMaisRecente.js';
import { getPostoGraduacaoMilitar, getQuadroMilitar } from '../militarPostoGraduacao.js';

export function montarDivergenciasPromocao({ militares = [], historicos = [] } = {}) {
  const porMilitar = new Map();
  for (const h of historicos) {
    if (!h?.militar_id) continue;
    if (!porMilitar.has(h.militar_id)) porMilitar.set(h.militar_id, []);
    porMilitar.get(h.militar_id).push(h);
  }

  return militares.flatMap((militar) => {
    const historico = selecionarHistoricoAtivoMaisRecente(porMilitar.get(militar.id) || []);
    if (!historico) return [];

    const postoAtual = getPostoGraduacaoMilitar(militar);
    const quadroAtual = getQuadroMilitar(militar);

    const divergePosto = (postoAtual || '') !== (historico.posto_graduacao_novo || '');
    const divergeQuadro = (quadroAtual || '') !== (historico.quadro_novo || '');

    if (!divergePosto && !divergeQuadro) return [];
    return [{ militar_id: militar.id, historico_id: historico.id, militar, historico }];
  });
}

export function construirPayloadSincronizacaoPromocao(historico = {}) {
  return { posto_graduacao: historico.posto_graduacao_novo, quadro: historico.quadro_novo };
}
