import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function servico(invoke) {
  const source=readFileSync('src/services/promocaoService.js','utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/export /g,'');
  const ctx=vm.createContext({console,Intl,Date,Map,Set,Object,
    POSTOS_GRADUACOES_HIERARQUIA:['Soldado','Cabo'],isPostoDestinoPromocaoInicial:()=>false,
    getSugestaoAtualizacaoCadastro:()=>({tipo:'imediatamente_superior'}),
    base44:{functions:{invoke}}});
  vm.runInContext(source+'\nthis.api={publicarPromocaoOficial,validarPublicacaoPromocao,diagnosticarDivergenciasGraduacoes,executarSincronizacaoGraduacoes};',ctx);
  return ctx.api;
}
const entrada=()=>({promocao:{id:'p1',status:'rascunho',posto_graduacao:'Cabo',quadro:'QBMP-1.a',data_promocao:'2020-01-01'},itens:[{id:'i1',militar_id:'m1',militar:{id:'m1'},ordem:1,status:'elegivel'}]});
test('publicação não anuncia sucesso com resposta vazia ou success false sem motivo',async()=>{
  for(const data of [undefined,{}, {success:false}]){
    const api=servico(async()=>({data}));
    await assert.rejects(api.publicarPromocaoOficial(entrada()),/não confirmada/);
  }
});
test('falha parcial mantém número aplicado e necessidade de reconciliação para a tela',async()=>{
  const data={success:false,publicados:1,reconciliacao_pendente:true,errors:[{rollback_completo:false,motivo:'falha_parcial'}]};
  const api=servico(async()=>({data}));
  await assert.rejects(api.publicarPromocaoOficial(entrada()),e=>e.resultadoPublicacao===data);
});
test('erro HTTP preserva resultado do lote já aplicado',async()=>{
  const data={success:false,publicados:1,motivo:'consolidacao_pendente_repetir_publicacao'};
  const api=servico(async()=>{throw {response:{data}};});
  await assert.rejects(api.publicarPromocaoOficial(entrada()),e=>e.resultadoPublicacao===data);
});
test('promoção futura e data impossível são bloqueadas antes de invocar backend',async()=>{
  let chamadas=0;const api=servico(async()=>{chamadas++;return {data:{success:true}};});
  for(const data of ['2099-01-01','2020-02-31']){
    const payload=entrada();payload.promocao.data_promocao=data;
    await assert.rejects(api.publicarPromocaoOficial(payload));
  }
  assert.equal(chamadas,0);
});
test('diagnóstico e sincronização exigem confirmação explícita do servidor',async()=>{
  for(const data of [{success:false,error:'negado'},{}]){
    const api=servico(async()=>({data}));
    await assert.rejects(api.diagnosticarDivergenciasGraduacoes());
    await assert.rejects(api.executarSincronizacaoGraduacoes());
  }
});
test('sucesso confirmado e resumo com falhas são conservados sem ocultar pendências',async()=>{
  const data={success:true,resumo:{atualizados:1,falhas:[{militar_id:'m2',erro:'conflito'}]}};
  const api=servico(async()=>({data}));
  assert.equal(await api.executarSincronizacaoGraduacoes(),data);
  assert.equal((await api.publicarPromocaoOficial(entrada())).success,true);
});

test('efeitos reais da tela preservam rascunhos e bases de comparação durante refetch',()=>{
  const source=readFileSync('src/pages/DetalhePromocao.jsx','utf8');
  const ast=ts.createSourceFile('page.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const bodies=[];
  const visit=node=>{
    if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'){
      const body=node.arguments[0].getText(ast);
      if(['setRascunhoPromocao','setRascunhoTurma','setPromocaoBaseComparacao','setTurmaBaseComparacao'].some(n=>body.includes(n)))bodies.push(body);
    }
    ts.forEachChild(node,visit);
  };visit(ast);assert.equal(bodies.length,4);
  const chamadas=[];
  const ctx=vm.createContext({promocao:{id:'p1',ato_referencia:'servidor'},turma:[{id:'i1',ordem:2}],
    documentoEditado:{current:true},turmaEditada:{current:true},
    montarRascunhoPromocao:x=>x,montarRascunhoItemTurma:x=>x,
    setRascunhoPromocao:x=>chamadas.push(['doc',x]),setRascunhoTurma:x=>chamadas.push(['turma',x]),
    setPromocaoBaseComparacao:x=>chamadas.push(['baseDoc',x]),setTurmaBaseComparacao:x=>chamadas.push(['baseTurma',x])});
  for(const body of bodies)vm.runInContext('('+body+')()',ctx);
  assert.equal(chamadas.length,0);
  ctx.documentoEditado.current=false;ctx.turmaEditada.current=false;
  for(const body of bodies)vm.runInContext('('+body+')()',ctx);
  assert.equal(chamadas.length,4);
});
