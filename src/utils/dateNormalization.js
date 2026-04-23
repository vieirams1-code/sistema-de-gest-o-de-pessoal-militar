const BR_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_WITH_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T.+$/;
const NUMERIC_STRING_REGEX = /^\d+(\.\d+)?$/;

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function isDateInReasonableRange(date, { minYear = 1900, maxYear = new Date().getUTCFullYear() + 1 } = {}) {
  if (!isValidDate(date)) return false;
  const year = date.getUTCFullYear();
  return year >= minYear && year <= maxYear;
}

function dateFromPartsUTC(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!isValidDate(date)) return null;
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function parseExcelSerialDate(value) {
  if (!Number.isFinite(value)) return null;
  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  if (!isValidDate(dateInfo)) return null;
  return new Date(Date.UTC(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate()));
}

export function parseLegacyDateToUTC(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return isValidDate(value) ? new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())) : null;
  }

  if (typeof value === 'number') {
    const parsed = parseExcelSerialDate(value);
    if (parsed) return parsed;
    const normalized = value < 1e12 ? value * 1000 : value;
    const byTimestamp = new Date(normalized);
    return isValidDate(byTimestamp) ? byTimestamp : null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const brMatch = trimmed.match(BR_DATE_REGEX);
  if (brMatch) {
    const [, dayStr, monthStr, yearStr] = brMatch;
    return dateFromPartsUTC(Number(yearStr), Number(monthStr), Number(dayStr));
  }

  const isoMatch = trimmed.match(ISO_DATE_REGEX);
  if (isoMatch) {
    const [, yearStr, monthStr, dayStr] = isoMatch;
    return dateFromPartsUTC(Number(yearStr), Number(monthStr), Number(dayStr));
  }

  if (ISO_WITH_TIME_REGEX.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isValidDate(date)) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  if (NUMERIC_STRING_REGEX.test(trimmed)) {
    const numero = Number(trimmed);
    const parsedExcel = parseExcelSerialDate(numero);
    if (parsedExcel) return parsedExcel;
    const normalized = numero < 1e12 ? numero * 1000 : numero;
    const byTimestamp = new Date(normalized);
    return isValidDate(byTimestamp) ? byTimestamp : null;
  }

  return null;
}

export function normalizeLegacyDateToCanonical(value, rangeOptions) {
  const parsed = parseLegacyDateToUTC(value);
  if (!parsed || !isDateInReasonableRange(parsed, rangeOptions)) return '';

  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function canonicalDateToBR(value) {
  const canonical = normalizeLegacyDateToCanonical(value);
  if (!canonical) return '';
  const [year, month, day] = canonical.split('-');
  return `${day}/${month}/${year}`;
}

export function canonicalDateToUTCDate(value) {
  const canonical = normalizeLegacyDateToCanonical(value);
  if (!canonical) return null;
  const [year, month, day] = canonical.split('-').map(Number);
  return dateFromPartsUTC(year, month, day);
}
