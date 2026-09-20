import { base44 } from '@/api/base44Client';

async function invoke(functionName, action, payload = {}) {
  try {
    const response = await base44.functions.invoke(functionName, { action, ...payload });
    const data = response?.data ?? response ?? {};
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error?.message || 'Falha ao acessar a Sargenteação.');
  }
}

const invokeRegistry = (action, payload) => invoke('sargenteacaoGateway', action, payload);
const invokeScale = (action, payload) => invoke('sargenteacaoEscalasGateway', action, payload);

export const listarSargenteacao = async () => {
  const [registries, scales] = await Promise.all([invokeRegistry('LIST'), invokeScale('LIST')]);
  return { ...registries, ...scales };
};
export const salvarSargenteacao = (tipo, id, data) => invokeRegistry('SAVE', { tipo, id, data });
export const alternarSargenteacao = (tipo, id) => invokeRegistry('TOGGLE', { tipo, id });
export const criarEscala = (data) => invokeScale('CREATE_SCALE', { data });
export const adicionarGuarnicao = (escalaId, modeloId, nome = '') => invokeScale('ADD_CREW', { escalaId, modeloId, nome });
export const escalarMilitar = (guarnicaoId, militarId, funcao_operacional) => invokeScale('ASSIGN_MILITARY', { guarnicaoId, militarId, funcao_operacional });
export const removerMilitarEscalado = (id) => invokeScale('REMOVE_ASSIGNMENT', { id });
export const removerGuarnicao = (id) => invokeScale('REMOVE_CREW', { id });
export const publicarEscala = (id) => invokeScale('PUBLISH_SCALE', { id });
export const cancelarEscala = (id) => invokeScale('CANCEL_SCALE', { id });
