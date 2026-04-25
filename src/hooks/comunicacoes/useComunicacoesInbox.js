import { useEffect, useMemo, useState } from "react";
import { listMockComunicacoes } from "../../services/comunicacoes/comunicacoesMockService";
import {
  applyComunicacoesFilters,
  buildMailboxCounters,
  findSelectedComunicacao,
  getInitialSelectedId,
} from "../../utils/comunicacoes/comunicacoes.helpers";
import { COMUNICACOES_MAILBOX_KEYS } from "../../utils/comunicacoes/comunicacoes.constants";

export function useComunicacoesInbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [mailbox, setMailbox] = useState(COMUNICACOES_MAILBOX_KEYS.PESSOAL);
  const [quickFilter, setQuickFilter] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await listMockComunicacoes();

        if (!isMounted) return;

        setItems(data);
        setSelectedId(getInitialSelectedId(data));
      } catch (err) {
        if (!isMounted) return;
        setError("Não foi possível carregar as comunicações.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const counters = useMemo(() => buildMailboxCounters(items), [items]);

  const filteredItems = useMemo(() => {
    return applyComunicacoesFilters(items, {
      query,
      mailbox,
      quickFilter,
    });
  }, [items, query, mailbox, quickFilter]);

  const selectedItem = useMemo(() => {
    const selectedInFiltered = findSelectedComunicacao(filteredItems, selectedId);
    if (selectedInFiltered) return selectedInFiltered;

    return filteredItems[0] || null;
  }, [filteredItems, selectedId]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedId(null);
      return;
    }

    const stillExists = filteredItems.some((item) => item.id === selectedId);
    if (!stillExists) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  function handleSelect(id) {
    setSelectedId(id);
  }

  function handleMailboxChange(nextMailbox) {
    setMailbox(nextMailbox);
  }

  function handleQuickFilterToggle(filterKey) {
    setQuickFilter((current) => (current === filterKey ? "" : filterKey));
  }

  function clearFilters() {
    setQuickFilter("");
    setQuery("");
  }

  return {
    items,
    loading,
    error,
    query,
    mailbox,
    quickFilter,
    counters,
    filteredItems,
    selectedId,
    selectedItem,
    setQuery,
    handleSelect,
    handleMailboxChange,
    handleQuickFilterToggle,
    clearFilters,
  };
}
