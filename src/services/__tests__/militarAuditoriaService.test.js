import { test } from 'node:test';
import assert from 'node:assert';
import { auditarMilitar } from '../militarAuditoriaService.js';

test('auditarMilitar - militar perfeito deve retornar score 100', () => {
  const militar = {
    cpf: '12345678909', // CPF válido fictício (checksum precisa bater)
    matricula: '108747021',
    data_nascimento: '1990-01-01',
    rg: '1234567',
    tipo_sanguineo: 'A+',
    telefone: '11988887777',
    email_particular: 'teste@email.com',
    logradouro: 'Rua das Flores',
    numero_endereco: '123',
    bairro: 'Centro',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '01001000'
  };

  // Ajustando o CPF para um que o algoritmo valide (123.456.789-09 não é necessariamente válido)
  // Vamos usar um CPF válido real para o teste passar: 123.456.789-09 -> d1: (1*10+2*9+3*8+4*7+5*6+6*5+7*4+8*3+9*2)=210. 210*10=2100. 2100%11=10 -> d1=0.
  // 1234567890 -> d2: (1*11+2*10+3*9+4*8+5*7+6*6+7*5+8*4+9*3+0*2)=253. 253*10=2530. 2530%11=0 -> d2=0.
  // Então 12345678900 deveria ser válido se os cálculos baterem.
  // Vamos usar um gerador online ou calcular um aqui.
  // CPF: 111.111.111-11 é inválido (todos iguais).
  // 000.000.000-00 é inválido.
  // 529.982.247-25 (exemplo real de algoritmo)
  militar.cpf = '52998224725';

  const resultado = auditarMilitar(militar);

  assert.strictEqual(resultado.score, 100);
  assert.strictEqual(resultado.criticos.length, 0);
  assert.strictEqual(resultado.atencao.length, 0);
});

test('auditarMilitar - militar vazio deve retornar score 0', () => {
  const resultado = auditarMilitar({});

  assert.strictEqual(resultado.score, 0);
  assert.strictEqual(resultado.criticos.length, 3); // CPF, Matricula, Data Nascimento
  assert.strictEqual(resultado.atencao.length, 5); // RG, Tipo Sanguineo, Endereco, Telefone, Email
});

test('auditarMilitar - CPF inválido deve gerar erro crítico', () => {
  const militar = { cpf: '12345678901' }; // Checksum inválido
  const resultado = auditarMilitar(militar);

  const criticoCPF = resultado.criticos.find(c => c.campo === 'cpf');
  assert.ok(criticoCPF);
  assert.strictEqual(criticoCPF.mensagem, 'CPF inválido (erro de dígito verificador)');
  assert.strictEqual(resultado.resumo.scores.cpf, 0);
});

test('auditarMilitar - Matrícula com tamanho errado deve gerar erro crítico', () => {
  const militar = { matricula: '123' };
  const resultado = auditarMilitar(militar);

  const criticoMatricula = resultado.criticos.find(c => c.campo === 'matricula');
  assert.ok(criticoMatricula);
  assert.strictEqual(criticoMatricula.mensagem, 'Matrícula deve conter 9 dígitos');
});

test('auditarMilitar - Endereço incompleto deve gerar alerta', () => {
  const militar = { logradouro: 'Rua A' };
  const resultado = auditarMilitar(militar);

  const alertaEndereco = resultado.atencao.find(a => a.campo === 'endereco');
  assert.ok(alertaEndereco);
  assert.match(alertaEndereco.mensagem, /Endereço incompleto/);
  assert.strictEqual(resultado.resumo.scores.endereco, 0);
});

test('auditarMilitar - Tipo sanguíneo inválido deve gerar alerta', () => {
  const militar = { tipo_sanguineo: 'X+' };
  const resultado = auditarMilitar(militar);

  const alertaTipo = resultado.atencao.find(a => a.campo === 'tipo_sanguineo');
  assert.ok(alertaTipo);
  assert.strictEqual(alertaTipo.mensagem, 'Tipo sanguíneo inválido (X+)');
});

test('auditarMilitar - Telefone curto deve gerar alerta', () => {
  const militar = { telefone: '123' };
  const resultado = auditarMilitar(militar);

  const alertaTelefone = resultado.atencao.find(a => a.campo === 'telefone');
  assert.ok(alertaTelefone);
  assert.strictEqual(alertaTelefone.mensagem, 'Telefone deve conter pelo menos 10 dígitos (com DDD)');
});

test('auditarMilitar - Email inválido deve gerar alerta', () => {
  const militar = { email_particular: 'invalido' };
  const resultado = auditarMilitar(militar);

  const alertaEmail = resultado.atencao.find(a => a.campo === 'email');
  assert.ok(alertaEmail);
  assert.strictEqual(alertaEmail.mensagem, 'Nenhum e-mail válido informado (particular ou funcional)');
});
