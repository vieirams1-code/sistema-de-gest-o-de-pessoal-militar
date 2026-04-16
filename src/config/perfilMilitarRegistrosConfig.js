import { format } from 'date-fns';

export const PERFIL_MILITAR_CORTE_SISTEMA_ISO = '2026-01-01';
export const PERFIL_MILITAR_MODULO_REGISTROS_LABEL = 'Registros do Militar';

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
