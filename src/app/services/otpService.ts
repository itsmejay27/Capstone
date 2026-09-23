import { supabase } from '../config/supabaseClient';

/**
 * One-time email codes (`email-otp`) and email+password credentials (`account-auth`),
 * both Supabase Edge Functions. Codes and password hashes live only on the server; the
 * browser only ever learns "sent", "valid" or "not valid".
 */

export type CodePurpose = 'verify' | 'new-device' | 'set-password' | 'reauth';

async function call(fn: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; data?: any }> {
  if (!supabase) return { ok: false, error: 'This needs the server connection, which is not configured.' };
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // The function's own message ("Wrong code. 3 attempts left.") is in the response body.
    let message = 'Could not reach the sign-in service. Try again.';
    try {
      const detail = await (error as any).context?.json?.();
      if (detail?.error) message = String(detail.error);
    } catch { /* not JSON */ }
    return { ok: false, error: message };
  }
  if (data?.error) return { ok: false, error: String(data.error) };
  return { ok: true, data };
}

export const sendSignInCode = (email: string, purpose: CodePurpose = 'verify') =>
  call('email-otp', { action: 'send', email, purpose });
export const verifySignInCode = (email: string, code: string) =>
  call('email-otp', { action: 'verify', email, code });

/** Whether this email already has a password for email sign-in. */
export async function hasPassword(email: string): Promise<boolean> {
  const r = await call('account-auth', { action: 'status', email });
  return Boolean(r.ok && r.data?.hasPassword);
}
/** Sets or replaces the password. `code` must come from sendSignInCode(email, 'set-password'). */
export const setAccountPassword = (email: string, code: string, password: string) =>
  call('account-auth', { action: 'set-password', email, code, password });
/** Checks a password on the server (sign-in and re-authentication). */
export const checkAccountPassword = (email: string, password: string) =>
  call('account-auth', { action: 'check', email, password });
