import { base44 } from '@/api/base44Client';
import { MODULO_EX_OFFICIO } from '@/components/rp/rpTiposConfig';
import { getTemplateAtivoPorTipo } from '@/components/rp/templateValidation';
import {
  escolherTipoTemplateComportamento,
  gerarTextoRPComportamento,
  marcoEhValidoParaGeracaoRP,
  obterTemplatePadraoComportamento,
} from '@/utils/comportamentoTemplateUtils';

function normalizarTexto(value) {
  return String(value || '').trim();
}

function houveMudancaRealDeComportamento(marco = {}) {
  const anterior = normalizarTexto(marco?.comportamento_anterior);
  const novo = normalizarTexto(marco?.comportamento_novo);
  return Boolean(novo) && anterior !== novo;
}

async function obterOuSemearTemplateAtivo(tipoTemplate) {
  const templatesAtivos = await base44.entities.TemplateTexto.filter({ ativo: true });
  let templateAtivo = getTemplateAtivoPorTipo(tipoTemplate, MODULO_EX_OFFICIO, templatesAtivos);

  if (!templateAtivo?.template) {
    const templatePadrao = obterTemplatePadraoComportamento(tipoTemplate);
    if (templatePadrao) {
      templateAtivo = await base44.entities.TemplateTexto.create({
        modulo: MODULO_EX_OFFICIO,
        tipo_registro: tipoTemplate,
        nome: `Template padrão — ${tipoTemplate}`,
        template: templatePadrao,
        observacoes: 'Template padrão semeado automaticamente para comportamento disciplinar.',
        ativo: true,
      });
    }
  }

  return templateAtivo || null;
}

async function buscarPublicacaoExistentePorHistorico(historicoId) {
  const historicoComportamentoId = normalizarTexto(historicoId);
  if (!historicoComportamentoId) return null;

  const porHistorico = await base44.entities.PublicacaoExOfficio.filter({
    historico_comportamento_id: historicoComportamentoId,
  });

  if (Array.isArray(porHistorico) && porHistorico.length > 0) {
    return porHistorico[0];
  }

  const porOrigem = await base44.entities.PublicacaoExOfficio.filter({
    origem_tipo: 'historico_comportamento',
    origem_id: historicoComportamentoId,
  });

  return Array.isArray(porOrigem) && porOrigem.length > 0 ? porOrigem[0] : null;
}

export async function gerarPublicacaoRPAutomaticaPorHistoricoComportamento({
  militar,
  marco,
  geradoPor = '',
  dataPublicacao = new Date().toISOString().slice(0, 10),
}) {
  if (!militar?.id || !marco?.id) {
    return { ok: false, publicado: false, motivo: 'dados_obrigatorios_ausentes' };
  }

  if (!houveMudancaRealDeComportamento(marco)) {
    return { ok: true, publicado: false, motivo: 'sem_mudanca_real' };
  }

  const tipoTemplate = escolherTipoTemplateComportamento(marco);
  if (!marcoEhValidoParaGeracaoRP(marco, tipoTemplate)) {
    return { ok: false, publicado: false, motivo: 'marco_invalido_para_rp', tipoTemplate };
  }

  const publicacaoExistente = await buscarPublicacaoExistentePorHistorico(marco.id);
  if (publicacaoExistente?.id) {
    return {
      ok: true,
      publicado: false,
      motivo: 'publicacao_ja_existente',
      publicacao: publicacaoExistente,
      tipoTemplate,
    };
  }

  const templateAtivo = await obterOuSemearTemplateAtivo(tipoTemplate);
  if (!templateAtivo?.template) {
    return { ok: false, publicado: false, motivo: 'template_ativo_nao_encontrado', tipoTemplate };
  }

  const renderizacao = gerarTextoRPComportamento({
    template: templateAtivo.template,
    militar,
    marco,
    tipoTemplate,
  });

  if (!renderizacao?.ok || !renderizacao?.texto) {
    return {
      ok: false,
      publicado: false,
      motivo: 'falha_renderizacao_template',
      erro: renderizacao?.erro || '',
      tipoTemplate,
    };
  }

  const geradoEm = new Date().toISOString();
  const registroCriado = await base44.entities.PublicacaoExOfficio.create({
    militar_id: militar.id,
    militar_nome: militar.nome_completo || militar.nome_guerra || '',
    militar_posto: militar.posto_graduacao || '',
    militar_matricula: militar.matricula || '',
    tipo: tipoTemplate,
    data_publicacao: dataPublicacao,
    status: 'Aguardando Nota',
    texto_publicacao: renderizacao.texto,
    origem_tipo: 'historico_comportamento',
    origem_id: marco.id,
    historico_comportamento_id: marco.id,
    tipo_template: tipoTemplate,
    template_texto_id: templateAtivo.id || '',
    texto_renderizado: renderizacao.texto,
    gerado_por: geradoPor,
    gerado_em: geradoEm,
  });

  return {
    ok: true,
    publicado: true,
    motivo: 'publicacao_criada',
    tipoTemplate,
    templateId: templateAtivo.id || '',
    publicacao: registroCriado,
  };
}
