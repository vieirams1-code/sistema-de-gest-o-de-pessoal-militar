import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useCurrentUser() {
  const { data: user, isLoading: loadingAuth } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: usuarioAcessoList, isLoading: loadingAcesso, isFetched: fetchedAcesso } = useQuery({
    queryKey: ['usuarioAcesso', user?.email],
    queryFn: () => base44.entities.UsuarioAcesso.filter({ user_email: user.email, ativo: true }),
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingAuth || loadingAcesso;
  const isAccessResolved = !user?.email || !loadingAcesso || fetchedAcesso;
  const acesso = usuarioAcessoList?.[0]; // Pega o primeiro acesso ativo encontrado

  // Observação: mesmo com perfil vinculado (perfil_id/perfil_nome), a autorização em runtime
  // continua baseada nos booleanos do próprio UsuarioAcesso para manter compatibilidade.
  // Resolve as propriedades explicitamente usando UsuarioAcesso, com fallback para o modelo antigo (User)
  const isAdmin = acesso 
    ? acesso.tipo_acesso === 'admin' 
    : (user?.role === 'admin' || user?.isAdmin === true);

  const subgrupamentoId = acesso 
    ? (acesso.subgrupamento_id || acesso.grupamento_id || null) 
    : (user?.subgrupamento_id || null);

  const subgrupamentoTipo = acesso 
    ? (acesso.tipo_acesso === 'setor' ? 'Grupamento' : 
       acesso.tipo_acesso === 'subsetor' ? 'Subgrupamento' : 
       acesso.tipo_acesso === 'unidade' ? 'Unidade' : null) 
    : (user?.subgrupamento_tipo || null);

  const userEmail = user?.email || null;
  const linkedMilitarId = acesso ? (acesso.militar_id || null) : (user?.militar_id || null);
  const linkedMilitarEmail = acesso ? (acesso.militar_email || null) : (user?.militar_email || null);

  // Modo de acesso: 'admin', 'setor', 'subsetor', 'unidade', 'proprio'
  let modoAcesso = 'proprio';
  if (acesso) {
    modoAcesso = acesso.tipo_acesso || 'proprio';
  } else {
    if (isAdmin) modoAcesso = 'admin';
    else if (subgrupamentoId) {
      if (subgrupamentoTipo === 'Grupamento') modoAcesso = 'setor';
      else if (subgrupamentoTipo === 'Subgrupamento') modoAcesso = 'subsetor';
      else if (subgrupamentoTipo === 'Unidade') modoAcesso = 'unidade';
      else modoAcesso = 'subsetor';
    } else {
      modoAcesso = 'proprio';
    }
  }

  const getAccessModeFromUser = (targetUser, targetAcesso = null) => {
    if (targetAcesso) return targetAcesso.tipo_acesso || 'proprio';
    if (!targetUser) return 'proprio';
    if (targetUser.role === 'admin' || targetUser.isAdmin === true) return 'admin';
    if (targetUser.subgrupamento_tipo === 'Grupamento') return 'setor';
    if (targetUser.subgrupamento_tipo === 'Subgrupamento') return 'subsetor';
    if (targetUser.subgrupamento_tipo === 'Unidade') return 'unidade';
    return 'proprio';
  };

  /**
   * Permissão por módulo via UsuarioAcesso.
   * Campos: acesso_militares, acesso_ferias, acesso_livro, acesso_publicacoes,
   *         acesso_atestados, acesso_armamentos, acesso_medalhas, acesso_templates,
   *         acesso_configuracoes, acesso_quadro_operacional, acesso_processos
   *
   * @param {string} modulo — ex: 'ferias', 'militares', 'configuracoes'
   */
  const canAccessModule = (modulo) => {
    if (user?.email && !isAccessResolved) return false;

    // Admin sem registro de acesso → libera tudo (fallback legado)
    if (isAdmin && !acesso) return true;
    // Admin com registro → respeita campo se existir, senão libera
    if (isAdmin && acesso) {
      const campo = `acesso_${modulo}`;
      return acesso[campo] !== false; // undefined/true → true
    }
    // Usuário comum com registro → lê o campo
    if (acesso) {
      const campo = `acesso_${modulo}`;
      return acesso[campo] === true;
    }
    // Sem registro e sem admin → bloqueia
    return false;
  };

  /**
   * Permissão por ação sensível via UsuarioAcesso.
   * Campos: perm_admin_mode, perm_gerir_cadeia_ferias, perm_excluir_ferias,
   *         perm_recalcular_ferias, perm_gerir_templates, perm_gerir_permissoes,
   *         perm_gerir_estrutura, perm_editar_publicacoes, perm_publicar_bg,
   *         perm_tornar_sem_efeito_publicacao, perm_apostilar_publicacao,
   *         perm_publicar_ata_jiso, perm_publicar_homologacao, perm_gerir_jiso,
   *         perm_registrar_decisao_jiso, perm_excluir_atestado, perm_gerir_quadro,
   *         perm_mover_card, perm_gerir_colunas, perm_arquivar_card,
   *         perm_gerir_acoes_operacionais, perm_excluir_acao_operacional,
   *         perm_criar_processo, perm_editar_processo, perm_excluir_processo,
   *         perm_gerir_configuracoes
   *
   * @param {string} acao — ex: 'admin_mode', 'excluir_ferias', 'gerir_cadeia_ferias'
   */
  const canAccessAction = (acao) => {
    if (user?.email && !isAccessResolved) return false;

    if (isAdmin && !acesso) return true;
    if (isAdmin && acesso) {
      const campo = `perm_${acao}`;
      return acesso[campo] !== false;
    }
    if (acesso) {
      const campo = `perm_${acao}`;
      return acesso[campo] === true;
    }
    return false;
  };

  /**
   * Retorna true se o usuário tem acesso ao registro.
   * @param registro - objeto com grupamento_id, subgrupamento_id e/ou created_by
   */
  const hasAccess = (registro) => {
    if (!registro) return false;
    if (isAdmin) return true;

    // Modo Setor: vê tudo do setor (via grupamento_id) e seus subsetores
    if (modoAcesso === 'setor') {
      return (
        registro.grupamento_id === subgrupamentoId ||
        registro.subgrupamento_id === subgrupamentoId
      );
    }

    // Modo Subsetor/Seção ou Unidade: vê apenas o próprio subsetor/unidade (id exato)
    if (modoAcesso === 'subsetor' || modoAcesso === 'unidade') {
      return registro.subgrupamento_id === subgrupamentoId;
    }

    // Modo Próprio: acessa apenas registros criados pelo próprio email ou com created_by igual ao email
    if (modoAcesso === 'proprio') {
      return (
        registro.created_by === userEmail ||
        registro.militar_email === userEmail ||
        registro.email === userEmail
      );
    }

    return false;
  };

  const hasSelfAccess = (registro) => {
    if (!registro) return false;
    if (isAdmin) return true;

    if (linkedMilitarId && registro.id === linkedMilitarId) {
      return true;
    }

    const possibleEmails = [
      registro.email,
      registro.email_particular,
      registro.email_funcional,
      registro.militar_email,
      registro.created_by,
      registro.usuario_email,
    ].filter(Boolean);

    const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
    return knownEmails.some((email) => possibleEmails.includes(email));
  };

  const getMilitarScopeFilters = () => {
    if (isAdmin) return [];

    if (modoAcesso === 'setor' && subgrupamentoId) {
      return [{ grupamento_id: subgrupamentoId }, { subgrupamento_id: subgrupamentoId }];
    }

    if ((modoAcesso === 'subsetor' || modoAcesso === 'unidade') && subgrupamentoId) {
      return [{ subgrupamento_id: subgrupamentoId }];
    }

    if (modoAcesso === 'proprio' && userEmail) {
      const filters = [];
      if (linkedMilitarId) filters.push({ id: linkedMilitarId });
      filters.push({ email: userEmail }, { email_particular: userEmail }, { email_funcional: userEmail }, { created_by: userEmail });
      if (linkedMilitarEmail && linkedMilitarEmail !== userEmail) {
        filters.push({ email: linkedMilitarEmail }, { email_particular: linkedMilitarEmail }, { email_funcional: linkedMilitarEmail }, { militar_email: linkedMilitarEmail });
      }
      return filters;
    }

    return [];
  };

  // Mantém hasModuleAccess como alias para compatibilidade
  const hasModuleAccess = canAccessModule;

  return {
    user,
    isLoading,
    isAccessResolved,
    isAdmin,
    subgrupamentoId,
    subgrupamentoTipo,
    modoAcesso,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    hasAccess,
    hasSelfAccess,
    hasModuleAccess,
    canAccessModule,
    canAccessAction,
    getAccessModeFromUser,
    getMilitarScopeFilters,
  };
}
