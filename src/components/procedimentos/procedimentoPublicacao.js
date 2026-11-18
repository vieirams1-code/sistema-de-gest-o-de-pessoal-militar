import { formatarData } from './procedimentoConfig.js';

export const TIPOS_RP_PROCEDIMENTO = {
  instauracao: 'Portaria de Instauração de Procedimento',
  designacao: 'Designação de Encarregado de PAD',
  prorrogacao: 'Prorrogação de Prazo de Procedimento',
  solucao: 'Solução de Procedimento',
};

export const DESIGNACAO_PROVISORIA = 'Designação Provisória para Responder por Função';

export function tipoRPDeProcedimento(tipo) {
  return Object.values(TIPOS_RP_PROCEDIMENTO).includes(tipo);
}

export function montarTextoProcedimento(procedimento, tipo, prazo, temAnexo) {
  const { numero_portaria, data_portaria, tipo_procedimento } = procedimento;
  const especie = tipo_procedimento === 'PAD' ? 'Processo Administrativo Disciplinar (PAD)' : tipo_procedimento;
  const referencia = numero_portaria
    ? `Portaria nº ${numero_portaria}${data_portaria ? `, de ${formatarData(data_portaria)}` : ''}`
    : 'portaria de instauração';
  const autoridade = procedimento.autoridade_instauradora?.trim() || 'A autoridade competente';
  const oficial = [procedimento.encarregado_posto, procedimento.encarregado_quadro, procedimento.encarregado_nome].filter(Boolean).join(' ');
  const matricula = procedimento.encarregado_matricula ? `, matrícula nº ${procedimento.encarregado_matricula}` : '';
  const anexo = temAnexo ? ' O inteiro teor segue anexo ao presente Boletim.' : '';

  switch (tipo) {
    case TIPOS_RP_PROCEDIMENTO.instauracao:
      return `${autoridade} torna pública a ${referencia}, que instaura ${especie}${oficial ? ` e nomeia como encarregado ${oficial}${matricula}` : ''}.${anexo} Em consequência: (1) Ciente; (2) Publique-se.`;
    case TIPOS_RP_PROCEDIMENTO.designacao:
      return `${autoridade} torna pública a ${referencia}, que designa como encarregado do ${especie} o militar ${oficial}${matricula}.${anexo}`;
    case TIPOS_RP_PROCEDIMENTO.prorrogacao:
      if (!prazo) return '';
      return `${autoridade} torna pública a prorrogação, por ${prazo.dias} dias, do prazo do procedimento de ${especie} instaurado pela ${referencia}, com novo prazo até ${formatarData(prazo.data_fim)}.${anexo}`;
    case TIPOS_RP_PROCEDIMENTO.solucao:
      return `${autoridade} torna pública a Solução do procedimento de ${especie} instaurado pela ${referencia}.${anexo}`;
    default:
      return '';
  }
}

export function montarTextoDesignacaoProvisoria(formData, autoridade) {
  if (!formData.militar_nome || !formData.funcao?.trim() || !formData.data_designacao) return '';
  const militar = [formData.militar_posto, formData.militar_nome].filter(Boolean).join(' ');
  const matricula = formData.militar_matricula ? `, matrícula ${formData.militar_matricula},` : '';
  return `${autoridade?.trim() || 'A autoridade competente'}, no uso de suas atribuições, resolve designar ${militar}${matricula} para responder provisoriamente pela função de ${formData.funcao.trim()}, a contar de ${formatarData(formData.data_designacao)}.`;
}
