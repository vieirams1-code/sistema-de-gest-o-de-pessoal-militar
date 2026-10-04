import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { unzipSync } from 'fflate';
import { baixarAnexosCampanhaZip } from '../../utils/portalCampanhasExport.js';

const source = fs.readFileSync('base44/functions/portal_servicos/entry.ts', 'utf8');
const sanitizer = source.slice(source.indexOf('function sanitizarItemAnexoCampanha'), source.indexOf('async function obterCampanhaGeralOuErro'));
const projection = source.slice(source.indexOf('function sanitizarRespostaCampanha'), source.indexOf('\n}', source.indexOf('function sanitizarRespostaCampanha')) + 2);
const ctx = vm.createContext({});
vm.runInContext(ts.transpile(sanitizer + projection), ctx);
const campaign = {tipo:'FORMULARIO_DINAMICO', titulo:'Teste', config_formulario:JSON.stringify({campos:[{id:'cert',tipo:'upload_arquivo',pergunta:'Certificado'}]})};
function response(ext) { return {id:'r',campanha_id:'c',militar_id:'m',arquivos_anexados_json:JSON.stringify({cert:{url:'https://base44.app/api/apps/694014f8539e0b317aa75a23/files/mp/public/test.'+ext,nome:'curso.'+ext,tamanho:100}})}; }
for (const ext of ['jpg','jpeg','png','pdf','doc','docx','xls','xlsx']) {
 test('metadados e limites de acesso: '+ext, () => {
   const original=response(ext);
   for(const mode of ['VISUALIZAR','EXPORTAR']) {
     const projected=ctx.sanitizarRespostaCampanha(original,mode);
     const attachment=JSON.parse(projected.arquivos_anexados_json).cert;
     assert.equal(attachment.presente,true);
     assert.equal(attachment.nome,'curso.'+ext);
     assert.equal(attachment.tamanho,100);
     assert.equal(attachment.url,undefined);
   }
   assert.equal(JSON.parse(ctx.sanitizarRespostaCampanha(original,'ANEXOS').arquivos_anexados_json).cert.url,JSON.parse(original.arquivos_anexados_json).cert.url);
 });
}
test('anexo legado e objeto sem link',()=>{
 assert.equal(ctx.sanitizarItemAnexoCampanha('https://example.com/a.jpg').presente,true);
 assert.equal(ctx.sanitizarItemAnexoCampanha({nome:'incompleto.jpg'}).presente,false);
});
test('ZIP preserva bytes, extensão e recusa download com erro',async()=>{
 const oldFetch=globalThis.fetch, oldDocument=globalThis.document, oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldTimer=globalThis.setTimeout;
 let blob,clicked=false;
 globalThis.document={createElement:()=>({click:()=>{clicked=true;}}),body:{appendChild(){},removeChild(){}}};
 URL.createObjectURL=b=>{blob=b;return 'blob:teste';};URL.revokeObjectURL=()=>{};globalThis.setTimeout=()=>0;
 try {
   const rows=[{status_resposta:'Respondido',militar_matricula:'123',militar_nome:'Teste',resposta_completa:response('jpg')}];
   globalThis.fetch=async()=>new Response(new Uint8Array([255,216,255]),{status:200});
   const result=await baixarAnexosCampanhaZip(campaign,rows);
   assert.equal(result.totalBaixados,1);assert.equal(clicked,true);
   const files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
   assert.match(Object.keys(files)[0],/Certificado.jpg$/);assert.deepEqual([...Object.values(files)[0]],[255,216,255]);
   clicked=false;globalThis.fetch=async()=>new Response('',{status:403});
   await assert.rejects(baixarAnexosCampanhaZip(campaign,rows),/ZIP não foi gerado/);assert.equal(clicked,false);
 } finally {globalThis.fetch=oldFetch;globalThis.document=oldDocument;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;globalThis.setTimeout=oldTimer;}
});

const validationStart=source.indexOf('        for (const [campoId, item] of Object.entries(arquivosObj))');
const validationEnd=source.indexOf('        for (const c of camposObrigatorios)',validationStart);
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const validation=new AsyncFunction('arquivosObj','formConfig','Response','URL','CORS_HEADERS','isPrivateCampaignFile','requireCampaignFile','base44','militarId','campanha_id','previousFiles',ts.transpile(source.slice(validationStart,validationEnd),{target:ts.ScriptTarget.ES2022}));
test('backend valida campo, origem, formato e tamanho de referências legadas próprias',async()=>{
 const config={campos:[{id:'cert',tipo:'upload_arquivo'}]};
 const validate=files=>validation(files,config,Response,URL,{},()=>false,async()=>{throw Error('unexpected private reference');},{},'m','c',files);
 for(const ext of ['jpg','jpeg','png','pdf','doc','docx','xls','xlsx']) assert.equal(await validate(JSON.parse(response(ext).arquivos_anexados_json)),undefined);
 for(const item of [{},{url:'javascript:alert(1)',nome:'a.jpg'}, {url:'https://example.com/a.jpg',nome:'a.jpg'}, {...JSON.parse(response('jpg').arquivos_anexados_json).cert,tamanho:16*1024*1024}, {...JSON.parse(response('exe').arquivos_anexados_json).cert}]) assert.equal((await validate({cert:item})).status,400);
 assert.equal((await validate({outro:JSON.parse(response('jpg').arquivos_anexados_json).cert})).status,400);
});

