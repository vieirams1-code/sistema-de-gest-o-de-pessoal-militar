import { test } from 'node:test';
import assert from 'node:assert';
import {
  renderizarTemplateMemorando
} from '../rotinasAdministrativasService.js';

test('RotinasAdministrativas Service - Template Rendering Checklist', (t) => {
  const template = `
    Inicio: {{data_inicio}}
    Fim: {{data_fim}}
    Tabela: {{tabela_atestados}}
    Usuario: {{usuario_nome}}
    Funcao: {{usuario_funcao}}
    Unidade: {{unidade_nome}}
  `;

  const data = {
    data_inicio: '2023-10-02',
    data_fim: '2023-10-06',
    atestados: [
      {
        militar_posto_graduacao: 'Sgt',
        militar_nome: 'Silva',
        militar_matricula: '123',
        data_inicio: '2023-10-02',
        data_fim: '2023-10-03',
        quantidade_dias: 2
      }
    ],
    usuario_nome: 'Ten J. Doe',
    usuario_funcao: 'Chefe da 1ª Seção',
    unidade_nome: '1º BPM'
  };

  const result = renderizarTemplateMemorando(template, data);

  // Validar todos os 6 placeholders obrigatórios
  assert.match(result, /Inicio: 2023-10-02/, 'Placeholder {{data_inicio}} falhou');
  assert.match(result, /Fim: 2023-10-06/, 'Placeholder {{data_fim}} falhou');
  assert.match(result, /Usuario: Ten J. Doe/, 'Placeholder {{usuario_nome}} falhou');
  assert.match(result, /Funcao: Chefe da 1ª Seção/, 'Placeholder {{usuario_funcao}} falhou');
  assert.match(result, /Unidade: 1º BPM/, 'Placeholder {{unidade_nome}} falhou');

  // Validar tabela
  assert.match(result, /\| Sgt Silva \| 123 \|/, 'Tabela de atestados falhou');
  assert.match(result, /2023-10-02 a 2023-10-03/, 'Período na tabela falhou');
});

test('RotinasAdministrativas Service - Template Rendering Empty List', (t) => {
  const template = "Tabela: {{tabela_atestados}}";
  const data = {
    atestados: []
  };

  const result = renderizarTemplateMemorando(template, data);
  assert.match(result, /Nenhum atestado registrado no período/, 'Mensagem de lista vazia falhou');
});
