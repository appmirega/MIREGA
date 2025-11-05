// api/users/create.ts — PING MINIMO, SOLO PARA PROBAR LA RUTA

type AnyReq = any;
type AnyRes = any;

function setCORS(res: AnyRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');
}
function json(res: AnyRes, status: number, body: unknown) {
  setCORS(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req: AnyReq, res: AnyRes) {
  try {
    setCORS(res);
    if (req.method === 'OPTIONS') return json(res, 200, { ok: true });

    // No hacemos nada: solo confirmamos que la ruta responde JSON.
    return json(res, 200, {
      ok: true,
      route: '/api/users/create',
      note: 'PING OK',
      method: req.method,
    });
  } catch (e: any) {
    return json(res, 200, { ok: false, error: e?.message || 'unexpected error (ping)' });
  }
}

