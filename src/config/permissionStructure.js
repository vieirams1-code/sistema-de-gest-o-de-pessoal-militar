export const permissionStructure = [
  {
    category: 'Gestão de Pessoal',
    modules: [
      { key: 'acesso_militares', label: 'Militares', actions: [] },
      { key: 'acesso_folha_alteracoes', label: 'Folha de Alterações', actions: [] },
      {
        key: 'acesso_ferias',
        label: 'Férias',
        actions: [
          { key: 'perm_gerir_cadeia_ferias', label: 'Gerir Cadeia de Férias', sensitive: true },
          { key: 'perm_excluir_ferias', label: 'Excluir Férias', sensitive: true },
          { key: 'perm_recalcular_ferias', label: 'Recalcular Férias', sensitive: true }
        ]
      },
      { key: 'acesso_livro', label: 'Livro', actions: [] },
      {
        key: 'acesso_atestados',
        label: 'Atestados',
        actions: [{ key: 'perm_excluir_atestado', label: 'Excluir Atestado', sensitive: true }]
      }
    ]
  },
  {
    category: 'Publicações e Conteúdo',
    modules: [
      {
        key: 'acesso_publicacoes',
        label: 'Publicações',
        actions: [
          { key: 'perm_editar_publicacoes', label: 'Editar Publicações', sensitive: true },
          { key: 'perm_publicar_bg', label: 'Publicar em BG', sensitive: true },
          { key: 'perm_tornar_sem_efeito_publicacao', label: 'Tornar s/ Efeito Pub.', sensitive: true },
          { key: 'perm_apostilar_publicacao', label: 'Apostilar Pub.', sensitive: true },
          { key: 'perm_publicar_ata_jiso', label: 'Publicar Ata JISO', sensitive: true },
          { key: 'perm_publicar_homologacao', label: 'Publicar Homologação', sensitive: true },
          { key: 'perm_gerir_jiso', label: 'Gerir JISO', sensitive: true },
          { key: 'perm_registrar_decisao_jiso', label: 'Registrar Decisão JISO', sensitive: true }
        ]
      }
    ]
  },
  {
    category: 'Operações e Recursos',
    modules: [
      { key: 'acesso_armamentos', label: 'Armamentos', actions: [] },
      {
        key: 'acesso_medalhas',
        label: 'Medalhas',
        actions: [
          { key: 'perm_indicar_medalhas', label: 'Indicar Medalhas', sensitive: true },
          { key: 'perm_conceder_medalhas', label: 'Conceder Medalhas', sensitive: true },
          { key: 'perm_resetar_indicacoes_medalhas', label: 'Resetar Indicações de Medalhas', sensitive: true },
          { key: 'perm_gerir_impedimentos_medalha', label: 'Gerir Impedimentos de Medalha', sensitive: true },
          { key: 'perm_gerir_dom_pedro_ii', label: 'Gerir Fluxo Dom Pedro II', sensitive: true },
          { key: 'perm_exportar_medalhas', label: 'Exportar Medalhas', sensitive: true }
        ]
      },
      {
        key: 'acesso_quadro_operacional',
        label: 'Quadro Operacional',
        actions: [
          { key: 'perm_gerir_quadro', label: 'Gerir Quadro Op.', sensitive: true },
          { key: 'perm_mover_card', label: 'Mover Card', sensitive: true },
          { key: 'perm_gerir_colunas', label: 'Gerir Colunas Quadro', sensitive: true },
          { key: 'perm_arquivar_card', label: 'Arquivar Card', sensitive: true },
          { key: 'perm_gerir_acoes_operacionais', label: 'Gerir Ações Op.', sensitive: true },
          { key: 'perm_excluir_acao_operacional', label: 'Excluir Ação Op.', sensitive: true }
        ]
      }
    ]
  },
  {
    category: 'Administração do Sistema',
    modules: [
      {
        key: 'acesso_templates',
        label: 'Templates',
        actions: [{ key: 'perm_gerir_templates', label: 'Gerir Templates', sensitive: true }]
      },
      {
        key: 'acesso_configuracoes',
        label: 'Configurações',
        actions: [
          { key: 'perm_admin_mode', label: 'Pode Ativar Modo Admin', sensitive: true },
          { key: 'perm_gerir_permissoes', label: 'Gerir Permissões', sensitive: true },
          { key: 'perm_gerir_estrutura', label: 'Gerir Estrutura Org.', sensitive: true },
          { key: 'perm_gerir_configuracoes', label: 'Gerir Configurações', sensitive: true }
        ]
      }
    ]
  }
];

export const modulosList = permissionStructure.flatMap((group) => group.modules.map(({ key, label }) => ({ key, label })));

export const acoesSensiveis = permissionStructure.flatMap((group) =>
  group.modules.flatMap((module) => module.actions.map(({ key, label }) => ({ key, label })))
);
