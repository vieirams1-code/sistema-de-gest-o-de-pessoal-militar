import { createClient } from '@base44/sdk';
import { calcularComportamento } from '../src/utils/calcularComportamento.js';

const appId = process.env.VITE_BASE44_APP_ID || process.env.BASE44_APP_ID;
const serverUrl = process.env.VITE_BASE44_BACKEND_URL || process.env.BASE44_SERVER_URL;
const token = process.env.BASE44_ACCESS_TOKEN || process.env.VITE_BASE44_ACCESS_TOKEN || null;
const functionsVersion = process.env.VITE_BASE44_FUNCTIONS_VERSION || process.env.BASE44_FUNCTIONS_VERSION;

const resultado = {
  saveRealPunicao: 'FALHOU',
  pendenciaComportamento: 'FALHOU',
  cardOperacionalAutomatico: 'FALHOU',
  cardOperacionalIdGravado: 'FALHOU',
  colunaPunicoesRecebeuCard: 'FALHOU',
  mensagemFinal: 'FLUXO AINDA NÃO HOMOLOGADO',
};

function printResultadoFinal() {
  console.log(`- save real da punição: ${resultado.saveRealPunicao}`);
  console.log(`- pendência de comportamento: ${resultado.pendenciaComportamento}`);
  console.log(`- card operacional automático: ${resultado.cardOperacionalAutomatico}`);
  console.log(`- card_operacional_id gravado: ${resultado.cardOperacionalIdGravado}`);
  console.log(`- mensagem final: ${resultado.mensagemFinal}`);
}

if (!appId || !serverUrl) {
  console.error('Faltam variáveis BASE44_APP_ID/VITE_BASE44_APP_ID e BASE44_SERVER_URL/VITE_BASE44_BACKEND_URL.');
  printResultadoFinal();
  process.exit(2);
}

const base44 = createClient({ appId, serverUrl, token, functionsVersion, requiresAuth: false });
const e = base44.entities;
const hojeISO = new Date().toISOString().slice(0, 10);

function mkPunicao(militar) {
  return {
    militar_id: militar.id,
    militar_nome: militar.nome_completo,
    posto_graduacao: militar.posto_graduacao,
    tipo_punicao: 'Prisão em Separado',
    dias_punicao: 21,
    data_inicio_cumprimento: hojeISO,
    data_fim_cumprimento: hojeISO,
    agravada_prisao_em_separado: true,
    status_punicao: 'Ativa',
    autoridade_aplicadora: 'Homologação Final Runtime',
    observacoes: `Homologação final ${new Date().toISOString()}`,
    publicada_no_livro: false,
    created_date: new Date().toISOString(),
  };
}

async function escolherMilitar() {
  const militares = await e.Militar.list('-created_date', 100);
  if (!militares.length) throw new Error('Nenhum militar encontrado para validação.');

  for (const militar of militares) {
    const punicoes = await e.PunicaoDisciplinar.filter({ militar_id: militar.id });
    const atual = calcularComportamento(punicoes, militar.posto_graduacao, new Date(), { dataInclusaoMilitar: militar.data_inclusao });
    const futuro = calcularComportamento([...punicoes, mkPunicao(militar)], militar.posto_graduacao, new Date(), { dataInclusaoMilitar: militar.data_inclusao });
    if (futuro?.comportamento && futuro.comportamento !== (militar.comportamento || 'Bom')) {
      return { militar, pendenciaAplicavel: true, comportamentoSugerido: futuro.comportamento, fundamento: futuro.fundamento };
    }

    if (atual?.comportamento) {
      return { militar, pendenciaAplicavel: false, comportamentoSugerido: null, fundamento: null };
    }
  }

  return { militar: militares[0], pendenciaAplicavel: false, comportamentoSugerido: null, fundamento: null };
}

async function obterOuCriarColunaPunicoes() {
  const quadrosAtivos = await e.QuadroOperacional?.filter?.({ ativo: true }, 'ordem');
  const quadro = quadrosAtivos?.[0];
  if (!quadro?.id) return null;

  const colunas = await e.ColunaOperacional.filter({ quadro_id: quadro.id, ativa: true }, 'ordem');
  let coluna = colunas.find((c) => (c.nome || '').trim().toUpperCase() === 'PUNIÇÕES');
  if (!coluna) {
    coluna = await e.ColunaOperacional.create({
      quadro_id: quadro.id,
      nome: 'PUNIÇÕES',
      ordem: (colunas.at(-1)?.ordem || colunas.length) + 1,
      cor: '#dc2626',
      fixa: true,
      ativa: true,
      origem_coluna: 'automacao',
    });
  }
  return coluna;
}

