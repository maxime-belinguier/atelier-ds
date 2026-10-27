import { useEffect, useMemo, useState } from 'react';
import type { TokenKey, Tokens } from '../shared/model.js';
import { validateValue } from './tokenMeta.js';

// Modifications en aperçu, non enregistrées. Elles vivent dans l'onglet
// (sessionStorage, facultatif) et ne deviennent réelles qu'après le diff.
const storageKey = 'ds-studio-drafts-v3';
type Drafts = Partial<Record<TokenKey, string>>;

function load(): Drafts {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      const out: Drafts = {};
      for (const [k, v] of Object.entries(saved))
        if (typeof v === 'string' && v.length <= 100) out[k as TokenKey] = v;
      return out;
    }
  } catch {
    /* Le stockage navigateur est facultatif, jamais le disque de référence. */
  }
  return {};
}

export function useDrafts(saved: Tokens | undefined) {
  const [drafts, setDrafts] = useState<Drafts>(load);
  const [recovered] = useState(() => Object.keys(load()).length > 0);
  useEffect(() => {
    try {
      if (Object.keys(drafts).length)
        sessionStorage.setItem(storageKey, JSON.stringify(drafts));
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Mode privé / stockage refusé : édition en mémoire seulement. */
    }
  }, [drafts]);
  // Une modification devenue égale à la valeur enregistrée n'est plus en attente.
  useEffect(() => {
    if (!saved) return;
    setDrafts((d) => {
      const next = { ...d };
      let changed = false;
      for (const [k, v] of Object.entries(d) as [TokenKey, string][])
        if (
          !saved[k] ||
          String(saved[k].$value).toUpperCase() === v.toUpperCase()
        ) {
          delete next[k];
          changed = true;
        }
      return changed ? next : d;
    });
  }, [saved]);
  const view = useMemo(() => {
    if (!saved) return undefined;
    const tokens = structuredClone(saved);
    const errors: Partial<Record<TokenKey, string>> = {};
    const changes: { key: TokenKey; value: string | number }[] = [];
    for (const [k, raw] of Object.entries(drafts) as [TokenKey, string][]) {
      if (!tokens[k]) continue;
      const result = validateValue(saved, k, raw);
      if ('error' in result) errors[k] = result.error;
      else {
        (tokens[k] as { $value: string | number }).$value = result.value!;
        changes.push({ key: k, value: result.value! });
      }
    }
    return { tokens, errors, changes };
  }, [saved, drafts]);
  return {
    drafts,
    recovered,
    preview: view?.tokens,
    errors: view?.errors ?? {},
    changes: view?.changes ?? [],
    set(key: TokenKey, value: string) {
      setDrafts((d) => {
        const next = { ...d };
        if (
          saved &&
          String(saved[key].$value).toUpperCase() === value.toUpperCase()
        )
          delete next[key];
        else next[key] = value;
        return next;
      });
    },
    reset(key: TokenKey) {
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
    },
    clear() {
      setDrafts({});
    },
  };
}
