import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function carregar(nome, client) {
  let handler;
  const context = vm.createContext({console,Response,Request,Intl,Date,Map,Set,Object,
    __client:client,Deno:{serve:fn => {handler=fn;}}});
  const utility = readFileSync('base44/functions/publicarPromocaoOficial/utils.ts','utf8')
    .replace(/export /g,'');
  const entry = readFileSync('base44/functions/'+nome+'/entry.ts','utf8')
    .replace(/^import .*;\n/gm,'');
  vm.runInContext(ts.transpileModule(
    "const createClientFromRequest = () => __client;\n"+utility+"\n"+entry,
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}
  ).outputText,context);
  return async body => {
    const response = await handler(new Request('https://test.local',{method:'POST',body:JSON.stringify({body}),headers:{'content-type':'application/json'}}));
    return {status:response.status,...await response.json()};
  };
}
function ambiente({fail=()=>{},posto='Soldado',data='2020-01-01'}={}) {
  const rows = {
    Militar:[{id:'m1',posto_graduacao:posto,quadro:'QBMP-1.a',status_cadastro:'ativo'}],
    Promocao:[{id:'p1',status:'rascunho',posto_graduacao:'Cabo',quadro:'QBMP-1.a',data_promocao:data,data_publicacao:'2020-01-01',ato_referencia:'Portaria 10',boletim_referencia:'BG 10'}],
    PromocaoMilitar:[{id:'i1',promocao_id:'p1',militar_id:'m1',ordem:1,status:'elegivel',publicado:false}],
    HistoricoPromocaoMilitarV2:[],AssistenteLog:[]
  };
  const operations=[];
  const entities=Object.fromEntries(Object.entries(rows).map(([name,list])=>[name,{
    get:async id=>{fail(name,'get','before',id); const found=list.find(r=>r.id===id); if(!found) throw Error('not found'); return structuredClone(found);},
    filter:async query=>structuredClone(list.filter(r=>Object.entries(query).every(([k,v])=>r[k]===v))),
    create:async patch=>{
      fail(name,'create','before',patch);
      const row={...structuredClone(patch),id:name+'-'+(list.length+1)};list.push(row);operations.push([name,'create']);
      fail(name,'create','after',row);return structuredClone(row);
    },
    update:async(id,patch)=>{
      fail(name,'update','before',patch);
      const row=list.find(r=>r.id===id);if(!row)throw Error('not found');
      Object.assign(row,structuredClone(patch));operations.push([name,'update',structuredClone(patch)]);
      fail(name,'update','after',patch);return structuredClone(row);
    }
  }]));
  const client={auth:{me:async()=>({role:'admin',email:'test@example.com'})},asServiceRole:{entities}};
  const publicar=carregar('publicarPromocaoOficial',client);
  const manter=carregar('sincronizarHistoricoPromocaoPublicadaTx',client);
  return {rows,operations,publicar,manter,
    payload:()=>({promocao_id:'p1',promocao:structuredClone(rows.Promocao[0]),itens:structuredClone(rows.PromocaoMilitar),temAlteracoesPendentes:false})};
}
test('publicação confirma vínculo antes do cadastro e mantém ato',async()=>{
  const a=ambiente();const r=await a.publicar(a.payload());
  assert.equal(r.success,true);assert.equal(a.rows.Militar[0].posto_graduacao,'Cabo');
  assert.equal(a.rows.HistoricoPromocaoMilitarV2[0].ato_referencia,'Portaria 10');
  const cadastral=a.operations.findIndex(([name])=>name==='Militar');
  const vinculo=a.operations.findIndex(([name,op,p])=>name==='PromocaoMilitar'&&op==='update'&&p.publicado===true);
  assert.ok(vinculo<cadastral);assert.equal(a.rows.Promocao[0].status,'publicada');
});
test('vigência futura ou data inválida não escreve nenhum registro',async()=>{
  for(const data of ['2099-01-01','2026-02-30']) {
    const a=ambiente({data});const r=await a.publicar(a.payload());
    assert.equal(r.success,false);assert.equal(a.operations.length,0);assert.equal(a.rows.Militar[0].posto_graduacao,'Soldado');
  }
});
test('lançamento de Soldado preserva Cabo e inicia carreira sem origem',async()=>{
  const a=ambiente({posto:'Cabo'});a.rows.Promocao[0].posto_graduacao='Soldado';
  const r=await a.publicar(a.payload());assert.equal(r.success,true);
  assert.equal(a.rows.Militar[0].posto_graduacao,'Cabo');
  assert.equal(a.rows.HistoricoPromocaoMilitarV2[0].posto_graduacao_anterior,'');
  assert.equal(a.rows.HistoricoPromocaoMilitarV2[0].quadro_anterior,'');
});
test('evento posterior preserva cadastro mesmo com graduação superior no lançamento antigo',async()=>{
  const a=ambiente();a.rows.HistoricoPromocaoMilitarV2.push({id:'h2',militar_id:'m1',data_promocao:'2021-01-01',posto_graduacao_novo:'Soldado',quadro_novo:'QBMP-1.a',status_registro:'ativo'});
  const r=await a.publicar(a.payload());assert.equal(r.success,true);assert.equal(a.rows.Militar[0].posto_graduacao,'Soldado');
});
test('falha ao confirmar vínculo compensa histórico e não toca cadastro',async()=>{
  let once=true;
  const a=ambiente({fail:(name,op,stage)=>{if(once&&name==='PromocaoMilitar'&&op==='update'&&stage==='after'){once=false;throw Error('resposta perdida');}}});
  const r=await a.publicar(a.payload());assert.equal(r.success,false);
  assert.equal(a.rows.Militar[0].posto_graduacao,'Soldado');assert.equal(a.rows.PromocaoMilitar[0].publicado,false);
  assert.equal(a.rows.HistoricoPromocaoMilitarV2[0].status_registro,'cancelado');assert.equal(r.errors[0].rollback_completo,true);
});
test('criação gravada com resposta perdida é neutralizada sem órfão ativo',async()=>{
  let once=true;const a=ambiente({fail:(name,op,stage)=>{if(once&&name==='HistoricoPromocaoMilitarV2'&&op==='create'&&stage==='after'){once=false;throw Error('timeout');}}});
  const r=await a.publicar(a.payload());assert.equal(r.success,false);
  assert.equal(a.rows.HistoricoPromocaoMilitarV2[0].status_registro,'cancelado');assert.equal(a.rows.Militar[0].posto_graduacao,'Soldado');
});
test('atualização cadastral gravada com resposta perdida é confirmada por releitura',async()=>{
  const a=ambiente({fail:(name,op,stage)=>{if(name==='Militar'&&op==='update'&&stage==='after')throw Error('timeout');}});
  const r=await a.publicar(a.payload());assert.equal(r.success,true);assert.equal(a.rows.Militar[0].posto_graduacao,'Cabo');
});
test('falha antes da gravação cadastral restaura vínculo e histórico',async()=>{
  let once=true;const a=ambiente({fail:(name,op,stage)=>{if(once&&name==='Militar'&&op==='update'&&stage==='before'){once=false;throw Error('indisponível');}}});
  const r=await a.publicar(a.payload());assert.equal(r.success,false);assert.equal(a.rows.Militar[0].posto_graduacao,'Soldado');assert.equal(a.rows.PromocaoMilitar[0].publicado,false);
});
test('falha no log final não desfaz publicação confirmada',async()=>{
  const a=ambiente({fail:(name,op)=>{if(name==='AssistenteLog'&&op==='update')throw Error('log indisponível');}});
  const r=await a.publicar(a.payload());assert.equal(r.success,true);assert.equal(a.rows.Militar[0].posto_graduacao,'Cabo');
});
test('repetição não duplica históricos nem reaplica cadastro',async()=>{
  const a=ambiente();assert.equal((await a.publicar(a.payload())).success,true);
  const writes=a.operations.length;await a.publicar(a.payload());
  assert.equal(a.operations.length,writes);assert.equal(a.rows.HistoricoPromocaoMilitarV2.length,1);
});
test('edição parcial preserva ato e boletim vazios e nunca altera militar',async()=>{
  const a=ambiente();await a.publicar(a.payload());const militarWrites=a.operations.filter(([n])=>n==='Militar').length;
  const r=await a.manter({promocao_id:'p1',patch_promocao:{ato_referencia:'',boletim_referencia:'',observacoes:'Conferido'}});
  assert.equal(r.success,true);assert.equal(a.rows.Promocao[0].ato_referencia,'Portaria 10');
  assert.equal(a.rows.HistoricoPromocaoMilitarV2[0].boletim_referencia,'BG 10');
  assert.equal(a.operations.filter(([n])=>n==='Militar').length,militarWrites);
});
test('tela desatualizada é recusada sem perder dados',async()=>{
  const a=ambiente();await a.publicar(a.payload());const writes=a.operations.length;
  const r=await a.manter({promocao_id:'p1',patch_promocao:{ato_referencia:'Portaria velha'},valores_anteriores:{ato_referencia:'Portaria antiga'}});
  assert.equal(r.status,409);assert.equal(a.operations.length,writes);
});
test('alteração de posto/data/quadro em publicação exige retificação',async()=>{
  const a=ambiente();await a.publicar(a.payload());const writes=a.operations.length;
  for(const patch of [{posto_graduacao:'Soldado'},{data_promocao:'2019-01-01'},{quadro:'QAOBM'}]){
    const r=await a.manter({promocao_id:'p1',patch_promocao:patch});assert.equal(r.status,409);
  }
  assert.equal(a.operations.length,writes);
});
test('falha documental após gravação restaura pai e filho',async()=>{
  let armed=false;let once=true;
  const a=ambiente({fail:(n,op,stage)=>{if(armed&&once&&n==='HistoricoPromocaoMilitarV2'&&op==='update'&&stage==='after'){once=false;throw Error('timeout');}}});
  await a.publicar(a.payload());armed=true;
  const r=await a.manter({promocao_id:'p1',patch_promocao:{ato_referencia:'Portaria 20'}});
  assert.equal(r.success,false);assert.equal(r.rollback_completo,true);
  assert.equal(a.rows.Promocao[0].ato_referencia,'Portaria 10');assert.equal(a.rows.HistoricoPromocaoMilitarV2[0].ato_referencia,'Portaria 10');
});
