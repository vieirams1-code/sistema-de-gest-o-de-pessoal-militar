import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../AgendarJISO.jsx', import.meta.url), 'utf8');

test('central JISO usa bundle independente e não monta agenda a partir de atestados', () => {
  assert.match(source, /fetchScopedJisoBundle/);
  assert.match(source, /queryKey: \['jiso-independent-bundle'/);
  assert.doesNotMatch(source, /fetchScopedAtestadosBundle/);
  assert.doesNotMatch(source, /montarAgendaJiso/);
  assert.doesNotMatch(source, /enriquecerAtestadosComContextoMilitar/);
});

test('central permite criar JISO sem atestado', () => {
  assert.match(source, /A JISO pode ser criada sem qualquer atestado vinculado/);
  assert.match(source, /criarJiso\(dados\)/);
  assert.match(source, /atestadoParaVincular \?/);
});

test('Gerar JISO de um atestado cria a JISO e depois o vínculo seguro', () => {
  assert.match(source, /await criarJiso\(dados\)/);
  assert.match(source, /await vincularAtestadoJiso\(/);
  assert.match(source, /origem_vinculo: 'gerado_atestado'/);
  assert.match(source, /finalidade_jiso: 'Homologação de Atestado'/);
});

test('lista principal trata atestados apenas como vínculos da JISO', () => {
  assert.match(source, /A JISO é o registro principal; atestados aparecem apenas como vínculos/);
  assert.match(source, /getAtestadosDaJiso/);
  assert.match(source, /Sem atestado/);
});

test('atestado pode ser vinculado a JISO aberta já existente do mesmo militar', () => {
  assert.match(source, /getJisosVinculaveis/);
  assert.match(source, /Vincular atestado a uma JISO existente/);
  assert.match(source, /origem_vinculo: 'manual'/);
  assert.match(source, /linkExistingMutation/);
  assert.match(source, /Vincular à JISO/);
  assert.match(source, /\['Realizada', 'Cancelada'\]/);
});

test('central mantém compatibilidade transitória de acesso sem inventar permissão nova', () => {
  assert.match(source, /canAccessModule\('atestados'\)/);
  assert.match(source, /canAccessAction\('gerir_jiso'\)/);
  assert.match(source, /canAccessAction\('registrar_decisao_jiso'\)/);
  assert.match(source, /canAccessAction\('publicar_ata_jiso'\)/);
  assert.doesNotMatch(source, /canAccessModule\('jiso'\)/);
});

test('central não lê CID nem médico para montar a listagem', () => {
  assert.doesNotMatch(source, /cid_10/);
  assert.doesNotMatch(source, /cid_descricao/);
  assert.doesNotMatch(source, /medico_nome/);
});
