import { base44 } from '@/api/base44Client';
import { calcularComportamento } from '@/utils/calcularComportamento';

const TIPOS_COM_DIAS_OBRIGATORIO = new Set(['Detenção', 'Prisão', 'Prisão em Separado']);

export function getPunicaoEntity() {
  return base44.entities.PunicaoDisciplinar || base44.entities.Punicao;
}

export function validarPunicaoDisciplinar(payload) {
  const tipo = payload?.tipo_punicao;
  const dias = Number(payload?.dias_punicao || 0);
  const inicio = payload?.data_inicio_cumprimento || null;
  const fim = payload?.data_fim_cumprimento || null;
  const agravada = Boolean(payload?.agravada_prisao_em_separado);

  if (TIPOS_COM_DIAS_OBRIGATORIO.has(tipo) && dias <= 0) {
    throw new Error(`${tipo} exige quantidade de dias de punição.`);
  }

  if (!TIPOS_COM_DIAS_OBRIGATORIO.has(tipo) && payload?.dias_punicao && dias < 0) {
    throw new Error('Dias de punição não pode ser negativo.');
  }

  if (inicio && fim && new Date(fim) < new Date(inicio)) {
    throw new Error('Data fim de cumprimento não pode ser anterior à data de início.');
  }

  if (agravada && tipo !== 'Prisão em Separado') {
    throw new Error('Agravamento somente pode ser marcado para "Prisão em Separado".');
  }
}

export async function recalcularComportamentoEMarcarPendencia(militarId, motivo) {
  if (!militarId) return;

  const [militar] = await base44.entities.Militar.filter({ id: militarId });
  if (!militar) return;

  const entity = getPunicaoEntity();
  const punicoes = await entity.filter({ militar_id: militarId });
  const resultado = calcularComportamento(punicoes, militar.posto_graduacao, new Date(), {
    dataInclusaoMilitar: militar.data_inclusao,
  });

  if (!resultado?.comportamento) return;

  if (resultado.comportamento !== militar.comportamento) {
    await base44.entities.PendenciaComportamento.create({
      militar_id: militar.id,
      militar_nome: militar.nome_completo,
      comportamento_atual: militar.comportamento || 'Bom',
      comportamento_sugerido: resultado.comportamento,
      fundamento_legal: resultado.fundamento,
      detalhes_calculo: JSON.stringify(resultado.detalhes || {}),
      data_detectada: new Date().toISOString().slice(0, 10),
      status_pendencia: 'Pendente',
    });

    await base44.entities.Militar.update(militar.id, {
      comportamento: resultado.comportamento,
    });

    await base44.entities.HistoricoComportamento.create({
      militar_id: militar.id,
      comportamento_anterior: militar.comportamento || 'Bom',
      comportamento_novo: resultado.comportamento,
      fundamento_legal: resultado.fundamento,
      motivo,
      data_alteracao: new Date().toISOString().slice(0, 10),
    });
  }
}

export async function criarCardPunicaoNoQuadro(punicao) {
  const quadrosAtivos = await base44.entities.QuadroOperacional.filter({ ativo: true }, 'ordem');
  const quadro = quadrosAtivos[0];
  if (!quadro?.id) return null;

  const colunas = await base44.entities.ColunaOperacional.filter({ quadro_id: quadro.id, ativa: true }, 'ordem');
  let colunaPunicoes = colunas.find((c) => (c.nome || '').trim().toUpperCase() === 'PUNIÇÕES');

  if (!colunaPunicoes) {
    colunaPunicoes = await base44.entities.ColunaOperacional.create({
      quadro_id: quadro.id,
      nome: 'PUNIÇÕES',
      cor: '#dc2626',
      ordem: (colunas.at(-1)?.ordem || colunas.length) + 1,
      fixa: true,
      ativa: true,
      origem_coluna: 'automacao',
    });
  }

  const cards = await base44.entities.CardOperacional.filter({ coluna_id: colunaPunicoes.id, arquivado: false }, '-created_date', 500);
  const ordem = cards.length + 1;
  const titulo = `Punição - ${punicao.posto_graduacao || ''} ${punicao.militar_nome || ''}`.trim();

  const card = await base44.entities.CardOperacional.create({
    coluna_id: colunaPunicoes.id,
    ordem,
    titulo,
    tipo: 'Punição',
    origem_tipo: 'Punição',
    referencia_externa_id: punicao.id,
    militar_nome_snapshot: punicao.militar_nome || '',
    descricao: [
      `Tipo: ${punicao.tipo_punicao || '-'}`,
      `Dias: ${punicao.dias_punicao || 0}`,
      `Início: ${punicao.data_inicio_cumprimento || '-'}`,
      `Fim: ${punicao.data_fim_cumprimento || '-'}`,
      `Status: ${punicao.status_punicao || '-'}`,
    ].join('\n'),
    status: 'Ativo',
    arquivado: false,
    criado_automaticamente: true,
    protocolo: `PUNICAO:${punicao.id}`,
  });

  await base44.entities.CardVinculo.create({
    card_id: card.id,
    tipo_vinculo: 'PunicaoDisciplinar',
    referencia_id: punicao.id,
    titulo_vinculo: titulo,
  });

  return card;
}
