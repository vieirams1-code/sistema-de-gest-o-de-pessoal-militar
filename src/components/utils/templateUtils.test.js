import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aplicarTemplate,
  buildPreviewTemplateVars,
  buildTemplateVarsContrato,
  buildVarsLivro,
  montarPostoNomeTemplate,
  resolveQuadroTemplate,
} from './templateUtils.jsx';

test('buildVarsLivro expõe quadro_nome sem quebrar posto_nome legado', () => {
  const vars = buildVarsLivro({
    ferias: {
      militar_posto: 'Capitão',
      militar_quadro: 'QOBM',
      militar_nome: 'João da Silva',
      militar_matricula: '123456',
      data_inicio: '2026-04-01',
      data_fim: '2026-04-30',
      dias: 30,
      periodo_aquisitivo_ref: '2024/2025',
    },
  });

  assert.equal(vars.posto_nome, 'Cap QOBM');
  assert.equal(vars.posto, 'Cap');
  assert.equal(vars.quadro_nome, 'QOBM');
  assert.equal(vars.militar_quadro, 'QOBM');
});

test('buildPreviewTemplateVars retorna aliases de quadro coerentes', () => {
  const vars = buildPreviewTemplateVars();

  assert.equal(vars.quadro, 'QPTBM');
  assert.equal(vars.quadro_nome, vars.quadro);
  assert.equal(vars.militar_quadro, vars.quadro);
});

test('buildPreviewTemplateVars usa mesmo contrato para posto_nome', () => {
  const vars = buildPreviewTemplateVars({ posto_abreviatura: 'Maj', quadro: 'QOSAU' });
  const esperado = montarPostoNomeTemplate({ abreviatura: 'Maj', quadro: 'QOSAU', source: vars });

  assert.equal(vars.posto_nome, esperado);
});

test('buildPreviewTemplateVars respeita override de quadro QOBM sem fallback artificial', () => {
  const vars = buildPreviewTemplateVars({ quadro: 'QOBM' });
  assert.equal(vars.quadro, 'QOBM');
  assert.equal(vars.quadro_nome, 'QOBM');
  assert.equal(vars.militar_quadro, 'QOBM');
});

test('buildPreviewTemplateVars sem quadro não inventa QOBM', () => {
  const vars = buildPreviewTemplateVars({ quadro: '', quadro_nome: '', militar_quadro: '' });
  assert.equal(vars.quadro, '');
});

test('aplicarTemplate mantém aliases de quadro com o mesmo valor', () => {
  const vars = buildPreviewTemplateVars({ quadro: 'QPTBM' });
  const saida = aplicarTemplate('{{quadro}}|{{quadro_nome}}|{{militar_quadro}}', vars);
  assert.equal(saida, 'QPTBM|QPTBM|QPTBM');
});

test('resolveQuadroTemplate retorna QPTBM quando quadro real existir', () => {
  assert.equal(resolveQuadroTemplate({ quadro_nome: 'QPTBM' }), 'QPTBM');
});

test('resolveQuadroTemplate retorna QOBM quando quadro real existir', () => {
  assert.equal(resolveQuadroTemplate({ militar_quadro: 'QOBM' }), 'QOBM');
});

test('resolveQuadroTemplate não inventa fallback QOBM quando ausência de quadro', () => {
  assert.equal(resolveQuadroTemplate({}), '');
});

test('montarPostoNomeTemplate compõe posto + quadro', () => {
  assert.equal(montarPostoNomeTemplate({ abreviatura: 'Cap', quadro: 'QPTBM' }), 'Cap QPTBM');
});

test('montarPostoNomeTemplate retorna somente posto quando quadro não existe', () => {
  assert.equal(montarPostoNomeTemplate({ abreviatura: 'Cap', quadro: '' }), 'Cap');
});


test('buildPreviewTemplateVars reutiliza contrato de férias/livro no preview', () => {
  const vars = buildPreviewTemplateVars();
  const saida = aplicarTemplate('{{data_registro}}|{{dias}}|{{dias_extenso}}|{{periodo_aquisitivo}}', vars);

  assert.equal(saida, '07/01/2026|30|trinta|01/01/2024 a 31/12/2025');
  assert.equal(vars.novo_fim, '05/02/2026');
  assert.equal(vars.retorno_previsto, '06/02/2026');
  assert.equal(vars.base_dias, '30');
});

