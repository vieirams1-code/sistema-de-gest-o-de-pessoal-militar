import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../../pages/PermissoesUsuarios.jsx', import.meta.url), 'utf8');

test('selecionar perfil no dropdown não muda silenciosamente o perfil que será salvo', () => {
  assert.match(source, /const perfilBaseId = appliedProfileState\.id \|\| '';/);
  assert.doesNotMatch(source, /const perfilBaseId = selectedProfileId !== '_nenhum'/);
});

test('perfil atualmente salvo fica separado da fonte usada apenas na prévia', () => {
  assert.match(source, /const \[persistedProfileSource, setPersistedProfileSource\] = useState\(null\);/);
  assert.match(source, /const currentPerfilSelecionado = persistedProfileSource;/);
  assert.match(source, /setPersistedProfileSource\(perfilAtual \|\| null\);/);
});

test('perfil personalizado compara permissões com a base de origem, não com ele próprio', () => {
  assert.match(source, /setSelectedProfileSource\(perfilBase \|\| null\);/);
  assert.match(source, /perfilBase \? resolveProfilePermissions\(\{ profileSource: perfilBase \}\)\.permissions : null/);
  assert.match(source, /profileSource: perfilAtual \|\| \{\}/);
});
