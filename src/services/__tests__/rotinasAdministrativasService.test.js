import { test } from 'node:test';
import assert from 'node:assert';
import {
  renderizarTemplateMemorando
} from '../rotinasAdministrativasService.js';

test('RotinasAdministrativas Service - Template Rendering', (t) => {
  const template = "Inicio: {{data_inicio}}, Fim: {{data_fim}}, Tabela: {{tabela_atestados}}, Usuario: {{usuario_nome}}";
  const data = {
    data_inicio: '2023-10-01',
    data_fim: '2023-10-05',
    atestados: [
      { militar_posto_graduacao: 'Sgt', militar_nome: 'Silva', militar_matricula: '123', data_inicio: '2023-10-01', data_fim: '2023-10-02', quantidade_dias: 2 }
    ],
    usuario_nome: 'Admin'
  };

  const result = renderizarTemplateMemorando(template, data);

  assert.match(result, /Inicio: 2023-10-01/);
  assert.match(result, /Fim: 2023-10-05/);
  assert.match(result, /Usuario: Admin/);
  assert.match(result, /Silva/);
  assert.match(result, /\| Sgt Silva \| 123 \|/);
});

test('RotinasAdministrativas Service - Empty Table Template', (t) => {
  const template = "Tabela: {{tabela_atestados}}";
  const data = {
    atestados: []
  };

  const result = renderizarTemplateMemorando(template, data);
  assert.match(result, /Nenhum atestado registrado no período/);
});
