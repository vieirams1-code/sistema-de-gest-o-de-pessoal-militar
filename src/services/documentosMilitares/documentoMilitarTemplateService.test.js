import assert from 'node:assert/strict';
import test from 'node:test';

import { lintTemplateOnSave } from '../../components/rp/templateValidation.js';
import { MODULO_DOCUMENTOS_MILITARES } from './documentoMilitarVarsService.js';
import {
  DOCUMENTOS_MILITARES_TEMPLATE_OPTION,
  lintTemplateDocumentoMilitar,
  previewTemplateDocumentoMilitar,
  VARIAVEIS_TEMPLATE_DOCUMENTO_MILITAR,
} from './documentoMilitarTemplateService.js';

const VARIAVEIS_ESPERADAS = [
  'nome_completo',
  'nome_guerra',
  'posto_graduacao',
  'quadro',
  'matricula',
  'cpf',
  'rg',
  'data_nascimento',
  'data_inclusao',
  'lotacao',
  'unidade',
  'situacao',
  'comportamento_atual',
  'data_promocao_atual',
  'tempo_servico',
  'data_atual',
  'cidade',
];

test('expõe DocumentosMilitares como módulo disponível para templates', () => {
  assert.deepEqual(DOCUMENTOS_MILITARES_TEMPLATE_OPTION, {
    value: 'Documento Militar',
    label: 'Documento Militar',
    modulo: MODULO_DOCUMENTOS_MILITARES,
  });
  assert.deepEqual(
    VARIAVEIS_TEMPLATE_DOCUMENTO_MILITAR.map(({ chave }) => chave),
    VARIAVEIS_ESPERADAS
  );
});

test('variáveis conhecidas de DocumentosMilitares não geram alerta', () => {
  const template = VARIAVEIS_ESPERADAS.map((variavel) => `{{${variavel}}}`).join(' ');
  const result = lintTemplateOnSave({
    modulo: MODULO_DOCUMENTOS_MILITARES,
    tipoRegistro: DOCUMENTOS_MILITARES_TEMPLATE_OPTION.value,
    template,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.summary, { erros: 0, alertas: 0, infos: 0 });
  assert.deepEqual(result.findings, []);
});

test('variável desconhecida de DocumentosMilitares gera alerta controlado sem bloquear salvamento', () => {
  const result = lintTemplateDocumentoMilitar('Nome: {{nome_completo}} / revisar: {{variavel_inexistente}}');

  assert.equal(result.ok, true);
  assert.equal(result.summary.erros, 0);
  assert.equal(result.summary.alertas, 1);
  assert.equal(result.findings[0].severity, 'ALERTA');
  assert.equal(result.findings[0].code, 'VAR_DESCONHECIDA_DOCUMENTO_MILITAR');
  assert.equal(result.findings[0].variavel, 'variavel_inexistente');
});

test('preview administrativo substitui conhecidas e mantém desconhecidas evidentes', () => {
  assert.equal(
    previewTemplateDocumentoMilitar('{{posto_graduacao}} {{nome_completo}} / {{revisar_depois}}'),
    'Capitão Maria da Silva / {{revisar_depois}}'
  );
});

test('lint de outros módulos preserva o comportamento anterior', () => {
  const feriasValido = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Saída Férias',
    template: '{{nome_completo}} {{posto_nome}} {{matricula}} {{data_registro}}',
  });
  const atestadoInvalido = lintTemplateOnSave({
    modulo: 'ExOfficio',
    tipoRegistro: 'Homologação de Atestado',
    template: '{{nome_completo}} {{posto_nome}} {{matricula}} {{variavel_inexistente}}',
  });

  assert.equal(feriasValido.ok, true);
  assert.equal(feriasValido.findings.some((finding) => finding.code === 'VAR_DESCONHECIDA'), false);
  assert.equal(atestadoInvalido.ok, false);
  assert.equal(
    atestadoInvalido.findings.some((finding) => finding.code === 'VAR_DESCONHECIDA' && finding.severity === 'ERRO'),
    true
  );
});

test('lint de DocumentosMilitares aceita campo dinâmico válido e alerta formatos inválidos', () => {
  const valido = lintTemplateDocumentoMilitar('{{nome_completo}} / {{campo:nome_curso}}');
  const invalido = lintTemplateDocumentoMilitar('{{campo:}} / {{campo}}');

  assert.equal(valido.findings.some((finding) => finding.code === 'VAR_DESCONHECIDA_DOCUMENTO_MILITAR'), false);
  assert.deepEqual(
    invalido.findings.map((finding) => finding.variavel),
    ['campo:', 'campo']
  );
});

test('preview administrativo substitui campos dinâmicos simulados e preserva os sem simulação', () => {
  assert.equal(
    previewTemplateDocumentoMilitar('{{nome_completo}} / {{campo:nome_curso}} / {{campo:observacoes}}'),
    'Maria da Silva / Curso de Formação / {{campo:observacoes}}'
  );
});
