import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const permissionStructure = read('../../../config/permissionStructure.js');
const scopedMilitares = read('../../../../base44/functions/getScopedMilitares/entry.ts');
const scopedAtestados = read('../../../../base44/functions/getScopedAtestadosBundle/entry.ts');
const verMilitar = read('../../../pages/VerMilitar.jsx');
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
