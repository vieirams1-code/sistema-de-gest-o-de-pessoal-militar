import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  const response = await base44.functions.invoke('gruposEfetivoGateway', { action, payload });
  const data = response?.data ?? response ?? {};
  if (data?.error) throw new Error(data.error);
  return data;
}

export const listarGruposEfetivo = () => invoke('LIST');
export const criarGrupoEfetivo = (data) => invoke('CREATE_GROUP', { data });
export const atualizarGrupoEfetivo = (grupoId, data) => invoke('UPDATE_GROUP', { grupoId, data });
export const alternarGrupoEfetivo = (grupoId) => invoke('TOGGLE_GROUP', { grupoId });
export const adicionarMembroGrupoEfetivo = (grupoId, militarId) => invoke('ADD_MEMBER', { grupoId, militarId });
export const removerMembroGrupoEfetivo = (membroId) => invoke('REMOVE_MEMBER', { membroId });
