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
