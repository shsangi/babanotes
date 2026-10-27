(function () {
  var loader   = document.getElementById('loader');
  var frame    = document.getElementById('appFrame');
  var wrapper  = document.getElementById('wrapper');
  var loaderHidden = false;

  function hideLoader() {
    if (loaderHidden) return;
    loaderHidden = true;
    if (loader) loader.classList.add('hide');
  }

  /* ===== Animated pen logo (runs while the splash is visible) ===== */
  (function penLogo() {
    var svg = document.getElementById('splashLogo');
    if (!svg) return;

    var SPEED = 5, FLY = 12, SCALE = 0.55, WAIT = 5;

    var strokes = [].slice.call(svg.querySelectorAll('.ink'));
    var dot     = svg.querySelector('#dot');
    var pen     = svg.querySelector('#pen');
    var len     = strokes.map(function (p) { return p.getTotalLength(); });
    strokes.forEach(function (p, i) { p.style.strokeDasharray = len[i] + ' ' + len[i]; });

    function clamp(x) { return Math.min(1, Math.max(0, x)); }
    function sine(t)  { return -(Math.cos(Math.PI * t) - 1) / 2; }
    function outC(t)  { return 1 - Math.pow(1 - t, 3); }
    function inOut(t) { return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
    function back(t)  { var c = 1.70158, d = c + 1; return 1 + d*Math.pow(t-1, 3) + c*Math.pow(t-1, 2); }

    function start(i){ return strokes[i].getPointAtLength(0); }
    function end(i)  { return strokes[i].getPointAtLength(len[i]); }
    var CENTER = { x: 11, y: 11 };
    function dist(a,b){ return Math.hypot(b.x - a.x, b.y - a.y); }

    var segs = [], T = 0;
    function add(dur, fn){ segs.push({ s: T, e: T + dur, fn: fn }); T += dur; }

    function drawStroke(i){
      add(len[i] / SPEED, function (k, o) {
        var q = sine(k);
        var p = strokes[i].getPointAtLength(len[i] * q);
        o.drawn[i] = q; o.x = p.x; o.y = p.y; o.sc = SCALE; o.op = 1;
      });
    }
    function fly(A, B){
      add(Math.max(.5, dist(A, B) / FLY), function (k, o) {
        var e = inOut(k), lift = Math.sin(Math.PI * k);
        o.x = A.x + (B.x - A.x) * e;
        o.y = A.y + (B.y - A.y) * e - lift * 2.5;
        o.sc = SCALE + .15 * lift;
        o.op = 1;
      });
    }

    var A0 = start(0);
    add(.9, function (k, o) {
      var e = outC(k);
      o.x = A0.x + (1 - e) * 6; o.y = A0.y - (1 - e) * 8;
      o.sc = SCALE + .3 * (1 - e); o.op = clamp(k * 3);
    });
    drawStroke(0); fly(end(0), start(1));
    drawStroke(1); fly(end(1), start(2));
    drawStroke(2); fly(end(2), CENTER);
    add(1.0, function (k, o) {
      o.x = 11; o.y = 11; o.op = 1;
      o.sc = SCALE - .05 * Math.sin(Math.PI * k);
      o.dot = clamp((k - .2) / .8);
    });
    add(1.0, function (k, o) {
      var e = inOut(k);
      o.x = 11 + e * 3; o.y = 11 - e * 5;
      o.sc = SCALE + .25 * e; o.op = 1 - e * e; o.dot = 1;
    });

    function render(t){
      var o = { x: A0.x, y: A0.y, sc: SCALE, op: 0, dot: 0, drawn: [0, 0, 0] };
      for (var i = 0; i < segs.length; i++){
        var sg = segs[i];
        if (t < sg.s) break;
        sg.fn(clamp((t - sg.s) / (sg.e - sg.s)), o);
      }
      strokes.forEach(function (p, i) {
        p.style.strokeDashoffset = len[i] * (1 - o.drawn[i]);
        p.style.visibility = o.drawn[i] > 0 ? 'visible' : 'hidden';
      });
      dot.setAttribute('r', 2 * back(o.dot));
      pen.style.opacity = o.op;
      pen.setAttribute('transform', 'translate(' + o.x + ' ' + o.y + ') scale(' + o.sc + ') translate(-2 -2)');
    }

    var t0, raf, timer, running = true;
    function tick(now){
      var t = (now - t0) / 1000;
      render(Math.min(t, T));
      if (t < T) raf = requestAnimationFrame(tick);
      else timer = setTimeout(play, WAIT * 1000);
    }
    function play(){
      if (!running) return;
      cancelAnimationFrame(raf); clearTimeout(timer);
      render(0); t0 = performance.now(); raf = requestAnimationFrame(tick);
    }
    svg.addEventListener('click', play);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { running = true; play(); }
        else { running = false; cancelAnimationFrame(raf); clearTimeout(timer); }
      });
    });
    io.observe(svg);

    play();
  })();

  /* ===== Loader / iframe control ===== */
  if (frame) {
    frame.addEventListener('load', hideLoader);
    frame.addEventListener('error', function () {
      console.warn('Iframe failed to load');
      hideLoader();
    });
  }
  setTimeout(hideLoader, 5000);

  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });

  /* ===== Service Worker ===== */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js')
        .then(function (reg) { console.log('SW registered:', reg.scope); })
        .catch(function (err) { console.warn('SW registration failed:', err); });
    });
  }

  /* ===== Install Banner ===== */
  var installBanner = document.getElementById('installBanner');
  var installBtn    = document.getElementById('installBtn');
  var closeBannerBtn = document.getElementById('closeBannerBtn');
  var deferredPrompt = null;

  function isAppInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (document.referrer.includes('android-app://')) return true;
    return false;
  }

  function showBanner() {
    if (!installBanner || !wrapper) return;
    installBanner.classList.add('show');
    wrapper.classList.add('banner-visible');
  }
  function hideBanner() {
    if (!installBanner || !wrapper) return;
    installBanner.classList.remove('show');
    wrapper.classList.remove('banner-visible');
  }
  function maybeShowBanner() {
    if (isAppInstalled()) return;
    if (sessionStorage.getItem('installBannerDismissed') === 'true') return;
    setTimeout(showBanner, 1500);
  }

  if (closeBannerBtn) {
    closeBannerBtn.addEventListener('click', function () {
      hideBanner();
      sessionStorage.setItem('installBannerDismissed', 'true');
    });
  }

  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (r) {
          if (r.outcome === 'accepted') hideBanner();
          deferredPrompt = null;
        });
      } else {
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
          alert('To install:\n\n1. Tap the Share button\n2. Scroll and tap "Add to Home Screen"\n3. Tap "Add"');
        } else {
          alert('To install:\n\nOpen your browser menu (⋮) and select "Install app" or "Add to Home Screen".');
        }
      }
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    maybeShowBanner();
  });

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (!deferredPrompt) maybeShowBanner();
    }, 2500);
  });

  window.addEventListener('appinstalled', function () { hideBanner(); });

  var mqStandalone = window.matchMedia('(display-mode: standalone)');
  if (mqStandalone.addEventListener) {
    mqStandalone.addEventListener('change', function (e) {
      if (e.matches) hideBanner();
    });
  }
})();
