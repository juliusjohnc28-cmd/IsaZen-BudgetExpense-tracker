/* Light ("original") / dark theme toggle. Loaded in <head> so there is no flash on page load. */
(function () {
  var K = 'bt-theme';
  function get() { try { return localStorage.getItem(K) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } }
  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#0e1612' : '#f4f8f6';
  }
  window.themeLabel = function () { return get() === 'dark' ? '\u2600  Original mode' : '\u263E  Dark mode'; };
  apply(get());
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]'); if (!b) return;
    var t = get() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(K, t); } catch (x) {}
    apply(t);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (x) { x.textContent = themeLabel(); });
  });
})();
