import { base44 } from '@/api/base44Client';

export const CHECKLIST_PRESETS = {
  JISO: [
    'Conferir atestado',
    'Verificar necessidade de inspeção',
    'Agendar data JISO',
    'Lançar resultado',
    'Conferir publicação',
  ],
  Atestado: [
    'Conferir documento',
    'Validar datas',
    'Lançar no sistema',
    'Publicar',
    'Arquivar',
  ],
  'Férias': [
    'Conferir período',
    'Validar cadeia',
    'Lançar no livro',
    'Conferir publicação',
    'Atualizar ficha',
  ],
  Processo: [
    'Abrir processo',
    'Registrar movimentação',
    'Controlar prazo',
    'Produzir documento',
    'Encerrar pendência',
  ],
  Assinatura: [
    'Imprimir documento',
    'Coletar assinatura',
    'Conferir devolução',
    'Arquivar',
  ],
};

export function buildChecklistResumo(items = []) {
  const total = items.length;
  const concluidos = items.filter((item) => item.concluido).length;
  return `${concluidos}/${total}`;
}

export async function criarChecklistPreset(cardId, preset) {
  const itens = CHECKLIST_PRESETS[preset] || [];
  if (!itens.length) return;

  await Promise.all(
    itens.map((titulo, index) =>
      base44.entities.CardChecklistItem.create({
        card_id: cardId,
        titulo,
        concluido: false,
        ordem: index + 1,
      })
    )
  );

  await base44.entities.CardOperacional.update(cardId, {
    checklist_resumo: `0/${itens.length}`,
  });
}

function precisaAutomacaoJiso(atestado) {
  return atestado?.fluxo_homologacao === 'jiso' || atestado?.necessita_jiso === true;
}

function montarDescricaoAtestado(atestado) {
  const dias = atestado?.dias ? `${atestado.dias} dia(s)` : 'sem dias informados';
  const inicio = atestado?.data_inicio || '-';
  const termino = atestado?.data_termino || '-';
  return `Atestado com necessidade de JISO.\nPeríodo: ${inicio} até ${termino}.\nDuração: ${dias}.`;
}

function buildCardPayloadFromAtestado(atestado) {
  return {
    titulo: `JISO - ${atestado.militar_nome || 'Militar'}`,
    descricao: montarDescricaoAtestado(atestado),
    militar_nome_snapshot: atestado.militar_nome || '',
    prazo: atestado.data_jiso_agendada || '',
    protocolo: `ATESTADO:${atestado.id}`,
    referencia_externa_id: atestado.id,
  };
}

async function encontrarCardJisoVinculado(atestadoId) {
  const vinculos = await base44.entities.CardVinculo.filter({ tipo_vinculo: 'Atestado', referencia_id: atestadoId });
  if (vinculos.length > 0) {
    const card = await base44.entities.CardOperacional.get(vinculos[0].card_id);
    if (card?.id) return card;
  }

  const cards = await base44.entities.CardOperacional.filter({ arquivado: false }, '-created_date', 500);
  return cards.find((card) =>
    card.origem_tipo === 'Atestado/JISO' &&
    (card.referencia_externa_id === atestadoId || card.protocolo === `ATESTADO:${atestadoId}`)
  );
}

export async function sincronizarDataJisoCardAtestado({ cardId, atestadoId, dataJiso }) {
  if (!cardId || !atestadoId) return;

  await Promise.all([
    base44.entities.CardOperacional.update(cardId, { prazo: dataJiso || '' }),
    base44.entities.Atestado.update(atestadoId, { data_jiso_agendada: dataJiso || '' }),
  ]);
}

export async function sincronizarAtestadoJisoNoQuadro(atestado) {
  if (!atestado?.id || !precisaAutomacaoJiso(atestado)) return;

  const quadrosAtivos = await base44.entities.QuadroOperacional.filter({ ativo: true }, 'ordem');
  const quadro = quadrosAtivos[0];
  if (!quadro?.id) return;

  const colunas = await base44.entities.ColunaOperacional.filter({ quadro_id: quadro.id, ativa: true }, 'ordem');
  const colunaJiso = colunas.find((coluna) => (coluna.nome || '').trim().toUpperCase() === 'JISO');
  if (!colunaJiso?.id) return;

  const cardExistente = await encontrarCardJisoVinculado(atestado.id);
  const payloadBase = buildCardPayloadFromAtestado(atestado);

  if (cardExistente?.id) {
    const payloadAtualizacao = {
      ...payloadBase,
      origem_tipo: 'Atestado/JISO',
      criado_automaticamente: true,
    };

    if (cardExistente.coluna_id !== colunaJiso.id) {
      payloadAtualizacao.coluna_id = colunaJiso.id;
    }

    await base44.entities.CardOperacional.update(cardExistente.id, payloadAtualizacao);

    const vinculosExistentes = await base44.entities.CardVinculo.filter({ tipo_vinculo: 'Atestado', referencia_id: atestado.id });
    const jaVinculado = vinculosExistentes.some((v) => v.card_id === cardExistente.id);
    if (!jaVinculado) {
      await base44.entities.CardVinculo.create({
        card_id: cardExistente.id,
        tipo_vinculo: 'Atestado',
        referencia_id: atestado.id,
        titulo_vinculo: `Atestado ${atestado.militar_nome || ''}`.trim(),
      });
    }
    return;
  }

  const cards = await base44.entities.CardOperacional.filter({ arquivado: false }, '-created_date', 500);
  const cardsDaColuna = cards.filter((card) => card.coluna_id === colunaJiso.id);
  const ordem = cardsDaColuna.length + 1;

  const card = await base44.entities.CardOperacional.create({
    ...payloadBase,
    coluna_id: colunaJiso.id,
    ordem,
    status: 'Ativo',
    arquivado: false,
    criado_automaticamente: true,
    origem_tipo: 'Atestado/JISO',
    comentarios_count: 1,
  });

  await base44.entities.CardComentario.create({
    card_id: card.id,
    mensagem: 'Card criado automaticamente a partir de atestado com necessidade de JISO.',
    tipo_registro: 'Sistema',
    data_hora: new Date().toISOString(),
    origem_automatica: true,
    autor_nome: 'Sistema',
  });

  await criarChecklistPreset(card.id, 'JISO');

  await base44.entities.CardVinculo.create({
    card_id: card.id,
    tipo_vinculo: 'Atestado',
    referencia_id: atestado.id,
    titulo_vinculo: `Atestado ${atestado.militar_nome || ''}`.trim(),
  });
}
