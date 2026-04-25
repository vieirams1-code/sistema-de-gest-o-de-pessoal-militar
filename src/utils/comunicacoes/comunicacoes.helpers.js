import {
  COMUNICACOES_MAILBOX_KEYS,
  PRIORIDADE_LABELS,
  STATUS_LABELS,
  TIPO_LABELS,
} from "./comunicacoes.constants";

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function formatStatusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

export function formatPrioridadeLabel(prioridade) {
  return PRIORIDADE_LABELS[prioridade] || prioridade || "—";
}

export function formatTipoLabel(tipo) {
  return TIPO_LABELS[tipo] || tipo || "—";
}

export function matchesQuery(item, query) {
  const term = normalizeText(query);
  if (!term) return true;

  const haystack = normalizeText(
    [
      item.id,
      item.protocolo,
      item.assunto,
      item.origem,
      item.tipo,
      item.prioridade,
      item.status,
      item.resumo,
      ...(item.tags || []),
    ].join(" ")
  );

  return haystack.includes(term);
}

export function matchesMailbox(item, mailbox) {
  if (!mailbox) return true;

  switch (mailbox) {
    case COMUNICACOES_MAILBOX_KEYS.PESSOAL:
      return item.mailbox === COMUNICACOES_MAILBOX_KEYS.PESSOAL;

    case COMUNICACOES_MAILBOX_KEYS.SETORIAL:
      return item.mailbox === COMUNICACOES_MAILBOX_KEYS.SETORIAL;

    case COMUNICACOES_MAILBOX_KEYS.IMPORTANTES:
      return Boolean(item.important);

    case COMUNICACOES_MAILBOX_KEYS.NAO_LIDAS:
      return Boolean(item.unread);

    case COMUNICACOES_MAILBOX_KEYS.ARQUIVADAS:
      return Boolean(item.archived);

    case COMUNICACOES_MAILBOX_KEYS.AGUARDANDO_DESPACHO:
      return item.status === "aguardando_despacho";

    default:
      return true;
  }
}

export function matchesQuickFilter(item, quickFilter) {
  if (!quickFilter) return true;
  return matchesMailbox(item, quickFilter);
}

export function applyComunicacoesFilters(items, { query, mailbox, quickFilter }) {
  return (items || []).filter((item) => {
    return (
      matchesQuery(item, query) &&
      matchesMailbox(item, mailbox) &&
      matchesQuickFilter(item, quickFilter)
    );
  });
}

export function buildMailboxCounters(items) {
  const source = items || [];

  return {
    [COMUNICACOES_MAILBOX_KEYS.PESSOAL]: source.filter(
      (item) => item.mailbox === COMUNICACOES_MAILBOX_KEYS.PESSOAL
    ).length,
    [COMUNICACOES_MAILBOX_KEYS.SETORIAL]: source.filter(
      (item) => item.mailbox === COMUNICACOES_MAILBOX_KEYS.SETORIAL
    ).length,
    [COMUNICACOES_MAILBOX_KEYS.IMPORTANTES]: source.filter(
      (item) => item.important
    ).length,
    [COMUNICACOES_MAILBOX_KEYS.NAO_LIDAS]: source.filter(
      (item) => item.unread
    ).length,
    [COMUNICACOES_MAILBOX_KEYS.ARQUIVADAS]: source.filter(
      (item) => item.archived
    ).length,
    [COMUNICACOES_MAILBOX_KEYS.AGUARDANDO_DESPACHO]: source.filter(
      (item) => item.status === "aguardando_despacho"
    ).length,
  };
}

export function getInitialSelectedId(items) {
  return items?.[0]?.id || null;
}

export function findSelectedComunicacao(items, selectedId) {
  return (items || []).find((item) => item.id === selectedId) || null;
}
