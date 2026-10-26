/* Peso: AI money companion (talks to /api/chat -> Gemini). Uses S, sb, peso, esc, today from app.js at call time. */
const PERSONAL_CHIPS = ['How much did I spend this month?', 'Where is my money going?', 'Am I within my budgets?', 'How can I save more?', 'USD to PHP today? 💵', 'Give me a fun money tip', 'Add ₱100 lunch expense'];
const AI_CHIPS = ['How am I doing this month?', 'Which store earns the most?', 'Where is my money going?', 'Any tips to improve profit?', 'USD to PHP today? 💵', 'Give me a fun business tip', 'Add ₱500 sales today'];
S.ai = { msgs: [], busy: false, draft: '', open: false, seen: false, intro: '' };

const aiMd = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .split('\n').map(l => /^\s*[-*•]\s+/.test(l) ? '<span class="aib">•</span>' + l.replace(/^\s*[-*•]\s+/, '') : l).join('<br>');

function aiPersonalContext() {
  const t = today(), d = parse(t), from90 = new Date(d); from90.setDate(d.getDate() - 90);
  const f90 = ymd(from90), mStart = ymd(new Date(d.getFullYear(), d.getMonth(), 1)), mEnd = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const wk = monday(d), wkEnd = new Date(wk); wkEnd.setDate(wk.getDate() + 6);
  const span = (a, b) => { const r = S.ptx.filter(x => x.occurred_on >= a && x.occurred_on <= b); return { i: sumBy(r, 'income'), e: sumBy(r, 'expense') }; };
  const line = (l, x) => `${l}: income ${peso(x.i)}, expenses ${peso(x.e)}, net ${peso(x.i - x.e)}`;
  const out = ['MODE: PERSONAL. This is the user\'s own personal money (no stores, no business). Give personal budgeting and saving advice.', `Today: ${t}. The screen is showing: ${periodLabel()} (${S.period}).`,
    line('Today', span(t, t)), line('This week', span(ymd(wk), ymd(wkEnd))), line('This month', span(mStart, mEnd)), line('All time', span('0000-01-01', '9999-12-31')), '', 'MONTHLY BUDGETS (month shown on screen):'];
  const br = budgetRows(); br.forEach(b => out.push(`- ${b.cat}: spent ${peso(b.spent)} of ${peso(b.limit)} (${Math.round(b.pct)}%)`)); if (!br.length) out.push('(no budgets set yet)');
  out.push('', 'UTANG (open records; direction | person | balance | due date):');
  const od = S.debts.filter(x => !dPaid(x)); od.forEach(x => out.push(`- ${x.direction === 'owed_to_me' ? 'They owe the user' : 'The user owes'} | ${x.person} | ${peso(dBal(x))} | ${x.due_on || 'no due date'}`)); if (!od.length) out.push('(none)');
  out.push('', 'SAVING GOALS (saved / target / target date):'); S.goals.forEach(g => out.push(`- ${g.name}: ${peso(goalSaved(g))} of ${peso(g.target_amount)}${g.target_date ? ' by ' + g.target_date : ''}`)); if (!S.goals.length) out.push('(no goals yet)');
  out.push('', 'WALLETS (current balance):'); S.wallets.forEach(w => out.push(`- ${w.name} (${w.kind}): ${peso(walletBal(w))}`)); if (!S.wallets.length) out.push('(no wallets yet)');
  const cm = {}; S.ptx.filter(x => x.occurred_on >= mStart && x.occurred_on <= mEnd).forEach(x => { const k = x.kind + ' / ' + (x.category || 'General'); cm[k] = (cm[k] || 0) + +x.amount; });
  out.push('', 'THIS MONTH BY CATEGORY:', ...Object.entries(cm).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${peso(v)}`), '');
  out.push(`RECENT ENTRIES (since ${f90}, newest first, max 150; date | type | category | description | amount):`);
  S.ptx.filter(x => x.occurred_on >= f90).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).slice(0, 150)
    .forEach(x => out.push(`${x.occurred_on} | ${x.kind} | ${x.category || 'General'} | ${(x.description || '').slice(0, 60)} | ${(+x.amount).toFixed(2)}`));
  return out.join('\n');
}

function aiContext() {
  if (S.space === 'personal') return aiPersonalContext();
  const t = today(), d = parse(t), from90 = new Date(d); from90.setDate(d.getDate() - 90);
  const f90 = ymd(from90), mStart = ymd(new Date(d.getFullYear(), d.getMonth(), 1)), mEnd = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const wk = monday(d), wkEnd = new Date(wk); wkEnd.setDate(wk.getDate() + 6);
  const span = (rows, a, b) => { const r = rows.filter(x => x.occurred_on >= a && x.occurred_on <= b); return { i: sumBy(r, 'income'), e: sumBy(r, 'expense') }; };
  const line = (lbl, x) => `${lbl}: income ${peso(x.i)}, expenses ${peso(x.e)}, net ${peso(x.i - x.e)}`;
  const oeAsRows = S.oe.map(o => ({ ...o, kind: 'expense' }));
  const all = [...S.tx, ...oeAsRows];
  const out = [`Today: ${t}. The screen is showing: ${periodLabel()} (${S.period}).`, 'Overall = all store income minus store expenses minus overall expenses (salary, rent, maintenance).',
    line('OVERALL today', span(all, t, t)), line('OVERALL this week', span(all, ymd(wk), ymd(wkEnd))), line('OVERALL this month', span(all, mStart, mEnd)), line('OVERALL all time', span(all, '0000-01-01', '9999-12-31')), '', 'STORES:'];
  S.stores.forEach(s => { const r = S.tx.filter(x => x.store_id === s.id);
    out.push(`- ${s.name}: ` + [['today', t, t], ['this week', ymd(wk), ymd(wkEnd)], ['this month', mStart, mEnd], ['all time', '0000-01-01', '9999-12-31']].map(([l, a, b]) => { const x = span(r, a, b); return `${l} net ${peso(x.i - x.e)} (in ${peso(x.i)}, out ${peso(x.e)})`; }).join('; ')); });
  if (!S.stores.length) out.push('(no stores yet)');
  const cm = {}; all.filter(x => x.occurred_on >= mStart && x.occurred_on <= mEnd).forEach(x => { const k = x.kind + ' / ' + (x.category || 'General'); cm[k] = (cm[k] || 0) + +x.amount; });
  out.push('', 'THIS MONTH BY CATEGORY:', ...(Object.entries(cm).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${peso(v)}`)), '');
  out.push(`RECENT ENTRIES (since ${f90}, newest first, max 150; date | store | type | category | description | amount):`);
  [...S.tx.map(x => ({ ...x, st: storeName(x.store_id) })), ...oeAsRows.map(x => ({ ...x, st: 'Overall (all stores)' }))]
    .filter(x => x.occurred_on >= f90).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).slice(0, 150)
    .forEach(x => out.push(`${x.occurred_on} | ${x.st} | ${x.kind} | ${x.category || 'General'} | ${(x.description || '').slice(0, 60)} | ${(+x.amount).toFixed(2)}`));
  return out.join('\n');
}


