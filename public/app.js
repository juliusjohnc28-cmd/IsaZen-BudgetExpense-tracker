const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const LIB = typeof supabase !== 'undefined';
const READY = LIB && SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT');
const sb = READY ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const A = document.getElementById('app');
const $ = s => document.querySelector(s);
const peso = n => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(+n || 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const NAME = window.APP_CONFIG.APP_NAME || 'IsaZen Budget and Expense Manager';
document.title = NAME;
const ICON = { overview: '▦', transactions: '⇄', stores: '⌂', budgets: '◔', utang: '⇋', wallets: '◍', goals: '◎', history: '◷', reports: '▤' };
const meta = () => S.user?.user_metadata || {};
const fullName = () => String(meta().full_name || meta().name || '').trim();
const firstName = () => fullName().split(/\s+/)[0] || '';
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const S = { space: (() => { try { return localStorage.getItem('bt-space') === 'personal' ? 'personal' : 'business'; } catch (e) { return 'business'; } })(), ptx: [], debts: [], wallets: [], transfers: [], goals: [], gcs: [], mode: 'in', user: null, tab: 'overview', q: '', period: 'month', anchor: today(), store: '', stores: [], tx: [], oe: [], history: [] };
const TABS = { overview: 'Overview', transactions: 'Transactions', stores: 'Stores', history: 'History', reports: 'Reports' };
const PTABS = { overview: 'Overview', transactions: 'Transactions', wallets: 'Wallets', goals: 'Goals', budgets: 'Budgets', utang: 'Utang', history: 'History', reports: 'Reports' };
const tabsFor = () => S.space === 'personal' ? PTABS : TABS;
const PCATS = ['Food', 'Groceries', 'Transport', 'Bills', 'Rent', 'Shopping', 'Health', 'Education', 'Entertainment', 'Savings', 'Salary', 'Allowance', 'Other'];

const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500); };
const hit = (...v) => v.join(' ').toLowerCase().includes(S.q.trim().toLowerCase());
const parse = d => new Date(d + 'T00:00');
const monday = d => { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return m; };
const fmtShort = d => parse(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const range = () => {
  if (S.period === 'all') return null;
  const d = parse(S.anchor);
  if (S.period === 'day') return [S.anchor, S.anchor];
  if (S.period === 'week') { const m = monday(d), e = new Date(m); e.setDate(m.getDate() + 6); return [ymd(m), ymd(e)]; }
  return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
};
const inMonth = t => { const r = range(); return !r || (t.occurred_on >= r[0] && t.occurred_on <= r[1]); };
const periodLabel = () => {
  const r = range(); if (!r) return 'all time';
  if (S.period === 'day') return S.anchor === today() ? 'Today' : parse(S.anchor).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (S.period === 'week') return `${fmtShort(r[0])} – ${fmtShort(r[1])}` + (r[0] <= today() && today() <= r[1] ? ' (this week)' : '');
  return parse(r[0]).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
};
const shift = n => {
  const d = parse(S.anchor), per = S.tab === 'budgets' ? 'month' : S.period;
  if (per === 'day') d.setDate(d.getDate() + n); else if (per === 'week') d.setDate(d.getDate() + 7 * n); else { d.setDate(1); d.setMonth(d.getMonth() + n); }
  S.anchor = ymd(d);
};
const periodBar = () => `<div class="seg">${[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['all', 'All time']].map(([p, l]) => `<button data-p="${p}" class="${S.period === p ? 'on' : ''}">${l}</button>`).join('')}</div>
${S.period !== 'all' ? `<div class="nav"><button id="prev" title="Previous">‹</button><b>${periodLabel()}</b><button id="next" title="Next">›</button><button id="now">Today</button><input type="date" id="jump" value="${S.anchor}"></div>` : ''}`;
const spans = () => {
  const t = today(), d = parse(t), m = monday(d), e = new Date(m); e.setDate(m.getDate() + 6);
  return [['Today', t, t], ['This week', ymd(m), ymd(e)], ['This month', ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))]];
};
const quick = rows => `<div class="quick">${spans().map(([l, f, t]) => { const r = rows.filter(x => x.occurred_on >= f && x.occurred_on <= t), n = sumBy(r, 'income') - sumBy(r, 'expense'); return `<div class="q"><span>${l}</span><b class="${cls(n)}">${peso(n)}</b></div>`; }).join('')}</div>`;
const periodTiles = rows => `<div class="tiles mini">${spans().map(([l, f, t]) => { const r = rows.filter(x => x.occurred_on >= f && x.occurred_on <= t), i = sumBy(r, 'income'), e = sumBy(r, 'expense'), n = i - e;
  return `<div class="tile ${dir(n)}"><div class="tt"><b>${l}</b><span class="badge ${cls(n)}">${status(n)}</span></div><div class="big ${cls(n)}">${peso(n)}</div><div class="split"><span>Income<b>${peso(i)}</b></span><span>Expenses<b>${peso(e)}</b></span></div></div>`; }).join('')}</div>`;
function buckets() {
  const a = parse(S.period === 'all' ? today() : S.anchor), out = [];
  if (S.period === 'day') for (let k = 6; k >= 0; k--) { const d = new Date(a); d.setDate(a.getDate() - k); const s = ymd(d); out.push({ f: s, t: s, l: d.toLocaleDateString('en-PH', { weekday: 'short' }), cur: k === 0 }); }
  else if (S.period === 'week') { const m = monday(a); for (let k = 7; k >= 0; k--) { const f = new Date(m); f.setDate(m.getDate() - 7 * k); const e = new Date(f); e.setDate(f.getDate() + 6); out.push({ f: ymd(f), t: ymd(e), l: fmtShort(ymd(f)), cur: k === 0 }); } }
  else for (let k = 5; k >= 0; k--) { const f = new Date(a.getFullYear(), a.getMonth() - k, 1), e = new Date(a.getFullYear(), a.getMonth() - k + 1, 0); out.push({ f: ymd(f), t: ymd(e), l: f.toLocaleDateString('en-PH', { month: 'short' }), cur: k === 0 }); }
  return out;
}
const storeName = id => S.stores.find(s => s.id === id)?.name || '(deleted store)';
const sumBy = (r, k) => r.filter(t => t.kind === k).reduce((a, t) => a + +t.amount, 0);
const OVERALL = 'overall';
const allRows = () => S.space === 'personal' ? S.ptx : [...S.tx, ...S.oe.map(o => ({ ...o, kind: 'expense', store_id: null }))];
const cls = n => n > 0 ? 'pos' : n < 0 ? 'neg' : '';
const status = n => S.space === 'personal' ? (n > 0 ? '▲ Surplus' : n < 0 ? '▼ Deficit' : 'Even') : (n > 0 ? '▲ Profit' : n < 0 ? '▼ Loss' : 'Break-even');
const txFiltered = () => S.tx.filter(t => inMonth(t) && (!S.store || t.store_id === S.store) &&
  hit(t.occurred_on, storeName(t.store_id), t.kind, t.description, t.category, t.amount, peso(t.amount)));

async function loadHistory() {
  if (typeof OFF !== 'undefined' && OFF.down()) return;
  const h = await sb.from('history').select('*').order('created_at', { ascending: false }).limit(500);
  S.history = h.data || [];
  if (S.tab === 'history') render();
}
async function load(retry) {
  if (typeof OFF !== 'undefined') { if (OFF.down()) return OFF.fallback(); await OFF.flush(); }
  await sb.auth.getSession(); // refreshes an expired sign-in before we ask for data
  const [a, b, c, dd, ww, tt, gg, gk] = await Promise.all([
    sb.from('stores').select('*').order('name'),
    sb.from('transactions').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('overall_expenses').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('debts').select('*').order('created_at', { ascending: false }),
    sb.from('wallets').select('*').order('created_at'),
    sb.from('transfers').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('goals').select('*').order('created_at'),
    sb.from('goal_contributions').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false })]);
  if ([a, b, c, dd, ww, tt, gg, gk].some(r => r.error && /jwt expired|invalid jwt/i.test(r.error.message || ''))) {
    if (!retry) { const r = await sb.auth.refreshSession().catch(() => ({})); if (r.data?.session) return load(true); }
    toast('Your session expired. Please sign in again.'); await sb.auth.signOut(); return;
  }
  if (typeof OFF !== 'undefined' && [a, b, c, dd, ww, tt, gg, gk].some(r => r.error && !r.data && /failed to fetch|networkerror|network request|load failed|fetch failed|timed? ?out/i.test(r.error.message || ''))) return OFF.fallback();
  S.goals = gg.data || []; S.gcs = gk.data || []; S.goalsErr = (gg.error || gk.error)?.message || '';
  S.wallets = ww.data || []; S.transfers = tt.data || []; S.walletsErr = (ww.error || tt.error)?.message || '';
  S.debts = dd.data || []; if (dd.error && S.space === 'personal') toast(dd.error.message + ' (run the latest schema.sql for Utang)');
  S.stores = a.data || []; const all = b.data || []; S.tx = all.filter(x => x.workspace !== 'personal'); S.ptx = all.filter(x => x.workspace === 'personal'); S.oe = c.data || [];
  if (a.error || b.error || c.error) toast((a.error || b.error || c.error).message + ' (did you run the latest schema.sql?)');
  if (!S.loaded) { S.loaded = true; S.tab = (S.space === 'personal' || S.stores.length) ? 'overview' : 'stores'; }
  await loadHistory(); render(); if (typeof OFF !== 'undefined') OFF.saveCache();
}
async function run(p) { const { error } = await p; if (error) toast(error.message); await load(); }

const SOCIAL_ICON = {
  google: '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4.1 7-10.1 7-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>'
};
async function oauth(provider) {
  const label = 'Google';
  try { // is this provider switched on in Supabase? (otherwise the browser would land on a JSON error page)
    const r = await fetch(window.APP_CONFIG.SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: window.APP_CONFIG.SUPABASE_ANON_KEY } });
    const st = await r.json();
    if (st?.external && st.external[provider] === false) return toast(label + ' sign-in is not turned on yet. In Supabase go to Authentication > Providers > ' + label + ' (see README).');
  } catch (e) { /* offline or blocked: just try */ }
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } });
  if (error) toast(error.message);
}

const authView = () => { const m = S.mode, up = m === 'up', fg = m === 'forgot', rs = m === 'reset';
  const sub = up ? 'Create an account for your business.' : fg ? 'Enter your email and we will send you a link to reset your password.' : rs ? 'Choose a new password for your account.' : 'Sign in to manage your business expenses.';
  return `<form id="auth" class="login"><div class="loginlogo"><img src="logo-full.png" alt="IsaZen"></div><h1 class="ltitle">Budget and Expense Manager</h1>
<p>${sub}</p>
${up ? '<input id="fn" placeholder="Full name" autocomplete="name" maxlength="80" required><input id="bn" placeholder="Business name (optional)" autocomplete="organization">' : ''}
${rs ? '' : '<input id="em" type="email" placeholder="Email" autocomplete="email" required>'}
${fg ? '' : `<input id="pw" type="password" placeholder="${rs ? 'New password (6+ characters)' : 'Password (6+ characters)'}" autocomplete="${up || rs ? 'new-password' : 'current-password'}" required minlength="6">`}
${up || rs ? `<input id="pw2" type="password" placeholder="Confirm ${rs ? 'new ' : ''}password" autocomplete="new-password" required>` : ''}
<button class="primary">${up ? 'Create account' : fg ? 'Send reset link' : rs ? 'Save new password' : 'Sign in'}</button>
${m === 'in' || up ? `<div class="or"><span>or</span></div><div class="social"><button type="button" class="soc" data-oauth="google">${SOCIAL_ICON.google}<span>${up ? 'Sign up' : 'Continue'} with Google</span></button></div>${up ? '<small class="hint">With Google, your name comes from your account.</small>' : ''}` : ''}
${m === 'in' ? '<button type="button" id="forgot" class="link">Forgot password?</button>' : ''}
<button type="button" class="link themebtn" data-theme-toggle>${themeLabel()}</button>
${rs ? '' : `<button type="button" id="mode" class="link">${up || fg ? 'Back to sign in' : 'New here? Create an account'}</button>`}</form>`; };

function modalHtml() {
  const m = S.modal, close = '<button id="mclose">Cancel</button>';
  const pw = (id, ph) => `<input id="${id}" type="password" placeholder="${ph}" autocomplete="off">`;
  const body = m === 'wtx' ? wtxModal() : m === 'gcon' ? gcModal() : m === 'profile'
    ? `<h3>Your profile</h3><p>This name appears in your greeting and on printed reports.</p><input id="p_name" placeholder="Full name" autocomplete="name" maxlength="80" value="${esc(fullName())}"><input id="p_biz" placeholder="Business name (optional)" autocomplete="organization" value="${esc(meta().business || '')}"><div class="acts"><button id="dosaveprofile" class="primary">Save</button>${close}</div>`
    : m === 'reset'
    ? `<h3>Reset all data</h3><p>This permanently deletes <b>all stores, transactions and history</b> and cannot be undone. Enter your passcode to continue.</p>${pw('m_code', 'Passcode')}<div class="acts"><button id="doreset" class="danger">Reset everything</button>${close}</div><button class="link" id="tochange">Change passcode</button>`
    : `<h3>${m === 'set' ? 'Set a passcode' : 'Change passcode'}</h3><p>${m === 'set' ? 'Choose a passcode (4+ characters) to protect Reset all. It cannot be recovered if you forget it.' : 'Enter your current passcode, then a new one.'}</p>${m === 'change' ? pw('m_old', 'Current passcode') : ''}${pw('m_new', 'New passcode')}${pw('m_new2', 'Confirm new passcode')}<div class="acts"><button id="dosave" class="primary">Save passcode</button>${close}</div>`;
  return `<div class="overlay" id="ov"><div class="dialog">${body}</div></div>`;
}