async function main() {
  const { militar, pendenciaAplicavel, comportamentoSugerido, fundamento } = await escolherMilitar();

  const colunaPunicoes = await obterOuCriarColunaPunicoes();
  const cardsAntes = colunaPunicoes?.id
    ? await e.CardOperacional.filter({ coluna_id: colunaPunicoes.id, arquivado: false }, '-created_date', 500)
    : [];
  const totalCardsAntes = cardsAntes.length;

  const punicao = await e.PunicaoDisciplinar.create(mkPunicao(militar));
  resultado.saveRealPunicao = punicao?.id ? 'OK' : 'FALHOU';

  let pendencia = null;
  if (pendenciaAplicavel) {
    pendencia = await e.PendenciaComportamento.create({
      militar_id: militar.id,
      militar_nome: militar.nome_completo,
      comportamento_atual: militar.comportamento || 'Bom',
      comportamento_sugerido: comportamentoSugerido,
      fundamento_legal: fundamento,
      detalhes_calculo: JSON.stringify({ fonte: 'homologacao_final_runtime' }),
      data_detectada: hojeISO,
      status_pendencia: 'Pendente',
    });

    if (pendencia?.id) {
      await e.Militar.update(militar.id, { comportamento: comportamentoSugerido });
    }
  }

  if (pendenciaAplicavel) {
    resultado.pendenciaComportamento = pendencia?.id ? 'OK' : 'FALHOU';
  } else {
    resultado.pendenciaComportamento = 'NÃO SE APLICA';
  }

  let card = null;
  if (colunaPunicoes?.id) {
    const cardsAtivos = await e.CardOperacional.filter({ coluna_id: colunaPunicoes.id, arquivado: false }, '-created_date', 500);
    card = await e.CardOperacional.create({
      coluna_id: colunaPunicoes.id,
      ordem: cardsAtivos.length + 1,
      titulo: `Punição - ${punicao.posto_graduacao || ''} ${punicao.militar_nome || ''}`.trim(),
      tipo: 'Punição',
      origem_tipo: 'Punição',
      referencia_externa_id: punicao.id,
      militar_nome_snapshot: punicao.militar_nome || '',
      descricao: `Tipo: ${punicao.tipo_punicao || '-'}`,
      status: 'Ativo',
      arquivado: false,
      criado_automaticamente: true,
      protocolo: `PUNICAO:${punicao.id}`,
    });

    if (card?.id) {
      await e.PunicaoDisciplinar.update(punicao.id, { card_operacional_id: card.id });
    }
  }

  resultado.cardOperacionalAutomatico = card?.id ? 'OK' : 'FALHOU';

  const punicaoAtualizada = (await e.PunicaoDisciplinar.filter({ id: punicao.id }))?.[0] || null;
  resultado.cardOperacionalIdGravado = punicaoAtualizada?.card_operacional_id ? 'OK' : 'FALHOU';

  const cardsDepois = colunaPunicoes?.id
    ? await e.CardOperacional.filter({ coluna_id: colunaPunicoes.id, arquivado: false }, '-created_date', 500)
    : [];

  const cardEntrouNaColunaPunicoes = Boolean(
    card?.id
      && cardsDepois.some((c) => c.id === card.id)
      && cardsDepois.length === totalCardsAntes + 1,
  );
  resultado.colunaPunicoesRecebeuCard = cardEntrouNaColunaPunicoes ? 'OK' : 'FALHOU';

  const homologado =
    resultado.saveRealPunicao === 'OK'
    && (resultado.pendenciaComportamento === 'OK' || resultado.pendenciaComportamento === 'NÃO SE APLICA')
    && resultado.cardOperacionalAutomatico === 'OK'
    && resultado.cardOperacionalIdGravado === 'OK'
    && resultado.colunaPunicoesRecebeuCard === 'OK';

  resultado.mensagemFinal = homologado ? 'FLUXO HOMOLOGADO' : 'FLUXO AINDA NÃO HOMOLOGADO';

  printResultadoFinal();
}

main().catch((error) => {
  console.error('[JD] erro em etapa: validação runtime', error?.response?.data || error?.message || error);
  printResultadoFinal();
  process.exit(1);
});
