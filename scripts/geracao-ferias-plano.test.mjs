import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarFeriasPlano } from '../base44/shared/ferias/gerarFeriasPlano.ts';
import { calcularResumoPeriodoPlano } from '../base44/shared/ferias/resumoPeriodoPlano.ts';

function fixture(count, missing = false) {
  const ops = Array.from({ length:count }, (_, i) => ({
    id:'op'+i, militar_id:'m'+i, periodo_aquisitivo_id:'pa'+i, dias_direito:30,
    status_camada_1:'Escala_Salva', decisao_camada_1_detalhes:JSON.stringify([{ mes:'01', dias:30 }]),
  }));
  const pas = ops.filter((_, i) => !missing || i !== 0).map((o, i) => ({
    id:o.periodo_aquisitivo_id, militar_id:o.militar_id, fim_aquisitivo:'2026-12-31', dias_direito:30,
  }));
  let reads = 0, writes = 0;
  const match = (r,q) => Object.entries(q).every(([key,v]) => typeof v === 'object' && v !== null ? v.$in.includes(r[key]) : r[key] === v);
  const entity = records => ({
    async filter(q, sort, limit, skip) {
      reads++;
      if (reads > 120) throw new Error('Limite de requisições');
      return records.filter(r => match(r,q)).slice(skip,skip+limit);
    },
    async get(id) { reads++; return records.find(r=>r.id===id); },
    async create() { writes++; throw new Error('Prévia não pode gravar'); },
    async update() { writes++; throw new Error('Prévia não pode gravar'); },
  });
  const entities = {
    PlanoFeriasInstitucional:entity([{ id:'plano', status:'ATIVO', ano_referencia:2027 }]),
    CampanhaPortal:entity([]), OpcaoFeriasMilitar:entity(ops),
    Militar:entity(ops.map(o=>({ id:o.militar_id }))),
    PeriodoAquisitivo:entity(pas), Ferias:entity([]), AjusteSaldoFerias:entity([]),
  };
  // A consulta composta de opções pertence ao serviço; o mock preserva esse conjunto.
  entities.OpcaoFeriasMilitar.filter = async () => { reads++; return ops; };
  return { entities, metrics:()=>({ reads,writes }) };
}
async function preview(f) {
  const response = await gerarFeriasPlano({
    base44:{ asServiceRole:{ entities:f.entities } }, user:{ id:'admin', email:'admin@example.test', role:'admin' },
    payload:{ plano_id:'plano', somente_previa:true, origem_painel_v2:true, modo_admin:true },
    acao:'PLANO_INSTITUCIONAL_GERAR_FERIAS', calcularResumoPeriodoPlano,
    consolidarOpcoesPlano:ops=>ops, registrarAuditoriaFerias:async()=>{}, corsHeaders:{},
  });
  assert.equal(response.status,200);
  return response.json();
}
test('prévia de 182 escalas usa consultas em conjunto e não grava férias', async()=>{
  const f=fixture(182), result=await preview(f);
  assert.equal(result.total_escalas,182);
  assert.equal(result.total_parcelas,182);
  assert.ok(f.metrics().reads < 10);
  assert.equal(f.metrics().writes,0);
});
test('período ausente bloqueia somente sua escala', async()=>{
  const f=fixture(182,true), result=await preview(f);
  assert.equal(result.total_escalas,181);
  assert.equal(result.bloqueados.length,1);
  assert.match(result.bloqueados[0].motivo,/Período aquisitivo/);
  assert.equal(f.metrics().writes,0);
});
test('plano sem escalas aprovadas retorna prévia vazia', async()=>{
  const f=fixture(0), result=await preview(f);
  assert.equal(result.total_escalas,0);
  assert.equal(result.bloqueados.length,0);
  assert.equal(f.metrics().writes,0);
});
