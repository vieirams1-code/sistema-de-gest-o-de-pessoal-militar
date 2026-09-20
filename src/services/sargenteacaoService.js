import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  try {
    const response = await base44.functions.invoke('sargenteacaoGateway', { action, ...payload });
    const data = response?.data ?? response ?? {};
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error?.message || 'Falha ao acessar a Sargenteação.');
  }
}

export const listarSargenteacao = () => invoke('LIST');
export const salvarSargenteacao = (tipo, id, data) => invoke('SAVE', { tipo, id, data });
export const alternarSargenteacao = (tipo, id) => invoke('TOGGLE', { tipo, id });
export const criarEscala = (data) => invoke('SAVE_SCALE', { data });
export const adicionarGuarnicao = (escalaId, modeloId, nome = '') => invoke('ADD_CREW', { escalaId, modeloId, nome });
export const escalarMilitar = (guarnicaoId, militarId, funcao_operacional) => invoke('ASSIGN_MILITARY', { guarnicaoId, militarId, funcao_operacional });
export const removerMilitarEscalado = (id) => invoke('REMOVE_ASSIGNMENT', { id });
export const removerGuarnicao = (id) => invoke('REMOVE_CREW', { id });
export const publicarEscala = (id) => invoke('PUBLISH_SCALE', { id });
export const cancelarEscala = (id) => invoke('CANCEL_SCALE', { id });
