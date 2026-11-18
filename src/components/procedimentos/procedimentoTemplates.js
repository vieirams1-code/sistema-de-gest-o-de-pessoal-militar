import { getTemplateAtivoPorTipo } from '../rp/templateValidation.js';
import { aplicarTemplate } from '../utils/templateUtils.js';
import { formatarData } from './procedimentoConfig.js';
import { ROTULOS_PUBLICACAO_PROCEDIMENTO, TIPOS_RP_PROCEDIMENTO } from './procedimentoPublicacao.js';

const ESPECIES_COM_TEMPLATE = ['PAD', 'Inquérito Técnico'];
const TIPOS_DE_ATO = Object.keys(ROTULOS_PUBLICACAO_PROCEDIMENTO);
const tipoEspecifico = (ato, especie) => `${ato} — ${especie}`;

export const TEMPLATES_PROCEDIMENTOS = [
  ...TIPOS_DE_ATO.map((ato) => ({ value: ato, label: ROTULOS_PUBLICACAO_PROCEDIMENTO[ato], ato })),
  ...ESPECIES_COM_TEMPLATE.flatMap((especie) => TIPOS_DE_ATO.map((ato) => ({
    value: tipoEspecifico(ato, especie),
    label: `${ROTULOS_PUBLICACAO_PROCEDIMENTO[ato]} — ${especie}`,
    ato,
    especie,
  }))),
];

export function resolverTemplateProcedimento(ato, especie, templates, contexto) {
  const especifico = ESPECIES_COM_TEMPLATE.includes(especie)
    ? getTemplateAtivoPorTipo(tipoEspecifico(ato, especie), 'ExOfficio', templates, contexto)
    : null;
  if (especifico?.template?.trim()) return especifico;
  const geral = getTemplateAtivoPorTipo(ato, 'ExOfficio', templates, contexto);
  return geral?.template?.trim() ? geral : null;
}

const MODELOS = {
  [TIPOS_RP_PROCEDIMENTO.instauracao]: '{{autoridade_instauradora}} torna pública a {{portaria_referencia}}, que dispõe sobre a instauração de {{tipo_procedimento}}{{encarregado_designacao}}.{{anexo_mencao}}{{militar_mencao}} Em consequência: (1) Ciente; (2) Publique-se.',
  [TIPOS_RP_PROCEDIMENTO.prorrogacao]: '{{autoridade_instauradora}} torna pública a prorrogação, por {{prorrogacao_dias}} dias, do prazo do procedimento de {{tipo_procedimento}} instaurado pela {{portaria_referencia}}, com novo prazo até {{prorrogacao_data_final}}.{{anexo_mencao}}{{militar_mencao}}',
  [TIPOS_RP_PROCEDIMENTO.solucao]: '{{autoridade_instauradora}} torna pública a Solução do procedimento de {{tipo_procedimento}} instaurado pela {{portaria_referencia}}.{{anexo_mencao}}{{militar_mencao}}',
};

export function obterModeloInicialProcedimento(ato) {
  return MODELOS[ato] || '';
}

const VARIAVEIS_COMUNS = {
  autoridade_instauradora: 'Autoridade que instaurou o procedimento',
  tipo_procedimento: 'Tipo por extenso, por exemplo Processo Administrativo Disciplinar (PAD)',
  numero_procedimento: 'Número do procedimento na ficha',
  numero_portaria: 'Número da portaria de instauração',
  data_portaria: 'Data da portaria de instauração',
  portaria_referencia: 'Número e data da portaria, formatados como uma referência',
  data_instauracao: 'Data da instauração',
  prazo_final: 'Prazo final cadastrado',
  unidade_procedimento: 'Unidade cadastrada na ficha do procedimento',
  data_publicacao: 'Data informada no formulário da publicação',
  encarregado_nome: 'Nome do encarregado cadastrado',
  encarregado_posto: 'Posto ou graduação do encarregado',
  encarregado_quadro: 'Quadro do encarregado',
  encarregado_matricula: 'Matrícula do encarregado',
  encarregado_designacao: 'Trecho sobre a designação, quando há encarregado cadastrado',
  militar_mencao: 'Trecho opcional com o militar selecionado para esta publicação',
  militar_nome: 'Nome do militar selecionado para a publicação',
  militar_posto: 'Posto ou graduação do militar selecionado',
  militar_matricula: 'Matrícula do militar selecionado',
  anexo_mencao: 'Frase sobre o anexo quando um documento foi selecionado',
};

const VARIAVEIS_POR_ATO = {
  [TIPOS_RP_PROCEDIMENTO.prorrogacao]: {
    prorrogacao_dias: 'Quantidade de dias da prorrogação',
    prorrogacao_data_base: 'Data-base da prorrogação',
    prorrogacao_data_final: 'Novo prazo após a prorrogação',
  },
  [TIPOS_RP_PROCEDIMENTO.solucao]: {
    data_solucao: 'Data da solução, quando registrada na ficha',
    resultado_solucao: 'Resultado da solução, quando registrado na ficha',
  },
};

