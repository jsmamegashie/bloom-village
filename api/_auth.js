const SB_URL = 'https://ktihbuebzmkbjqfcummz.supabase.co';
export const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_C2x_plI5q9oFAZgUUta1Vg_03DbXO1_';
export async function rpc(pass, op, args) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/village', {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY },
    body: JSON.stringify({ pass: pass || '', op, args: args || {} })
  });
  if (!r.ok) return null;
  return r.json();
}
export async function checkPass(pass) { const j = await rpc(pass, 'auth'); return !!(j && j.ok); }
