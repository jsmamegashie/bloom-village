import { checkPass, rpc } from './_auth.js';
export const config = { maxDuration: 60 };
const MODELS = { quick: 'claude-haiku-5-5', default: 'claude-sonnet-5-5' };
// US$ per million tokens: input, output (estimate for the usage counter)
const PRICE = { 'claude-haiku-5-5': [1, 5], 'claude-sonnet-5-5': [3, 15] };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {};
  if (!(await checkPass(b.pass))) return res.status(401).json({ error: 'bad passcode' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'no key', friendly: 'The Claude API key is not set up yet. Add ANTHROPIC_API_KEY in Vercel, then redeploy.' });
  const model = MODELS[b.tier] || MODELS.default;
  const body = { model, max_tokens: Math.min(+b.max_tokens || 2000, 4000), messages: b.messages || [] };
  if (Array.isArray(b.tools) && b.tools.length) { body.tools = b.tools; body.tools[body.tools.length - 1].cache_control = { type: 'ephemeral' }; }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || 'Claude API error';
    const friendly = /credit balance/i.test(msg) ? 'Your Claude API credit has run out. Top up at console.anthropic.com and chat will work again.'
      : r.status === 429 ? undefined : 'Claude could not answer: ' + msg;
    return res.status(r.status === 429 ? 429 : 502).json({ error: msg, friendly });
  }
  try {
    const u = j.usage || {}, p = PRICE[model] || [3, 15];
    const cost = ((u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1) * p[0] / 1e6 + (u.output_tokens || 0) * p[1] / 1e6;
    await rpc(b.pass, 'usage', { model, cost, inTok: u.input_tokens || 0, outTok: u.output_tokens || 0 });
  } catch (e) { }
  res.status(200).json({ content: j.content, stop_reason: j.stop_reason, usage: j.usage });
}
