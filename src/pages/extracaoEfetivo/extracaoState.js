export const STATUS_BADGE_VARIANTS = Object.freeze({
  success: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  warning: 'border-amber-200 bg-amber-100 text-amber-700',
  info: 'border-blue-200 bg-blue-100 text-blue-700',
  danger: 'border-red-200 bg-red-100 text-red-700',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
});

export const STATUS_DOT_VARIANTS = Object.freeze({
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  danger: 'bg-red-500',
  neutral: 'bg-slate-400',
});

export const STATUS_CADASTRO_BADGE_VARIANTS = Object.freeze({
  Ativo: 'success',
  Inativo: 'neutral',
  Reserva: 'warning',
  Reforma: 'info',
  Falecido: 'danger',
});

export const statusBadgeClass = Object.freeze({
  Ativo: STATUS_BADGE_VARIANTS.success,
  Inativo: STATUS_BADGE_VARIANTS.neutral,
  Reserva: STATUS_BADGE_VARIANTS.warning,
  Reforma: STATUS_BADGE_VARIANTS.info,
  Falecido: STATUS_BADGE_VARIANTS.danger,
});

export const KPI_ICON_TONES = Object.freeze({
  slate: 'bg-slate-100 text-slate-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
});

export function getStatusBadgeVariant(status) {
  return STATUS_CADASTRO_BADGE_VARIANTS[status] || STATUS_CADASTRO_BADGE_VARIANTS.Ativo;
}

export function getMilitarInitials(nome = '') {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!partes.length) return '—';

  const primeira = partes[0]?.[0] || '';
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] || '' : '';

  return `${primeira}${ultima}`.toUpperCase();
}

export function formatKpiValue(value) {
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  return String(value ?? '—');
}
