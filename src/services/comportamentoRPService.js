import { base44 } from '@/api/base44Client';
import { MODULO_EX_OFFICIO } from '@/components/rp/rpTiposConfig';
import { getTemplateAtivoPorTipo } from '@/components/rp/templateValidation';
import {
  escolherTipoTemplateComportamento,
  gerarTextoRPComportamento,
  marcoEhValidoParaGeracaoRP,
  obterTemplatePadraoComportamento,
} from '@/utils/comportamentoTemplateUtils';
import { formatarMatriculaPadrao } from '@/services/militarIdentidadeService';
import { isMilitarMesclado, resolverMatriculaAtual } from '@/services/matriculaMilitarViewService';

function normalizarTexto(value) {
  return String(value || '').trim();
}

function houveMudancaRealDeComportamento(marco = {}) {
  const anterior = normalizarTexto(marco?.comportamento_anterior);
  const novo = normalizarTexto(marco?.comportamento_novo);
  return Boolean(novo) && anterior !== novo;
}

function coletarCamposObrigatoriosAusentes({ militar = {}, marco = {} }) {
  const camposObrigatorios = [
    { campo: 'militar.id', valor: militar?.id },
    { campo: 'marco.id', valor: marco?.id },
    { campo: 'marco.comportamento_anterior', valor: normalizarTexto(marco?.comportamento_anterior) },
    { campo: 'marco.comportamento_novo', valor: normalizarTexto(marco?.comportamento_novo) },
  ];

  return camposObrigatorios.filter((item) => !item.valor).map((item) => item.campo);
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
        escopo: 'GLOBAL',
        setor_id: '',
        subsetor_id: '',
        unidade_id: '',
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

async function obterMatriculaAtualMilitar(militar = {}) {
  const matriculaPayload = normalizarTexto(militar?.matricula_atual || militar?.matricula);
  if (matriculaPayload) return formatarMatriculaPadrao(matriculaPayload);

  if (!militar?.id) return '';
  const historicoMatriculas = await base44.entities.MatriculaMilitar.filter({ militar_id: militar.id }, '-created_date');
  return resolverMatriculaAtual(militar, Array.isArray(historicoMatriculas) ? historicoMatriculas : []);
}

export async function gerarPublicacaoRPAutomaticaPorHistoricoComportamento({
  militar,
  marco,
  geradoPor = '',
  dataPublicacao = new Date().toISOString().slice(0, 10),
}) {
  const contextoLog = {
    historicoId: marco?.id || '',
    militarId: militar?.id || '',
    comportamentoAnterior: normalizarTexto(marco?.comportamento_anterior),
    comportamentoNovo: normalizarTexto(marco?.comportamento_novo),
  };
  console.info('[RP_AUTO][entrada] iniciar geração automática por histórico de comportamento', contextoLog);

  const camposAusentes = coletarCamposObrigatoriosAusentes({ militar, marco });
  console.info('[RP_AUTO][validacao] resultado validação de obrigatórios', {
    camposAusentes,
    possuiPendencias: camposAusentes.length > 0,
  });
  if (camposAusentes.length > 0) {
    return {
      ok: false,
      publicado: false,
      etapa: 'validacao',
      motivo: `Campos obrigatórios ausentes: ${camposAusentes.join(', ')}`,
      camposAusentes,
    };
  }

  if (isMilitarMesclado(militar)) {
    return { ok: false, publicado: false, etapa: 'validacao', motivo: 'militar_mesclado_fluxo_operacional' };
  }

  if (!houveMudancaRealDeComportamento(marco)) {
    console.info('[RP_AUTO][validacao] sem mudança real de comportamento; fluxo encerrado');
    return { ok: true, publicado: false, etapa: 'validacao', motivo: 'sem_mudanca_real' };
  }

  const tipoTemplate = escolherTipoTemplateComportamento(marco);
  console.info('[RP_AUTO][template] tipo/template escolhido para processamento', {
    tipoTemplate,
  });
  if (!marcoEhValidoParaGeracaoRP(marco, tipoTemplate)) {
    console.warn('[RP_AUTO][validacao] marco inválido para geração de RP', { tipoTemplate });
    return { ok: false, publicado: false, etapa: 'validacao', motivo: 'marco_invalido_para_rp', tipoTemplate };
  }

  const publicacaoExistente = await buscarPublicacaoExistentePorHistorico(marco.id);
  if (publicacaoExistente?.id) {
    console.info('[RP_AUTO][duplicidade] publicação já existe para histórico informado', {
      publicacaoId: publicacaoExistente.id,
      historicoId: marco.id,
    });
    return {
      ok: true,
      publicado: false,
      etapa: 'duplicidade',
      motivo: 'publicacao_ja_existente',
      publicacao: publicacaoExistente,
      tipoTemplate,
    };
  }

  const templateAtivo = await obterOuSemearTemplateAtivo(tipoTemplate);
  console.info('[RP_AUTO][template] resultado da busca/semeadura de template ativo', {
    tipoTemplate,
    templateEncontrado: Boolean(templateAtivo?.template),
    templateId: templateAtivo?.id || '',
  });
  if (!templateAtivo?.template) {
    return {
      ok: false,
      publicado: false,
      etapa: 'template',
      motivo: 'template_ativo_nao_encontrado',
      tipoTemplate,
    };
  }

  const renderizacao = gerarTextoRPComportamento({
    template: templateAtivo.template,
    militar,
    marco,
    tipoTemplate,
  });
  console.info('[RP_AUTO][texto] resultado da geração de texto', {
    sucesso: Boolean(renderizacao?.ok && renderizacao?.texto),
    tamanhoTexto: (renderizacao?.texto || '').length,
    erro: renderizacao?.erro || '',
  });

  if (!renderizacao?.ok || !renderizacao?.texto) {
    return {
      ok: false,
      publicado: false,
      etapa: 'texto',
      motivo: 'falha_renderizacao_template',
      erro: renderizacao?.erro || '',
      tipoTemplate,
    };
  }

  const matriculaAtual = await obterMatriculaAtualMilitar(militar);
  const geradoEm = new Date().toISOString();
  const payloadPublicacao = {
    militar_id: militar.id,
    militar_nome: militar.nome_completo || militar.nome_guerra || '',
    militar_posto: militar.posto_graduacao || '',
    militar_matricula: matriculaAtual || formatarMatriculaPadrao(militar.matricula || ''),
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
  };
  console.info('[RP_AUTO][create] payload de criação da publicação', payloadPublicacao);

  let registroCriado;
  try {
    registroCriado = await base44.entities.PublicacaoExOfficio.create(payloadPublicacao);
    console.info('[RP_AUTO][create] publicação criada com sucesso', {
      publicacaoId: registroCriado?.id || '',
    });
  } catch (error) {
    console.error('[RP_AUTO][create] erro ao criar publicação', {
      erro: error?.message || String(error),
      stack: error?.stack || '',
    });
    return {
      ok: false,
      publicado: false,
      etapa: 'create',
      motivo: error?.message || 'erro_ao_criar_publicacao',
      tipoTemplate,
    };
  }

  console.info('[RP_AUTO][retorno] fluxo finalizado com publicação criada', {
    status: 'criado',
    publicacaoId: registroCriado?.id || '',
  });
  return {
    ok: true,
    publicado: true,
    etapa: 'create',
    motivo: 'publicacao_criada',
    tipoTemplate,
    templateId: templateAtivo.id || '',
    publicacao: registroCriado,
  };
}
