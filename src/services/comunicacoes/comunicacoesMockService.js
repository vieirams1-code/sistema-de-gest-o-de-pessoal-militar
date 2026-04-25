import { COMUNICACOES_MAILBOX_KEYS } from "../../utils/comunicacoes/comunicacoes.constants";

const MOCK_COMUNICACOES = [
  {
    id: "ci-001",
    protocolo: "C-2026/041",
    assunto: "Conferência de escala do fim de semana",
    origem: "Seção de Operações",
    tipo: "memorando",
    prioridade: "alta",
    status: "aguardando_despacho",
    tags: ["Escala", "Urgente"],
    unread: true,
    important: true,
    archived: false,
    mailbox: COMUNICACOES_MAILBOX_KEYS.SETORIAL,
    data: "10:45",
    resumo:
      "Solicito revisão imediata dos nomes escalados para a guarda do quartel general e confirmação do efetivo disponível.",
    conteudo: [
      "Informo que, diante de ajustes recentes no efetivo, faz-se necessária a conferência da escala do próximo fim de semana, especialmente quanto à guarda do quartel general.",
      "Solicito análise e validação da relação nominal, com indicação de eventuais impedimentos ou necessidade de substituição.",
    ],
  },
  {
    id: "ci-002",
    protocolo: "C-2026/039",
    assunto: "Revisão de viaturas blindadas",
    origem: "Gabinete do Comando",
    tipo: "ordem",
    prioridade: "alta",
    status: "em_analise",
    tags: ["Frota", "Manutenção"],
    unread: false,
    important: true,
    archived: false,
    mailbox: COMUNICACOES_MAILBOX_KEYS.PESSOAL,
    data: "Ontem",
    resumo:
      "Conforme determinação do comando, todas as viaturas designadas para a missão de terça-feira devem passar por revisão preliminar.",
    conteudo: [
      "Determino a verificação das condições de emprego das viaturas previstas para utilização na missão da próxima terça-feira, com atenção a itens de segurança, documentação e disponibilidade mecânica.",
      "O presente documento inaugura a tramitação interna da matéria, ficando a providência detalhada para fases posteriores do módulo.",
    ],
  },
  {
    id: "ci-003",
    protocolo: "C-2026/035",
    assunto: "Atualização de efetivo para instrução",
    origem: "Divisão de Ensino",
    tipo: "comunicacao",
    prioridade: "media",
    status: "respondida",
    tags: ["Ensino"],
    unread: false,
    important: false,
    archived: false,
    mailbox: COMUNICACOES_MAILBOX_KEYS.SETORIAL,
    data: "22 Abr",
    resumo:
      "Encaminho a relação atualizada de militares aptos para participação na instrução prevista para amanhã.",
    conteudo: [
      "Segue a relação atualizada do efetivo apto para participação na instrução prática prevista para amanhã, consideradas as dispensas médicas e os afastamentos lançados até o presente momento.",
    ],
  },
  {
    id: "ci-004",
    protocolo: "C-2026/028",
    assunto: "Ciência sobre redistribuição de alojamentos",
    origem: "Subcomando",
    tipo: "comunicacao",
    prioridade: "baixa",
    status: "recebida",
    tags: ["Alojamento", "Ciência"],
    unread: true,
    important: false,
    archived: false,
    mailbox: COMUNICACOES_MAILBOX_KEYS.PESSOAL,
    data: "21 Abr",
    resumo:
      "Dá-se ciência da nova distribuição provisória dos alojamentos para o período de reforma do bloco B.",
    conteudo: [
      "Encaminho para ciência a distribuição provisória dos alojamentos durante a reforma do bloco B, com vigência imediata até nova deliberação.",
    ],
  },
  {
    id: "ci-005",
    protocolo: "C-2026/019",
    assunto: "Arquivamento de comunicação encerrada",
    origem: "P/4 Logística",
    tipo: "encaminhamento",
    prioridade: "media",
    status: "arquivada",
    tags: ["Arquivo"],
    unread: false,
    important: false,
    archived: true,
    mailbox: COMUNICACOES_MAILBOX_KEYS.SETORIAL,
    data: "18 Abr",
    resumo:
      "Comunicação encerrada e arquivada após saneamento integral da demanda logística correspondente.",
    conteudo: [
      "Registro de arquivamento da comunicação interna relacionada ao saneamento da demanda logística anteriormente encaminhada.",
    ],
  },
  {
    id: "ci-006",
    protocolo: "C-2026/017",
    assunto: "Solicitação de reserva do auditório",
    origem: "Seção de Pessoal",
    tipo: "memorando",
    prioridade: "media",
    status: "aguardando_despacho",
    tags: ["Auditório", "Evento"],
    unread: true,
    important: false,
    archived: false,
    mailbox: COMUNICACOES_MAILBOX_KEYS.PESSOAL,
    data: "17 Abr",
    resumo:
      "Solicita-se a reserva do auditório principal para reunião administrativa prevista para a próxima semana.",
    conteudo: [
      "Encaminho solicitação de reserva do auditório principal para realização de reunião administrativa, com estimativa de 40 participantes e necessidade de apoio de sonorização.",
    ],
  },
];

export async function listMockComunicacoes() {
  return Promise.resolve(MOCK_COMUNICACOES);
}
