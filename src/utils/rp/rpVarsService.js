import {
  abreviarPosto,
  formatDateBR,
  montarPostoNomeTemplate,
  resolveQuadroTemplate,
  numeroPorExtenso,
  composeTemplateVarsRP,
} from '../../components/utils/templateUtils.js';

function extrairDadosPublicacaoReferencia({ formData = {}, publicacoesDisponiveis = [] } = {}) {
  const referenciaSelecionada = publicacoesDisponiveis.find((p) => p.id === formData.publicacao_referencia_id) || {};
  const registroPublicacao = referenciaSelecionada.publicacao || referenciaSelecionada.registro || {};

  const numeroBg =
    formData.publicacao_referencia_numero_bg ||
    referenciaSelecionada.numero_bg ||
    registroPublicacao.numero_bg ||
    registroPublicacao?.publicacao?.numero_bg ||
    formData.numero_bg_ref ||
    '';

  const dataBg =
    formData.publicacao_referencia_data_bg ||
    referenciaSelecionada.data_bg ||
    registroPublicacao.data_bg ||
    registroPublicacao?.publicacao?.data_bg ||
    formData.data_bg_ref ||
    '';

  const notaRef =
    formData.publicacao_referencia_nota ||
    referenciaSelecionada.nota_para_bg ||
    referenciaSelecionada.nota_ref ||
    registroPublicacao.nota_para_bg ||
    registroPublicacao?.publicacao?.nota_para_bg ||
    formData.nota_ref ||
    '';

  return {
    numero_bg_ref: numeroBg || '-',
    data_bg_ref: dataBg || '-',
    nota_ref: notaRef || '-',
  };
}

function parseDataBGReferencia(dataStr) {
  if (!dataStr) return null;
  const valor = String(dataStr).trim();
  if (!valor || valor === '-') return null;

  const isoMatch = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, ano, mes, dia] = isoMatch;
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
    if (
      data.getFullYear() === Number(ano)
      && data.getMonth() === Number(mes) - 1
      && data.getDate() === Number(dia)
    ) {
      return data;
    }
    return null;
  }

  const brMatch = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
    if (
      data.getFullYear() === Number(ano)
      && data.getMonth() === Number(mes) - 1
      && data.getDate() === Number(dia)
    ) {
      return data;
    }
  }

  return null;
}

