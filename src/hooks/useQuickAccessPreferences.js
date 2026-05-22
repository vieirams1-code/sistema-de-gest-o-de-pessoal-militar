import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_WIDGET,
  fetchQuickAccessPreference,
  normalizePinnedItems,
  normalizeWidgetPreferences,
  saveQuickAccessPreference,
} from '@/services/quickAccessPreferencesService';

const STORAGE_KEY = 'sgp_sidebar_pins';
const WIDGET_STORAGE_KEY = 'sgp_quick_access_widget';

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

function readLocalWidget() {
  if (typeof window === 'undefined') return DEFAULT_WIDGET;
  try {
    const raw = window.localStorage.getItem(WIDGET_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return normalizeWidgetPreferences(parsed);
  } catch {
    return DEFAULT_WIDGET;
  }
}

export default function useQuickAccessPreferences(userEmail) {
  const [pinnedItems, setPinnedItems] = useState(() => readLocalPins());
  const [widgetPreferences, setWidgetPreferences] = useState(() => readLocalWidget());
  const [hasLoadedBackend, setHasLoadedBackend] = useState(false);
  const lastSavedPinsRef = useRef('');
  const lastSavedWidgetRef = useRef('');
  const pinnedItemsRef = useRef(pinnedItems);
  const userEmailRef = useRef(userEmail);

  useEffect(() => {
    pinnedItemsRef.current = pinnedItems;
  }, [pinnedItems]);

  useEffect(() => {
    userEmailRef.current = userEmail;
  }, [userEmail]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedItems));
  }, [pinnedItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widgetPreferences));
  }, [widgetPreferences]);

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
        const backendWidget = normalizeWidgetPreferences(preference?.valor_json?.widget);
        if (backendItems.length > 0 || preference) {
          setPinnedItems(backendItems);
        }
        if (preference) {
          setWidgetPreferences(backendWidget);
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

  const persistPinnedItems = useCallback(async (nextPinnedItems) => {
    const email = String(userEmailRef.current || '').trim().toLowerCase();
    if (!email) return;

    const normalized = normalizePinnedItems(nextPinnedItems);
    const serialized = JSON.stringify(normalized);
    if (serialized === lastSavedPinsRef.current) return;

    try {
      await saveQuickAccessPreference({ userEmail: email, itensFixados: normalized });
      lastSavedPinsRef.current = serialized;
    } catch {
      // erro silencioso para não interromper interação
    }
  }, []);

  const persistWidgetPreferences = useCallback(async (nextWidget) => {
    const email = String(userEmailRef.current || '').trim().toLowerCase();
    if (!email) return;

    const normalizedWidget = normalizeWidgetPreferences(nextWidget);
    const serialized = JSON.stringify(normalizedWidget);
    if (serialized === lastSavedWidgetRef.current) return;

    try {
      await saveQuickAccessPreference({ userEmail: email, itensFixados: pinnedItemsRef.current, widget: normalizedWidget });
      lastSavedWidgetRef.current = serialized;
    } catch {
      // erro silencioso para não interromper interação
    }
  }, []);

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

  const updateWidgetPreferences = useCallback((nextWidget) => {
    setWidgetPreferences((prev) => {
      const resolved = normalizeWidgetPreferences(typeof nextWidget === 'function' ? nextWidget(prev) : nextWidget);
      const prevSerialized = JSON.stringify(prev);
      const nextSerialized = JSON.stringify(resolved);
      if (prevSerialized === nextSerialized) {
        return prev;
      }
      void persistWidgetPreferences(resolved);
      return resolved;
    });
  }, [persistWidgetPreferences]);

  return {
    pinnedItems,
    togglePin,
    hasLoadedBackend,
    widgetPreferences,
    updateWidgetPreferences,
  };
}