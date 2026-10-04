import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { buildSync } from 'esbuild';
import { hashPortalToken, hashOtp } from '../base44/shared/portal/portalCrypto.ts';
const pepper='fixture-only-not-a-production-secret';
const compile=entry=>buildSync({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',write:false,external:['npm:*','@/lib/app-params','@/api/base44Client']}).outputFiles[0].text;
const guardCode=compile('base44/shared/portal/requirePortalSession.ts');
const authCode=compile('base44/functions/portal_auth/entry.ts');
function runtime(extra={}) { return {crypto:webcrypto,TextEncoder,Response,Request,Date,console:{warn(){},error(){},info(){}},...extra}; }
const token='a'.repeat(64);
const tokenHash=await hashPortalToken(token);
const future=()=>new Date(Date.now()+3600000).toISOString();
const past=()=>new Date(Date.now()-1000).toISOString();
async function guard(session,failUpdate=false){
  const updates=[];const audits=[];
  const client={asServiceRole:{entities:{PortalSessao:{filter:async()=>[{id:'fixture-session',token_hash:tokenHash,status:'ATIVA',militar_id:'fixture-military',last_activity_at:new Date().toISOString(),...session}],update:async(id,p)=>{updates.push(p);if(failUpdate)throw Error('fixture storage failure');return {id,...p};}},PortalAuditoria:{create:async p=>{audits.push(p);return p;}}}}};
  const module={exports:{}};vm.runInNewContext(guardCode,runtime({module,exports:module.exports}));
  const result=await module.exports.requirePortalSession(new Request('https://fixture.invalid',{headers:{'X-Portal-Token':token}}),client);
  return {result,updates,audits};
}
test('legacy expires_at vencido é recusado mesmo com atividade recente',async()=>{const h=await guard({expires_at:past()});assert.equal(h.result.status,401);assert.equal(h.result.ok,false);});
test('legacy expires_at futuro permanece utilizável sem estender a validade',async()=>{const deadline=future();const h=await guard({expires_at:deadline});assert.equal(h.result.ok,true);assert.ok(h.updates.every(p=>!p.expires_at&&!p.absolute_expires_at&&!p.token_expires_at));});
test('a menor validade sempre prevalece, inclusive quando campos canônicos são futuros',async()=>{const h=await guard({expires_at:past(),absolute_expires_at:future(),token_expires_at:future()});assert.equal(h.result.status,401);});
test('validade inválida ou ausente falha fechada',async()=>{for(const s of [{expires_at:'not-a-date'},{absolute_expires_at:future(),expires_at:'not-a-date'},{}])assert.equal((await guard(s)).result.status,401);});
test('expiração permanece 401 mesmo quando não é possível marcar o registro expirado',async()=>{const h=await guard({absolute_expires_at:past()},true);assert.equal(h.result.status,401);assert.equal(h.result.ok,false);});
test('sessão canônica válida funciona e inatividade continua sendo limitada',async()=>{assert.equal((await guard({absolute_expires_at:future(),token_expires_at:future()})).result.ok,true);assert.equal((await guard({absolute_expires_at:future(),last_activity_at:new Date(Date.now()-31*60000).toISOString()})).result.status,401);});
async function auth(acao,{failure=false,expiry=future()}={}){
  let handler;const updates=[],audits=[];
  const session={id:'fixture-session',request_id:'fixture-request-id-123456',status:'CRIADA_AGUARDANDO_OTP',militar_id:'fixture-military',otp_hash:await hashOtp('123456','',pepper),otp_expires_at:expiry,otp_attempts:0};
  const client={asServiceRole:{entities:{
    PortalAuthConfig:{filter:async()=>[{ativo:true,provisional_cpf_matricula_enabled:true}]},
    PortalSessao:{filter:async()=>[session],update:async(id,p)=>{if(failure)throw Error('fixture write failure');updates.push(p);return {id,...session,...p};}},
    Militar:{get:async()=>({id:'fixture-military',matricula:'FIXTURE123',status_cadastro:'Ativo'})},
    MatriculaMilitar:{filter:async()=>[]},
    PortalAuditoria:{create:async p=>{audits.push(p);return p;}}
  }}};
  vm.runInNewContext(authCode,runtime({require:()=>({createClientFromRequest:()=>client}),Deno:{serve:fn=>handler=fn,env:{get:k=>k==='PORTAL_OTP_PEPPER'?pepper:undefined}}}));
  const res=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,request_id:session.request_id,otp:'123456',matricula:'FIXTURE123'})}));
  return {status:res.status,body:await res.json(),updates,audits};
}
for(const acao of ['VALIDAR','AUTENTICAR_PROVISORIO']){
  test(acao+': só entrega token depois de persistir a sessão com prazos canônicos',async()=>{const h=await auth(acao);assert.equal(h.status,200);assert.ok(h.body.token);const p=h.updates.find(x=>x.status==='ATIVA');assert.ok(p);assert.equal(p.absolute_expires_at,p.token_expires_at);assert.equal(p.expires_at,p.absolute_expires_at);assert.equal(new Date(p.absolute_expires_at)-new Date(p.last_activity_at),4*3600000);assert.ok(!JSON.stringify(p).includes(h.body.token));});
  test(acao+': falha na persistência não retorna token nem auditoria de sucesso',async()=>{const h=await auth(acao,{failure:true});assert.equal(h.status,503);assert.equal(h.body.token,undefined);assert.ok(!h.audits.some(x=>x.acao==='LOGIN_SUCESSO'));});
}
test('OTP com prazo malformado é recusado',async()=>{const h=await auth('VALIDAR',{expiry:'not-a-date'});assert.equal(h.status,401);assert.equal(h.body.token,undefined);});
const clientCode=compile('src/portal/api/PortalApiClient.js');
function portalHarness({status=500,networkError=false,hasDirect=true,abort=false}={}){
  let direct=0,sdk=0;const storage=new Map([['sgp_portal_token',token]]);
  const window={sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
  const fetch=async()=>{direct++;if(networkError||abort){const e=Error('fixture network failure');e.name=abort?'AbortError':'TypeError';throw e;}return new Response(JSON.stringify({error:'fixture failure'}),{status});};
  if(hasDirect)window.fetch=fetch;
  const module={exports:{}};
  vm.runInNewContext(clientCode,runtime({module,exports:module.exports,window,fetch,AbortController,setTimeout,clearTimeout,require:name=>name.includes('app-params')?{appParams:{serverUrl:'https://fixture.invalid',appId:'fixture'}}:{base44:{functions:{invoke:async()=>{sdk++;return {data:{ok:true}};}}}}}));
  return {call:()=>module.exports.portalFetch('portal_servicos',{acao:'FIXTURE_COMMAND'}),counts:()=>({direct,sdk}),storage};
}
for(const status of [400,401,403,404,405,409,422,429,500,503]){
  test('HTTP '+status+' não provoca segunda execução pelo SDK',async()=>{const h=portalHarness({status});await assert.rejects(h.call(),e=>e.status===status);assert.deepEqual(h.counts(),{direct:1,sdk:0});if(status===401)assert.equal(h.storage.size,0);});
}
test('falha de rede depois do envio não provoca repetição automática',async()=>{const h=portalHarness({networkError:true});await assert.rejects(h.call());assert.deepEqual(h.counts(),{direct:1,sdk:0});});
test('timeout não provoca repetição automática',async()=>{const h=portalHarness({abort:true});await assert.rejects(h.call(),e=>e.status===408);assert.deepEqual(h.counts(),{direct:1,sdk:0});});
test('SDK continua disponível quando o transporte direto não existe',async()=>{const h=portalHarness({hasDirect:false});assert.equal((await h.call()).ok,true);assert.deepEqual(h.counts(),{direct:0,sdk:1});});
function allows(rule,user){
  if(rule===false)return false;if(rule===true)return true;if(rule&&Object.keys(rule).length===0)return true;
  if(rule.$or)return rule.$or.some(x=>allows(x,user));
  if(rule.user_condition)return !!user&&Object.entries(rule.user_condition).every(([k,v])=>user[k]===v);
  throw Error('Regra não esperada no contrato de contenção');
}
for(const name of ['Militar','Atestado','CampanhaPortal','RespostaCampanhaPersonalizada']){
  test(name+': leitura rejeita anônimo e mantém os papéis autenticados',()=>{const schema=JSON.parse(fs.readFileSync('base44/entities/'+name+'.jsonc','utf8'));assert.ok(schema.rls?.read);assert.equal(allows(schema.rls.read,null),false);assert.equal(allows(schema.rls.read,{role:'admin'}),true);assert.equal(allows(schema.rls.read,{role:'user'}),true);});
}
