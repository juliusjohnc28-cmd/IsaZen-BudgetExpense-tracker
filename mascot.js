/* Zen: the IsaZen mascot. Greets you by name, follows the pointer with her eyes, and shares random trivia when tapped.
   Self-contained: lives on <body> (outside #app) so app re-renders never remove her. Sprite sheet: mascot.webp (3x3 gaze directions). */
(function () {
  'use strict';
  var NAME = 'Zen';                       // change the mascot's name here
  var OFF_KEY = 'isazen-mascot-off';      // sessionStorage: "sleep" lasts until the tab is closed
  try { if (sessionStorage.getItem(OFF_KEY)) return; } catch (e) {}

  /* ---------- trivia (shuffled bag: no repeats until every fact has been shown) ---------- */
  var FACTS = [
    ['💰 Money', 'The peso sign ₱ is a P with two horizontal bars. It has its own spot in Unicode, so phones and computers can show it.'],
    ['💰 Money', 'Rule of 72: divide 72 by an interest rate to estimate how many years it takes money to double. At 6%, that is about 12 years.'],
    ['💰 Money', 'The 50/30/20 budget puts 50% of income on needs, 30% on wants and 20% on savings. It was popularized by Elizabeth Warren and Amelia Warren Tyagi.'],
    ['💰 Money', 'Japan’s kakeibo method, writing down every expense by hand, dates back to 1904.'],
    ['💰 Money', 'The “piggy” in piggy bank probably comes from “pygg”, an old English word for a type of clay, not from pigs.'],
    ['💰 Money', 'The word “bank” comes from the Italian “banca”, the bench money changers worked from.'],
    ['💰 Money', 'In 2010, someone paid 10,000 bitcoin for two pizzas. It is the most famous (and expensive) pizza order ever.'],
    ['💰 Money', 'The first ATM was installed by Barclays in Enfield, London, in 1967.'],
    ['💰 Money', 'The word “salary” is linked to the Latin word for salt. Historians still debate whether Roman soldiers were really paid in salt.'],
    ['💰 Money', 'China was the first to use paper money, more than 1,000 years ago.'],
    ['💡 Money tip', 'Pay yourself first: move a little to savings right after payday, before you start spending.'],
    ['💡 Money tip', 'Log an expense the moment it happens. It takes seconds, and it beats trying to remember a week later.'],
    ['💡 Money tip', 'A common goal for an emergency fund is 3 to 6 months of your basic expenses.'],
    ['💡 Money tip', 'Small spending adds up: ₱50 a day is ₱1,500 in a 30-day month.'],
    ['🇵🇭 Philippines', '“Sari-sari” means “assorted” in Tagalog, a fitting name for a store that sells a little bit of everything.'],
    ['🇵🇭 Philippines', 'The Philippines has more than 7,600 islands.'],
    ['🇵🇭 Philippines', 'Mindanao is the second-largest island in the Philippines, after Luzon.'],
    ['🇵🇭 Philippines', 'The Philippine eagle is the national bird, and one of the largest eagles in the world.'],
    ['🇵🇭 Philippines', 'The Philippine tarsier is one of the smallest primates on Earth.'],
    ['🌏 Fun fact', 'Honey almost never spoils. Edible honey has been found in ancient Egyptian tombs.'],
    ['🌏 Fun fact', 'Octopuses have three hearts.'],
    ['🌏 Fun fact', 'Botanically, bananas are berries, but strawberries are not.'],
    ['🌏 Fun fact', 'A day on Venus is longer than its year. It spins more slowly than it circles the Sun.'],
    ['🌏 Fun fact', 'Sharks are older than trees. They have been around for roughly 450 million years.'],
    ['🌏 Fun fact', 'Wombat poop is cube-shaped.'],
    ['🌏 Fun fact', 'A coconut is not a true nut. Botanically it is a drupe, like a peach or a cherry.'],
    ['🌏 Fun fact', 'A group of flamingos is called a flamboyance.'],
    ['🌏 Fun fact', 'Lightning heats the air around it to roughly 30,000°C, several times hotter than the surface of the Sun.'],
    ['🌏 Fun fact', 'Sea otters sometimes hold hands while they sleep so they do not drift apart.'],
    ['🌏 Fun fact', 'The Eiffel Tower can grow about 15 cm taller in summer because the iron expands in the heat.'],
    ['🌏 Fun fact', 'Butterflies taste with their feet.'],
    ['🌏 Fun fact', 'Crows can recognize individual human faces and remember them.'],
    ['🌏 Fun fact', 'The Moon drifts away from Earth by about 3.8 cm every year.'],
    ['🌏 Fun fact', 'Rice is a staple food for more than half of the world’s population.']
  ];
  var bag = [], lastFact = -1;
  function nextFact() {
    if (!bag.length) {
      for (var i = 0; i < FACTS.length; i++) bag.push(i);
      for (var j = bag.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)), t = bag[j]; bag[j] = bag[k]; bag[k] = t; }
      if (bag.length > 1 && bag[bag.length - 1] === lastFact) bag.unshift(bag.pop()); // avoid an immediate repeat across reshuffles
    }
    lastFact = bag.pop();
    return FACTS[lastFact];
  }

  /* ---------- DOM ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'mz'; wrap.setAttribute('data-mz', '');
  wrap.innerHTML =
    '<div class="mz-bubble" id="mz_bubble" role="status" aria-live="polite" hidden>' +
      '<div class="mz-tag"></div><div class="mz-txt"></div><div class="mz-hint"></div>' +
    '</div>' +
    '<button type="button" class="mz-x" aria-label="Let ' + NAME + ' take a nap" title="Let ' + NAME + ' take a nap">✕</button>' +
    '<button type="button" class="mz-body" aria-label="' + NAME + ', the IsaZen mascot. Tap for a fun fact." aria-controls="mz_bubble">' +
      '<span class="mz-sprite" aria-hidden="true"></span>' +
    '</button>';
  var bubble = wrap.querySelector('.mz-bubble'), tagEl = wrap.querySelector('.mz-tag'), txtEl = wrap.querySelector('.mz-txt'), hintEl = wrap.querySelector('.mz-hint');
  var body = wrap.querySelector('.mz-body'), sprite = wrap.querySelector('.mz-sprite'), closeBtn = wrap.querySelector('.mz-x');

  /* ---------- gaze: 3x3 sprite, row = up/center/down, col = left/center/right ---------- */
  var row = 1, col = 1, DEAD = 80;
  function setFrame(r, c) { row = r; col = c; sprite.style.backgroundPosition = (c * 50) + '% ' + (r * 50) + '%'; }
  function look(x, y) {
    var b = sprite.getBoundingClientRect(); if (!b.width) return;
    var dx = x - (b.left + b.width / 2), dy = y - (b.top + b.height * 0.4), t = 0.4142;
    var r = 1, c = 1;
    if (Math.hypot(dx, dy) >= DEAD) {
      var ax = Math.abs(dx), ay = Math.abs(dy);
      if (ay < t * ax) c = dx < 0 ? 0 : 2;
      else if (ax < t * ay) r = dy < 0 ? 0 : 2;
      else { c = dx < 0 ? 0 : 2; r = dy < 0 ? 0 : 2; }
    }
    if (r !== row || c !== col) setFrame(r, c);
  }
  var px = 0, py = 0, raf = 0;
  function onMove(e) {
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; look(px, py); });
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  document.addEventListener('mouseleave', function () { setFrame(1, 1); });

  // a quick blink (the lowered-lid frame) while she is looking straight ahead
  (function blink() {
    setTimeout(function () {
      if (row === 1 && col === 1 && !document.hidden) { setFrame(2, 1); setTimeout(function () { if (row === 2 && col === 1) setFrame(1, 1); }, 140); }
      blink();
    }, 2800 + Math.random() * 3600);
  })();

  /* ---------- speech bubble ---------- */
  var hideTimer = 0, hovering = false;
  function say(tag, text, hint, ms) {
    tagEl.textContent = tag || ''; tagEl.hidden = !tag;
    txtEl.textContent = text; hintEl.textContent = hint || ''; hintEl.hidden = !hint;
    bubble.hidden = false;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    clearTimeout(hideTimer);
    var wait = ms || Math.max(6500, text.length * 75 + 3000);
    (function arm() { hideTimer = setTimeout(function () { if (hovering) return arm(); bubble.hidden = true; }, wait); })();
  }
  bubble.addEventListener('mouseenter', function () { hovering = true; });
  bubble.addEventListener('mouseleave', function () { hovering = false; });
  function hop() { wrap.classList.remove('hop'); void wrap.offsetWidth; wrap.classList.add('hop'); }

  function trivia() { var f = nextFact(); hop(); say(f[0], f[1], 'Tap me for another'); }
  body.addEventListener('click', trivia);
  closeBtn.addEventListener('click', function () {
    say('', 'Okay, I’ll nap. See you next time! 💤', '', 1800);
    setTimeout(function () { try { sessionStorage.setItem(OFF_KEY, '1'); } catch (e) {} wrap.remove(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', onMove); }, 1900);
  });

  /* ---------- greetings ---------- */
  function who() { try { return typeof firstName === 'function' ? firstName() : ''; } catch (e) { return ''; } }
  function signedIn() { try { return !!(typeof S !== 'undefined' && S.user); } catch (e) { return false; } }
  function userId() { try { return S.user.id || S.user.email || 'u'; } catch (e) { return ''; } }
  function greeting(name) {
    var h = new Date().getHours();
    var part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return part + (name ? ', ' + name : '') + '! 👋';
  }
  var greetedFor = null; // null = not yet, '' = generic welcome shown, otherwise the user id
  function checkGreet() {
    if (document.hidden) return;
    if (signedIn()) {
      var id = userId();
      if (greetedFor !== id) {
        greetedFor = id; hop();
        setTimeout(function () { say('', greeting(who()) + ' I’m ' + NAME + '.', 'Tap me for a fun fact!', 8000); }, 250);
      }
    } else if (greetedFor === null) {
      greetedFor = ''; hop();
      say('', 'Welcome to IsaZen! 👋 I’m ' + NAME + '.', 'Tap me for a fun fact!', 7000);
    }
  }

  /* ---------- start ---------- */
  function start() {
    document.body.appendChild(wrap);
    setFrame(1, 1);
    setTimeout(checkGreet, 1200);
    setInterval(checkGreet, 1500); // notices sign-in / sign-out, greets once per account
    document.addEventListener('visibilitychange', checkGreet);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
