import { base44 } from '@/api/base44Client';
import { calcularComportamento } from '@/utils/calcularComportamento';

const TIPOS_COM_DIAS_OBRIGATORIO = new Set(['Detenção', 'Prisão', 'Prisão em Separado']);

function getEntitySafe(nome) {
  const entity = base44.entities?.[nome];
  return entity && typeof entity === 'object' ? entity : null;
}

function hasEntityMethod(entity, method) {
  return Boolean(entity && typeof entity[method] === 'function');
}

async function validarCamposEmAmostra(entity, campos, descricao) {
  if (!hasEntityMethod(entity, 'list')) {
    return { descricao, validado: false, motivo: 'método list indisponível' };
  }

  const registros = await entity.list('-created_date', 1);
  const amostra = registros?.[0];
  if (!amostra) {
    return { descricao, validado: false, motivo: 'sem registros para validar campos' };
  }

  const ausentes = campos.filter((campo) => !(campo in amostra));
  return {
    descricao,
    validado: ausentes.length === 0,
    ausentes,
    motivo: ausentes.length ? 'campos ausentes em amostra' : 'ok',
  };
}

export async function diagnosticarFluxoPunicaoRuntime() {
  const diagnostico = {
    entidades: {
      PunicaoDisciplinar: Boolean(getEntitySafe('PunicaoDisciplinar')),
      PendenciaComportamento: Boolean(getEntitySafe('PendenciaComportamento')),
      Militar: Boolean(getEntitySafe('Militar')),
      CardOperacional: Boolean(getEntitySafe('CardOperacional')),
      ColunaOperacional: Boolean(getEntitySafe('ColunaOperacional')),
    },
    campos: [],
  };

  const pendenciaEntity = getEntitySafe('PendenciaComportamento');
  const militarEntity = getEntitySafe('Militar');
  const cardEntity = getEntitySafe('CardOperacional');
  const colunaEntity = getEntitySafe('ColunaOperacional');

  diagnostico.campos.push(
    await validarCamposEmAmostra(militarEntity, ['id', 'nome_completo', 'posto_graduacao', 'comportamento', 'data_inclusao'], 'Militar'),
    await validarCamposEmAmostra(pendenciaEntity, ['militar_id', 'militar_nome', 'comportamento_atual', 'comportamento_sugerido', 'fundamento_legal', 'status_pendencia'], 'PendenciaComportamento'),
    await validarCamposEmAmostra(cardEntity, ['coluna_id', 'ordem', 'titulo', 'tipo', 'status', 'arquivado'], 'CardOperacional'),
    await validarCamposEmAmostra(colunaEntity, ['quadro_id', 'nome', 'ordem', 'ativa'], 'ColunaOperacional'),
  );

  return diagnostico;
}

export function getPunicaoEntity() {
  const entity = base44.entities.PunicaoDisciplinar;
  if (!entity) {
    throw new Error('Entidade PunicaoDisciplinar não encontrada. Verifique o schema do app.');
  }
  return entity;
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

  const militarEntity = getEntitySafe('Militar');
  if (!hasEntityMethod(militarEntity, 'filter')) {
    console.warn('[JD] erro em etapa: entidade Militar indisponível para recálculo');
    return;
  }

  const [militar] = await militarEntity.filter({ id: militarId });
  if (!militar) return;

  const entity = getPunicaoEntity();
  const punicoes = await entity.filter({ militar_id: militarId });
  const resultado = calcularComportamento(punicoes, militar.posto_graduacao, new Date(), {
    dataInclusaoMilitar: militar.data_inclusao,
  });

  if (!resultado?.comportamento) return;

  if (resultado.comportamento !== militar.comportamento) {
    const pendenciaEntity = getEntitySafe('PendenciaComportamento');
    const historicoEntity = getEntitySafe('HistoricoComportamento');

    if (!hasEntityMethod(pendenciaEntity, 'create')) {
      console.warn('[JD] erro em etapa: entidade PendenciaComportamento indisponível');
      return;
    }

    await pendenciaEntity.create({
      militar_id: militar.id,
      militar_nome: militar.nome_completo,
      comportamento_atual: militar.comportamento || 'Bom',
      comportamento_sugerido: resultado.comportamento,
      fundamento_legal: resultado.fundamento,
      detalhes_calculo: JSON.stringify(resultado.detalhes || {}),
      data_detectada: new Date().toISOString().slice(0, 10),
      status_pendencia: 'Pendente',
    });
    console.info('[JD] pendencia criada', { militar_id: militar.id, comportamento_sugerido: resultado.comportamento });

    await militarEntity.update(militar.id, {
      comportamento: resultado.comportamento,
    });

    if (hasEntityMethod(historicoEntity, 'create')) {
      await historicoEntity.create({
        militar_id: militar.id,
        comportamento_anterior: militar.comportamento || 'Bom',
        comportamento_novo: resultado.comportamento,
        fundamento_legal: resultado.fundamento,
        motivo,
        data_alteracao: new Date().toISOString().slice(0, 10),
      });
    }
  }
}

export async function criarCardPunicaoNoQuadro(punicao) {
  const quadroEntity = getEntitySafe('QuadroOperacional');
  const colunaEntity = getEntitySafe('ColunaOperacional');
  const cardEntity = getEntitySafe('CardOperacional');
  const cardVinculoEntity = getEntitySafe('CardVinculo');

  if (!hasEntityMethod(quadroEntity, 'filter')) {
    console.warn('[JD] erro em etapa: entidade QuadroOperacional indisponível, card não será criado');
    return null;
  }

  if (!hasEntityMethod(colunaEntity, 'filter')) {
    console.warn('[JD] erro em etapa: entidade ColunaOperacional indisponível, card não será criado');
    return null;
  }

  if (!hasEntityMethod(cardEntity, 'create')) {
    console.warn('[JD] erro em etapa: entidade CardOperacional indisponível, card não será criado');
    return null;
  }

  const quadrosAtivos = await quadroEntity.filter({ ativo: true }, 'ordem');
  const quadro = quadrosAtivos[0];
  if (!quadro?.id) return null;

  const colunas = await colunaEntity.filter({ quadro_id: quadro.id, ativa: true }, 'ordem');
  let colunaPunicoes = colunas.find((c) => (c.nome || '').trim().toUpperCase() === 'PUNIÇÕES');

  if (!colunaPunicoes) {
    if (!hasEntityMethod(colunaEntity, 'create')) {
      console.warn('[JD] erro em etapa: não foi possível criar coluna de punições');
      return null;
    }

    colunaPunicoes = await colunaEntity.create({
      quadro_id: quadro.id,
      nome: 'PUNIÇÕES',
      cor: '#dc2626',
      ordem: (colunas.at(-1)?.ordem || colunas.length) + 1,
      fixa: true,
      ativa: true,
      origem_coluna: 'automacao',
    });
  }

  const cards = await cardEntity.filter({ coluna_id: colunaPunicoes.id, arquivado: false }, '-created_date', 500);
  const ordem = cards.length + 1;
  const titulo = `Punição - ${punicao.posto_graduacao || ''} ${punicao.militar_nome || ''}`.trim();

  const card = await cardEntity.create({
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
  console.info('[JD] card criado', { card_id: card?.id, punicao_id: punicao?.id });

  if (hasEntityMethod(cardVinculoEntity, 'create')) {
    await cardVinculoEntity.create({
      card_id: card.id,
      tipo_vinculo: 'PunicaoDisciplinar',
      referencia_id: punicao.id,
      titulo_vinculo: titulo,
    });
  }

  return card;
}
