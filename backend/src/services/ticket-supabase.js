import { createClient } from '@supabase/supabase-js';
let client;
export function ticketDb() {
  if (!process.env.TICKETS_SUPABASE_URL || !process.env.TICKETS_SUPABASE_SECRET_KEY) {
    const error = new Error('El módulo de facturas está pendiente de conectar con Supabase.');
    error.status = 503;
    throw error;
  }
  client ||= createClient(process.env.TICKETS_SUPABASE_URL, process.env.TICKETS_SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
export function dbResult(result) {
  if (result.error) {
    const error = new Error('No se pudo completar la operación de facturas.');
    error.status = result.error.code === 'P0001' ? 409 : 503;
    throw error;
  }
  return result.data;
}
