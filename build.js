// Build: pull the village page from Supabase and put it with the app files in /public
import fs from 'fs';
let html = fs.existsSync('index.html') ? fs.readFileSync('index.html', 'utf8') : null;
const KEY = 'sb_publishable_C2x_plI5q9oFAZgUUta1Vg_03DbXO1_';
if (!html) {
const r = await fetch('https://ktihbuebzmkbjqfcummz.supabase.co/rest/v1/rpc/village', {
  method: 'POST', headers: { 'content-type': 'application/json', apikey: KEY, authorization: 'Bearer ' + KEY },
  body: JSON.stringify({ pass: process.env.VILLAGE_PASS, op: 'get', args: { path: 'site/index' } })
});
const j = await r.json();
if (!r.ok || !j.data || !j.data.html) { console.error('Could not fetch the page', r.status, JSON.stringify(j).slice(0, 200)); process.exit(1); }
html = j.data.html;
}
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/index.html', html);
for (const f of ['shim.js', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) fs.copyFileSync(f, 'public/' + f);
console.log('built, page bytes', html.length);
