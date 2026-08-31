import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const publicacoes = read('../../../pages/Publicacoes.jsx');
const cadastrarRp = read('../../../pages/CadastrarRegistroRP.jsx');
const publicacaoCard = read('../../publicacao/PublicacaoCard.jsx');
const ajustesFerias = read('../../../pages/AjustesSaldoFerias.jsx');
const lotacao = read('../../../pages/LotacaoMilitares.jsx');
const funcoes = read('../../../pages/Funcoes.jsx');
const cursos = read('../../../pages/CursosFormacao.jsx');
const fichaTabs = read('../../../services/militarFichaTabsVisibility.js');
const contratos = read('../../../pages/ContratosDesignacao.jsx');
const verMilitar = read('../../../pages/VerMilitar.jsx');
const backendCud = read('../../../../base44/functions/cudEscopado/entry.ts');
const perfis = read('../../../pages/PerfisPermissao.jsx');
const permissoesUsuarios = read('../../../pages/PermissoesUsuarios.jsx');
const atestados = read('../../../pages/Atestados.jsx');
const permissionStructure = read('../../../config/permissionStructure.js');
const agendarJiso = read('../../../pages/AgendarJISO.jsx');
const editarJiso = read('../../../pages/EditarJISO.jsx');
const centralAtestado = read('../../central-pendencias/CentralPendenciaAtestadoModal.jsx');
const quadroCard = read('../../quadro/CardDetalheModal.jsx');

test('criação de publicação depende somente de adicionar_publicacoes', () => {
  assert.match(publicacoes, /const canCriarPublicacoes = canAccessAction\('adicionar_publicacoes'\);/);
  assert.doesNotMatch(publicacoes, /canCriarPublicacoes = .*editar_publicacoes/);
  assert.doesNotMatch(publicacoes, /canCriarPublicacoes = .*admin_mode/);
});

test('editar e publicar RP não herdam admin_mode', () => {
  assert.match(cadastrarRp, /const canGerirPublicacoes = canAccessAction\('editar_publicacoes'\);/);
  assert.match(cadastrarRp, /const canPublicarBg = canAccessAction\('publicar_bg'\);/);
});

test('PublicacaoCard exige permissões exatas para publicar e excluir', () => {
  assert.match(publicacaoCard, /const podePublicarBg = canAccessAction\('publicar_bg'\);/);
  assert.match(publicacaoCard, /canAccessAction\('excluir_publicacoes'\)\s*&&\s*canAccessAction\('admin_mode'\)/s);
});

test('créditos de férias separam visualizar, criar e cancelar', () => {
  assert.match(ajustesFerias, /canAccessModule\('ferias'\) && canAccessAction\('visualizar_creditos_ferias'\)/);
  assert.match(ajustesFerias, /const canCriar = canAccessAction\('criar_credito_extra_ferias'\);/);
  assert.match(ajustesFerias, /const canCancelar = canAccessAction\('cancelar_credito_extra_ferias'\);/);
  assert.doesNotMatch(ajustesFerias, /canCriar = .*editar_credito_extra_ferias/);
  assert.doesNotMatch(ajustesFerias, /canCancelar = .*editar_credito_extra_ferias/);
});

test('lotação usa permissões próprias, sem herdar estrutura ou permissões de usuários', () => {
  assert.match(lotacao, /canAccessModule\('lotacao_militares'\) && canAccessAction\('visualizar_lotacao_militares'\)/);
  assert.match(lotacao, /const canManageLotacao = canAccessAction\('gerir_lotacao_militares'\);/);
  assert.doesNotMatch(lotacao, /canAccessAction\('gerir_estrutura'\) \|\| canAccessAction\('gerir_permissoes'\)/);
});

test('funções e cursos não usam OR para substituir módulo por ação', () => {
  assert.match(funcoes, /canAccessModule\('adicoes_personalizacoes'\) && canAccessAction\('gerir_adicoes_personalizacoes'\)/);
  assert.doesNotMatch(funcoes, /canAccessAction\('gerir_configuracoes'\) \|\|/);
  assert.match(cursos, /canAccessModule\('cursos_formacao'\) && canAccessAction\('visualizar_cursos_formacao'\)/);
});

