// Checks the admin password and, on success, returns a signed admin token.
// The token is required by the `admin-write` function for every admin database write.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // one long party evening

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

// Constant-time comparison of the two passwords' hashes
async function passwordMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const adminPassword = Deno.env.get('ADMIN_PASSWORD');
  const signingKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!adminPassword || !signingKey) {
    console.error('ADMIN_PASSWORD or SUPABASE_SERVICE_ROLE_KEY is not set');
    return json({ error: 'Server misconfiguration' }, 500);
  }

  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  if (typeof password !== 'string' || !(await passwordMatches(password, adminPassword))) {
    return json({ success: false });
  }

  const payload = `admin:${Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS}`;
  const token = `${payload}.${await sign(payload, signingKey)}`;
  return json({ success: true, token });
});
