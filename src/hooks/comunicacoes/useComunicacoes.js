import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listComunicacoes } from '@/services/comunicacoes/comunicacoesService';
import { applyComunicacoesFilters } from '@/utils/comunicacoes/comunicacoesFilters';

const defaultFilters = {
  unread: false,
  important: false,
  archived: false,
  awaitingDispatch: false,
};

export const useComunicacoes = () => {
  const [mailbox, setMailbox] = useState('pessoal');
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedId, setSelectedId] = useState(null);

  const { data: comunicacoes = [], isLoading } = useQuery({
    queryKey: ['comunicacoes-internas'],
    queryFn: listComunicacoes,
  });

  const filteredComunicacoes = useMemo(
    () => applyComunicacoesFilters(comunicacoes, { mailbox, filters }),
    [comunicacoes, mailbox, filters]
  );

  const selectedComunicacao = useMemo(() => {
    if (!filteredComunicacoes.length) return null;
    if (!selectedId) return filteredComunicacoes[0];
    return filteredComunicacoes.find((item) => item.id === selectedId) || filteredComunicacoes[0];
  }, [filteredComunicacoes, selectedId]);

  return {
    isLoading,
    mailbox,
    setMailbox,
    filters,
    setFilters,
    comunicacoes: filteredComunicacoes,
    selectedComunicacao,
    setSelectedId,
  };
};
