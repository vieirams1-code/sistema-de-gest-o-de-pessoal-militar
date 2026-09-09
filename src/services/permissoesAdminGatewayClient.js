import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  const response = await base44.functions.invoke('permissoesAdminGateway', { action, payload });
  const data = response?.data ?? response ?? {};
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listarPerfisPermissaoAdmin() {
  const data = await invoke('LIST_PROFILES');
  return data?.perfis || [];
}

export async function obterPerfilPermissaoAdmin(profileId) {
  const data = await invoke('GET_PROFILE', { profileId });
  return data?.perfil || null;
}

export async function listarAcessosUsuariosAdmin() {
  const data = await invoke('LIST_ACCESS');
  return data?.acessos || [];
}

export async function obterAcessoUsuarioAdmin(accessId) {
  const data = await invoke('GET_ACCESS', { accessId });
  return data?.acesso || null;
}

export async function listarUsoPerfisAdmin() {
  const data = await invoke('LIST_PROFILE_USAGE');
  return data?.uso || [];
}
