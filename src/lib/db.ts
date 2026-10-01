import { createClient } from '@supabase/supabase-js';
export const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
export function db() { const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error('Configura Supabase en .env.local y ejecuta la migración SQL.'); return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
export function validateUrl(value: string) { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Usa una URL http o https sin credenciales.'); return url.toString(); }
