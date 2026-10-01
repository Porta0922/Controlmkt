import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
function secret() { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) throw new Error('Configura SESSION_SECRET (mínimo 32 caracteres).'); return s; }
export function token() { const expiry = String(Date.now() + 8 * 3600000); return `${expiry}.${createHmac('sha256', secret()).update(expiry).digest('hex')}`; }
export async function authenticated() { const value = (await cookies()).get('session')?.value; if (!value) return false; const [expiry, signature] = value.split('.'); if (!signature || !Number.isFinite(Number(expiry)) || Number(expiry) < Date.now()) return false; const expected = createHmac('sha256', secret()).update(expiry).digest('hex'); return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); }