function render() {
  if (!READY) { A.innerHTML = !LIB ? '<div class="login"><h1>Can\'t load right now</h1><p>Please check your internet connection, then reload the app.</p><button class="primary" onclick="location.reload()">Reload</button></div>' : '<div class="login"><h1>Setup needed</h1><p>Add your Supabase URL and anon key to <b>public/config.js</b>.</p></div>'; return; }
  if (!S.user || S.recovery) { A.innerHTML = authView(); return; }
  const showMonth = S.tab === 'overview' || S.tab === 'transactions';
  const r = allRows().filter(inMonth), n = sumBy(r, 'income') - sumBy(r, 'expense'), per = periodLabel();
  const who = S.space === 'personal' ? (firstName() || S.user.email.split('@')[0]) : (firstName() || meta().business || S.user.email.split('@')[0]);
  if (!tabsFor()[S.tab]) S.tab = 'overview';
  const msg = S.space === 'personal' ? (!S.ptx.length ? 'Record your first income or expense to start tracking your personal money.'
    : !r.length ? 'No entries for this period yet. Tap Income or Expense to add one.'
    : n > 0 ? `You saved ${peso(n)} in ${per}. Nice!` : n < 0 ? `You spent ${peso(-n)} more than you earned in ${per}. Review your expenses.` : `Income and expenses are even for ${per}.`)
    : !S.stores.length ? 'Add your first store, then record income and expenses to see your profit here.'
    : !r.length ? 'No transactions for this period yet. Tap Income or Expense to add one.'
    : n > 0 ? `All stores are in profit: ${peso(n)} net for ${per}. Keep it up!`
    : n < 0 ? `You are ${peso(-n)} in the red for ${per}. Review your expenses.` : `Income and expenses are even for ${per}.`;
  A.innerHTML = `<div class="shell"><aside class="side${S.menu ? ' open' : ''}"><div class="brand"><img class="mark" src="mark.png" alt="IsaZen"><div class="bname"><b>IsaZen</b><span class="bsub">Budget and Expense Manager</span></div></div>
<button type="button" class="burger" id="burger" aria-label="Menu" aria-expanded="${S.menu ? 'true' : 'false'}"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
<div class="menu"><small>WORKSPACE</small>${Object.entries(tabsFor()).map(([k, v]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${ICON[k]}  ${v}</button>`).join('')}
<small>QUICK ACTIONS</small><button class="inc" data-qa="income">＋  Income</button><button class="exp" data-qa="expense">－  Expense</button>
<div class="foot"><span>${fullName() ? `<b>${esc(fullName())}</b><br>` : ''}${esc(S.user.email)}<br><button type="button" id="editname" class="link">${fullName() ? 'Edit profile' : 'Add your name'}</button></span><button type="button" class="themebtn" data-theme-toggle>${themeLabel()}</button><button id="out">Sign out</button><button id="openreset" class="dangerlink">Reset all data…</button><small style="opacity:.5;text-align:center">Build 2026-10-03 · Reports</small></div></div></aside>
<main><div class="top"><div class="toprow"><small>${new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</small><div class="seg spaceseg" role="tablist" aria-label="Workspace"><button type="button" data-space="business" class="${S.space === 'business' ? 'on' : ''}">🏪 Business</button><button type="button" data-space="personal" class="${S.space === 'personal' ? 'on' : ''}">👤 Personal</button></div></div><h2>${greet()}, ${esc(who)}!</h2></div>
${S.tab === 'reports' ? '' : `<div class="bar"><input id="q" type="search" placeholder="Search ${S.tab}…" value="${esc(S.q)}">
${showMonth ? periodBar() : S.tab === 'budgets' ? monthNav() : ''}</div>`}
${S.tab === 'transactions' ? '<div id="sum"></div>' : ''}
<div class="content">${{ overview, transactions: txGrid, stores: storeGrid, budgets: budgetsView, utang: utangView, wallets: walletsView, goals: goalsView, history: histGrid, reports: reportsView }[S.tab]()}</div></main></div>${S.modal ? modalHtml() : ''}${typeof companionHtml === 'function' ? companionHtml(msg) : ''}`;
  totals();
  if (typeof aiAfterRender === 'function') aiAfterRender();
}

function totals() {
  const r = allRows().filter(t => inMonth(t) && (S.tab !== 'transactions' || !S.store || S.store === OVERALL || t.store_id === S.store)), i = sumBy(r, 'income'), e = sumBy(r, 'expense'), n = i - e, per = periodLabel();
  const el = $('#sum');
  if (el) el.innerHTML = `<div class="card"><small>Income · ${per}</small><b>${peso(i)}</b></div>
<div class="card"><small>Expenses · ${per}</small><b>${peso(e)}</b></div>
<div class="card ${cls(n)}"><small>Net · ${status(n)}</small><b>${peso(n)}</b></div>`;
  const c = $('#cnt');
  if (c) { const x = txFiltered(), fi = sumBy(x, 'income'), fe = sumBy(x, 'expense'); c.textContent = `Showing ${Math.min(x.length, 200)} of ${x.length} · Income ${peso(fi)} · Expenses ${peso(fe)} · Net ${peso(fi - fe)}`; }
}

const PALETTE = ['#00844a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#475569'];
const safeColor = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : PALETTE[0];
const avatar = (s, big) => s && s.logo && s.logo.startsWith('data:image/')
  ? `<img class="av${big ? ' big' : ''}" src="${esc(s.logo)}" alt="">`
  : `<span class="av${big ? ' big' : ''}" style="background:${safeColor(s?.color)}">${esc((s?.name || '?').trim().charAt(0).toUpperCase())}</span>`;
const storeFields = s => `<label>Store name<input data-f="name" value="${esc(s.name || '')}" placeholder="e.g. Chef Jhang Store"></label>
<div class="lab">Color<span class="colorrow"><input type="color" data-f="color" value="${safeColor(s.color)}"><span class="sw">${PALETTE.map(c => `<button type="button" class="swatch" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</span></span></div>
<div class="lab">Logo (optional)<span class="logorow"><span class="av-prev">${avatar(s)}</span><input type="file" accept="image/*" data-logo><button type="button" class="rmlogo">Remove</button></span></div>`;
const toLogo = file => new Promise((res, rej) => {
  const img = new Image(), u = URL.createObjectURL(file);
  img.onload = () => { const c = document.createElement('canvas'), n = 96, m = Math.min(img.width, img.height);
    c.width = c.height = n; c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, n, n);
    URL.revokeObjectURL(u); res(c.toDataURL('image/png')); };
  img.onerror = () => rej(new Error('Could not read that image.'));
  img.src = u;
});
const logDate = d => { const x = parse(d); return x.toLocaleDateString('en-PH', x.getFullYear() === new Date().getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }); };
const logRow = o => `<div class="lrow" data-id="${o.id}" data-t="${o.t}"><span class="ld">${logDate(o.date)}</span><span class="lm"><b>${esc(o.title)}</b><small>${o.sub}</small></span><b class="la ${o.cls || ''}">${o.amt}</b><span class="lx">${o.noEdit ? '' : '<button class="edit">Edit</button>'}<button class="del">Delete</button></span></div>`;
const logBox = (rows, empty) => rows.length ? `<div class="log">${rows.join('')}</div>` : `<p class="empty">${empty}</p>`;
const kinds = k => `<option value="income" ${k === 'income' ? 'selected' : ''}>Income</option><option value="expense" ${k === 'expense' ? 'selected' : ''}>Expense</option>`;
const storeOpts = sel => S.stores.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const dir = n => n > 0 ? 'up' : n < 0 ? 'down' : '';
const vals = box => { const o = {}; box.querySelectorAll('[data-f]').forEach(el => o[el.dataset.f] = el.type === 'number' ? parseFloat(el.value) : el.value.trim()); return o; };

function overview() {
  if (S.space === 'personal') return pOverview();
  const rows = S.tx.filter(inMonth), orows = S.oe.filter(inMonth), lbl = periodLabel();
  const per = S.stores.filter(s => hit(s.name)).map(s => { const r = rows.filter(t => t.store_id === s.id); return { id: s.id, store: s, name: esc(s.name), i: sumBy(r, 'income'), e: sumBy(r, 'expense'), all: S.tx.filter(t => t.store_id === s.id) }; });
  const I = sumBy(rows, 'income'), E = sumBy(rows, 'expense'), OE = orows.reduce((a, t) => a + +t.amount, 0), N = I - E - OE;
  const top = per.length > 1 ? [...per].sort((a, b) => (b.i - b.e) - (a.i - a.e))[0] : null;
  const bars = buckets().map(b => { const r = allRows().filter(t => t.occurred_on >= b.f && t.occurred_on <= b.t); return { ...b, n: sumBy(r, 'income') - sumBy(r, 'expense') }; });
  const mx = Math.max(1, ...bars.map(b => Math.abs(b.n)));
  const trend = { day: 'Last 7 days', week: 'Last 8 weeks', month: 'Last 6 months', all: 'Last 6 months' }[S.period];
  const tile = p => { const n = p.i - p.e; return `<div class="tile open ${dir(n)}" data-open="${p.id}" style="border-top:4px solid ${safeColor(p.store.color)}"><div class="tt"><b>${avatar(p.store)}${p.name}</b><span class="badge ${cls(n)}">${status(n)}</span></div>
<div class="big ${cls(n)}">${peso(n)}</div><div class="split"><span>Income<b>${peso(p.i)}</b></span><span>Expenses<b>${peso(p.e)}</b></span></div>${quick(p.all)}</div>`; };
  return `<div class="tile overall ${dir(N)}"><div class="ov-main"><div><small>Overall · all stores · ${lbl}</small><div class="huge ${cls(N)}">${peso(N)}</div><span class="badge ${cls(N)}">${status(N)}</span>
<div class="split"><span>Income<b>${peso(I)}</b></span><span>Store expenses<b>${peso(E)}</b></span><span>Overall expenses<b>${peso(OE)}</b></span></div>${top ? `<small>Top store: <b>${top.name}</b> · ${peso(top.i - top.e)}</small>` : ''}</div>
<div class="chart-wrap"><small>Net profit · ${trend}</small><div class="chart">${bars.map(b => `<div class="col ${b.cur ? 'cur' : ''}" title="${b.l}: ${peso(b.n)}"><div class="cb ${b.n < 0 ? 'down' : 'up'}" style="height:${Math.round(Math.abs(b.n) / mx * 100)}%"></div><small>${b.l}</small></div>`).join('')}</div></div></div>
${quick(allRows())}</div>
<h3>Stores · ${lbl}</h3><div class="tiles">${per.map(tile).join('') || '<p class="empty">No stores yet. Add one on the Stores tab.</p>'}</div>`;
}

function overallTile(storeRows) {
  const orows = S.oe.filter(inMonth), i = sumBy(storeRows, 'income'), e = sumBy(storeRows, 'expense'), oe = orows.reduce((a, t) => a + +t.amount, 0), n = i - e - oe;
  return `<div class="tile open overall-tile ${dir(n)}" data-open="${OVERALL}" style="border-top:4px solid var(--deep)"><div class="tt"><b><span class="av" style="background:var(--deep)">Σ</span>Overall · All stores</b><span class="badge ${cls(n)}">${status(n)}</span></div>
<small>${storeRows.length + orows.length} entries · ${periodLabel()}</small><div class="big ${cls(n)}">${peso(n)}</div>
<div class="split"><span>Income<b>${peso(i)}</b></span><span>Store exp.<b>${peso(e)}</b></span><span>Overall exp.<b>${peso(oe)}</b></span></div>${quick(allRows())}<small class="go">Add salary, maintenance &amp; more ›</small></div>`;
}

function overallView() {
  const rows = allRows().filter(inMonth), per = S.stores.map(s => ({ s, i: sumBy(rows.filter(t => t.store_id === s.id), 'income') }));
  const I = sumBy(rows, 'income'), E = sumBy(S.tx.filter(inMonth), 'expense'), OE = S.oe.filter(inMonth).reduce((a, t) => a + +t.amount, 0), N = I - E - OE;
  const cats = [...new Set(['Salary', 'Maintenance', 'Rent', 'Utilities', ...S.oe.map(t => t.category)])];
  const fields = v => `<label>Description<input data-f="description" value="${esc(v.description)}" placeholder="e.g. Staff salary, aircon repair"></label>
<label>Category<input data-f="category" list="oecats" value="${esc(v.category)}" placeholder="Salary / Maintenance"></label>
<label>Date<input type="date" data-f="occurred_on" value="${v.occurred_on}"></label>
<label>Amount (₱)<input type="number" data-f="amount" step="0.01" min="0" value="${v.amount ?? ''}" placeholder="0.00"></label>`;
  const list = S.oe.filter(t => inMonth(t) && hit(t.occurred_on, t.category, t.description, t.amount, peso(t.amount)));
  const tile = t => S.edit === t.id
    ? `<div class="tile editing" data-id="${t.id}" data-t="overall_expenses"><div class="fields">${fields(t)}</div><div class="acts"><button class="save primary">Save</button><button class="cancel">Cancel</button></div></div>`
    : logRow({ id: t.id, t: 'overall_expenses', date: t.occurred_on, title: t.description || '(no description)', sub: esc(t.category), amt: '−' + peso(t.amount), cls: 'neg' });
  const spanTile = ([l, f, t]) => { const r = allRows().filter(x => x.occurred_on >= f && x.occurred_on <= t), i = sumBy(r, 'income'), e = sumBy(r, 'expense'), n = i - e;
    return `<div class="tile ${dir(n)}"><div class="tt"><b>${l}</b><span class="badge ${cls(n)}">${status(n)}</span></div><div class="big ${cls(n)}">${peso(n)}</div><div class="split"><span>Income<b>${peso(i)}</b></span><span>Expenses<b>${peso(e)}</b></span></div></div>`; };
  return `<div><button id="back">← All stores</button></div><h3><span class="av big" style="background:var(--deep)">Σ</span>Overall · All stores</h3>
<div class="tiles mini">${spans().map(spanTile).join('')}</div>
<div class="tile overall ${dir(N)}"><small>Overall income after deductions · ${periodLabel()}</small><div class="huge ${cls(N)}">${peso(N)}</div>
<div class="split"><span>Total income (all stores)<b>${peso(I)}</b></span><span>Store expenses<b>${peso(E)}</b></span><span>Overall expenses<b>${peso(OE)}</b></span></div>
<div class="split brk">${per.map(x => `<span>${esc(x.s.name)}<b>${peso(x.i)}</b></span>`).join('')}</div></div>
<datalist id="oecats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
<div class="tile addform"><b>New overall expense</b><div class="fields">${fields({ description: '', category: '', occurred_on: today(), amount: '' })}</div><button id="addoe" class="primary">Add overall expense</button></div>
<p class="count">Overall expenses are deducted from the combined income of all stores. Showing ${list.length} · ${peso(OE)}</p>
${logBox(list.slice(0, 200).map(tile), 'No overall expenses for this period.')}`;
}

function txGrid() {
  if (S.space === 'personal') return pTx();
  if (!S.stores.length) return '<p class="empty">Add a store on the Stores tab first, then record its income and expenses here.</p>';
  if (S.store === OVERALL) return overallView();
  if (S.store && !S.stores.some(s => s.id === S.store)) S.store = '';
  if (!S.store) {
    const rows = S.tx.filter(inMonth);
    const tiles = S.stores.filter(s => hit(s.name)).map(s => {
      const r = rows.filter(t => t.store_id === s.id), i = sumBy(r, 'income'), e = sumBy(r, 'expense'), n = i - e;
      return `<div class="tile open ${dir(n)}" data-open="${s.id}" style="border-top:4px solid ${safeColor(s.color)}"><div class="tt"><b>${avatar(s)}${esc(s.name)}</b><span class="badge ${cls(n)}">${status(n)}</span></div>
<small>${r.length} transactions · ${periodLabel()}</small><div class="big ${cls(n)}">${peso(n)}</div>
<div class="split"><span>Income<b>${peso(i)}</b></span><span>Expenses<b>${peso(e)}</b></span></div>${quick(S.tx.filter(t => t.store_id === s.id))}<small class="go">View transactions ›</small></div>`;
    });
    if (hit('overall all stores salary maintenance')) tiles.push(overallTile(rows));
    return `<p class="count">Pick a store to see and record its transactions.</p><div class="tiles">${tiles.join('') || '<p class="empty">No stores match.</p>'}</div>`;
  }
  const rows = txFiltered(), cats = [...new Set(S.tx.map(t => t.category))];
  const fields = v => `<label>Type<select data-f="kind">${kinds(v.kind)}</select></label>
<label>Store<select data-f="store_id">${storeOpts(v.store_id)}</select></label>
<label>Description<input data-f="description" value="${esc(v.description)}" placeholder="What was it for?"></label>
<label>Category<input data-f="category" list="cats" value="${esc(v.category)}" placeholder="General"></label>
<label>Date<input type="date" data-f="occurred_on" value="${v.occurred_on}"></label>
<label>Amount (₱)<input type="number" data-f="amount" step="0.01" min="0" value="${v.amount ?? ''}" placeholder="0.00"></label>`;
  const tile = t => S.edit === t.id
    ? `<div class="tile editing" data-id="${t.id}" data-t="transactions"><div class="fields">${fields(t)}</div><div class="acts"><button class="save primary">Save</button><button class="cancel">Cancel</button></div></div>`
    : logRow({ id: t.id, t: 'transactions', date: t.occurred_on, title: t.description || '(no description)', sub: esc(t.category), amt: (t.kind === 'income' ? '+' : '−') + peso(t.amount), cls: t.kind === 'income' ? 'pos' : 'neg' });
  return `<div><button id="back">← All stores</button></div><h3>${avatar(S.stores.find(x => x.id === S.store), true)}${esc(storeName(S.store))}</h3>
${periodTiles(S.tx.filter(t => t.store_id === S.store))}
<datalist id="cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
<div class="tile addform"><b>New transaction</b><div class="fields">${fields({ kind: S.pref || 'income', store_id: S.store, description: '', category: '', occurred_on: today(), amount: '' })}</div><button id="add" class="primary">Add transaction</button></div>
<p class="count" id="cnt"></p>${logBox(rows.slice(0, 200).map(tile), 'No transactions yet for this store and period.')}`;
}


/* ---------- Personal space ---------- */
function setSpace(sp) {
  S.space = sp; try { localStorage.setItem('bt-space', sp); } catch (e) { /* private mode */ }
  S.tab = 'overview'; S.store = ''; S.q = ''; S.edit = null; S.modal = null; S.menu = false;
  if (S.ai) { S.ai.msgs = []; S.ai.draft = ''; }
  render(); toast(sp === 'personal' ? 'Personal mode: your own income and expenses.' : 'Business mode: stores and overall expenses.');
}
const monthNav = () => `<div class="nav"><button id="prev" title="Previous month">‹</button><b>${parse(S.anchor).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</b><button id="next" title="Next month">›</button><button id="now">This month</button></div>`;
const budgets = () => { const b = meta().budgets; return b && typeof b === 'object' ? b : {}; };
async function saveBudgets(b, msg) {
  if (OFF.needNet('Saving budgets')) return;
  const { data, error } = await sb.auth.updateUser({ data: { budgets: b } });
  if (error) return toast(error.message);
  S.user = data.user; render(); toast(msg);
}
function budgetRows() {
  const d = parse(S.anchor), f = ymd(new Date(d.getFullYear(), d.getMonth(), 1)), t = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)), spent = {};
  S.ptx.filter(x => x.kind === 'expense' && x.occurred_on >= f && x.occurred_on <= t).forEach(x => { const k = (x.category || 'General').toLowerCase(); spent[k] = (spent[k] || 0) + +x.amount; });
  return Object.entries(budgets()).map(([cat, limit]) => { const s = spent[cat.toLowerCase()] || 0; return { cat, limit: +limit, spent: s, pct: limit > 0 ? s / limit * 100 : 0 }; }).sort((x, y) => y.pct - x.pct);
}
const progCls = p => p >= 100 ? 'over' : p >= 80 ? 'warn' : '';
const budgetBar = b => `<div class="prog ${progCls(b.pct)}"><i style="width:${Math.min(100, Math.round(b.pct))}%"></i></div>`;

