import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  const response = await base44.functions.invoke('centralConferenciasGateway', { action, payload });
  const data = response?.data ?? response ?? {};
  if (data?.error) throw new Error(data.error);
  return data;
}

export const centralConferenciasService = {
  bootstrap: () => invoke('BOOTSTRAP'),
  listar: () => invoke('LIST'),
  salvar: (conferencia, itens) => invoke('SAVE', { conferencia, itens }),
  atualizarItem: (itemId, data) => invoke('UPDATE_ITEM', { itemId, data }),
  concluir: (conferenciaId) => invoke('CONCLUDE', { conferenciaId }),
};
