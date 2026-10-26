/* Registers the service worker, shows an "Install app" banner, and an offline notice. */
(function () {
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var KEY = 'bt-install-dismissed', deferred = null;
  function dismissed() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function remember() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
  function bar(id, html) { var d = document.getElementById(id) || document.createElement('div'); d.id = id; d.innerHTML = html; if (!d.parentNode) document.body.appendChild(d); return d; }
  function hide(id) { var d = document.getElementById(id); if (d) d.remove(); }
  function showInstall(ios) {
    if (standalone || dismissed() || document.getElementById('pwa-install')) return;
    var b = bar('pwa-install', '<img src="icon-192.png" alt="" width="40" height="40"><span><b>Install IsaZen</b><small>' + (ios ? 'Tap Share, then “Add to Home Screen”.' : 'Add it to your home screen like an app.') + '</small></span>' + (ios ? '' : '<button type="button" class="primary" id="pwa-go">Install</button>') + '<button type="button" id="pwa-x" aria-label="Dismiss">✕</button>');
    b.querySelector('#pwa-x').onclick = function () { remember(); hide('pwa-install'); };
    var go = b.querySelector('#pwa-go'); if (go) go.onclick = function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { deferred = null; remember(); hide('pwa-install'); }); };
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; setTimeout(function () { showInstall(false); }, 4000); });
  window.addEventListener('appinstalled', function () { remember(); hide('pwa-install'); });
  var ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  if (ios && !standalone) setTimeout(function () { showInstall(true); }, 5000);
 
})();
