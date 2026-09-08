import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const permissionStructure = read('../../../config/permissionStructure.js');
const ferias = read('../../../pages/Ferias.jsx');
const adminCadeia = read('../../ferias/AdminCadeiaPanel.jsx');
const familiaFerias = read('../../ferias/FamiliaFeriasPanel.jsx');
const publicacoes = read('../../../pages/Publicacoes.jsx');
const cadastrarRp = read('../../../pages/CadastrarRegistroRP.jsx');
const publicacaoCard = read('../../publicacao/PublicacaoCard.jsx');
const registrosMilitar = read('../../../pages/RegistrosMilitar.jsx');
const registrosService = read('../../../services/registrosMilitarService.js');
const registrosGateway = read('../../../../base44/functions/registrosMilitarGateway/entry.ts');
const medalhaCadastro = read('../../../pages/CadastrarMedalha.jsx');
const medalhasAcesso = read('../../../services/medalhasAcessoService.js');
const tagsGateway = read('../../../../base44/functions/cudFuncoesTagsEscopado/entry.ts');
const cud = read('../../../../base44/functions/cudEscopado/entry.ts');
const militares = read('../../../pages/Militares.jsx');
const detalhePromocao = read('../../../pages/DetalhePromocao.jsx');
const reverterPromocao = read('../../../../base44/functions/reverterPublicacaoPromocaoMilitarTx/entry.ts');
const reverterModal = read('../../promocao/ReverterPublicacaoModal.jsx');


test('F8-L07: férias não dependem de admin_mode nem role admin para ações granulares', () => {
  assert.match(ferias, /const canExcluirFerias = canAccessAction\('excluir_ferias'\);/);
  assert.match(ferias, /const canGerirCadeiaFerias = canAccessAction\('gerir_cadeia_ferias'\);/);
  assert.match(ferias, /const canRecalcularFerias = canAccessAction\('recalcular_ferias'\);/);
  assert.doesNotMatch(ferias, /canAccessAction\('admin_mode'\)/);
  assert.doesNotMatch(adminCadeia, /canAccessAction\('admin_mode'\)/);
  assert.doesNotMatch(adminCadeia, /\bisAdmin\b/);
  assert.match(familiaFerias, /podeAdministrarCadeia = canAccessAction\('gerir_cadeia_ferias'\) \|\| canAccessAction\('recalcular_ferias'\)/);
});

test('F8-L07: publicações usam ações contextuais sem admin_mode transversal', () => {
  assert.match(publicacoes, /if \(!canAccessAction\('publicar_bg'\)\)/);
  assert.match(publicacoes, /if \(!canAccessAction\('excluir_publicacoes'\)\)/);
  assert.doesNotMatch(publicacoes, /canAccessAction\('admin_mode'\)/);
  assert.doesNotMatch(publicacaoCard, /canAccessAction\('admin_mode'\)/);
  assert.match(cadastrarRp, /acaoObrigatoria = isEditing[\s\S]*'editar_publicacoes'[\s\S]*'apostilar_publicacao'[\s\S]*'tornar_sem_efeito_publicacao'[\s\S]*'adicionar_publicacoes'/s);
  assert.match(cud, /tipoPublicacao === 'Apostila'.*\['apostilar_publicacao'\]/s);
  assert.match(cud, /tipoPublicacao === 'Tornar sem Efeito'.*\['tornar_sem_efeito_publicacao'\]/s);
});

test('F8-L07: Registros do Militar usam gateway próprio e preservam invariantes', () => {
  assert.match(registrosMilitar, /const canEditarRegistros = canAccessAction\('editar_registros_militar'\);/);
  assert.match(registrosMilitar, /const canExcluirRegistros = canAccessAction\('excluir_registros_militar'\);/);
  assert.doesNotMatch(registrosMilitar, /canAccessAction\('admin_mode'\)/);
  assert.doesNotMatch(registrosService, /\.entities\.(RegistroLivro|PublicacaoExOfficio)\.(update|delete)/);
  assert.match(registrosService, /functions\.invoke\('registrosMilitarGateway'/);
  assert.match(registrosGateway, /editar_registros_militar/);
  assert.match(registrosGateway, /excluir_registros_militar/);
  assert.match(registrosGateway, /scopeCheck\?\.allAllowed|allowedIds/);
  assert.match(registrosGateway, /Registro publicado não pode ser excluído/);
  assert.match(registrosGateway, /cadeia operacional de férias não pode ser excluído isoladamente/);
});

test('F8-L07: Medalhas separa adicionar, editar e indicar', () => {
  assert.match(medalhasAcesso, /ADICIONAR: 'adicionar_medalhas'/);
  assert.match(medalhasAcesso, /EDITAR: 'editar_medalhas'/);
  assert.match(medalhasAcesso, /INDICAR: 'indicar_medalhas'/);
  assert.match(medalhaCadastro, /const podeSalvar = medalhaId \? podeEditar : podeAdicionar;/);
  assert.match(cud, /operation === 'create' && ehFluxoIndicacao \? 'indicar_medalhas' : 'adicionar_medalhas'/s);
});

test('F8-L07: tags de militar e férias têm permissões próprias', () => {
  assert.match(permissionStructure, /perm_gerenciar_tags_militar/);
  assert.match(tagsGateway, /MilitarTag: \['gerenciar_tags_militar'\]/);
  assert.match(tagsGateway, /FeriasTag: \['gerenciar_tags_ferias'\]/);
  assert.match(cud, /MilitarTag:[\s\S]*create: 'gerenciar_tags_militar'[\s\S]*delete: 'gerenciar_tags_militar'/s);
  assert.match(cud, /FeriasTag:[\s\S]*create: 'gerenciar_tags_ferias'[\s\S]*delete: 'gerenciar_tags_ferias'/s);
  assert.match(militares, /const canManageMilitaryTags = canAccessAction\('gerenciar_tags_militar'\);/);
});

test('F8-L07: reversão excepcional é delegável por ação específica e limitada por escopo', () => {
  assert.match(detalhePromocao, /canAccessAction\('reverter_promocao_excepcional'\)/);
  assert.match(reverterPromocao, /const PERMISSAO_REVERSAO_EXCEPCIONAL = 'reverter_promocao_excepcional';/);
  assert.match(reverterPromocao, /functions\.invoke\('getUserPermissions', \{\}\)/);
  assert.match(reverterPromocao, /scopeMilitarIds: militarId \? \[militarId\] : \[\]/);
  assert.match(reverterPromocao, /scopeCheck\?\.allAllowed/);
  assert.match(reverterPromocao, /reversao_comum_requer_administrador_plataforma/);
  assert.match(reverterModal, /FRASE_CONFIRMACAO_REVERSAO_EXCEPCIONAL/);
});

test('F8-L07: rótulos distinguem os dois domínios de plano de férias', () => {
  assert.match(permissionStructure, /perm_visualizar_plano_ferias', label: 'Visualizar Plano Anual de Férias'/);
  assert.match(permissionStructure, /perm_visualizar_planos_ferias', label: 'Visualizar Planos Institucionais de Férias'/);
});
