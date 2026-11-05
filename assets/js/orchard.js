/*! yahyahashme.com — a year in the orchard.
 * One continuous scroll through four seasons. Lenis smooths the scroll, GSAP ScrollTrigger
 * drives the section choreography, and a single fixed canvas draws the light, the chinar
 * and the leaves. With prefers-reduced-motion (or no JS) the page is the calm static version. */
(function () {
  'use strict';

  var doc = document.documentElement;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ---------- Live local time in both places (every mode) ---------- */
  (function clock() {
    var el = document.getElementById('clock'); if (!el) return;
    var w = document.getElementById('t-waterloo'), k = document.getElementById('t-kashmir');
    function at(tz) { return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).toLowerCase(); }
    function tick() { w.textContent = at('America/Toronto'); k.textContent = at('Asia/Kolkata'); }
    try { tick(); el.hidden = false; setInterval(tick, 30000); } catch (e) {}
  })();

  /* ---------- Should the year move? ---------- */
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canvas = document.getElementById('orchard');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d', { alpha: false }) : null;
  var hasLibs = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && typeof Lenis !== 'undefined';
  if (reduceMQ.matches || !ctx || !hasLibs) { doc.classList.add('is-static'); return; }
  doc.classList.add('is-live');
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- Colour: OKLab so the year blends like light, not like paint ---------- */
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function toSrgb(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return clamp(Math.round(c * 255), 0, 255); }
  function lab(h) {
    var rgb = hex(h), r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function rgbOf(L) {
    var l_ = L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], m_ = L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], s_ = L[0] - 0.0894841775 * L[1] - 1.2914855480 * L[2];
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
  }
  function mixLab(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function css(L, alpha) { var c = rgbOf(L); return alpha == null ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')'; }
  function hexOf(L) { var c = rgbOf(L); return '#' + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1); }

  /* Season keyframes. S runs 0 (winter) → 1 (spring) → 2 (summer) → 3 (autumn) → 4 (winter again).
   * Each frame carries a light ink set (for dark skies) and a dark ink set (for pale skies). */
  var KEYS = [
    { s: 0.0, bg0: '#0b121b', bg1: '#151f2b', L: ['#e4ebf3', '#93a1b4', '#b9cfea'], D: ['#1b2330', '#4b586b', '#4e6f94'], bark: '#06090d', sun: [0.22, 0.06, 0.75, '#9bb8dc', 0.18] },
    { s: 0.5, bg0: '#2d3b4c', bg1: '#5d6d80', L: ['#f0f4f8', '#b7c2cf', '#d8c8c0'], D: ['#1b2330', '#4b586b', '#8a5560'], bark: '#120e0c', sun: [0.4, 0.08, 0.85, '#ffd8b4', 0.26] },
    { s: 1.0, bg0: '#f7f0e5', bg1: '#ebdfcf', L: ['#fffaf2', '#e7d7c9', '#f0b9c4'], D: ['#2b2119', '#6f6156', '#b4536a'], bark: '#3a281f', sun: [0.7, 0.05, 0.8, '#ffe6b0', 0.5] },
    { s: 1.5, bg0: '#edebd6', bg1: '#d5dcbe', L: ['#fffdf3', '#e3e6cf', '#dfd08a'], D: ['#222a1c', '#5c6650', '#6e8b3c'], bark: '#2e2118', sun: [0.73, 0.04, 0.85, '#fff0b8', 0.42] },
    { s: 2.0, bg0: '#0e2317', bg1: '#17361f', L: ['#efe8d6', '#a9b59b', '#e3c67c'], D: ['#132015', '#3e5a40', '#6b7c2f'], bark: '#1a120c', sun: [0.76, 0.03, 0.9, '#f4dc8e', 0.3] },
    { s: 2.5, bg0: '#1d2c16', bg1: '#33401d', L: ['#f0e9d4', '#b9bb95', '#e8c56b'], D: ['#1c2314', '#505a3c', '#7d6a22'], bark: '#1b120c', sun: [0.6, 0.08, 0.85, '#ffd37a', 0.32] },
    { s: 3.0, bg0: '#3a1b12', bg1: '#1e110c', L: ['#f4e7d3', '#c9a98a', '#e9a54c'], D: ['#2a150e', '#6a4a36', '#9c4b1f'], bark: '#1b100a', sun: [0.3, 0.16, 0.95, '#ffb866', 0.42] },
    { s: 3.5, bg0: '#241a1f', bg1: '#110d13', L: ['#e9e2dd', '#a89aa0', '#d6a06a'], D: ['#1d1518', '#574b50', '#8c6a4a'], bark: '#0d090b', sun: [0.26, 0.2, 0.75, '#d9a37c', 0.24] },
    { s: 4.0, bg0: '#141d28', bg1: '#070b11', L: ['#e4ebf3', '#93a1b4', '#b9cfea'], D: ['#1b2330', '#4b586b', '#4e6f94'], bark: '#06090d', sun: [0.2, 0.1, 0.65, '#9bb8dc', 0.15] }
  ];
  KEYS.forEach(function (k) {
    k.bg0L = lab(k.bg0); k.bg1L = lab(k.bg1); k.barkL = lab(k.bark); k.sunL = lab(k.sun[3]);
    k.LL = k.L.map(lab); k.DL = k.D.map(lab);
  });
  function paletteAt(S) {
    S = clamp(S, 0, 4);
    var i = 0; while (i < KEYS.length - 2 && S > KEYS[i + 1].s) i++;
    var a = KEYS[i], b = KEYS[i + 1], t = (S - a.s) / (b.s - a.s); t = t * t * (3 - 2 * t);
    var bg0 = mixLab(a.bg0L, b.bg0L, t), bg1 = mixLab(a.bg1L, b.bg1L, t);
    var Lbg = (bg0[0] + bg1[0]) / 2;
    var m = smooth(0.555, 0.615, Lbg); // fast flip from light ink to dark ink at equal contrast
    function tok(j) { return mixLab(mixLab(a.LL[j], b.LL[j], t), mixLab(a.DL[j], b.DL[j], t), m); }
    return {
      bg0: bg0, bg1: bg1, Lbg: Lbg, dark: m < 0.5,
      ink: tok(0), muted: tok(1), accent: tok(2),
      bark: mixLab(a.barkL, b.barkL, t),
      sunX: lerp(a.sun[0], b.sun[0], t), sunY: lerp(a.sun[1], b.sun[1], t), sunR: lerp(a.sun[2], b.sun[2], t),
      sunL: mixLab(a.sunL, b.sunL, t), sunA: lerp(a.sun[4], b.sun[4], t)
    };
  }

  /* ---------- Seeded randomness so the tree is the same every visit ---------- */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- The chinar leaf, as a sprite factory ---------- */
  var LEAF = 'M-7.0 3.5 L-12.9 5.0 L-26.2 7.9 L-31.2 11.9 L-32.3 8.9 L-52.0 10.0 L-57.1 10.1 L-55.0 7.6 L-46.7 -0.8 L-47.0 -4.2 L-44.0 -2.9 L-37.9 -6.7 Q-32.2 -7.4 -39.9 -12.7 L-45.8 -18.7 L-52.8 -19.5 L-50.3 -23.9 L-55.8 -31.0 L-62.3 -32.6 L-59.7 -37.0 L-66.5 -48.8 L-69.3 -54.2 L-63.8 -53.6 L-51.6 -52.1 L-48.0 -55.8 L-45.3 -50.8 L-37.7 -48.7 L-34.1 -52.3 L-32.0 -46.6 L-25.4 -43.8 Q-18.8 -38.6 -19.0 -48.4 L-17.1 -58.4 L-20.9 -64.8 L-15.2 -65.5 L-12.1 -74.8 L-14.9 -81.2 L-9.1 -81.9 L-3.1 -94.1 L-0.0 -100.0 L3.1 -94.1 L9.1 -81.9 L14.9 -81.2 L12.1 -74.8 L15.2 -65.5 L20.9 -64.8 L17.1 -58.4 L19.0 -48.4 Q18.8 -38.6 25.4 -43.8 L32.0 -46.6 L34.1 -52.3 L37.7 -48.7 L45.3 -50.8 L48.0 -55.8 L51.6 -52.1 L63.8 -53.6 L69.3 -54.2 L66.5 -48.8 L59.7 -37.0 L62.3 -32.6 L55.8 -31.0 L50.3 -23.9 L52.8 -19.5 L45.8 -18.7 L39.9 -12.7 Q32.2 -7.4 37.9 -6.7 L44.0 -2.9 L47.0 -4.2 L46.7 -0.8 L55.0 7.6 L57.1 10.1 L52.0 10.0 L32.3 8.9 L31.2 11.9 L26.2 7.9 L12.9 5.0 L7.0 3.5 Q0.0 0.0 -7.0 3.5 Z';
  var VEINS = 'M0 0 L-54.3 9.6 M0 0 L-65.9 -51.5 M0 0 L0.0 -95.0 M0 0 L65.9 -51.5 M0 0 L54.3 9.6';
  var STALK = 'M0 2 Q0.8 20 5 40';
  var SPR = 64, PIVX = 32, PIVY = 46; // sprite box (css px) and the pivot: where the stalk meets the twig
  var leafPath, veinPath, stalkPath;
  try { leafPath = new Path2D(LEAF); veinPath = new Path2D(VEINS); stalkPath = new Path2D(STALK); } catch (e) { doc.classList.remove('is-live'); doc.classList.add('is-static'); return; }

  function makeSprite(dpr, paint) {
    var c = document.createElement('canvas'); c.width = c.height = Math.ceil(SPR * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr); paint(g); return c;
  }
  function leafSprite(dpr, fillL, lit) {
    return makeSprite(dpr, function (g) {
      g.translate(PIVX, PIVY - 15); g.scale(0.4, 0.4);
      var fill = lit ? [fillL[0] + 0.1, fillL[1] * 0.9, fillL[2] * 0.95] : fillL;
      g.fillStyle = css(fill); g.fill(leafPath);
      g.strokeStyle = css([fill[0] - 0.18, fill[1], fill[2]], 0.5); g.lineWidth = 2.2; g.lineCap = 'round'; g.stroke(veinPath);
      g.strokeStyle = css([fill[0] - 0.2, fill[1] * 0.8, fill[2] * 0.8]); g.lineWidth = 7; g.stroke(stalkPath);
    });
  }
  function blossomSprite(dpr, tint) {
    return makeSprite(dpr, function (g) {
      g.translate(PIVX, PIVY - 10);
      for (var i = 0; i < 5; i++) {
        g.save(); g.rotate(i * Math.PI * 2 / 5 + 0.4);
        var grd = g.createRadialGradient(0, -7, 0, 0, -7, 8);
        grd.addColorStop(0, 'rgba(255,255,255,.98)'); grd.addColorStop(1, tint);
        g.fillStyle = grd; g.beginPath(); g.ellipse(0, -7, 4.6, 7.2, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      g.fillStyle = '#e8c15a'; g.beginPath(); g.arc(0, 0, 2.2, 0, Math.PI * 2); g.fill();
    });
  }
  function dotSprite(dpr, r, a) {
    return makeSprite(dpr, function (g) {
      var grd = g.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, r);
      grd.addColorStop(0, 'rgba(255,255,255,' + a + ')'); grd.addColorStop(0.6, 'rgba(240,246,255,' + a * 0.7 + ')'); grd.addColorStop(1, 'rgba(240,246,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, SPR, SPR);
    });
  }
  // Leaf colour ramp: fresh green → deep green → yellow → gold → orange → red → rust.
  var RAMP = ['#a3cf70', '#71b05a', '#3f8a46', '#2f7a3f', '#8ea63f', '#d8ab3a', '#e3862b', '#c9502a', '#a33b22', '#7e2e1c'].map(lab);
  var NB = 20;
  function rampAt(t) { t = clamp(t, 0, 0.9999) * (RAMP.length - 1); var i = Math.floor(t); return mixLab(RAMP[i], RAMP[i + 1], t - i); }

  /* ---------- State ---------- */
  var vw = 0, vh = 0, dpr = 1, W = 0, H = 0, mobile = false, budget = {};
  var segs = [], anchors = [], hangs = [], branchCache = null, cdpr = 1;
  var sprites = { leaf: [], lit: [], blossom: [], snow: [] };
  var fallers = [], landed = [], pile = [], ground = null, gctx = null, groundDirty = false;
  var flakes = [];
  var S = 0, lastS = 0, offX = 0, stage = null, rowX = 0;
  var knots = [];
  var wind = 0, gust = 0, time = 0, lastT = 0, idleSince = 0, lastScroll = 0, ambientT = 0;
  var sunCache = { key: '', grad: null };
  var meta = $('meta[name="theme-color"]');

  /* ---------- Tree ---------- */
  function spineBase() { return clamp(vh * 0.16, 100, 150); }
  function spineY(x) { return spineBase() + Math.sin(x / 430) * 24 + Math.sin(x / 165 + 1.3) * 9 + Math.sin(x / 61 + 0.4) * 3; }
  function upperY(x) { return 30 + Math.sin(x / 310 + 2) * 20 + Math.sin(x / 120) * 6; }

  function buildTree() {
    var rnd = mulberry32(2024091 + Math.round(W / 10));
    segs = []; anchors = [];
    var trunkL = vw * 0.045, trunkR = W - vw * 0.12;
    function spineW(x) { var d = Math.min(Math.abs(x - trunkL), Math.abs(x - trunkR)); return (7 + 16 * Math.max(0, 1 - d / (vw * 0.95))) * (0.84 + 0.32 * Math.abs(Math.sin(x / 140 + 0.7))); }
    var lenScale = clamp(vh / 820, 0.72, 1.1) * (mobile ? 0.85 : 1);

    function seg(x0, y0, cx, cy, x1, y1, w, d) {
      var len = Math.hypot(x1 - x0, y1 - y0) || 1;
      segs.push({ x0: x0, y0: y0, cx: cx, cy: cy, x1: x1, y1: y1, w: w, d: d, hz: Math.abs(x1 - x0) / len, sn: 0.45 + rnd() * 0.5 });
    }
    function leavesAlong(x0, y0, cx, cy, x1, y1, len) {
      var n = Math.max(1, Math.round(len / 13));
      for (var i = 0; i < n; i++) {
        var t = (i + 0.5) / n, u = 1 - t;
        var x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
        if (y < -40) continue;
        anchors.push({
          x: x + (rnd() - 0.5) * 8, y: y + (rnd() - 0.5) * 6,
          rot: Math.PI + (rnd() - 0.5) * 2.4, scale: 0.72 + rnd() * 0.5, phase: rnd(), q: rnd(),
          bloom: rnd() < 0.72 ? 0.6 + rnd() * 0.4 : 0, sway: rnd() * 6.283, det: false, bucket: 0, lit: false, cj: (rnd() - 0.5) * 0.14
        });
      }
    }
    function grow(x, y, ang, len, w, depth, maxDepth) {
      var a = ang + (rnd() - 0.5) * 0.4;
      var x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
      if (y1 < -90) { y1 = -90; }
      var bend = (rnd() - 0.5) * len * 0.5;
      var cx = (x + x1) / 2 + Math.cos(a + Math.PI / 2) * bend, cy = (y + y1) / 2 + Math.sin(a + Math.PI / 2) * bend;
      seg(x, y, cx, cy, x1, y1, w, depth);
      if (depth >= maxDepth - 2) leavesAlong(x, y, cx, cy, x1, y1, len);
      if (depth < maxDepth && y1 > -80) {
        var n = rnd() < 0.72 ? 2 : 3;
        for (var i = 0; i < n; i++) {
          var side = i % 2 === 0 ? 1 : -1, spread = 0.32 + rnd() * 0.5;
          grow(x1, y1, a + side * spread * (i === 2 ? 0.25 : 1), len * (0.6 + rnd() * 0.16), w * 0.6, depth + 1, maxDepth);
        }
      }
    }
    // The long bough across the whole year.
    for (var x = -90; x < W + 90; x += 46) {
      var xm = x + 23, x1 = x + 46;
      seg(x, spineY(x), xm, spineY(xm) + (rnd() - 0.5) * 3, x1, spineY(x1), spineW(xm), 0);
    }
    // A thinner bough higher up, in two long reaches, so the canopy has depth at the top of the frame.
    [[W * 0.06, W * 0.46], [W * 0.54, W * 0.97]].forEach(function (r) {
      for (var ux = r[0]; ux < r[1]; ux += 44) {
        var um = ux + 22, ue = Math.min(r[1], ux + 44), tw = 3 + 4 * Math.sin((ux - r[0]) / (r[1] - r[0]) * Math.PI);
        seg(ux, upperY(ux), um, upperY(um) + (rnd() - 0.5) * 3, ue, upperY(ue), tw, 0);
        if (rnd() < 0.45) grow(um, upperY(um), 0.55 + rnd() * 1.1 + (rnd() < 0.5 ? 0 : 0.9), (50 + rnd() * 50) * lenScale, 3, 1, 3);
      }
    });
    // Two trunks: one by the first winter, one by the last.
    [trunkL, trunkR].forEach(function (tx) {
      var ty = spineY(tx), lean = (rnd() - 0.5) * 50;
      seg(tx, ty - 4, tx + lean * 0.3, ty + (H - ty) * 0.5, tx + lean, H + 80, spineW(tx) * 2.1, -1);
      seg(tx, ty, tx - 30 - rnd() * 30, ty - 80, tx - 50 - rnd() * 60, -90, spineW(tx) * 1.05, 0);
      seg(tx + 6, ty, tx + 40 + rnd() * 30, ty - 70, tx + 70 + rnd() * 60, -90, spineW(tx) * 0.8, 0);
    });
    // Limbs off the bough, mostly reaching up and out of frame, a few dipping down.
    var sx = -40 + rnd() * 60;
    while (sx < W + 40) {
      var up = rnd() < 0.66, right = rnd() < 0.5, y = spineY(sx);
      var ang = up ? -(0.55 + rnd() * 0.85) : (0.4 + rnd() * 0.45);
      if (!right) ang = up ? -Math.PI + (0.55 + rnd() * 0.85) : Math.PI - (0.4 + rnd() * 0.45);
      var len = (up ? 95 + rnd() * 85 : 58 + rnd() * 48) * lenScale;
      grow(sx, y, ang, len, Math.max(3.6, spineW(sx) * (up ? 0.5 : 0.36)), 0, up ? 4 : 3);
      sx += 105 + rnd() * 95;
    }
    // Hanging twigs for the fruit.
    hangs.forEach(function (h) {
      var y0 = spineY(h.x), y1 = y0 + h.len;
      seg(h.x, y0, h.x + 5, y0 + h.len * 0.55, h.x + 2, y1, 3.2, 1);
      anchors.push({ x: h.x - 6, y: y0 + h.len * 0.35, rot: Math.PI + 0.9, scale: 0.9, phase: rnd(), q: rnd(), bloom: 0.7, sway: rnd() * 6.283, det: false, bucket: 0, lit: false, cj: 0 });
      anchors.push({ x: h.x + 7, y: y0 + h.len * 0.6, rot: Math.PI - 0.8, scale: 0.8, phase: rnd(), q: rnd(), bloom: 0.6, sway: rnd() * 6.283, det: false, bucket: 0, lit: false, cj: 0.05 });
    });
    // Thin to the budget, measured on the first screen.
    var visible = anchors.filter(function (a) { return a.x >= 0 && a.x <= vw && a.y < vh; }).length;
    var keep = Math.min(1, budget.canopy / Math.max(1, visible));
    if (keep < 1) anchors = anchors.filter(function () { return rnd() < keep; });
    anchors.sort(function (a, b) { return a.x - b.x; });
    anchors.forEach(function (a) { a.sDet = 2.55 + a.q * 0.95; });
    segs.sort(function (a, b) { return Math.min(a.x0, a.x1) - Math.min(b.x0, b.x1); });
    paintBranches();
  }

  function paintBranches() {
    cdpr = Math.min(dpr, 1.5);
    branchCache = document.createElement('canvas');
    branchCache.width = Math.ceil((W + 180) * cdpr); branchCache.height = Math.ceil((H + 160) * cdpr);
    var g = branchCache.getContext('2d');
    g.scale(cdpr, cdpr); g.translate(90, 0);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#17110d';
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      g.lineWidth = s.w; g.beginPath(); g.moveTo(s.x0, s.y0); g.quadraticCurveTo(s.cx, s.cy, s.x1, s.y1); g.stroke();
    }
  }

  function buildSprites() {
    sprites.leaf = []; sprites.lit = [];
    for (var i = 0; i < NB; i++) { var L = rampAt(i / (NB - 1)); sprites.leaf.push(leafSprite(dpr, L, false)); sprites.lit.push(leafSprite(dpr, L, true)); }
    sprites.blossom = [blossomSprite(dpr, 'rgba(248,196,206,.95)'), blossomSprite(dpr, 'rgba(241,176,190,.95)'), blossomSprite(dpr, 'rgba(253,230,234,.95)')];
    sprites.snow = [dotSprite(dpr, 2.2, 0.85), dotSprite(dpr, 3.4, 0.7), dotSprite(dpr, 1.6, 0.6), dotSprite(dpr, 4.6, 0.45)];
  }

  /* ---------- Layout: viewport, the Work orchard, the season map ---------- */
  var stageEl = $('#stage'), rowEl = $('#row'), rowItems = [], fruits = [];
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight; mobile = vw < 760;
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    var slow = (navigator.hardwareConcurrency || 8) <= 4;
    budget = { canopy: (mobile ? 230 : 440) * (slow ? 0.7 : 1), fall: mobile ? 36 : 70, snow: mobile ? 44 : 90, perFrame: 5 };
    canvas.width = Math.ceil(vw * dpr); canvas.height = Math.ceil(vh * dpr);
    H = vh;
  }

  function layoutStage() {
    rowItems = $$('#row > *'); fruits = $$('#row .fruit');
    var viable = vh >= 560 && vw >= 320;
    stage = null; hangs = [];
    if (!viable) { doc.classList.remove('has-stage'); rowItems.forEach(function (el) { el.style.cssText = ''; }); W = vw; return; }
    doc.classList.add('has-stage');
    var cardW = Math.min(340, vw * 0.84), gap = mobile ? 26 : 48;
    var x = vw * (mobile ? 0.5 : 0.56), xs = [];
    var twigs = [46, 82, 38, 70, 52, 88], tScale = vh < 720 ? 0.6 : 1, i = 0;
    rowItems.forEach(function (el) {
      if (el.classList.contains('group')) {
        var tx = x - cardW / 2 + 52, ty = spineY(tx) + 18;
        el.style.cssText = '--x:' + tx.toFixed(1) + 'px;--y:' + ty.toFixed(1) + 'px;--stem:18px';
        return;
      }
      var twig = twigs[i % twigs.length] * tScale, hy = spineY(x) + twig, stem = 22;
      el.style.cssText = '--x:' + x.toFixed(1) + 'px;--y:' + (hy + stem).toFixed(1) + 'px;--stem:' + stem + 'px;--card-w:' + cardW.toFixed(1) + 'px;--sway-dur:' + (6.5 + (i % 3) * 1.3) + 's;--sway-delay:' + (-i * 1.7) + 's';
      hangs.push({ x: x, len: twig }); xs.push(x);
      x += cardW + gap; i++;
    });
    var travel = Math.max(0, xs[xs.length - 1] - vw * 0.5);
    var hold0 = vh * 0.3, hold1 = vh * 0.3;
    var stageH = vh + hold0 + travel + hold1;
    stageEl.style.setProperty('--stage-h', Math.round(stageH) + 'px');
    stage = { travel: travel, p0: hold0 / (stageH - vh), p1: 1 - hold1 / (stageH - vh), xs: xs, cardW: cardW };
    W = vw + travel;
  }

  var secs = {};
  function computeKnots() {
    var sy = window.scrollY || 0;
    function top(el) { return el.getBoundingClientRect().top + sy; }
    var spring = secs.spring, work = secs.work, autumn = secs.autumn, end = secs.end;
    var autumnH = autumn.offsetHeight, max = Math.max(1, doc.scrollHeight - vh);
    var stageEnd = stage ? top(work) + stageEl.offsetHeight - vh : top(work);
    var k = [
      [0, 0],
      [top(spring) - vh * 1.0, 0.5],
      [top(spring) - vh * 0.35, 1.0],
      [top(work) - vh * 1.05, 1.5],
      [top(work) - vh * 0.1, 2.0],
      [stageEnd, 2.08],
      [top(autumn) - vh * 0.55, 2.6],
      [top(autumn) + autumnH * 0.5 - vh * 0.5, 3.1],
      [top(autumn) + autumnH - vh * 0.6, 3.5],
      [top(end) - vh * 0.35, 3.82],
      [max, 4.0]
    ];
    for (var i = 1; i < k.length; i++) if (k[i][0] <= k[i - 1][0]) k[i][0] = k[i - 1][0] + 1;
    knots = k;
  }
  function seasonAt(y) {
    if (y <= knots[0][0]) return knots[0][1];
    for (var i = 1; i < knots.length; i++) {
      if (y <= knots[i][0]) { var a = knots[i - 1], b = knots[i]; return lerp(a[1], b[1], (y - a[0]) / (b[0] - a[0])); }
    }
    return knots[knots.length - 1][1];
  }

  /* ---------- Drawing ---------- */
  function drawSprite(img, x, y, rot, s) {
    var c = Math.cos(rot) * s, sn = Math.sin(rot) * s;
    ctx.setTransform(c * dpr, sn * dpr, -sn * dpr, c * dpr, x * dpr, y * dpr);
    ctx.drawImage(img, -PIVX, -PIVY, SPR, SPR);
  }
  function firstAnchor(x) { var lo = 0, hi = anchors.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (anchors[mid].x < x) lo = mid + 1; else hi = mid; } return lo; }
  function firstSeg(x) { var lo = 0, hi = segs.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (Math.min(segs[mid].x0, segs[mid].x1) < x) lo = mid + 1; else hi = mid; } return lo; }

  function leafState(a, S) {
    // blossom opens S .6→1.0, fades 1.35→1.6; leaf unfurls 1.3→1.8; colour turns late summer into autumn, staggered per leaf
    var p = a.phase;
    var bl = a.bloom ? smooth(0.58 + p * 0.22, 0.98 + p * 0.12, S) * (1 - smooth(1.3 + p * 0.15, 1.6 + p * 0.1, S)) : 0;
    var lf = smooth(1.28 + p * 0.25, 1.78 + p * 0.2, S);
    var col = 0.33 * smooth(1.4, 1.95, S) + 0.67 * smooth(2.12 + p * 0.45, 2.85 + p * 0.45, S) * (0.75 + 0.25 * a.q) + a.cj * lf;
    return { bl: bl, lf: lf, col: clamp(col, 0, 1) };
  }

  function groundY(x) { var c = clamp(Math.floor(x / 20), 0, pile.length - 1); return H - 3 - (pile[c] || 0); }
  function bakeLanded(p) {
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    var c = Math.cos(p.rot) * p.s, sn = Math.sin(p.rot) * p.s;
    gctx.setTransform(c * dpr, sn * dpr, -sn * dpr, c * dpr, p.x * dpr, p.y * dpr);
    gctx.drawImage(p.img, -PIVX, -PIVY, SPR, SPR);
  }
  function rebuildGround() {
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, ground.width, ground.height);
    for (var i = 0; i < pile.length; i++) pile[i] = 0;
    landed.forEach(function (p) { settle(p); bakeLanded(p); });
    groundDirty = false;
  }
  function settle(p) {
    var c = clamp(Math.floor(p.x / 20), 0, pile.length - 1);
    p.y = H - 3 - (pile[c] || 0);
    pile[c] = Math.min(pile[c] + 2.6 * p.s, 54);
    if (c > 0) pile[c - 1] = Math.min(pile[c - 1] + 1.1 * p.s, 54);
    if (c < pile.length - 1) pile[c + 1] = Math.min(pile[c + 1] + 1.1 * p.s, 54);
  }
  function detach(a, now) {
    a.det = true;
    var st = leafState(a, S), b = clamp(Math.round(st.col * (NB - 1)), 0, NB - 1);
    fallers.push({
      x: a.x + offX, y: a.y, vx: (Math.random() - 0.5) * 20, vy: 10 + Math.random() * 20, term: 60 + Math.random() * 60,
      rot: a.rot, rv: (Math.random() - 0.5) * 1.6, fr: 1.2 + Math.random() * 1.6, ph: Math.random() * 6.283, amp: 18 + Math.random() * 30,
      s: a.scale * 0.95, img: (a.lit ? sprites.lit : sprites.leaf)[b], sDet: now ? S - 0.001 : a.sDet, a: a, born: time
    });
    if (now) a.sDet = S - 0.001;
  }

  function frame(t) {
    var dt = Math.min(0.05, Math.max(0.001, t - lastT)); lastT = t; time = t;
    var scroll = lenis.scroll || 0;
    S = seasonAt(scroll);
    if (Math.abs(scroll - lastScroll) > 0.5) { gust += (scroll - lastScroll) * 0.002; idleSince = t; }
    lastScroll = scroll;
    gust *= Math.pow(0.08, dt); gust = clamp(gust, -2.5, 2.5);
    wind = Math.sin(t * 0.21) * 0.5 + Math.sin(t * 0.67 + 1) * 0.25 + gust;
    offX = stage ? rowX : 0;
    var pal = paletteAt(S);
    applyPalette(pal);

    // When scrolling back up through autumn, leaves return to the tree.
    if (S < lastS) {
      for (var i = fallers.length - 1; i >= 0; i--) if (fallers[i].sDet > S) { fallers[i].a.det = false; fallers.splice(i, 1); }
      for (var j = landed.length - 1; j >= 0; j--) if (landed[j].sDet > S) { landed[j].a.det = false; landed.splice(j, 1); groundDirty = true; }
      if (groundDirty) rebuildGround();
    }
    lastS = S;

    var winter = Math.max(1 - S / 0.85, smooth(3.3, 3.9, S)); // how deep the snow is
    var snowBranches = Math.max(1 - S / 0.75, smooth(3.45, 3.95, S));
    var autumnWind = 1 + smooth(2.5, 3.0, S) * 0.8;

    // Sky
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, css(pal.bg0)); sky.addColorStop(1, css(pal.bg1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, vw, H);
    // Light
    var sx = pal.sunX * vw, sy = pal.sunY * H, sr = pal.sunR * Math.max(vw, H);
    var sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sun.addColorStop(0, css(pal.sunL, pal.sunA)); sun.addColorStop(0.45, css(pal.sunL, pal.sunA * 0.35)); sun.addColorStop(1, css(pal.sunL, 0));
    ctx.fillStyle = sun; ctx.fillRect(0, 0, vw, H);

    // Branches
    if (branchCache) {
      var srcX = (-offX + 90) * cdpr;
      ctx.drawImage(branchCache, srcX, 0, vw * cdpr, H * cdpr, 0, 0, vw, H);
    }
    // Snow resting on the branches
    if (snowBranches > 0.02) {
      ctx.lineCap = 'round';
      var x0 = -offX - 60, x1 = -offX + vw + 60;
      for (var si = firstSeg(x0); si < segs.length; si++) {
        var sg = segs[si]; if (Math.min(sg.x0, sg.x1) > x1) break;
        if (sg.w < 2.2 || sg.d === -1 || sg.hz < 0.3) continue;
        ctx.strokeStyle = 'rgba(230,238,248,' + (snowBranches * sg.hz * sg.sn).toFixed(2) + ')';
        ctx.lineWidth = Math.max(1.2, sg.w * 0.32); ctx.beginPath();
        var lift = sg.w * 0.46;
        ctx.moveTo(sg.x0 + offX, sg.y0 - lift); ctx.quadraticCurveTo(sg.cx + offX, sg.cy - lift, sg.x1 + offX, sg.y1 - lift); ctx.stroke();
      }
    }

    // Canopy
    var lx0 = -offX - 70, lx1 = -offX + vw + 70, due = 0, visibleLeaves = 0;
    var litX = sx - offX, litY = sy, litR = sr * 0.55;
    for (var ai = firstAnchor(lx0); ai < anchors.length; ai++) {
      var a = anchors[ai]; if (a.x > lx1) break;
      if (a.y > H + 30) continue;
      var st = leafState(a, S);
      var x = a.x + offX, y = a.y;
      if (st.bl > 0.01) {
        drawSprite(sprites.blossom[ai % 3], x, y, a.rot + Math.sin(t * 1.1 + a.sway) * 0.05, st.bl * a.scale * 0.9);
      }
      if (st.lf > 0.01 && !a.det) {
        if (a.sDet <= S) { if (due < budget.perFrame && fallers.length < budget.fall) { detach(a, false); due++; } continue; }
        var ddx = a.x - litX, ddy = a.y - litY; a.lit = (ddx * ddx + ddy * ddy) < litR * litR;
        var b = clamp(Math.round(st.col * (NB - 1)), 0, NB - 1);
        var sw = Math.sin(t * 1.25 + a.sway) * 0.06 * autumnWind + wind * 0.03;
        drawSprite((a.lit ? sprites.lit : sprites.leaf)[b], x, y, a.rot + sw, st.lf * a.scale);
        visibleLeaves++;
      }
    }
    // A leaf lets go now and then while you linger in autumn.
    if (S > 2.6 && S < 3.55 && visibleLeaves > 0 && t - idleSince > 1.2 && t - ambientT > 1.6 && fallers.length < budget.fall) {
      ambientT = t;
      var tries = 0; while (tries++ < 12) {
        var ra = anchors[firstAnchor(lx0) + Math.floor(Math.random() * Math.max(1, visibleLeaves))];
        if (ra && !ra.det && ra.x < lx1 && leafState(ra, S).lf > 0.5) { detach(ra, true); break; }
      }
    }

    // Falling leaves
    for (var fi = fallers.length - 1; fi >= 0; fi--) {
      var p = fallers[fi];
      p.vy = Math.min(p.vy + 150 * dt, p.term);
      p.x += (p.vx + wind * 26 + Math.sin(t * p.fr + p.ph) * p.amp) * dt;
      p.y += (p.vy + Math.cos(t * p.fr + p.ph) * 12) * dt;
      p.rot += (p.rv + Math.cos(t * p.fr + p.ph) * 0.9) * dt;
      if (p.y >= groundY(p.x)) {
        if (p.x < -40 || p.x > vw + 40) { fallers.splice(fi, 1); continue; }
        p.rot = (Math.sin(p.rot) > 0 ? 1 : -1) * Math.PI / 2 + (Math.random() - 0.5) * 0.7;
        settle(p); landed.push(p); bakeLanded(p); fallers.splice(fi, 1); continue;
      }
      drawSprite(p.img, p.x, p.y, p.rot, p.s);
    }
    // The ground
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (landed.length) ctx.drawImage(ground, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (winter > 0.02) drawSnowBank(winter);
    // Snow in the air
    snowfall(dt, winter, t);
    // Vignette
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    var vig = ctx.createRadialGradient(vw * 0.5, H * 0.45, Math.min(vw, H) * 0.35, vw * 0.5, H * 0.45, Math.max(vw, H) * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,' + (pal.dark ? 0.42 : 0.16) + ')');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, vw, H);
  }

  function drawSnowBank(w) {
    var base = (H * 0.055 + 10) * w;
    ctx.beginPath(); ctx.moveTo(-10, H + 10);
    for (var x = -10; x <= vw + 20; x += 18) {
      var c = clamp(Math.floor(x / 20), 0, pile.length - 1);
      var h = base * (0.82 + 0.18 * Math.sin(x / 73 + 1) + 0.09 * Math.sin(x / 29));
      h = Math.max(h, ((pile[c] || 0) + 8) * w);
      ctx.lineTo(x, H - h);
    }
    ctx.lineTo(vw + 20, H + 10); ctx.closePath();
    var g = ctx.createLinearGradient(0, H - base - 20, 0, H);
    g.addColorStop(0, 'rgba(240,245,251,' + (0.96 * w).toFixed(3) + ')'); g.addColorStop(1, 'rgba(196,210,228,' + (0.96 * w).toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fill();
  }

  function snowfall(dt, w, t) {
    var target = Math.round(budget.snow * w);
    while (flakes.length < target) flakes.push({ x: Math.random() * vw, y: -8 - Math.random() * H * 0.3, vy: 20 + Math.random() * 42, ph: Math.random() * 6.283, k: Math.floor(Math.random() * 4), s: 0.6 + Math.random() * 0.8, a: 0 });
    for (var i = flakes.length - 1; i >= 0; i--) {
      var f = flakes[i];
      var dying = i >= target;
      f.a = dying ? f.a - dt * 0.7 : Math.min(1, f.a + dt * 0.8);
      if (f.a <= 0) { flakes.splice(i, 1); continue; }
      f.y += f.vy * dt; f.x += (Math.sin(t * 0.6 + f.ph) * 14 + wind * 10) * dt;
      if (f.y > H + 8) { if (dying) { flakes.splice(i, 1); continue; } f.y = -8; f.x = Math.random() * vw; }
      if (f.x < -8) f.x = vw + 8; else if (f.x > vw + 8) f.x = -8;
      ctx.globalAlpha = f.a;
      ctx.setTransform(f.s * dpr, 0, 0, f.s * dpr, f.x * dpr, f.y * dpr);
      ctx.drawImage(sprites.snow[f.k], -SPR / 2, -SPR / 2, SPR, SPR);
    }
    ctx.globalAlpha = 1;
  }

  var cssS = -1;
  function applyPalette(pal) {
    if (Math.abs(S - cssS) < 0.012 && cssS >= 0) return;
    cssS = S;
    var st = doc.style;
    st.setProperty('--ink', css(pal.ink)); st.setProperty('--muted', css(pal.muted)); st.setProperty('--accent', css(pal.accent));
    st.setProperty('--rule', css(pal.ink, 0.18)); st.setProperty('--bark', css(pal.bark)); st.setProperty('--bg0', css(pal.bg0));
    if (meta) meta.setAttribute('content', hexOf(pal.bg0));
  }

  /* ---------- Build everything for the current viewport ---------- */
  var lastW = 0, lastH = 0;
  function rebuild() {
    measure();
    layoutStage();
    buildSprites();
    buildTree();
    pile = new Array(Math.ceil(vw / 20) + 2).fill(0);
    ground = document.createElement('canvas'); ground.width = canvas.width; ground.height = canvas.height; gctx = ground.getContext('2d');
    fallers = []; landed = []; anchors.forEach(function (a) { a.det = false; }); flakes = [];
    lastW = vw; lastH = vh;
  }

  /* ---------- Scroll: Lenis + ScrollTrigger ---------- */
  var lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); frame(time); });
  gsap.ticker.lagSmoothing(0);

  secs = { spring: $('#about'), work: $('#work'), autumn: $('#offscreen'), end: $('#contact') };
  rebuild();
  computeKnots();

  // Smooth anchor travel, and the skip link lands focus on the content.
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null; if (!a) return;
    var id = a.getAttribute('href').slice(1), target = id ? document.getElementById(id) : null; if (!target) return;
    e.preventDefault();
    if (id === 'main' || id === 'top') { lenis.scrollTo(0, { duration: 1.1 }); }
    else lenis.scrollTo(target, { offset: id === 'work' ? 0 : -16, duration: 1.3 });
    if (id === 'main') target.focus({ preventScroll: true });
    if (history.pushState) history.pushState(null, '', '#' + id);
  });

  /* ---------- Choreography ---------- */
  // Winter: the name forms, character by character, like frost spreading.
  function frostIntro() {
    var el = $('.name .frost'), name = $('.name'); if (!el) return;
    var text = el.textContent, frag = document.createDocumentFragment(), chars = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); continue; }
      var sp = document.createElement('span'); sp.className = 'ch'; sp.textContent = ch; frag.appendChild(sp); chars.push(sp);
    }
    el.textContent = ''; el.appendChild(frag);
    gsap.set(chars, { opacity: 0.1, filter: 'blur(12px)', textShadow: '0 0 28px rgba(190,215,255,.95)' });
    name.classList.add('is-split');
    var seed = 3; // frost nucleates near the start of the name and spreads
    var order = chars.map(function (c, i) { return { c: c, d: Math.abs(i - seed) + Math.random() * 2.2 }; }).sort(function (a, b) { return a.d - b.d; });
    var tl = gsap.timeline({ delay: 0.15 });
    order.forEach(function (o, i) {
      tl.to(o.c, { opacity: 1, filter: 'blur(0px)', textShadow: '0 0 0px rgba(190,215,255,0)', duration: 1.15, ease: 'power2.out' }, i * 0.075);
    });
    tl.from('.hero .season-mark, .kicker, .cue', { opacity: 0, y: 8, duration: 1, stagger: 0.12, ease: 'power2.out' }, 0.5);
    tl.add(function () { chars.forEach(function (c) { c.style.willChange = 'auto'; }); });
  }
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var started = false;
  function startIntro() { if (started) return; started = true; frostIntro(); }
  fontsReady.then(startIntro); setTimeout(startIntro, 900);

  // Spring: the hero line reveals word by word as the blossom opens.
  (function words() {
    var el = $('.hero-line .words'); if (!el) return;
    var parts = el.textContent.split(' '), frag = document.createDocumentFragment(), ws = [];
    parts.forEach(function (w, i) {
      var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = w; frag.appendChild(sp); ws.push(sp);
      if (i < parts.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    el.textContent = ''; el.appendChild(frag);
    gsap.fromTo(ws, { opacity: 0, y: 16, filter: 'blur(6px)' }, {
      opacity: 1, y: 0, filter: 'blur(0px)', ease: 'none', stagger: 0.12, duration: 0.6,
      scrollTrigger: { trigger: '.hero-line', start: 'top 92%', end: 'top 38%', scrub: true }
    });
  })();

  // Gentle arrivals for the prose blocks.
  $$('[data-reveal]').forEach(function (el) {
    gsap.from(el, { opacity: 0, y: 24, duration: 1.1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  // Summer: the orchard holds while the fruit comes to you.
  var stageST = null;
  function setupStage() {
    if (stageST) { stageST.kill(); stageST = null; }
    rowX = 0; rowEl.style.transform = '';
    if (!stage) return;
    var head = $('.stage__head');
    stageST = ScrollTrigger.create({
      trigger: stageEl, start: 'top top', end: 'bottom bottom',
      onUpdate: function (self) {
        var p = self.progress, u = clamp((p - stage.p0) / (stage.p1 - stage.p0), 0, 1);
        rowX = -stage.travel * u;
        rowEl.style.transform = 'translate3d(' + rowX.toFixed(2) + 'px,0,0)';
      }
    });
    gsap.fromTo(head, { opacity: 0, y: 12 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: stageEl, start: 'top 40%', end: 'top top', scrub: true } });
  }
  setupStage();
  // Keyboard users: focusing a card brings it into the middle of the orchard.
  rowEl.addEventListener('focusin', function (e) {
    if (!stage || !stageST) return;
    var f = e.target.closest ? e.target.closest('.fruit') : null; if (!f) return;
    var i = fruits.indexOf(f); if (i < 0) return;
    var need = clamp(stage.xs[i] - vw * 0.5, 0, stage.travel);
    var p = stage.p0 + (need / Math.max(1, stage.travel)) * (stage.p1 - stage.p0);
    lenis.scrollTo(stageST.start + p * (stageST.end - stageST.start), { duration: 0.9 });
  });

  // Autumn: the numbers count up as the leaves come down.
  (function counters() {
    var nums = $$('.ledger .num'); if (!nums.length) return;
    nums.forEach(function (n) { n.dataset.final = n.textContent; });
    ScrollTrigger.create({
      trigger: '.ledger', start: 'top 85%', end: 'top 30%', scrub: true,
      onUpdate: function (self) {
        var e = 1 - Math.pow(1 - self.progress, 3);
        nums.forEach(function (n) {
          if (self.progress >= 0.999) { n.textContent = n.dataset.final; return; }
          var v = Math.round(parseInt(n.dataset.count, 10) * e);
          n.textContent = v.toLocaleString('en-US');
        });
      }
    });
  })();

  /* ---------- Resize ---------- */
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var w = window.innerWidth, h = window.innerHeight;
      if (w !== lastW || Math.abs(h - lastH) > 160) { rebuild(); setupStage(); }
      else { measure(); if (ground) { var ng = document.createElement('canvas'); ng.width = canvas.width; ng.height = canvas.height; var c2 = ng.getContext('2d'); c2.drawImage(ground, 0, 0); ground = ng; gctx = c2; } }
      ScrollTrigger.refresh();
    }, 220);
  });
  ScrollTrigger.addEventListener('refresh', computeKnots);
  fontsReady.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  // If motion preferences change mid-visit, hand over to the calm version.
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function (e) { if (e.matches) location.reload(); });
})();
