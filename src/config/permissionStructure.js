export const permissionStructure = [
  {
    category: 'Gestão de Pessoal',
    modules: [
      {
        key: 'acesso_militares',
        label: 'Militares',
        actions: [
          { key: 'perm_visualizar_militares', label: 'Visualizar Militares' },
          { key: 'perm_adicionar_militares', label: 'Adicionar Militares' },
          { key: 'perm_editar_militares', label: 'Editar Militares' },
          { key: 'perm_excluir_militares', label: 'Excluir Militares', sensitive: true }
        ]
      },
      {
        key: 'acesso_extracao_efetivo',
        label: 'Extração do Efetivo',
        actions: [
          { key: 'perm_visualizar_extracao_efetivo', label: 'Visualizar Extração do Efetivo' }
        ]
      },
      {
        key: 'acesso_migracao_militares',
        label: 'Migração de Militares',
        actions: [
          { key: 'perm_visualizar_importacao_militares', label: 'Visualizar Importação de Militares' },
          { key: 'perm_importar_militares', label: 'Importar Militares', sensitive: true },
          { key: 'perm_conferir_base_militares', label: 'Conferir Base de Militares', sensitive: true },
          { key: 'perm_ver_historico_importacoes', label: 'Ver Histórico de Importações', sensitive: true }
        ]
      },
      {
        key: 'acesso_migracao_alteracoes_legado',
        label: 'Migração de Alterações Legado',
        actions: [
          { key: 'perm_visualizar_migracao_legado', label: 'Visualizar Migração Legado' },
          { key: 'perm_adicionar_migracao_legado', label: 'Adicionar Migração Legado', sensitive: true },
          { key: 'perm_editar_migracao_legado', label: 'Editar Migração Legado', sensitive: true },
          { key: 'perm_excluir_migracao_legado', label: 'Excluir Migração Legado', sensitive: true },
          { key: 'perm_classificar_legado', label: 'Classificar Pendências do Legado', sensitive: true },
          { key: 'perm_revisar_duplicidades', label: 'Revisar Duplicidades de Militar', sensitive: true },
          { key: 'perm_migrar_alteracoes_legado', label: 'Migrar Alterações Legado', sensitive: true }
        ]
      },
      {
        key: 'acesso_folha_alteracoes',
        label: 'Folha de Alterações',
        actions: [
          { key: 'perm_visualizar_folha_alteracoes', label: 'Visualizar Folha de Alterações' },
          { key: 'perm_adicionar_folha_alteracoes', label: 'Adicionar Folha de Alterações' },
          { key: 'perm_editar_folha_alteracoes', label: 'Editar Folha de Alterações' },
          { key: 'perm_excluir_folha_alteracoes', label: 'Excluir Folha de Alterações', sensitive: true }
        ]
      },
      {
        key: 'acesso_registros_militar',
        label: 'Registros do Militar',
        actions: [
          { key: 'perm_visualizar_registros_militar', label: 'Visualizar Registros do Militar' },
          { key: 'perm_editar_registros_militar', label: 'Editar Registros do Militar', sensitive: true },
          { key: 'perm_excluir_registros_militar', label: 'Excluir Registros do Militar', sensitive: true }
        ]
      },
      {
        key: 'acesso_controle_comportamento',
        label: 'Controle de Comportamento',
        actions: [
          { key: 'perm_visualizar_controle_comportamento', label: 'Visualizar Controle de Comportamento' },
          { key: 'perm_gerar_pendencias_comportamento', label: 'Gerar Pendências de Comportamento', sensitive: true },
          { key: 'perm_aprovar_mudanca_comportamento', label: 'Aprovar Mudança de Comportamento', sensitive: true }
        ]
      },
      {
        key: 'acesso_punicoes',
        label: 'Lançamento de Punições',
        actions: [
          { key: 'perm_visualizar_punicoes', label: 'Visualizar Lançamento de Punições' },
          { key: 'perm_adicionar_punicoes', label: 'Adicionar Punições', sensitive: true },
          { key: 'perm_editar_punicoes', label: 'Editar Punições', sensitive: true },
          { key: 'perm_excluir_punicoes', label: 'Excluir Punições', sensitive: true }
        ]
      },
      {
        key: 'acesso_ferias',
        label: 'Férias',
        actions: [
          { key: 'perm_visualizar_ferias', label: 'Visualizar Férias' },
          { key: 'perm_adicionar_ferias', label: 'Adicionar Férias' },
          { key: 'perm_editar_ferias', label: 'Editar Férias' },
          { key: 'perm_gerir_cadeia_ferias', label: 'Gerir Cadeia de Férias', sensitive: true },
          { key: 'perm_excluir_ferias', label: 'Excluir Férias', sensitive: true },
          { key: 'perm_recalcular_ferias', label: 'Recalcular Férias', sensitive: true }
        ]
      },
      {
        key: 'acesso_livro',
        label: 'Livro',
        actions: [
          { key: 'perm_visualizar_livro', label: 'Visualizar Livro' },
          { key: 'perm_adicionar_livro', label: 'Adicionar Livro' },
          { key: 'perm_editar_livro', label: 'Editar Livro' },
          { key: 'perm_excluir_livro', label: 'Excluir Livro', sensitive: true }
        ]
      },
      {
        key: 'acesso_rp',
        label: 'RP',
        actions: [
          { key: 'perm_visualizar_rp', label: 'Visualizar RP' }
        ]
      },
      {
        key: 'acesso_atestados',
        label: 'Atestados',
        actions: [
          { key: 'perm_visualizar_atestados', label: 'Visualizar Atestados' },
          { key: 'perm_adicionar_atestados', label: 'Adicionar Atestado' },
          { key: 'perm_editar_atestados', label: 'Editar Atestado' },
          { key: 'perm_excluir_atestados', label: 'Excluir Atestados', sensitive: true },
          { key: 'perm_excluir_atestado', label: 'Excluir Atestado', sensitive: true }
        ]
      },
      {
        key: 'acesso_controle_atestados_temporarios',
        label: 'Controle de Atestados',
        actions: [
          { key: 'perm_visualizar_controle_atestados_temporarios', label: 'Visualizar Controle de Atestados' }
        ]
      },
      {
        key: 'acesso_central_pendencias',
        label: 'Central de Pendências',
        actions: [
          { key: 'perm_visualizar_central_pendencias', label: 'Visualizar Central de Pendências' }
        ]
      },
      {
        key: 'acesso_procedimentos_processos',
        label: 'Procedimentos e Processos',
        actions: [
          { key: 'perm_visualizar_procedimentos_processos', label: 'Visualizar Procedimentos e Processos' },
          { key: 'perm_criar_procedimento', label: 'Criar Procedimento', sensitive: true },
          { key: 'perm_editar_procedimento', label: 'Editar Procedimento', sensitive: true },
          { key: 'perm_encerrar_procedimento', label: 'Encerrar Procedimento', sensitive: true },
          { key: 'perm_gerir_prazos_procedimento', label: 'Gerir Prazos do Procedimento', sensitive: true }
        ]
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
          { key: 'perm_visualizar_publicacoes', label: 'Visualizar Publicações' },
          { key: 'perm_editar_publicacoes', label: 'Editar Publicações', sensitive: true },
          { key: 'perm_adicionar_publicacoes', label: 'Adicionar Publicações', sensitive: true },
          { key: 'perm_excluir_publicacoes', label: 'Excluir Publicações', sensitive: true },
          { key: 'perm_publicar_bg', label: 'Publicar em BG', sensitive: true },
          { key: 'perm_tornar_sem_efeito_publicacao', label: 'Tornar s/ Efeito Pub.', sensitive: true },
          { key: 'perm_apostilar_publicacao', label: 'Apostilar Pub.', sensitive: true },
          { key: 'perm_publicar_ata_jiso', label: 'Publicar Ata JISO', sensitive: true },
          { key: 'perm_publicar_homologacao', label: 'Publicar Homologação', sensitive: true },
          { key: 'perm_gerir_jiso', label: 'Gerir JISO', sensitive: true },
          { key: 'perm_registrar_decisao_jiso', label: 'Registrar Decisão JISO', sensitive: true }
        ]
      },
      {
        key: 'acesso_controle_publicacoes',
        label: 'Controle de Publicações',
        actions: [
          { key: 'perm_visualizar_controle_publicacoes', label: 'Visualizar Controle de Publicações' }
        ]
      },
      {
        key: 'acesso_conciliacao_boletim',
        label: 'Conciliação com Boletim',
        actions: [
          { key: 'perm_visualizar_conciliacao_boletim', label: 'Visualizar Conciliação com Boletim' }
        ]
      }
    ]
  },
  {
    category: 'Operações e Recursos',
    modules: [
      {
        key: 'acesso_armamentos',
        label: 'Armamentos',
        actions: [
          { key: 'perm_visualizar_armamentos', label: 'Visualizar Armamentos' },
          { key: 'perm_adicionar_armamentos', label: 'Adicionar Armamentos' },
          { key: 'perm_editar_armamentos', label: 'Editar Armamentos' },
          { key: 'perm_excluir_armamentos', label: 'Excluir Armamentos', sensitive: true }
        ]
      },
      {
        key: 'acesso_medalhas',
        label: 'Medalhas',
        actions: [
          { key: 'perm_visualizar_medalhas', label: 'Visualizar Medalhas' },
          { key: 'perm_adicionar_medalhas', label: 'Adicionar Medalhas', sensitive: true },
          { key: 'perm_editar_medalhas', label: 'Editar Medalhas', sensitive: true },
          { key: 'perm_excluir_medalhas', label: 'Excluir Medalhas', sensitive: true },
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
          { key: 'perm_visualizar_quadro_operacional', label: 'Visualizar Quadro Operacional' },
          { key: 'perm_adicionar_quadro_operacional', label: 'Adicionar Quadro Operacional', sensitive: true },
          { key: 'perm_editar_quadro_operacional', label: 'Editar Quadro Operacional', sensitive: true },
          { key: 'perm_excluir_quadro_operacional', label: 'Excluir Quadro Operacional', sensitive: true },
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
          { key: 'perm_gerir_configuracoes', label: 'Gerir Configurações', sensitive: true }
        ]
      },
      {
        key: 'acesso_operacoes_administrativas',
        label: 'Operações Administrativas',
        actions: [
          { key: 'perm_reset_operacional', label: 'Executar Reset Operacional', sensitive: true }
        ]
      },
      {
        key: 'acesso_adicoes_personalizacoes',
        label: 'Adições e Personalizações',
        actions: [
          { key: 'perm_gerir_adicoes_personalizacoes', label: 'Gerir Adições e Personalizações', sensitive: true }
        ]
      },
      {
        key: 'acesso_permissoes_usuarios',
        label: 'Permissões de Usuários',
        actions: [
          { key: 'perm_gerir_permissoes_usuarios', label: 'Gerir Permissões de Usuários', sensitive: true },
          { key: 'perm_excluir_usuarios_acesso', label: 'Excluir Usuários de Acesso', sensitive: true },
          { key: 'perm_gerir_permissoes', label: 'Gerir Permissões (Legado)', sensitive: true }
        ]
      },
      {
        key: 'acesso_perfis_permissao',
        label: 'Perfis de Permissão',
        actions: [
          { key: 'perm_gerir_perfis_permissao', label: 'Gerir Perfis de Permissão', sensitive: true }
        ]
      },
      {
        key: 'acesso_estrutura_organizacional',
        label: 'Estrutura Organizacional',
        actions: [
          { key: 'perm_visualizar_estrutura_organizacional', label: 'Visualizar Estrutura Organizacional' },
          { key: 'perm_gerir_estrutura_organizacional', label: 'Gerir Estrutura Organizacional', sensitive: true },
          { key: 'perm_gerir_estrutura', label: 'Gerir Estrutura Org. (Legado)', sensitive: true }
        ]
      },
      {
        key: 'acesso_lotacao_militares',
        label: 'Lotação de Militares',
        actions: [
          { key: 'perm_visualizar_lotacao_militares', label: 'Visualizar Lotação de Militares' },
          { key: 'perm_gerir_lotacao_militares', label: 'Gerir Lotação de Militares', sensitive: true }
        ]
      }
    ]
  }
];

export const modulosList = permissionStructure.flatMap((group) => group.modules.map(({ key, label }) => ({ key, label })));

export const acoesSensiveis = permissionStructure.flatMap((group) =>
  group.modules.flatMap((module) => module.actions.map(({ key, label }) => ({ key, label })))
);
