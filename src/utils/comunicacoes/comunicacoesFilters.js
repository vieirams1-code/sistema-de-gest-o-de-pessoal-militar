export const mailboxOptions = [
  { key: 'pessoal', label: 'Caixa pessoal' },
  { key: 'setorial', label: 'Caixa setorial' },
];

export const statusOptions = [
  { key: 'important', label: 'Importantes' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'archived', label: 'Arquivadas' },
  { key: 'awaitingDispatch', label: 'Aguardando despacho' },
];

export const applyComunicacoesFilters = (items, { mailbox, filters }) => {
  return items.filter((item) => {
    if (mailbox && item.mailbox !== mailbox) return false;
    if (filters.unread && !item.unread) return false;
    if (filters.important && !item.important) return false;
    if (filters.archived && !item.archived) return false;
    if (filters.awaitingDispatch && !item.awaitingDispatch) return false;
    return true;
  });
};