function pOverview() {
  const rows = S.ptx.filter(inMonth), lbl = periodLabel(), I = sumBy(rows, 'income'), E = sumBy(rows, 'expense'), N = I - E, rate = I > 0 ? Math.round(N / I * 100) : null;
  const bars = buckets().map(b => { const r = S.ptx.filter(t => t.occurred_on >= b.f && t.occurred_on <= b.t); return { ...b, n: sumBy(r, 'income') - sumBy(r, 'expense') }; });
  const mx = Math.max(1, ...bars.map(b => Math.abs(b.n)));
  const trend = { day: 'Last 7 days', week: 'Last 8 weeks', month: 'Last 6 months', all: 'Last 6 months' }[S.period];
  const cm = {}; rows.filter(t => t.kind === 'expense').forEach(t => { cm[t.category] = (cm[t.category] || 0) + +t.amount; });
  const cats = Object.entries(cm).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const br = budgetRows().slice(0, 4);
  const sp = I > 0 ? Math.min(100, Math.round(E / I * 100)) : (E > 0 ? 100 : 0);
  const word = N > 0 ? 'left over' : N < 0 ? 'overspent' : 'break-even';
  const note = I <= 0 && E <= 0 ? 'No income or spending recorded for this period yet.' : N > 0 ? `Nice! You kept ${rate}% of what you earned.` : N < 0 ? 'You spent more than you earned. Check where your money goes below.' : 'You spent exactly what you earned.';
  const hand = kindTotal('cash', 'ewallet'), cashT = kindTotal('cash'), ewT = kindTotal('ewallet'), bankT = kindTotal('bank', 'other');
  const stat = (l, f, t) => { const r = S.ptx.filter(x => x.occurred_on >= f && x.occurred_on <= t), n = sumBy(r, 'income') - sumBy(r, 'expense'); return `<span>${l}<b class="${cls(n)}">${n < 0 ? '−' : ''}${peso(Math.abs(n))}</b></span>`; };
  const handBox = S.wallets.length ? `<section class="pov-box"><small class="pov-h">Money you have now</small><div class="huge ${cls(hand)}">${wm(hand)}</div><p class="pov-sub">in cash and e-wallets</p>
<div class="pov-chips"><span>Cash<b>${wm(cashT)}</b></span><span>E-wallets<b>${wm(ewT)}</b></span>${S.wallets.some(w => w.kind === 'bank' || w.kind === 'other') ? `<span>Banks<b>${wm(bankT)}</b></span>` : ''}</div>
<p class="pov-sub">All wallets together: <b>${wm(hand + bankT)}</b></p></section>`
    : `<section class="pov-box"><small class="pov-h">Money you have now</small><p class="pov-sub">Add your cash, GCash, Maya or bank in <button class="link" data-tab="wallets">Wallets</button> to see how much money you have right now.</p></section>`;
  return `<div class="tile overall ${dir(N)}"><div class="pov-grid">${handBox}
<section class="pov-box"><small class="pov-h">${lbl === 'all time' ? 'All time' : lbl}</small><div class="huge ${cls(N)}">${N < 0 ? '−' : ''}${peso(Math.abs(N))}</div><p class="pov-sub">${word} (money in minus money out)</p>
<div class="prog ${E > I ? 'over' : sp >= 80 ? 'warn' : ''}"><i style="width:${sp}%"></i></div><p class="pov-sub">${note}</p>
<div class="pov-chips"><span>Money in<b class="pos">${peso(I)}</b></span><span>Money out<b class="neg">${peso(E)}</b></span></div></section></div>
<div class="pov-trend"><div class="chart-wrap"><small>Left over each period · ${trend}</small><div class="chart">${bars.map(b => `<div class="col ${b.cur ? 'cur' : ''}" title="${b.l}: ${peso(b.n)}"><div class="cb ${b.n < 0 ? 'down' : 'up'}" style="height:${Math.round(Math.abs(b.n) / mx * 100)}%"></div><small>${b.l}</small></div>`).join('')}</div></div>
<div class="pov-qwrap"><small class="pov-h">Left over so far</small><div class="pov-quick">${spans().map(([l, f, t]) => stat(l, f, t)).join('')}</div></div></div></div>
<h3>Where your money goes · ${lbl}</h3>
<div class="tile">${cats.length ? cats.map(([c, v]) => `<div class="catrow"><span>${esc(c)}</span><b>${peso(v)}</b><div class="prog"><i style="width:${Math.round(v / E * 100)}%"></i></div></div>`).join('') : '<p class="empty">No expenses for this period yet.</p>'}</div>
${S.wallets.length ? `<h3>Wallets <button class="link" data-tab="wallets">Manage ›</button></h3><div class="tile">${S.wallets.map(w => `<div class="catrow"><span>${avatar(w)} ${esc(w.name)}</span><b class="${cls(walletBal(w))}">${peso(walletBal(w))}</b></div>`).join('')}<div class="catrow"><span><b>Total</b></span><b>${peso(walletsTotal())}</b></div></div>` : ''}
<h3>Budgets <button class="link" data-tab="budgets">Manage ›</button></h3>
<div class="tile">${br.length ? br.map(b => `<div class="catrow"><span>${esc(b.cat)}</span><b class="${b.pct >= 100 ? 'neg' : ''}">${peso(b.spent)} / ${peso(b.limit)}</b>${budgetBar(b)}</div>`).join('') : '<p class="empty">No budgets yet. Set a monthly limit per category in the Budgets tab.</p>'}</div>
${utangSummary()}`;
}

