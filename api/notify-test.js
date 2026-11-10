import { checkPass, rpc } from './_auth.js';
import { sendAll } from './notify.js';
export default async function handler(req, res) {
  const pass = (req.body || {}).pass;
  if (!(await checkPass(pass))) return res.status(401).json({ error: 'bad passcode' });
  const rows = (await rpc(pass, 'list', { parent: 'pushsubs' })) || [];
  const out = await sendAll(rows.map(r => r.data.sub), { title: 'Dzifa', body: 'Notifications are working. I will tap you when something needs you.', url: '/#today', tag: 'test' });
  res.status(200).json(out);
}