function formatarDataExtenso(dataStr) {
  const data = parseDataBGReferencia(dataStr);
  if (!data) return '';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function montarVariaveisTemplateRP({ formData = {}, militar = {}, user = {}, publicacoesDisponiveis = [], atestadosDisponiveis = [], medicosDisponiveis = [] } = {}) {
  const postoBase = formData.militar_posto || militar?.posto_graduacao || militar?.posto || '';
  const postoAbreviado = abreviarPosto(postoBase);
  const quadroBase = resolveQuadroTemplate({
    ...formData,
    militar,
    quadro_atual: militar?.quadro_atual,
  });
  const dataRegistro = formData.data_registro || formData.data_publicacao || '';

  const dadosPublicacaoReferencia = extrairDadosPublicacaoReferencia({ formData, publicacoesDisponiveis });
  const dataBgRefExtenso = formatarDataExtenso(dadosPublicacaoReferencia.data_bg_ref);

  // Quando o tipo é "Homologação de Atestado", mesclar dados do atestado selecionado para resolver {{medico_nome}} e {{medico_crm}}.
  const atestadoSelecionado = formData.atestado_homologado_id
    ? (atestadosDisponiveis || []).find(a => a.id === formData.atestado_homologado_id) || {}
    : {};
  const medicoVinculado = atestadoSelecionado?.medico_id
    ? (medicosDisponiveis || []).find(m => m.id === atestadoSelecionado.medico_id) || null
    : null;

  const sourceRP = {
    ...formData,
    militar,
    nome_completo: formData.militar_nome || militar?.nome_completo || '',
    militar_posto: postoBase,
    quadro: quadroBase,
    militar_quadro: quadroBase,
    matricula: formData.militar_matricula || militar?.matricula || '',
    militar_matricula: formData.militar_matricula || militar?.matricula || '',
    // Médico do atestado selecionado (Homologação de Atestado).
    medico_nome_snapshot: atestadoSelecionado?.medico_nome_snapshot || atestadoSelecionado?.medico || medicoVinculado?.nome || '',
    medico_crm_snapshot: atestadoSelecionado?.medico_crm_snapshot || atestadoSelecionado?.crm_medico || medicoVinculado?.crm || '',
    medico: atestadoSelecionado?.medico || atestadoSelecionado?.medico_nome_snapshot || medicoVinculado?.nome || '',
    crm_medico: atestadoSelecionado?.crm_medico || atestadoSelecionado?.medico_crm_snapshot || medicoVinculado?.crm || '',
    // Datas/dias do atestado selecionado para compor o texto.
    data_inicio: atestadoSelecionado?.data_inicio || formData.data_inicio || '',
    data_termino: atestadoSelecionado?.data_termino || formData.data_termino || '',
    dias: atestadoSelecionado?.dias ?? formData.dias ?? '',
    tipo_afastamento: atestadoSelecionado?.tipo_afastamento || formData.tipo_afastamento || '',
  };

  const diasNum = Number(atestadoSelecionado?.dias ?? formData.dias ?? 0);
  const diasExtenso = diasNum > 0 ? numeroPorExtenso(diasNum) : '';

  const rpSpecificOverrides = {
    militar_nome: formData.militar_nome || militar?.nome_completo || '',
    nome_completo: formData.militar_nome || militar?.nome_completo || '',
    militar_matricula: formData.militar_matricula || militar?.matricula || '',
    matricula: formData.militar_matricula || militar?.matricula || '',
    militar_posto: postoBase,
    posto: postoAbreviado,
    posto_nome: montarPostoNomeTemplate({ abreviatura: postoAbreviado, quadro: quadroBase }),
    posto_graduacao: postoBase,
    quadro: quadroBase,
    quadro_nome: quadroBase,
    militar_quadro: quadroBase,
    acompanhado_parentesco: atestadoSelecionado?.grau_parentesco || '',
    acompanhado_nome: atestadoSelecionado?.acompanhado_nome || '',
    tipo_atestado_texto: atestadoSelecionado?.acompanhado === true ? 'atestado de acompanhamento' : 'atestado médico',
    data_registro: formatDateBR(dataRegistro),
    data_publicacao: formatDateBR(dataRegistro),
    doems_edicao_numero: formData.doems_edicao_numero || '',
    data_bg: formatDateBR(formData.data_bg),
    data_inicio: formatDateBR(formData.data_inicio),
    data_termino: formatDateBR(formData.data_termino),
    data_retorno: formatDateBR(formData.data_retorno),
    data_portaria: formatDateBR(formData.data_portaria),
    data_punicao: formatDateBR(formData.data_punicao),
    data_designacao: formatDateBR(formData.data_designacao),
    data_ata: formatDateBR(formData.data_ata),
    data_melhoria: formatDateBR(formData.data_melhoria),
    data_documento: formatDateBR(formData.data_documento),
    data_fato: formatDateBR(formData.data_fato),
    data_cedencia: formatDateBR(formData.data_cedencia),
    data_transferencia: formatDateBR(formData.data_transferencia),
    dias: String(diasNum || ''),
    dias_extenso: diasExtenso,
    grupamento_id: militar?.grupamento_id || formData.grupamento_id || user?.grupamento_id || '',
    subgrupamento_id: militar?.subgrupamento_id || formData.subgrupamento_id || user?.subgrupamento_id || '',
    subgrupamento_tipo: militar?.subgrupamento_tipo || formData.subgrupamento_tipo || user?.subgrupamento_tipo || '',
    unidade_id: militar?.unidade_id || formData.unidade_id || '',
    usuario_nome: user?.full_name || user?.name || '',
    usuario_email: user?.email || '',
    ...dadosPublicacaoReferencia,
    data_bg_ref: dataBgRefExtenso || dadosPublicacaoReferencia.data_bg_ref,
  };

  const variaveis = composeTemplateVarsRP({
    formData,
    sourceRP,
    rpSpecificOverrides,
  });

  return variaveis;
}
