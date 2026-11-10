// One-time import of the village data. The data file is encrypted; the key lives only in Vercel.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { checkPass, rpc } from './_auth.js';
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  const pass = req.query.pass;
  if (!(await checkPass(pass))) return res.status(401).json({ error: 'bad passcode' });
  if (!process.env.SEED_KEY) return res.status(410).json({ error: 'import is closed' });
  const enc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'api', '_seed.enc.json'), 'utf8'));
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(process.env.SEED_KEY, 'base64'), Buffer.from(enc.iv, 'base64'));
  d.setAuthTag(Buffer.from(enc.tag, 'base64'));
  const seed = JSON.parse(Buffer.concat([d.update(Buffer.from(enc.data, 'base64')), d.final()]).toString('utf8'));
  const entries = Object.entries(seed); let ok = 0; const fail = [];
  for (let i = 0; i < entries.length; i += 10) await Promise.all(entries.slice(i, i + 10).map(async ([p, data]) => { const r = await rpc(pass, 'set', { path: p, data, merge: false }); if (r && r.ok) ok++; else fail.push(p); }));
  res.status(200).json({ total: entries.length, ok, fail });
}
