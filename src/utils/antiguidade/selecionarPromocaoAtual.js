const STATUS_ATIVO = 'ativo';

const valorTexto = (valor) => String(valor || '').trim();
const normalizar = (valor) => valorTexto(valor).toLowerCase();

const toTimestamp = (valor) => {
  const texto = valorTexto(valor);
  if (!texto) return Number.NEGATIVE_INFINITY;
  const ts = Date.parse(texto);
  return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
};

const toNumericId = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
};

export const compararHistoricoPromocaoMaisRecente = (a, b) => {
  const dataPromocaoDiff = toTimestamp(b?.data_promocao) - toTimestamp(a?.data_promocao);
  if (dataPromocaoDiff !== 0) return dataPromocaoDiff;

  const dataPublicacaoDiff = toTimestamp(b?.data_publicacao) - toTimestamp(a?.data_publicacao);
  if (dataPublicacaoDiff !== 0) return dataPublicacaoDiff;

  const createdAtDiff = toTimestamp(b?.created_at) - toTimestamp(a?.created_at);
  if (createdAtDiff !== 0) return createdAtDiff;

  return toNumericId(b?.id) - toNumericId(a?.id);
};

export const isHistoricoAtivo = (registro) => normalizar(registro?.status_registro || STATUS_ATIVO) === STATUS_ATIVO;

export function selecionarPromocaoAtualEAnteriores({ historicoPromocoes = [], militar } = {}) {
  const militarId = valorTexto(militar?.id);
  const historicosDoMilitar = (historicoPromocoes || []).filter((registro) => (
    militarId ? valorTexto(registro?.militar_id) === militarId : true
  ));

  const ativosOrdenados = historicosDoMilitar
    .filter(isHistoricoAtivo)
    .sort(compararHistoricoPromocaoMaisRecente);

  const promocaoAtual = ativosOrdenados[0] || null;
  const promocoesAnteriores = ativosOrdenados.slice(1);

  const motivoEscolha = promocaoAtual
    ? 'historico_ativo_mais_recente_por_data_promocao_data_publicacao_created_at_id'
    : 'fallback_militar_posto_graduacao_sem_historico_ativo';

  return {
    promocaoAtual,
    promocoesAnteriores,
    ativosOrdenados,
    motivoEscolha,
  };
}
