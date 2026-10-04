import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
const compile=path=>buildSync({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false,external:['npm:*']}).outputFiles[0].text;
const codes={scales:compile('base44/functions/sargenteacaoEscalasGateway/entry.ts'),catalog:compile('base44/functions/sargenteacaoGateway/entry.ts')};
function harness({global=false,manage=true,view=true,scopeFailure=false,seed={}}={}){
 const writes=[],requests=[];
 const db={
  QuartelPosto:[{id:'qa',estrutura_id:'ua',ativo:true},{id:'qb',estrutura_id:'ub',ativo:true},{id:'qnone',ativo:true}],
  AlaGrupo:[{id:'aa',quartel_posto_id:'qa',ativo:true},{id:'ab',quartel_posto_id:'qb',ativo:true}],
  EscalaServico:[{id:'sa',quartel_posto_id:'qa',ala_grupo_id:'aa',status:'RASCUNHO'},{id:'sb',quartel_posto_id:'qb',ala_grupo_id:'ab',status:'RASCUNHO'}],
  EscalaGuarnicao:[{id:'ca',escala_servico_id:'sa',modelo_guarnicao_id:'model',quantidade_prevista:1,status:'COMPLETA'},{id:'cb',escala_servico_id:'sb',modelo_guarnicao_id:'model',quantidade_prevista:1,status:'COMPLETA'}],
  EscalaMilitar:[{id:'ea',escala_servico_id:'sa',escala_guarnicao_id:'ca',militar_id:'ma',status:'ESCALADO',funcao_operacional:'AUXILIAR'},{id:'eb',escala_servico_id:'sb',escala_guarnicao_id:'cb',militar_id:'mb',status:'ESCALADO',funcao_operacional:'AUXILIAR'}],
  Militar:[{id:'ma',estrutura_id:'ua',nome_completo:'Fixture A',status_cadastro:'Ativo',cpf:'sensitive-fixture'},{id:'mb',estrutura_id:'ub',nome_completo:'Fixture B',status_cadastro:'Ativo'}],
  ModeloGuarnicao:[{id:'model',ativo:true,quantitativo:1}],
  ModeloGuarnicaoVaga:[{id:'slot',modelo_guarnicao_id:'model',funcao_operacional:'AUXILIAR'}],
  EmpenhoOperacional:[],Subgrupamento:[],...seed
 };
 const matches=(r,q)=>Object.entries(q||{}).every(([k,v])=>v&&typeof v==='object'&&v.$in?v.$in.includes(r[k]):r[k]===v);
 const entities=new Proxy({}, {get:(_,name)=>({list:async()=>structuredClone(db[name]||[]),get:async id=>structuredClone((db[name]||[]).find(r=>r.id===id)||null),filter:async q=>structuredClone((db[name]||[]).filter(r=>matches(r,q))),create:async p=>{const r={...p,id:name+'-new'};(db[name]||=[]).push(r);writes.push(name+'.create');return r;},update:async(id,p)=>{writes.push(name+'.update');const r=(db[name]||[]).find(r=>r.id===id);Object.assign(r,p);return r;},delete:async id=>{writes.push(name+'.delete');db[name]=(db[name]||[]).filter(r=>r.id!==id);}})});
 const auth={isAdminByRole:false,hasGlobalScope:global,modules:{sargenteacao:true},actions:{visualizar_sargenteacao:view,gerir_sargenteacao:manage},acessos:[{tipo_acesso:'unidade',subgrupamento_id:'ua'}],scope:{tipo:global?'admin':'unidade',estruturaIds:['ua']}};
 const client={auth:{me:async()=>({id:'fixture-user',role:'user'})},asServiceRole:{entities},functions:{invoke:async(name,payload)=>{assert.equal(name,'getUserPermissions');requests.push(payload);if(scopeFailure&&payload.scopeMilitarIds)return {data:{error:'fixture'}};return {data:{...auth,scopeCheck:payload.scopeMilitarIds?{allowedIds:payload.scopeMilitarIds.filter(id=>global||id==='ma')}:null}};}}};
 let handler;const use=kind=>vm.runInNewContext(codes[kind],{require:()=>({createClientFromRequest:()=>client}),Deno:{serve:fn=>handler=fn},Response,console:{error(){}}});
 const call=async(kind,payload)=>{use(kind);const r=await handler({json:async()=>payload});return {status:r.status,body:await r.json()};};
 return {call,db,writes,requests,auth};
}
test('LIST escalas limita todos os relacionamentos e projeta militares',async()=>{const h=harness();const r=await h.call('scales',{action:'LIST'});assert.equal(r.status,200);for(const [key,ids] of Object.entries({escalas:['sa'],guarnicoes:['ca'],escalados:['ea'],militares:['ma']}))assert.deepEqual(r.body[key].map(x=>x.id),ids);assert.equal(r.body.militares[0].cpf,undefined);});
test('LIST cadastros limita quartéis e alas, catálogo compartilhado continua legível',async()=>{const h=harness();const r=await h.call('catalog',{action:'LIST'});assert.equal(r.status,200);assert.deepEqual(r.body.quartel.map(x=>x.id),['qa']);assert.deepEqual(r.body.alas.map(x=>x.id),['aa']);assert.equal(r.body.scope_global,false);});
for(const payload of [
 {action:'CREATE_SCALE',data:{data_inicio:'2026-10-04',quartel_posto_id:'qb',ala_grupo_id:'ab'}},
 {action:'ADD_CREW',escalaId:'sb',modeloId:'model'},
 {action:'ASSIGN_MILITARY',guarnicaoId:'ca',militarId:'mb',funcao_operacional:'AUXILIAR'},
 {action:'REMOVE_ASSIGNMENT',id:'eb'},{action:'REMOVE_CREW',id:'cb'},
 {action:'PUBLISH_SCALE',id:'sb'},{action:'CANCEL_SCALE',id:'sb'}
])test('escala rejeita referência externa: '+payload.action,async()=>{const h=harness();const r=await h.call('scales',payload);assert.equal(r.status,403);assert.equal(h.writes.length,0);});
for(const payload of [
 {action:'TOGGLE',tipo:'quartel',id:'qb'},{action:'TOGGLE',tipo:'ala',id:'ab'},
 {action:'SAVE',tipo:'quartel',id:'qb',data:{nome:'Fixture',tipo:'QUARTEL',estrutura_id:'ua'}},
 {action:'SAVE',tipo:'quartel',data:{nome:'Fixture',tipo:'QUARTEL',estrutura_id:'ub'}},
 {action:'SAVE',tipo:'ala',data:{nome:'Fixture',quartel_posto_id:'qb'}},
 {action:'TOGGLE',tipo:'modelo',id:'model'},
 {action:'SAVE',tipo:'empenho',data:{nome:'Fixture',tipo:'OUTRA',data_inicio:'2026-10-04',data_fim:'2026-10-05',status:'PLANEJADO'}}
])test('cadastro rejeita escopo externo/gestão global: '+payload.action+'/'+payload.tipo,async()=>{const h=harness();const r=await h.call('catalog',payload);assert.equal(r.status,403);assert.equal(h.writes.length,0);});
test('escopo global não concede permissão funcional de gerir',async()=>{const h=harness({global:true,manage:false});assert.equal((await h.call('scales',{action:'CANCEL_SCALE',id:'sb'})).status,403);assert.equal(h.writes.length,0);});
test('gestor global autorizado mantém operações e lista todas as unidades',async()=>{const h=harness({global:true});assert.equal((await h.call('scales',{action:'LIST'})).body.militares.length,2);assert.equal((await h.call('scales',{action:'CANCEL_SCALE',id:'sb'})).status,200);});
test('gestor da unidade mantém criação de escala própria',async()=>{const h=harness();const r=await h.call('scales',{action:'CREATE_SCALE',data:{data_inicio:'2026-10-04',quartel_posto_id:'qa',ala_grupo_id:'aa'}});assert.equal(r.status,200);assert.equal(h.writes.length,1);});
test('escopo vazio não herda acesso global nem a quartel sem estrutura',async()=>{const h=harness();h.auth.acessos=[];h.auth.scope={tipo:'vazio'};const r=await h.call('scales',{action:'LIST'});assert.equal(r.body.escalas.length,0);});
test('erro do serviço de escopo falha fechado',async()=>{const h=harness({scopeFailure:true});const r=await h.call('scales',{action:'LIST'});assert.equal(r.status,503);assert.equal(h.writes.length,0);});
test('guarnição própria com militar externo não pode ser removida ou publicada silenciosamente',async()=>{for(const payload of [{action:'REMOVE_CREW',id:'ca'},{action:'PUBLISH_SCALE',id:'sa'}]){const h=harness();h.db.EscalaMilitar[0].militar_id='mb';const r=await h.call('scales',payload);assert.equal(r.status,403);assert.equal(h.writes.length,0);}});
test('relação de escala e guarnição inconsistente impede remoção',async()=>{const h=harness();h.db.EscalaMilitar[0].escala_servico_id='sb';const r=await h.call('scales',{action:'REMOVE_ASSIGNMENT',id:'ea'});assert.equal(r.status,409);assert.equal(h.writes.length,0);});
for(const input of ['2026-02-31','2026-02-29','2026-13-01','2026-00-01'])test('data impossível é recusada: '+input,async()=>{const h=harness({global:true});const r=await h.call('scales',{action:'CREATE_SCALE',data:{data_inicio:input,quartel_posto_id:'qa',ala_grupo_id:'aa'}});assert.equal(r.status,400);assert.equal(h.writes.length,0);});
test('data bissexta válida é aceita',async()=>{const h=harness();assert.equal((await h.call('scales',{action:'CREATE_SCALE',data:{data_inicio:'2028-02-29',quartel_posto_id:'qa',ala_grupo_id:'aa'}})).status,200);});
