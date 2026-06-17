/**
 * accessEvidenceMatrix.js — P1.2-C1 (DOCUMENTAL / READ-ONLY)
 * ============================================================================
 * MATRIZ DOCUMENTAL DE EVIDÊNCIAS DO DIAGNÓSTICO DE ACESSO
 *
 *  - Arquivo PURAMENTE documental / read-only.
 *  - NÃO aplica permissões.
 *  - NÃO substitui App.jsx / Layout.jsx.
 *  - NÃO altera guards, rotas, menu ou permissões.
 *  - NÃO deve ser usado para enforcement (não importar em guards/rotas).
 *  - Serve APENAS como matriz de decisão para saneamento futuro.
 *  - Precisa ser VALIDADO MÓDULO A MÓDULO (por humano) antes de qualquer P1.3.
 *
 * Contém somente objetos literais e funções puras de consulta — sem React,
 * sem backend, sem base44.entities, sem storage, sem side effects, sem PII,
 * sem dados operacionais (nomes, CPF, matrícula, CID, anexos, documentos).
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Categorias de decisão recomendadas (documental)
// ----------------------------------------------------------------------------
export const ACCESS_EVIDENCE_DECISIONS = Object.freeze({
  MANTER_COMO_ESTA: 'manter_como_esta',
  DOCUMENTAR_APENAS: 'documentar_apenas',
  CORRIGIR_MENU: 'corrigir_menu',
  CORRIGIR_ROTA: 'corrigir_rota',
  AVALIAR_ACTION_KEY: 'avaliar_action_key',
  AVALIAR_ADMIN_ONLY: 'avaliar_admin_only',
  TRATAR_COMO_CONTEXTUAL: 'tratar_como_contextual',
  REVISAR_BACKEND_ESCOPO: 'revisar_backend_escopo',
  CANDIDATO_ENFORCEMENT_FUTURO: 'candidato_enforcement_futuro',
  MANTER_MONITORAMENTO: 'manter_monitoramento',
});

// ----------------------------------------------------------------------------
// Níveis de severidade (documental)
// ----------------------------------------------------------------------------
export const ACCESS_EVIDENCE_SEVERITIES = Object.freeze({
  INFO: 'info',
  BAIXA: 'baixa',
  MEDIA: 'media',
  ALTA: 'alta',
});

// ----------------------------------------------------------------------------
// Critérios de severidade (referência documental)
// ----------------------------------------------------------------------------
export const ACCESS_EVIDENCE_SEVERITY_CRITERIA = Object.freeze({
  alta: [
    'Rota sem guard real para dado sensível.',
    'Ação destrutiva sem barreira de escopo/backend.',
    'Divergência adminOnly que permita acesso indevido a área restrita.',
  ],
  media: [
    'Rota module-only em fluxo de escrita sensível.',
    'Menu mais restritivo que a rota em tela principal de dados.',
    'Cross-module sem documentação suficiente.',
    'actionKey ausente em rota que representa operação sensível.',
  ],
  baixa: [
    'Divergência documental sem risco imediato.',
    'Rota contextual com escopo/validação interna.',
    'Divergência conhecida e atenuada.',
    'module-only com backend/escopo já mitigando o risco.',
  ],
  info: [
    'Comportamento esperado.',
    'Rota de detalhe/contextual.',
    'Backend já reforçado.',
    'Redundância ou nota documental.',
  ],
});

const D = ACCESS_EVIDENCE_DECISIONS;
const S = ACCESS_EVIDENCE_SEVERITIES;

// ----------------------------------------------------------------------------
// Matriz de evidências (documental)
// ----------------------------------------------------------------------------
export const accessEvidenceMatrix = Object.freeze([
  // ===========================================================================
  // MÓDULO: MILITARES
  // ===========================================================================
  Object.freeze({
    id: 'mil-001',
    moduleKey: 'militares',
    pageKey: 'Militares',
    surface: 'rota',
    finding: 'Menu exige visualizar_militares, mas a rota é module-only.',
    evidence: 'Menu: actionKey visualizar_militares; App.jsx: guard moduleKey militares (sem actionKey).',
    risk: 'Acesso à tela principal de consulta por moduleKey, sem exigir a action de visualização correspondente.',
    severity: S.MEDIA,
    currentStatus: 'module-only na rota; escopo aplicado em getScopedMilitares.',
    recommendedDecision: D.AVALIAR_ACTION_KEY,
    prerequisiteBeforeChange: 'Confirmar que todos os perfis legítimos possuem visualizar_militares antes de alinhar a rota.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Alinhamento futuro de visualizar_militares na rota; escopo de dados já tratado no backend.',
    enforcementCandidate: true,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'mil-002',
    moduleKey: 'militares',
    pageKey: 'CadastrarMilitar',
    surface: 'rota',
    finding: 'CTA/interface tende a exigir adicionar_militares, mas a rota é module-only.',
    evidence: 'Fluxo de escrita (cadastro); App.jsx: guard moduleKey militares (sem actionKey).',
    risk: 'Rota de escrita acessível por moduleKey sem exigir a action específica de criação.',
    severity: S.MEDIA,
    currentStatus: 'module-only na rota; validações de cadastro no formulário/backend.',
    recommendedDecision: D.AVALIAR_ACTION_KEY,
    prerequisiteBeforeChange: 'Mapear perfis que realizam cadastro e confirmar posse de adicionar_militares.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Candidato futuro a actionKey adicionar_militares na rota.',
    enforcementCandidate: true,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'mil-003',
    moduleKey: 'militares',
    pageKey: 'VerMilitar',
    surface: 'rota',
    finding: 'Rota de detalhe/contextual de militar.',
    evidence: 'App.jsx: guard moduleKey militares + actionKey visualizar_militares; tela de detalhe.',
    risk: 'Baixo: detalhe individual com escopo aplicado; não é tela administrativa.',
    severity: S.BAIXA,
    currentStatus: 'Contextual; valida visualizar_militares e escopo de dados.',
    recommendedDecision: D.TRATAR_COMO_CONTEXTUAL,
    prerequisiteBeforeChange: 'Confirmar enforcement real de visualizar_militares + escopo antes de qualquer ajuste.',
    suggestedFuturePhase: 'documental',
    notes: 'Validar visualizar_militares + escopo; NÃO sugerir adminOnly sem evidência.',
    enforcementCandidate: false,
    requiresHumanValidation: true,
  }),

  // ===========================================================================
  // MÓDULO: FÉRIAS
  // ===========================================================================
  Object.freeze({
    id: 'fer-001',
    moduleKey: 'ferias',
    pageKey: 'Ferias',
    surface: 'rota',
    finding: 'Menu exige visualizar_ferias, mas a rota é module-only.',
    evidence: 'Menu: viewPermission visualizar_ferias; App.jsx: guard moduleKey ferias (sem actionKey).',
    risk: 'Tela principal de férias acessível por moduleKey sem exigir a action de visualização.',
    severity: S.MEDIA,
    currentStatus: 'module-only na rota; escopo via getScopedFeriasBundle.',
    recommendedDecision: D.AVALIAR_ACTION_KEY,
    prerequisiteBeforeChange: 'Confirmar posse de visualizar_ferias pelos perfis legítimos.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Avaliar alinhamento futuro de view/action guard na rota.',
    enforcementCandidate: true,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'fer-002',
    moduleKey: 'ferias',
    pageKey: 'CadastrarFerias',
    surface: 'rota',
    finding: 'Rota module-only com validação interna e escopo já aplicados.',
    evidence: 'Validação canAccessModule(ferias) + escopo via useUsuarioPodeAgirSobreMilitar.',
    risk: 'Baixo: escrita protegida por validação interna e escopo de militar.',
    severity: S.BAIXA,
    currentStatus: 'module-only validado internamente; escopo por militar.',
    recommendedDecision: D.DOCUMENTAR_APENAS,
    prerequisiteBeforeChange: 'Se optar por actionKey adicionar_ferias, confirmar perfis sem quebrar fluxo.',
    suggestedFuturePhase: 'documental',
    notes: 'Documentar/manter ou avaliar actionKey adicionar_ferias SEM enforcement imediato.',
    enforcementCandidate: false,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'fer-003',
    moduleKey: 'ferias',
    pageKey: 'PlanoAnualFerias',
    surface: 'rota',
    finding: 'Rota de planejamento/contextual.',
    evidence: 'App.jsx: guard moduleKey ferias + actionKey visualizar_ferias.',
    risk: 'Baixo: visualização de planejamento com escopo.',
    severity: S.BAIXA,
    currentStatus: 'Contextual; valida visualizar_ferias.',
    recommendedDecision: D.TRATAR_COMO_CONTEXTUAL,
    prerequisiteBeforeChange: 'Confirmar se visualização é suficiente para o fluxo.',
    suggestedFuturePhase: 'documental',
    notes: 'Avaliar se visualização é suficiente; planejamento, não escrita sensível.',
    enforcementCandidate: false,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'fer-004',
    moduleKey: 'ferias',
    pageKey: 'PeriodosAquisitivos',
    surface: 'rota',
    finding: 'Rota contextual/documental de períodos aquisitivos.',
    evidence: 'App.jsx: guard moduleKey ferias.',
    risk: 'Baixo: consulta/gestão de períodos com escopo do módulo.',
    severity: S.INFO,
    currentStatus: 'Contextual; vinculado ao módulo de férias.',
    recommendedDecision: D.DOCUMENTAR_APENAS,
    prerequisiteBeforeChange: 'Nenhuma; manter observação.',
    suggestedFuturePhase: 'documental',
    notes: 'Manter observação; sem risco operacional imediato.',
    enforcementCandidate: false,
    requiresHumanValidation: false,
  }),
  Object.freeze({
    id: 'fer-005',
    moduleKey: 'ferias',
    pageKey: 'CreditosExtraordinariosFerias',
    surface: 'rota',
    finding: 'Menu exige visualizar_ferias, mas a rota é module-only.',
    evidence: 'Menu: viewPermission visualizar_ferias; App.jsx: guard moduleKey ferias.',
    risk: 'Tela de créditos extraordinários por moduleKey sem action de visualização.',
    severity: S.MEDIA,
    currentStatus: 'module-only na rota.',
    recommendedDecision: D.AVALIAR_ACTION_KEY,
    prerequisiteBeforeChange: 'Confirmar posse de visualizar_ferias pelos perfis legítimos.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Avaliar alinhamento futuro de view/action guard.',
    enforcementCandidate: true,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'fer-006',
    moduleKey: 'ferias',
    pageKey: 'admin_mode',
    surface: 'cross-module',
    finding: 'Dependência cross-module de admin_mode em fluxos administrativos de férias.',
    evidence: 'Ações administrativas (cadeia/recálculo) dependem de perm_admin_mode declarado fora do módulo.',
    risk: 'Médio/baixo: dependência não formalizada na superfície/registry do módulo.',
    severity: S.MEDIA,
    currentStatus: 'Dependência declarada de forma cross-module; não formalizada no registry de superfície.',
    recommendedDecision: D.REVISAR_BACKEND_ESCOPO,
    prerequisiteBeforeChange: 'Mapear onde admin_mode é exigido e se deve constar como relação formal.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Documentar dependência e avaliar se deve aparecer como relação formal no registry/superfície.',
    enforcementCandidate: false,
    requiresHumanValidation: true,
  }),

  // ===========================================================================
  // MÓDULO: ATESTADOS
  // ===========================================================================
  Object.freeze({
    id: 'ate-001',
    moduleKey: 'atestados',
    pageKey: 'Atestados',
    surface: 'rota',
    finding: 'Menu exige visualizar_atestados, mas a rota é module-only.',
    evidence: 'Menu: viewPermission visualizar_atestados; App.jsx: guard moduleKey atestados.',
    risk: 'Tela principal de atestados por moduleKey sem action de visualização.',
    severity: S.MEDIA,
    currentStatus: 'module-only na rota; escopo via getScopedAtestadosBundle.',
    recommendedDecision: D.AVALIAR_ACTION_KEY,
    prerequisiteBeforeChange: 'Confirmar posse de visualizar_atestados pelos perfis legítimos.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Avaliar visualizar_atestados na rota; dado sensível de saúde, atenção redobrada.',
    enforcementCandidate: true,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'ate-002',
    moduleKey: 'atestados',
    pageKey: 'CadastrarAtestado',
    surface: 'rota',
    finding: 'CTA/interface tende a exigir adicionar_atestados, mas a rota é module-only.',
    evidence: 'Fluxo de escrita; App.jsx: guard moduleKey atestados (sem actionKey).',
    risk: 'Rota de escrita de atestado acessível por moduleKey sem action específica.',
    severity: S.MEDIA,
    currentStatus: 'module-only na rota; validações no formulário/backend.',
    recommendedDecision: D.AVALIAR_ACTION_KEY,
    prerequisiteBeforeChange: 'Mapear perfis que cadastram atestado e confirmar posse de adicionar_atestados.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Candidato futuro a actionKey adicionar_atestados. NÃO classificar como adminOnly sem evidência.',
    enforcementCandidate: true,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'ate-003',
    moduleKey: 'atestados',
    pageKey: 'VerAtestado',
    surface: 'rota',
    finding: 'Rota de detalhe/contextual de atestado.',
    evidence: 'App.jsx: guard moduleKey atestados; tela de detalhe.',
    risk: 'Baixo: detalhe individual com escopo; dado sensível mitigado por backend de anexos.',
    severity: S.BAIXA,
    currentStatus: 'Contextual; escopo aplicado; anexos via backend reforçado.',
    recommendedDecision: D.TRATAR_COMO_CONTEXTUAL,
    prerequisiteBeforeChange: 'Confirmar escopo e enforcement de visualização antes de qualquer ajuste.',
    suggestedFuturePhase: 'documental',
    notes: 'Validar escopo; NÃO sugerir adminOnly sem evidência.',
    enforcementCandidate: false,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'ate-004',
    moduleKey: 'atestados',
    pageKey: 'AgendarJISO',
    surface: 'cross-module',
    finding: 'Rota module-only cujas ações internas dependem de publicações/JISO.',
    evidence: 'App.jsx: guard moduleKey atestados; ações internas tocam JISO/publicações.',
    risk: 'Médio/baixo: cross-module sem documentação formal completa.',
    severity: S.MEDIA,
    currentStatus: 'module-only; dependências cross-module não totalmente formalizadas.',
    recommendedDecision: D.REVISAR_BACKEND_ESCOPO,
    prerequisiteBeforeChange: 'Mapear dependências JISO/publicações antes de qualquer actionKey.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Documentar cross-module e avaliar actionKey se necessário.',
    enforcementCandidate: false,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'ate-005',
    moduleKey: 'atestados',
    pageKey: 'EditarJISO',
    surface: 'cross-module',
    finding: 'Rota contextual/edição com dependências de JISO/publicações.',
    evidence: 'App.jsx: guard moduleKey atestados; edição toca JISO/publicações.',
    risk: 'Médio/baixo: edição contextual com dependências cross-module.',
    severity: S.MEDIA,
    currentStatus: 'Contextual/edição; dependências cross-module.',
    recommendedDecision: D.REVISAR_BACKEND_ESCOPO,
    prerequisiteBeforeChange: 'Avaliar actionKey/cross-module de JISO/publicações antes de enforcement.',
    suggestedFuturePhase: 'P1.3-B',
    notes: 'Avaliar actionKey/cross-module antes de qualquer enforcement.',
    enforcementCandidate: false,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'ate-006',
    moduleKey: 'atestados',
    pageKey: 'ExtratoAtestadosMedicos',
    surface: 'rota',
    finding: 'Menu exige visualizar_atestados, mas o guard de rota está pendente de confirmação.',
    evidence: 'Menu: viewPermission visualizar_atestados; guard de rota a validar.',
    risk: 'Médio: extrato de dados de saúde com guard de rota a confirmar.',
    severity: S.MEDIA,
    currentStatus: 'Guard de rota pendente de validação; backend de extrato com auditoria.',
    recommendedDecision: D.CORRIGIR_ROTA,
    prerequisiteBeforeChange: 'Confirmar guard real da rota e ações internas antes de ajuste.',
    suggestedFuturePhase: 'P1.3-A',
    notes: 'Validar rota e ações internas; dado sensível de saúde.',
    enforcementCandidate: true,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'ate-007',
    moduleKey: 'atestados',
    pageKey: 'Medicos',
    surface: 'rota',
    finding: 'adminOnly alinhado entre menu e rota.',
    evidence: 'Menu: adminOnly; App.jsx: RequireAdmin + moduleKey atestados.',
    risk: 'Info: comportamento esperado, restrito a admin.',
    severity: S.INFO,
    currentStatus: 'adminOnly alinhado.',
    recommendedDecision: D.MANTER_COMO_ESTA,
    prerequisiteBeforeChange: 'Nenhuma.',
    suggestedFuturePhase: 'documental',
    notes: 'Manter como está; cadastro de médicos restrito a admin.',
    enforcementCandidate: false,
    requiresHumanValidation: false,
  }),
  Object.freeze({
    id: 'ate-008',
    moduleKey: 'atestados',
    pageKey: 'ver_dados_sensiveis_atestado',
    surface: 'documental',
    finding: 'Permissão declarada/passiva sem enforcement claro de runtime.',
    evidence: 'Permissão ver_dados_sensiveis_atestado declarada; enforcement de runtime não evidente.',
    risk: 'Médio: dado sensível de saúde sem ponto único de enforcement claro.',
    severity: S.MEDIA,
    currentStatus: 'Declarada/passiva; ponto de revisão de dados sensíveis.',
    recommendedDecision: D.CANDIDATO_ENFORCEMENT_FUTURO,
    prerequisiteBeforeChange: 'Mapear onde dados sensíveis são exibidos e como a permissão seria aplicada.',
    suggestedFuturePhase: 'P1.3-A',
    notes: 'Manter como ponto de revisão futura de dados sensíveis.',
    enforcementCandidate: true,
    requiresHumanValidation: true,
  }),
  Object.freeze({
    id: 'ate-009',
    moduleKey: 'atestados',
    pageKey: 'AnexosAtestado',
    surface: 'backend',
    finding: 'Acesso a anexos de atestado reforçado na P0/P0.1.',
    evidence: 'getAtestadoAnexoSignedUrl com validação de visualizar_atestados, escopo, bloqueio de URL pública legada e redução de logs sensíveis.',
    risk: 'Baixo/residual: backend já reforçado; risco residual controlado.',
    severity: S.BAIXA,
    currentStatus: 'Backend sensível já reforçado (P0/P0.1).',
    recommendedDecision: D.MANTER_MONITORAMENTO,
    prerequisiteBeforeChange: 'Nova evidência de exposição antes de reabrir o tema.',
    suggestedFuturePhase: 'documental',
    notes: 'NÃO classificar como "escopo difuso alto" sem nova evidência; manter monitoramento.',
    enforcementCandidate: false,
    requiresHumanValidation: false,
  }),
]);

// ----------------------------------------------------------------------------
// Funções puras de consulta (sem side effects)
// ----------------------------------------------------------------------------

/**
 * Retorna os itens da matriz de um módulo específico (case-insensitive).
 * @param {string} moduleKey
 * @returns {Array}
 */
export function getEvidenceByModule(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  return accessEvidenceMatrix.filter((item) => item.moduleKey.toLowerCase() === key);
}

/**
 * Retorna os itens da matriz de uma pageKey específica (case-insensitive).
 * @param {string} pageKey
 * @returns {Array}
 */
export function getEvidenceByPageKey(pageKey) {
  const key = String(pageKey || '').toLowerCase();
  return accessEvidenceMatrix.filter((item) => item.pageKey.toLowerCase() === key);
}

/**
 * Retorna apenas os itens com severidade alta.
 * @returns {Array}
 */
export function getHighRiskEvidence() {
  return accessEvidenceMatrix.filter((item) => item.severity === ACCESS_EVIDENCE_SEVERITIES.ALTA);
}