function pTx() {
  const list = S.ptx.filter(t => inMonth(t) && hit(t.occurred_on, t.kind, t.description, t.category, t.ref, t.amount, peso(t.amount)));
  const cats = [...new Set([...PCATS, ...S.ptx.map(t => t.category)])];
  const fields = v => `<label>Type<select data-f="kind">${kinds(v.kind)}</select></label>
${S.wallets.length ? `<label>Wallet<select data-f="wallet_id"><option value="">No wallet</option>${walletOpts(v.wallet_id)}</select></label>` : ''}
<label>Description<input data-f="description" value="${esc(v.description)}" placeholder="What was it for?"></label>
<label>Ref no. (optional)<input data-f="ref" value="${esc(v.ref || '')}" placeholder="Reference number" maxlength="60" autocomplete="off"></label>
<label>Category<input data-f="category" list="pcats" value="${esc(v.category)}" placeholder="Food, Transport, Salary…"></label>
<label>Date<input type="date" data-f="occurred_on" value="${v.occurred_on}"></label>
<label>Amount (₱)<input type="number" data-f="amount" step="0.01" min="0" value="${v.amount ?? ''}" placeholder="0.00"></label>`;
  const tile = t => S.edit === t.id
    ? `<div class="tile editing" data-id="${t.id}" data-t="transactions"><div class="fields">${fields(t)}</div><div class="acts"><button class="save primary">Save</button><button class="cancel">Cancel</button></div></div>`
    : logRow({ id: t.id, t: 'transactions', date: t.occurred_on, title: t.description || '(no description)', sub: esc(t.category) + (t.wallet_id ? ' · ' + esc(walletName(t.wallet_id)) : '') + (t.ref ? ' · Ref ' + esc(t.ref) : ''), amt: (t.kind === 'income' ? '+' : '−') + peso(t.amount), cls: t.kind === 'income' ? 'pos' : 'neg' });
  return `${periodTiles(S.ptx)}<datalist id="pcats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
<div class="tile addform"><b>New transaction</b><div class="fields">${fields({ kind: S.pref || 'expense', wallet_id: S.lastWallet || '', description: '', category: '', occurred_on: today(), amount: '' })}</div><button id="add" class="primary">Add transaction</button></div>
<p class="count">Showing ${Math.min(list.length, 200)} of ${list.length} · Income ${peso(sumBy(list, 'income'))} · Expenses ${peso(sumBy(list, 'expense'))}</p>
${logBox(list.slice(0, 200).map(tile), 'No entries for this period yet.')}`;
}

function budgetsView() {
  const rows = budgetRows().filter(b => hit(b.cat)), L = rows.reduce((a, b) => a + b.limit, 0), Sp = rows.reduce((a, b) => a + b.spent, 0), left = L - Sp;
  const cats = [...new Set([...PCATS, ...S.ptx.filter(t => t.kind === 'expense').map(t => t.category)])];
  const tile = b => `<div class="tile ${b.pct >= 100 ? 'down' : ''}"><div class="tt"><b>${esc(b.cat)}</b><span class="badge ${b.pct >= 100 ? 'neg' : b.pct >= 80 ? 'UPDATE' : 'pos'}">${Math.round(b.pct)}% used</span></div>
${budgetBar(b)}<div class="split"><span>Spent<b>${peso(b.spent)}</b></span><span>Budget<b>${peso(b.limit)}</b></span><span>${b.limit - b.spent >= 0 ? 'Left' : 'Over by'}<b class="${b.limit - b.spent < 0 ? 'neg' : 'pos'}">${peso(Math.abs(b.limit - b.spent))}</b></span></div>
<div class="acts"><button class="rmbudget" data-cat="${esc(b.cat)}">Remove</button></div></div>`;
  return `<div class="tile overall ${dir(left)}"><small>Budget left this month</small><div class="huge ${cls(left)}">${peso(left)}</div>
<div class="split"><span>Total budgeted<b>${peso(L)}</b></span><span>Spent in budgeted categories<b>${peso(Sp)}</b></span></div></div>
<datalist id="bcats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
<div class="tile addform"><b>Set a monthly budget</b><div class="fields"><label>Category<input data-f="category" list="bcats" placeholder="e.g. Food"></label><label>Monthly limit (₱)<input type="number" data-f="amount" step="0.01" min="0" placeholder="0.00"></label></div><button id="setbudget" class="primary">Save budget</button></div>
<p class="count">Setting a budget for a category that already has one updates it. Spending is counted from your Expense entries with the same category.</p>
<div class="tiles">${rows.map(tile).join('') || '<p class="empty">No budgets yet. Add one above, for example Food ₱6,000.</p>'}</div>`;
}

/* ---------- Wallets (personal) ---------- */
const WKIND = { cash: 'Cash', ewallet: 'E-wallet', bank: 'Bank', other: 'Other' };
// Quick-start templates: [name, type, brand-ish color]. Colors are approximate; edit any wallet to change its color.
const WPRESETS = [['Cash', 'cash', '#16a34a'], ['GCash', 'ewallet', '#007dfe'], ['Maya', 'ewallet', '#111111'], ['MariBank', 'ewallet', '#ff6a13'], ['GoTyme', 'bank', '#12a5b5'], ['ShopeePay', 'ewallet', '#ee4d2d'], ['GrabPay', 'ewallet', '#00a651'], ['Coins.ph', 'ewallet', '#1f6fff'],
  ['BDO', 'bank', '#0a3d8f'], ['BPI', 'bank', '#c8102e'], ['Metrobank', 'bank', '#1c3f94'], ['UnionBank', 'bank', '#f26b21'], ['Landbank', 'bank', '#00793a'], ['Security Bank', 'bank', '#1b6bb5'], ['RCBC', 'bank', '#00529b'], ['PNB', 'bank', '#0b3a82'],
  ['China Bank', 'bank', '#b5121b'], ['EastWest', 'bank', '#6b2c91'], ['CIMB', 'bank', '#d6232a'], ['SeaBank', 'bank', '#f15a22'], ['Tonik', 'bank', '#6f2dbd'], ['Other bank', 'bank', '#475569']];