test('prévia de férias renderiza {{quadro}} com valor de exemplo', () => {
  const vars = buildPreviewTemplateVars({ quadro: 'QOBM' });
  const saida = aplicarTemplate('Quadro: {{quadro}}', vars);
  assert.equal(saida, 'Quadro: QOBM');
});

test('prévia de férias renderiza {{posto_nome}} como posto + quadro', () => {
  const vars = buildPreviewTemplateVars({ posto_abreviatura: 'Maj', quadro: 'QOSAU' });
  const saida = aplicarTemplate('{{posto_nome}}', vars);
  assert.equal(saida, 'Maj QOSAU');
});


test('aplicarTemplate no fluxo de férias remove placeholders de quadro e posto_nome quando vazio', () => {
  const vars = buildVarsLivro({
    ferias: {
      militar_posto: 'Capitão',
      militar_quadro: 'QPTBM',
      militar_nome: 'Maria Silva',
      dias: 30,
      data_inicio: '2026-01-01',
      data_fim: '2026-01-30',
    },
  });

  const saida = aplicarTemplate('{{posto_nome}} {{quadro}} {{quadro_nome}} {{militar_quadro}}', vars);
  assert.equal(saida.includes('{{'), false);
  assert.equal(saida, 'Cap QPTBM QPTBM QPTBM');
});

test('buildVarsLivro com militar real prioriza quadro e compõe posto_nome', () => {
  const vars = buildVarsLivro({
    ferias: {
      militar_nome: 'Ana Souza',
      dias: 30,
      data_inicio: '2026-01-01',
      data_fim: '2026-01-30',
    },
    militar: {
      posto_graduacao: '3º Sargento',
      quadro: 'QBMP 1.a',
    },
  });

  assert.equal(vars.posto_nome, '3º Sgt QBMP 1.a');
  assert.equal(vars.quadro, 'QBMP 1.a');
  assert.equal(vars.quadro_nome, 'QBMP 1.a');
  assert.equal(vars.militar_quadro, 'QBMP 1.a');
});

test('aplicarTemplate no fluxo real mantém quadro quando militar possui quadro', () => {
  const vars = buildVarsLivro({
    ferias: {
      militar_nome: 'Ana Souza',
      dias: 30,
      data_inicio: '2026-01-01',
      data_fim: '2026-01-30',
    },
    militar: {
      posto_graduacao: '3º Sargento',
      quadro: 'QBMP 1.a',
    },
  });
  const saida = aplicarTemplate('{{posto_nome}} {{nome_completo}} {{quadro}} {{quadro_nome}}', vars);
  assert.equal(saida, '3º Sgt QBMP 1.a Ana Souza QBMP 1.a QBMP 1.a');
});


test('buildTemplateVarsContrato retorna núcleo canônico com aliases coerentes', () => {
  const vars = buildTemplateVarsContrato({
    nome_completo: 'Carlos Lima',
    posto: 'Cap',
    quadro: 'QOBM',
    matricula: '111',
  });

  assert.deepEqual(vars, {
    nome_completo: 'Carlos Lima',
    posto: 'Cap',
    posto_nome: 'Cap QOBM',
    quadro: 'QOBM',
    quadro_nome: 'QOBM',
    militar_quadro: 'QOBM',
    matricula: '111',
  });
});

test('buildTemplateVarsContrato prioriza matrícula documental > operacional > matrícula', () => {
  const vars = buildTemplateVarsContrato({
    militar_posto: 'Capitão',
    militar_quadro: 'QPTBM',
    matricula_documental: 'DOC-1',
    matricula_operacional: 'OP-2',
    matricula: 'LEG-3',
  });

  assert.equal(vars.matricula, 'DOC-1');
});

test('buildTemplateVarsContrato usa fallback de matrícula para "-"', () => {
  const vars = buildTemplateVarsContrato({ militar_posto: 'Capitão' });
  assert.equal(vars.matricula, '-');
});
