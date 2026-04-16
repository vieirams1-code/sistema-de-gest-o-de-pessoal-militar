import { format } from 'date-fns';

const PERFIL_MILITAR_CORTE_SISTEMA_ISO_PADRAO = '2026-01-01';

function resolverCorteSistemaIso() {
  const valorConfigurado = String(import.meta?.env?.VITE_PERFIL_MILITAR_CORTE_SISTEMA_ISO || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(valorConfigurado)) return valorConfigurado;
  return PERFIL_MILITAR_CORTE_SISTEMA_ISO_PADRAO;
}

export const PERFIL_MILITAR_CORTE_SISTEMA_ISO = resolverCorteSistemaIso();
export const PERFIL_MILITAR_MODULO_REGISTROS_LABEL = String(import.meta?.env?.VITE_PERFIL_MILITAR_MODULO_REGISTROS_LABEL || 'Registros do Militar').trim() || 'Registros do Militar';

export function getPerfilMilitarCorteSistemaLabel() {
  try {
    return format(new Date(`${PERFIL_MILITAR_CORTE_SISTEMA_ISO}T00:00:00`), 'dd/MM/yyyy');
  } catch {
    return PERFIL_MILITAR_CORTE_SISTEMA_ISO;
  }
}

export function getMensagemRegistrosSistemaPerfilMilitar() {
  return `Dados lançados no sistema a partir de ${getPerfilMilitarCorteSistemaLabel()}. Para registros anteriores ou importados do legado, consulte o módulo ${PERFIL_MILITAR_MODULO_REGISTROS_LABEL}.`;
}

export function isRegistroLegado(registro) {
  if (!registro || typeof registro !== 'object') return false;
  if (registro.importado_legado === true) return true;
  return String(registro.origem_registro || '').trim().toLowerCase() === 'legado';
}

export function filtrarRegistrosSistema(registros = []) {
  if (!Array.isArray(registros)) return [];
  return registros.filter((registro) => !isRegistroLegado(registro));
}
