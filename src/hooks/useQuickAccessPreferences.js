import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchQuickAccessPreference,
  normalizePinnedItems,
  saveQuickAccessPreference,
} from '@/services/quickAccessPreferencesService';

const STORAGE_KEY = 'sgp_sidebar_pins';

function readLocalPins() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizePinnedItems(parsed);
  } catch {
    return [];
  }
}

export default function useQuickAccessPreferences(userEmail) {
  const [pinnedItems, setPinnedItems] = useState(() => readLocalPins());
  const [hasLoadedBackend, setHasLoadedBackend] = useState(false);
  const lastSavedRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedItems));
  }, [pinnedItems]);

  useEffect(() => {
    let active = true;
    const email = String(userEmail || '').trim().toLowerCase();

    if (!email) {
      setHasLoadedBackend(false);
      return () => {
        active = false;
      };
    }

    const loadBackend = async () => {
      try {
        const preference = await fetchQuickAccessPreference(email);
        if (!active) return;

        const backendItems = normalizePinnedItems(preference?.valor_json?.itens_fixados);
        if (backendItems.length > 0 || preference) {
          setPinnedItems(backendItems);
        }
      } catch {
        // Não quebra o widget em erro de backend
      } finally {
        if (active) setHasLoadedBackend(true);
      }
    };

    loadBackend();

    return () => {
      active = false;
    };
  }, [userEmail]);

  const persistPinnedItems = useMemo(() => async (nextPinnedItems) => {
    const email = String(userEmail || '').trim().toLowerCase();
    if (!email) return;

    const normalized = normalizePinnedItems(nextPinnedItems);
    const serialized = JSON.stringify(normalized);
    if (serialized === lastSavedRef.current) return;

    try {
      await saveQuickAccessPreference({ userEmail: email, itensFixados: normalized });
      lastSavedRef.current = serialized;
    } catch {
      // erro silencioso para não interromper interação
    }
  }, [userEmail]);

  const togglePin = (item) => {
    const normalizedTab = item?.tab || null;
    const page = String(item?.page || '').trim();
    if (!page) return;

    setPinnedItems((prev) => {
      const hasPinnedItem = prev.some((pinnedItem) => pinnedItem.page === page && (pinnedItem.tab || null) === normalizedTab);
      const next = hasPinnedItem
        ? prev.filter((pinnedItem) => !(pinnedItem.page === page && (pinnedItem.tab || null) === normalizedTab))
        : [...prev, { page, tab: normalizedTab }];

      void persistPinnedItems(next);
      return next;
    });
  };

  return {
    pinnedItems,
    togglePin,
    hasLoadedBackend,
  };
}
