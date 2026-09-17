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