const hex2rgb = h => { h = safeColor(h).slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const shade = (h, f) => '#' + hex2rgb(h).map(v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))).toString(16).padStart(2, '0')).join('');
const onColor = h => { const [r, g, b] = hex2rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#10231b' : '#fff'; };
const walletName = id => S.wallets.find(w => w.id === id)?.name || '(deleted wallet)';
const walletOpts = sel => S.wallets.map(w => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
const walletBal = w => {
  const tx = S.ptx.filter(t => t.wallet_id === w.id), inn = S.transfers.filter(x => x.to_wallet === w.id), out = S.transfers.filter(x => x.from_wallet === w.id);
  const gcs = S.gcs.filter(x => x.wallet_id === w.id).reduce((a, x) => a + +x.amount, 0);
  return +w.opening_balance - gcs + sumBy(tx, 'income') - sumBy(tx, 'expense') + inn.reduce((a, x) => a + +x.amount, 0) - out.reduce((a, x) => a + +x.amount + +x.fee, 0);
};
const hideBal = () => { try { return localStorage.getItem('bt-hide') === '1'; } catch (e) { return false; } };
const wm = n => hideBal() ? '₱•••••' : peso(n);
const walletMonth = w => { const [, f, t] = spans()[2], r = S.ptx.filter(x => x.wallet_id === w.id && x.occurred_on >= f && x.occurred_on <= t), ti = S.transfers.filter(x => x.occurred_on >= f && x.occurred_on <= t);
  return { i: sumBy(r, 'income') + ti.filter(x => x.to_wallet === w.id).reduce((a, x) => a + +x.amount, 0), o: sumBy(r, 'expense') + ti.filter(x => x.from_wallet === w.id).reduce((a, x) => a + +x.amount + +x.fee, 0) }; };
const walletFeed = w => [...S.ptx.filter(x => x.wallet_id === w.id).map(x => ({ d: x.occurred_on, c: x.created_at, t: x.description || x.category || (x.kind === 'income' ? 'Income' : 'Expense'), ref: x.ref, n: x.kind === 'income' ? +x.amount : -x.amount })),
  ...S.gcs.filter(x => x.wallet_id === w.id).map(x => ({ d: x.occurred_on, c: x.created_at, t: (+x.amount > 0 ? 'Saved to goal: ' : 'Taken from goal: ') + goalName(x.goal_id), ref: '', n: -x.amount })),
  ...S.transfers.filter(x => x.to_wallet === w.id || x.from_wallet === w.id).map(x => { const inn = x.to_wallet === w.id; return { d: x.occurred_on, c: x.created_at, t: (inn ? 'Transfer from ' + walletName(x.from_wallet) : 'Transfer to ' + walletName(x.to_wallet)) + (x.note ? ' · ' + x.note : ''), n: inn ? +x.amount : -(+x.amount + +x.fee) }; })]
  .sort((a, b) => (b.d + b.c).localeCompare(a.d + a.c));
const wtxModal = () => { const w = S.wallets.find(x => x.id === S.wtx); if (!w) return '';
  const cats = [...new Set([...PCATS, ...S.ptx.map(t => t.category)])];
  return `<h3>New transaction · ${esc(w.name)}</h3><p>Current balance: <b>${wm(walletBal(w))}</b></p><datalist id="pcats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
<div class="fields" id="wtxf"><label>Type<select data-f="kind">${kinds('expense')}</select></label><label>Amount (₱)<input type="number" data-f="amount" step="0.01" min="0" placeholder="0.00" id="wtx_amt"></label>
<label>Ref no. (optional)<input data-f="ref" placeholder="e.g. GCash ref 1234 567 890" maxlength="60" autocomplete="off"></label><label>Date<input type="date" data-f="occurred_on" value="${today()}"></label>
<label>Description<input data-f="description" placeholder="What was it for?"></label><label>Category<input data-f="category" list="pcats" placeholder="Food, Transport, Salary…"></label></div>
<div class="acts"><button id="dowtx" class="primary">Save transaction</button><button id="mclose">Cancel</button></div>`; };
const kindTotal = (...ks) => S.wallets.filter(w => ks.includes(w.kind)).reduce((a, w) => a + walletBal(w), 0);
const walletSummary = () => { if (!S.wallets.length) return '';
  const cash = kindTotal('cash'), ew = kindTotal('ewallet'), hand = cash + ew, bank = kindTotal('bank', 'other');
  return `<div class="onhand"><div class="oh-main"><small>Money on hand · cash + e-wallets</small><div class="oh-big ${cls(hand)}">${wm(hand)}</div></div>
<div class="oh-split"><span>Cash<b>${wm(cash)}</b></span><span>E-wallets<b>${wm(ew)}</b></span><span>Banks &amp; other<b>${wm(bank)}</b></span><span>All wallets<b>${wm(cash + ew + bank)}</b></span></div></div>`; };
const shortBy = (w, need, back = 0) => { const have = walletBal(w) + back; return need > have + 0.004 ? `Declined: not enough in ${w.name}. Balance ${peso(have)}, needs ${peso(need)} (short by ${peso(need - have)}).` : ''; };
const walletsTotal = () => S.wallets.reduce((a, w) => a + walletBal(w), 0);
const walletFields = w => `<label>Wallet name<input data-f="name" value="${esc(w.name || '')}" placeholder="e.g. GCash, BDO Savings"></label>
<label>Type<select data-f="kind">${Object.entries(WKIND).map(([k, v]) => `<option value="${k}" ${w.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
<label>Starting balance (₱)<input type="number" data-f="opening_balance" step="0.01" value="${w.opening_balance ?? ''}" placeholder="0.00"></label>
<div class="lab">Color<span class="colorrow"><input type="color" data-f="color" value="${safeColor(w.color)}"><span class="sw">${PALETTE.map(c => `<button type="button" class="swatch" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</span></span></div>`;
function walletsView() {
  if (S.walletsErr) return `<div class="tile"><b>Wallets need a one-time setup</b><p class="count">Open Supabase &gt; SQL Editor &gt; New query, paste the contents of <b>supabase/wallets.sql</b> from your project, and click Run. Then reload this page.</p><small>${esc(S.walletsErr)}</small></div>`;
  const ws = S.wallets.filter(w => hit(w.name, WKIND[w.kind])), tot = walletsTotal();
  const tile = w => { if (S.edit === w.id) return `<div class="tile editing" data-id="${w.id}" data-t="wallets"><div class="fields">${walletFields(w)}</div><div class="acts"><button class="save primary">Save</button><button class="cancel">Cancel</button></div></div>`;
    const b = walletBal(w), c = safeColor(w.color), mo = walletMonth(w), open = S.wopen === w.id, feed = open ? walletFeed(w).slice(0, 8) : [];
    return `<div class="tile wcard" data-id="${w.id}" data-t="wallets" style="--wc:${onColor(c)};background:linear-gradient(135deg,${shade(c, .08)},${shade(c, -.3)})"><div class="wtop"><b>${esc(w.name)}</b><span class="wbadge">${WKIND[w.kind] || 'Other'}</span></div>
<div class="wmid"><span class="wchip"></span><svg class="wnfc" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6c3 3.5 3 8.5 0 12M12 4c4.5 5 4.5 11 0 16M16 2c6 6.5 6 13.500 0 20"/></svg></div>
<small>BALANCE</small><div class="wbal">${b < 0 && !hideBal() ? '−' : ''}${hideBal() ? '₱•••••' : peso(Math.abs(b))}</div><small>This month: +${wm(mo.i)} · −${wm(mo.o)}</small>
<div class="acts wacts"><button class="wadd wprimary">＋ Transaction</button><button class="wxfer">⇄ Transfer</button><button class="wact">${open ? 'Hide activity' : 'Activity'}</button><button class="wadjust">Adjust</button><button class="edit">Edit</button><button class="del">Delete</button></div>
${open ? `<div class="wfeed">${feed.map(x => `<div class="wrow"><span><b>${esc(x.t)}</b><small>${fmtDate(x.d)}${x.ref ? ' · Ref ' + esc(x.ref) : ''}</small></span><b>${x.n < 0 ? '−' : '+'}${wm(Math.abs(x.n))}</b></div>`).join('') || '<small>No activity yet. Tap ＋ Transaction.</small>'}</div>` : ''}</div>`; };
  const xs = S.transfers.filter(x => hit(walletName(x.from_wallet), walletName(x.to_wallet), x.note, x.amount, x.occurred_on)).slice(0, 100);
  const xt = x => logRow({ id: x.id, t: 'transfers', noEdit: true, date: x.occurred_on, title: walletName(x.from_wallet) + ' → ' + walletName(x.to_wallet), sub: 'Transfer' + (+x.fee ? ' · fee ' + peso(x.fee) : '') + (x.note ? ' · ' + esc(x.note) : ''), amt: peso(x.amount) });
  const first = S.wallets[0]?.id, second = (S.wallets[1] || S.wallets[0])?.id;
  return `<div class="tile overall ${dir(tot)}"><div class="tt"><small>Total across ${S.wallets.length} wallet${S.wallets.length === 1 ? '' : 's'}</small><button id="hidebal" class="link">${hideBal() ? 'Show balances' : 'Hide balances'}</button></div><div class="huge ${cls(tot)}">${wm(tot)}</div>
${walletSummary()}<small>Each wallet = starting balance + income − expenses assigned to it, ± transfers. Entries with no wallet are not counted.</small></div>
<div class="tiles">${ws.map(tile).join('') || '<p class="empty">No wallets yet. Add Cash, GCash, Maya or a bank below.</p>'}</div>
<div class="tile addform" id="walform"><b>New wallet</b><small>Pick a template, then enter your starting balance:</small><div class="wpick">${WPRESETS.map(p => `<button type="button" data-wpreset="${p.join('|')}" style="background:linear-gradient(135deg,${shade(p[2], .08)},${shade(p[2], -.3)});color:${onColor(p[2])}">${p[0]}</button>`).join('')}</div><div class="fields">${walletFields({ kind: 'cash', color: PALETTE[0] })}</div><button id="addwallet" class="primary">Add wallet</button></div>
<h3>Transfer between wallets</h3>
${S.wallets.length < 2 ? '<p class="empty">Add at least two wallets to record a transfer.</p>' : `<div class="tile addform" id="xferform"><b>New transfer</b><div class="fields">
<label>From<select data-f="from_wallet">${walletOpts(first)}</select></label><label>To<select data-f="to_wallet">${walletOpts(second)}</select></label>
<label>Amount (₱)<input type="number" data-f="amount" step="0.01" min="0" placeholder="0.00"></label><label>Fee (₱, optional)<input type="number" data-f="fee" step="0.01" min="0" placeholder="0.00"></label>
<label>Date<input type="date" data-f="occurred_on" value="${today()}"></label><label>Note<input data-f="note" placeholder="e.g. Cash in"></label></div><button id="addxfer" class="primary">Record transfer</button></div>`}
${xs.length ? logBox(xs.map(xt)) : ''}`;
}

/* ---------- Savings goals (personal) ---------- */
const GOAL_IDEAS = ['Emergency fund', 'Travel', 'New phone', 'Laptop', 'Wedding', 'Tuition', 'Business capital', 'Gift'];
const goalName = id => S.goals.find(g => g.id === id)?.name || '(deleted goal)';
const goalSaved = g => S.gcs.filter(c => c.goal_id === g.id).reduce((a, c) => a + +c.amount, 0);
const goalFields = g => `<label>Goal name<input data-f="name" value="${esc(g.name || '')}" placeholder="e.g. Emergency fund" maxlength="60"></label>
<label>Target amount (₱)<input type="number" data-f="target_amount" step="0.01" min="0" value="${g.target_amount ?? ''}" placeholder="0.00"></label>
<label>Target date (optional)<input type="date" data-f="target_date" value="${g.target_date || ''}"></label>
<div class="lab">Color<span class="colorrow"><input type="color" data-f="color" value="${safeColor(g.color)}"><span class="sw">${PALETTE.map(c => `<button type="button" class="swatch" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</span></span></div>`;
function gcModal() {
  const g = S.goals.find(x => x.id === S.gc?.id); if (!g) return ''; const add = S.gc.sign > 0;
  return `<h3>${add ? 'Add money' : 'Withdraw'} · ${esc(g.name)}</h3><p>Saved so far: <b>${wm(goalSaved(g))}</b> of ${wm(g.target_amount)}</p>
<div class="fields" id="gcf"><label>Amount (₱)<input type="number" data-f="amount" id="gc_amt" step="0.01" min="0" placeholder="0.00"></label><label>Date<input type="date" data-f="occurred_on" value="${today()}"></label>
<label>${add ? 'Take from wallet' : 'Return to wallet'}<select data-f="wallet_id"><option value="">Just tracking (no wallet)</option>${walletOpts()}</select></label><label>Note (optional)<input data-f="note" placeholder="e.g. 13th month" maxlength="80"></label></div>
<div class="acts"><button id="dogc" class="primary">${add ? 'Add to goal' : 'Withdraw'}</button><button id="mclose">Cancel</button></div>`;
}
function goalsView() {
  if (S.goalsErr) return `<div class="tile"><b>Savings goals need a one-time setup</b><p class="count">Open Supabase &gt; SQL Editor &gt; New query, paste the contents of <b>supabase/goals.sql</b> (run <b>supabase/wallets.sql</b> first if you haven't), and click Run. Then reload this page.</p><small>${esc(S.goalsErr)}</small></div>`;
  const gs = S.goals.filter(g => hit(g.name)), info = g => { const saved = goalSaved(g), target = +g.target_amount, pct = Math.max(0, Math.min(100, Math.round(saved / target * 100))), left = Math.max(0, target - saved), done = saved >= target; return { saved, target, pct, left, done }; };
  const all = S.goals.map(info), TS = all.reduce((a, x) => a + x.saved, 0), TT = all.reduce((a, x) => a + x.target, 0), reached = all.filter(x => x.done).length;
  const card = g => { if (S.edit === g.id) return `<div class="tile editing" data-id="${g.id}" data-t="goals"><div class="fields">${goalFields(g)}</div><div class="acts"><button class="save primary">Save</button><button class="cancel">Cancel</button></div></div>`;
    const i = info(g), c = safeColor(g.color), open = S.gopen === g.id; let line;
    if (i.done) line = `You did it! Target of ${wm(i.target)} reached.`;
    else { line = `${wm(i.left)} to go`; if (g.target_date) { const t = parse(today()), d = parse(g.target_date), m = (d.getFullYear() - t.getFullYear()) * 12 + d.getMonth() - t.getMonth();
      line += d < t ? ' · target date has passed' : ` · by ${fmtDate(g.target_date)} · save about ${wm(i.left / Math.max(1, m))} a month`; } }
    const rows = open ? S.gcs.filter(x => x.goal_id === g.id).slice(0, 10).map(x => logRow({ id: x.id, t: 'goal_contributions', noEdit: true, date: x.occurred_on, title: x.note || (+x.amount > 0 ? 'Deposit' : 'Withdrawal'), sub: x.wallet_id ? (+x.amount > 0 ? 'From ' : 'To ') + esc(walletName(x.wallet_id)) : 'Not linked to a wallet', amt: (+x.amount > 0 ? '+' : '−') + wm(Math.abs(x.amount)), cls: +x.amount > 0 ? 'pos' : 'neg' })) : [];
    return `<div class="tile goal${i.done ? ' done' : ''}" data-id="${g.id}" data-t="goals" style="border-top:4px solid ${c}"><div class="tt"><b>${esc(g.name)}</b><span class="badge ${i.done ? 'pos' : ''}">${i.done ? 'Reached 🎉' : i.pct + '%'}</span></div>
<div class="big">${wm(i.saved)} <span class="gof">of ${wm(i.target)}</span></div><div class="prog gprog"><i style="width:${i.pct}%;background:${c}"></i></div><small>${line}</small>
<div class="acts wacts"><button class="gadd primary">＋ Add money</button><button class="gsub">Withdraw</button><button class="ghist">${open ? 'Hide history' : 'History'}</button><button class="edit">Edit</button><button class="del">Delete</button></div>
${open ? (rows.length ? `<div class="log">${rows.join('')}</div>` : '<small>No deposits yet. Tap ＋ Add money.</small>') : ''}</div>`; };
  return `<div class="tile overall"><div class="tt"><small>Total saved across ${S.goals.length} goal${S.goals.length === 1 ? '' : 's'}</small><button id="hidebal" class="link">${hideBal() ? 'Show balances' : 'Hide balances'}</button></div><div class="huge pos">${wm(TS)}</div>
<div class="prog"><i style="width:${TT ? Math.min(100, Math.round(TS / TT * 100)) : 0}%"></i></div><small>${S.goals.length ? `${TT ? Math.min(100, Math.round(TS / TT * 100)) : 0}% of ${wm(TT)} total target · ${reached} goal${reached === 1 ? '' : 's'} reached` : 'Set a goal below, like an emergency fund or a trip, then add money whenever you can.'}</small></div>
<div class="tiles">${gs.map(card).join('') || (S.goals.length ? '<p class="empty">No goals match.</p>' : '')}</div>
<div class="tile addform" id="goalform"><b>New savings goal</b><small>Need an idea? Tap one:</small><div class="wpick gideas">${GOAL_IDEAS.map(n => `<button type="button" data-gidea="${n}">${n}</button>`).join('')}</div><div class="fields">${goalFields({ color: PALETTE[S.goals.length % PALETTE.length] })}</div><button id="addgoal" class="primary">Create goal</button></div>`;
}

/* ---------- Utang tracker ---------- */
const dBal = d => Math.max(0, +d.amount - +d.paid_amount);
const dPaid = d => +d.paid_amount >= +d.amount;
const dDays = d => d.due_on ? Math.round((parse(d.due_on) - parse(today())) / 864e5) : null;
function utangTotals() {
  const open = S.debts.filter(d => !dPaid(d)), owed = open.filter(d => d.direction === 'owed_to_me'), owe = open.filter(d => d.direction === 'i_owe');
  const sum = r => r.reduce((x, d) => x + dBal(d), 0), late = r => r.filter(d => dDays(d) !== null && dDays(d) < 0).length;
  return { owed: sum(owed), owe: sum(owe), lateOwed: late(owed), lateOwe: late(owe), n: open.length };
}
function utangSummary() {
  const u = utangTotals(); if (!S.debts.length) return '';
  return `<h3>Utang <button class="link" data-tab="utang">Manage ›</button></h3>
<div class="tile"><div class="split"><span>They owe you<b class="pos">${peso(u.owed)}</b>${u.lateOwed ? `<small class="neg">${u.lateOwed} overdue</small>` : ''}</span><span>You owe<b class="neg">${peso(u.owe)}</b>${u.lateOwe ? `<small class="neg">${u.lateOwe} overdue</small>` : ''}</span><span>Open records<b>${u.n}</b></span></div></div>`;
}
function dueBadge(d) {
  if (dPaid(d)) return '<span class="badge pos">Paid</span>';
  const n = dDays(d); if (n === null) return '<span class="badge">No due date</span>';
  return n < 0 ? `<span class="badge neg">Overdue ${-n}d</span>` : n === 0 ? '<span class="badge UPDATE">Due today</span>' : n <= 7 ? `<span class="badge UPDATE">Due in ${n}d</span>` : `<span class="badge">Due ${fmtDate(d.due_on)}</span>`;
}
function utangView() {
  const f = S.uf || 'open', u = utangTotals();
  const fields = v => `<label>Type<select data-f="direction"><option value="owed_to_me" ${v.direction !== 'i_owe' ? 'selected' : ''}>They owe me</option><option value="i_owe" ${v.direction === 'i_owe' ? 'selected' : ''}>I owe them</option></select></label>
<label>Person<input data-f="person" value="${esc(v.person)}" placeholder="e.g. Ate Mia" maxlength="80"></label>
<label>Amount (₱)<input type="number" data-f="amount" step="0.01" min="0" value="${v.amount ?? ''}" placeholder="0.00"></label>
<label>Due date (optional)<input type="date" data-f="due_on" value="${v.due_on || ''}"></label>
<label>Note<input data-f="note" value="${esc(v.note)}" placeholder="What was it for?"></label>`;
  let rows = S.debts.filter(d => hit(d.person, d.note, d.amount, peso(d.amount)));
  rows = rows.filter(d => f === 'paid' ? dPaid(d) : f === 'owed_to_me' ? !dPaid(d) && d.direction === 'owed_to_me' : f === 'i_owe' ? !dPaid(d) && d.direction === 'i_owe' : !dPaid(d));
  rows.sort((x, y) => f === 'paid' ? (y.paid_at || '').localeCompare(x.paid_at || '') : (x.due_on || '9999').localeCompare(y.due_on || '9999') || y.created_at.localeCompare(x.created_at));
  const tile = d => {
    if (S.edit === d.id) return `<div class="tile editing" data-id="${d.id}" data-t="debts"><div class="fields">${fields(d)}</div><div class="acts"><button class="save primary">Save</button><button class="cancel">Cancel</button></div></div>`;
    const mine = d.direction === 'owed_to_me', paid = dPaid(d), pct = Math.round(+d.paid_amount / +d.amount * 100), late = !paid && dDays(d) !== null && dDays(d) < 0;
    return `<div class="tile ${paid ? '' : mine ? 'up' : 'down'}" data-id="${d.id}" data-t="debts" data-amt="${d.amount}" data-paid="${d.paid_amount}">
<div class="tt"><b>${esc(d.person)}</b>${dueBadge(d)}</div>
<small>${mine ? 'Owes you' : 'You owe'}${d.note ? ' · ' + esc(d.note) : ''} · since ${fmtDate(d.created_at.slice(0, 10))}</small>
<div class="big ${paid ? '' : mine ? 'pos' : 'neg'}">${peso(paid ? d.amount : dBal(d))}</div>
${+d.paid_amount > 0 && !paid ? `<div class="prog"><i style="width:${pct}%"></i></div><small>Paid ${peso(d.paid_amount)} of ${peso(d.amount)}</small>` : ''}
${paid ? `<small>Fully paid${d.paid_at ? ' · ' + fmtDate(d.paid_at.slice(0, 10)) : ''}</small>` : late ? '<small class="neg">Past the due date</small>' : ''}
<div class="acts">${paid ? '<button class="uundo">Undo paid</button>' : '<button class="upaid primary">Mark paid</button><button class="upay">Part payment</button>'}<button class="edit">Edit</button><button class="del">Delete</button></div></div>`;
  };
  const FL = [['open', 'Open'], ['owed_to_me', 'They owe me'], ['i_owe', 'I owe'], ['paid', 'Paid']];
  return `<div class="tiles mini"><div class="tile up"><small>They owe you</small><div class="big pos">${peso(u.owed)}</div>${u.lateOwed ? `<small class="neg">${u.lateOwed} overdue</small>` : '<small>open balance</small>'}</div>
<div class="tile down"><small>You owe</small><div class="big neg">${peso(u.owe)}</div>${u.lateOwe ? `<small class="neg">${u.lateOwe} overdue</small>` : '<small>open balance</small>'}</div>
<div class="tile ${dir(u.owed - u.owe)}"><small>Net utang</small><div class="big ${cls(u.owed - u.owe)}">${peso(u.owed - u.owe)}</div><small>${u.n} open record${u.n === 1 ? '' : 's'}</small></div></div>
<div class="tile addform"><b>New utang record</b><div class="fields">${fields({ direction: 'owed_to_me', person: '', amount: '', due_on: '', note: '' })}</div><button id="addutang" class="primary">Add record</button></div>
<div class="seg ufilter">${FL.map(([k, l]) => `<button data-uf="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}</div>
<div class="tiles">${rows.map(tile).join('') || '<p class="empty">Nothing here yet.</p>'}</div>`;
}

/* ---------- Reports & export ---------- */
const PRESETS = [['month', 'This month'], ['lastmonth', 'Last month'], ['week', 'This week'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom']];
function presetRange(p) {
  const d = parse(today()), y = d.getFullYear(), m = d.getMonth();
  if (p === 'lastmonth') return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
  if (p === 'week') { const mo = monday(d), e = new Date(mo); e.setDate(mo.getDate() + 6); return [ymd(mo), ymd(e)]; }
  if (p === 'year') return [ymd(new Date(y, 0, 1)), ymd(new Date(y, 11, 31))];
  if (p === 'all') { const ds = allRows().map(x => x.occurred_on).sort(); return [ds[0] || today(), today()]; }
  return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
}
function repState() {
  if (!S.rep) { const [from, to] = presetRange('month'); S.rep = { preset: 'month', from, to, stores: null, oe: true }; }
  return S.rep;
}
function reportData() {
  const R = repState(), f = R.from <= R.to ? R.from : R.to, t = R.from <= R.to ? R.to : R.from;
  if (S.space === 'personal') {
    const byD = (x, y) => x.occurred_on.localeCompare(y.occurred_on) || (x.created_at || '').localeCompare(y.created_at || '');
    const tx = S.ptx.filter(x => x.occurred_on >= f && x.occurred_on <= t).sort(byD), i = sumBy(tx, 'income'), e = sumBy(tx, 'expense'), cm = {};
    tx.forEach(x => { const k = x.kind + '|' + x.category; cm[k] = cm[k] || { kind: x.kind, category: x.category, amount: 0 }; cm[k].amount += +x.amount; });
    const cats = Object.values(cm).sort((p, q) => (p.kind === q.kind ? 0 : p.kind === 'income' ? -1 : 1) || q.amount - p.amount);
    const entries = tx.map(x => ({ date: x.occurred_on, store: 'Personal', type: x.kind === 'income' ? 'Income' : 'Expense', category: x.category, description: x.description, amount: +x.amount }));
    return { f, t, per: [{ s: { id: 'p', name: 'Personal money', color: '#2563eb' }, i, e, n: i - e, c: tx.length }], I: i, E: e, OE: 0, N: i - e, cats, entries, oeRows: [], partial: false, incOE: false };
  }
  const ids = S.stores.filter(s => !R.stores || R.stores.includes(s.id)).map(s => s.id), inR = x => x.occurred_on >= f && x.occurred_on <= t;
  const byDate = (a, b) => a.occurred_on.localeCompare(b.occurred_on) || (a.created_at || '').localeCompare(b.created_at || '');
  const tx = S.tx.filter(x => inR(x) && ids.includes(x.store_id)).sort(byDate), oe = R.oe ? S.oe.filter(inR).sort(byDate) : [];
  const per = S.stores.filter(s => ids.includes(s.id)).map(s => { const r = tx.filter(x => x.store_id === s.id), i = sumBy(r, 'income'), e = sumBy(r, 'expense'); return { s, i, e, n: i - e, c: r.length }; });
  const I = per.reduce((a, x) => a + x.i, 0), E = per.reduce((a, x) => a + x.e, 0), OE = oe.reduce((a, x) => a + +x.amount, 0);
  const cm = {}; const add = (kind, category, amount) => { const k = kind + '|' + category; cm[k] = cm[k] || { kind, category, amount: 0 }; cm[k].amount += +amount; };
  tx.forEach(x => add(x.kind, x.category, x.amount)); oe.forEach(x => add('expense', x.category, x.amount));
  const cats = Object.values(cm).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'income' ? -1 : 1) || b.amount - a.amount);
  const entries = [...tx.map(x => ({ date: x.occurred_on, store: storeName(x.store_id), type: x.kind === 'income' ? 'Income' : 'Expense', category: x.category, description: x.description, amount: +x.amount, _c: x.created_at })),
    ...oe.map(x => ({ date: x.occurred_on, store: 'Overall (all stores)', type: 'Expense', category: x.category, description: x.description, amount: +x.amount, _c: x.created_at }))]
    .sort((a, b) => a.date.localeCompare(b.date) || (a._c || '').localeCompare(b._c || ''));
  return { f, t, per, I, E, OE, N: I - E - OE, cats, entries, oeRows: oe, partial: R.stores && ids.length < S.stores.length, incOE: R.oe };
}
const repTitle = d => d.f === d.t ? fmtDate(d.f) : `${fmtDate(d.f)} – ${fmtDate(d.t)}`;
const repName = d => `budget-report_${d.f}_to_${d.t}`;
const whoFull = () => [meta().business, fullName()].filter(Boolean).join(' · ') || S.user.email;

function reportsView() {
  const R = repState(), d = reportData(), n = d.N;
  if (S.space !== 'personal' && !S.stores.length) return '<p class="empty">Add a store and record some transactions first, then come back here to export a report.</p>';
  const PS = S.space === 'personal';
  const tbl = `<div class="sheetwrap"><table class="tbl"><thead><tr><th>${PS ? 'Account' : 'Store'}</th><th>Entries</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>
${d.per.map(x => `<tr><td>${avatar(x.s)} ${esc(x.s.name)}</td><td>${x.c}</td><td>${peso(x.i)}</td><td>${peso(x.e)}</td><td class="${cls(x.n)}">${peso(x.n)}</td></tr>`).join('') || '<tr><td colspan="5">No stores selected.</td></tr>'}
${d.incOE ? `<tr class="ded"><td>Overall expenses (salary, maintenance…)</td><td>${d.oeRows.length}</td><td>—</td><td>${peso(d.OE)}</td><td class="neg">${d.OE ? '−' : ''}${peso(d.OE)}</td></tr>` : ''}
</tbody><tfoot><tr><td>Overall net</td><td></td><td>${peso(d.I)}</td><td>${peso(d.E + d.OE)}</td><td class="${cls(n)}">${peso(n)}</td></tr></tfoot></table></div>`;
  const cat = d.cats.length ? `<div class="sheetwrap"><table class="tbl"><thead><tr><th>Category</th><th>Type</th><th>Amount</th></tr></thead><tbody>${d.cats.map(c => `<tr><td>${esc(c.category)}</td><td><span class="badge ${c.kind === 'income' ? 'pos' : 'neg'}">${c.kind === 'income' ? 'Income' : 'Expense'}</span></td><td>${peso(c.amount)}</td></tr>`).join('')}</tbody></table></div>` : '';
  return `<div class="tile addform"><b>Report settings</b>
<div class="seg rp">${PRESETS.map(([k, l]) => `<button data-rp="${k}" class="${R.preset === k ? 'on' : ''}">${l}</button>`).join('')}</div>
<div class="fields"><label>From<input type="date" id="rfrom" value="${R.from}"></label><label>To<input type="date" id="rto" value="${R.to}"></label></div>
${PS ? '' : `<div class="lab">Stores to include<span class="chk">${S.stores.map(s => `<label class="chkl"><input type="checkbox" data-rs="${s.id}" ${!R.stores || R.stores.includes(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')}</span></div>
<label class="chkl"><input type="checkbox" id="roe" ${R.oe ? 'checked' : ''}> Deduct overall expenses (salary, maintenance…)</label>`}</div>
<div class="tile overall ${dir(n)}"><small>Report preview · ${repTitle(d)}</small><div class="huge ${cls(n)}">${peso(n)}</div>
<div class="split"><span>Total income<b>${peso(d.I)}</b></span><span>${PS ? 'Expenses' : 'Store expenses'}<b>${peso(d.E)}</b></span>${PS ? '' : `<span>Overall expenses<b>${peso(d.OE)}</b></span>`}<span>Entries<b>${d.entries.length}</b></span></div>
${d.partial ? '<small>Only the selected stores are counted in this report.</small>' : ''}</div>
<div class="acts dl"><button id="dlcsv" class="primary">⬇ CSV</button><button id="dlxlsx" class="primary">⬇ Excel (.xlsx)</button><button id="dlpdf" class="primary">⬇ PDF</button></div>
<small class="count">PDF opens your browser's print dialog: choose “Save as PDF”. Excel has 3 sheets: Summary, All entries, Overall expenses.</small>
<h3>${PS ? 'Summary' : 'Summary by store'}</h3>${tbl}${cat ? '<h3>Summary by category</h3>' + cat : ''}`;
}

function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const csvCell = v => { let x = String(v ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };

function exportReport(kind) {
  const d = reportData();
  if (!d.entries.length) return toast('Nothing to export for this period and selection.');
  if (kind === 'csv') {
    const lines = [['Date', S.space === 'personal' ? 'Account' : 'Store', 'Type', 'Category', 'Description', 'Amount'], ...d.entries.map(e => [e.date, e.store, e.type, e.category, e.description, e.amount.toFixed(2)])];
    download(repName(d) + '.csv', new Blob(['\ufeff' + lines.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  } else if (kind === 'xlsx') {
    if (typeof XLSX === 'undefined') return toast('Excel library did not load. Check your internet connection and refresh.');
    const sum = [['Budget Report'], [whoFull()], ['Period', repTitle(d)], ['Generated', new Date().toLocaleString('en-PH')], [],
      ['Store', 'Entries', 'Income', 'Expenses', 'Net'], ...d.per.map(x => [x.s.name, x.c, x.i, x.e, x.n])];
    if (d.incOE) sum.push(['Overall expenses (salary, maintenance...)', d.oeRows.length, 0, d.OE, -d.OE]);
    sum.push(['OVERALL NET', d.entries.length, d.I, d.E + d.OE, d.N], [], ['Category', 'Type', 'Amount'], ...d.cats.map(c => [c.category, c.kind === 'income' ? 'Income' : 'Expense', c.amount]));
    const ent = [['Date', S.space === 'personal' ? 'Account' : 'Store', 'Type', 'Category', 'Description', 'Amount'], ...d.entries.map(e => [e.date, e.store, e.type, e.category, e.description, e.amount])];
    const oe = [['Date', 'Category', 'Description', 'Amount'], ...d.oeRows.map(x => [x.occurred_on, x.category, x.description, +x.amount]), ['', '', 'Total', d.OE]];
    const mk = (rows, widths) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map(w => ({ wch: w }));
      Object.keys(ws).forEach(k => { if (k[0] !== '!' && ws[k].t === 'n') ws[k].z = '#,##0.00'; }); return ws; };
    const wsS = mk(sum, [40, 10, 16, 16, 16]), wsE = mk(ent, [12, 24, 10, 18, 36, 14]), wsO = mk(oe, [12, 18, 36, 14]);
    Object.keys(wsS).forEach(k => { if (/^B\d+$/.test(k) && wsS[k].t === 'n') wsS[k].z = '0'; });
    wsE['!autofilter'] = { ref: `A1:F${ent.length}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsS, 'Summary'); XLSX.utils.book_append_sheet(wb, wsE, 'All entries'); XLSX.utils.book_append_sheet(wb, wsO, 'Overall expenses');
    XLSX.writeFile(wb, repName(d) + '.xlsx');
  } else {
    const row = (...c) => `<tr>${c.map(x => `<td>${x}</td>`).join('')}</tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${repName(d)}</title><style>
@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px/1.4 "Segoe UI",Arial,sans-serif;color:#1d2a24;margin:0}
h1{margin:0;font-size:22px;color:#00844a}h2{font-size:14px;margin:20px 0 6px}.meta{color:#6b7a72;margin:2px 0 14px}
table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e6e9e4;padding:5px 6px;text-align:left;vertical-align:top}
th{background:#f4f6f3;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7a72}thead{display:table-header-group}tr{page-break-inside:avoid}
.r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.pos{color:#00844a}.neg{color:#c93a40}tfoot td{font-weight:700;border-top:2px solid #1d2a24;border-bottom:0}
.net{display:flex;gap:24px;margin:10px 0;padding:12px 14px;background:#f4f6f3;border-radius:10px}.net div small{display:block;color:#6b7a72}.net b{font-size:16px}
</style></head><body><div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><img src="${window.BRAND_MARK || ''}" style="width:40px;height:40px" alt=""><div><b style="font-size:15px">IsaZen</b><div style="color:#6b7a72;font-size:11px">Budget and Expense Manager</div></div></div><h1>Budget Report</h1><div class="meta">${esc(whoFull())} · ${esc(repTitle(d))} · Generated ${esc(new Date().toLocaleString('en-PH'))}</div>
<div class="net"><div><small>Total income</small><b>${peso(d.I)}</b></div><div><small>${S.space === 'personal' ? 'Expenses' : 'Store expenses'}</small><b>${peso(d.E)}</b></div>${S.space === 'personal' ? '' : `<div><small>Overall expenses</small><b>${peso(d.OE)}</b></div>`}<div><small>Overall net</small><b class="${cls(d.N)}">${peso(d.N)}</b></div></div>
${d.partial ? '<div class="meta">Only the selected stores are included.</div>' : ''}
<h2>${S.space === 'personal' ? 'Summary' : 'Summary by store'}</h2><table><thead><tr><th>${S.space === 'personal' ? 'Account' : 'Store'}</th><th class="r">Income</th><th class="r">Expenses</th><th class="r">Net</th></tr></thead><tbody>
${d.per.map(x => row(esc(x.s.name), `<span class="r">${peso(x.i)}</span>`, `<span class="r">${peso(x.e)}</span>`, `<span class="${cls(x.n)}">${peso(x.n)}</span>`)).join('')}
${d.incOE ? row('Overall expenses (salary, maintenance…)', '', peso(d.OE), `<span class="neg">${d.OE ? '−' : ''}${peso(d.OE)}</span>`) : ''}
</tbody><tfoot><tr><td>Overall net</td><td class="r">${peso(d.I)}</td><td class="r">${peso(d.E + d.OE)}</td><td class="r ${cls(d.N)}">${peso(d.N)}</td></tr></tfoot></table>
<h2>Summary by category</h2><table><thead><tr><th>Category</th><th>Type</th><th class="r">Amount</th></tr></thead><tbody>${d.cats.map(c => row(esc(c.category), c.kind === 'income' ? 'Income' : 'Expense', `<span class="r">${peso(c.amount)}</span>`)).join('')}</tbody></table>
<h2>All entries (${d.entries.length})</h2><table><thead><tr><th>Date</th><th>${S.space === 'personal' ? 'Account' : 'Store'}</th><th>Category</th><th>Description</th><th class="r">Amount</th></tr></thead><tbody>
${d.entries.map(e => `<tr><td>${esc(fmtDate(e.date))}</td><td>${esc(e.store)}</td><td>${esc(e.category)}</td><td>${esc(e.description)}</td><td class="r ${e.type === 'Income' ? 'pos' : 'neg'}">${e.type === 'Income' ? '+' : '−'}${peso(e.amount)}</td></tr>`).join('')}</tbody></table></body></html>`;
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    const w = f.contentWindow; w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { w.focus(); w.print(); setTimeout(() => f.remove(), 60000); }, 300);
    toast('In the print dialog, choose “Save as PDF” as the destination.');
  }
}

function storeGrid() {
  const tile = s => {
    if (S.edit === s.id) return `<div class="tile editing" data-id="${s.id}" data-t="stores"><div class="fields">${storeFields(s)}</div><div class="acts"><button class="save primary">Save</button><button class="cancel">Cancel</button></div></div>`;
    const r = S.tx.filter(t => t.store_id === s.id), i = sumBy(r, 'income'), e = sumBy(r, 'expense'), n = i - e;
    return `<div class="tile ${dir(n)}" data-id="${s.id}" data-t="stores" style="border-top:4px solid ${safeColor(s.color)}"><div class="tt"><b>${avatar(s)}${esc(s.name)}</b><span class="badge ${cls(n)}">${status(n)}</span></div><small>${r.length} transactions · all time</small>
<div class="big ${cls(n)}">${peso(n)}</div><div class="split"><span>Income<b>${peso(i)}</b></span><span>Expenses<b>${peso(e)}</b></span></div><div class="acts"><button class="edit">Rename</button><button class="del">Delete</button></div></div>`;
  };
  return `<div class="tile addform"><b>New store</b><div class="fields">${storeFields({ color: PALETTE[0] })}</div><button id="adds" class="primary">Add store</button></div>
<div class="tiles">${S.stores.filter(s => hit(s.name)).map(tile).join('')}</div>`;
}

function histGrid() {
  const skip = ['id', 'user_id', 'created_at'];
  const fmt = (k, v) => k === 'amount' || k === 'paid_amount' ? peso(v) : k === 'store_id' ? esc(storeName(v)) : ['wallet_id', 'from_wallet', 'to_wallet'].includes(k) ? esc(walletName(v)) : k === 'goal_id' ? esc(goalName(v)) : k === 'opening_balance' || k === 'fee' || k === 'target_amount' ? peso(v) : esc(v);
  const label = { INSERT: 'Added', UPDATE: 'Edited', DELETE: 'Deleted' };
  const detail = h => {
    const n = h.new_data, o = h.old_data, d = n || o, name = esc(d.name || d.person || d.description || d.category || '');
    if (h.action === 'UPDATE') return name + ': ' + Object.keys(n).filter(k => !skip.includes(k) && n[k] !== o[k]).map(k => `${k} ${fmt(k, o[k])} → ${fmt(k, n[k])}`).join(', ');
    if (h.table_name === 'goal_contributions') return `${esc(goalName(d.goal_id))} · ${+d.amount > 0 ? 'saved' : 'withdrew'} ${peso(Math.abs(d.amount))}`;
    if (h.table_name === 'transfers') return `${esc(walletName(d.from_wallet))} → ${esc(walletName(d.to_wallet))} · ${peso(d.amount)}`;
    return name + (d.kind ? ` (${d.kind}${d.store_id ? ' · ' + esc(storeName(d.store_id)) : ''})` : '') + (d.amount !== undefined ? ' · ' + peso(d.amount) : '');
  };
  const isP = h => ['debts', 'wallets', 'transfers', 'goals', 'goal_contributions'].includes(h.table_name) || (h.new_data || h.old_data || {}).workspace === 'personal';
  const rows = S.history.filter(h => isP(h) === (S.space === 'personal') && hit(label[h.action], h.table_name, JSON.stringify(h.new_data || h.old_data)));
  return `<div class="tiles">${rows.map(h => `<div class="tile"><div class="tt"><span class="badge ${h.action}">${label[h.action]}</span><small>${new Date(h.created_at).toLocaleString('en-PH')}</small></div>
<div>${detail(h)}</div><small>${h.table_name === 'stores' ? 'Store' : h.table_name === 'overall_expenses' ? 'Overall expense' : h.table_name === 'debts' ? 'Utang' : h.table_name === 'wallets' ? 'Wallet' : h.table_name === 'transfers' ? 'Transfer' : h.table_name === 'goals' ? 'Savings goal' : h.table_name === 'goal_contributions' ? 'Goal deposit' : 'Transaction'}</small></div>`).join('') || '<p class="empty">No history yet.</p>'}</div>`;
}

A.addEventListener('click', async e => {
  const t = e.target, id = t.id, box = t.closest('[data-id]');
  const oa = t.closest('[data-oauth]'); if (oa) return oauth(oa.dataset.oauth);
  const bg = t.closest('#burger');
  if (bg) { S.menu = !S.menu; const sd = $('.side'); sd.classList.toggle('open', S.menu); bg.setAttribute('aria-expanded', S.menu); return; }
  if (S.menu && !t.closest('.side')) { S.menu = false; $('.side')?.classList.remove('open'); }
  if (t.dataset.space) { if (t.dataset.space !== S.space) setSpace(t.dataset.space); }
  else if (t.dataset.uf) { S.uf = t.dataset.uf; render(); }
  else if (t.dataset.tab) { S.menu = false; S.tab = t.dataset.tab; S.q = ''; S.edit = null; S.store = ''; S.pendingLogo = undefined; render(); }
  else if (t.dataset.qa) { S.menu = false; S.tab = 'transactions'; S.pref = t.dataset.qa; S.q = ''; if (S.store === OVERALL && t.dataset.qa === 'income') S.store = ''; if (!S.store && S.stores.length === 1) S.store = S.stores[0].id; S.edit = null; render(); $('.addform [data-f=description]')?.focus(); }
  else if (t.closest('[data-open]') && !t.closest('button')) { S.store = t.closest('[data-open]').dataset.open; S.tab = 'transactions'; S.q = ''; S.edit = null; render(); }
  else if (t.dataset.rp) { const R = repState(); R.preset = t.dataset.rp; if (R.preset !== 'custom') [R.from, R.to] = presetRange(R.preset); render(); }
  else if (id === 'dlcsv' || id === 'dlxlsx' || id === 'dlpdf') exportReport(id.slice(2));
  else if (t.dataset.p) { S.period = t.dataset.p; render(); }
  else if (id === 'prev' || id === 'next') { shift(id === 'next' ? 1 : -1); render(); }
  else if (id === 'now') { S.anchor = today(); render(); }
  else if (t.dataset.c) { t.closest('.addform, .editing').querySelector('[data-f=color]').value = t.dataset.c; }
  else if (t.classList.contains('rmlogo')) {
    S.pendingLogo = ''; const f = t.closest('.addform, .editing');
    f.querySelector('.av-prev').innerHTML = avatar({ name: f.querySelector('[data-f=name]').value, color: f.querySelector('[data-f=color]').value });
  }
  else if (id === 'openreset') {
    if (OFF.needNet('Resetting data')) return;
    const { data, error } = await sb.rpc('has_passcode');
    if (error) return toast(error.message + ' (run the latest schema.sql)');
    S.modal = data ? 'reset' : 'set'; render(); $('#m_code, #m_new')?.focus();
  }
  else if (id === 'mclose' || id === 'ov') { S.modal = null; render(); }
  else if (id === 'editname') { S.modal = 'profile'; render(); $('#p_name')?.focus(); }
  else if (id === 'dosaveprofile') {
    if (OFF.needNet('Saving your profile')) return;
    const full_name = $('#p_name').value.trim(); if (!full_name) return toast('Please enter your full name.');
    const { data, error } = await sb.auth.updateUser({ data: { full_name, business: $('#p_biz').value.trim() } });
    if (error) return toast(error.message);
    S.user = data.user; S.modal = null; render(); toast('Profile saved.');
  }
  else if (id === 'tochange') { S.modal = 'change'; render(); $('#m_old')?.focus(); }
  else if (id === 'dosave') {
    if (OFF.needNet('Setting the passcode')) return;
    const n1 = $('#m_new').value, n2 = $('#m_new2').value;
    if (n1.length < 4) return toast('Passcode must be at least 4 characters.');
    if (n1 !== n2) return toast('Passcodes do not match.');
    const { error } = await sb.rpc('set_passcode', { new_code: n1, old_code: $('#m_old')?.value || null });
    if (error) return toast(error.message);
    S.modal = null; render(); toast('Passcode saved.');
  }
  else if (id === 'doreset') {
    if (OFF.needNet('Resetting data')) return;
    const { error } = await sb.rpc('reset_all', { code: $('#m_code').value });
    if (error) return toast(error.message);
    S.modal = null; S.store = ''; S.edit = null; S.tab = 'stores'; toast('All data was reset.'); await load();
  }
  else if (id === 'back') { S.store = ''; S.q = ''; S.edit = null; render(); }
  else if (id === 'out') { if (!OFF.beforeOut()) return; await sb.auth.signOut(); OFF.clear(); }
  else if (id === 'mode') { S.mode = S.mode === 'in' ? 'up' : 'in'; render(); }
  else if (id === 'forgot') { S.mode = 'forgot'; render(); $('#em')?.focus(); }
  else if (id === 'adds') { const o = vals($('.addform')); if (!o.name) return toast('Enter a store name.'); if (S.pendingLogo) o.logo = S.pendingLogo; S.pendingLogo = undefined; await run(sb.from('stores').insert(o)); }
  else if (id === 'addutang') {
    const o = vals($('.addform')); if (!o.person) return toast('Enter the name of the person.'); if (!(o.amount > 0)) return toast('Enter an amount greater than zero.');
    o.due_on = o.due_on || null; await run(sb.from('debts').insert(o));
  }
  else if (t.classList.contains('upaid')) { await run(sb.from('debts').update({ paid_amount: +box.dataset.amt, paid_at: new Date().toISOString() }).eq('id', box.dataset.id)); toast('Marked as paid.'); }
  else if (t.classList.contains('uundo')) await run(sb.from('debts').update({ paid_amount: 0, paid_at: null }).eq('id', box.dataset.id));
  else if (t.classList.contains('upay')) {
    const amt = +box.dataset.amt, paid = +box.dataset.paid, v = parseFloat(prompt(`How much was paid? Balance: ${peso(amt - paid)}`, (amt - paid).toFixed(2)));
    if (!(v > 0)) return; const np = Math.min(amt, paid + v);
    await run(sb.from('debts').update({ paid_amount: np, paid_at: np >= amt ? new Date().toISOString() : null }).eq('id', box.dataset.id));
  }
  else if (id === 'setbudget') {
    const o = vals($('.addform')); if (!o.category) return toast('Enter a category, e.g. Food.'); if (!(o.amount > 0)) return toast('Enter a budget amount greater than zero.');
    await saveBudgets({ ...budgets(), [o.category]: o.amount }, 'Budget saved.');
  }
  else if (t.classList.contains('rmbudget')) { const b = { ...budgets() }; delete b[t.dataset.cat]; await saveBudgets(b, 'Budget removed.'); }
  else if (id === 'hidebal') { try { localStorage.setItem('bt-hide', hideBal() ? '0' : '1'); } catch (e) { /* private mode */ } render(); }
  else if (t.classList.contains('wadd')) { S.wtx = box.dataset.id; S.modal = 'wtx'; render(); $('#wtx_amt')?.focus(); }
  else if (t.classList.contains('wact')) { S.wopen = S.wopen === box.dataset.id ? null : box.dataset.id; render(); }
  else if (t.classList.contains('wxfer')) {
    const f = $('#xferform'); if (!f) return toast('Add at least two wallets first.');
    f.querySelector('[data-f=from_wallet]').value = box.dataset.id; const to = f.querySelector('[data-f=to_wallet]');
    if (to.value === box.dataset.id) to.value = S.wallets.find(x => x.id !== box.dataset.id)?.id || to.value;
    f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.querySelector('[data-f=amount]').focus();
  }
  else if (t.classList.contains('wadjust')) {
    const w = S.wallets.find(x => x.id === box.dataset.id), cur = walletBal(w), v = prompt(`What balance does your ${w.name} show right now?\n(Currently ${peso(cur)} in this app. The difference is added to the starting balance, not counted as income or expense.)`, cur.toFixed(2));
    if (v === null) return; const n = parseFloat(v); if (!Number.isFinite(n)) return toast('Enter a valid amount.');
    if (Math.abs(n - cur) < 0.005) return toast('Already matches.');
    await run(sb.from('wallets').update({ opening_balance: +(+w.opening_balance + n - cur).toFixed(2) }).eq('id', w.id)); toast('Balance adjusted.');
  }
  else if (id === 'dowtx') {
    const o = vals($('#wtxf')); if (!(o.amount > 0)) return toast('Enter an amount greater than zero.');
    { const w = S.wallets.find(x => x.id === S.wtx), m = w && o.kind === 'expense' && shortBy(w, o.amount); if (m) return toast(m); }
    o.wallet_id = S.wtx; o.workspace = 'personal'; o.category = o.category || 'General'; o.occurred_on = o.occurred_on || today(); if (!o.ref) delete o.ref;
    S.modal = null; S.lastWallet = S.wtx; S.wopen = S.wtx; await run(sb.from('transactions').insert(o)); toast('Transaction saved.');
  }
  else if (id === 'addgoal') {
    const o = vals($('#goalform')); if (!o.name) return toast('Enter a goal name, e.g. Emergency fund.'); if (!(o.target_amount > 0)) return toast('Enter a target amount greater than zero.');
    o.target_date = o.target_date || null; await run(sb.from('goals').insert(o)); toast('Goal created. Tap Add money to start saving!');
  }
  else if (t.dataset.gidea) { const f = $('#goalform'); f.querySelector('[data-f=name]').value = t.dataset.gidea; f.querySelector('[data-f=target_amount]').focus(); }
  else if (t.classList.contains('gadd') || t.classList.contains('gsub')) { S.gc = { id: box.dataset.id, sign: t.classList.contains('gadd') ? 1 : -1 }; S.modal = 'gcon'; render(); $('#gc_amt')?.focus(); }
  else if (t.classList.contains('ghist')) { S.gopen = S.gopen === box.dataset.id ? null : box.dataset.id; render(); }
  else if (id === 'dogc') {
    const g = S.goals.find(x => x.id === S.gc.id), o = vals($('#gcf')), saved = goalSaved(g); if (!(o.amount > 0)) return toast('Enter an amount greater than zero.');
    if (S.gc.sign < 0 && o.amount > saved + 0.004) return toast(`You only have ${peso(saved)} saved in this goal.`);
    const w = S.wallets.find(x => x.id === o.wallet_id); if (S.gc.sign > 0 && w && o.amount > walletBal(w) + 0.004) return toast(`Not enough in ${w.name} (${peso(walletBal(w))}).`);
    const row = { goal_id: g.id, amount: S.gc.sign * o.amount, wallet_id: o.wallet_id || null, occurred_on: o.occurred_on || today() }; if (o.note) row.note = o.note;
    S.modal = null; S.gopen = g.id; await run(sb.from('goal_contributions').insert(row));
    toast(S.gc.sign > 0 && saved + o.amount >= +g.target_amount ? 'Goal reached! Congratulations 🎉' : S.gc.sign > 0 ? 'Saved! Keep going.' : 'Withdrawn.');
  }
  else if (id === 'addwallet') {
    const o = vals($('#walform')); if (!o.name) return toast('Enter a wallet name, e.g. GCash.');
    o.opening_balance = Number.isFinite(o.opening_balance) ? o.opening_balance : 0; await run(sb.from('wallets').insert(o));
  }
  else if (t.dataset.wpreset) {
    const [n, k, c] = t.dataset.wpreset.split('|'), f = $('#walform');
    f.querySelector('[data-f=name]').value = n; f.querySelector('[data-f=kind]').value = k; f.querySelector('[data-f=color]').value = c; f.querySelector('[data-f=opening_balance]').focus();
  }
  else if (id === 'addxfer') {
    const o = vals($('#xferform')); if (!o.from_wallet || !o.to_wallet) return toast('Choose both wallets.');
    if (o.from_wallet === o.to_wallet) return toast('Pick two different wallets.');
    if (!(o.amount > 0)) return toast('Enter an amount greater than zero.');
    o.fee = Number.isFinite(o.fee) ? o.fee : 0; o.occurred_on = o.occurred_on || today();
    { const m = shortBy(S.wallets.find(x => x.id === o.from_wallet), o.amount + o.fee); if (m) return toast(m); }
    await run(sb.from('transfers').insert(o)); toast('Transfer recorded.');
  }
  else if (id === 'addoe') {
    const o = vals($('.addform')); if (!(o.amount > 0)) return toast('Enter an amount greater than zero.');
    o.category = o.category || 'General'; o.occurred_on = o.occurred_on || today();
    await run(sb.from('overall_expenses').insert(o));
  }
  else if (id === 'add') {
    const o = vals($('.addform')); if (!(o.amount > 0)) return toast('Enter an amount greater than zero.');
    o.category = o.category || 'General'; o.occurred_on = o.occurred_on || today();
    if (!o.ref) delete o.ref;
    if (S.space === 'personal') { const w = S.wallets.find(x => x.id === o.wallet_id), m = w && o.kind === 'expense' && shortBy(w, o.amount); if (m) return toast(m); o.workspace = 'personal'; o.wallet_id = o.wallet_id || null; S.lastWallet = o.wallet_id || ''; }
    await run(sb.from('transactions').insert(o));
  } else if (t.classList.contains('edit')) { S.edit = box.dataset.id; S.pendingLogo = undefined; render(); }
  else if (t.classList.contains('cancel')) { S.edit = null; S.pendingLogo = undefined; render(); }
  else if (t.classList.contains('save')) {
    const o = vals(box), tb = box.dataset.t;
    if (tb === 'stores' && !o.name) return toast('Enter a store name.');
    if (tb === 'goals') { if (!o.name) return toast('Enter a goal name.'); if (!(o.target_amount > 0)) return toast('Enter a target amount greater than zero.'); o.target_date = o.target_date || null; }
    if (tb === 'wallets') { if (!o.name) return toast('Enter a wallet name.'); o.opening_balance = Number.isFinite(o.opening_balance) ? o.opening_balance : 0; }
    if (tb === 'transactions' && 'wallet_id' in o) o.wallet_id = o.wallet_id || null;
    if (tb === 'transactions' && o.wallet_id && o.kind === 'expense') { const w = S.wallets.find(x => x.id === o.wallet_id), og = S.ptx.find(x => x.id === box.dataset.id); const back = og && og.wallet_id === o.wallet_id ? (og.kind === 'expense' ? +og.amount : -og.amount) : 0; const m = w && shortBy(w, o.amount, back); if (m) return toast(m); }
    if (tb === 'transactions' && 'ref' in o && !o.ref) { const og = S.ptx.find(x => x.id === box.dataset.id); if (og && og.ref) o.ref = null; else delete o.ref; }
    if (tb === 'debts') { if (!o.person) return toast('Enter the name of the person.'); o.due_on = o.due_on || null; }
    if ((tb === 'transactions' || tb === 'overall_expenses' || tb === 'debts') && !(o.amount > 0)) return toast('Enter an amount greater than zero.');
    if (tb === 'stores' && S.pendingLogo !== undefined) o.logo = S.pendingLogo || null;
    S.pendingLogo = undefined; S.edit = null; await run(sb.from(tb).update(o).eq('id', box.dataset.id));
  } else if (t.classList.contains('del')) {
    if (confirm(box.dataset.t === 'stores' ? 'Delete this store and ALL its transactions?' : box.dataset.t === 'overall_expenses' ? 'Delete this overall expense?' : box.dataset.t === 'debts' ? 'Delete this utang record?' : box.dataset.t === 'wallets' ? 'Delete this wallet? Its transfers are deleted too; its income/expense entries stay but become unassigned.' : box.dataset.t === 'transfers' ? 'Delete this transfer? Balances will update.' : box.dataset.t === 'goals' ? 'Delete this goal and all its deposits? Money taken from a wallet goes back to that wallet.' : box.dataset.t === 'goal_contributions' ? 'Delete this deposit? The goal and wallet balances will update.' : 'Delete this transaction?')) await run(sb.from(box.dataset.t).delete().eq('id', box.dataset.id));
  }
});

A.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'jump') { S.anchor = t.value || today(); render(); }
  else if (t.id === 'rfrom' || t.id === 'rto') { const R = repState(); R[t.id === 'rfrom' ? 'from' : 'to'] = t.value || today(); R.preset = 'custom'; render(); }
  else if (t.dataset.rs !== undefined) { const ids = [...A.querySelectorAll('[data-rs]:checked')].map(x => x.dataset.rs); repState().stores = ids.length === S.stores.length ? null : ids; render(); }
  else if (t.id === 'roe') { repState().oe = t.checked; render(); }
  else if (t.dataset.logo !== undefined && t.files[0]) {
    try { S.pendingLogo = await toLogo(t.files[0]); t.closest('.addform, .editing').querySelector('.av-prev').innerHTML = `<img class="av" src="${S.pendingLogo}" alt="">`; }
    catch (err) { toast(err.message); }
  }
});

A.addEventListener('input', e => {
  if (e.target.id !== 'q') return;
  S.q = e.target.value; render();
  const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
});

A.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  const f = e.target.closest('.addform, .editing, .dialog'); if (f) f.querySelector('button.primary, button.danger').click();
});

A.addEventListener('submit', async e => {
  e.preventDefault();
  if (S.mode === 'forgot') {
    const email = $('#em').value.trim();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) return toast(error.message);
    S.mode = 'in'; render(); return toast('If that email has an account, a reset link is on its way. Check your inbox and spam.');
  }
  if (S.mode === 'reset') {
    const password = $('#pw').value;
    if (password !== $('#pw2').value) return toast('Passwords do not match.');
    const { error } = await sb.auth.updateUser({ password });
    if (error) return toast(error.message);
    S.recovery = false; S.mode = 'in'; history.replaceState(null, '', location.pathname); toast('Password updated. You are signed in.'); return load();
  }
  const email = $('#em').value.trim(), password = $('#pw').value;
  if (S.mode === 'up') {
    if (password !== $('#pw2').value) return toast('Passwords do not match.');
    const full_name = $('#fn').value.trim().replace(/\s+/g, ' ');
    if (full_name.length < 2) return toast('Please enter your full name.');
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name, business: $('#bn').value.trim() } } });
    if (error) return toast(error.message);
    if (!data.session) { toast('Account created. Check your email to confirm, then sign in.'); S.mode = 'in'; render(); }
    return;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) toast(error.message);
});

if (READY) {
  sb.auth.onAuthStateChange((_ev, s) => {
    if (_ev === 'PASSWORD_RECOVERY') { S.recovery = true; S.mode = 'reset'; }
    const u = s?.user || null, changed = u?.id !== S.user?.id;
    S.user = u;
    if (!u) { S.recovery = false; render(); } else if (S.recovery) render(); else if (changed) setTimeout(load, 0);
  });
} else render();
