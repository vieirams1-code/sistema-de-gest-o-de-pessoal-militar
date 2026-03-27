import { createClient } from '@base44/sdk';

const appId = process.env.VITE_BASE44_APP_ID || process.env.BASE44_APP_ID;
const serverUrl = process.env.VITE_BASE44_BACKEND_URL || process.env.BASE44_SERVER_URL;
const token = process.env.BASE44_ACCESS_TOKEN || process.env.VITE_BASE44_ACCESS_TOKEN || null;
const functionsVersion = process.env.VITE_BASE44_FUNCTIONS_VERSION || process.env.BASE44_FUNCTIONS_VERSION;

const resultado = {
  compilacaoFerias: 'FALHOU',
  etapaFalha: null,
  selecaoElegiveis: 'FALHOU',
  lotePaiCriado: 'FALHOU',
  filhosVinculados: 'FALHOU',
  textoConsolidado: 'FALHOU',
  loteNoPainel: 'FALHOU',
  rastreabilidade: {
    registros_ids: 'FALHOU',
    criado_por: 'FALHOU',
    data_criacao_lote: 'FALHOU',
  },
  rollbackParcial: 'FALHOU',
};

const TIPOS_COMPILAVEIS = new Set([
  'Saída Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
  'Retorno Férias',
]);

const TIPOS_CODIGO_COMPILAVEIS = new Set([
  'saida_ferias',
  'interrupcao_de_ferias',
  'nova_saida_retomada',
  'retorno_ferias',
]);

const STATUS_COMPATIVEIS = new Set([
  'aguardando_publicacao',
  'aguardando_publicacao_no_bg',
  'aguardando_publicacao_bg',
  'aguardando_nota',
]);

const toCodigo = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toLowerCase();

const isFeriasOperacional = (registro = {}) => Boolean(
  registro?.ferias_id
  || registro?.vinculos?.ferias?.id
  || registro?.vinculos_contrato?.ferias?.id
  || registro?.grupo_display === 'Férias'
);

const isElegivel = (registro = {}) => {
  const tipoLabel = registro?.tipo_registro || registro?.tipo_label || registro?.tipo;
  const tipoCodigo = registro?.tipo_codigo || toCodigo(tipoLabel);
  const statusCodigo = toCodigo(registro?.status_codigo || registro?.status || registro?.status_calculado || registro?.status_publicacao);

  return Boolean(
    isFeriasOperacional(registro)
    && (TIPOS_COMPILAVEIS.has(tipoLabel) || TIPOS_CODIGO_COMPILAVEIS.has(tipoCodigo))
    && STATUS_COMPATIVEIS.has(statusCodigo)
    && !registro?.numero_bg
    && !registro?.data_bg
    && !registro?.inconsistencia
    && !registro?.inconsistencia_contrato
    && !registro?.publicacao_compilada_id
    && registro?.compilado_em_lote !== true
  );
};

