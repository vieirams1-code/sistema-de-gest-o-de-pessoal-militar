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


export async function registrarEventoHistoricoComportamento({
  militarId,
  dataEvento,
  tipoEvento,
  comportamentoAnterior,
  comportamentoNovo,
  fundamentoLegal,
  origemTipo,
  origemId,
  observacoes,
  createdBy,
}) {
  if (!militarId || !tipoEvento) return null;

  const historicoEntity = getEntitySafe('HistoricoComportamento');
  if (!hasEntityMethod(historicoEntity, 'create')) return null;

  return historicoEntity.create({
    militar_id: militarId,
    data_evento: dataEvento || new Date().toISOString().slice(0, 10),
    tipo_evento: tipoEvento,
    comportamento_anterior: comportamentoAnterior || '',
    comportamento_novo: comportamentoNovo || '',
    fundamento_legal: fundamentoLegal || '',
    origem_tipo: origemTipo || '',
    origem_id: origemId || '',
    observacoes: observacoes || '',
    created_by: createdBy || '',
  });
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
  if (!militarId) return { executado: false, motivo: 'militar_id_ausente' };

  const militarEntity = getEntitySafe('Militar');
  if (!hasEntityMethod(militarEntity, 'filter')) {
    console.warn('[JD] erro em etapa: entidade Militar indisponível para recálculo');
    return { executado: false, motivo: 'entidade_militar_indisponivel' };
  }

  const [militar] = await militarEntity.filter({ id: militarId });
  if (!militar) return { executado: false, motivo: 'militar_nao_encontrado' };

  const entity = getPunicaoEntity();
  const punicoes = await entity.filter({ militar_id: militarId });
  const resultado = calcularComportamento(punicoes, militar.posto_graduacao, new Date(), {
    dataInclusaoMilitar: militar.data_inclusao,
  });

  if (!resultado?.comportamento) return { executado: false, motivo: 'calculo_sem_resultado' };

  if (resultado.comportamento !== militar.comportamento) {
    const pendenciaEntity = getEntitySafe('PendenciaComportamento');
    const historicoEntity = getEntitySafe('HistoricoComportamento');

    if (!hasEntityMethod(pendenciaEntity, 'create')) {
      console.warn('[JD] erro em etapa: entidade PendenciaComportamento indisponível');
      return {
        executado: false,
        pendenciaEsperada: true,
        pendenciaCriada: false,
        motivo: 'entidade_pendencia_indisponivel',
      };
    }

    const payloadPendencia = {
      militar_id: militar.id,
      militar_nome: militar.nome_completo,
      comportamento_atual: militar.comportamento || 'Bom',
      comportamento_sugerido: resultado.comportamento,
      fundamento_legal: resultado.fundamento,
      detalhes_calculo: JSON.stringify(resultado.detalhes || {}),
      data_detectada: new Date().toISOString().slice(0, 10),
      status_pendencia: 'Pendente',
    };

    let pendenciaCriada = false;
    try {
      await pendenciaEntity.create(payloadPendencia);
      pendenciaCriada = true;
    } catch (error) {
      if (hasEntityMethod(pendenciaEntity, 'filter')) {
        const existentes = await pendenciaEntity.filter({
          militar_id: militar.id,
          status_pendencia: 'Pendente',
          comportamento_sugerido: resultado.comportamento,
        });
        pendenciaCriada = existentes.length > 0;
      }
      if (!pendenciaCriada) throw error;
    }
    console.info('[JD] pendencia criada', { militar_id: militar.id, comportamento_sugerido: resultado.comportamento });

    if (hasEntityMethod(historicoEntity, 'create')) {
      await registrarEventoHistoricoComportamento({
        militarId: militar.id,
        tipoEvento: 'Recalculo',
        comportamentoAnterior: militar.comportamento || 'Bom',
        comportamentoNovo: resultado.comportamento,
        fundamentoLegal: resultado.fundamento,
        origemTipo: 'PendenciaComportamento',
        observacoes: motivo,
      });
    }

    return {
      executado: true,
      pendenciaEsperada: true,
      pendenciaCriada: true,
      comportamentoSugerido: resultado.comportamento,
    };
  }

  return { executado: true, pendenciaEsperada: false, pendenciaCriada: false };
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
      ativa: true,
    });
  }

  const cards = await cardEntity.filter({ coluna_id: colunaPunicoes.id, status: 'Ativo' }, '-created_date', 500);
  const ordem = cards.length + 1;
  const titulo = `Punição - ${punicao.posto_graduacao || ''} ${punicao.militar_nome || ''}`.trim();

  const card = await cardEntity.create({
    coluna_id: colunaPunicoes.id,
    ordem,
    titulo,
    origem_tipo: 'Manual',
    origem_modulo: 'Militar',
    origem_registro_id: punicao.id,
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
    etiqueta_cor: '#dc2626',
    etiqueta_texto: 'Punição',
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