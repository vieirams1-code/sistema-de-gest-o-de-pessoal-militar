import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarNotaBoletim,
  identificarMilitaresEmNota,
  analisarBoletimContraRegistros,
  inferirTipoPublicacaoNota,
} from './auditoriaPdf.js';

const militares = [
  { id: 'm1', nome_completo: 'João Antônio da Silva', nome_guerra: 'SILVA', matricula: '123456-7', status_cadastro: 'Ativo' },
  { id: 'm2', nome_completo: 'Maria Helena de Souza', nome_guerra: 'HELENA', matricula: '987654-3', status_cadastro: 'Ativo' },
  { id: 'm3', nome_completo: 'Carlos Oliveira', nome_guerra: 'OLIVEIRA', matricula: '456789-0', status_cadastro: 'Inativo' },
  { id: 'm4', nome_completo: 'Antonio Sousa Junior', nome_guerra: 'SOUZA', matricula: '112233-9', status_cadastro: 'Ativo' },
  { id: 'm5', nome_completo: 'José Souza', nome_guerra: 'SOUZA', matricula: '223344-1', status_cadastro: 'Ativo' },
];

test('normaliza o número da nota sem confundir a matrícula', () => {
  assert.equal(normalizarNotaBoletim('NOTA N° 01234'), '1234');
  assert.equal(normalizarNotaBoletim('NOTA Nº 12345'), '12345');
  assert.equal(normalizarNotaBoletim(''), '');
});

test('identifica nome completo e matrícula com tolerância a acentos e separadores', () => {
  const nota = { contexto: 'Por determinação, JOAO ANTONIO DA SILVA e matrícula 987.654-3 concluíram o curso.' };
  const achados = identificarMilitaresEmNota(nota, militares);
  assert.deepEqual(achados.map(a => a.militar.id).sort(), ['m1', 'm2']);
  assert.ok(achados.every(a => a.confianca === 'alta'));
});

test('não atribui publicação a militar inativo nem nome de guerra duplicado', () => {
  const nota = { contexto: 'Informamos a promoção de SOUZA e OLIVEIRA.' };
  assert.equal(identificarMilitaresEmNota(nota, militares).length, 0);
});

test('uma nota com dois militares produz duas ocorrências independentes e não cria RP', () => {
  const nota = { id:'n1', nota:'12345', nota_normalizada:'12345', pagina:4, contexto: 'João Antônio da Silva e Maria Helena de Souza participaram do estágio.' };
  const registros = [{ id:'r1', militar_id:'m1', nota_para_bg:'12345', tipo_registro:'Curso/Estágio' }];
  const res = analisarBoletimContraRegistros([nota], militares, registros);
  assert.equal(res.ocorrencias.length, 2);
  assert.equal(res.ocorrencias.find(o => o.militar.id === 'm1').status, 'registro_localizado');
  assert.equal(res.ocorrencias.find(o => o.militar.id === 'm2').status, 'sem_registro');
  assert.equal(registros.length, 1);
});

test('nome de guerra único gera revisão de identidade, sem confirmação automática', () => {
  const nota = { id:'n2', nota:'54321', contexto: 'O militar HELENA foi designado.' };
  const res = analisarBoletimContraRegistros([nota], militares, []);
  assert.equal(res.ocorrencias[0].status, 'revisar_identidade');
});

test('nota sem militar permanece na lista de revisão, não é descartada', () => {
  const nota = { id:'n3', nota:'99999', contexto: 'Altera expediente do quartel.' };
  const res = analisarBoletimContraRegistros([nota], militares, []);
  assert.equal(res.ocorrencias.length, 0);
  assert.equal(res.notasSemMilitar.length, 1);
});

test('nota registrada em outro BG não é tratada como vínculo confirmado', () => {
  const nota = { id: 'n-ano', nota: '12345', contexto: 'João Antônio da Silva foi designado.' };
  const registros = [{ id:'r-antigo', militar_id:'m1', nota_para_bg:'12345', numero_bg:'071', data_bg:'2025-10-02', texto_publicacao:'outro assunto' }];
  const resultado = analisarBoletimContraRegistros([nota], militares, registros, { numeroBoletim:'045', dataBoletim:'2026-10-28' });
  assert.equal(resultado.ocorrencias.length, 1);
  assert.notEqual(resultado.ocorrencias[0].status, 'registro_localizado');
});

test('tipo sugerido não é confundido com confirmação de importação', () => {
  assert.equal(inferirTipoPublicacaoNota('NOTA Nº 1234\nELOGIO ao militar JOAO.'), 'Elogio Individual');
  assert.equal(inferirTipoPublicacaoNota('NOTA Nº 1234\nDiversos assuntos administrativos.'), 'Geral (classificar)');
});

