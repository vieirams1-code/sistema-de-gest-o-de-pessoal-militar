import { createClient } from '@base44/sdk';
import { calcularComportamento } from '../src/utils/calcularComportamento.js';

const appId = process.env.VITE_BASE44_APP_ID || process.env.BASE44_APP_ID;
const serverUrl = process.env.VITE_BASE44_BACKEND_URL || process.env.BASE44_SERVER_URL;
const token = process.env.BASE44_ACCESS_TOKEN || process.env.VITE_BASE44_ACCESS_TOKEN || null;
const functionsVersion = process.env.VITE_BASE44_FUNCTIONS_VERSION || process.env.BASE44_FUNCTIONS_VERSION;

if (!appId || !serverUrl) {
  console.error('Faltam variáveis BASE44_APP_ID/VITE_BASE44_APP_ID e BASE44_SERVER_URL/VITE_BASE44_BACKEND_URL.');
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
    autoridade_aplicadora: 'Validação Runtime',
    observacoes: `Teste runtime ${new Date().toISOString()}`,
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
      return { militar, futuro };
    }
  }
  return { militar: militares[0], futuro: null };
}

async function main() {
  const { militar, futuro } = await escolherMilitar();

  const punicao = await e.PunicaoDisciplinar.create(mkPunicao(militar));
  console.info('[JD] punicao criada', { punicao_id: punicao?.id });

  let pendencia = null;
  if (futuro?.comportamento && futuro.comportamento !== (militar.comportamento || 'Bom')) {
    pendencia = await e.PendenciaComportamento.create({
      militar_id: militar.id,
      militar_nome: militar.nome_completo,
      comportamento_atual: militar.comportamento || 'Bom',
      comportamento_sugerido: futuro.comportamento,
      fundamento_legal: futuro.fundamento,
      detalhes_calculo: JSON.stringify(futuro.detalhes || {}),
      data_detectada: hojeISO,
      status_pendencia: 'Pendente',
    });
    await e.Militar.update(militar.id, { comportamento: futuro.comportamento });
    console.info('[JD] pendencia criada', { pendencia_id: pendencia?.id, militar_id: militar.id });
  } else {
    console.warn('[JD] warning controlado: punição criada sem mudança de comportamento; pendência não era aplicável');
  }

  let card = null;
  const quadrosAtivos = await e.QuadroOperacional?.filter?.({ ativo: true }, 'ordem');
  const quadro = quadrosAtivos?.[0];
  if (!quadro?.id) {
    console.warn('[JD] warning controlado: quadro operacional ativo não encontrado, card não criado');
  } else {
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
    const cards = await e.CardOperacional.filter({ coluna_id: coluna.id, arquivado: false }, '-created_date', 500);
    card = await e.CardOperacional.create({
      coluna_id: coluna.id,
      ordem: cards.length + 1,
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
    await e.PunicaoDisciplinar.update(punicao.id, { card_operacional_id: card.id });
    console.info('[JD] card criado', { card_id: card?.id, punicao_id: punicao?.id });
  }

  const punicaoRegistro = (await e.PunicaoDisciplinar.filter({ id: punicao.id }))?.[0] || null;
  const pendenciaRegistro = pendencia ? (await e.PendenciaComportamento.filter({ id: pendencia.id }))?.[0] || null : null;
  const cardRegistro = card ? (await e.CardOperacional.filter({ id: card.id }))?.[0] || null : null;

  console.log('\n=== RESULTADO_RUNTIME ===');
  console.log(JSON.stringify({
    punicaoCriada: Boolean(punicaoRegistro),
    pendenciaCriada: Boolean(pendenciaRegistro),
    cardCriado: Boolean(cardRegistro),
    punicaoId: punicaoRegistro?.id || null,
    pendenciaId: pendenciaRegistro?.id || null,
    cardId: cardRegistro?.id || null,
  }, null, 2));
}

main().catch((error) => {
  console.error('[JD] erro em etapa: validação runtime', error?.response?.data || error?.message || error);
  process.exit(1);
});
