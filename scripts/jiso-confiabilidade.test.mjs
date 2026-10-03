import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { buildSync } from 'esbuild';
import { aplicarEfeitosJiso } from '../src/utils/jiso/jisoEffects.js';
import { montarAgendaJiso } from '../src/utils/jiso/montarAgendaJiso.js';

const gatewayCode = buildSync({ entryPoints: ['base44/functions/jisoGateway/entry.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['npm:*'] }).outputFiles[0].text;
const notificationSource = fs.readFileSync('base44/functions/notificarJisoWhatsAppTemplate/entry.ts','utf8').replace(/import \{ evolutionWhatsAppProvider \} from '[^']+';/, 'const evolutionWhatsAppProvider = globalThis.__provider;');
const notificationCode = buildSync({ stdin: { contents: notificationSource, loader: 'ts', resolveDir: process.cwd() + '/base44/functions/notificarJisoWhatsAppTemplate' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['npm:*'] }).outputFiles[0].text;
const rulesCode = buildSync({ entryPoints: ['base44/shared/jisoRules.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const matches = (row, query) => Object.entries(query || {}).every(([key,val]) => val && typeof val === 'object' && '$in' in val ? val.$in.includes(row[key]) : row[key] === val);
function harness({ actions = { gerir_jiso:true }, admin = false, seed = {}, blocked = [], authError = '', authenticatedRole = 'user', failures = {} } = {}) {
  const db = structuredClone({
    Atestado: [{ id:'a1',militar_id:'m1',militar_nome:'Fictício',data_inicio:'2026-09-01',data_termino:'2026-09-10',dias:10 },{ id:'a2',militar_id:'m1',data_inicio:'2026-09-11',data_termino:'2026-09-15',dias:5 }],
    Militar: [{ id:'m1',nome_completo:'Fictício',whatsapp:'0000000000' }],
    JISO: [{id:'j1',militar_id:'m1',status:'Agendada',data_jiso:'2026-09-20',hora_jiso:'09:00',local_jiso:'Quartel',parecer_jiso:'parecer privado',versao:1}],
    JISOAtestado: [{id:'l1',jiso_id:'j1',atestado_id:'a1',militar_id:'m1',tipo_vinculo:'Principal',ordem:1,status:'Ativo'}],
    TemplateTexto: [{ id:'t1',modulo:'WhatsApp Notificações',tipo_registro:'Notificação de JISO WA',ativo:true,template:'{{nome_completo}} {{data_jiso}} {{hora_jiso}} {{local_jiso}}',escopo:'GLOBAL' }],
    ...seed,
  });
  const entities = new Proxy({}, { get(_, name) {
    db[name] ||= [];
    const check = op => { const key=name+'.'+op; if(failures[key]) { failures[key]--; throw Error('Falha simulada '+key); } };
    return {
      filter: async (q={}, sort, limit=500, skip=0) => {
        let rows=db[name].filter(row=>matches(row,q));
        if(sort) {const key=sort.replace(/^-/,'');const sign=sort.startsWith('-')?-1:1;rows=[...rows].sort((a,b)=>sign*(a[key]>b[key]?1:a[key]<b[key]?-1:0));}
        return structuredClone(rows.slice(skip,skip+limit));
      },
      list: async () => structuredClone(db[name]),
      create: async data => {check('create'); const row={...structuredClone(data),id:String(name)+'-'+(db[name].length+1),created_date:new Date().toISOString()};db[name].push(row);return structuredClone(row);},
      update: async (id, patch) => {check('update');const row=db[name].find(r=>r.id===id);assert.ok(row,'Missing '+name+' '+id);Object.assign(row,structuredClone(patch));return structuredClone(row);},
      delete: async id => {check('delete');db[name]=db[name].filter(r=>r.id!==id);},
    };
  } });
  const client = {
    auth:{ me:async()=>({id:'u1',email:'audit@example.invalid',role:authenticatedRole}) },
    asServiceRole:{ entities },
    functions:{invoke:async(name,payload)=>{
      assert.equal(name,'getUserPermissions');
      const requested=payload.scopeMilitarIds||[];
      return {data:authError ? {error:authError} : {isAdmin:admin,modules:{atestados:true},actions,effectiveUserEmail:payload.effectiveEmail||'audit@example.invalid',scopeCheck:{allowedIds:requested.filter(id=>!blocked.includes(id)),allAllowed:requested.every(id=>!blocked.includes(id))}}};
    }},
  };
  let handler, sent=0;
  const context = { require:()=>({createClientFromRequest:()=>client}), Deno:{serve:fn=>handler=fn}, Response, console:{info(){},warn(){},error(){}}, crypto:webcrypto, TextEncoder,
    __provider:{sendTextMessage:async()=>{sent++;return {success:true};}} };
  vm.runInNewContext(gatewayCode,context);
  const call=async payload=>{const res=await handler({json:async()=>payload,method:'POST'});return {status:res.status,body:await res.json()};};
  const useNotification=()=>vm.runInNewContext(notificationCode,context);
  const module={exports:{}};vm.runInNewContext(rulesCode,{module,exports:module.exports,console});
  return {db,call,useNotification,rules:module.exports,client,get sent(){return sent;}};
}

test('gestor não cria decisão e não deixa processo órfão',async()=>{
  const h=harness();const r=await h.call({acao:'CRIAR',atestado_ids:['a2'],jiso:{resultado_jiso:'Inapto',parecer_jiso:'privado'}});
  assert.equal(r.status,403);assert.equal(h.db.JISO.length,1);
});
test('conflito de atestado é verificado antes de criar a JISO',async()=>{
  const h=harness();const r=await h.call({acao:'CRIAR',atestado_ids:['a1'],jiso:{}});
  assert.equal(r.status,409);assert.equal(h.db.JISO.length,1);
});
test('falha de criação do vínculo desfaz a JISO nova',async()=>{
  const h=harness({failures:{'JISOAtestado.create':1}});const r=await h.call({acao:'CRIAR',atestado_ids:['a2'],jiso:{}});
  assert.equal(r.status,500);assert.equal(h.db.JISO.length,1);assert.equal(h.db.JISOAtestado.length,1);
});
test('criação nativa aceita vários atestados do mesmo militar',async()=>{
  const h=harness({seed:{JISO:[],JISOAtestado:[]}});const r=await h.call({acao:'CRIAR',atestado_ids:['a1','a2'],jiso:{data_jiso:'2026-10-20',hora_jiso:'09:00'}});
  assert.equal(r.status,200);assert.equal(r.body.jiso.atestados.length,2);assert.equal(r.body.jiso.status,'Agendada');
});
test('criação com data sem hora permanece aguardando agendamento',async()=>{
  const h=harness({seed:{JISO:[],JISOAtestado:[]}});const r=await h.call({acao:'CRIAR',atestado_ids:['a1'],jiso:{data_jiso:'2026-10-20'}});
  assert.equal(r.status,200);assert.equal(r.body.jiso.status,'Aguardando Agendamento');
});
test('militares diferentes não entram no mesmo processo',async()=>{
  const h=harness({seed:{Atestado:[{id:'a1',militar_id:'m1'},{id:'a2',militar_id:'m2'}],JISO:[],JISOAtestado:[]}});
  assert.equal((await h.call({acao:'CRIAR',atestado_ids:['a1','a2'],jiso:{}})).status,422);
  assert.equal(h.db.JISO.length,0);
});
test('listagem e detalhe ocultam parecer e mensagem sem permissão sensível',async()=>{
  const h=harness({seed:{JISONotificacao:[{id:'n1',jiso_id:'j1',mensagem:'conteúdo privado',destinatario:'000',status:'Enviada'}]}});
  const list=await h.call({acao:'LISTAR'});assert.equal(list.status,200);assert.equal(list.body.jisos[0].parecer_jiso,undefined);
  const detail=await h.call({acao:'DETALHAR',jiso_id:'j1'});assert.equal(detail.body.jiso.parecer_jiso,undefined);assert.equal(detail.body.jiso.notificacoes[0].mensagem,undefined);assert.equal(detail.body.jiso.notificacoes[0].destinatario,undefined);
});
test('admin autenticado não transfere privilégios ao usuário efetivo',async()=>{
  const h=harness({actions:{visualizar_atestados:true},authenticatedRole:'admin'});
  assert.equal((await h.call({acao:'ATUALIZAR',jiso_id:'j1',effectiveEmail:'other@example.invalid',jiso:{parecer_jiso:'novo'}})).status,403);
});
test('falha na autorização é fechada e escopo é respeitado',async()=>{
  const h=harness({authError:'negado'});assert.equal((await h.call({acao:'LISTAR'})).status,403);
  const scoped=harness({blocked:['m1']});assert.equal((await scoped.call({acao:'DETALHAR',jiso_id:'j1'})).status,403);assert.equal((await scoped.call({acao:'LISTAR'})).body.jisos.length,0);
});
test('processos concluídos e cancelados rejeitam alterações',async()=>{
  for(const status of ['Concluída','Cancelada']){
    const h=harness({seed:{JISO:[{id:'j1',militar_id:'m1',status,versao:1}]}});
    for(const acao of ['ATUALIZAR','VINCULAR_ATESTADOS','REMOVER_VINCULO','CANCELAR']) assert.equal((await h.call({acao,jiso_id:'j1',jiso:{status:'Agendada'},atestado_ids:['a2'],atestado_id:'a1',motivo:'teste'})).status,409);
  }
});
test('versão antiga e regressão de etapa são rejeitadas',async()=>{
  const h=harness();assert.equal((await h.call({acao:'ATUALIZAR',jiso_id:'j1',versao:0,jiso:{local_jiso:'outro'}})).status,409);
  const decided=harness({admin:true,seed:{JISO:[{id:'j1',militar_id:'m1',status:'Resultado Registrado',resultado_jiso:'Homologado',versao:1}]}});
  assert.equal((await decided.call({acao:'ATUALIZAR',jiso_id:'j1',jiso:{status:'Agendada',data_jiso:'2026-10-20',hora_jiso:'09:00'}})).status,409);
});
test('datas, horários, dias e resultado obrigatório são validados',async()=>{
  const h=harness({admin:true});
  for(const jiso of [{data_jiso:'2026-02-30'},{hora_jiso:'27:00'},{dias_jiso:-1},{dias_jiso:1.5},{status:'Resultado Registrado'}]) assert.equal((await h.call({acao:'ATUALIZAR',jiso_id:'j1',jiso})).status,422);
});
test('gestor não encerra por status e decisor não muda agendamento',async()=>{
  const h=harness();assert.equal((await h.call({acao:'ATUALIZAR',jiso_id:'j1',jiso:{status:'Concluída'}})).status,409);
  const d=harness({actions:{registrar_decisao_jiso:true}});assert.equal((await d.call({acao:'ATUALIZAR',jiso_id:'j1',jiso:{local_jiso:'outro'}})).status,403);
});
test('publicação sem resultado é rejeitada',async()=>{
  const h=harness({actions:{publicar_ata_jiso:true}});
  assert.equal((await h.call({acao:'PUBLICAR_ATA',jiso_id:'j1',publicacao:{texto_publicacao:'ata'}})).status,422);
  assert.equal(h.db.PublicacaoExOfficio?.length||0,0);
});
const decidedSeed={JISO:[{id:'j1',militar_id:'m1',status:'Resultado Registrado',resultado_jiso:'Homologado',numero_ata:'12',versao:1}]};
test('publicação pendente mantém processo aberto e impede duplicação',async()=>{
  const h=harness({actions:{publicar_ata_jiso:true},seed:decidedSeed});
  const r=await h.call({acao:'PUBLICAR_ATA',jiso_id:'j1',publicacao:{texto_publicacao:'ata',nota_para_bg:'14'}});
  assert.equal(r.status,200);assert.equal(h.db.JISO[0].status,'Resultado Registrado');assert.equal(h.db.JISO[0].status_publicacao,'Aguardando Publicação');
  assert.equal((await h.call({acao:'PUBLICAR_ATA',jiso_id:'j1',publicacao:{texto_publicacao:'ata'}})).status,409);
});
test('BG exige os dois campos e permissão específica',async()=>{
  const h=harness({actions:{publicar_ata_jiso:true},seed:decidedSeed});
  assert.equal((await h.call({acao:'PUBLICAR_ATA',jiso_id:'j1',publicacao:{texto_publicacao:'ata',numero_bg:'20'}})).status,422);
  assert.equal((await h.call({acao:'PUBLICAR_ATA',jiso_id:'j1',publicacao:{texto_publicacao:'ata',numero_bg:'20',data_bg:'2026-10-03'}})).status,403);
});
test('falha de atualização da JISO desfaz a publicação recém-criada',async()=>{
  const h=harness({actions:{publicar_ata_jiso:true},seed:decidedSeed,failures:{'JISO.update':1}});
  assert.equal((await h.call({acao:'PUBLICAR_ATA',jiso_id:'j1',publicacao:{texto_publicacao:'ata'}})).status,500);assert.equal(h.db.PublicacaoExOfficio.length,0);
});
test('publicar BG conclui e revogar a ata reabre o fluxo',async()=>{
  const h=harness({seed:{...decidedSeed,PublicacaoExOfficio:[{id:'p1',jiso_id:'j1',tipo:'Ata JISO',numero_bg:'12',data_bg:'2026-10-03'}]}});
  await h.rules.syncJisoPublication(h.client,h.db.PublicacaoExOfficio[0]);assert.equal(h.db.JISO[0].status,'Concluída');
  h.db.PublicacaoExOfficio[0].foi_tornada_sem_efeito=true;
  await h.rules.syncJisoPublication(h.client,h.db.PublicacaoExOfficio[0]);assert.equal(h.db.JISO[0].status,'Resultado Registrado');assert.equal(h.db.JISO[0].publicacao_id,'');
});
test('ata legada ativa impede publicação duplicada',async()=>{
  const h=harness({actions:{publicar_ata_jiso:true},seed:{...decidedSeed,PublicacaoExOfficio:[{id:'p1',militar_id:'m1',tipo:'Ata JISO',atestados_jiso_ids:['a1']}]}});
  const r=await h.call({acao:'PUBLICAR_ATA',jiso_id:'j1',publicacao:{texto_publicacao:'ata'}});assert.equal(r.status,409);assert.equal(r.body.code,'ATA_LEGADO_EXISTENTE');
});
test('atestado principal é mantido na ordem do vínculo',async()=>{
  const h=harness({admin:true,seed:{JISOAtestado:[{id:'l2',jiso_id:'j1',atestado_id:'a2',militar_id:'m1',tipo_vinculo:'Principal',ordem:1,status:'Ativo'},{id:'l1',jiso_id:'j1',atestado_id:'a1',militar_id:'m1',tipo_vinculo:'Complementar',ordem:2,status:'Ativo'}]}});
  assert.equal((await h.call({acao:'DETALHAR',jiso_id:'j1'})).body.jiso.atestados[0].id,'a2');
  await h.call({acao:'REMOVER_VINCULO',jiso_id:'j1',atestado_id:'a2',motivo:'teste'});
  assert.equal(h.db.JISOAtestado.find(l=>l.id==='l1').tipo_vinculo,'Principal');
});
test('efeito de uma JISO é contado uma vez sem alterar os atestados',()=>{
  const orig=[{id:'a1',dias:10,jiso_efeito:{id:'j1',dias:20,data_inicio:'2026-09-01',data_termino:'2026-09-20',data_retorno:'2026-09-21'}},{id:'a2',dias:5,jiso_efeito:{id:'j1',dias:20,data_inicio:'2026-09-01',data_termino:'2026-09-20',data_retorno:'2026-09-21'}}];
  const result=aplicarEfeitosJiso(orig);assert.equal(result.length,1);assert.equal(result[0].dias,20);assert.equal(orig[0].dias,10);
  assert.equal(aplicarEfeitosJiso([{id:'a1',jiso_efeito:{id:'j1',dias:0}}]).length,0);
});
test('agenda não duplica atestados vinculados nem inclui processos finalizados',()=>{
  const jisos=[{id:'j1',status:'Agendada',data_jiso:'2026-10-10'},{id:'j2',status:'Concluída',data_jiso:'2026-10-11'}];
  const atestados=[{id:'a1',jiso_id_derivado:'j1',necessita_jiso:true,data_jiso_agendada:'2026-10-10'}];
  const result=montarAgendaJiso({jisos,atestados,hoje:new Date('2026-10-03T00:00:00')});assert.equal(result.length,1);assert.equal(result[0].id,'j1');
});
test('prévia WhatsApp usa dados salvos e inclui local',async()=>{
  const h=harness();h.useNotification();
  const r=await h.call({action:'preview',jiso_id:'j1',data_jiso:'2099-01-01'});assert.equal(r.status,200);assert.match(r.body.mensagem,/Quartel/);assert.equal(r.body.data_jiso_snapshot,'2026-09-20');assert.equal(h.sent,0);
});
test('WhatsApp bloqueia processos encerrados e o fluxo antigo pelo atestado',async()=>{
  const h=harness({seed:{JISO:[{id:'j1',militar_id:'m1',status:'Concluída',data_jiso:'2026-09-20',hora_jiso:'09:00'}]}});h.useNotification();
  assert.equal((await h.call({action:'preview',jiso_id:'j1'})).status,409);
  assert.equal((await h.call({action:'preview',atestado_id:'a1'})).status,410);assert.equal(h.sent,0);
});
test('WhatsApp confere local e bloqueia reenvio confirmado',async()=>{
  const h=harness();h.useNotification();const preview=(await h.call({action:'preview',jiso_id:'j1'})).body;
  const payload={action:'send',jiso_id:'j1',mensagem_final:preview.mensagem,template_id:preview.template_id,template_hash:preview.template_hash,data_jiso_snapshot:preview.data_jiso_snapshot,hora_jiso_snapshot:preview.hora_jiso_snapshot,local_jiso_snapshot:preview.local_jiso_snapshot};
  assert.equal((await h.call({...payload,local_jiso_snapshot:'outro'})).status,409);assert.equal(h.sent,0);
  assert.equal((await h.call(payload)).status,200);assert.equal(h.sent,1);
  assert.equal((await h.call(payload)).status,409);assert.equal(h.sent,1);
});
