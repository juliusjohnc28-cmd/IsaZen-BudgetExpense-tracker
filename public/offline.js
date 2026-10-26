/* IsaZen offline mode.
   - Keeps a copy of your data on this phone after every load, so the app opens with no internet.
   - While offline, adds / edits / deletes are saved on the phone in a waiting list and shown right away.
   - When the connection is back they are sent to Supabase in the same order, then the app reloads the real data.
   Needs app.js loaded first (shares sb, S, load, render, toast). */
const OFF = (() => {
  if (typeof sb === 'undefined' || !sb) return { down: () => false, fallback: async () => {}, flush: async () => {}, saveCache() {}, pending: () => 0, beforeOut: () => true, clear() {}, needNet: () => false };
  const realFrom = sb.from.bind(sb);
  const LAST = 'isazen-last', CK = id => 'isazen-cache-' + id, QK = id => 'isazen-queue-' + id;
  const KEYS = ['stores', 'tx', 'ptx', 'oe', 'debts', 'wallets', 'transfers', 'goals', 'gcs'];
  const TBL = { stores: 'stores', overall_expenses: 'oe', debts: 'debts', wallets: 'wallets', transfers: 'transfers', goals: 'goals', goal_contributions: 'gcs' };
  const FK = ['store_id', 'wallet_id', 'goal_id', 'from_wallet', 'to_wallet'];
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const uid = () => S.user?.id || get(LAST)?.uid || '';
  let queue = [], qUser = '', syncing = false, authBlocked = false;
  const loadQueue = () => { const u = uid(); if (u && u !== qUser) { qUser = u; queue = get(QK(u)) || []; } };
  const saveQueue = () => { if (qUser) put(QK(qUser), queue); banner(); };
  const isNet = e => !!e && (e.status === 0 || /failed to fetch|networkerror|network request|load failed|fetch failed|timed? ?out|econn|offline/i.test(e.message || ''));
  const isAuth = e => !!e && (e.status === 401 || e.code === 'PGRST301' || /jwt|not authenticated|invalid token/i.test(e.message || ''));
  const down = () => !navigator.onLine;
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });

  /* ---------- saved copy of your data ---------- */
  function saveCache() {
    if (!S.user || !S.loaded) return; const u = S.user.id;
    const o = { at: Date.now() }; KEYS.forEach(k => o[k] = S[k] || []); o.history = (S.history || []).slice(0, 100);
    if (!put(CK(u), o)) { o.history = []; put(CK(u), o); }
    put(LAST, { uid: u, user: { id: u, email: S.user.email, user_metadata: S.user.user_metadata || {} } });
  }
  function restore() {
    const l = get(LAST); if (!l) return false; const c = get(CK(l.uid)); if (!c) return false;
    if (!S.user) S.user = l.user; KEYS.forEach(k => S[k] = c[k] || []); S.history = c.history || [];
    S.walletsErr = ''; S.goalsErr = ''; return true;
  }

  /* ---------- show changes on screen right away ---------- */
  const lists = t => t === 'transactions' ? [S.tx, S.ptx] : [S[TBL[t]]];
  const sortTx = () => { const f = (a, b) => (b.occurred_on || '').localeCompare(a.occurred_on || '') || (b.created_at || '').localeCompare(a.created_at || ''); S.tx.sort(f); S.ptx.sort(f); S.oe.sort(f); };
  function applyLocal(op) {
    const { t, kind, id } = op;
    if (kind === 'insert') {
      const r = op.row;
      if (t === 'transactions') (r.workspace === 'personal' ? S.ptx : S.tx).unshift(r); else S[TBL[t]].push(r);
      if (t === 'stores') S.stores.sort((a, b) => String(a.name).localeCompare(b.name)); sortTx();
    } else if (kind === 'update') {
      lists(t).forEach(l => { const r = l.find(x => x.id === id); if (r) Object.assign(r, op.patch); });
      if (t === 'transactions' && op.patch.workspace) { /* workspace never changes from the UI */ }
    } else if (kind === 'delete') {
      lists(t).forEach(l => { const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); });
      if (t === 'stores') S.tx = S.tx.filter(x => x.store_id !== id);
      if (t === 'wallets') { S.transfers = S.transfers.filter(x => x.from_wallet !== id && x.to_wallet !== id); [S.tx, S.ptx, S.gcs].forEach(l => l.forEach(x => { if (x.wallet_id === id) x.wallet_id = null; })); }
      if (t === 'goals') S.gcs = S.gcs.filter(x => x.goal_id !== id);
    }
  }

  /* ---------- the waiting list ---------- */
  function enqueue(st) {
    loadQueue(); const t = st.t, now = new Date().toISOString(), out = [];
    if (st.kind === 'insert') {
      (Array.isArray(st.payload) ? st.payload : [st.payload]).forEach(p => {
        const row = { id: uuid(), created_at: now, user_id: S.user?.id, ...p }; const op = { t, kind: 'insert', id: row.id, row }; applyLocal(op); queue.push({ t, kind: 'insert', id: row.id, row: { id: row.id, ...p } }); out.push(row);
      });
    } else {
      const col = Object.keys(st.match)[0], val = st.match[col]; if (col !== 'id') return { data: null, error: { message: 'Offline: this change needs internet.' } };
      if (st.kind === 'update') {
        const pend = queue.find(o => o.kind === 'insert' && o.t === t && o.id === val);
        if (pend) Object.assign(pend.row, st.payload); else queue.push({ t, kind: 'update', id: val, patch: st.payload });
        applyLocal({ t, kind: 'update', id: val, patch: st.payload });
      } else {
        const gone = new Set([val]), wasNew = queue.some(o => o.kind === 'insert' && o.id === val);
        if (wasNew) { queue = queue.filter(o => { if (t === 'wallets' && o.t !== 'transfers' && o.row && o.row.wallet_id === val) { o.row.wallet_id = null; return true; } const hit = o.id === val || (o.row && FK.some(f => o.row[f] === val)); if (hit && o.id) gone.add(o.id); return !hit; }); }
        else queue.push({ t, kind: 'delete', id: val });
        applyLocal({ t, kind: 'delete', id: val });
        gone.forEach(g => { if (g !== val) applyLocal({ t: 'transactions', kind: 'delete', id: g }); });
      }
    }
    saveQueue(); saveCache();
    return { data: st.single ? (out[0] ? { id: out[0].id } : null) : out, error: null };
  }

  /* ---------- sending to Supabase ---------- */
  function replay(o) {
    let q = realFrom(o.t);
    if (o.kind === 'insert') return q.insert(o.row);
    q = o.kind === 'update' ? q.update(o.patch) : q.delete(); return q.eq('id', o.id);
  }
  async function flush() {
    loadQueue(); if (syncing || down() || !queue.length || !S.user) return 0;
    syncing = true; authBlocked = false; let done = 0, failed = 0, lastErr = '';
    try {
      while (queue.length) {
        const o = queue[0]; let r;
        try { r = await replay(o); } catch (e) { r = { error: { message: String(e.message || e) } }; }
        if (r.error && (isNet(r.error) || isAuth(r.error))) { authBlocked = isAuth(r.error) && !isNet(r.error); break; }
        if (r.error && !/duplicate key/i.test(r.error.message)) { failed++; lastErr = r.error.message; } else done++;
        queue.shift(); saveQueue();
      }
    } finally { syncing = false; banner(); }
    if (done || failed) {
      if (!queue.length || failed) toast(failed ? `${done} synced, ${failed} could not be saved (${lastErr}).` : `Back online. ${done} change${done > 1 ? 's' : ''} synced.`);
    }
    return done + failed;
  }

  /* ---------- wrap sb.from so writes work offline ---------- */
  function writer(t, kind) {
    return payload => {
      const st = { t, kind, payload, match: {}, single: false }; let sel = null;
      const b = {
        eq(c, v) { st.match[c] = v; return b; },
        select(c) { sel = c || '*'; return b; },
        single() { st.single = true; return b; },
        maybeSingle() { st.single = true; return b; },
        then(ok, bad) {
          return (async () => {
            loadQueue();
            if (down()) return enqueue(st);
            let q = realFrom(t)[kind](kind === 'delete' ? undefined : payload);
            for (const c in st.match) q = q.eq(c, st.match[c]);
            if (sel) q = q.select(sel); if (st.single) q = q.single();
            const r = await q;
            if (r.error && isNet(r.error)) return enqueue(st);
            return r;
          })().then(ok, bad);
        }
      };
      return b;
    };
  }
  sb.from = t => {
    const real = realFrom(t), W = { insert: writer(t, 'insert'), update: writer(t, 'update'), delete: writer(t, 'delete') };
    return new Proxy(real, { get(tg, p) { if (W[p]) return W[p]; const v = tg[p]; return typeof v === 'function' ? v.bind(tg) : v; } });
  };

  /* ---------- notice bar ---------- */
  function banner() {
    loadQueue(); const n = queue.length; let d = document.getElementById('pwa-offline');
    const msg = down() ? 'Offline: changes are saved on this phone' + (n ? ` (${n} waiting)` : '') + ' and sync when you are back online.'
      : n ? (authBlocked ? `${n} change${n > 1 ? 's' : ''} waiting. Sign in again to sync them.` : `${n} change${n > 1 ? 's' : ''} waiting to sync. Tap to try again.`) : '';
    if (!msg) { if (d) d.remove(); return; }
    if (!d) { d = document.createElement('div'); d.id = 'pwa-offline'; d.onclick = () => { if (!down()) flush().then(() => load()); }; document.body.appendChild(d); }
    d.textContent = msg;
  }

  /* ---------- hooks used by app.js ---------- */
  async function fallback() {
    if (!S.loaded) {
      if (!restore()) { toast('No saved data on this phone yet. Connect to the internet once to download it.'); render(); return; }
      S.loaded = true; S.tab = (S.space === 'personal' || S.stores.length) ? 'overview' : 'stores';
    }
    loadQueue(); render(); banner();
  }
  function needNet(what) { if (!down()) return false; toast((what || 'This') + ' needs internet. Try again when you are online.'); return true; }
  function beforeOut() { loadQueue(); return !queue.length || confirm(`You have ${queue.length} change${queue.length > 1 ? 's' : ''} that have not synced yet. Signing out will lose them. Sign out anyway?`); }
  function clear() { try { Object.keys(localStorage).filter(k => /^isazen-(cache|queue|last)/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} queue = []; qUser = ''; banner(); }

  window.addEventListener('online', () => { banner(); flush().then(n => { if (S.user) load(); }); });
  window.addEventListener('offline', () => { banner(); });
  /* Opening the app with no internet: supabase may not hand back the saved sign-in, so use the saved profile. */
  const boot = () => { if (!S.user && down()) { const l = get(LAST); if (l) { S.user = l.user; load(); } } };
  setTimeout(boot, 900); setTimeout(boot, 2500); window.addEventListener('offline', boot);
  banner();
  return { down, fallback, flush, saveCache, pending: () => { loadQueue(); return queue.length; }, beforeOut, clear, needNet };
})();
