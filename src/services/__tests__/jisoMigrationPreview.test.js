import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../../../base44/functions/previewMigracaoJisoIndependente/entry.ts', import.meta.url),
  'utf8',
);

test('preview de migração é restrito ao administrador da plataforma', () => {
  assert.match(source, /String\(authUser\.role \|\| ''\)\.toLowerCase\(\) !== 'admin'/);
  assert.match(source, /PLATFORM_ADMIN_REQUIRED/);
});

test('preview não executa escrita nas entidades migradas', () => {
  assert.doesNotMatch(source, /entities\.JISO\.create\(/);
  assert.doesNotMatch(source, /entities\.JISO\.update\(/);
  assert.doesNotMatch(source, /entities\.JISOAtestado\.create\(/);
  assert.doesNotMatch(source, /entities\.JISOAtestado\.update\(/);
  assert.doesNotMatch(source, /entities\.Atestado\.update\(/);
  assert.match(source, /write_performed: false/);
});

test('preview planeja vínculo legado sem apagar campos do atestado', () => {
  assert.match(source, /origem_vinculo: 'migracao_legado'/);
  assert.match(source, /campos_legados_atestado_nao_removidos: true/);
  assert.match(source, /nenhuma_fusao_automatica: true/);
});

test('preview sinaliza inconsistência de militar e atestado ausente', () => {
  assert.match(source, /ATESTADO_LEGADO_NAO_ENCONTRADO/);
  assert.match(source, /MILITAR_DIVERGENTE/);
});

test('preview detecta candidatos de mesma sessão sem fundir automaticamente', () => {
  assert.match(source, /REVISAR_MANUALMENTE_NAO_FUNDIR_AUTOMATICAMENTE/);
  assert.match(source, /candidatos_duplicidade_mesma_sessao/);
});

test('preview inclui migração de agendamento, WhatsApp e Ata/Publicação', () => {
  for (const field of [
    'data_jiso',
    'hora_jiso',
    'jiso_whatsapp_enviado_em',
    'jiso_whatsapp_mensagem',
    'arquivo_ata_jiso',
    'status_publicacao',
    'numero_tars',
    'local_jiso',
  ]) {
    assert.match(source, new RegExp(`'${field}'`));
  }
});