export function listarVariaveisTemplateProcedimento(ato) {
  return Object.entries({ ...VARIAVEIS_COMUNS, ...VARIAVEIS_POR_ATO[ato] })
    .map(([chave, desc]) => ({ v: `{{${chave}}}`, desc }));
}

const dataOuVazio = (valor) => valor ? formatarData(valor) : '';
const identificar = (partes, matricula) => {
  const nome = partes.filter(Boolean).join(' ');
  return nome && matricula ? `${nome}, matrícula nº ${matricula}` : nome;
};

export function montarVariaveisTemplateProcedimento({ procedimento, ato, prazo, anexo, form }) {
  const encarregado = identificar([procedimento.encarregado_posto, procedimento.encarregado_quadro, procedimento.encarregado_nome], procedimento.encarregado_matricula);
  const militar = form.militar_id ? identificar([form.militar_posto, form.militar_nome], form.militar_matricula) : '';
  const encarregadoJaMencionado = ato === TIPOS_RP_PROCEDIMENTO.instauracao && form.militar_id === procedimento.encarregado_id && encarregado;
  const data_portaria = dataOuVazio(procedimento.data_portaria);
  return {
    autoridade_instauradora: procedimento.autoridade_instauradora?.trim() || 'A autoridade competente',
    tipo_procedimento: procedimento.tipo_procedimento === 'PAD' ? 'Processo Administrativo Disciplinar (PAD)' : procedimento.tipo_procedimento || '',
    numero_procedimento: procedimento.numero_procedimento || '',
    numero_portaria: procedimento.numero_portaria || '',
    data_portaria,
    portaria_referencia: procedimento.numero_portaria
      ? `Portaria nº ${procedimento.numero_portaria}${data_portaria ? `, de ${data_portaria}` : ''}`
      : 'portaria de instauração',
    data_instauracao: dataOuVazio(procedimento.data_instauracao),
    prazo_final: dataOuVazio(prazo?.data_fim || procedimento.prazo_final),
    unidade_procedimento: procedimento.unidade || '',
    data_publicacao: dataOuVazio(form.data_publicacao || form.data_registro),
    encarregado_nome: procedimento.encarregado_nome || '',
    encarregado_posto: procedimento.encarregado_posto || '',
    encarregado_quadro: procedimento.encarregado_quadro || '',
    encarregado_matricula: procedimento.encarregado_matricula || '',
    encarregado_designacao: encarregado ? ` e designa como encarregado ${encarregado}` : '',
    militar_mencao: militar && !encarregadoJaMencionado ? ` Militar mencionado: ${militar}.` : '',
    militar_nome: form.militar_id ? form.militar_nome || '' : '',
    militar_posto: form.militar_id ? form.militar_posto || '' : '',
    militar_matricula: form.militar_id ? form.militar_matricula || '' : '',
    posto_nome: form.militar_id ? [form.militar_posto, form.quadro].filter(Boolean).join(' ') : '',
    posto: form.militar_id ? form.militar_posto || '' : '',
    nome_completo: form.militar_id ? form.militar_nome || '' : '',
    matricula: form.militar_id ? form.militar_matricula || '' : '',
    anexo_mencao: anexo ? ' O inteiro teor segue anexo ao presente Boletim.' : '',
    prorrogacao_dias: prazo?.dias ?? '',
    prorrogacao_data_base: dataOuVazio(prazo?.data_inicio),
    prorrogacao_data_final: dataOuVazio(prazo?.data_fim),
    data_solucao: dataOuVazio(procedimento.data_solucao),
    resultado_solucao: procedimento.resultado_solucao || '',
  };
}

export function renderizarTemplateProcedimento(texto, variaveis) {
  return aplicarTemplate(texto.replace(/{{\s*(\w+)\s*}}/g, (_, chave) =>
    variaveis[chave] === '' ? '' : `{{${chave}}}`,
  ), variaveis);
}

export function obterVariaveisPreviewProcedimento(ato, especie = 'Inquérito Técnico') {
  return montarVariaveisTemplateProcedimento({
    ato,
    procedimento: {
      tipo_procedimento: especie, numero_procedimento: '001/2026', numero_portaria: '010/2026',
      data_portaria: '2026-09-16', data_instauracao: '2026-09-16', prazo_final: '2026-10-16',
      autoridade_instauradora: 'A Comandante da Unidade', unidade: 'Unidade de exemplo',
      encarregado_nome: 'Militar de Exemplo', encarregado_posto: '2º TEN', encarregado_quadro: 'QOBM',
      encarregado_matricula: '000.000-0', data_solucao: '2026-10-30', resultado_solucao: 'Encerramento do procedimento',
    },
    prazo: ato === TIPOS_RP_PROCEDIMENTO.prorrogacao ? { dias: 15, data_inicio: '2026-10-16', data_fim: '2026-10-31' } : null,
    anexo: true,
    form: { data_publicacao: '2026-11-03', militar_id: 'exemplo', militar_nome: 'Pessoa de Exemplo', militar_posto: 'CB', militar_matricula: '000.000-1' },
  });
}
