const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_ONLY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getDateParts(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = ISO_DATE_ONLY_PATTERN.exec(trimmed);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const brMatch = BR_DATE_ONLY_PATTERN.exec(trimmed);
  if (brMatch) {
    return {
      year: Number(brMatch[3]),
      month: Number(brMatch[2]),
      day: Number(brMatch[1]),
    };
  }

  return null;
}

function toNormalizedDateOnly(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function parseDateOnlyStrict(value) {
  const parts = getDateParts(value);
  if (!parts) return null;

  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) {
    return null;
  }

  const date = new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  const isRoundTripValid = date.getFullYear() === parts.year
    && date.getMonth() === parts.month - 1
    && date.getDate() === parts.day;

  return isRoundTripValid ? date : null;
}

export function isValidDateOnly(value) {
  return parseDateOnlyStrict(value) !== null;
}

export function normalizeDateOnly(value) {
  const date = parseDateOnlyStrict(value);
  if (!date) return null;

  return toNormalizedDateOnly({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

export function compareDateOnly(a, b) {
  const normalizedA = normalizeDateOnly(a);
  const normalizedB = normalizeDateOnly(b);

  if (!normalizedA || !normalizedB) return null;
  if (normalizedA === normalizedB) return 0;
  return normalizedA < normalizedB ? -1 : 1;
}

export function isBeforeDateOnly(a, b) {
  return compareDateOnly(a, b) === -1;
}
