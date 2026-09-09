import { listarAdminEscopado, obterAdminEscopado } from './cudEscopadoClient.js';

export async function listarPerfisPermissaoAdmin() {
  return listarAdminEscopado('PerfilPermissao');
}

export async function obterPerfilPermissaoAdmin(profileId) {
  return obterAdminEscopado('PerfilPermissao', profileId);
}

export async function listarAcessosUsuariosAdmin() {
  return listarAdminEscopado('UsuarioAcesso');
}

export async function obterAcessoUsuarioAdmin(accessId) {
  return obterAdminEscopado('UsuarioAcesso', accessId);
}

export async function listarUsoPerfisAdmin() {
  const acessos = await listarAdminEscopado('UsuarioAcesso');
  return (acessos || []).map((item) => ({
    id: item?.id || '',
    perfil_id: item?.perfil_id || '',
    ativo: item?.ativo !== false,
    nome_usuario: item?.nome_usuario || '',
    user_email: item?.user_email || '',
  }));
}
