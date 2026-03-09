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

async function sincronizarCamposCardJiso(card, atestado) {
  if (!card?.id) return;

  const payload = {
    titulo: `JISO - ${atestado.militar_nome || 'Militar'}`,
    descricao: montarDescricaoAtestado(atestado),
    militar_nome_snapshot: atestado.militar_nome || '',
    prazo: atestado.data_jiso_agendada || '',
    referencia_externa_id: atestado.id,
    protocolo: `ATESTADO:${atestado.id}`,
  };

  await base44.entities.CardOperacional.update(card.id, payload);
}

export async function sincronizarAtestadoJisoNoQuadro(atestado) {
  if (!atestado?.id || !precisaAutomacaoJiso(atestado)) return;

  const quadrosAtivos = await base44.entities.QuadroOperacional.filter({ ativo: true }, 'ordem');
  const quadro = quadrosAtivos[0];
  if (!quadro?.id) return;

  const colunas = await base44.entities.ColunaOperacional.filter({ quadro_id: quadro.id, ativa: true }, 'ordem');
  const colunaJiso = colunas.find((coluna) => (coluna.nome || '').trim().toUpperCase() === 'JISO');
  if (!colunaJiso?.id) return;

  const vinculosExistentes = await base44.entities.CardVinculo.filter({ tipo_vinculo: 'Atestado', referencia_id: atestado.id });
  if (vinculosExistentes.length > 0) {
    const cardsVinculados = await base44.entities.CardOperacional.filter({
      id: { in: vinculosExistentes.map((vinculo) => vinculo.card_id).filter(Boolean) },
    });

    const cardJisoVinculado = cardsVinculados.find((card) => !card.arquivado);
    if (cardJisoVinculado?.id) {
      await sincronizarCamposCardJiso(cardJisoVinculado, atestado);
      return;
    }
  }

  const cards = await base44.entities.CardOperacional.filter({ arquivado: false }, '-created_date', 500);
  const cardJaCriado = cards.find((card) =>
    card.origem_tipo === 'Atestado/JISO' &&
    (card.referencia_externa_id === atestado.id || card.protocolo === `ATESTADO:${atestado.id}`)
  );

  if (cardJaCriado?.id) {
    await sincronizarCamposCardJiso(cardJaCriado, atestado);

    await base44.entities.CardVinculo.create({
      card_id: cardJaCriado.id,
      tipo_vinculo: 'Atestado',
      referencia_id: atestado.id,
      titulo_vinculo: `Atestado ${atestado.militar_nome || ''}`.trim(),
    });
    return;
  }

  const cardsDaColuna = cards.filter((card) => card.coluna_id === colunaJiso.id);
  const ordem = cardsDaColuna.length + 1;

  const card = await base44.entities.CardOperacional.create({
    titulo: `JISO - ${atestado.militar_nome || 'Militar'}`,
    descricao: montarDescricaoAtestado(atestado),
    coluna_id: colunaJiso.id,
    ordem,
    status: 'Ativo',
    arquivado: false,
    criado_automaticamente: true,
    origem_tipo: 'Atestado/JISO',
    militar_nome_snapshot: atestado.militar_nome || '',
    prazo: atestado.data_jiso_agendada || '',
    comentarios_count: 1,
    protocolo: `ATESTADO:${atestado.id}`,
    referencia_externa_id: atestado.id,
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