/* ---- Peso actions: Peso proposes, you confirm, the app saves with your own login ---- */
const aiNorm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function aiPick(list, q, extra) {
  const n = aiNorm(q); if (!n) return null;
  let m = list.filter(x => aiNorm(x.name) === n);
  if (!m.length) m = list.filter(x => { const k = aiNorm(x.name); return k && (k.includes(n) || n.includes(k)); });
  if (!m.length && extra) m = extra(n);
  return m.length === 1 ? m[0] : m.length > 1 ? 'many' : null;
}
const aiNames = l => l.map(x => x.name).join(', ') || 'none yet';
const aiDate = d => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return today(); const x = new Date(d + 'T00:00'); return isNaN(x) ? today() : d; };
const aiAmt = v => { const n = Number(v); return Number.isFinite(n) && n > 0 && n < 1e9 ? Math.round(n * 100) / 100 : 0; };
function aiPlan(a) {
  const g = a.args || {}, amount = aiAmt(g.amount), date = aiDate(g.date), bad = err => ({ err, state: 'error' });
  const kindWord = k => k === 'income' ? 'Income' : 'Expense';
  const wallet = w => aiPick(S.wallets, w, n => S.wallets.filter(x => x.kind === n || (n === 'e wallet' && x.kind === 'ewallet')));
  if (!amount) return bad('I need an amount greater than zero to record that.');
  if (a.name === 'add_store_transaction' || a.name === 'add_overall_expense') {
    if (S.space !== 'business') return bad('Switch to Business mode so I can record store entries.');
    if (a.name === 'add_overall_expense') return { state: 'pending', table: 'overall_expenses', row: { amount, description: String(g.description || '').slice(0, 120), category: String(g.category || 'General').slice(0, 60), occurred_on: date }, label: `Overall expense ${peso(amount)} · ${g.description || g.category || 'no description'} · ${fmtDate(date)}` };
    const kind = g.kind === 'income' ? 'income' : 'expense';
    let st = g.store ? aiPick(S.stores, g.store) : (S.store && S.store !== OVERALL ? S.stores.find(x => x.id === S.store) : (S.stores.length === 1 ? S.stores[0] : null));
    if (st === 'many' || !st) return bad(`Which store is that for? Your stores: ${aiNames(S.stores)}.`);
    return { state: 'pending', table: 'transactions', row: { store_id: st.id, kind, amount, description: String(g.description || '').slice(0, 120), category: String(g.category || 'General').slice(0, 60), occurred_on: date }, label: `${kindWord(kind)} ${peso(amount)} · ${st.name} · ${g.description || g.category || 'no description'} · ${fmtDate(date)}` };
  }
  if (S.space !== 'personal') return bad('Switch to Personal mode so I can record personal entries.');
  if (a.name === 'add_personal_transaction') {
    const kind = g.kind === 'income' ? 'income' : 'expense', row = { kind, amount, description: String(g.description || '').slice(0, 120), category: String(g.category || 'General').slice(0, 60), occurred_on: date, workspace: 'personal' };
    let wn = '';
    if (g.wallet) { const w = wallet(g.wallet); if (!w || w === 'many') return bad(`Which wallet? Your wallets: ${aiNames(S.wallets)}.`); if (kind === 'expense' && shortBy(w, amount)) return bad(shortBy(w, amount)); row.wallet_id = w.id; wn = ' · ' + w.name; }
    return { state: 'pending', table: 'transactions', row, label: `${kindWord(kind)} ${peso(amount)}${wn} · ${g.description || g.category || 'no description'} · ${fmtDate(date)}` };
  }
  if (a.name === 'transfer_between_wallets') {
    const f = wallet(g.from_wallet), t = wallet(g.to_wallet);
    if (!f || f === 'many' || !t || t === 'many') return bad(`I couldn't match those wallets. Your wallets: ${aiNames(S.wallets)}.`);
    if (f.id === t.id) return bad('Pick two different wallets.');
    const fee = Math.max(0, Number(g.fee) || 0);
    if (shortBy(f, amount + fee)) return bad(shortBy(f, amount + fee));
    return { state: 'pending', table: 'transfers', row: { from_wallet: f.id, to_wallet: t.id, amount, fee, occurred_on: date, ...(g.note ? { note: String(g.note).slice(0, 80) } : {}) }, label: `Transfer ${peso(amount)} · ${f.name} → ${t.name}${fee ? ' · fee ' + peso(fee) : ''} · ${fmtDate(date)}` };
  }
  if (a.name === 'add_to_goal') {
    const gl = aiPick(S.goals, g.goal);
    if (!gl || gl === 'many') return bad(`Which goal? Your goals: ${aiNames(S.goals)}.`);
    const row = { goal_id: gl.id, amount, occurred_on: date, ...(g.note ? { note: String(g.note).slice(0, 80) } : {}) }; let wn = '';
    if (g.wallet) { const w = wallet(g.wallet); if (!w || w === 'many') return bad(`Which wallet? Your wallets: ${aiNames(S.wallets)}.`);
      if (shortBy(w, amount)) return bad(shortBy(w, amount)); row.wallet_id = w.id; wn = ' from ' + w.name; }
    return { state: 'pending', table: 'goal_contributions', row, label: `Save ${peso(amount)} to ${gl.name}${wn} · ${fmtDate(date)}` };
  }
  return bad('I can\'t do that one yet.');
}
async function aiActClick(mi, ai, what) {
  const m = S.ai.msgs[mi], act = m?.acts?.[ai]; if (!act) return;
  if (what === 'cancel') { act.state = 'cancelled'; return aiPaint(); }
  if (what === 'ok' && act.state === 'pending') {
    act.state = 'running'; aiPaint();
    try {
      const r = await sb.from(act.table).insert(act.row).select('id').single();
      if (r.error) throw new Error(r.error.message);
      act.id = r.data?.id; act.state = 'done'; await load();
    } catch (e) { act.state = 'error'; act.err = e.message || 'Could not save that.'; }
    return aiPaint();
  }
  if (what === 'undo' && act.state === 'done' && act.id) {
    act.state = 'running'; aiPaint();
    try { const r = await sb.from(act.table).delete().eq('id', act.id); if (r.error) throw new Error(r.error.message); act.state = 'undone'; await load(); }
    catch (e) { act.state = 'done'; toast(e.message || 'Could not undo.'); }
    aiPaint();
  }
}
const aiActsHtml = (m, mi) => (m.acts || []).map((a, i) => {
  const d = `data-mi="${mi}" data-ai="${i}"`;
  if (a.state === 'error') return `<div class="aiact err">${esc(a.err)}</div>`;
  const body = a.state === 'pending' ? `<div class="aiact-b"><button type="button" class="primary" data-ai-act="ok" ${d}>Confirm</button><button type="button" data-ai-act="cancel" ${d}>Cancel</button></div>`
    : a.state === 'running' ? '<div class="aiact-s">Working…</div>'
    : a.state === 'done' ? `<div class="aiact-s ok">✓ Saved <button type="button" class="link" data-ai-act="undo" ${d}>Undo</button></div>`
    : a.state === 'undone' ? '<div class="aiact-s">Undone</div>' : '<div class="aiact-s">Cancelled</div>';
  return `<div class="aiact ${a.state}"><div class="aiact-l">${esc(a.label)}</div>${body}</div>`;
}).join('');

