export const PROFILE_MATRIX_VERSION = '2026.09.08-v3';
export const PERMISSION_MODULES = [
  {
    "key": "acesso_militares",
    "actions": [
      "perm_visualizar_militares",
      "perm_ver_dados_sensiveis_militar",
      "perm_adicionar_militares",
      "perm_editar_militares",
      "perm_gerenciar_tags_militar",
      "perm_excluir_militares",
      "perm_visualizar_contratos_designacao",
      "perm_criar_contrato_designacao",
      "perm_encerrar_contrato_designacao",
      "perm_cancelar_contrato_designacao",
      "perm_excluir_contrato_designacao",
      "perm_editar_metadados_contrato_designacao",
      "perm_aplicar_transicao_legado_ativa",
      "perm_aplicar_transicao_designacao_manual"
    ]
  },
  {
    "key": "acesso_gratificacoes_funcao",
    "actions": [
      "perm_visualizar_gratificacoes_funcao",
      "perm_gerir_gratificacoes_funcao",
      "perm_gerir_cotas_gratificacao_funcao"
    ]
  },
  {
    "key": "acesso_grupos_efetivo",
    "actions": [
      "perm_visualizar_grupos_efetivo",
      "perm_criar_grupos_efetivo",
      "perm_editar_grupos_efetivo",
      "perm_gerir_membros_grupos_efetivo"
    ]
  },
  {
    "key": "acesso_extracao_efetivo",
    "actions": [
      "perm_visualizar_extracao_efetivo",
      "perm_exportar_extracao_efetivo"
    ]
  },
  {
    "key": "acesso_migracao_militares",
    "actions": [
      "perm_visualizar_importacao_militares",
      "perm_importar_militares",
      "perm_conferir_base_militares",
      "perm_ver_historico_importacoes"
    ]
  },
  {
    "key": "acesso_migracao_alteracoes_legado",
    "actions": [
      "perm_visualizar_migracao_legado",
      "perm_adicionar_migracao_legado",
      "perm_editar_migracao_legado",
      "perm_excluir_migracao_legado",
      "perm_classificar_legado",
      "perm_gerir_classificacoes_historicas",
      "perm_revisar_duplicidades",
      "perm_migrar_alteracoes_legado"
    ]
  },
  {
    "key": "acesso_antiguidade",
    "actions": [
      "perm_visualizar_rastreamento_promocoes",
      "perm_reverter_promocao_excepcional"
    ]
  },
  {
    "key": "acesso_folha_alteracoes",
    "actions": [
      "perm_visualizar_folha_alteracoes",
      "perm_adicionar_folha_alteracoes",
      "perm_editar_folha_alteracoes",
      "perm_excluir_folha_alteracoes"
    ]
  },
  {
    "key": "acesso_acervo_historico",
    "actions": [
      "perm_visualizar_acervo_historico",
      "perm_baixar_acervo_historico",
      "perm_gerir_acervo_historico"
    ]
  },
  {
    "key": "acesso_registros_militar",
    "actions": [
      "perm_visualizar_registros_militar",
      "perm_editar_registros_militar",
      "perm_excluir_registros_militar"
    ]
  },
  {
    "key": "acesso_controle_comportamento",
    "actions": [
      "perm_visualizar_controle_comportamento",
      "perm_gerar_pendencias_comportamento",
      "perm_aprovar_mudanca_comportamento"
    ]
  },
  {
    "key": "acesso_punicoes",
    "actions": [
      "perm_visualizar_punicoes",
      "perm_adicionar_punicoes",
      "perm_editar_punicoes",
      "perm_excluir_punicoes"
    ]
  },
  {
    "key": "acesso_ferias",
    "actions": [
      "perm_visualizar_ferias",
      "perm_visualizar_plano_ferias",
      "perm_visualizar_periodos_aquisitivos",
      "perm_gerar_periodos_aquisitivos",
      "perm_editar_periodo_aquisitivo",
      "perm_alterar_status_periodo_aquisitivo",
      "perm_excluir_periodo_aquisitivo",
      "perm_visualizar_creditos_ferias",
      "perm_criar_credito_extra_ferias",
      "perm_editar_credito_extra_ferias",
      "perm_vincular_credito_extra_ferias",
      "perm_remover_vinculo_credito_extra_ferias",
      "perm_cancelar_credito_extra_ferias",
      "perm_excluir_credito_extra_ferias",
      "perm_adicionar_ferias",
      "perm_criar_ferias",
      "perm_editar_ferias",
      "perm_alterar_data_inicio_ferias",
      "perm_gerenciar_tags_ferias",
      "perm_lancar_inicio_ferias",
      "perm_interromper_ferias",
      "perm_continuar_ferias",
      "perm_lancar_retorno_ferias",
      "perm_gerir_cadeia_ferias",
      "perm_excluir_ferias",
      "perm_recalcular_ferias"
    ]
  },
  {
    "key": "acesso_livro",
    "actions": [
      "perm_visualizar_livro",
      "perm_adicionar_livro",
      "perm_editar_livro",
      "perm_excluir_livro"
    ]
  },
  {
    "key": "acesso_rp",
    "actions": [
      "perm_visualizar_rp"
    ]
  },
  {
    "key": "acesso_atestados",
    "actions": [
      "perm_visualizar_atestados",
      "perm_adicionar_atestados",
      "perm_editar_atestados",
      "perm_excluir_atestado",
      "perm_ver_dados_sensiveis_atestado",
      "perm_gerar_relatorio_dp_dintel_atestados",
      "perm_gerir_encaminhamento_dp_dintel_atestado",
      "perm_baixar_anexos_atestados",
      "perm_baixar_zip_atestados"
    ]
  },
  {
    "key": "acesso_controle_atestados_temporarios",
    "actions": [
      "perm_visualizar_controle_atestados_temporarios"
    ]
  },
  {
    "key": "acesso_central_pendencias",
    "actions": [
      "perm_visualizar_central_pendencias"
    ]
  },
  {
    "key": "acesso_cursos_formacao",
    "actions": [
      "perm_visualizar_cursos_formacao",
      "perm_gerir_cursos_formacao"
    ]
  },
  {
    "key": "acesso_conferencias_militares",
    "actions": [
      "perm_visualizar_conferencias_militares",
      "perm_gerir_conferencias_militares"
    ]
  },
  {
    "key": "acesso_controle_processos",
    "actions": [
      "perm_visualizar_controle_processos",
      "perm_criar_processo_controle",
      "perm_editar_processo_controle",
      "perm_tramitar_processo_controle",
      "perm_arquivar_processo_controle",
      "perm_gerenciar_caixas_processuais",
      "perm_visualizar_todas_caixas_processuais",
      "perm_excluir_processo_controle"
    ]
  },
  {
    "key": "acesso_publicacoes",
    "actions": [
      "perm_visualizar_publicacoes",
      "perm_editar_publicacoes",
      "perm_adicionar_publicacoes",
      "perm_excluir_publicacoes",
      "perm_publicar_bg",
      "perm_tornar_sem_efeito_publicacao",
      "perm_apostilar_publicacao",
      "perm_publicar_ata_jiso",
      "perm_publicar_homologacao",
      "perm_gerir_jiso",
      "perm_registrar_decisao_jiso"
    ]
  },
  {
    "key": "acesso_controle_publicacoes",
    "actions": [
      "perm_visualizar_controle_publicacoes"
    ]
  },
  {
    "key": "acesso_conciliacao_boletim",
    "actions": [
      "perm_visualizar_conciliacao_boletim"
    ]
  },
  {
    "key": "acesso_armamentos",
    "actions": [
      "perm_visualizar_armamentos",
      "perm_adicionar_armamentos",
      "perm_editar_armamentos",
      "perm_excluir_armamentos"
    ]
  },
  {
    "key": "acesso_medalhas",
    "actions": [
      "perm_visualizar_medalhas",
      "perm_adicionar_medalhas",
      "perm_editar_medalhas",
      "perm_excluir_medalhas",
      "perm_indicar_medalhas",
      "perm_conceder_medalhas",
      "perm_resetar_indicacoes_medalhas",
      "perm_gerir_impedimentos_medalha",
      "perm_gerir_dom_pedro_ii",
      "perm_exportar_medalhas"
    ]
  },
  {
    "key": "acesso_quadro_operacional",
    "actions": [
      "perm_visualizar_quadro_operacional",
      "perm_adicionar_quadro_operacional",
      "perm_editar_quadro_operacional",
      "perm_excluir_quadro_operacional",
      "perm_gerir_quadro",
      "perm_mover_card",
      "perm_gerir_colunas",
      "perm_arquivar_card",
      "perm_gerir_acoes_operacionais",
      "perm_excluir_acao_operacional"
    ]
  },
  {
    "key": "acesso_campanhas_ferias",
    "actions": [
      "perm_visualizar_campanhas_ferias",
      "perm_visualizar_respostas_ferias",
      "perm_criar_campanhas_ferias",
      "perm_admin_campanhas_ferias",
      "perm_editar_campanhas_ferias",
      "perm_excluir_campanhas_ferias",
      "perm_visualizar_planos_ferias",
      "perm_criar_planos_ferias",
      "perm_editar_planos_ferias",
      "perm_excluir_planos_ferias",
      "perm_aprovar_ferias",
      "perm_gerar_ferias_campanhas",
      "perm_atribuir_permissoes_ferias"
    ]
  },
  {
    "key": "acesso_campanhas_gerais",
    "actions": [
      "perm_visualizar_campanhas_gerais",
      "perm_visualizar_respostas_campanhas",
      "perm_exportar_respostas_campanhas",
      "perm_baixar_anexos_respostas_campanhas",
      "perm_visualizar_solicitacoes_cadastrais",
      "perm_decidir_solicitacoes_cadastrais",
      "perm_criar_campanhas",
      "perm_admin_campanhas",
      "perm_editar_campanhas",
      "perm_excluir_campanhas",
      "perm_aprovar_respostas_campanhas",
      "perm_enviar_lembretes_campanhas",
      "perm_atribuir_permissoes_campanhas",
      "perm_configurar_portal"
    ]
  },
  {
    "key": "acesso_tags",
    "actions": [
      "perm_visualizar_tags",
      "perm_gerir_tags"
    ]
  },
  {
    "key": "acesso_templates",
    "actions": [
      "perm_gerir_templates"
    ]
  },
  {
    "key": "acesso_configuracoes",
    "actions": [
      "perm_admin_mode",
      "perm_gerir_configuracoes"
    ]
  },
  {
    "key": "acesso_operacoes_administrativas",
    "actions": [
      "perm_reset_operacional"
    ]
  },
  {
    "key": "acesso_adicoes_personalizacoes",
    "actions": [
      "perm_gerir_adicoes_personalizacoes"
    ]
  },
  {
    "key": "acesso_permissoes_usuarios",
    "actions": [
      "perm_gerir_permissoes_usuarios",
      "perm_excluir_usuarios_acesso",
      "perm_gerir_permissoes"
    ]
  },
  {
    "key": "acesso_perfis_permissao",
    "actions": [
      "perm_gerir_perfis_permissao"
    ]
  },
  {
    "key": "acesso_estrutura_organizacional",
    "actions": [
      "perm_visualizar_estrutura_organizacional",
      "perm_gerir_estrutura_organizacional",
      "perm_gerir_estrutura"
    ]
  },
  {
    "key": "acesso_lotacao_militares",
    "actions": [
      "perm_visualizar_lotacao_militares",
      "perm_gerir_lotacao_militares"
    ]
  }
] as const;
export const CANONICAL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap((m) => [m.key, ...m.actions]);
