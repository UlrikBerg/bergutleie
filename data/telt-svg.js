/* ===========================================================================
   Isometrisk tegning av et telt med bordoppsett.

   Portert uendret fra designet. Regner ut en 3D-ish projeksjon av telt,
   bord og stoler, og returnerer ferdig SVG-markup som en streng.
   Brukes både av byggeskriptet (statisk førstevisning) og av nettleseren
   (når brukeren drar for å rotere).

   teltId  hvilket telt – bestemmer grunnflaten
   bt      'lang' eller 'rund' – bordtype
   nBord   antall bord
   hs      hestesko-oppsett
   ends    stol for bordenden
   ang     rotasjonsvinkel i radianer
   ======================================================================== */

const DIM = { t38: [9.4, 3.8], t56: [7, 6.2], t58: [9.5, 6.2], t510: [11.5, 6.2] };

export function teltSvg(teltId, bt, nBord, hs, ends, ang) {
  const dim = DIM[teltId] || [9.4, 3.8];
  const Ld = dim[0], Wd = dim[1];
  const h = 2, H = 3;
  const cx0 = Ld / 2, cy0 = Wd / 2;
  const ca = Math.cos(ang || 0), sa = Math.sin(ang || 0);
  const rot = (x, y) => {
    const dx = x - cx0, dy = y - cy0;
    return [cx0 + dx * ca - dy * sa, cy0 + dx * sa + dy * ca];
  };

  let minXu = 1e9, maxXu = -1e9, maxYu = -1e9;
  [[-1.1, -1.1], [Ld + 1.1, -1.1], [Ld + 1.1, Wd + 1.1], [-1.1, Wd + 1.1]].forEach(c => {
    const r = rot(c[0], c[1]);
    const X = (r[0] - r[1]) * 0.866, Y = (r[0] + r[1]) * 0.5;
    if (X < minXu) minXu = X;
    if (X > maxXu) maxXu = X;
    if (Y > maxYu) maxYu = Y;
  });
  const rgA = rot(0, cy0), rgB = rot(Ld, cy0);
  const minYu = Math.min((rgA[0] + rgA[1]) * 0.5, (rgB[0] + rgB[1]) * 0.5) - H;
  const s = Math.min(600 / (maxXu - minXu), 240 / (maxYu - minYu));
  const ox = 320 - (minXu + maxXu) / 2 * s;
  const oy = 134 - (minYu + maxYu) / 2 * s;

  const pt = (x, y, z) => {
    const r = rot(x, y);
    return [(r[0] - r[1]) * 0.866 * s + ox, (r[0] + r[1]) * 0.5 * s - z * s + oy];
  };
  const dep = (x, y) => { const r = rot(x, y); return r[0] + r[1]; };
  const P = (x, y, z) => { const q = pt(x, y, z); return q[0].toFixed(1) + ',' + q[1].toFixed(1); };
  const poly = (pts, fill, o) =>
    '<polygon points="' + pts.map(a => P(a[0], a[1], a[2])).join(' ') + '" fill="' + fill + '" ' + (o || '') + '/>';
  const ln = (a, b, st, w) => {
    const p = pt(a[0], a[1], a[2]), q = pt(b[0], b[1], b[2]);
    return '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) +
      '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) +
      '" stroke="' + st + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  };
  const cir = (x, y, z, r, fill, op) => {
    const q = pt(x, y, z);
    return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) +
      '" r="' + r + '" fill="' + fill + '"' + (op ? ' opacity="' + op + '"' : '') + '/>';
  };

  let svg = '';
  const gc = pt(cx0, cy0, 0);
  svg += '<ellipse cx="' + gc[0].toFixed(1) + '" cy="' + (gc[1] + 5).toFixed(1) +
    '" rx="' + ((Ld + Wd) * 0.47 * s).toFixed(1) + '" ry="' + ((Ld + Wd) * 0.165 * s).toFixed(1) + '" fill="#E7EDDF"/>';
  svg += poly([[-0.35, -0.35, 0], [Ld + 0.35, -0.35, 0], [Ld + 0.35, Wd + 0.35, 0], [-0.35, Wd + 0.35, 0]], '#DDE4D4');

  const Cd = cx0 + cy0;
  const pre = [], post = [];
  [[0, 0], [Ld, 0], [Ld, Wd], [0, Wd]].forEach(c => {
    const ux = c[0] === 0 ? -0.85 : 0.85, uy = c[1] === 0 ? -0.85 : 0.85;
    const g = ln([c[0], c[1], h], [c[0] + ux, c[1] + uy, 0.1], '#93A5A0', 1.3)
      + ln([c[0] + ux, c[1] + uy, 0], [c[0] + ux, c[1] + uy, 0.32], '#5C6B67', 3)
      + ln([c[0], c[1], 0], [c[0], c[1], h], '#C6CDC5', 2.5);
    (dep(c[0], c[1]) <= Cd ? pre : post).push({ d: dep(c[0], c[1]), s: g });
  });
  [
    { p: [[0, 0, h], [Ld, 0, h], [Ld, cy0, H], [0, cy0, H]], c: [cx0, Wd * 0.25] },
    { p: [[0, Wd, h], [Ld, Wd, h], [Ld, cy0, H], [0, cy0, H]], c: [cx0, Wd * 0.75] },
    { p: [[0, 0, h], [0, Wd, h], [0, cy0, H]], c: [0.01, cy0] },
    { p: [[Ld, 0, h], [Ld, Wd, h], [Ld, cy0, H]], c: [Ld - 0.01, cy0] }
  ].forEach(f => {
    const d = dep(f.c[0], f.c[1]);
    if (d <= Cd) pre.push({ d, s: poly(f.p, '#F8F9F1', 'stroke="#DCE1D6" stroke-width="1"') });
    else post.push({ d, s: poly(f.p, 'rgba(255,255,255,0.42)', 'stroke="#D8DDD3" stroke-width="1"') });
  });
  pre.sort((a, b) => a.d - b.d);
  svg += pre.map(i => i.s).join('');

  const items = [];
  const edge = 'stroke="#D8D7CB" stroke-width="0.8"';
  const chair = (cx, cy, fx, fy) => {
    const bx = cx - fx * 0.18, by = cy - fy * 0.18, px = -fy, py = fx;
    const q = pt(cx, cy, 0.46);
    const seat = '<ellipse cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) +
      '" rx="' + (0.205 * s).toFixed(1) + '" ry="' + (0.118 * s).toFixed(1) +
      '" fill="#FFFFFF" stroke="#CFCEC2" stroke-width="0.9"/>';
    const back = poly([
      [bx - px * 0.17, by - py * 0.17, 0.5], [bx + px * 0.17, by + py * 0.17, 0.5],
      [bx + px * 0.17, by + py * 0.17, 0.92], [bx - px * 0.17, by - py * 0.17, 0.92]
    ], '#F3F3EA', 'stroke="#C6C5B9" stroke-width="0.9" stroke-linejoin="round"');
    items.push({ d: dep(cx, cy), s: dep(bx, by) > dep(cx, cy) ? seat + back : back + seat });
  };
  const bordX = (x0, cy, mode, inner) => {
    const y0 = cy - 0.38, y1 = cy + 0.38, x1 = x0 + 1.8, zt = 0.74, zb = 0.16;
    const sv = poly([[x0, y1, zb], [x1, y1, zb], [x1, y1, zt], [x0, y1, zt]], '#F0EFE5')
      + poly([[x1, y0, zb], [x1, y1, zb], [x1, y1, zt], [x1, y0, zt]], '#E6E5DA')
      + poly([[x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]], '#FFFFFF', edge);
    items.push({ d: dep(x0 + 0.9, cy), s: sv });
    if (mode === 2) {
      for (let i = 0; i < 3; i++) { chair(x0 + 0.35 + i * 0.55, cy - 0.76, 0, 1); chair(x0 + 0.35 + i * 0.55, cy + 0.76, 0, -1); }
    } else if (inner === 2) {
      for (let i = 0; i < 3; i++) chair(x0 + 0.35 + i * 0.55, cy + mode * 0.76, 0, -mode);
      chair(x0 + 0.62, cy - mode * 0.76, 0, mode);
      chair(x0 + 1.18, cy - mode * 0.76, 0, mode);
    } else {
      for (let i = 0; i < 3; i++) { chair(x0 + 0.35 + i * 0.55, cy + mode * 0.76, 0, -mode); chair(x0 + 0.35 + i * 0.55, cy - mode * 0.76, 0, mode); }
    }
  };
  const bordY = (cx, y0) => {
    const x0 = cx - 0.38, x1 = cx + 0.38, y1 = y0 + 1.8, zt = 0.74, zb = 0.16;
    const sv = poly([[x0, y1, zb], [x1, y1, zb], [x1, y1, zt], [x0, y1, zt]], '#F0EFE5')
      + poly([[x1, y0, zb], [x1, y1, zb], [x1, y1, zt], [x1, y0, zt]], '#E6E5DA')
      + poly([[x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]], '#FFFFFF', edge);
    items.push({ d: dep(cx, y0 + 0.9), s: sv });
    for (let i = 0; i < 3; i++) chair(cx - 0.76, y0 + 0.31 + i * 0.55, 1, 0);
  };
  const rundbord = (cx, cy) => {
    const r = 0.72, c1 = pt(cx, cy, 0.74), c2 = pt(cx, cy, 0.18);
    const rx = (1.22 * r * s).toFixed(1), ry = (0.7 * r * s).toFixed(1);
    let sv = '<ellipse cx="' + c2[0].toFixed(1) + '" cy="' + c2[1].toFixed(1) + '" rx="' + rx + '" ry="' + ry + '" fill="#E6E5DA"/>';
    sv += '<rect x="' + (c1[0] - 1.22 * r * s).toFixed(1) + '" y="' + c1[1].toFixed(1) +
      '" width="' + (2.44 * r * s).toFixed(1) + '" height="' + (c2[1] - c1[1]).toFixed(1) + '" fill="#F0EFE5"/>';
    sv += '<ellipse cx="' + c1[0].toFixed(1) + '" cy="' + c1[1].toFixed(1) + '" rx="' + rx + '" ry="' + ry +
      '" fill="#FFFFFF" stroke="#D8D7CB" stroke-width="0.8"/>';
    items.push({ d: dep(cx, cy), s: sv });
    for (let a = 0; a < 8; a++) {
      const th = a * Math.PI / 4 + 0.4;
      chair(cx + Math.cos(th) * 1.15, cy + Math.sin(th) * 1.02, -Math.cos(th), -Math.sin(th));
    }
  };

  const nB = nBord || 4;
  if (bt === 'rund') {
    for (let i = 0; i < nB; i++) rundbord(Ld * (i + 1) / (nB + 1), i % 2 === 0 ? 1.75 : Wd - 1.75);
  } else if (hs) {
    const legN = Math.max(1, Math.floor((nB - 2) / 2));
    bordY(1.05, cy0 - 1.86);
    bordY(1.05, cy0 + 0.06);
    const ly1 = 1.12, ly2 = Wd - 1.12;
    let x = 1.55;
    for (let i = 0; i < legN; i++) {
      const inn = legN >= 3 && i === 0 ? 2 : 3;
      bordX(x, ly1, -1, inn);
      bordX(x, ly2, 1, inn);
      x += 1.88;
    }
  } else {
    let cols;
    if (Wd < 4.5) { cols = [[nB, cy0]]; }
    else {
      const a2 = Math.ceil(nB / 2), b2 = nB - a2;
      cols = b2 > 0 ? [[a2, 1.5], [b2, Wd - 1.5]] : [[a2, cy0]];
    }
    cols.forEach(c => {
      const k = c[0];
      let x = (Ld - (k * 1.8 + (k - 1) * 0.08)) / 2;
      for (let i = 0; i < k; i++) { bordX(x, c[1], 2); x += 1.88; }
      if (ends) chair(x + 0.34, c[1], -1, 0);
    });
  }

  items.sort((a, b) => a.d - b.d);
  svg += items.map(i => i.s).join('');
  post.sort((a, b) => a.d - b.d);
  svg += post.map(i => i.s).join('');
  svg += ln([0, cy0, H], [Ld, cy0, H], '#CFD6CC', 1.4);

  let path = '', lp = '';
  const segs = Math.max(3, Math.round(Ld / 1.9));
  for (let i = 0; i < segs; i++) {
    const xa = 0.25 + (Ld - 0.5) * i / segs, xb = 0.25 + (Ld - 0.5) * (i + 1) / segs;
    const a = pt(xa, cy0, H - 0.05), b = pt(xb, cy0, H - 0.05), m = pt((xa + xb) / 2, cy0, H - 0.4);
    path += (i === 0 ? 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) : '') +
      ' Q' + m[0].toFixed(1) + ' ' + m[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    for (let j = 1; j <= 3; j++) {
      const t = j / 4, xq = xa + (xb - xa) * t, zq = H - 0.05 - Math.sin(Math.PI * t) * 0.3;
      lp += cir(xq, cy0, zq, 3.6, '#FFDE9E', 0.35) + cir(xq, cy0, zq, 1.6, '#F0B44A');
    }
  }
  svg += '<path d="' + path + '" fill="none" stroke="#CBA24E" stroke-width="1"/>' + lp;

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 280" role="img">' + svg + '</svg>';
}
