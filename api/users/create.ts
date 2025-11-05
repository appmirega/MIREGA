// api/users/create.ts

// Este handler usa la API node-like (req/res). No importa el tipo exacto; evitamos dependencias de tipos.
type AnyReq = any;
type AnyRes = any;

// CORS helper
function setCORS(res: AnyRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');
}

// Utilidad para responder SIEMPRE JSON
function sendJSON(res: AnyRes, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setCORS(res);
  res.end(JSON.stringify(payload));
}

import { createOrUpsertUser } from './userService'; // ← mismo folder

export default async function handler(req: AnyReq, res: AnyRes) {
  try {
    setCORS(res);

    if (req.method === 'OPTIONS') {
      // preflight
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method !== 'POST') {
      return sendJSON(res, 405, { ok: false, error: 'Method Not Allowed' });
    }

    // En Vercel, req.body ya viene parseado si es application/json;
    // si llegara como string, intentamos parsearlo.
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const {
      email,
      password,
      full_name,
      phone = null,
      role, // 'admin' | 'technician' | 'client'
    } = body;

    if (!email || !password || !full_name || !role) {
      return sendJSON(res, 400, { ok: false, error: 'Faltan campos obligatorios' });
    }

    const result = await createOrUpsertUser({
      email,
      password,
      full_name,
      phone,
      role,
    });

    // Pase lo que pase, respondemos JSON
    return sendJSON(res, 200, { ok: true, ...result });
  } catch (err: any) {
    // NUNCA devolvemos HTML; siempre JSON
    return sendJSON(res, 200, {
      ok: false,
      error: err?.message || 'Error inesperado en USERS_CREATE v5',
    });
  }
}
