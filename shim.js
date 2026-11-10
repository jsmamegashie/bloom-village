/* Bloom Village standalone runtime.
   Gives the village the same window.claude.use(...) features it had on claude.ai:
   db -> Supabase (through a passcode-checked database function)
   sample -> /api/sample (your Anthropic key stays on the server)
   assets -> Vercel Blob, downloads -> browser download, user -> owner. */
(function () {
  const SB_URL = 'https://ktihbuebzmkbjqfcummz.supabase.co';
  const SB_KEY = 'sb_publishable_C2x_plI5q9oFAZgUUta1Vg_03DbXO1_';
  const PASS_KEY = 'bv_pass';
  let pass = null; try { pass = localStorage.getItem(PASS_KEY); } catch (e) { }

  /* ---------- passcode gate ---------- */
  async function rpc(op, args) {
    const r = await fetch(SB_URL + '/rest/v1/rpc/village', {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY },
      body: JSON.stringify({ pass: pass || '', op, args: args || {} })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = new Error((j && j.message) || 'Database error'); e.code = (j && /passcode/i.test(j.message || '')) ? 'bad_pass' : 'db_error'; throw e; }
    return j;
  }
  let ready = null;
  function gate() {
    if (ready) return ready;
    ready = (async () => {
      if (pass) { try { await rpc('auth'); return true; } catch (e) { if (e.code !== 'bad_pass') return true; pass = null; } }
      return new Promise(res => {
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:rgba(30,22,20,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:16px';
        box.innerHTML = '<form id="bvGate" style="background:#fffbf4;border-radius:18px;padding:22px;display:grid;gap:12px;width:min(340px,100%);font-family:Figtree,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35)"><b style="font:400 24px \'Young Serif\',Georgia,serif;color:#2a2421">Bloom Village</b><span style="font-size:13px;color:#6e625a">Enter your village passcode. This device will remember it.</span><input type="password" autocomplete="current-password" placeholder="Passcode" style="font:15px system-ui;padding:11px 12px;border-radius:12px;border:1px solid rgba(42,36,33,.2)"><span class="err" style="font-size:12.5px;color:#c4466a"></span><button style="font:700 14px system-ui;padding:11px;border:0;border-radius:12px;background:#7b2d42;color:#fff;cursor:pointer">Open the village</button></form>';
        document.body.appendChild(box);
        const f = box.querySelector('form'), inp = box.querySelector('input'), err = box.querySelector('.err');
        setTimeout(() => inp.focus(), 50);
        f.addEventListener('submit', async ev => {
          ev.preventDefault(); pass = inp.value.trim(); err.textContent = 'Checking...';
          try { await rpc('auth'); try { localStorage.setItem(PASS_KEY, pass); } catch (e) { } box.remove(); res(true); }
          catch (e) { err.textContent = e.code === 'bad_pass' ? 'That passcode is not right.' : 'Could not reach the village. Check your internet.'; }
        });
      });
    })();
    return ready;
  }

  /* ---------- database (Firestore-style API) ---------- */
  const listeners = new Set();
  let version = null, polling = false, refreshQueued = false;
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const docSnap = (path, row) => ({ id: path.split('/').pop(), ref: docRef(path), exists: !!row, data: () => row ? JSON.parse(JSON.stringify(row)) : undefined });
  const qSnap = rows => { const docs = rows.map(r => docSnap(r.path, r.data)); return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) }; };
  function spec(q) { return { parent: q.path, order: q.order || null, dir: q.dir || 'asc', limit: q.lim || 1000 }; }
  async function refreshAll() {
    if (refreshQueued) return; refreshQueued = true;
    await Promise.resolve(); refreshQueued = false;
    const ls = [...listeners]; if (!ls.length) return;
    try {
      const res = await rpc('batch', { docs: ls.filter(l => l.kind === 'doc').map(l => l.path), queries: ls.filter(l => l.kind === 'q').map(l => spec(l.q)) });
      let di = 0, qi = 0;
      for (const l of ls) {
        const out = l.kind === 'doc' ? res.docs[di++] : res.queries[qi++];
        const key = JSON.stringify(out);
        if (key === l.last) continue; l.last = key;
        try { l.next(l.kind === 'doc' ? docSnap(l.path, out) : qSnap(out)); } catch (e) { console.error(e); }
      }
    } catch (e) { for (const l of ls) l.error && l.error(e); }
  }
  async function poll() {
    if (polling) return; polling = true;
    for (; ;) {
      try { const v = (await rpc('version')).v; if (v !== version) { version = v; await refreshAll(); } } catch (e) { }
      await new Promise(r => setTimeout(r, document.hidden ? 20000 : 4000));
    }
  }
  function listen(l) { listeners.add(l); poll(); l.last = undefined; refreshAll(); return () => listeners.delete(l); }
  const wrote = r => { version = null; refreshAll(); return r; };
  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      get: async () => docSnap(path, (await rpc('get', { path })).data),
      set: (data, o) => rpc('set', { path, data, merge: !!(o && o.merge) }).then(wrote),
      update: patch => rpc('set', { path, data: patch, merge: true }).then(wrote),
      delete: () => rpc('delete', { path }).then(wrote),
      collection: sub => collRef(path + '/' + sub),
      onSnapshot: (next, error) => listen({ kind: 'doc', path, next, error })
    };
  }
  function collRef(path, q) {
    q = q || { path };
    return {
      id: path.split('/').pop(), path,
      doc: id => docRef(path + '/' + (id || rid())),
      add: async data => { const id = rid(); await rpc('set', { path: path + '/' + id, data, merge: false }); wrote(); return docRef(path + '/' + id); },
      orderBy: (field, dir) => collRef(path, Object.assign({}, q, { order: field, dir: dir || 'asc' })),
      limit: n => collRef(path, Object.assign({}, q, { lim: n })),
      get: async () => qSnap(await rpc('list', spec(q))),
      onSnapshot: (next, error) => listen({ kind: 'q', q, next, error })
    };
  }
  const db = { doc: docRef, collection: p => collRef(p) };

  /* ---------- Claude (sample) ---------- */
  const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  async function sample(turns, opts) {
    opts = opts || {};
    const msgs = [];
    for (const t of turns) {
      const content = typeof t.content === 'string' ? [{ type: 'text', text: t.content }] : t.content;
      const last = msgs[msgs.length - 1];
      if (last && last.role === t.role) last.content.push(...content); else msgs.push({ role: t.role, content: [...content] });
    }
    if (msgs.length && msgs[0].content[0]) msgs[0].content[0].cache_control = { type: 'ephemeral' };
    if (opts.images && opts.images.length) {
      const lastUser = [...msgs].reverse().find(m => m.role === 'user');
      for (const im of opts.images) lastUser.content.unshift({ type: 'image', source: { type: 'base64', media_type: im.type || 'image/jpeg', data: await b64(im) } });
    }
    const tools = (opts.tools || []).map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: 'object', properties: {} } }));
    let text = '', truncated = false;
    for (let step = 0; step < 8; step++) {
      const r = await fetch('/api/sample', {
        method: 'POST', signal: opts.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pass, tier: opts.modelTier || 'default', messages: msgs, tools, max_tokens: opts.maxTokens || 2000 })
      }).catch(e => { const x = new Error('cancelled'); x.code = e && e.name === 'AbortError' ? 'cancelled' : 'network'; throw x; });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const e = new Error(j.error || 'error');
        e.code = r.status === 429 ? 'rate_limited' : r.status === 401 ? 'not_granted' : 'error';
        if (j.friendly) e.text = j.friendly;
        throw e;
      }
      const said = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
      if (said) { text = text ? text + '\n\n' + said : said; opts.onText && opts.onText({ text }); }
      truncated = j.stop_reason === 'max_tokens';
      const uses = (j.content || []).filter(c => c.type === 'tool_use');
      if (j.stop_reason !== 'tool_use' || !uses.length) break;
      msgs.push({ role: 'assistant', content: j.content });
      const results = [];
      for (const u of uses) {
        const tool = (opts.tools || []).find(t => t.name === u.name);
        try { const out = tool ? await tool.execute(u.input || {}) : { error: 'unknown tool' }; results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out === undefined ? { ok: true } : out) }); }
        catch (e) { results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: String(e && e.message || e) }); }
      }
      msgs.push({ role: 'user', content: results });
    }
    return { text, truncated };
  }
  sample.limits = async () => ({ tools: true, images: { maxCount: 4 } });

  /* ---------- files (Vercel Blob, uploaded straight from the browser) ---------- */
  const assets = {
    async upload(blob, o) {
      const { upload } = await import('https://esm.sh/@vercel/blob@1.1.1/client');
      const type = (o && o.type) || blob.type || 'application/octet-stream';
      const ext = (type.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8);
      const name = (blob.name || ('file.' + ext)).replace(/[^\w.\-]+/g, '-');
      const r = await upload('village/' + name, blob, { access: 'public', handleUploadUrl: '/api/upload', clientPayload: pass, contentType: type });
      return { url: r.url, id: r.pathname };
    }
  };
  const downloads = {
    async save({ filename, data }) {
      const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      const a = document.createElement('a'); a.href = u; a.download = filename || 'download'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 30000); return { ok: true };
    }
  };
  const user = { can: async () => true, me: async () => ({ id: 'joanita', name: 'Joanita' }) };

  const caps = { db, sample, assets, downloads, user };
  window.BLOOM_STANDALONE = true;
  window.claude = { use: async name => { await gate(); return caps[name] || null; } };

  /* ---------- PWA ---------- */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__bip = e; window.dispatchEvent(new Event('bloom-installable')); });
})();
