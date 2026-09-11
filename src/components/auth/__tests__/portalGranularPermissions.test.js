import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const permissionStructure = read('../../../config/permissionStructure.js');
const portalServicos = read('../../../../base44/functions/portal_servicos/entry.ts');
const planosFerias = read('../../../../base44/functions/planos_ferias_servicos/entry.ts');
const centralRespostas = read('../../../pages/CentralRespostasCampanhas.jsx');
const gerirCampanhas = read('../../../pages/GerirCampanhasPortal.jsx');
const solicitacoes = read('../../../pages/SolicitacoesAtualizacao.jsx');
const configuracoes = read('../../../pages/ConfiguracoesPortal.jsx');
const paginaPlanos = read('../../../pages/PlanosFerias.jsx');
const painelFerias = read('../../../pages/PainelPlanoFerias.jsx');
const layout = read('../../../Layout.jsx');
const app = read('../../../App.jsx');
const exporter = read('../../../utils/portalCampanhasExport.js');

test('matriz possui capacidades explícitas para exportação, anexos, solicitações e lembretes', () => {
  for (const key of [
    'perm_exportar_respostas_campanhas',
    'perm_baixar_anexos_respostas_campanhas',
    'perm_visualizar_solicitacoes_cadastrais',
    'perm_decidir_solicitacoes_cadastrais',
    'perm_enviar_lembretes_campanhas',
  ]) assert.match(permissionStructure, new RegExp(key));
});

