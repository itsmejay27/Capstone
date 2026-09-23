import { supabase } from '../config/supabaseClient';

/**
 * One-time email sign-in codes, via the `email-otp` Supabase Edge Function.
 * The code is generated and checked on the server; the browser never sees it.
 */

async function call(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Email codes need the server connection, which is not configured.' };
  const { data, error } = await supabase.functions.invoke('email-otp', { body });
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
  return { ok: true };
}

export const sendSignInCode = (email: string) => call({ action: 'send', email });
export const verifySignInCode = (email: string, code: string) => call({ action: 'verify', email, code });
