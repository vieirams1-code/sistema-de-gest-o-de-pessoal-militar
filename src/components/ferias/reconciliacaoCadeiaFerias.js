import { addDays, differenceInDays, format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { sincronizarPeriodoAquisitivoDaFerias } from './feriasService';

export const TIPOS_EVENTO_FERIAS = [
  'Saída Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
  'Retorno Férias',
];

function getEventDate(evento) {
  return evento?.data_registro || evento?.data_inicio || null;
}

export function compareEventosFerias(a, b) {
  const da = getEventDate(a) || '2000-01-01';
  const db = getEventDate(b) || '2000-01-01';

  const dateA = new Date(`${da}T00:00:00`);
  const dateB = new Date(`${db}T00:00:00`);

  if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
  return new Date(a?.created_date || 0) - new Date(b?.created_date || 0);
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function toDateOnly(date) {
  return format(date, 'yyyy-MM-dd');
}

function anexarObservacao(original, observacao) {
  const atual = String(original || '').trim();
  if (!atual) return observacao;
  if (atual.includes(observacao)) return atual;
  return `${atual}\n${observacao}`;
}

function mapInvalidReason(evento, anterior) {
  if (!anterior && evento?.tipo_registro === 'Continuação') return 'Cadeia iniciada por continuação';
  if (!anterior && evento?.tipo_registro === 'Nova Saída / Retomada') return 'Cadeia iniciada por continuação';
  if (!anterior && evento?.tipo_registro === 'Retorno Férias') return 'Cadeia iniciada por término';
  if (!anterior) return 'Cadeia sem início válido';
  return `Sequência inválida após ${anterior.tipo_registro}`;
}

function transicaoValida(anteriorTipo, atualTipo) {
  if (anteriorTipo === 'Saída Férias' || anteriorTipo === 'Nova Saída / Retomada') {
    return atualTipo === 'Interrupção de Férias' || atualTipo === 'Retorno Férias';
  }
  if (anteriorTipo === 'Interrupção de Férias') {
    return atualTipo === 'Nova Saída / Retomada';
  }
  return false;
}

export function calcularSnapshotInterrupcao(evento, cadeia = [], ferias = null) {
  const diasNoMomento = Number(evento?.dias_no_momento ?? evento?.dias ?? ferias?.dias ?? 0);

  const indiceEvento = cadeia.findIndex((item) => item?.id === evento?.id);
  const eventosAteInterrupcao = indiceEvento >= 0 ? cadeia.slice(0, indiceEvento + 1) : cadeia;
  const inicioEvento = [...eventosAteInterrupcao]
    .reverse()
    .find((item) => item?.tipo_registro === 'Saída Férias' || item?.tipo_registro === 'Nova Saída / Retomada');
  const dataInicioBase = getEventDate(inicioEvento) || ferias?.data_inicio || null;

  let gozados = null;
  let saldo = null;
  if (dataInicioBase && evento?.data_registro) {
    const inicio = parseDate(dataInicioBase);
    const interrupcao = parseDate(evento.data_registro);
    gozados = Math.max(0, differenceInDays(interrupcao, inicio) + 1);
    gozados = Math.min(gozados, diasNoMomento);
    saldo = Math.max(0, diasNoMomento - gozados);
  }

  return { diasNoMomento, gozados, saldo };
}

function buildFeriasUpdate(ferias, eventosValidos, ultimoContexto) {
  if (!eventosValidos.length) {
    return {
      status: 'Prevista',
      saldo_remanescente: null,
      dias_gozados_interrupcao: null,
      data_interrupcao: null,
    };
  }

  const ultimo = eventosValidos[eventosValidos.length - 1];
  const tipo = ultimo.tipo_registro;

  if (tipo === 'Interrupção de Férias') {
    const snap = ultimoContexto[ultimo.id] || {};
    return {
      status: 'Interrompida',
      dias: Number(snap.diasNoMomento ?? ferias?.dias ?? 0),
      saldo_remanescente: Number(snap.saldo ?? 0),
      dias_gozados_interrupcao: Number(snap.gozados ?? 0),
      data_interrupcao: ultimo.data_registro,
    };
  }

  if (tipo === 'Saída Férias' || tipo === 'Nova Saída / Retomada') {
    const dias = Number(ultimo.dias ?? ferias?.dias ?? 0);
    const dataBase = ultimo.data_registro;
    return {
      status: 'Em Curso',
      data_inicio: dataBase,
      data_fim: toDateOnly(addDays(parseDate(dataBase), Math.max(dias - 1, 0))),
      data_retorno: toDateOnly(addDays(parseDate(dataBase), dias)),
      dias,
      saldo_remanescente: null,
      dias_gozados_interrupcao: null,
      data_interrupcao: null,
    };
  }

  if (tipo === 'Retorno Férias') {
    return {
      status: 'Gozada',
      saldo_remanescente: null,
      dias_gozados_interrupcao: null,
      data_interrupcao: null,
    };
  }

  return {};
}

async function invalidarEvento(evento, motivo) {
  await base44.entities.RegistroLivro.update(evento.id, {
    status: 'Inconsistente',
    inconsistencia_motivo_curto: motivo,
    inconsistencia_detalhe: 'Evento perdeu base lógica na cadeia de férias durante reconciliação.',
    numero_bg: null,
    data_bg: null,
    nota_para_bg: null,
    observacoes: anexarObservacao(
      evento?.observacoes,
      'Publicação invalidada automaticamente: evento sem base válida após reconciliação da cadeia.'
    ),
  });
}

export async function reconciliarCadeiaFerias({ feriasId, ferias: feriasInput = null }) {
  if (!feriasId && !feriasInput?.id) return null;

  let ferias = feriasInput;
  if (!ferias?.id) {
    const lista = await base44.entities.Ferias.filter({ id: feriasId });
    ferias = lista[0] || null;
  }
  if (!ferias?.id) return null;

  const eventosBrutos = await base44.entities.RegistroLivro.filter({ ferias_id: ferias.id }, 'data_registro');
  const cadeia = eventosBrutos.filter((e) => TIPOS_EVENTO_FERIAS.includes(e.tipo_registro)).sort(compareEventosFerias);

  const validos = [];
  const invalidos = [];
  const snapshots = {};

  for (const evento of cadeia) {
    const anterior = validos[validos.length - 1] || null;

    if (!anterior) {
      if (evento.tipo_registro !== 'Saída Férias') {
        invalidos.push({ evento, motivo: mapInvalidReason(evento, null) });
        continue;
      }
    } else {
      const dataAnterior = getEventDate(anterior);
      const dataAtual = getEventDate(evento);
      if (dataAnterior && dataAtual && parseDate(dataAtual) < parseDate(dataAnterior)) {
        invalidos.push({ evento, motivo: 'Evento fora de ordem cronológica' });
        continue;
      }
      if (!transicaoValida(anterior.tipo_registro, evento.tipo_registro)) {
        invalidos.push({ evento, motivo: mapInvalidReason(evento, anterior) });
        continue;
      }
    }

    validos.push(evento);

    if (evento.tipo_registro === 'Interrupção de Férias') {
      snapshots[evento.id] = calcularSnapshotInterrupcao(evento, validos, ferias);
    }
    if (evento.tipo_registro === 'Nova Saída / Retomada') {
      const ultimaInterrupcao = [...validos]
        .reverse()
        .find((item) => item.tipo_registro === 'Interrupção de Férias');
      snapshots[evento.id] = {
        diasNoMomento: Number(evento.dias ?? ultimaInterrupcao?.saldo_remanescente ?? ferias?.saldo_remanescente ?? 0),
      };
    }
  }

  for (const invalido of invalidos) {
    // eslint-disable-next-line no-await-in-loop
    await invalidarEvento(invalido.evento, invalido.motivo);
  }

  for (const evento of validos) {
    if (evento.tipo_registro === 'Interrupção de Férias') {
      const snap = snapshots[evento.id] || {};
      const payload = {
        dias_no_momento: Number(snap.diasNoMomento ?? 0),
        dias_gozados: Number(snap.gozados ?? 0),
        saldo_remanescente: Number(snap.saldo ?? 0),
      };
      const mudou =
        Number(evento.dias_no_momento ?? -1) !== payload.dias_no_momento ||
        Number(evento.dias_gozados ?? -1) !== payload.dias_gozados ||
        Number(evento.saldo_remanescente ?? -1) !== payload.saldo_remanescente;
      if (mudou) {
        // eslint-disable-next-line no-await-in-loop
        await base44.entities.RegistroLivro.update(evento.id, payload);
      }
    }
  }

  const updateFerias = buildFeriasUpdate(ferias, validos, snapshots);
  await base44.entities.Ferias.update(ferias.id, updateFerias);

  await sincronizarPeriodoAquisitivoDaFerias({
    periodoAquisitivoId: ferias.periodo_aquisitivo_id || null,
    periodoAquisitivoRef: ferias.periodo_aquisitivo_ref || null,
    militarId: ferias.militar_id || null,
  });

  return {
    feriasId: ferias.id,
    totalEventos: cadeia.length,
    eventosValidos: validos,
    eventosInvalidos: invalidos.map((item) => item.evento),
  };
}
