import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const permissionStructure = read('../../../config/permissionStructure.js');
const scopedMilitares = read('../../../../base44/functions/getScopedMilitares/entry.ts');
const scopedAtestados = read('../../../../base44/functions/getScopedAtestadosBundle/entry.ts');
const verMilitar = read('../../../pages/VerMilitar.jsx');
const verAtestado = read('../../../pages/VerAtestado.jsx');
const cadastrarMilitar = read('../../../pages/CadastrarMilitar.jsx');
const identidadeClient = read('../../../services/militarIdentidadeService.js');
const identidadeGateway = read('../../../../base44/functions/militarIdentidadeGateway/entry.ts');
const app = read('../../../App.jsx');
const consultaColumnsJs = read('../../../pages/consultaMilitar/consultaMilitarColumns.js');
const consultaColumnsJsx = read('../../../pages/consultaMilitar/consultaMilitarColumns.jsx');

test('dados sensíveis do militar possuem permissão canônica explícita', () => {
  assert.match(permissionStructure, /perm_ver_dados_sensiveis_militar/);
  assert.match(permissionStructure, /Ver dados sensíveis do militar/);
  assert.doesNotMatch(consultaColumnsJs, /acesso_dados_sensiveis/);
  assert.doesNotMatch(consultaColumnsJsx, /acesso_dados_sensiveis/);
  assert.match(consultaColumnsJs, /canAccessAction\('ver_dados_sensiveis_militar'\)/);
  assert.match(consultaColumnsJsx, /canAccessAction\('ver_dados_sensiveis_militar'\)/);
});

