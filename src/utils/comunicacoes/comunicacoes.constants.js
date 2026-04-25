export const COMUNICACOES_MODULE_KEY = "modulo_comunicacoes_internas";
export const COMUNICACOES_ACCESS_PERMISSION = "acessar_comunicacoes";

export const COMUNICACOES_MAILBOX_KEYS = {
  PESSOAL: "pessoal",
  SETORIAL: "setorial",
  IMPORTANTES: "importantes",
  NAO_LIDAS: "nao_lidas",
  ARQUIVADAS: "arquivadas",
  AGUARDANDO_DESPACHO: "aguardando_despacho",
};

export const QUICK_FILTER_OPTIONS = [
  { key: "nao_lidas", label: "Não lidas" },
  { key: "importantes", label: "Importantes" },
  { key: "arquivadas", label: "Arquivadas" },
  { key: "aguardando_despacho", label: "Aguardando despacho" },
];

export const STATUS_LABELS = {
  aguardando_despacho: "Aguardando despacho",
  recebida: "Recebida",
  em_analise: "Em análise",
  respondida: "Respondida",
  arquivada: "Arquivada",
};

export const PRIORIDADE_LABELS = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const TIPO_LABELS = {
  comunicacao: "Comunicação",
  memorando: "Memorando",
  encaminhamento: "Encaminhamento",
  ordem: "Ordem",
};

export const EMPTY_PREVIEW_TITLE = "Selecione uma comunicação";
export const EMPTY_PREVIEW_DESCRIPTION =
  "Escolha um item da lista para visualizar os detalhes da comunicação.";
