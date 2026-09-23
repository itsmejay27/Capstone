import { useEffect, useState } from 'react';

/**
 * Accounts remembered on this browser, for the account switcher.
 *
 * An account is added once it has finished signing in (code and Terms included). Switching
 * to a saved account needs no new code. Signing out or removing an account forgets it here,
 * so the next sign-in to it is verified again.
 */

const KEY = 'savedAccounts:v1';
const TERMS_KEY = 'termsAccepted:v1';
const EVENT = 'saved-accounts-changed';

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function writeList(key: string, list: string[]) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

export function getSavedAccountIds(): string[] {
  return readList(KEY);
}
export function saveAccount(id?: string | null) {
  if (!id) return;
  const list = readList(KEY);
  if (!list.includes(id)) writeList(KEY, [...list, id]);
}
export function forgetAccount(id?: string | null) {
  if (!id) return;
  writeList(KEY, readList(KEY).filter((x) => x !== id));
}

/** Remembers that this account accepted the Terms, so the gate never flashes before the server answers. */
export function rememberTermsAccepted(id?: string | null) {
  if (!id) return;
  const list = readList(TERMS_KEY);
  if (!list.includes(id)) writeList(TERMS_KEY, [...list, id]);
}
export function hasAcceptedTermsLocally(id?: string | null): boolean {
  return Boolean(id && readList(TERMS_KEY).includes(id));
}

export function useSavedAccountIds(): string[] {
  const [ids, setIds] = useState(getSavedAccountIds);
  useEffect(() => {
    const on = () => setIds(getSavedAccountIds());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return ids;
}
