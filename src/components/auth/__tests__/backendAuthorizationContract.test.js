import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const canonical = read('../../../../base44/functions/getUserPermissions/entry.ts');

const migratedGateways = [
  '../../../../base44/functions/controleProcessosEscopado/entry.ts',
  '../../../../base44/functions/cudEstruturaOrganizacional/entry.ts',
  '../../../../base44/functions/cudFuncoesTagsEscopado/entry.ts',
  '../../../../base44/functions/gerirCadastrosGratificacaoFuncao/entry.ts',
  '../../../../base44/functions/gerirRascunhoGratificacaoFuncao/entry.ts',
  '../../../../base44/functions/moverMilitaresLotacao/entry.ts',
  '../../../../base44/functions/registrarAuditoriaExportacaoEfetivo/entry.ts',
  '../../../../base44/functions/getScopedContratosDesignacaoMilitar/entry.ts',
  '../../../../base44/functions/getScopedPainelContratosDesignacao/entry.ts',
  '../../../../base44/functions/getScopedCotasGratificacaoFuncao/entry.ts',
  '../../../../base44/functions/getScopedPainelGratificacoesFuncao/entry.ts',
].map(read);

const migratedScopedReaders = [
  '../../../../base44/functions/getScopedArmamentosBundle/entry.ts',
  '../../../../base44/functions/getScopedAtestadosBundle/entry.ts',
  '../../../../base44/functions/getScopedMedalhasBundle/entry.ts',
  '../../../../base44/functions/getScopedCreditosExtraFerias/entry.ts',
  '../../../../base44/functions/getScopedPeriodosAquisitivosBundle/entry.ts',
  '../../../../base44/functions/getScopedLotacoes/entry.ts',
].map(read);

test('getUserPermissions é a fonte canônica de capacidade, escopo e admin real', () => {
  assert.match(canonical, /const isAdmin = isAdminByRole;/);
  assert.match(canonical, /const hasGlobalScope = isAdminByRole \|\| isAdminByAccess;/);
  assert.match(canonical, /const \{ modules, actions \} = consolidarModulesActions\(perfis\);/);
  assert.doesNotMatch(canonical, /\(acessos \|\| \[\]\)\.forEach\(aplicarFonte\)/);
});

test('gateways migrados obtêm ações pelo getUserPermissions e não consolidam UsuarioAcesso funcionalmente', () => {
  for (const source of migratedGateways) {
    assert.match(source, /functions\.invoke\('getUserPermissions'/);
    assert.doesNotMatch(source, /consolidarActions\(perfis[^)]*,\s*acessos/);
    assert.doesNotMatch(source, /String\([^\n]*role[^\n]*admin[^\n]*\|\|[^\n]*isAdminByAccess/);
  }
});

test('scoped readers migrados delegam effectiveEmail ao resolvedor canônico', () => {
  for (const source of migratedScopedReaders) {
    assert.match(source, /functions\.invoke\('getUserPermissions'/);
    assert.doesNotMatch(source, /wantsImpersonation[^\n]*&&[^\n]*!authIsAdmin/);
    assert.doesNotMatch(source, /authIsAdmin[^\n]*\|\|[^\n]*isAdminByAccess/);
  }
});

test('tipo_acesso admin permanece permitido somente em helpers de escopo', () => {
  const mover = read('../../../../base44/functions/moverMilitaresLotacao/entry.ts');
  assert.match(mover, /hasGlobalScope/);
  assert.match(mover, /isPlatformAdmin/);
  assert.doesNotMatch(mover, /isAdminByAccess/);

  const estrutura = read('../../../../base44/functions/cudEstruturaOrganizacional/entry.ts');
  assert.match(estrutura, /const isPlatformAdmin = authz\?\.isAdmin === true;/);
  assert.doesNotMatch(estrutura, /tipo_acesso/);
});
