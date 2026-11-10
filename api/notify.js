// Called by the Supabase database when something needs Joanita. Sends a push to every saved device.
import webpush from 'web-push';
export function setup() { webpush.setVapidDetails('mailto:hello@bloomvillage.app', process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE); return webpush; }
export async function sendAll(subs, payload) {
  const wp = setup(); let sent = 0; const gone = [];
  await Promise.all((subs || []).map(async s => { try { await wp.sendNotification(s, JSON.stringify(payload), { TTL: 3600 * 6, urgency: 'high' }); sent++; } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint); } }));
  return { sent, gone };
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.NOTIFY_KEY || req.headers['x-notify-key'] !== process.env.NOTIFY_KEY) return res.status(401).json({ error: 'no' });
  const b = req.body || {};
  const out = await sendAll(b.subs, { title: String(b.title || 'Bloom Village').slice(0, 80), body: String(b.body || '').slice(0, 220), url: b.url || '/#today', tag: b.tag || 'bloom' });
  res.status(200).json(out);
}
