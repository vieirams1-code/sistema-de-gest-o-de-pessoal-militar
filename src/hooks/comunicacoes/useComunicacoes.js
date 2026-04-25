import { useEffect, useMemo, useState } from 'react';
import { listarComunicacoes } from '@/services/comunicacoes/comunicacoesService';

const defaultFilters = {
  unread: false,
  important: false,
  archived: false,
  awaitingDispatch: false,
};

export const useComunicacoes = () => {
  const [comunicacoes, setComunicacoes] = useState([]);
  const [mailbox, setMailbox] = useState('pessoal');
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const load = async () => {
      const data = await listarComunicacoes();
      setComunicacoes(data);
      if (data.length > 0) {
        setSelectedId(data[0].id);
      }
    };

    load();
  }, []);

  const filteredComunicacoes = useMemo(() => {
    return comunicacoes.filter((item) => {
      if (mailbox && item.mailbox !== mailbox) return false;
      if (filters.unread && !item.unread) return false;
      if (filters.important && !item.important) return false;
      if (filters.archived && !item.archived) return false;
      if (filters.awaitingDispatch && !item.awaitingDispatch) return false;
      return true;
    });
  }, [comunicacoes, mailbox, filters]);

  const selectedComunicacao = useMemo(() => {
    return filteredComunicacoes.find((item) => item.id === selectedId) || filteredComunicacoes[0] || null;
  }, [filteredComunicacoes, selectedId]);

  const setFilter = (filterKey) => {
    setFilters((prev) => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  const resetSpecialBoxFilters = () => {
    setFilters(defaultFilters);
  };

  return {
    mailbox,
    setMailbox,
    filters,
    setFilter,
    resetSpecialBoxFilters,
    comunicacoes: filteredComunicacoes,
    selectedComunicacao,
    selectedId: selectedComunicacao?.id || selectedId,
    setSelectedId,
  };
};