function aiThreadHtml() {
  const a = S.ai;
  return `<div class="aim bot">${aiMd(a.intro || 'Hi! Ask me about your stores, income and expenses, the dollar rate today, or for a business tip.')}</div>`
    + a.msgs.map((m, mi) => `<div class="aim ${m.role === 'user' ? 'me' : 'bot'}${m.err ? ' err' : ''}">${m.text ? aiMd(m.text) : ''}${aiActsHtml(m, mi)}</div>`).join('')
    + (a.busy ? '<div class="aim bot"><span class="dots"><i></i><i></i><i></i></span></div>' : '');
}
function companionHtml(msg) {
  const a = S.ai; a.intro = msg;
  return `<div class="ai-widget">
<section class="ai-panel" id="ai_panel" role="dialog" aria-label="Peso AI" ${a.open ? '' : 'hidden'}>
<header class="ai-top"><img class="mark" src="mark.png" alt=""><div class="ai-title"><b>Peso</b><span>Your AI money companion</span></div>${a.msgs.length ? '<button type="button" id="ai_clear" class="ai-new" title="Start a new chat">New chat</button>' : ''}<button type="button" id="ai_close" class="ai-x" aria-label="Close chat">&#10005;</button></header>
<div class="ai-thread" id="ai_thread">${aiThreadHtml()}</div>
${a.msgs.length ? '' : `<div class="ai-chips">${(S.space === 'personal' ? PERSONAL_CHIPS : AI_CHIPS).map(c => `<button type="button" class="ai-chip" data-ai-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>`}
<div class="ai-input"><input id="ai_q" placeholder="Ask Peso about your money\u2026" maxlength="500" autocomplete="off" value="${esc(a.draft)}"><button type="button" id="ai_send" class="primary" ${a.busy ? 'disabled' : ''}>Ask</button></div>
</section>
${a.open || a.seen ? '' : '<div class="ai-teaser" id="ai_teaser">Hi! Ask Peso \u{1F4AC}</div>'}
<button type="button" id="ai_fab" class="ai-fab${a.open ? ' on' : ''}" aria-label="Open Peso AI chat" aria-expanded="${a.open ? 'true' : 'false'}"><img src="mark.png" alt=""><svg class="ai-fx" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
</div>`;
}
function aiAfterRender() { const t = document.getElementById('ai_thread'); if (t) t.scrollTop = t.scrollHeight; }
function aiPaint() {
  const t = document.getElementById('ai_thread'); if (!t) return;
  t.innerHTML = aiThreadHtml(); t.scrollTop = t.scrollHeight;
  const b = document.getElementById('ai_send'); if (b) b.disabled = S.ai.busy;
  document.querySelector('.ai-chips')?.remove();
}
function aiToggle(open) {
  const a = S.ai; a.open = open; if (open) a.seen = true;
  const p = document.getElementById('ai_panel'), f = document.getElementById('ai_fab'); if (!p || !f) return;
  p.hidden = !open; f.classList.toggle('on', open); f.setAttribute('aria-expanded', open);
  document.getElementById('ai_teaser')?.remove();
  document.body.classList.toggle('ai-open', open);
  if (open) { aiAfterRender(); if (matchMedia('(hover:hover)').matches) document.getElementById('ai_q')?.focus(); }
}
async function aiAsk(text) {
  const a = S.ai; text = (text || '').trim();
  if (!text || a.busy) return;
  a.draft = ''; const q = document.getElementById('ai_q'); if (q) q.value = '';
  a.msgs.push({ role: 'user', text });
  if (!navigator.onLine) { a.msgs.push({ role: 'model', text: 'I need internet to think 📡. You can still add entries by hand while offline. They sync when you are back online.', err: true }); aiPaint(); return; }
  a.busy = true; aiPaint();
  try {
    const { data } = await sb.auth.getSession(), tok = data.session?.access_token;
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ context: aiContext(), mode: S.space === 'personal' ? 'personal' : 'business', messages: a.msgs.filter(m => !m.err && (m.text || m.acts?.length)).map(m => ({ role: m.role, text: (m.text || '') + (m.acts?.length ? ' [' + m.acts.map(x => x.state === 'done' ? 'saved: ' + x.label : x.state === 'cancelled' || x.state === 'undone' ? 'not saved' : x.state === 'error' ? 'could not record: ' + x.err : 'waiting for the user to confirm: ' + x.label).join('; ') + ']' : '') })) }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Something went wrong.');
    const acts = (j.actions || []).map(x => { const p = aiPlan(x); return p; });
    a.msgs.push({ role: 'model', text: j.reply || (acts.length ? '' : 'Done.'), acts });
  } catch (e) { a.msgs.push({ role: 'model', text: e.message || 'Something went wrong.', err: true }); }
  a.busy = false; aiPaint();
  if (!document.querySelector('#ai_clear')) { render(); document.body.classList.toggle('ai-open', S.ai.open); document.getElementById('ai_q')?.focus(); }
}
document.getElementById('app').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'ai_fab') aiToggle(!S.ai.open);
  else if (t.id === 'ai_close') aiToggle(false);
  else if (t.dataset.aiChip) aiAsk(t.dataset.aiChip);
  else if (t.dataset.aiAct) aiActClick(+t.dataset.mi, +t.dataset.ai, t.dataset.aiAct);
  else if (t.id === 'ai_send') aiAsk(document.getElementById('ai_q').value);
  else if (t.id === 'ai_clear') { S.ai.msgs = []; S.ai.draft = ''; render(); document.body.classList.toggle('ai-open', S.ai.open); }
});
document.getElementById('app').addEventListener('input', e => { if (e.target.id === 'ai_q') S.ai.draft = e.target.value; });
document.getElementById('app').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ai_q') { e.preventDefault(); aiAsk(e.target.value); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.ai.open) aiToggle(false); });