const scopeSource = source.slice(source.indexOf('function normalizeText'), source.indexOf('function vinculoGrupoValidoHoje'))
  + source.slice(source.indexOf('function matchMilitarCampanha'), source.indexOf('function campanhaPodeReceberResposta'));
const scopeCtx = vm.createContext({});
vm.runInContext(ts.transpile(scopeSource), scopeCtx);
test('público de campanhas exclui cadastro inativo em todos os escopos',()=>{
 const active={id:'m',status_cadastro:'Ativo',situacao_militar:'Designado',lotacao_id:'u',quadro:'Q'};
 const inactive={...active,status_cadastro:' Inativo '};
 const groups=new Map([['g',new Set(['m'])]]);
 for(const config of [{tipo_escopo:'TODOS'},{tipo_escopo:'UNIDADES',escopo_unidades_ids:['u']},{tipo_escopo:'QUADROS',escopo_quadros:['Q']},{tipo_escopo:'SELECAO_MILITARES',escopo_militares_ids:['m']},{tipo_escopo:'SEM_ESCOPO',escopo_grupos_ids:['g']}]){
   assert.equal(scopeCtx.matchMilitarCampanha(config,active,groups),true);
   assert.equal(scopeCtx.matchMilitarCampanha(config,inactive,groups),false);
 }
 assert.equal(scopeCtx.matchMilitarCampanha({tipo_escopo:'TODOS'},{...active,status:'Falecido'}),false);
 assert.equal(scopeCtx.matchMilitarCampanha({tipo_escopo:'TODOS'},{id:'legado'}),true);
});
test('ZIP com vários documentos e militares preserva todos e evita nomes duplicados',async()=>{
 const oldFetch=globalThis.fetch,oldDocument=globalThis.document,oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldTimer=globalThis.setTimeout;
 let blob;
 globalThis.document={createElement:()=>({click(){}}),body:{appendChild(){},removeChild(){}}};
 URL.createObjectURL=b=>{blob=b;return 'blob:test';};URL.revokeObjectURL=()=>{};globalThis.setTimeout=()=>0;
 try {
   const docs={cert:{url:'https://example.test/1.jpg',nome:'1.jpg'},second:{url:'https://example.test/2.pdf',nome:'2.pdf'},third:{url:'https://example.test/3.jpg',nome:'3.jpg'},removed:{url:'https://example.test/4.png',nome:'4.png'}};
   const camp={...campaign,config_formulario:JSON.stringify({campos:[{id:'cert',tipo:'upload_arquivo',pergunta:'Certificado'},{id:'second',tipo:'upload_arquivo',pergunta:'Declaração'},{id:'third',tipo:'upload_arquivo',pergunta:'Certificado'}]})};
   const rows=[{status_resposta:'Respondido',militar_matricula:'123',militar_posto:'Tenente',militar_nome:'Ana Silva',resposta_completa:{arquivos_anexados_json:JSON.stringify(docs)}},{status_resposta:'Respondido',militar_matricula:'456',militar_nome:'Ana Silva',resposta_completa:{arquivos_anexados_json:JSON.stringify({cert:docs.cert})}}];
   globalThis.fetch=async url=>new Response(new Uint8Array([Number(String(url).match(/\/(\d)\./)[1])]),{status:200});
   const result=await baixarAnexosCampanhaZip(camp,rows);
   assert.equal(result.totalBaixados,5);
   const files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
   assert.equal(Object.keys(files).length,5);
   assert.ok(files['[123] Tenente Ana Silva - Certificado.jpg']);
   assert.ok(files['[123] Tenente Ana Silva - Declaração.pdf']);
   assert.ok(files['[123] Tenente Ana Silva - Certificado (1).jpg']);
   assert.ok(files['[123] Tenente Ana Silva - Anexo removed.png']);
   assert.ok(files['[456] Ana Silva - Certificado.jpg']);
   assert.deepEqual([...files['[123] Tenente Ana Silva - Certificado (1).jpg']],[3]);
 } finally {globalThis.fetch=oldFetch;globalThis.document=oldDocument;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;globalThis.setTimeout=oldTimer;}
});
