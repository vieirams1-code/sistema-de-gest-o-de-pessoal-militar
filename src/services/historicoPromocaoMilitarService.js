import { base44 } from '@/api/base44Client';

const CAMPOS_RELEVANTES_PROMOCAO = [
  'posto_graduacao',
  'quadro',
  'data_promocao_atual',
  'antiguidade_referencia_ordem',
  'antiguidade_referencia_id',
];

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarDataISO(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return '';
  return texto.slice(0, 10);
}

function montarSnapshotPromocao(militar = {}) {
  return {
    militar_id: normalizarTexto(militar.id),
    posto_graduacao: normalizarTexto(militar.posto_graduacao),
    quadro: normalizarTexto(militar.quadro),
    data_promocao: normalizarDataISO(militar.data_promocao_atual),
    antiguidade_referencia_ordem: normalizarNumero(militar.antiguidade_referencia_ordem),
    antiguidade_referencia_id: normalizarTexto(militar.antiguidade_referencia_id),
  };
}

function houveAlteracaoRelevante(antes = {}, depois = {}) {
  return CAMPOS_RELEVANTES_PROMOCAO.some((campo) => {
    const valorAntes = campo === 'antiguidade_referencia_ordem'
      ? normalizarNumero(antes[campo])
      : normalizarTexto(antes[campo]);

    const valorDepois = campo === 'antiguidade_referencia_ordem'
      ? normalizarNumero(depois[campo])
      : normalizarTexto(depois[campo]);

    return valorAntes !== valorDepois;
  });
}

async function buscarHistoricoPorMilitar(militarId) {
  const historicoEntity = base44.entities?.HistoricoPromocaoMilitar;
  if (!historicoEntity || typeof historicoEntity.filter !== 'function') return [];

  const militarIdNormalizado = normalizarTexto(militarId);
  if (!militarIdNormalizado) return [];

  const registros = await historicoEntity.filter({ militar_id: militarIdNormalizado }, '-created_date');
  return Array.isArray(registros) ? registros : [];
}

function existeRegistroEquivalente(historico = [], snapshot = {}) {
  return historico.some((item) => (
    normalizarTexto(item?.posto_graduacao) === snapshot.posto_graduacao
    && normalizarTexto(item?.quadro) === snapshot.quadro
    && normalizarDataISO(item?.data_promocao) === snapshot.data_promocao
    && normalizarNumero(item?.antiguidade_referencia_ordem) === snapshot.antiguidade_referencia_ordem
  ));
}

function resolverCriterioPromocao({ militarAntes, militarDepois, contexto }) {
  if (contexto === 'cadastro_inicial') return 'Cadastro inicial';
  if (contexto === 'promocao_manual') return 'Promoção manual';

  const postoMudou = normalizarTexto(militarAntes?.posto_graduacao) !== normalizarTexto(militarDepois?.posto_graduacao);
  const dataMudou = normalizarDataISO(militarAntes?.data_promocao_atual) !== normalizarDataISO(militarDepois?.data_promocao_atual);

  if (postoMudou || dataMudou) return 'Atualização de promoção no cadastro';
  return 'Atualização de referência de antiguidade';
}

export async function registrarHistoricoPromocaoMilitarSeNecessario({
  militarAntes,
  militarDepois,
  userEmail,
  contexto,
}) {
  const historicoEntity = base44.entities?.HistoricoPromocaoMilitar;
  if (!historicoEntity || typeof historicoEntity.create !== 'function') return { registrou: false, motivo: 'entidade_indisponivel' };

  const snapshot = montarSnapshotPromocao(militarDepois);
  if (!snapshot.militar_id) return { registrou: false, motivo: 'militar_sem_id' };

  if (!snapshot.posto_graduacao && !snapshot.data_promocao) {
    return { registrou: false, motivo: 'sem_dados_promocao' };
  }

  const alteracaoRelevante = contexto === 'cadastro_inicial'
    ? true
    : houveAlteracaoRelevante(militarAntes, militarDepois);

  if (!alteracaoRelevante) return { registrou: false, motivo: 'sem_alteracao_relevante' };

  const historicoAtual = await buscarHistoricoPorMilitar(snapshot.militar_id);
  if (existeRegistroEquivalente(historicoAtual, snapshot)) {
    return { registrou: false, motivo: 'duplicidade_equivalente' };
  }

  await historicoEntity.create({
    militar_id: snapshot.militar_id,
    posto_graduacao: snapshot.posto_graduacao,
    quadro: snapshot.quadro,
    data_promocao: snapshot.data_promocao,
    criterio_promocao: resolverCriterioPromocao({ militarAntes, militarDepois, contexto }),
    antiguidade_referencia_ordem: snapshot.antiguidade_referencia_ordem,
    observacoes: snapshot.antiguidade_referencia_id
      ? `Referência antiguidade: ${snapshot.antiguidade_referencia_id}`
      : '',
    created_by: normalizarTexto(userEmail),
  });

  return { registrou: true, motivo: 'ok' };
}
