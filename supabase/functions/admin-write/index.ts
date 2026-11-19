// Performs admin database writes on behalf of the admin page.
//
// Public clients only have read access to the game tables. Every admin write is sent here
// together with the signed token from `verify-admin`, validated against an allowlist and
// executed with the service role.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Action = 'insert' | 'update' | 'delete';
type FilterOp = 'eq' | 'neq' | 'is' | 'in';

interface WriteOp {
  table: string;
  action: Action;
  values?: Record<string, unknown> | Record<string, unknown>[];
  filters?: [string, FilterOp, unknown][];
  returning?: 'none' | 'rows' | 'single';
}

// Exactly the writes the admin page performs: per table, the columns each action may set
// and the columns it may filter on. Anything else is rejected.
interface TableRules {
  insert?: string[];
  update?: string[];
  delete?: boolean;
  filters: string[];
}
const RULES: Record<string, TableRules> = {
  participants: {
    insert: ['name', 'sort_order'],
    update: ['is_locked', 'has_received_package', 'last_voted_at', 'sort_order'],
    delete: true,
    filters: ['id'],
  },
  voting_sessions: {
    insert: ['current_participant_id', 'is_active', 'tiebreaker_candidate_ids'],
    update: ['is_active'],
    filters: ['id', 'is_active'],
  },
  votes: {
    delete: true,
    filters: ['id', 'session_id'],
  },
  voting_history: {
    insert: ['participant_id', 'package_owner_id', 'original_package_owner_id', 'results', 'correct_voters', 'move_count'],
    update: ['locked_participant_id', 'archived_game_id'],
    delete: true,
    filters: ['id', 'archived_game_id'],
  },
  archived_games: {
    insert: ['year', 'label'],
    filters: [],
  },
};
const MAX_TEXT_LENGTH = 20_000; // results/correct_voters JSON for a round is a few KB

// Values must be plain scalars (or a list of ids for tiebreaker_candidate_ids)
const isAllowedValue = (v: unknown): boolean =>
  v === null ||
  typeof v === 'boolean' ||
  (typeof v === 'number' && Number.isFinite(v)) ||
  (typeof v === 'string' && v.length <= MAX_TEXT_LENGTH) ||
  (Array.isArray(v) && v.length <= 100 && v.every((x) => typeof x === 'string' && x.length <= 100));

const FILTER_OPS = new Set<FilterOp>(['eq', 'neq', 'is', 'in']);
const MAX_OPS = 50;

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function isValidAdminToken(token: string | null, secret: string): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const match = /^admin:(\d+)$/.exec(payload);
  if (!match || Number(match[1]) < Date.now() / 1000) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = toBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function validate(op: WriteOp): string | null {
  if (!op || typeof op !== 'object') return 'Invalid operation';
  const rules = Object.prototype.hasOwnProperty.call(RULES, op.table) ? RULES[op.table] : undefined;
  const allowedColumns = op.action === 'delete' ? [] : rules?.[op.action];
  if (!rules || (op.action === 'delete' ? !rules.delete : !Array.isArray(allowedColumns))) {
    return `Not allowed: ${op.action} on ${op.table}`;
  }

  const rows = Array.isArray(op.values) ? op.values : op.values ? [op.values] : [];
  if (op.action === 'delete' && rows.length > 0) return 'Delete takes no values';
  if (op.action !== 'delete' && rows.length === 0) return 'Missing values';
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return 'Invalid values';
    for (const [column, value] of Object.entries(row)) {
      if (!allowedColumns!.includes(column)) return `Column not allowed: ${op.table}.${column}`;
      if (!isAllowedValue(value)) return `Invalid value for ${op.table}.${column}`;
    }
  }

  const filters = op.filters ?? [];
  if (!Array.isArray(filters)) return 'Invalid filters';
  // Updates and deletes must always be filtered
  if (op.action !== 'insert' && filters.length === 0) return 'Update/delete requires a filter';
  for (const f of filters) {
    if (!Array.isArray(f) || f.length !== 3) return 'Invalid filter';
    const [column, filterOp, value] = f;
    if (!rules.filters.includes(column) || !FILTER_OPS.has(filterOp)) return `Filter not allowed: ${op.table}.${column}`;
    if (filterOp === 'in' && !Array.isArray(value)) return 'Invalid "in" filter';
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return json({ error: 'Server misconfiguration' }, 500);
  }

  if (!(await isValidAdminToken(req.headers.get('x-admin-token'), serviceKey))) {
    return json({ error: 'Not authorized' }, 401);
  }

  let ops: WriteOp[];
  try {
    const body = await req.json();
    ops = Array.isArray(body?.ops) ? body.ops : [];
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (ops.length === 0 || ops.length > MAX_OPS) return json({ error: 'Invalid number of operations' }, 400);
  for (const op of ops) {
    const problem = validate(op);
    if (problem) return json({ error: problem }, 400);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const results: { data: unknown; error: { message: string; code?: string } | null }[] = [];

  // Run in order; stop at the first failure
  for (const op of ops) {
    const table = db.from(op.table);
    // deno-lint-ignore no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any =
      op.action === 'insert' ? table.insert(op.values!) : op.action === 'update' ? table.update(op.values!) : table.delete();
    for (const [column, filterOp, value] of op.filters ?? []) {
      query = query[filterOp](column, value);
    }
    if (op.returning === 'rows' || op.returning === 'single') query = query.select();
    if (op.returning === 'single') query = query.single();

    const { data, error } = await query;
    results.push({ data: data ?? null, error: error ? { message: error.message, code: error.code } : null });
    if (error) break;
  }

  return json({ results });
});
