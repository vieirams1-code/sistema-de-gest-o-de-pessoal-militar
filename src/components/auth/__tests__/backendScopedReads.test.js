import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const atestados = read('../../../../base44/functions/getScopedAtestadosBundle/entry.ts');
const armamentos = read('../../../../base44/functions/getScopedArmamentosBundle/entry.ts');
const medalhas = read('../../../../base44/functions/getScopedMedalhasBundle/entry.ts');
const creditos = read('../../../../base44/functions/getScopedCreditosExtraFerias/entry.ts');
const gratificacoes = read('../../../../base44/functions/getScopedPainelGratificacoesFuncao/entry.ts');
const cotasGratificacoes = read('../../../../base44/functions/getScopedCotasGratificacaoFuncao/entry.ts');
const periodos = read('../../../../base44/functions/getScopedPeriodosAquisitivosBundle/entry.ts');
const ferias = read('../../../../base44/functions/getScopedFeriasBundle/entry.ts');
const familiaFerias = read('../../ferias/FamiliaFeriasPanel.jsx');

function extractArray(source, constName) {
  const match = source.match(new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  assert.ok(match, `constante ${constName} deve existir`);
  return match[1];
}

test('bundles escopados exigem módulo e permissão funcional de visualização antes do service role', () => {
  assert.match(atestados, /modules\?\.atestados === true && authz\?\.actions\?\.visualizar_atestados === true/);
  assert.match(armamentos, /modules\?\.armamentos===true&&authz\?\.actions\?\.visualizar_armamentos===true/);
  assert.match(medalhas, /modules\?\.medalhas===true&&authz\?\.actions\?\.visualizar_medalhas===true/);
  assert.match(creditos, /modules\?\.ferias === true && authz\?\.actions\?\.visualizar_creditos_ferias === true/);
  assert.match(gratificacoes, /modules\?\.gratificacoes_funcao === true && authz\?\.actions\?\.visualizar_gratificacoes_funcao === true/);
  assert.match(cotasGratificacoes, /modules\?\.gratificacoes_funcao === true && authz\?\.actions\?\.visualizar_gratificacoes_funcao === true/);
});

test('bundle de períodos exige capacidade funcional de Férias mesmo quando usado como dataset de apoio', () => {
  assert.match(periodos, /authz\?\.modules\?\.ferias === true && acoesLeituraSuporte\.some/);
  for (const action of [
    'visualizar_periodos_aquisitivos',
    'visualizar_ferias',
    'visualizar_creditos_ferias',
    'criar_ferias',
    'editar_ferias',
    'gerar_periodos_aquisitivos',
  ]) {
    assert.match(periodos, new RegExp(`'${action}'`));
  }
});

test('bundle de períodos projeta Militar por allowlist e não entrega dados pessoais sensíveis de apoio', () => {
  const camposMilitar = extractArray(periodos, 'CAMPOS_MILITAR_SUPORTE');
  for (const forbidden of [
    'cpf', 'rg', 'cnh', 'telefone', 'celular', 'email_pessoal', 'email_funcional',
    'banco', 'agencia', 'conta', 'endereco', 'religiao', 'etnia', 'tipo_sanguineo',
  ]) {
    assert.doesNotMatch(camposMilitar, new RegExp(`['\"]${forbidden}['\"]`, 'i'));
  }
  assert.match(periodos, /militares:\s*\(militares \|\| \[\]\)\.map\(\(item\) => projetarCampos\(item, CAMPOS_MILITAR_SUPORTE\)\)/);
  assert.match(periodos, /supportingDataSanitized:true/);
});

test('Livro e Publicações no bundle de períodos são DTOs de vínculo, não documentos textuais completos', () => {
  const livroFields = extractArray(periodos, 'CAMPOS_REGISTRO_LIVRO_SUPORTE');
  const pubFields = extractArray(periodos, 'CAMPOS_PUBLICACAO_SUPORTE');
  for (const forbidden of ['documento_texto', 'texto_publicacao', 'texto_base', 'texto_complemento', 'observacoes']) {
    assert.doesNotMatch(livroFields, new RegExp(`['\"]${forbidden}['\"]`));
    assert.doesNotMatch(pubFields, new RegExp(`['\"]${forbidden}['\"]`));
  }
  assert.match(periodos, /detectarReferenciaPeriodo\(item, referenciasPorMilitar\)/);
});

test('bundle de Férias devolve somente eventos operacionais mínimos do Livro', () => {
  const eventFields = extractArray(ferias, 'CAMPOS_EVENTO_FERIAS');
  for (const forbidden of ['documento_texto', 'texto_publicacao', 'texto_base', 'texto_complemento']) {
    assert.doesNotMatch(eventFields, new RegExp(`['\"]${forbidden}['\"]`));
  }
  assert.match(ferias, /registrosLivro:\s*projetarEventosFerias\(registrosLivro/);
  assert.match(ferias, /registrosLivro:\s*projetarEventosFerias\(registrosResult\.rows/);
  assert.match(ferias, /tem_texto_publicacao = Boolean/);
  assert.match(familiaFerias, /evento\.tem_texto_publicacao/);
  assert.doesNotMatch(familiaFerias, /evento\.texto_publicacao\s*\?/);
});

test('observações do Livro só atravessam o bundle de Férias para capacidade administrativa explícita', () => {
  assert.match(ferias, /targetPerms\.actions\?\.gerir_cadeia_ferias === true/);
  assert.match(ferias, /targetPerms\.actions\?\.recalcular_ferias === true/);
  assert.match(ferias, /if \(incluirDetalhesAdministrativos && 'observacoes' in registro\)/);
});
