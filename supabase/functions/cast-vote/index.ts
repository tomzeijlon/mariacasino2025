// Casts or changes a voter's vote in the active round.
//
// Public clients cannot write to `votes`. Each device has a random secret token
// (kept in its localStorage); only its SHA-256 hash is stored, so reading the votes
// table does not let anyone change somebody else's vote.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const { voterToken, sessionId, participantId } = body;
  const voterName = typeof body.voterName === 'string' ? body.voterName.trim().slice(0, 60) || null : null;

  if (typeof voterToken !== 'string' || voterToken.length < 16 || voterToken.length > 200) {
    return json({ error: 'Invalid voter token' }, 400);
  }
  if (typeof sessionId !== 'string' || !UUID.test(sessionId) || typeof participantId !== 'string' || !UUID.test(participantId)) {
    return json({ error: 'Invalid ids' }, 400);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const [{ data: session }, { data: participant }] = await Promise.all([
    db.from('voting_sessions').select('id, is_active, tiebreaker_candidate_ids').eq('id', sessionId).maybeSingle(),
    db.from('participants').select('id, is_locked').eq('id', participantId).maybeSingle(),
  ]);

  if (!session?.is_active) return json({ error: 'Voting round is not active' }, 409);
  if (!participant || participant.is_locked) return json({ error: 'Participant cannot be voted for' }, 409);
  const candidates: string[] | null = session.tiebreaker_candidate_ids;
  if (candidates && candidates.length > 0 && !candidates.includes(participantId)) {
    return json({ error: 'Only the tied participants can be voted for' }, 409);
  }

  const { data, error } = await db
    .from('votes')
    .upsert(
      {
        session_id: sessionId,
        voted_for_participant_id: participantId,
        voter_token_hash: await sha256Hex(voterToken),
        voter_name: voterName,
      },
      { onConflict: 'voter_token_hash,session_id' },
    )
    .select('id')
    .single();

  if (error) {
    console.error('cast-vote failed:', error);
    return json({ error: 'Could not save vote' }, 500);
  }
  return json({ ok: true, voteId: data.id });
});
