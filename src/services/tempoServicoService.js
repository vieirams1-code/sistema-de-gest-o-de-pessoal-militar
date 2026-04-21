import { differenceInDays, differenceInYears } from 'date-fns';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_WITH_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T.+$/;
const BR_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const NUMERIC_STRING_REGEX = /^\d+$/;

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function parseTimestamp(value) {
  if (!Number.isFinite(value)) return null;
  const normalized = value < 1e12 ? value * 1000 : value;
  const date = new Date(normalized);
  return isValidDate(date) ? date : null;
}

export function parseDateSafe(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  if (typeof value === 'number') {
    return parseTimestamp(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (NUMERIC_STRING_REGEX.test(trimmed)) {
      return parseTimestamp(Number(trimmed));
    }

    if (DATE_ONLY_REGEX.test(trimmed)) {
      const date = new Date(`${trimmed}T00:00:00.000Z`);
      return isValidDate(date) ? date : null;
    }

    const brDateMatch = trimmed.match(BR_DATE_REGEX);
    if (brDateMatch) {
      const [, dayStr, monthStr, yearStr] = brDateMatch;
      const day = Number(dayStr);
      const month = Number(monthStr);
      const year = Number(yearStr);
      const date = new Date(Date.UTC(year, month - 1, day));
      const isSameDate =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
      return isSameDate ? date : null;
    }

    if (ISO_WITH_TIME_REGEX.test(trimmed)) {
      const date = new Date(trimmed);
      return isValidDate(date) ? date : null;
    }

    return null;
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return parseDateSafe(value.toDate());
    }

    if ('$date' in value) return parseDateSafe(value.$date);
    if ('milliseconds' in value) return parseDateSafe(value.milliseconds);
    if ('_milliseconds' in value) return parseDateSafe(value._milliseconds);
    if ('seconds' in value) return parseDateSafe(value.seconds);
    if ('_seconds' in value) return parseDateSafe(value._seconds);
  }

  return null;
}

export function normalizarDataParaCampoCanonico(value) {
  const parsed = parseDateSafe(value);
  if (!parsed) return '';

  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function resolverDataBaseTempoServico(militar = {}) {
  const fontes = ['data_inclusao', 'data_ingresso', 'data_praca'];

  for (const campo of fontes) {
    const rawValue = militar?.[campo];
    const date = parseDateSafe(rawValue);
    if (date) {
      return {
        campo,
        valor_original: rawValue,
        data: date,
      };
    }
  }

  return {
    campo: null,
    valor_original: null,
    data: null,
  };
}

export function calcularTempoServico(militar = {}, referencia = new Date()) {
  const dataReferencia = parseDateSafe(referencia);
  const dataBase = resolverDataBaseTempoServico(militar);

  if (!dataReferencia || !dataBase.data || dataBase.data > dataReferencia) {
    return {
      valido: false,
      dias_servico: null,
      anos_completos: null,
      data_base_calculo: dataBase.data,
      campo_data_base: dataBase.campo,
    };
  }

  const dias = differenceInDays(dataReferencia, dataBase.data);
  const anos = differenceInYears(dataReferencia, dataBase.data);

  return {
    valido: Number.isFinite(dias) && Number.isFinite(anos),
    dias_servico: Number.isFinite(dias) ? Math.max(0, dias) : null,
    anos_completos: Number.isFinite(anos) ? Math.max(0, anos) : null,
    data_base_calculo: dataBase.data,
    campo_data_base: dataBase.campo,
  };
}
