import { useEffect, useState } from 'react';

/**
 * "Is this browser already trusted for this email?"
 *
 * The first sign-in on a new device or browser must be confirmed with a code emailed to the
 * account — which also tells the owner someone signed in. After that the browser remembers
 * the email here. Clearing site data, a private window or another browser counts as a new
 * device again.
 */

const KEY = 'trustedDevices:v1';
const EVENT = 'device-trust-changed';

function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function isDeviceTrusted(email?: string | null): boolean {
  if (!email) return false;
  return read().includes(email.toLowerCase());
}

export function trustDevice(email?: string | null) {
  if (!email) return;
  const list = read();
  const e = email.toLowerCase();
  if (!list.includes(e)) {
    try { localStorage.setItem(KEY, JSON.stringify([...list, e])); } catch { /* storage blocked */ }
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Re-renders when this browser's trust changes. */
export function useDeviceTrusted(email?: string | null): boolean {
  const [trusted, setTrusted] = useState(() => isDeviceTrusted(email));
  useEffect(() => {
    setTrusted(isDeviceTrusted(email));
    const on = () => setTrusted(isDeviceTrusted(email));
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, [email]);
  return trusted;
}
