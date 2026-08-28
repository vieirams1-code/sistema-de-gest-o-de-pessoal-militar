export const MODULO_WHATSAPP_NOTIFICACOES = 'WhatsApp Notificações';
export const TIPO_TEMPLATE_NOTIFICACAO_JISO_WA = 'Notificação de JISO WA';

export const VARIAVEIS_TEMPLATE_NOTIFICACAO_JISO_WA = [
  { v: '{{posto_nome}}', desc: 'Posto/graduação com quadro, quando disponível' },
  { v: '{{posto_graduacao}}', desc: 'Posto/graduação do militar' },
  { v: '{{nome_completo}}', desc: 'Nome completo do militar' },
  { v: '{{nome_guerra}}', desc: 'Nome de guerra do militar' },
  { v: '{{matricula}}', desc: 'Matrícula funcional' },
  { v: '{{data_jiso}}', desc: 'Data agendada da JISO' },
  { v: '{{hora_jiso}}', desc: 'Horário agendado da JISO' },
  { v: '{{dias_atestado}}', desc: 'Quantidade de dias do atestado' },
  { v: '{{tipo_afastamento}}', desc: 'Tipo de afastamento do atestado' },
  { v: '{{data_inicio}}', desc: 'Data de início do afastamento' },
  { v: '{{data_termino}}', desc: 'Data de término do afastamento' },
];

export const PREVIEW_TEMPLATE_NOTIFICACAO_JISO_WA = {
  posto_nome: '1º SGT QBMP João da Silva',
  posto_graduacao: '1º Sargento',
  nome_completo: 'João da Silva',
  nome_guerra: 'Silva',
  matricula: '123456',
  data_jiso: '15/09/2026',
  hora_jiso: '08:30',
  dias_atestado: '20',
  tipo_afastamento: 'Afastamento Total',
  data_inicio: '01/09/2026',
  data_termino: '20/09/2026',
};
