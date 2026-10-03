import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Ferramenta de homologação: apenas base dev, administrador e fixture explicitamente fictícia.
// Nunca aceita IDs de militares reais nem permite escolher outro ambiente.
const MATRICULA = 'HOMO-PROM-20261003';
const NOME = '[HOMOLOGAÇÃO PROMOÇÕES 2026-10-03] MILITAR FICTÍCIO';
const CHAVE = 'HOMO-PROM-20261003-CICLO';
Deno.serve(async (req) => {
  // O executor do painel não encaminha a seleção Teste como header.
  // Fixar dev no servidor, inclusive para as invocações encadeadas; não há fallback para prod.
  const ambiente = 'dev';
  const headers = new Headers(req.headers);
  headers.set('X-Data-Env',ambiente);
  const requestDev = new Request(req,{headers});
  const base44 = createClientFromRequest(requestDev);
  try {
    const usuario = await base44.auth.me();
    if (usuario?.role !== 'admin') return Response.json({success:false,motivo:'administrador_obrigatorio'}, {status:403});
    const raw = await requestDev.json();
    const payload = raw?.body || raw?.data || raw || {};
    const E = base44.asServiceRole.entities;
    const militares = await E.Militar.filter({matricula:MATRICULA},undefined,2);
    if (militares.length !== 1 || militares[0].nome_completo !== NOME || militares[0].status_cadastro !== 'Inativo') {
      return Response.json({success:false,motivo:'fixture_dev_nao_confirmada',ambiente},{status:409});
    }
    const militar = militares[0];
    const resumo = async () => {
      const m = await E.Militar.get(militar.id);
      const pais = await E.Promocao.filter({chave_agrupamento:CHAVE},undefined,2);
      const futuro = await E.Promocao.filter({chave_agrupamento:CHAVE+'-FUTURO'},undefined,2);
      const itens = pais.length ? await E.PromocaoMilitar.filter({promocao_id:pais[0].id},undefined,5) : [];
      const hist = await E.HistoricoPromocaoMilitarV2.filter({militar_id:militar.id},undefined,20);
      return {ambiente,militar:{id:m.id,posto:m.posto_graduacao,quadro:m.quadro,token:m.operacao_promocao_token || ''},
        promocao:pais[0] || null,promocao_futura:futuro[0] || null,itens,historicos:hist};
    };
    if (payload.acao === 'preparar') {
      if (militar.posto_graduacao !== 'Soldado' || militar.quadro !== 'QBMP-1.a') throw new Error('fixture_inicial_divergente');
      for (const futuro of [false,true]) {
        const chave = CHAVE+(futuro ? '-FUTURO' : '');
        const pais = await E.Promocao.filter({chave_agrupamento:chave},undefined,2);
        if (pais.length) continue;
        const p = await E.Promocao.create({chave_agrupamento:chave,tipo:'historica',natureza:'individual',status:'rascunho',
          posto_graduacao:'Cabo',quadro:'QBMP-1.a',data_promocao:futuro ? '2099-01-01' : '2020-01-01',
          data_publicacao:'2020-01-01',ato_referencia:'ATO FICTÍCIO HOMOLOGAÇÃO',boletim_referencia:'BG FICTÍCIO HOMOLOGAÇÃO',
          observacoes:'Somente teste isolado. Sem efeitos em pessoas reais.',origem:'homologacao_dev'});
        await E.PromocaoMilitar.create({promocao_id:p.id,militar_id:militar.id,ordem:1,status:'elegivel',publicado:false,origem:'homologacao_dev'});
      }
      return Response.json({success:true,...await resumo()});
    }
    if (!payload.acao || payload.acao === 'verificar') return Response.json({success:true,...await resumo()});
    const futuro = payload.acao === 'vigencia_futura';
    const pais = await E.Promocao.filter({chave_agrupamento:CHAVE+(futuro ? '-FUTURO' : '')},undefined,2);
    if (pais.length !== 1 || pais[0].origem !== 'homologacao_dev') throw new Error('promocao_fixture_ausente');
    const p = pais[0];
    const itens = await E.PromocaoMilitar.filter({promocao_id:p.id},undefined,5);
    if (itens.length !== 1 || itens[0].militar_id !== militar.id || itens[0].origem !== 'homologacao_dev') throw new Error('vinculo_fixture_divergente');
    let nomeFuncao = '';
    let dados:any = {};
    if (['publicar','repetir','vigencia_futura'].includes(payload.acao)) {
      nomeFuncao = 'publicarPromocaoOficial'; dados = {promocao_id:p.id,promocao:p,itens};
    } else if (payload.acao === 'editar_documento') {
      nomeFuncao = 'sincronizarHistoricoPromocaoPublicadaTx';
      dados = {promocao_id:p.id,patch_promocao:{ato_referencia:'ATO FICTÍCIO RETIFICADO HOMOLOGAÇÃO',boletim_referencia:''},
        valores_anteriores:{ato_referencia:p.ato_referencia,boletim_referencia:p.boletim_referencia}};
    } else if (payload.acao === 'reverter') {
      nomeFuncao = 'reverterPublicacaoPromocaoMilitarTx';
      dados = {promocao:{id:p.id},item:{id:itens[0].id},motivo:'Homologação isolada da reversão cadastral'};
    } else throw new Error('acao_invalida');
    let resultado;
    try { const r = await base44.functions.invoke(nomeFuncao,dados);resultado = r?.data ?? r; }
    catch (e:any) { resultado = e?.response?.data || {success:false,motivo:e?.message}; }
    return Response.json({success:true,acao:payload.acao,resultado,...await resumo()});
  } catch(e:any) {
    return Response.json({success:false,motivo:e.message,ambiente},{status:500});
  }
});
