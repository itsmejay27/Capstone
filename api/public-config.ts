/**
 * Public, non-secret runtime configuration for the browser.
 *
 * VITE_* variables are baked in at build time, so adding one in Vercel does nothing until
 * the next rebuild. This endpoint reads the value at request time instead, so the Google
 * button appears as soon as the variable exists. Only public identifiers belong here.
 */
export default function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  });
}