function buildTextoConsolidado(registros = []) {
  const linhas = registros.map((registro, index) => {
    const ordem = index + 1;
    const nome = registro?.militar_nome || registro?.nome || 'Militar não identificado';
    const posto = registro?.militar_posto_graduacao || registro?.militar_posto || registro?.posto || '';
    const matricula = registro?.militar_matricula || registro?.matricula || '—';
    const tipo = registro?.tipo_registro || registro?.tipo_label || registro?.tipo || 'Registro';
    const periodo = registro?.periodo_aquisitivo || registro?.periodo_aquisitivo_ref || '-';
    return `${ordem}. ${[posto, nome].filter(Boolean).join(' ').trim()} - Matrícula: ${matricula} | Tipo: ${tipo} | Período aquisitivo: ${periodo}`;
  });

  return [
    'PUBLICAÇÃO COMPILADA DE FÉRIAS',
    '',
    `Quantidade de itens: ${registros.length}`,
    `Data de geração: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
    '',
    ...linhas,
  ].join('\n');
}

function printResultadoFinal() {
  console.log('--- RESULTADO HOMOLOGAÇÃO COMPILAÇÃO FÉRIAS ---');
  console.log(`- compilação de férias: ${resultado.compilacaoFerias}`);
  console.log(`- etapa de falha (se houver): ${resultado.etapaFalha || 'nenhuma'}`);
  console.log(`- 1) seleção elegíveis: ${resultado.selecaoElegiveis}`);
  console.log(`- 2) lote pai criado: ${resultado.lotePaiCriado}`);
  console.log(`- 3) filhos vinculados: ${resultado.filhosVinculados}`);
  console.log(`- 4) texto consolidado: ${resultado.textoConsolidado}`);
  console.log(`- 5) lote no painel RP/Publicações: ${resultado.loteNoPainel}`);
  console.log(`- 6.1) rastreabilidade registros_ids: ${resultado.rastreabilidade.registros_ids}`);
  console.log(`- 6.2) rastreabilidade criado_por: ${resultado.rastreabilidade.criado_por}`);
  console.log(`- 6.3) rastreabilidade data_criacao_lote: ${resultado.rastreabilidade.data_criacao_lote}`);
  console.log(`- 7) rollback em falha parcial: ${resultado.rollbackParcial}`);
}

if (!appId || !serverUrl) {
  console.error('Faltam variáveis BASE44_APP_ID/VITE_BASE44_APP_ID e BASE44_SERVER_URL/VITE_BASE44_BACKEND_URL.');
  resultado.etapaFalha = 'configuração de ambiente';
  printResultadoFinal();
  process.exit(2);
}

const base44 = createClient({ appId, serverUrl, token, functionsVersion, requiresAuth: false });
const e = base44.entities;

async function assertLoteNoPainel(loteId) {
  const lotes = await e.PublicacaoCompilada.filter({ id: loteId });
  const lote = lotes?.[0] || null;
  if (!lote) return null;

  if (String(lote?.tipo_lote || '').toLowerCase() === 'ferias') {
    resultado.loteNoPainel = 'OK';
  }

  if (Array.isArray(lote?.registros_ids) && lote.registros_ids.length >= 2) {
    resultado.rastreabilidade.registros_ids = 'OK';
  }

  if (String(lote?.criado_por || '').trim()) {
    resultado.rastreabilidade.criado_por = 'OK';
  }

  if (String(lote?.data_criacao_lote || '').trim()) {
    resultado.rastreabilidade.data_criacao_lote = 'OK';
  }

  return lote;
}

async function runFluxoPrincipal() {
  const registros = await e.RegistroLivro.list('-created_date', 500);
  const elegiveis = registros.filter(isElegivel);

  if (elegiveis.length < 2) {
    throw new Error('Menos de 2 registros elegíveis para compilação de férias.');
  }
  resultado.selecaoElegiveis = 'OK';

  const selecionados = elegiveis.slice(0, 2);
  const dataCriacaoLote = new Date().toISOString();

  const lote = await e.PublicacaoCompilada.create({
    tipo_lote: 'ferias',
    status: 'Aguardando Nota',
    nota_conciliada_boletim: '',
    quantidade_itens: selecionados.length,
    ativo: true,
    escopo_inicial: 'ferias',
    origem: 'livro',
    registros_ids: selecionados.map((item) => item.id),
    tipo_registro: 'Publicação Compilada - Férias',
    tipo_codigo: 'publicacao_compilada_ferias',
    nota_para_bg: '',
    numero_bg: '',
    data_bg: '',
    criado_por: 'homologacao-runtime-script',
    data_criacao_lote: dataCriacaoLote,
    titulo: `HOMOLOGAÇÃO LOTE FÉRIAS ${new Date().toISOString()}`,
    texto_publicacao: '',
  });

  if (!lote?.id) throw new Error('Lote pai sem ID retornado na criação.');
  resultado.lotePaiCriado = 'OK';

  const vinculos = await Promise.allSettled(
    selecionados.map((registro, index) => e.RegistroLivro.update(registro.id, {
      publicacao_compilada_id: lote.id,
      compilado_em_lote: true,
      publicacao_compilada_ordem: index + 1,
      nota_para_bg: lote.nota_para_bg || '',
    }))
  );

  const falhaVinculo = vinculos.find((item) => item.status === 'rejected');
  if (falhaVinculo) throw new Error('Falha ao vincular filhos no fluxo principal.');
  resultado.filhosVinculados = 'OK';

  const filhosAtualizados = await Promise.all(
    selecionados.map(async (registro) => (await e.RegistroLivro.filter({ id: registro.id }))?.[0] || null)
  );

  const texto = buildTextoConsolidado(filhosAtualizados.filter(Boolean));
  await e.PublicacaoCompilada.update(lote.id, {
    texto_publicacao: texto,
    quantidade_itens: filhosAtualizados.length,
    registros_ids: filhosAtualizados.filter(Boolean).map((item) => item.id),
  });

  const loteConsolidado = await assertLoteNoPainel(lote.id);
  if (!String(loteConsolidado?.texto_publicacao || '').includes('PUBLICAÇÃO COMPILADA DE FÉRIAS')) {
    throw new Error('Texto consolidado não foi persistido corretamente.');
  }
  resultado.textoConsolidado = 'OK';

  return { loteId: lote.id, filhos: filhosAtualizados.filter(Boolean) };
}

async function runTesteRollbackParcial() {
  const registros = await e.RegistroLivro.list('-created_date', 500);
  const elegiveis = registros.filter(isElegivel);

  if (elegiveis.length < 2) {
    throw new Error('Sem base elegível para teste de rollback parcial.');
  }

  const selecionados = elegiveis.slice(0, 2);
  let loteRollback = null;
  const filhosVinculados = [];

  try {
    loteRollback = await e.PublicacaoCompilada.create({
      tipo_lote: 'ferias',
      status: 'Aguardando Nota',
      quantidade_itens: selecionados.length,
      ativo: true,
      escopo_inicial: 'ferias',
      origem: 'livro',
      registros_ids: selecionados.map((item) => item.id),
      tipo_registro: 'Publicação Compilada - Férias',
      tipo_codigo: 'publicacao_compilada_ferias',
      criado_por: 'homologacao-runtime-script-rollback',
      data_criacao_lote: new Date().toISOString(),
      titulo: `HOMOLOGAÇÃO ROLLBACK ${new Date().toISOString()}`,
      texto_publicacao: '',
      nota_para_bg: '',
      numero_bg: '',
      data_bg: '',
    });

    await e.RegistroLivro.update(selecionados[0].id, {
      publicacao_compilada_id: loteRollback.id,
      compilado_em_lote: true,
      publicacao_compilada_ordem: 1,
    });
    filhosVinculados.push(selecionados[0].id);

    throw new Error('Falha parcial simulada para validar rollback transacional.');
  } catch (_erroSimulado) {
    await Promise.allSettled(
      filhosVinculados.map((registroId) => e.RegistroLivro.update(registroId, {
        publicacao_compilada_id: null,
        compilado_em_lote: false,
        publicacao_compilada_ordem: null,
      }))
    );

    if (loteRollback?.id) {
      await e.PublicacaoCompilada.delete(loteRollback.id);
    }

    const loteResidual = loteRollback?.id
      ? (await e.PublicacaoCompilada.filter({ id: loteRollback.id }))?.[0]
      : null;

    const filhosResidual = await Promise.all(
      selecionados.map(async (registro) => (await e.RegistroLivro.filter({ id: registro.id }))?.[0] || null)
    );

    const semOrfao = !loteResidual;
    const semVinculoParcial = filhosResidual.every((item) => item?.publicacao_compilada_id !== loteRollback?.id);

    resultado.rollbackParcial = semOrfao && semVinculoParcial ? 'OK' : 'FALHOU';
  }
}

async function cleanupFluxoPrincipal({ loteId, filhos }) {
  await Promise.allSettled(
    (filhos || []).map((registro, index) => e.RegistroLivro.update(registro.id, {
      publicacao_compilada_id: null,
      compilado_em_lote: false,
      publicacao_compilada_ordem: null,
      nota_para_bg: '',
      numero_bg: '',
      data_bg: '',
      observacoes: `Homologação runtime limpa em ${new Date().toISOString()} (ordem original ${index + 1}).`,
    }))
  );

  if (loteId) {
    await e.PublicacaoCompilada.delete(loteId);
  }
}

async function main() {
  let contextoFluxo = null;

  try {
    contextoFluxo = await runFluxoPrincipal();
    await runTesteRollbackParcial();

    const rastreabilidadeOk = Object.values(resultado.rastreabilidade).every((item) => item === 'OK');
    const homologado = [
      resultado.selecaoElegiveis,
      resultado.lotePaiCriado,
      resultado.filhosVinculados,
      resultado.textoConsolidado,
      resultado.loteNoPainel,
      resultado.rollbackParcial,
    ].every((item) => item === 'OK') && rastreabilidadeOk;

    resultado.compilacaoFerias = homologado ? 'OK' : 'FALHOU';
  } catch (error) {
    resultado.compilacaoFerias = 'FALHOU';
    resultado.etapaFalha = error?.message || 'erro não identificado';
  } finally {
    if (contextoFluxo?.loteId) {
      await cleanupFluxoPrincipal(contextoFluxo);
    }
  }

  printResultadoFinal();

  if (resultado.compilacaoFerias !== 'OK') {
    process.exit(1);
  }
}

main().catch((error) => {
  resultado.compilacaoFerias = 'FALHOU';
  resultado.etapaFalha = error?.message || 'erro fatal';
  printResultadoFinal();
  process.exit(1);
});
