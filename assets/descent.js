/* The descent: yahyahashme.com
   Scrolling down is descending from 5,000 m above the Himalaya to Dal Lake at 1,585 m.
   One fixed canvas draws the world as a function of scroll; the DOM holds every word. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var MOTION = doc.classList.contains('motion');
  var TOP_ALT = 5000, LAKE_ALT = 1585;

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var hex = function (h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  var mixc = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  var css = function (c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')'; };
  var idle = window.requestIdleCallback ? function (fn) { requestIdleCallback(fn, { timeout: 400 }); } : function (fn) { setTimeout(fn, 24); };

  /* ---------------- Deterministic randomness ---------------- */
  function rng(seed) {
    var a = seed | 0;
    return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function noise1d(seed) {
    var r = rng(seed), tab = new Float32Array(512);
    for (var i = 0; i < 512; i++) tab[i] = r();
    return function (x) {
      var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
      return lerp(tab[i & 511], tab[(i + 1) & 511], u);
    };
  }
  function fbm(n, x, oct, gain) {
    var s = 0, a = 1, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) { s += a * n(x * f); norm += a; a *= gain; f *= 2.03; }
    return s / norm;
  }

  /* ---------------- Altitude palette ----------------
     alt, skyTop, skyBottom, haze, sun, glow, sunY, sunR, hazeDensity, softness, waterNear, waterDeep */
  var STOPS = [
    [5000, '#a7bcd6', '#eef2f7', '#dfe7f0', '#ffffff', '#ffffff', .10, .024, .05, .05, '#e8b86c', '#8b5a26'],
    [4600, '#b9cadd', '#f0f3f7', '#e6ecf2', '#ffffff', '#ffffff', .12, .026, .10, .08, '#e8b86c', '#8b5a26'],
    [4200, '#e3e9ef', '#f6f8fa', '#f2f5f8', '#ffffff', '#ffffff', .14, .028, .25, .12, '#e8b86c', '#8b5a26'],
    [3850, '#c6d2dd', '#e6ebef', '#dde4ea', '#fff7e8', '#fff3dc', .16, .030, .18, .15, '#e8b86c', '#8b5a26'],
    [3200, '#a6c0d8', '#dfe7e6', '#d6e0e2', '#fff3dc', '#ffe9c2', .20, .034, .22, .22, '#e8b86c', '#8b5a26'],
    [2600, '#b2c6d4', '#e2e5d8', '#d9ded2', '#fff0d2', '#ffe3b4', .24, .038, .28, .30, '#e8b86c', '#8b5a26'],
    [2000, '#c6cdc6', '#ebe3c6', '#e4dcc1', '#ffeec8', '#f9d79a', .27, .045, .36, .40, '#e8b86c', '#8b5a26'],
    [1700, '#d6caa6', '#f3e4bd', '#ecdcb0', '#ffe2a0', '#f6c87a', .24, .055, .42, .50, '#e6b465', '#8b5a26'],
    [1585, '#e0a85a', '#f8e0ad', '#f1d49a', '#ffd889', '#f3b55c', .21, .070, .50, .60, '#e3ad5c', '#7f4e1e']
  ].map(function (s) { return { alt: s[0], top: hex(s[1]), bot: hex(s[2]), haze: hex(s[3]), sun: hex(s[4]), glow: hex(s[5]), sunY: s[6], sunR: s[7], hazeD: s[8], soft: s[9], w1: hex(s[10]), w2: hex(s[11]) }; });

  function palette(alt) {
    alt = clamp(alt, LAKE_ALT, TOP_ALT);
    var i = 1; while (i < STOPS.length - 1 && alt < STOPS[i].alt) i++;
    var a = STOPS[i - 1], b = STOPS[i], t = clamp((a.alt - alt) / (a.alt - b.alt), 0, 1);
    return {
      top: mixc(a.top, b.top, t), bot: mixc(a.bot, b.bot, t), haze: mixc(a.haze, b.haze, t),
      sun: mixc(a.sun, b.sun, t), glow: mixc(a.glow, b.glow, t), w1: mixc(a.w1, b.w1, t), w2: mixc(a.w2, b.w2, t),
      sunY: lerp(a.sunY, b.sunY, t), sunR: lerp(a.sunR, b.sunR, t), hazeD: lerp(a.hazeD, b.hazeD, t), soft: lerp(a.soft, b.soft, t)
    };
  }

  /* ---------------- Altitude model ----------------
     Piecewise-linear keyframes from scroll position to altitude, anchored to the real
     section positions so the readout reaches each zone's number as that zone arrives. */
  var S = {
    peaks: $('top'), hero: $('hero'), about: $('about'), now: $('now'),
    work: $('work'), shore: $('offscreen'), lake: $('contact')
  };
  var keys = [];
  var Hs = window.innerHeight;        // stable (small) viewport height, used for all placement
  var pin = { start: 0, end: 0 };      // the Work pin, set by the choreography once ScrollTrigger exists
  var tops = {};                       // document tops of sections

  function docTop(el) { return el.getBoundingClientRect().top + (window.pageYOffset || doc.scrollTop); }

  function measure() {
    var lockup = $('lockup');
    Hs = (lockup && lockup.offsetHeight) || window.innerHeight;
    for (var k in S) tops[k] = docTop(S[k]);
    if (pin.end > pin.start) tops.work = pin.start; // while pinned the section is fixed; its place is the pin start
    var maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    keys = [
      [0, TOP_ALT],
      [tops.hero - 0.95 * Hs, 4200],
      [tops.hero, 3850],
      [tops.about - 0.35 * Hs, 3150],
      [tops.now - 0.35 * Hs, 2850],
      [tops.work, 1780],
      [tops.shore - 0.5 * Hs, 1640],
      [tops.lake - 0.5 * Hs, 1600],
      [maxScroll, LAKE_ALT]
    ];
    for (var i = 1; i < keys.length; i++) if (keys[i][0] <= keys[i - 1][0]) keys[i][0] = keys[i - 1][0] + 1;
  }

  function altitudeAt(y) {
    if (y <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (y <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], (y - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
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
  var lastZone = '', lastInk = '', lastTheme = '';
  var INKS = [[5000, [27, 38, 52]], [3400, [27, 38, 52]], [2900, [22, 37, 29]], [2100, [42, 36, 18]], [1650, [43, 29, 16]], [1585, [43, 29, 16]]];
  function inkFor(alt) {
    for (var i = 1; i < INKS.length; i++) {
      if (alt >= INKS[i][0]) return css(mixc(INKS[i - 1][1], INKS[i][1], (INKS[i - 1][0] - alt) / (INKS[i - 1][0] - INKS[i][0])));
    }
    return 'rgb(43,29,16)';
  }
  function setInstrument(alt) {
    var v = clamp(alt, LAKE_ALT, TOP_ALT);
    for (var k = 0; k < 4; k++) {
      var p = Math.pow(10, k), pos;
      if (MOTION) {
        if (k === 0) pos = v % 10;
        else { var d = Math.floor(v / p) % 10, lower = v % p; pos = d + clamp(lower - (p - 1), 0, 1); }
      } else pos = Math.floor(v / p) % 10;
      rolls[3 - k].style.transform = 'translateY(' + (-pos).toFixed(3) + 'em)';
    }
    if (ticks) ticks.style.transform = 'translateY(' + (((v * 0.16) % 40) - 20).toFixed(2) + 'px)';
    var z = zoneFor(v);
    if (z !== lastZone) { lastZone = z; zoneEl.textContent = z; }
    var ink = inkFor(v);
    if (ink !== lastInk) { lastInk = ink; doc.style.setProperty('--ink-ui', ink); }
    if (themeMeta) {
      var th = css(palette(v).top);
      if (th !== lastTheme) { lastTheme = th; themeMeta.setAttribute('content', th); }
    }
  }

  /* ================= THE WORLD ================= */
  var W = 0, H = 0, dpr = 1;
  var layers = [], clouds = null, shikara = null, glitter = null, pads = null, waterBuf = null, wctx = null;
  var built = { w: 0, hs: 0 };

  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  // crest profile: array of y offsets (px, downward from the band top) across the image width
  function profile(w, o) {
    var n = noise1d(o.seed), n2 = noise1d(o.seed * 7 + 3), step = o.step || 3, count = Math.ceil(w / step) + 2, ys = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      var x = i * step, u = x / w * o.freq + o.phase;
      var smoothV = fbm(n, u, 4, .5);
      var ridged = 1 - Math.abs(2 * fbm(n2, u * 1.1, 3, .55) - 1);
      var v = lerp(smoothV, Math.pow(ridged, 1.35), o.ridged);
      v += (fbm(n2, u * 9, 2, .5) - .5) * o.jag;
      ys[i] = o.top + (1 - v) * o.amp;
    }
    return { ys: ys, step: step, n: n };
  }
  function tracePath(ctx, p, w, h) {
    ctx.beginPath(); ctx.moveTo(0, h);
    for (var i = 0; i < p.ys.length; i++) ctx.lineTo(i * p.step, p.ys[i]);
    ctx.lineTo(w, h); ctx.closePath();
  }
  function shade(ctx, p, w, h, dx, dy, color) {
    ctx.save(); tracePath(ctx, p, w, h); ctx.clip();
    ctx.translate(dx, dy); tracePath(ctx, p, w + dx, h + dy); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }

  function renderRidge(L, ctx, w, h) {
    var p = profile(w, { seed: L.seed, freq: L.freq, phase: L.seed % 7, amp: h * L.amp, top: h * .04, ridged: L.ridged, jag: L.jag });
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(L.light)); g.addColorStop(.5, css(L.base)); g.addColorStop(1, css(L.base));
    tracePath(ctx, p, w, h); ctx.fillStyle = g; ctx.fill();
    shade(ctx, p, w, h, 6, 9, css(L.shade, .38));
    if (L.snow > 0) {
      // snow sits above a wavy snowline and clings to the crests
      var sn = noise1d(L.seed + 11), lineY = h * (.04 + L.snow * L.amp * .95);
      ctx.beginPath();
      for (var i = 0; i < p.ys.length; i++) ctx.lineTo(i * p.step, p.ys[i]);
      for (var j = p.ys.length - 1; j >= 0; j--) {
        var x = j * p.step, line = lineY + (fbm(sn, x / w * 12, 3, .5) - .5) * h * .2;
        var thick = h * (.05 + .12 * fbm(sn, x / w * 7 + 40, 2, .5)) * (.5 + L.snow);
        ctx.lineTo(x, Math.max(p.ys[j], Math.min(line, p.ys[j] + thick)));
      }
      ctx.closePath();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#f7fafd'; ctx.fillRect(0, 0, w, h);
      ctx.translate(6, 9); tracePath(ctx, p, w + 6, h + 9); ctx.fillStyle = 'rgba(176,196,218,.55)'; ctx.fill();
      ctx.restore();
    }
    L.crest = p;
  }

  function conifer(ctx, x, y, s, lean) {
    // three tiers of a spruce, base at (x, y), height s
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * .02, y - s * .18);
    var tiers = 3;
    for (var k = tiers - 1; k >= 0; k--) {
      var top = y - s * (1 - k * .27), hw = s * (.12 + k * .09), bot = top + s * .36;
      ctx.lineTo(x + hw + lean * k, bot); ctx.lineTo(x + hw * .35 + lean * k, bot - s * .03); ctx.lineTo(x + lean * k, top);
      ctx.lineTo(x - hw * .35 + lean * k, bot - s * .03); ctx.lineTo(x - hw + lean * k, bot);
    }
    ctx.lineTo(x - s * .02, y - s * .18); ctx.closePath();
  }

  function renderHills(L, ctx, w, h) {
    var p = profile(w, { seed: L.seed, freq: L.freq, phase: 1.3, amp: h * L.amp, top: h * .22, ridged: .1, jag: .02, step: 4 });
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(L.light)); g.addColorStop(.6, css(L.base)); g.addColorStop(1, css(L.base));
    tracePath(ctx, p, w, h); ctx.fillStyle = g; ctx.fill();
    shade(ctx, p, w, h, 5, 8, css(L.shade, .3));
    var r = rng(L.seed * 3 + 1), x = -L.tree, rows = [[0, 1, L.treeColor], [L.tree * .55, .82, L.treeDeep]];
    function yAt(xx) { var i = clamp(xx / p.step, 0, p.ys.length - 2), i0 = Math.floor(i); return lerp(p.ys[i0], p.ys[i0 + 1], i - i0); }
    for (var ri = 0; ri < rows.length; ri++) {
      var off = rows[ri][0], scale = rows[ri][1];
      ctx.fillStyle = css(rows[ri][2]); ctx.beginPath();
      x = -L.tree + r() * L.tree;
      while (x < w + L.tree) {
        var gap = L.tree * (L.gap + r() * L.gap), s = L.tree * (.65 + r() * .7) * scale;
        if (r() < L.density) conifer(ctx, x, yAt(x) + off + s * .08, s, (r() - .5) * s * .05);
        x += gap;
      }
      ctx.fill();
    }
    if (L.tree >= 22) { // lit left sides for the near trees
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      var lg = ctx.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, css(L.light, .18)); lg.addColorStop(1, css(L.light, 0));
      ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h); ctx.restore();
    }
    L.crest = p;
  }

  function renderTerrace(L, ctx, w, h) {
    var r = rng(L.seed), n = noise1d(L.seed + 5), bands = L.bands, y0 = h * .18;
    var cols = [hex('#c9b955'), hex('#9fb262'), hex('#d8b24e'), hex('#b6b865'), hex('#8ea85a'), hex('#e0bf63')];
    // sky-facing top slope of the strip
    var top = profile(w, { seed: L.seed + 2, freq: L.freq, phase: .4, amp: h * .12, top: h * .02, ridged: 0, jag: .01, step: 4 });
    tracePath(ctx, top, w, h); ctx.fillStyle = css(L.base); ctx.fill();
    L.crest = top;
    var step = 4, count = Math.ceil(w / step) + 2;
    var prev = new Float32Array(count);
    for (var i = 0; i < count; i++) prev[i] = top.ys[Math.min(i, top.ys.length - 1)] + h * .06;
    for (var b = 0; b < bands; b++) {
      var t = b / (bands - 1), bh = h * (.07 + t * .14), cur = new Float32Array(count), c = cols[(b + L.seed) % cols.length];
      for (i = 0; i < count; i++) {
        var x = i * step;
        cur[i] = Math.min(h, prev[i] + bh * (.75 + .5 * fbm(n, x / w * 3 + b * 1.7, 2, .5)) + Math.sin(x / w * 6.28 * (1 + b % 2) + b) * h * .01);
      }
      ctx.beginPath(); ctx.moveTo(0, prev[0]);
      for (i = 0; i < count; i++) ctx.lineTo(i * step, prev[i]);
      for (i = count - 1; i >= 0; i--) ctx.lineTo(i * step, cur[i]);
      ctx.closePath();
      var g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, css(mixc(c, hex('#ffffff'), .08))); g.addColorStop(1, css(mixc(c, hex('#6a5a2a'), .1)));
      ctx.fillStyle = g; ctx.fill();
      // the terrace wall: a dark riser under each top edge and a light lip above it
      ctx.beginPath(); for (i = 0; i < count; i++) ctx.lineTo(i * step, prev[i] + 1.5);
      ctx.strokeStyle = 'rgba(90,70,30,.35)'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.beginPath(); for (i = 0; i < count; i++) ctx.lineTo(i * step, prev[i] - .6);
      ctx.strokeStyle = 'rgba(255,250,225,.5)'; ctx.lineWidth = 1; ctx.stroke();
      // furrows across some fields, orchards across others
      if (b % 3 === 1) {
        ctx.strokeStyle = 'rgba(80,60,20,.12)'; ctx.lineWidth = 1; ctx.beginPath();
        for (var k = 1; k < 4; k++) { var f = k / 4; for (i = 0; i < count; i += 2) { var yy = lerp(prev[i], cur[i], f); if (i === 0) ctx.moveTo(0, yy); else ctx.lineTo(i * step, yy); } }
        ctx.stroke();
      } else if (b % 3 === 2 || (b === 0 && L.orchard)) {
        var crown = Math.max(2.5, bh * .17), sp = crown * 2.8, ox = r() * sp;
        for (var xx = ox; xx < w; xx += sp * (.9 + r() * .3)) {
          var ii = clamp(Math.round(xx / step), 0, count - 1), cy = lerp(prev[ii], cur[ii], .55 + r() * .25), cr = crown * (.8 + r() * .5);
          ctx.fillStyle = 'rgba(60,45,15,.45)'; ctx.fillRect(xx - .6, cy, 1.2, cr * .9);
          ctx.fillStyle = css(L.treeDeep); ctx.beginPath(); ctx.arc(xx, cy, cr, 0, 6.2832); ctx.fill();
          ctx.fillStyle = css(L.treeColor); ctx.beginPath(); ctx.arc(xx - cr * .25, cy - cr * .25, cr * .62, 0, 6.2832); ctx.fill();
        }
      }
      prev = cur;
    }
    ctx.fillStyle = css(L.base, .9); ctx.fillRect(0, h - 2, w, 2);
  }

  function renderShore(L, ctx, w, h) {
    // a far shore of poplars, chinars and houseboats; the water starts at the image's bottom edge
    var r = rng(L.seed), dark = hex('#3a2b1e'), rim = hex('#d89a4a');
    var landTop = h * .72, n = noise1d(L.seed + 9);
    ctx.beginPath(); ctx.moveTo(0, h);
    for (var x = 0; x <= w; x += 6) ctx.lineTo(x, landTop + (fbm(n, x / w * 5, 2, .5) - .5) * h * .08);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = css(dark); ctx.fill();
    ctx.fillStyle = css(dark);
    for (x = r() * 30; x < w; x += 14 + r() * 40) {
      var kind = r(), base = landTop + 2 + (fbm(n, x / w * 5, 2, .5) - .5) * h * .08;
      if (kind < .5) {           // poplar
        var th = h * (.35 + r() * .5), tw = th * .11;
        ctx.beginPath(); ctx.moveTo(x, base - th); ctx.quadraticCurveTo(x + tw, base - th * .6, x + tw * .7, base); ctx.lineTo(x - tw * .7, base); ctx.quadraticCurveTo(x - tw, base - th * .6, x, base - th); ctx.fill();
      } else if (kind < .8) {    // chinar
        var ch = h * (.22 + r() * .2);
        ctx.fillRect(x - 1, base - ch * .5, 2, ch * .5);
        ctx.beginPath(); ctx.arc(x, base - ch * .62, ch * .42, 0, 6.2832); ctx.arc(x - ch * .3, base - ch * .45, ch * .3, 0, 6.2832); ctx.arc(x + ch * .32, base - ch * .48, ch * .32, 0, 6.2832); ctx.fill();
      } else if (kind < .9) {    // houseboat
        var bw = h * (.5 + r() * .3), bh = h * .13;
        ctx.beginPath(); ctx.moveTo(x - bw / 2, base); ctx.lineTo(x - bw / 2 + bh * .4, base - bh); ctx.lineTo(x + bw / 2 - bh * .4, base - bh); ctx.lineTo(x + bw / 2, base); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - bw * .42, base - bh); ctx.lineTo(x - bw * .3, base - bh * 1.7); ctx.lineTo(x + bw * .3, base - bh * 1.7); ctx.lineTo(x + bw * .42, base - bh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = css(rim, .9); for (var wi = -1; wi <= 1; wi++) ctx.fillRect(x + wi * bw * .22 - 1.5, base - bh * 1.45, 3, 2.4);
        ctx.fillStyle = css(dark);
        x += bw * .6;
      }
    }
    // a rim of late light along the shoreline
    var g = ctx.createLinearGradient(0, h - 6, 0, h); g.addColorStop(0, css(rim, 0)); g.addColorStop(1, css(rim, .55));
    ctx.fillStyle = g; ctx.fillRect(0, h - 6, w, 6);
  }

  function makeClouds() {
    var r = rng(77), sprites = [], i, j;
    for (i = 0; i < 6; i++) {
      var sw = 256, sh = 128, c = makeCanvas(sw, sh), g = c.getContext('2d');
      var puffs = 8 + Math.floor(r() * 5);
      for (j = 0; j < puffs; j++) {
        var cx = sw * (.12 + .76 * r()), cy = sh * (.42 + .3 * r()), rad = sh * (.14 + .22 * r());
        var rg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
        rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(.55, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
      g.globalCompositeOperation = 'source-atop';
      var lg = g.createLinearGradient(0, sh * .3, 0, sh); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(176,194,214,.45)');
      g.fillStyle = lg; g.fillRect(0, 0, sw, sh);
      g.globalCompositeOperation = 'destination-out';
      var fg = g.createLinearGradient(0, sh * .7, 0, sh * .96); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = fg; g.fillRect(0, sh * .7, sw, sh * .3);
      sprites.push(c);
    }
    var items = [];
    for (i = 0; i < 42; i++) {
      var u = -0.15 + 2.15 * r();
      items.push({ s: sprites[i % 6], x: -0.25 + 1.5 * r(), u: u, sc: .8 + 1.5 * r(), a: .5 + .5 * r(), v: 3 + 6 * r() });
    }
    return items;
  }

  function makeShikara(s) {
    var h = s * .5, c = makeCanvas(s * dpr, h * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr); g.fillStyle = '#2a211b'; g.strokeStyle = '#2a211b';
    g.beginPath(); g.moveTo(0, h * .48); g.lineTo(s * .09, h * .6); g.lineTo(s * .91, h * .6); g.lineTo(s, h * .44);
    g.quadraticCurveTo(s * .5, h * 1.02, 0, h * .48); g.closePath(); g.fill();
    g.lineWidth = Math.max(1, s * .012);
    g.beginPath(); g.moveTo(s * .3, h * .6); g.lineTo(s * .3, h * .3); g.moveTo(s * .7, h * .6); g.lineTo(s * .7, h * .3); g.stroke();
    g.beginPath(); g.moveTo(s * .22, h * .3); g.quadraticCurveTo(s * .5, h * .14, s * .78, h * .3); g.lineTo(s * .78, h * .36); g.quadraticCurveTo(s * .5, h * .22, s * .22, h * .36); g.closePath(); g.fill();
    g.fillStyle = 'rgba(42,33,27,.6)'; g.fillRect(s * .3, h * .36, s * .4, h * .05);
    g.fillStyle = '#2a211b';
    g.beginPath(); g.arc(s * .86, h * .4, s * .035, 0, 6.2832); g.fill();
    g.beginPath(); g.moveTo(s * .8, h * .6); g.lineTo(s * .83, h * .46); g.lineTo(s * .9, h * .46); g.lineTo(s * .92, h * .6); g.closePath(); g.fill();
    g.lineWidth = Math.max(1, s * .01); g.beginPath(); g.moveTo(s * .84, h * .5); g.lineTo(s * .98, h * .82); g.stroke();
    g.beginPath(); g.ellipse(s * .985, h * .86, s * .03, s * .045, -.5, 0, 6.2832); g.fill();
    return { c: c, w: s, h: h };
  }

  var pinDx = 0;
  function buildLayers() {
    var Wl = W, h = Hs, track = $('track');
    pinDx = (MOTION && track) ? Math.max(0, track.scrollWidth - Wl) : 0;
    layers = [];
    function add(L) { L.imgW = L.imgW || Math.ceil(Wl + (L.hx || 0) * pinDx) + 2; layers.push(L); return L; }
    var rock = [['#aebdd0', '#d9e2ec', '#8396ad'], ['#93a6bd', '#c6d3e1', '#6c819a'], ['#74879f', '#aab9cb', '#4f6179'], ['#56687f', '#8c9cb1', '#394a60'], ['#3c4b60', '#6e7f95', '#232e40']];
    var pk = [[.12, .50, .10, .78, 3.0, .50], [.20, .56, .22, .62, 2.7, .55], [.33, .64, .40, .45, 2.3, .60], [.50, .74, .58, .30, 1.9, .66], [.80, .88, .82, .16, 1.5, .72]];
    for (var i = 0; i < 5; i++) {
      add({ kind: 'ridge', anchor: 'peaks', f: pk[i][0], at: pk[i][1], depth: pk[i][2], band: i < 2 ? 0 : i < 4 ? 1 : 2, imgH: h * .42, bodyH: h * (i < 2 ? .35 : .9), horizon: i < 2,
        seed: 101 + i * 17, freq: pk[i][4], amp: pk[i][5], ridged: .85, jag: .055 - i * .008, snow: pk[i][3],
        base: hex(rock[i][0]), light: hex(rock[i][1]), shade: hex(rock[i][2]) });
    }
    // the far range across the valley: emerges under the cloud deck and becomes the lake's horizon
    add({ kind: 'ridge', anchor: 'hero', f: .10, at: .78, depth: .26, band: 0, imgH: h * .3, bodyH: h * .35, seed: 404, freq: 2.2, amp: .5, ridged: .5, jag: .03, snow: .3, horizon: true,
      base: hex('#8e8394'), light: hex('#c4bccb'), shade: hex('#6a6075') });
    var hills = [[.30, .72, .30, 0, 11, '#6f8c7a', '#9fb5a6', '#56705f', '#4f6f5c', '#3f5c4b'], [.70, .84, .52, 1, 20, '#4b6b58', '#7f9c8a', '#375143', '#2f4a3b', '#263d31'], [.95, 1.0, .82, 2, 40, '#2f4a3c', '#5b7a68', '#203428', '#1d3126', '#152419']];
    for (i = 0; i < 3; i++) {
      var hl = hills[i];
      add({ kind: 'hills', anchor: 'about', f: hl[0], at: hl[1], depth: hl[2], band: hl[3], imgH: h * .4, bodyH: h * (i === 0 ? .35 : .5), horizon: i === 0, seed: 207 + i * 31, freq: 1.6 + i * .4, amp: .35 + i * .05,
        tree: hl[4] * Math.max(.7, Math.min(1, Wl / 1200)), gap: .22 + i * .04, density: .9, base: hex(hl[5]), light: hex(hl[6]), shade: hex(hl[7]), treeColor: hex(hl[8]), treeDeep: hex(hl[9]) });
    }
    var terr = [[1.0, .60, .35, 0, .12, 4, '#b7b071', '#8aa553', '#6b8a3d'], [1.15, .70, .55, 1, .35, 5, '#b0aa64', '#7f9a4a', '#5f7d37'], [1.35, .80, .85, 2, .70, 6, '#a8a45c', '#6f8f3f', '#4e6e2c']];
    for (i = 0; i < 3; i++) {
      var tr = terr[i];
      add({ kind: 'terrace', anchor: 'work', f: tr[0], at: tr[1], depth: tr[2], band: tr[3], hx: tr[4], imgH: h * .5, bodyH: h * .7, seed: 311 + i * 13, freq: 1.2 + i * .3, bands: tr[5], orchard: i > 0,
        base: hex(tr[6]), treeColor: hex(tr[7]), treeDeep: hex(tr[8]) });
    }
    add({ kind: 'shore', anchor: 'lake', f: 1, at: .28, depth: .9, band: 2, imgH: h * .12, bodyH: 0, seed: 505, base: hex('#3a2b1e'), shoreline: true });
    clouds = null;
    layers.push({ kind: 'clouds', anchor: 'hero', f: 1.3, at: -2.0, depth: .6, band: 1, imgH: 3.2 * h, bodyH: 0, imgW: Wl, virtual: true });
    var r = rng(9);
    glitter = []; for (i = 0; i < 70; i++) glitter.push({ gx: (r() + r() + r() - 1.5) / 1.5, d: r(), len: 3 + r() * 11, a: .15 + r() * .4, ph: r() * 6.28, sp: 1.5 + r() * 3 });
    pads = []; for (i = 0; i < 7; i++) pads.push({ x: .03 + r() * .24, y: 1 - r() * .22, rx: 14 + r() * 22, rot: r() * 6.28, ph: r() * 6.28 });
    shikara = makeShikara(clamp(Wl * .09, 70, 130));
    layers.sort(function (a, b) { return a.band - b.band || a.depth - b.depth; });
    built = { w: Wl, hs: Hs };
  }

  function renderLayer(L) {
    if (L.kind === 'clouds') { clouds = makeClouds(); L.img = true; return; }
    var area = L.imgW * L.imgH, ld = Math.min(dpr, Math.sqrt(2.2e6 / area), L.depth < .35 ? 1 : L.depth < .7 ? 1.5 : 2);
    var c = makeCanvas(L.imgW * ld, L.imgH * ld), ctx = c.getContext('2d');
    ctx.scale(ld, ld);
    if (L.kind === 'ridge') renderRidge(L, ctx, L.imgW, L.imgH);
    else if (L.kind === 'hills') renderHills(L, ctx, L.imgW, L.imgH);
    else if (L.kind === 'terrace') renderTerrace(L, ctx, L.imgW, L.imgH);
    else if (L.kind === 'shore') renderShore(L, ctx, L.imgW, L.imgH);
    L.img = c;
    L.bodyColor = L.kind === 'ridge' ? mixc(L.base, L.shade, .38) : L.kind === 'hills' ? mixc(L.base, L.shade, .3) : L.base;
    L.bodyStops = L.horizon ? [.08, .24] : L.kind === 'hills' ? [.12, .32] : L.kind === 'terrace' ? [.25, .55] : [.2, .5];
    if (L.depth < .7) { // a soft copy for depth of field
      var s = makeCanvas(Math.max(8, L.imgW * .25), Math.max(8, L.imgH * .25)), sctx = s.getContext('2d');
      sctx.drawImage(c, 0, 0, s.width, s.height); L.soft = s;
    }
  }

  var renderQueue = [];
  function ensureLayers(force) {
    if (!layers.length || force || built.w !== W || built.hs !== Hs) buildLayers();
    renderQueue = layers.filter(function (L) { return !L.img; });
    pumpQueue(true);
  }
  function onScreenNow(L, vs) { var y = layerY(L, vs); return y < H && y + L.imgH + L.bodyH > 0; }
  function pendingOnScreen() {
    var vs = vScrollOf(currentScroll());
    for (var i = 0; i < renderQueue.length; i++) if (onScreenNow(renderQueue[i], vs)) return true;
    return false;
  }
  var pumpScheduled = false;
  function pumpQueue(sync) {
    pumpScheduled = false;
    if (!renderQueue.length) return;
    var vs = vScrollOf(currentScroll()), start = performance.now();
    renderQueue.sort(function (a, b) { return onScreenNow(b, vs) - onScreenNow(a, vs) || layerY(a, vs) - layerY(b, vs); });
    // on-screen layers render a couple per frame; the rest trickle in during idle time
    var budget = sync ? 10 : 6;
    do {
      renderLayer(renderQueue[0]); renderQueue.shift(); dirty = true;
    } while (renderQueue.length && onScreenNow(renderQueue[0], vs) && performance.now() - start < budget);
    if (renderQueue.length && !pumpScheduled) {
      pumpScheduled = true;
      if (pendingOnScreen()) requestAnimationFrame(function () { pumpQueue(true); });
      else idle(function () { pumpQueue(false); });
    }
    if (MOTION && !doc.classList.contains('world-ready')) tick();
  }

  /* ---- placement ---- */
  function currentScroll() { return window.pageYOffset || doc.scrollTop || 0; }
  function pinDist() { return Math.max(0, pin.end - pin.start); }
  function vScrollOf(sy) {
    // the world holds still vertically while the Work section is pinned
    if (!pinDist()) return sy;
    return sy <= pin.start ? sy : sy >= pin.end ? sy - pinDist() : pin.start;
  }
  function pinProgress(sy) { var d = pinDist(); return d ? clamp((sy - pin.start) / d, 0, 1) : 0; }
  function anchorTop(name) { var t = tops[name] || 0; return (pinDist() && t > pin.start) ? t - pinDist() : t; }
  function layerY(L, vs) {
    if (!MOTION) return L.at * Hs + (anchorTop(L.anchor) - vs);
    var y = L.at * Hs + (anchorTop(L.anchor) - vs) * L.f;
    if (L.horizon) { // distant terrain settles onto the horizon rather than scrolling away
      var hz = .30 * Hs, k = .12 * Hs;
      if (y < hz) y = hz - k * (1 - Math.exp((y - hz) / k));
    }
    return y;
  }

  /* ---- drawing ---- */
  function drawSky(ctx, pal, w, h, skyAt) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    if (skyAt) { for (var i = 0; i <= 6; i++) { var p = palette(skyAt(i / 6)); g.addColorStop(i / 6, css(mixc(p.top, p.bot, .5))); } }
    else { g.addColorStop(0, css(pal.top)); g.addColorStop(.6, css(mixc(pal.top, pal.bot, .7))); g.addColorStop(1, css(pal.bot)); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function drawSun(ctx, pal, w, sunX, sunY) {
    var R = pal.sunR * Math.min(w, Hs), glowR = Math.max(w, Hs) * .5;
    var g = ctx.createRadialGradient(sunX, sunY, R * .5, sunX, sunY, glowR);
    g.addColorStop(0, css(pal.glow, .55)); g.addColorStop(.25, css(pal.glow, .22)); g.addColorStop(1, css(pal.glow, 0));
    ctx.fillStyle = g; ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
    var d = ctx.createRadialGradient(sunX, sunY, R * .7, sunX, sunY, R * 1.15);
    d.addColorStop(0, css(pal.sun, 1)); d.addColorStop(1, css(pal.sun, 0));
    ctx.fillStyle = d; ctx.beginPath(); ctx.arc(sunX, sunY, R * 1.15, 0, 6.2832); ctx.fill();
  }
  function drawLayer(ctx, L, x, y, pal, w) {
    var iw = L.imgW, ih = L.imgH;
    ctx.drawImage(L.img, x, y, iw, ih);
    if (L.soft) {
      var a = pal.soft * (1 - L.depth) * 1.2;
      if (a > .02) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(L.soft, x, y, iw, ih); ctx.globalAlpha = 1; }
    }
    if (L.bodyH > 0) {
      var by = y + ih - 1, g = ctx.createLinearGradient(0, by, 0, by + L.bodyH), bc = L.bodyColor || L.base, st = L.bodyStops;
      g.addColorStop(0, css(bc)); g.addColorStop(st[0], css(mixc(bc, pal.haze, .6))); g.addColorStop(st[1], css(pal.haze)); g.addColorStop(1, css(pal.haze, 0));
      ctx.fillStyle = g; ctx.fillRect(x, by, iw, L.bodyH + 2);
    }
  }
  function whiteout(vs) {
    var u = (anchorTop('hero') - vs) / Hs;
    return smooth(1.55, 1.1, u) * (1 - smooth(.78, .22, u)); // rises into the deck, holds, clears
  }
  function drawClouds(ctx, vs, t, w, h) {
    if (!clouds) return false;
    var a = anchorTop('hero'), cf = MOTION ? 1.3 : 1, base = (a - vs) * cf, any = false;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i], sw = 320 * c.sc * Math.max(.45, w / 1440), sh = sw * .5;
      var y = (0.5 - c.u * cf) * Hs + base - sh * .5;
      if (y > h || y + sh < 0) continue;
      any = true;
      var x = ((c.x * w + (a - vs) * c.v * .06) % (w + sw)) - sw;
      if (x < -sw) x += w + sw;
      ctx.globalAlpha = c.a; ctx.drawImage(c.s, x, y, sw, sh);
    }
    ctx.globalAlpha = 1;
    return any;
  }

  var raft = $('raft'), raftRect = null, raftRead = 0;
  function drawWater(ctx, canvas, wl, pal, t, sunX, sunY, w, h, animate) {
    // everything above the waterline is mirrored into it in thin, wavering slices
    var waterH = h - wl; if (waterH <= 2) return;
    var bw = Math.ceil(w / 2), bh = Math.ceil(waterH / 2);
    if (!waterBuf || waterBuf.width !== bw || waterBuf.height !== bh) { waterBuf = makeCanvas(bw, bh); wctx = waterBuf.getContext('2d'); }
    wctx.clearRect(0, 0, bw, bh);
    var srcScale = canvas.width / w, maxSrc = canvas.height;
    for (var r = 0; r < bh; r++) {
      var depth = r * 2, sy = wl - depth * 1.0;
      if (sy < 0) break;
      var wob = Math.sin(depth * .085 + t * 1.4) * (.6 + depth * .012) + Math.sin(depth * .031 - t * .7) * (.4 + depth * .006);
      var sPix = Math.min(maxSrc - 1, Math.round(sy * srcScale));
      wctx.drawImage(canvas, 0, sPix, canvas.width, Math.max(1, Math.round(2 * srcScale)), wob * .5, r, bw, 1);
    }
    ctx.drawImage(waterBuf, 0, wl, w, waterH);
    // depth and colour of the lake
    var g = ctx.createLinearGradient(0, wl, 0, h);
    g.addColorStop(0, css(pal.w1, .16)); g.addColorStop(.35, css(pal.w1, .3)); g.addColorStop(1, css(pal.w2, .62));
    ctx.fillStyle = g; ctx.fillRect(0, wl, w, waterH);
    // the sun's path across the water
    if (sunY < wl) {
      var pathW = w * .14;
      var pg = ctx.createLinearGradient(sunX - pathW, 0, sunX + pathW, 0);
      pg.addColorStop(0, css(pal.sun, 0)); pg.addColorStop(.5, css(pal.sun, .22)); pg.addColorStop(1, css(pal.sun, 0));
      ctx.fillStyle = pg; ctx.fillRect(sunX - pathW, wl, pathW * 2, waterH * .8);
      ctx.fillStyle = css(pal.sun, 1);
      for (var i = 0; i < glitter.length; i++) {
        var gl = glitter[i], d = gl.d * waterH * .8, x = sunX + gl.gx * (pathW * .4 + d * .35);
        var a = gl.a * (0.45 + 0.55 * Math.sin(t * gl.sp + gl.ph));
        if (a < .05) continue;
        ctx.globalAlpha = a; ctx.fillRect(x - gl.len * .5, wl + d, gl.len, 1.2);
      }
      ctx.globalAlpha = 1;
    }
    // slow ripples
    ctx.strokeStyle = 'rgba(255,246,220,.14)'; ctx.lineWidth = 1; ctx.beginPath();
    for (i = 0; i < 12; i++) {
      var ry = wl + waterH * (.08 + i * .077), len = w * (.18 + (i % 3) * .1), rx = ((i * 331 + t * (8 + i * 2)) % (w + len)) - len;
      ctx.moveTo(rx, ry); ctx.lineTo(rx + len, ry);
    }
    ctx.stroke();
    // the shikara, drifting
    if (shikara) {
      var sw = shikara.w, sh = shikara.h, bx = w * 1.1 - ((w * .5 + t * 13) % (w * 1.3 + sw)), by = wl + waterH * .16 - sh * .95;
      if (waterH > Hs * .14 && by > wl - sh && by < h) {
        ctx.drawImage(shikara.c, bx, by, sw, sh);
        ctx.globalAlpha = .32;
        var slices = 10, ssh = sh / slices;
        for (i = 0; i < slices; i++) {
          var wob2 = Math.sin(i * .9 + t * 1.6) * (1 + i * .35);
          ctx.drawImage(shikara.c, 0, (slices - 1 - i) * ssh * dpr, shikara.c.width, ssh * dpr, bx + wob2, by + sh + i * ssh, sw, ssh + .5);
        }
        ctx.globalAlpha = 1;
      }
    }
    // lotus pads in the near corner
    if (waterH > Hs * .3) {
      for (i = 0; i < pads.length; i++) {
        var p = pads[i], px = p.x * w, py = h - (1 - p.y) * waterH * .9 + Math.sin(t * .8 + p.ph) * 1.2, rx = p.rx * Math.max(.7, w / 1200), ry = rx * .42;
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(p.ph) * .25);
        ctx.fillStyle = 'rgba(52,80,56,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.2832); ctx.fill();
        ctx.fillStyle = css(pal.w1, .9); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(rx * Math.cos(p.rot) * 1.05, ry * Math.sin(p.rot) * 1.05); ctx.lineTo(rx * Math.cos(p.rot + .5) * 1.05, ry * Math.sin(p.rot + .5) * 1.05); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,200,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.2832); ctx.stroke();
        ctx.restore();
      }
    }
    // the contact raft casts its light on the water
    if (raft && animate) {
      var nowMs = performance.now();
      if (!raftRect || nowMs - raftRead > 250) { raftRect = raft.getBoundingClientRect(); raftRead = nowMs; }
      var rc = raftRect;
      if (rc.bottom > wl && rc.top < h) {
        var rg = ctx.createLinearGradient(0, rc.bottom, 0, rc.bottom + rc.height * .5);
        rg.addColorStop(0, 'rgba(44,30,16,.22)'); rg.addColorStop(1, 'rgba(44,30,16,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(rc.left + rc.width * .05 + Math.sin(t * 1.1) * 2, rc.bottom + 3, rc.width * .9, rc.height * .5);
      }
    }
  }

  /* The whole picture at one scroll position. */
  function hazeFill(ctx, pal, w, h, k, skyAt) {
    if (skyAt) { // a still picture: grade the haze by position so neighbouring pictures meet cleanly
      var g = ctx.createLinearGradient(0, 0, 0, h), pt = palette(skyAt(0)), pb = palette(skyAt(1));
      g.addColorStop(0, css(pt.haze, pt.hazeD * k)); g.addColorStop(1, css(pb.haze, pb.hazeD * k)); ctx.fillStyle = g;
    } else ctx.fillStyle = css(pal.haze, pal.hazeD * k);
    ctx.fillRect(0, 0, w, h);
  }
  function renderWorld(ctx, canvas, w, h, sy, t, animate, skyAt, sunOn) {
    var vs = vScrollOf(sy), pp = pinProgress(sy), alt = altitudeAt(sy), pal = palette(alt);
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    drawSky(ctx, pal, w, h, skyAt);
    var sunX = w * lerp(.72, .62, (TOP_ALT - alt) / (TOP_ALT - LAKE_ALT)), sunY = pal.sunY * Hs;
    if (sunOn !== false) drawSun(ctx, pal, w, sunX, sunY);
    var waterline = -1, bandNow = 0;
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      if (L.band !== bandNow) {
        // the air between bands: thicker as the descent goes on
        hazeFill(ctx, pal, w, h, bandNow === 0 ? .55 : .3, skyAt);
        bandNow = L.band;
      }
      if (!L.img || L.virtual) continue;
      var y = layerY(L, vs), x = -(pp * (L.hx || 0) * pinDx);
      if (y > h || y + L.imgH + L.bodyH < 0) continue;
      drawLayer(ctx, L, x, y, pal, w);
      if (L.shoreline) waterline = y + L.imgH - 1;
    }
    var cloudsOn = drawClouds(ctx, vs, t, w, h);
    var wo = whiteout(vs);
    if (wo > 0) { ctx.fillStyle = 'rgba(249,251,253,' + wo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
    // warm ground haze low in the valley
    if (alt < 2600) {
      var ga = .22 * smooth(2600, 1700, alt), gg = ctx.createLinearGradient(0, h * .55, 0, h);
      gg.addColorStop(0, css(pal.haze, 0)); gg.addColorStop(1, css(pal.haze, ga)); ctx.fillStyle = gg; ctx.fillRect(0, h * .55, w, h * .45);
    }
    var waterOn = false;
    if (waterline >= 0 && waterline < h) { drawWater(ctx, canvas, Math.round(waterline), pal, t, sunX, sunY, w, h, animate); waterOn = true; }
    lastFrame = waterOn ? { wl: Math.round(waterline), pal: pal, sunX: sunX, sunY: sunY } : null;
    return waterOn;
  }
  var lastFrame = null;

  /* ================= MOTION MODE: one fixed canvas ================= */
  var canvas = $('world'), ctx = null, dirty = true, animating = false, rafId = 0, scrollY = 0, lastT = 0;

  function sizeCanvas() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (W * H * dpr * dpr > 4.5e6) dpr = Math.max(1, Math.sqrt(4.5e6 / (W * H)));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }

  function frame(now) {
    rafId = 0;
    if (!ctx) return;
    var t = now / 1000;
    var alt = altitudeAt(scrollY);
    setInstrument(alt);
    if (dirty) {
      dirty = false;
      animating = renderWorld(ctx, canvas, W, H, scrollY, t, true);
      if (!doc.classList.contains('world-ready') && !pendingOnScreen()) doc.classList.add('world-ready');
    } else if (animating && lastFrame) {
      // only the water moves: everything above the waterline is still on the canvas
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      drawWater(ctx, canvas, lastFrame.wl, lastFrame.pal, t, lastFrame.sunX, lastFrame.sunY, W, H, true);
    }
    if (animating) tick();
  }
  function tick() { if (!rafId) rafId = requestAnimationFrame(frame); }
  function onScroll() { scrollY = currentScroll(); dirty = true; tick(); }

  var resizeTimer = 0, lastW = 0;
  function relayout() {
    measure();
    if (MOTION) {
      sizeCanvas();
      if (W !== lastW || built.hs !== Hs) { lastW = W; layers.forEach(function (L) { L.img = L.soft = null; }); ensureLayers(true); }
      else pumpQueue(true);
      waterBuf = null;
      onScroll();
    } else { calmRelayout(); setInstrument(altitudeAt(currentScroll())); }
  }
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(relayout, 150); }

  /* ================= CALM MODE: a still picture per zone ================= */
  var zoneCanvases = [];
  function calmSetup() {
    var zones = document.querySelectorAll('.zone');
    for (var i = 0; i < zones.length; i++) {
      var c = document.createElement('canvas'); c.className = 'zone-canvas'; c.setAttribute('aria-hidden', 'true');
      zones[i].insertBefore(c, zones[i].firstChild);
      zoneCanvases.push({ el: c, zone: zones[i], drawn: false });
    }
    W = doc.clientWidth; dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    ensureLayers(true);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { var z = findZone(e.target); if (z && !z.drawn) drawZone(z); } });
      }, { rootMargin: '60% 0px' });
      zoneCanvases.forEach(function (z) { io.observe(z.zone); });
    } else zoneCanvases.forEach(drawZone);
  }
  function findZone(el) { for (var i = 0; i < zoneCanvases.length; i++) if (zoneCanvases[i].zone === el) return zoneCanvases[i]; return null; }
  function drawZone(z) {
    while (renderQueue.length) { renderLayer(renderQueue[0]); renderQueue.shift(); }
    var w = z.zone.clientWidth, h = z.zone.clientHeight, top = docTop(z.zone);
    z.el.width = Math.round(w * dpr); z.el.height = Math.round(h * dpr);
    var c = z.el.getContext('2d');
    var id = z.zone.id;
    renderWorld(c, z.el, w, h, top, 0, false, function (f) { return altitudeAt(top + f * h); }, id === 'top' || id === 'contact');
    z.drawn = true;
  }
  function calmRelayout() {
    var w = doc.clientWidth;
    if (w !== built.w) { layers.forEach(function (L) { L.img = L.soft = null; }); W = w; ensureLayers(true); }
    zoneCanvases.forEach(function (z) { z.drawn = false; });
    var vh = window.innerHeight;
    zoneCanvases.forEach(function (z) { var r = z.zone.getBoundingClientRect(); if (r.bottom > -vh && r.top < vh * 2) drawZone(z); });
  }

  /* ================= boot ================= */
  measure();
  if (MOTION && canvas && canvas.getContext) {
    ctx = canvas.getContext('2d', { alpha: false });
    sizeCanvas(); lastW = W;
    ensureLayers(true);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  } else {
    doc.classList.remove('motion'); doc.classList.add('calm'); MOTION = false;
    calmSetup();
    window.addEventListener('scroll', function () { scrollY = currentScroll(); setInstrument(altitudeAt(scrollY)); }, { passive: true });
    setInstrument(altitudeAt(currentScroll()));
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('load', function () { measure(); if (MOTION) onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); onScroll(); });

  /* ================= CHOREOGRAPHY: Lenis + ScrollTrigger ================= */
  var lenis = null, pinST = null;
  function choreograph() {
    if (!MOTION || !window.gsap || !window.ScrollTrigger || !window.Lenis) return;
    var gsap = window.gsap, ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });

    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false, anchors: false, autoRaf: false });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // 5,000 m: the name rises more slowly than the page and is gone before the cloud deck
    var lockup = $('lockup');
    gsap.timeline({ scrollTrigger: { trigger: S.peaks, start: 'top top', end: function () { return '+=' + Hs; }, scrub: true, invalidateOnRefresh: true } })
      .to(lockup, { y: function () { return Hs * 0.35; }, ease: 'none', duration: 1 }, 0)
      .to(lockup, { opacity: 0, ease: 'none', duration: .5 }, .45);

    // the hero line appears on the other side of the cloud
    gsap.fromTo(S.hero.querySelector('.zone-inner'), { opacity: 0, y: 48 }, { opacity: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: S.hero, start: 'top 82%', end: 'top 30%', scrub: true } });

    // text blocks sit a little deeper in the scene than the page itself
    [S.about, S.now, S.shore].forEach(function (sec) {
      var inner = sec.querySelector('.zone-inner');
      gsap.fromTo(inner, { y: function () { return Hs * .06; } }, { y: function () { return -Hs * .06; }, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    });

    // 1,700 m: the valley holds while the cards walk along the terraces
    var track = $('track');
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    pinST = gsap.to(track, { x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: { trigger: S.work, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
        onRefresh: function (st) { pin.start = st.start; pin.end = st.end; } } }).scrollTrigger;
    // keyboard focus inside the pinned track scrolls the page to that card
    track.addEventListener('focusin', function (e) {
      var card = e.target.closest ? e.target.closest('.card') : null;
      if (!card || !pinST || !dist()) return;
      var p = clamp((card.offsetLeft + card.offsetWidth / 2 - window.innerWidth / 2) / dist(), 0, 1);
      lenis.scrollTo(pinST.start + p * (pinST.end - pinST.start), { immediate: true });
    });

    // 1,585 m: the raft rides the water
    if (raft) gsap.to(raft, { y: 5, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1,
      scrollTrigger: { trigger: S.lake, start: 'top bottom', toggleActions: 'play pause resume pause' } });

    // anchors travel the descent; the skip link jumps
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'), el = id.length > 1 && document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        if (id === '#main') { lenis.scrollTo(0, { immediate: true }); el.focus({ preventScroll: true }); return; }
        var target = (el === S.work && pinST) ? pinST.start : el;
        lenis.scrollTo(target, { duration: 1.6, easing: function (t) { return 1 - Math.pow(1 - t, 3); }, onComplete: function () { el.focus({ preventScroll: true }); } });
        if (history.replaceState) history.replaceState(null, '', id);
      });
    });

    ST.addEventListener('refresh', function () { measure(); dirty = true; tick(); });
    // ScrollTrigger refreshes itself on load; only a late font swap needs another pass
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(function () { if (document.readyState === 'complete') ST.refresh(); });
  }
  if (MOTION) requestAnimationFrame(function () { setTimeout(choreograph, 0); });

  window.__descent = {
    altitudeAt: altitudeAt, measure: measure, relayout: relayout, keys: function () { return keys; },
    pin: function () { return pin; }, lenis: function () { return lenis; },
    setPin: function (start, end) { pin.start = start; pin.end = end; measure(); dirty = true; tick(); },
    pinDistance: function () { return pinDx; },
    palette: palette, layers: function () { return layers; }, markDirty: function () { dirty = true; tick(); }
  };
})();
