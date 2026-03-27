import { base44 } from '@/api/base44Client';
import { calcularComportamento } from '@/utils/calcularComportamento';

const TIPOS_COM_DIAS_OBRIGATORIO = new Set(['Detenção', 'Prisão', 'Prisão em Separado']);
const MOTIVO_MUDANCA_DISCIPLINAR_PADRAO = 'Mudança de comportamento disciplinar por enquadramento legal';

function getEntitySafe(nome) {
  const entity = base44.entities?.[nome];
  return entity && typeof entity === 'object' ? entity : null;
}

function hasEntityMethod(entity, method) {
  return Boolean(entity && typeof entity[method] === 'function');
}

function normalizarMilitarId(militarId) {
  if (militarId === null || militarId === undefined) return '';
  const valor = String(militarId).trim();
  return valor;
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

async function listarHistoricoPorMilitar(historicoEntity, militarId, sort = 'data_alteracao') {
  if (!hasEntityMethod(historicoEntity, 'filter')) return [];
  const militarIdNormalizado = normalizarMilitarId(militarId);
  if (!militarIdNormalizado) return [];

  const consultas = [
    historicoEntity.filter({ militar_id: militarIdNormalizado }, sort),
    historicoEntity.filter({ militarId: militarIdNormalizado }, sort),
  ];

  if (hasEntityMethod(historicoEntity, 'list')) {
    consultas.push(historicoEntity.list(sort, 200));
  }

  const [porMilitarId, porMilitarIdLegado, listagemGeral] = await Promise.all(consultas);

  const porListagemGeral = (Array.isArray(listagemGeral) ? listagemGeral : []).filter((registro) => {
    const registroMilitarId = normalizarMilitarId(registro?.militar_id || registro?.militarId);
    return registroMilitarId === militarIdNormalizado;
  });

  const agregados = [
    ...(Array.isArray(porMilitarId) ? porMilitarId : []),
    ...(Array.isArray(porMilitarIdLegado) ? porMilitarIdLegado : []),
    ...porListagemGeral,
  ];
  const mapa = new Map();
  for (const registro of agregados) {
    const chave = registro?.id || `${registro?.militar_id || registro?.militarId || ''}-${registro?.data_alteracao || ''}-${registro?.comportamento_novo || ''}`;
    if (!mapa.has(chave)) mapa.set(chave, registro);
  }

  return Array.from(mapa.values());
}

async function listarPendenciasPorMilitar(pendenciaEntity, militarId) {
  if (!hasEntityMethod(pendenciaEntity, 'filter')) return [];
  const militarIdNormalizado = normalizarMilitarId(militarId);
  if (!militarIdNormalizado) return [];

  const consultas = [
    pendenciaEntity.filter({ militar_id: militarIdNormalizado }, '-created_date'),
  ];

  if (hasEntityMethod(pendenciaEntity, 'list')) {
    consultas.push(pendenciaEntity.list('-created_date', 200));
  }

  const [porMilitarId, listagemGeral] = await Promise.all(consultas);
  const porListagemGeral = (Array.isArray(listagemGeral) ? listagemGeral : []).filter((registro) => {
    const registroMilitarId = normalizarMilitarId(registro?.militar_id || registro?.militarId);
    return registroMilitarId === militarIdNormalizado;
  });

  const agregados = [
    ...(Array.isArray(porMilitarId) ? porMilitarId : []),
    ...porListagemGeral,
  ];

  const mapa = new Map();
  for (const registro of agregados) {
    const chave = registro?.id || `${registro?.militar_id || ''}-${registro?.created_date || ''}-${registro?.comportamento_sugerido || ''}`;
    if (!mapa.has(chave)) mapa.set(chave, registro);
  }

  return Array.from(mapa.values());
}

function ehMarcoImplantacao(registro = {}) {
  const origem = String(registro?.origem_tipo || '').toUpperCase();
  const motivo = String(registro?.motivo_mudanca || '').toUpperCase();
  return origem.includes('IMPLANT') || motivo.includes('IMPLANT') || motivo.includes('REGISTRO INICIAL');
}

function ehMarcoMudancaDisciplinar(registro = {}) {
  if (!registro) return false;
  if (ehMarcoImplantacao(registro)) return false;
  const origem = String(registro?.origem_tipo || '').toUpperCase();
  if (origem.includes('PENDENCIA')) return true;
  if (String(registro?.fundamento_legal || '').trim()) return true;
  return Boolean(registro?.comportamento_anterior && registro?.comportamento_novo);
}

function precisaSaneamentoMarcoDisciplinar(registro = {}) {
  if (!ehMarcoMudancaDisciplinar(registro)) return false;
  const motivo = String(registro?.motivo_mudanca || '').trim();
  const fundamento = String(registro?.fundamento_legal || '').trim();
  return !motivo || !fundamento;
}

function encontrarPendenciaCorrespondente(marco = {}, pendencias = []) {
  if (!Array.isArray(pendencias) || !pendencias.length) return null;

  const origemId = String(marco?.origem_id || '').trim();
  if (origemId) {
    const porOrigem = pendencias.find((pendencia) => String(pendencia?.id || '').trim() === origemId);
    if (porOrigem) return porOrigem;
  }

  const comportamentoNovo = String(marco?.comportamento_novo || '').trim().toUpperCase();
  const comportamentoAnterior = String(marco?.comportamento_anterior || '').trim().toUpperCase();
  const dataMarco = normalizarDataVigencia(marco?.data_alteracao);

  return pendencias.find((pendencia) => {
    const sugerido = String(pendencia?.comportamento_sugerido || '').trim().toUpperCase();
    const atual = String(pendencia?.comportamento_atual || '').trim().toUpperCase();
    if (!sugerido || sugerido !== comportamentoNovo) return false;
    if (comportamentoAnterior && atual && atual !== comportamentoAnterior) return false;
    const dataPendencia = normalizarDataVigencia(pendencia?.data_confirmacao || pendencia?.data_detectada);
    return !dataMarco || !dataPendencia || dataPendencia <= dataMarco;
  }) || null;
}

async function enriquecerHistoricoComportamentoDisciplinar(registros = [], militarId) {
  const historico = Array.isArray(registros) ? registros : [];
  const candidatos = historico.filter((registro) => precisaSaneamentoMarcoDisciplinar(registro));
  if (!candidatos.length) return historico;

  const historicoEntity = getEntitySafe('HistoricoComportamento');
  if (!hasEntityMethod(historicoEntity, 'update')) return historico;

  const pendenciaEntity = getEntitySafe('PendenciaComportamento');
  const punicaoEntity = getEntitySafe('PunicaoDisciplinar');
  const militarEntity = getEntitySafe('Militar');

  const [pendencias, punicoes, militarLista] = await Promise.all([
    listarPendenciasPorMilitar(pendenciaEntity, militarId),
    hasEntityMethod(punicaoEntity, 'filter') ? punicaoEntity.filter({ militar_id: militarId }) : [],
    hasEntityMethod(militarEntity, 'filter') ? militarEntity.filter({ id: militarId }) : [],
  ]);
  const militar = Array.isArray(militarLista) ? militarLista[0] : null;

  const atualizados = new Map();

  for (const marco of candidatos) {
    const pendencia = encontrarPendenciaCorrespondente(marco, pendencias);
    const motivoAtual = String(marco?.motivo_mudanca || '').trim();
    const fundamentoAtual = String(marco?.fundamento_legal || '').trim();

    let motivoNovo = motivoAtual || (pendencia ? MOTIVO_MUDANCA_DISCIPLINAR_PADRAO : '');
    let fundamentoNovo = fundamentoAtual || String(pendencia?.fundamento_legal || '').trim();

    if (!fundamentoNovo && militar && Array.isArray(punicoes) && punicoes.length > 0) {
      const calculado = calcularComportamento(punicoes, militar.posto_graduacao, new Date(), {
        dataInclusaoMilitar: militar.data_inclusao,
      });
      const comportamentoCalculado = String(calculado?.comportamento || '').trim().toUpperCase();
      const comportamentoMarco = String(marco?.comportamento_novo || '').trim().toUpperCase();
      if (comportamentoCalculado && comportamentoMarco && comportamentoCalculado === comportamentoMarco) {
        fundamentoNovo = String(calculado?.fundamento || '').trim();
        if (fundamentoNovo && !motivoNovo) {
          motivoNovo = MOTIVO_MUDANCA_DISCIPLINAR_PADRAO;
        }
      }
    }

    if (!motivoNovo && fundamentoNovo) {
      motivoNovo = MOTIVO_MUDANCA_DISCIPLINAR_PADRAO;
    }

    if ((!motivoAtual && motivoNovo) || (!fundamentoAtual && fundamentoNovo)) {
      const patch = {
        motivo_mudanca: motivoNovo || motivoAtual || '',
        fundamento_legal: fundamentoNovo || fundamentoAtual || '',
      };

      try {
        await historicoEntity.update(marco.id, patch);
        atualizados.set(marco.id, {
          ...marco,
          ...patch,
        });
      } catch (error) {
        console.warn('[HIST] falha saneamento de marco disciplinar', {
          historico_id: marco?.id,
          erro: error?.message || error,
        });
      }
    }
  }

  if (!atualizados.size) return historico;
  return historico.map((registro) => atualizados.get(registro.id) || registro);
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


export async function garantirImplantacaoHistoricoComportamento(payload = {}) {
  try {
    const origemPayload = (payload && typeof payload === 'object') ? payload : {};
    const militarPayload = origemPayload?.militarId && typeof origemPayload.militarId === 'object'
      ? origemPayload.militarId
      : (origemPayload?.id ? origemPayload : {
          id: origemPayload?.militarId,
          comportamento: origemPayload?.comportamentoAtual,
          data_inclusao: origemPayload?.dataVigencia,
        });
    const {
      dataVigencia,
      origemTipo = 'Militar',
      origemId = '',
      createdBy = '',
    } = origemPayload;
    const militarIdNormalizado = normalizarMilitarId(militarPayload?.id);
    if (!militarIdNormalizado) return null;

    const historicoEntity = getEntitySafe('HistoricoComportamento');
    if (!hasEntityMethod(historicoEntity, 'filter') || !hasEntityMethod(historicoEntity, 'create')) return null;

    const existentes = await listarHistoricoPorMilitar(historicoEntity, militarIdNormalizado, 'data_alteracao');
    const historicoExistenteSanitizado = sanitizarHistoricoComportamento(existentes, { ordem: 'asc' });

    if (historicoExistenteSanitizado.length > 0) {
      console.info('[HIST] histórico encontrado', {
        militar_id: militarIdNormalizado,
        total: historicoExistenteSanitizado.length,
      });
      console.info('[HIST] duplicidade evitada', {
        militar_id: militarIdNormalizado,
        motivo: 'implantacao_ja_existente',
      });
      return historicoExistenteSanitizado[0];
    }

    let dataVigenciaInicial = normalizarDataVigencia(dataVigencia || militarPayload?.data_inclusao || new Date().toISOString().slice(0, 10));
    if (!ehDataVigenciaValida(dataVigenciaInicial)) {
      dataVigenciaInicial = new Date().toISOString().slice(0, 10);
    }

    let comportamentoInicial = militarPayload?.comportamento || origemPayload?.comportamentoAtual;
    if (!ehComportamentoValido(comportamentoInicial)) {
      comportamentoInicial = 'Bom';
    }

    const registroCriado = await historicoEntity.create({
      militar_id: militarIdNormalizado,
      data_alteracao: dataVigenciaInicial,
      comportamento_anterior: '',
      comportamento_novo: comportamentoInicial,
      motivo_mudanca: 'Implantação do sistema',
      fundamento_legal: 'Registro inicial do comportamento no momento da implantação',
      origem_tipo: origemTipo || 'Implantacao',
      origem_id: origemId || militarIdNormalizado,
      observacoes: 'Registro inicial criado automaticamente para a linha do tempo disciplinar.',
      created_by: createdBy || '',
    });

    if (registroCriado) {
      console.log('[HIST] criado:', registroCriado);
    } else {
      console.error('[HIST] falha ao criar histórico');
      return null;
    }

    console.info('[HIST] implantação criada no banco', {
      militar_id: militarIdNormalizado,
      historico_id: registroCriado?.id,
      comportamento: registroCriado?.comportamento_novo,
    });

    const aposCreate = await listarHistoricoPorMilitar(historicoEntity, militarIdNormalizado, 'data_alteracao');
    const historicoAposCreate = sanitizarHistoricoComportamento(aposCreate, { ordem: 'asc' });
    if (historicoAposCreate.length > 0) {
      console.info('[HIST] histórico encontrado', {
        militar_id: militarIdNormalizado,
        total: historicoAposCreate.length,
      });
    } else {
      console.warn('[HIST] nenhum histórico após create', {
        militar_id: militarIdNormalizado,
      });
    }

    return registroCriado;
  } catch (error) {
    console.error('[HIST] erro implantação', {
      militar_id: payload?.militarId?.id || payload?.militarId || payload?.id || null,
      erro: error?.message || error,
    });
    return null;
  }
}

function normalizarDataVigencia(data) {
  if (!data) return '';
  const texto = String(data);
  return texto.length >= 10 ? texto.slice(0, 10) : texto;
}

function ehComportamentoValido(comportamento) {
  if (!comportamento) return false;
  const valor = String(comportamento).trim();
  return Boolean(valor) && valor.toUpperCase() !== 'N/D';
}

function ehDataVigenciaValida(dataVigencia) {
  if (!dataVigencia) return false;
  const dataNormalizada = normalizarDataVigencia(dataVigencia);
  if (!dataNormalizada) return false;
  const data = new Date(`${dataNormalizada}T00:00:00`);
  return !Number.isNaN(data.getTime());
}

function getMomentoRegistro(registro = {}) {
  const candidatos = [
    registro?.created_date,
    registro?.updated_date,
    registro?.createdDate,
    registro?.updatedDate,
  ].filter(Boolean);

  for (const candidato of candidatos) {
    const data = new Date(candidato);
    if (!Number.isNaN(data.getTime())) return data.getTime();
  }

  return 0;
}

function ehOrigemAutomatica(origemTipo = '') {
  const origemNormalizada = String(origemTipo || '').trim().toUpperCase();
  if (!origemNormalizada) return false;
  return (
    origemNormalizada.includes('AUTOMAT') ||
    origemNormalizada.includes('CALCUL') ||
    origemNormalizada.includes('RECALCUL') ||
    origemNormalizada.includes('VERIFICACAO_DIARIA') ||
    origemNormalizada.includes('SISTEMA')
  );
}

function ehRegistroAutomaticoIntermediario(registro = {}) {
  if (ehOrigemAutomatica(registro?.origem_tipo)) return true;
  const motivo = String(registro?.motivo_mudanca || '').toUpperCase();
  return motivo.includes('AUTOMÁTIC') || motivo.includes('AUTOMATIC');
}

function sanitizarHistoricoComportamento(registros = [], { ordem = 'asc' } = {}) {
  const registrosValidos = (Array.isArray(registros) ? registros : [])
    .filter((registro) => ehDataVigenciaValida(registro?.data_alteracao))
    .filter((registro) => ehComportamentoValido(registro?.comportamento_novo))
    .filter((registro) => !ehRegistroAutomaticoIntermediario(registro))
    .sort((a, b) => {
      const diffData = new Date(`${normalizarDataVigencia(a.data_alteracao)}T00:00:00`) - new Date(`${normalizarDataVigencia(b.data_alteracao)}T00:00:00`);
      if (diffData !== 0) return diffData;
      return getMomentoRegistro(a) - getMomentoRegistro(b);
    });

  const ultimoPorDia = new Map();
  for (const registro of registrosValidos) {
    const dataChave = normalizarDataVigencia(registro.data_alteracao);
    ultimoPorDia.set(dataChave, registro);
  }
  const registrosPorDia = Array.from(ultimoPorDia.values());

  const marcosReais = [];
  for (const registro of registrosPorDia) {
    const ultimo = marcosReais[marcosReais.length - 1];
    if (ultimo?.comportamento_novo === registro.comportamento_novo) continue;
    marcosReais.push(registro);
  }

  return ordem === 'desc' ? [...marcosReais].reverse() : marcosReais;
}

export async function registrarMarcoHistoricoComportamento({
  militarId,
  dataVigencia,
  comportamentoAnterior,
  comportamento,
  motivoMudanca,
  fundamentoLegal,
  origemTipo,
  origemId,
  motivo_mudanca,
  fundamento_legal,
  origem_tipo,
  origem_id,
  observacoes,
  createdBy,
  created_by,
}) {
  const militarIdNormalizado = normalizarMilitarId(militarId);
  if (!militarIdNormalizado) return null;
  if (!ehDataVigenciaValida(dataVigencia)) return null;
  if (!ehComportamentoValido(comportamento)) return null;
  if (ehOrigemAutomatica(origemTipo)) {
    console.info('[HIST] registro bloqueado por origem automática', {
      militar_id: militarIdNormalizado,
      origem_tipo: origemTipo,
    });
    return null;
  }

  if (comportamentoAnterior && comportamentoAnterior === comportamento) {
    console.info('[HIST] sem mudança de comportamento', { militar_id: militarIdNormalizado, comportamento });
    return null;
  }

  const historicoEntity = getEntitySafe('HistoricoComportamento');
  if (!hasEntityMethod(historicoEntity, 'create') || !hasEntityMethod(historicoEntity, 'filter')) return null;

  const registrosExistentes = await listarHistoricoPorMilitar(historicoEntity, militarIdNormalizado, 'data_alteracao');
  const historicoSanitizado = sanitizarHistoricoComportamento(registrosExistentes, { ordem: 'desc' });
  const ultimoMarco = historicoSanitizado[0];

  const dataVigenciaNormalizada = normalizarDataVigencia(dataVigencia);
  const ultimaDataNormalizada = normalizarDataVigencia(ultimoMarco?.data_alteracao);
  const ultimoComportamento = ultimoMarco?.comportamento_novo;

  if (ultimoComportamento === comportamento && ultimaDataNormalizada === dataVigenciaNormalizada) {
    console.info('[HIST] duplicidade evitada', {
      militar_id: militarIdNormalizado,
      motivo: 'mesma_data_e_mesmo_comportamento',
      data_alteracao: dataVigenciaNormalizada,
      comportamento,
    });
    return null;
  }

  if (ultimoComportamento === comportamento) {
    console.info('[HIST] duplicidade evitada', {
      militar_id: militarIdNormalizado,
      motivo: 'mesmo_comportamento_do_ultimo_marco',
      comportamento,
    });
    return null;
  }

  const comportamentoAnteriorFinal = comportamentoAnterior || ultimoComportamento || '';

  if (comportamentoAnteriorFinal === comportamento) {
    console.info('[HIST] sem mudança de comportamento', { militar_id: militarIdNormalizado, comportamento });
    return null;
  }

  const origemTipoFinal = origemTipo || origem_tipo || '';
  const origemIdFinal = origemId || origem_id || '';
  let fundamentoLegalFinal = fundamentoLegal || fundamento_legal || '';
  const origemEhPendencia = String(origemTipoFinal || '').toUpperCase().includes('PENDENCIACOMPORTAMENTO');
  if (!fundamentoLegalFinal && origemEhPendencia && origemIdFinal) {
    const pendenciaEntity = getEntitySafe('PendenciaComportamento');
    if (hasEntityMethod(pendenciaEntity, 'filter')) {
      const [pendenciaOrigem] = await pendenciaEntity.filter({ id: origemIdFinal });
      fundamentoLegalFinal = String(pendenciaOrigem?.fundamento_legal || '').trim();
    }
  }
  const mudancaDisciplinarPorCalculo = origemEhPendencia || Boolean(fundamentoLegalFinal);
  const motivoMudancaFinal = (motivoMudanca || motivo_mudanca || '').trim()
    || (mudancaDisciplinarPorCalculo ? MOTIVO_MUDANCA_DISCIPLINAR_PADRAO : '');
  const createdByFinal = createdBy || created_by || '';

  try {
    const marco = await historicoEntity.create({
      militar_id: militarIdNormalizado,
      data_alteracao: dataVigenciaNormalizada,
      comportamento_anterior: comportamentoAnteriorFinal,
      comportamento_novo: comportamento,
      motivo_mudanca: motivoMudancaFinal,
      fundamento_legal: fundamentoLegalFinal,
      origem_tipo: origemTipoFinal,
      origem_id: origemIdFinal,
      observacoes: observacoes || '',
      created_by: createdByFinal,
    });

    console.info('[HIST] marco criado', {
      militar_id: militarIdNormalizado,
      historico_id: marco?.id,
      data_alteracao: dataVigenciaNormalizada,
      comportamento_anterior: comportamentoAnteriorFinal,
      comportamento,
    });

    return marco;
  } catch (error) {
    console.error('[HIST] erro ao registrar marco', {
      militar_id: militarIdNormalizado,
      data_alteracao: dataVigenciaNormalizada,
      comportamento,
      erro: error?.message || error,
    });
    throw error;
  }
}

export async function registrarEventoHistoricoComportamento(payload) {
  return registrarMarcoHistoricoComportamento(payload);
}

export async function obterHistoricoComportamentoMilitar(militarId, { ordem = 'asc' } = {}) {
  const militarIdNormalizado = normalizarMilitarId(militarId);
  if (!militarIdNormalizado) return [];
  const historicoEntity = getEntitySafe('HistoricoComportamento');
  if (!hasEntityMethod(historicoEntity, 'filter')) return [];

  const sort = ordem === 'desc' ? '-data_alteracao' : 'data_alteracao';
  const registros = await listarHistoricoPorMilitar(historicoEntity, militarIdNormalizado, sort);
  const registrosEnriquecidos = await enriquecerHistoricoComportamentoDisciplinar(registros, militarIdNormalizado);
  return sanitizarHistoricoComportamento(registrosEnriquecidos, { ordem });
}

export async function criarMarcoHistoricoComportamento({
  militar_id,
  data_vigencia,
  comportamento,
  comportamento_anterior,
  motivo_mudanca,
  fundamento_legal,
  origem_tipo,
  origem_id,
  observacoes,
  created_by,
}) {
  return registrarMarcoHistoricoComportamento({
    militarId: militar_id,
    dataVigencia: data_vigencia,
    comportamento,
    comportamentoAnterior: comportamento_anterior,
    motivoMudanca: motivo_mudanca,
    fundamentoLegal: fundamento_legal,
    origemTipo: origem_tipo,
    origemId: origem_id,
    observacoes,
    createdBy: created_by,
  });
}

export async function registrarHistoricoComportamento(payload) {
  return registrarMarcoHistoricoComportamento(payload);
}

export async function criarHistoricoComportamento({
  militarId,
  dataVigencia,
  comportamentoAnterior,
  comportamento,
  motivoMudanca,
  fundamentoLegal,
  origemTipo,
  origemId,
  observacoes,
  createdBy,
}) {
  return registrarMarcoHistoricoComportamento({
    militarId,
    dataVigencia,
    comportamento,
    comportamentoAnterior,
    motivoMudanca,
    fundamentoLegal,
    origemTipo,
    origemId,
    observacoes,
    createdBy,
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

export async function recalcularComportamentoEMarcarPendencia(militarId) {
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

    const { criada: pendenciaCriada } = await criarPendenciaComportamentoSemDuplicidade(payloadPendencia);
    if (pendenciaCriada) {
      console.info('[JD] pendencia criada', { militar_id: militar.id, comportamento_sugerido: resultado.comportamento });
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

export function criarChavePendenciaComportamento(pendencia = {}) {
  return [
    pendencia?.militar_id || '',
    pendencia?.comportamento_atual || '',
    pendencia?.comportamento_sugerido || '',
    pendencia?.status_pendencia || '',
  ].join('|');
}

export async function criarPendenciaComportamentoSemDuplicidade(payload = {}) {
  const pendenciaEntity = getEntitySafe('PendenciaComportamento');
  if (!hasEntityMethod(pendenciaEntity, 'create') || !hasEntityMethod(pendenciaEntity, 'filter')) {
    return { criada: false, registro: null, motivo: 'entidade_indisponivel' };
  }

  const filtroDuplicidade = {
    militar_id: payload.militar_id,
    status_pendencia: 'Pendente',
    comportamento_sugerido: payload.comportamento_sugerido,
    comportamento_atual: payload.comportamento_atual,
  };

  const existentes = await pendenciaEntity.filter(filtroDuplicidade, '-created_date');
  if (existentes.length > 0) {
    console.info('[PEND] duplicidade evitada', {
      militar_id: payload.militar_id,
      comportamento_atual: payload.comportamento_atual,
      comportamento_sugerido: payload.comportamento_sugerido,
      pendencia_id: existentes[0]?.id,
    });
    return { criada: false, registro: existentes[0], motivo: 'duplicada' };
  }

  const registro = await pendenciaEntity.create(payload);
  return { criada: true, registro, motivo: 'criada' };
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
