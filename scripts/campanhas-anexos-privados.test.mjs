import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { buildSync } from 'esbuild';
import { hashPortalToken } from '../base44/shared/portal/portalCrypto.ts';
const code=buildSync({entryPoints:['base44/functions/portal_servicos/entry.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['npm:*']}).outputFiles[0].text;
const token='b'.repeat(64),tokenHash=await hashPortalToken(token);
function harness({admin=false,storageFailure=false,registryFailure=false,seed={}}={}){
 const privateUploads=[],signed=[],publicUploads=[];
 const db={
  PortalSessao:[{id:'session',token_hash:tokenHash,status:'ATIVA',militar_id:'ma',absolute_expires_at:new Date(Date.now()+3600000).toISOString(),last_activity_at:new Date().toISOString()}],
  Militar:[{id:'ma',nome_completo:'Fixture A',status_cadastro:'Ativo'},{id:'mb',nome_completo:'Fixture B',status_cadastro:'Ativo'}],
  CampanhaPortal:[{id:'campaign',tipo:'FORMULARIO_DINAMICO',status:'ABERTA_COLETA',tipo_escopo:'TODOS',config_formulario:JSON.stringify({campos:[{id:'question',tipo:'upload_arquivo',pergunta:'Fixture',obrigatorio:true}]})}],
  PortalAuthConfig:[],PortalAnexo:[],RespostaCampanhaPersonalizada:[],...seed
 };
 const matches=(r,q)=>Object.entries(q||{}).every(([k,v])=>r[k]===v);
 const entities=new Proxy({}, {get:(_,name)=>({filter:async q=>structuredClone((db[name]||[]).filter(r=>matches(r,q))),list:async()=>structuredClone(db[name]||[]),get:async id=>structuredClone((db[name]||[]).find(r=>r.id===id)||null),update:async(id,p)=>{const row=(db[name]||[]).find(r=>r.id===id);Object.assign(row,p);return row;},create:async p=>{if(name==='PortalAnexo'&&registryFailure)throw Error('fixture registry failure');const row={id:name+'-'+(db[name]?.length||0),...structuredClone(p)};(db[name]||=[]).push(row);return row;}})});
 const client={auth:{me:async()=>admin?{id:'admin-fixture',role:'admin',email:'fixture@example.invalid'}:{id:'user-fixture',role:'user',email:'fixture@example.invalid'}},asServiceRole:{entities,integrations:{Core:{
  UploadFile:async p=>{publicUploads.push(p);throw Error('Public upload forbidden');},
  UploadPrivateFile:async p=>{if(storageFailure)throw Error('fixture private storage failure');privateUploads.push(p);return {file_uri:'private/fixture/'+privateUploads.length+'.pdf'};},
  CreateFileSignedUrl:async p=>{signed.push(p);return {signed_url:'https://fixture.invalid/signed/'+signed.length};}
 }}},functions:{invoke:async()=>({data:{isAdminByRole:admin,hasGlobalScope:admin,modules:{campanhas:true},actions:{}}})}};
 let handler;vm.runInNewContext(code,{require:()=>({createClientFromRequest:()=>client}),Deno:{serve:fn=>handler=fn,env:{get:()=>undefined}},Request,Response,File,TextEncoder,TextDecoder,Uint8Array,URL,crypto:webcrypto,console:{warn(){},error(){},info(){}}});
 const call=async(payload,{noToken=false,form=false}={})=>{
  const headers=noToken?{}:{'X-Portal-Token':token};
  if(!form)headers['Content-Type']='application/json';
  const req=new Request('https://fixture.invalid/functions/portal_servicos',{method:'POST',headers,body:form?payload:JSON.stringify(payload)});
  const res=await handler(req);return {status:res.status,body:await res.json()};
 };
 const upload=async({campaign='campaign',field='question',name='fixture.pdf',bytes='%PDF-1.7 fixture',noToken=false,extra={}}={})=>{
  const f=new FormData();f.set('acao','CAMPANHA_ANEXO_ENVIAR');f.set('campanha_id',campaign);f.set('campo_id',field);f.set('file',new File([bytes],name,{type:'application/pdf'}));for(const [k,v] of Object.entries(extra))f.set(k,v);
  return call(f,{form:true,noToken});
 };
 return {db,call,upload,privateUploads,signed,publicUploads};
}
test('novo upload passa pela sessão, usa storage privado e registra propriedade',async()=>{const h=harness();const r=await h.upload();assert.equal(r.status,201);assert.ok(r.body.url.startsWith('private/'));assert.equal(h.privateUploads.length,1);assert.equal(h.publicUploads.length,0);assert.equal(h.db.PortalAnexo[0].militar_id,'ma');assert.equal(h.db.PortalAnexo[0].campo_id,'question');assert.equal(h.signed[0].expires_in,300);});
test('upload anônimo não toca armazenamento',async()=>{const h=harness();assert.equal((await h.upload({noToken:true})).status,401);assert.equal(h.privateUploads.length,0);});
test('militar fora do público-alvo não envia arquivo',async()=>{const h=harness();h.db.CampanhaPortal[0].tipo_escopo='SELECAO_MILITARES';h.db.CampanhaPortal[0].escopo_militares_ids=['mb'];assert.equal((await h.upload()).status,403);assert.equal(h.privateUploads.length,0);});
test('campanha encerrada e pergunta inexistente impedem upload',async()=>{const h=harness();assert.equal((await h.upload({field:'foreign'})).status,400);h.db.CampanhaPortal[0].status='ENCERRADA';assert.equal((await h.upload()).status,403);assert.equal(h.privateUploads.length,0);});
test('multipart não aceita militar_id informado pelo cliente',async()=>{const h=harness();assert.equal((await h.upload({extra:{militar_id:'mb'}})).status,400);assert.equal(h.privateUploads.length,0);});
test('formato não permitido não é enviado ao storage',async()=>{const h=harness();assert.equal((await h.upload({name:'fixture.exe'})).status,400);assert.equal(h.privateUploads.length,0);});
test('arquivo maior que 15MB é recusado',async()=>{const h=harness();assert.equal((await h.upload({bytes:new Uint8Array(15*1024*1024+1)})).status,400);assert.equal(h.privateUploads.length,0);});
test('falha de storage ou registro não informa upload concluído',async()=>{for(const opts of [{storageFailure:true},{registryFailure:true}]){const h=harness(opts);const r=await h.upload();assert.equal(r.status,500);assert.equal(r.body.url,undefined);assert.equal(h.signed.length,0);}});
test('submissão grava URI estável e elimina assinatura temporária dos metadados',async()=>{const h=harness();const u=await h.upload();const r=await h.call({acao:'CAMPANHA_FORMULARIO_SUBMETER',campanha_id:'campaign',respostas_json:{},arquivos_anexados_json:{question:{...u.body}}});assert.equal(r.status,201);const stored=JSON.parse(h.db.RespostaCampanhaPersonalizada[0].arquivos_anexados_json).question;assert.equal(stored.url,u.body.url);assert.equal(stored.signed_url,undefined);assert.equal(stored.ok,undefined);});
test('URI de outro militar, campanha ou campo não pode ser vinculada',async()=>{for(const patch of [{militar_id:'mb'},{campanha_id:'other'},{campo_id:'other'}]){const h=harness();const u=await h.upload();Object.assign(h.db.PortalAnexo[0],patch);const r=await h.call({acao:'CAMPANHA_FORMULARIO_SUBMETER',campanha_id:'campaign',arquivos_anexados_json:{question:{url:u.body.url,nome:'fixture.pdf',tamanho:10}}});assert.equal(r.status,403);assert.equal(h.db.RespostaCampanhaPersonalizada.length,0);}});
test('link privado é renovado após autorização, nunca para referência arbitrária',async()=>{const h=harness();const u=await h.upload();const r=await h.call({acao:'CAMPANHA_ANEXO_LINK',campanha_id:'campaign',campo_id:'question',file_uri:u.body.url});assert.equal(r.status,200);assert.equal(h.signed.length,2);const before=h.signed.length;const foreign=await h.call({acao:'CAMPANHA_ANEXO_LINK',campanha_id:'campaign',campo_id:'question',file_uri:'private/foreign.pdf'});assert.equal(foreign.status,403);assert.equal(h.signed.length,before);});
test('leitura do formulário mantém URI para reenvio e retorna link temporário separado',async()=>{const h=harness();const u=await h.upload();await h.call({acao:'CAMPANHA_FORMULARIO_SUBMETER',campanha_id:'campaign',arquivos_anexados_json:{question:{url:u.body.url,nome:'fixture.pdf',tamanho:10}}});const r=await h.call({acao:'CAMPANHA_FORMULARIO_OBTER',campanha_id:'campaign'});assert.equal(r.status,200);const file=r.body.resposta_existente.arquivos_anexados.question;assert.equal(file.url,u.body.url);assert.ok(file.signed_url.startsWith('https://'));});
test('anexo público novo é recusado, mas referência legada própria continua válida',async()=>{const h=harness();const url='https://base44.app/api/apps/694014f8539e0b317aa75a23/files/public/fixture.pdf';const payload={acao:'CAMPANHA_FORMULARIO_SUBMETER',campanha_id:'campaign',arquivos_anexados_json:{question:{url,nome:'fixture.pdf',tamanho:10}}};assert.equal((await h.call(payload)).status,400);h.db.RespostaCampanhaPersonalizada.push({id:'old',campanha_id:'campaign',militar_id:'ma',arquivos_anexados_json:JSON.stringify(payload.arquivos_anexados_json)});assert.equal((await h.call(payload)).status,201);assert.equal(h.publicUploads.length,0);});
test('download administrativo sem capacidade não gera assinatura',async()=>{const h=harness();const r=await h.call({acao:'CAMPANHA_ANEXOS_RETORNO',campanha_id:'campaign'});assert.equal(r.status,403);assert.equal(h.signed.length,0);});
test('registro de anexos é fechado por RLS para as quatro operações',()=>{const schema=JSON.parse(fs.readFileSync('base44/entities/PortalAnexo.jsonc','utf8'));assert.deepEqual(schema.rls,{create:false,read:false,update:false,delete:false});});
