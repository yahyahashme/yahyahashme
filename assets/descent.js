/* The descent: yahyahashme.com
   Scrolling down is descending from 5,000 m above the Himalaya to Dal Lake at 1,585 m.
   Phase 1: altitude model + instrument. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var MOTION = doc.classList.contains('motion');
  var TOP_ALT = 5000, LAKE_ALT = 1585;

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------------- Altitude model ----------------
     Piecewise-linear keyframes from scroll position to altitude, anchored to the real
     section positions so the readout reaches each zone's number as that zone arrives. */
  var sections = {
    peaks: $('top'), hero: $('hero'), about: $('about'), now: $('now'),
    work: $('work'), shore: $('offscreen'), lake: $('contact')
  };
  var keys = [];
  var Hs = window.innerHeight; // stable viewport height (small viewport on mobile)

  function docTop(el) { return el.getBoundingClientRect().top + (window.pageYOffset || doc.scrollTop); }

  function buildKeys() {
    var lockup = $('lockup');
    Hs = (lockup && lockup.offsetHeight) || window.innerHeight;
    var maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    var heroTop = docTop(sections.hero);
    keys = [
      [0, TOP_ALT],
      [heroTop - 0.6 * Hs, 4200],
      [heroTop, 3850],
      [docTop(sections.about) - 0.35 * Hs, 3150],
      [docTop(sections.now) - 0.35 * Hs, 2850],
      [docTop(sections.work), 1780],
      [docTop(sections.shore) - 0.5 * Hs, 1640],
      [docTop(sections.lake) - 0.5 * Hs, 1600],
      [maxScroll, LAKE_ALT]
    ];
    // keep strictly increasing scroll positions
    for (var i = 1; i < keys.length; i++) if (keys[i][0] <= keys[i - 1][0]) keys[i][0] = keys[i - 1][0] + 1;
  }

  function altitudeAt(y) {
    if (y <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (y <= keys[i][0]) {
        var t = (y - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
        return lerp(keys[i - 1][1], keys[i][1], t);
      }
    }
    return keys[keys.length - 1][1];
  }

  function zoneFor(alt) {
    return alt >= 4480 ? 'Peaks' : alt >= 3900 ? 'Cloud layer' : alt >= 3350 ? 'Alpine' : alt >= 2500 ? 'Tree line' : alt >= 1650 ? 'Valley floor' : 'Dal Lake';
  }

  /* ---------------- Instrument ---------------- */
  var rolls = Array.prototype.slice.call(document.querySelectorAll('#altDigits .alt-roll'));
  var ticks = $('altTicks'), zoneEl = $('altZone');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var lastZone = '', lastInk = '';

  var INKS = [[5000, [27, 38, 52]], [3400, [27, 38, 52]], [2900, [22, 37, 29]], [2100, [42, 36, 18]], [1650, [43, 29, 16]], [1585, [43, 29, 16]]];
  function inkFor(alt) {
    for (var i = 1; i < INKS.length; i++) {
      if (alt >= INKS[i][0]) {
        var t = (INKS[i - 1][0] - alt) / (INKS[i - 1][0] - INKS[i][0]);
        var a = INKS[i - 1][1], b = INKS[i][1];
        return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
      }
    }
    return 'rgb(43,29,16)';
  }

  function setInstrument(alt) {
    var v = clamp(alt, LAKE_ALT, TOP_ALT);
    // Odometer: each column shows its digit, rolling only while the lower digits wrap.
    for (var k = 0; k < 4; k++) {
      var p = Math.pow(10, k), pos;
      if (MOTION) {
        if (k === 0) pos = v % 10;
        else {
          var d = Math.floor(v / p) % 10, lower = v % p;
          pos = d + clamp(lower - (p - 1), 0, 1);
        }
      } else pos = Math.floor(v / p) % 10;
      rolls[3 - k].style.transform = 'translateY(' + (-pos).toFixed(3) + 'em)';
    }
    // Tape: 8 px per 50 m, bold tick every 250 m; higher altitudes sit above the needle.
    if (ticks) ticks.style.transform = 'translateY(' + (((v * 0.16) % 40) - 20).toFixed(2) + 'px)';
    var z = zoneFor(v);
    if (z !== lastZone) { lastZone = z; zoneEl.textContent = z; }
    var ink = inkFor(v);
    if (ink !== lastInk) { lastInk = ink; doc.style.setProperty('--ink-ui', ink); }
  }

  /* ---------------- Scroll plumbing ---------------- */
  var scrollY = 0, altitude = TOP_ALT, queued = false;
  function onScroll() {
    scrollY = window.pageYOffset || doc.scrollTop || 0;
    if (!queued) { queued = true; requestAnimationFrame(frame); }
  }
  function frame() {
    queued = false;
    altitude = altitudeAt(scrollY);
    setInstrument(altitude);
    if (themeMeta) themeMeta.setAttribute('content', skyFor(altitude));
  }
  var SKIES = [[5000, '#b9cadd'], [4350, '#e4eaf1'], [3900, '#cdd8e3'], [3300, '#aec6da'], [2600, '#bccbc9'], [1900, '#d8d4bd'], [1640, '#e6cf9f'], [1585, '#e8b86c']];
  function skyFor(alt) {
    for (var i = 1; i < SKIES.length; i++) if (alt >= SKIES[i][0]) return SKIES[i - 1][1];
    return SKIES[SKIES.length - 1][1];
  }

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { buildKeys(); onScroll(); }, 120);
  }

  buildKeys();
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', function () { buildKeys(); onScroll(); });

  window.__descent = { altitudeAt: altitudeAt, buildKeys: buildKeys, keys: function () { return keys; } };
})();