test('abas sensíveis da ficha exigem permissão explícita de visualização', () => {
  assert.match(fichaTabs, /canAccessModule\('atestados'\)\s*&& canAccessAction\('visualizar_atestados'\)/s);
  assert.match(fichaTabs, /canAccessModule\('armamentos'\)\s*&& canAccessAction\('visualizar_armamentos'\)/s);
});

test('contratos usam capacidades separadas no frontend e backend', () => {
  for (const key of ['visualizar_contratos_designacao', 'criar_contrato_designacao', 'editar_metadados_contrato_designacao', 'encerrar_contrato_designacao', 'excluir_contrato_designacao']) {
    assert.match(contratos, new RegExp(`canAccessAction\\('${key}'\\)`));
  }
  assert.doesNotMatch(contratos, /gerir_contratos_designacao/);
  assert.doesNotMatch(verMilitar, /gerir_contratos_designacao/);
  assert.doesNotMatch(backendCud, /ou gerir_contratos_designacao/);
});

test('desligar módulo limpa ações filhas; ligar módulo não concede ações automaticamente', () => {
  for (const source of [perfis, permissoesUsuarios]) {
    assert.match(source, /const ativarModulo = prev\[mod\.key\] !== true;/);
    assert.match(source, /if \(ativarModulo\) return \{ \.\.\.prev, \[mod\.key\]: true \};/);
    assert.match(source, /\(mod\.actions \|\| \[\]\)\.forEach\(\(act\) => \{ next\[act\.key\] = false; \}\);/);
  }
});

test('Atestados possui uma única permissão canônica de exclusão', () => {
  assert.match(atestados, /const canExcluirAtestado = canAccessAction\('excluir_atestado'\);/);
  assert.doesNotMatch(permissionStructure, /perm_excluir_atestados/);
  assert.match(permissionStructure, /perm_excluir_atestado/);
});

test('JISO separa gestão administrativa de registro da decisão', () => {
  assert.match(agendarJiso, /const canViewJisoAgenda = canAccessAction\('gerir_jiso'\) \|\| canAccessAction\('registrar_decisao_jiso'\);/);
  assert.match(editarJiso, /const canRegistrarDecisaoJiso = canAccessAction\('registrar_decisao_jiso'\);/);
  assert.doesNotMatch(editarJiso, /canAccessAction\('gerir_jiso'\) \|\| canAccessAction\('registrar_decisao_jiso'\)/);
  assert.match(centralAtestado, /&& canAccessAction\('gerir_jiso'\)/);
  assert.match(quadroCard, /permiteEditarDataJiso = !!vinculoAtestado\?\.referencia_id && canAccessAction\('gerir_jiso'\)/);
  assert.match(backendCud, /requiredPermission = 'registrar_decisao_jiso';\s*allowed = targetPerms\.actions\?\.\['registrar_decisao_jiso'\] === true;/s);
  assert.doesNotMatch(backendCud, /registrar_decisao_jiso ou gerir_jiso/);
});

test('ações JISO independentes conseguem persistir apenas seus próprios reflexos', () => {
  assert.match(backendCud, /const camposGestaoJiso = new Set\(\['necessita_jiso', 'status_jiso', 'data_jiso_agendada', 'hora_jiso_agendada'\]\);/);
  assert.match(backendCud, /requiredPermission = 'gerir_jiso';\s*allowed = targetPerms\.actions\?\.\['gerir_jiso'\] === true;/s);
  assert.match(backendCud, /const camposDecisaoJiso = new Set\(\['dias_original', 'dias_jiso', 'data_termino_jiso', 'data_retorno_jiso', 'jiso_id'\]\);/);
  assert.match(backendCud, /if \(tipoPublicacao === 'Ata JISO'\) requiredPermission = 'publicar_ata_jiso';/);
  assert.match(backendCud, /if \(tipoPublicacao === 'Homologação de Atestado'\) requiredPermission = 'publicar_homologacao';/);
});
