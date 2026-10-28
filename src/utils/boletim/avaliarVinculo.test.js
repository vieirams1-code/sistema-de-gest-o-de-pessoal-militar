import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarVinculoPublicacao } from './avaliarVinculo.js';

const efetivo = [
  {id: 'c1', nome_completo: 'Christian Freitas Batista', nome_guerra: 'BATISTA', matricula: '081157022', status_cadastro: 'Ativo'},
  {id: 'a1', nome_completo: 'Adair Queiroz Freitas', nome_guerra: 'FREITAS', matricula: '126355021', status_cadastro: 'Ativo'},
];
const pub = {militar_id:'c1', militar_nome:'Christian Freitas Batista', militar_matricula:'081157022', nota_para_bg:'1244458', texto_publicacao:'Christian Freitas Batista teve 8 dias de dispensa como recompensa por serviços operacionais destacados.'};

test('número igual, militar e assunto em comum são compatíveis', () => {
  const nota = { nota:'1244458', pagina:2, contexto:'NOTA N. 1244458 Christian Freitas Batista, matrícula 081.157-022, teve 8 dias de dispensa como recompensa por serviços operacionais destacados.' };
  const r = avaliarVinculoPublicacao(pub, nota, efetivo);
  assert.equal(r.numeroOK, true);
  assert.equal(r.identidade, 'confirmada');
  assert.equal(r.compativel, true);
});

test('mesma nota numérica não basta quando pertence a outro militar ou ato', () => {
  const nota = { nota:'1244458', pagina:2, contexto:'NOTA N. 1244458 Adair Queiroz Freitas, matrícula 126.355-021, foi designado ao serviço.' };
  const r = avaliarVinculoPublicacao(pub, nota, efetivo);
  assert.equal(r.numeroOK, true);
  assert.equal(r.compativel, false);
  assert.equal(r.exigeRevisao, true);
  assert.equal(r.identidade, 'nao_identificada');
});

test('seleção manual de número diferente é bloqueada', () => {
  const nota = {nota:'1244459', contexto:'Christian Freitas Batista dispensa recompensa serviços operacionais destacados'};
  assert.equal(avaliarVinculoPublicacao(pub, nota, efetivo).bloqueado, true);
});

test('nota lida em página de layout incerto exige revisão', () => {
  const nota = {nota:'1244458', pagina:2, contexto:'Christian Freitas Batista teve 8 dias de dispensa como recompensa por serviços operacionais destacados.'};
  const r = avaliarVinculoPublicacao(pub, nota, efetivo, { paginasLayoutIncertos:[2] });
  assert.equal(r.compativel, false);
  assert.equal(r.exigeRevisao, true);
});

test('detecta RP rotulado Licença Paternidade cujo próprio texto trata de dispensa recompensa', () => {
  const registro = {
    ...pub,
    tipo_registro: 'Licença Paternidade',
    texto_publicacao: 'A Comandante concede ao militar Christian Freitas Batista dispensa total do serviço e expediente, a título de recompensa.',
  };
  const nota = {
    nota:'1244458', pagina:2,
    contexto:'NOTA N. 1244458 Christian Freitas Batista recebeu dispensa total do serviço e expediente, a título de recompensa.',
  };
  const r = avaliarVinculoPublicacao(registro, nota, efetivo);
  assert.equal(r.compativel, false);
  assert.ok(r.problemas.some(p => p.includes('tipo cadastrado diverge')));
});

