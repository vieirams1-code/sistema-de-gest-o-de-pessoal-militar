import { format, addDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { sincronizarPeriodoAquisitivoDaFerias } from './feriasService';

/**
 * Tipos de eventos que representam operações na cadeia de férias.
 */
export const TIPOS_EVENTO_FERIAS = {
  SAIDA: 'Saída Férias',
  RETORNO: 'Retorno Férias',
  INTERRUPCAO: 'Interrupção de Férias',
  NOVA_SAIDA: 'Nova Saída / Retomada',
};

/**
 * Mapeia a cadeia de eventos de uma férias, ordenados cronologicamente.
 * Ordena por data_registro (data do evento), depois por created_date.
 */
export function montarCadeia(ferias, registrosLivro) {
  return registrosLivro
    .filter(r => r.ferias_id === ferias.id)
    .sort((a, b) => {
      // Comparar por data_registro primeiro (mais preciso)
      const da = new Date((a.data_registro || a.created_date || '2000-01-01') + 'T00:00:00');
      const db = new Date((b.data_registro || b.created_date || '2000-01-01') + 'T00:00:00');
      if (da - db !== 0) return da - db;
      // Empate: created_date como desempate
      return new Date(a.created_date || 0) - new Date(b.created_date || 0);
    });
}

/**
 * Retorna quais eventos são "descendentes" de um evento alvo (posteriores na cadeia).
 */
export function identificarDescendentes(eventoAlvo, cadeia) {
  const idx = cadeia.findIndex(e => e.id === eventoAlvo.id);
  if (idx === -1) return [];
  return cadeia.slice(idx + 1);
}

const TRANSICOES_VALIDAS = {
  [TIPOS_EVENTO_FERIAS.SAIDA]: new Set([TIPOS_EVENTO_FERIAS.INTERRUPCAO, TIPOS_EVENTO_FERIAS.RETORNO]),
  [TIPOS_EVENTO_FERIAS.INTERRUPCAO]: new Set([TIPOS_EVENTO_FERIAS.NOVA_SAIDA]),
  [TIPOS_EVENTO_FERIAS.NOVA_SAIDA]: new Set([TIPOS_EVENTO_FERIAS.INTERRUPCAO, TIPOS_EVENTO_FERIAS.RETORNO]),
};

function getEventoData(evento) {
  return evento?.data_registro || evento?.data_inicio || null;
}

function detectarPrimeiraInconsistencia(cadeia) {
  if (!cadeia.length) return null;

  if (cadeia[0]?.tipo_registro !== TIPOS_EVENTO_FERIAS.SAIDA) {
    return {
      index: 0,
      motivoCurto: 'Cadeia sem início válido',
      detalhe: `A cadeia inicia com ${cadeia[0]?.tipo_registro || 'evento desconhecido'}, e não com ${TIPOS_EVENTO_FERIAS.SAIDA}.`,
    };
  }

  for (let i = 1; i < cadeia.length; i += 1) {
    const anterior = cadeia[i - 1];
    const atual = cadeia[i];
    const dataAnterior = getEventoData(anterior);
    const dataAtual = getEventoData(atual);

    if (dataAnterior && dataAtual) {
      const da = new Date(`${dataAnterior}T00:00:00`);
      const db = new Date(`${dataAtual}T00:00:00`);
      if (db < da) {
        return {
          index: i,
          motivoCurto: 'Cadeia fora de ordem cronológica',
          detalhe: `${atual?.tipo_registro || 'Evento'} em ${dataAtual} está anterior a ${anterior?.tipo_registro || 'evento anterior'} em ${dataAnterior}.`,
        };
      }
    }

    const transicoesPermitidas = TRANSICOES_VALIDAS[anterior?.tipo_registro];
    if (!transicoesPermitidas || !transicoesPermitidas.has(atual?.tipo_registro)) {
      return {
        index: i,
        motivoCurto: 'Sequência da cadeia inválida',
        detalhe: `Sequência inválida entre ${anterior?.tipo_registro || 'evento anterior'} e ${atual?.tipo_registro || 'evento atual'}.`,
      };
    }
  }

  return null;
}

function anexarObservacao(original, observacao) {
  const atual = String(original || '').trim();
  if (!atual) return observacao;
  if (atual.includes(observacao)) return atual;
  return `${atual}\n${observacao}`;
}

async function invalidarPublicacaoDeEvento(evento, inconsistencia) {
  const observacao = `Publicação invalidada automaticamente: evento perdeu validade após remoção de evento anterior da cadeia de férias.`;
  const payload = {
    status: 'Inconsistente',
    inconsistencia_motivo_curto: inconsistencia?.motivoCurto || 'Evento sem base válida na cadeia',
    inconsistencia_detalhe:
      inconsistencia?.detalhe ||
      'Evento ficou sem base válida após remoção de evento anterior da cadeia de férias.',
    numero_bg: null,
    data_bg: null,
    nota_para_bg: null,
    observacoes: anexarObservacao(evento?.observacoes, observacao),
  };

  await base44.entities.RegistroLivro.update(evento.id, payload);
  return { id: evento.id, tipo_registro: evento?.tipo_registro };
}

async function auditarDependenciasPosExclusao({ eventosSobreviventes = [] }) {
  const inconsistencia = detectarPrimeiraInconsistencia(eventosSobreviventes);

  if (!inconsistencia) {
    return {
      eventosValidos: eventosSobreviventes,
      eventosInvalidos: [],
    };
  }

  const eventosInvalidos = eventosSobreviventes.slice(inconsistencia.index);
  const eventosValidos = eventosSobreviventes.slice(0, inconsistencia.index);

  const invalidacoes = [];
  for (const evento of eventosInvalidos) {
    // eslint-disable-next-line no-await-in-loop
    const resultado = await invalidarPublicacaoDeEvento(evento, inconsistencia);
    invalidacoes.push(resultado);
  }

  return { eventosValidos, eventosInvalidos: invalidacoes };
}

/**
 * Recalcula o estado completo da férias com base nos eventos sobreviventes.
 * Reconstrói dias, datas, observações derivadas e status.
 * NÃO usa observações como fonte de verdade — usa os eventos reais.
 */
export function recalcularEstadoFerias(ferias, eventosSobreviventes) {
  if (eventosSobreviventes.length === 0) {
    return { status: 'Prevista', observacoes: '' };
  }

  const tipos = eventosSobreviventes.map(e => e.tipo_registro);
  const temSaida = tipos.includes(TIPOS_EVENTO_FERIAS.SAIDA) || tipos.includes(TIPOS_EVENTO_FERIAS.NOVA_SAIDA);
  const temRetorno = tipos.includes(TIPOS_EVENTO_FERIAS.RETORNO);
  const temInterrupcao = tipos.includes(TIPOS_EVENTO_FERIAS.INTERRUPCAO);

  // Determinar status
  let novoStatus;
  if (!temSaida) {
    novoStatus = 'Prevista';
  } else if (temRetorno) {
    novoStatus = 'Gozada';
  } else if (temInterrupcao) {
    // Verificar se depois da interrupção há nova saída
    const idxInterrupcao = [...eventosSobreviventes].map((e,i) => e.tipo_registro === TIPOS_EVENTO_FERIAS.INTERRUPCAO ? i : -1).filter(i => i >= 0).pop() ?? -1;
    const idxNovaSaida = [...eventosSobreviventes].map((e,i) => e.tipo_registro === TIPOS_EVENTO_FERIAS.NOVA_SAIDA ? i : -1).filter(i => i >= 0).pop() ?? -1;
    if (idxNovaSaida > idxInterrupcao) {
      novoStatus = 'Em Curso';
    } else {
      novoStatus = 'Interrompida';
    }
  } else {
    novoStatus = 'Em Curso';
  }

  const diasBase = ferias.dias_base || ferias.dias_originais || 30;
  const novosDias = Math.max(0, diasBase);

  // Recalcular datas com base nos dias calculados e na data de início original
  let novaDataFim = ferias.data_fim;
  let novaDataRetorno = ferias.data_retorno;
  if (ferias.data_inicio && novosDias > 0) {
    novaDataFim = format(addDays(new Date(ferias.data_inicio + 'T00:00:00'), novosDias - 1), 'yyyy-MM-dd');
    novaDataRetorno = format(addDays(new Date(ferias.data_inicio + 'T00:00:00'), novosDias), 'yyyy-MM-dd');
  }

  const linhasObs = [];

  // Calcular saldo de interrupção se necessário
  if (novoStatus === 'Interrompida') {
    const primeiroSaida = eventosSobreviventes.find(e =>
      e.tipo_registro === TIPOS_EVENTO_FERIAS.SAIDA || e.tipo_registro === TIPOS_EVENTO_FERIAS.NOVA_SAIDA
    );
    const ultimaInterrupcao = [...eventosSobreviventes].reverse().find(e =>
      e.tipo_registro === TIPOS_EVENTO_FERIAS.INTERRUPCAO
    );

    if (primeiroSaida?.data_inicio && ultimaInterrupcao?.data_inicio) {
      const diasGozados = Math.round(
        (new Date(ultimaInterrupcao.data_inicio + 'T00:00:00') - new Date(primeiroSaida.data_inicio + 'T00:00:00')) /
        (1000 * 60 * 60 * 24)
      );
      const saldo = novosDias - diasGozados;
      linhasObs.push(`Saldo: ${Math.max(0, saldo)} dias`);
    }
  }

  return {
    status: novoStatus,
    dias: novosDias,
    data_fim: novaDataFim,
    data_retorno: novaDataRetorno,
    observacoes: linhasObs.join('\n'),
  };
}

/**
 * Executa a exclusão administrativa assistida:
 * - Exclui os eventos selecionados (alvo + descendentes se solicitado)
 * - Recalcula o estado da férias
 * - Recalcula o período aquisitivo se necessário
 */
export async function executarExclusaoAdminCadeia({
  ferias,
  eventoAlvo,
  incluirDescendentes,
  cadeia,
  queryClient,
}) {
  const descendentes = identificarDescendentes(eventoAlvo, cadeia);
  const idsParaExcluir = incluirDescendentes
    ? [eventoAlvo.id, ...descendentes.map(d => d.id)]
    : [eventoAlvo.id];

  // Excluir eventos selecionados
  for (const id of idsParaExcluir) {
    await base44.entities.RegistroLivro.delete(id);
  }

  // Calcular eventos sobreviventes (excluindo os removidos)
  const sobreviventes = cadeia.filter(e => !idsParaExcluir.includes(e.id));

  // Reler a férias do banco para garantir dias_base atualizado
  // (evita usar objeto React stale que pode ter dias_base ausente)
  let feriasFresh = ferias;
  try {
    const lista = await base44.entities.Ferias.filter({ id: ferias.id });
    if (lista[0]) feriasFresh = lista[0];
  } catch (_) { /* fallback para ferias da prop */ }

  const { eventosValidos } = await auditarDependenciasPosExclusao({
    eventosSobreviventes: sobreviventes,
  });

  // Recalcular estado da férias usando apenas os eventos ainda válidos
  const atualizacaoFerias = recalcularEstadoFerias(feriasFresh, eventosValidos);
  await base44.entities.Ferias.update(ferias.id, atualizacaoFerias);
  await sincronizarPeriodoAquisitivoDaFerias({
    periodoAquisitivoId: ferias.periodo_aquisitivo_id,
    periodoAquisitivoRef: ferias.periodo_aquisitivo_ref,
    militarId: ferias.militar_id,
  });

  queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
  queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
  queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
  queryClient.invalidateQueries({ queryKey: ['ferias'] });
  queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
}

/**
 * Recalcula o estado da cadeia sem excluir nada (apenas corrige inconsistências).
 * Reconstrói dias, datas, status e observações derivadas.
 * Relê a férias do banco para garantir dias_base atualizado.
 */
export async function recalcularCadeiaCompleta({ ferias, cadeia, queryClient }) {
  let feriasFresh = ferias;
  try {
    const lista = await base44.entities.Ferias.filter({ id: ferias.id });
    if (lista[0]) feriasFresh = lista[0];
  } catch (_) { /* fallback */ }
  const atualizacaoFerias = recalcularEstadoFerias(feriasFresh, cadeia);
  await base44.entities.Ferias.update(ferias.id, atualizacaoFerias);
  await sincronizarPeriodoAquisitivoDaFerias({
    periodoAquisitivoId: ferias.periodo_aquisitivo_id,
    periodoAquisitivoRef: ferias.periodo_aquisitivo_ref,
    militarId: ferias.militar_id,
  });

  queryClient.invalidateQueries({ queryKey: ['ferias'] });
  queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });

  return atualizacaoFerias;
}