test('getScopedMilitares separa projeção básica da projeção sensível no servidor', () => {
  assert.match(scopedMilitares, /const CAMPOS_SENSIVEIS_MILITAR = \[/);
  assert.match(scopedMilitares, /permissoesFuncionais\.actions\.ver_dados_sensiveis_militar === true/);
  assert.match(scopedMilitares, /\.\.\.\(canViewSensitiveMilitar \? CAMPOS_SENSIVEIS_MILITAR : \[\]\)/);
  assert.match(scopedMilitares, /militares\.map\(\(m\) => projetarMilitar\(m, campos\)\)/);
  assert.match(scopedMilitares, /sensitive_fields_included: canViewSensitiveMilitar/);

  const baseBlock = scopedMilitares.match(/const CAMPOS_BASE_MILITAR = \[([\s\S]*?)\];/)?.[1] || '';
  for (const campo of ['cpf', 'rg', 'data_nascimento', 'tipo_sanguineo', 'email_particular', 'telefone', 'banco', 'agencia', 'conta', 'religiao']) {
    assert.doesNotMatch(baseBlock, new RegExp(`['\"]${campo}['\"]`), `${campo} não pode estar na projeção básica`);
  }
});

test('getScopedAtestadosBundle remove conteúdo clínico sem permissão sensível', () => {
  assert.match(scopedAtestados, /const CAMPOS_ATESTADO_SENSIVEIS = \[/);
  assert.match(scopedAtestados, /authz\?\.actions\?\.ver_dados_sensiveis_atestado === true/);
  assert.match(scopedAtestados, /sanitizarAtestados\(atestados, podeVerDadosSensiveis\)/);
  assert.match(scopedAtestados, /sanitizarAtestados\(atestadosResult\.rows, podeVerDadosSensiveis\)/);

  const operationalBlock = scopedAtestados.match(/const CAMPOS_ATESTADO_OPERACIONAL = \[([\s\S]*?)\];/)?.[1] || '';
  for (const campo of ['data_termino', 'data_retorno', 'status_jiso', 'status_publicacao', 'fluxo_homologacao', 'homologado_comandante']) {
    assert.match(operationalBlock, new RegExp(`['\"]${campo}['\"]`), `${campo} precisa permanecer no DTO operacional`);
  }
  for (const campo of ['cid_10', 'diagnostico', 'historico_clinico', 'arquivo_url', 'anexos']) {
    assert.doesNotMatch(operationalBlock, new RegExp(`['\"]${campo}['\"]`), `${campo} não pode estar no DTO operacional`);
  }
});

test('VerMilitar não faz leitura direta dos principais domínios da ficha 360', () => {
  for (const entity of ['Militar', 'MatriculaMilitar', 'Ferias', 'AjusteSaldoFerias', 'Atestado', 'Medalha', 'Armamento', 'PeriodoAquisitivo', 'CreditoExtraFerias']) {
    assert.doesNotMatch(
      verMilitar,
      new RegExp(`base44\\.entities\\.${entity}\\.(filter|list|get)\\s*\\(`),
      `VerMilitar não deve ler ${entity} diretamente`,
    );
  }
  assert.match(verMilitar, /fetchScopedMilitares/);
  assert.match(verMilitar, /fetchScopedFeriasBundle/);
  assert.match(verMilitar, /fetchScopedAtestadosBundle/);
  assert.match(verMilitar, /fetchScopedMedalhasBundle/);
  assert.match(verMilitar, /fetchScopedArmamentosBundle/);
  assert.match(verMilitar, /fetchScopedPeriodosAquisitivosBundle/);
});

test('abas da ficha 360 dependem das respectivas permissões funcionais', () => {
  assert.match(verMilitar, /visible: podeVisualizarFerias/);
  assert.match(verMilitar, /visible: podeVisualizarMedalhas/);
  assert.match(verMilitar, /visible: podeVisualizarAntiguidade/);
  assert.match(verMilitar, /visible: podeVisualizarAcervo/);
  assert.match(verMilitar, /visible: podeVisualizarRegistrosMilitar/);
  assert.match(verMilitar, /podeVerDadosSensiveisAtestado && a\.cid_10/);
});

test('detalhe de atestado usa bundle escopado antes de renderizar qualquer registro', () => {
  assert.match(verAtestado, /fetchScopedAtestadosBundle/);
  assert.match(verAtestado, /canAccessModule\('atestados'\) && canAccessAction\('visualizar_atestados'\)/);
  assert.doesNotMatch(verAtestado, /base44\.entities\.Atestado\.(filter|list|get)/);
  assert.doesNotMatch(verAtestado, /base44\.entities\.Militar\.(filter|list|get)/);
});

test('identidade militar é escrita somente pelo gateway server-side', () => {
  assert.doesNotMatch(identidadeClient, /base44\.entities\./);
  assert.doesNotMatch(cadastrarMilitar, /base44\.entities\./);
  assert.match(identidadeClient, /militarIdentidadeGateway/);
  assert.match(identidadeGateway, /requireModuleAction\(a, 'militares', 'adicionar_militares'/);
  assert.match(identidadeGateway, /requireModuleAction\(a, 'militares', 'editar_militares'/);
  assert.match(identidadeGateway, /requireModuleAction\(a, 'migracao_alteracoes_legado', 'revisar_duplicidades'/);
});

test('adicionar e editar militar são independentes e contextuais', () => {
  assert.match(app, /CadastrarMilitar: \{ moduleKey: 'militares', actionKeys: \['adicionar_militares', 'editar_militares'\]/);
  assert.match(cadastrarMilitar, /const requiredAction = editId \? 'editar_militares' : 'adicionar_militares';/);
  assert.match(cadastrarMilitar, /const hasRequiredAction = canAccessAction\(requiredAction\);/);
});

test('edição sem permissão sensível não recebe, renderiza nem reaplica campos sensíveis', () => {
  assert.match(identidadeGateway, /projectMilitarForEdit\(militar, includeSensitive\)/);
  assert.match(identidadeGateway, /a\?\.actions\?\.ver_dados_sensiveis_militar === true/);
  assert.match(cadastrarMilitar, /const podeVerCamposSensiveisEdicao = !editId \|\| editingData\?\.sensitiveFieldsIncluded === true;/);
  assert.match(cadastrarMilitar, /if \(editId && !podeVerCamposSensiveisEdicao\) \{[\s\S]*?delete dataToSave\[campo\]/);
  assert.match(cadastrarMilitar, /\{podeVerCamposSensiveisEdicao && \([\s\S]*?title="Dados Pessoais"[\s\S]*?title="Informações Físicas"/);
});

test('snapshots de duplicidade e merge não copiam cadastro pessoal completo', () => {
  const snapshotBlock = identidadeGateway.match(/function minimalSnapshot\(m\) \{([\s\S]*?)\n\}/)?.[1] || '';
  const queuePayloadBlock = identidadeGateway.match(/function minimalPayloadCadastro\(p = \{\}\) \{([\s\S]*?)\n\}/)?.[1] || '';
  for (const campo of ['cpf', 'data_nascimento', 'telefone', 'email_particular', 'banco', 'agencia', 'conta', 'logradouro', 'religiao', 'tipo_sanguineo']) {
    assert.doesNotMatch(snapshotBlock, new RegExp(campo), `${campo} não deve entrar no snapshot de merge`);
    assert.doesNotMatch(queuePayloadBlock, new RegExp(campo), `${campo} não deve entrar no payload persistido da fila`);
  }
});