test('portal_servicos separa visualizar, aprovar, exportar e baixar anexos', () => {
  assert.match(portalServicos, /CAMPANHA_DETALHES_RETORNO'\) return \['perm_visualizar_respostas_campanhas'/);
  assert.match(portalServicos, /CAMPANHA_APROVACAO_RETORNO'\) return \['perm_aprovar_respostas_campanhas'/);
  assert.match(portalServicos, /CAMPANHA_EXPORTAR_RETORNO'\) return \['perm_exportar_respostas_campanhas'/);
  assert.match(portalServicos, /CAMPANHA_ANEXOS_RETORNO'\) return \['perm_baixar_anexos_respostas_campanhas'/);
  assert.match(portalServicos, /CAMPANHA_HOMOLOGAR_RESPOSTA'\) return \['perm_aprovar_respostas_campanhas'/);
  assert.match(portalServicos, /CAMPANHA_DISPARAR_LEMBRETES'\) return \['perm_enviar_lembretes_campanhas'/);
});

test('visualização normal não transporta URL de anexo', () => {
  assert.match(portalServicos, /const incluirUrl = modo === 'ANEXOS'/);
  assert.match(portalServicos, /arquivo_devolucao_url: incluirUrl \? \(resposta\.arquivo_devolucao_url \|\| ''\) : ''/);
  assert.match(portalServicos, /sanitizarItemAnexoCampanha\(item, incluirUrl\)/);
});

test('campanhas gerais não operam campanha de férias', () => {
  assert.match(portalServicos, /Campanhas de férias devem ser criadas pelo módulo específico de Planos de Férias/);
  assert.match(portalServicos, /obterCampanhaGeralOuErro/);
  assert.match(portalServicos, /campanha\.tipo === 'PLANO_FERIAS'/);
});

test('planos de férias exigem ações específicas por operação', () => {
  assert.match(planosFerias, /LISTAR' \|\| acao === 'DETALHES'.*perm_visualizar_planos_ferias/s);
  assert.match(planosFerias, /acao === 'CRIAR'.*perm_criar_planos_ferias/s);
  assert.match(planosFerias, /acao === 'ATUALIZAR'.*perm_editar_planos_ferias/s);
  assert.match(planosFerias, /acao === 'ARQUIVAR' \|\| acao === 'DESARQUIVAR'.*perm_editar_planos_ferias.*perm_admin_campanhas_ferias/s);
  assert.match(planosFerias, /acao === 'EXCLUIR'.*perm_excluir_planos_ferias.*perm_admin_campanhas_ferias/s);
  assert.match(portalServicos, /PLANO_CAMPANHA_CRIAR'\) return \['perm_criar_campanhas_ferias'/);
  assert.match(portalServicos, /PLANO_CAMPANHA_EXCLUIR'[\s\S]*perm_excluir_campanhas_ferias'[\s\S]*perm_admin_campanhas_ferias/);
  assert.match(portalServicos, /PLANO_CAMPANHA_ARQUIVAR'.*perm_editar_campanhas_ferias/s);
});

test('Central de Respostas busca datasets separados conforme a capacidade', () => {
  assert.match(centralRespostas, /canAccessAction\('visualizar_respostas_campanhas'\)/);
  assert.match(centralRespostas, /canAccessAction\('aprovar_respostas_campanhas'\)/);
  assert.match(centralRespostas, /canAccessAction\('exportar_respostas_campanhas'\)/);
  assert.match(centralRespostas, /canAccessAction\('baixar_anexos_respostas_campanhas'\)/);
  assert.match(centralRespostas, /CAMPANHA_EXPORTAR_RETORNO/);
  assert.match(centralRespostas, /CAMPANHA_ANEXOS_RETORNO/);
  assert.match(centralRespostas, /CAMPANHA_APROVACAO_RETORNO/);
});

test('Gerir Campanhas esconde ações não autorizadas em vez de depender só do backend', () => {
  for (const gate of ['canCreateCampaigns', 'canEditCampaigns', 'canDeleteCampaigns', 'canOpenResponses', 'canSendReminders']) {
    assert.match(gerirCampanhas, new RegExp(`\\{${gate}[^}]*&&`));
  }
  assert.doesNotMatch(gerirCampanhas, /base44\.entities\.Militar\.list\(/);
  assert.doesNotMatch(gerirCampanhas, /base44\.entities\.GrupoEfetivo\.filter\(/);
  assert.match(gerirCampanhas, /CAMPANHA_SCOPE_OPTIONS/);
});

test('Solicitações cadastrais não são mais admin-only e usam gateway próprio', () => {
  assert.doesNotMatch(app, /adminOnlyPages[\s\S]*'SolicitacoesAtualizacao'/);
  assert.match(app, /SolicitacoesAtualizacao:[\s\S]*visualizar_solicitacoes_cadastrais[\s\S]*decidir_solicitacoes_cadastrais/);
  assert.doesNotMatch(solicitacoes, /RequireAdmin/);
  assert.doesNotMatch(solicitacoes, /base44\.entities\.SolicitacaoAtualizacao/);
  assert.match(solicitacoes, /CADASTRO_SOLICITACOES_LISTAR/);
  assert.match(solicitacoes, /canDecidirSolicitacoes/);
});

test('Configurações do Portal não têm fallback direto e Mesa RH respeita permissões', () => {
  assert.doesNotMatch(configuracoes, /base44\.entities\.PortalAuthConfig/);
  assert.doesNotMatch(configuracoes, /base44\.entities\.SolicitacaoAtualizacao/);
  assert.match(configuracoes, /PORTAL_CONFIG_GET/);
  assert.match(configuracoes, /CADASTRO_SOLICITACOES_LISTAR/);
  assert.match(configuracoes, /canViewSolicitacoes/);
  assert.match(configuracoes, /canDecidirSolicitacoes/);
});

test('PlanosFerias aplica permissões próprias e não depende de leitura direta de efetivo', () => {
  for (const action of [
    'visualizar_planos_ferias', 'criar_planos_ferias', 'editar_planos_ferias', 'excluir_planos_ferias',
    'criar_campanhas_ferias', 'excluir_campanhas_ferias', 'visualizar_respostas_ferias',
    'gerar_ferias_campanhas', 'admin_campanhas_ferias',
  ]) assert.match(paginaPlanos, new RegExp(action));
  assert.doesNotMatch(paginaPlanos, /base44\.entities\.(Militar|GrupoEfetivo)/);
  assert.match(paginaPlanos, /PLANO_CAMPANHA_CRIAR/);
  assert.match(paginaPlanos, /PLANO_CAMPANHA_EXCLUIR/);
});

test('Painel de Férias não herda admin_mode e exige aprovação para Não Contemplado', () => {
  assert.doesNotMatch(painelFerias, /canAccessAction\('perm_admin_mode'\)/);
  assert.match(painelFerias, /if \(!podeAprovarFerias \|\| !modalNaoContemplado\.opcao\) return/);
  assert.match(painelFerias, /modalNaoContemplado\.open && podeAprovarFerias/);
  assert.doesNotMatch(painelFerias, /base44\.entities\.(Militar|User)\.(list|filter)/);
  assert.match(painelFerias, /PLANO_CAMPANHA_(DESATIVAR|ARQUIVAR|EXCLUIR)/);
});

test('menu e rota de Campanhas usam somente permissões canônicas após L08', () => {
  assert.match(layout, /GerirCampanhasPortal[\s\S]*perm_visualizar_campanhas_gerais/);
  assert.match(app, /GerirCampanhasPortal:[\s\S]*'visualizar_campanhas_gerais'/);
  assert.doesNotMatch(layout, /perm_atribuir_permissoes_ferias/);
  assert.doesNotMatch(app, /PainelPlanoFerias:[\s\S]*'atribuir_permissoes_ferias'/);
  assert.doesNotMatch(layout, /perm_gerir_campanhas|perm_gerir_respostas/);
  assert.doesNotMatch(app, /'gerir_campanhas'|'gerir_respostas'/);
});

test('exportação de respostas não inclui URL de anexos', () => {
  assert.doesNotMatch(exporter, /Arquivo Devolvido \(URL\)/);
  assert.doesNotMatch(exporter, /Arquivo Devolvido URL/);
  assert.match(exporter, /Arquivo Devolvido/);
  assert.match(exporter, /Arquivo enviado/);
});
