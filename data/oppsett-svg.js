/* ===========================================================================
   «Slik kan det se ut» – 3D-tegning av hele handlekurven.

   Tegner teltet med gulv, duker, bord, stoler og ståbord plassert inni
   etter hvor mye plass teltet faktisk har. Det som ikke får plass står
   sammenklappet ved siden av teltet.

   Kameraet styres fritt: kam = { az, elev, zoom, panX, panY }
     az      rotasjon rundt teltet, i radianer
     elev    hvor høyt man ser fra: 0.18 (fra siden) – 0.92 (rett ovenfra)
     zoom    1 = tilpasset rammen
     panX/Y  forskyvning i piksler
   ======================================================================== */

/* Teltenes gulvflate i meter. Må stemme med produktene i produkter.js. */
const TELT = {
  t33: [3, 3], t36: [6, 3], t38: [8, 3], t56: [6, 5], t58: [8, 5], t510: [10, 5]
};

const MAL = {
  kbord: [1.8, 0.75],
  trebord: [1.97, 0.6],
  rbord: [1.5, 1.5],
  stabord: [0.8, 0.8]
};

/* Fargepalett – i samme toner som resten av nettstedet */
const F = {
  gressMork: '#D6E0C8',
  dukSkygge: '#EDF0E4', dukFront: 'rgba(255,255,255,0.4)',
  kant: '#D5DBCE', stang: '#B9C2BA', stangMork: '#8A968D',
  tre: '#D9C6A0', treMork: '#C2AC84', treStripe: '#CBB791',
  plate: '#FFFFFF', plateSide: '#EAE9DE', plateKant: '#D3D2C6',
  duk: '#F7F6EF', dukKant: '#E2E0D2',
  stol: '#FCFCF8', stolKant: '#C9C8BC', stolRygg: '#F0F0E6',
  metall: '#C8CCC6',
  skygge: 'rgba(90,110,95,0.15)',
  lys: '#F5B942', lysGlod: '#FFE7A8'
};

/** Projeksjon og tegneprimitiver for en scene med gitt utstrekning og kamera. */
function lagScene(minX, maksX, minY, maksY, kam) {
  const az = kam.az || 0;
  const elev = Math.max(0.18, Math.min(0.92, kam.elev ?? 0.5));
  const zoom = Math.max(0.5, Math.min(4, kam.zoom || 1));

  const cx0 = (minX + maksX) / 2, cy0 = (minY + maksY) / 2;
  const ca = Math.cos(az), sa = Math.sin(az);
  const rot = (x, y) => {
    const dx = x - cx0, dy = y - cy0;
    return [cx0 + dx * ca - dy * sa, cy0 + dx * sa + dy * ca];
  };

  // Jo høyere man ser fra, jo mindre teller høyden på tvers av bildet
  const kFlat = elev;
  const kHoyde = 1.18 - elev * 0.34;
  const yStrekk = kFlat / 0.5;          // ellipser flates ut i samme takt

  let minXu = 1e9, maksXu = -1e9, minYu = 1e9, maksYu = -1e9;
  [[minX, minY], [maksX, minY], [maksX, maksY], [minX, maksY]].forEach(c => {
    const r = rot(c[0], c[1]);
    const X = (r[0] - r[1]) * 0.866, Y = (r[0] + r[1]) * kFlat;
    if (X < minXu) minXu = X;
    if (X > maksXu) maksXu = X;
    if (Y < minYu) minYu = Y;
    if (Y > maksYu) maksYu = Y;
  });
  minYu -= 3.4 * kHoyde;                // plass til telttoppen

  // Rammen er fast, slik at seksjonen på siden ikke hopper i høyde når
  // man snur eller zoomer. Innholdet skaleres for å passe inn i den.
  const bU = maksXu - minXu, hU = maksYu - minYu;
  const MARG = 20, RAMME_B = 880, RAMME_H = 470;
  const s0 = Math.min((RAMME_B - MARG * 2) / bU, (RAMME_H - MARG * 2) / hU);
  const s = s0 * zoom;

  const ox = RAMME_B / 2 - (minXu + maksXu) / 2 * s + (kam.panX || 0);
  const oy = RAMME_H / 2 - (minYu + maksYu) / 2 * s + (kam.panY || 0);

  const pt = (x, y, z) => {
    const r = rot(x, y);
    return [(r[0] - r[1]) * 0.866 * s + ox, (r[0] + r[1]) * kFlat * s - (z || 0) * kHoyde * s + oy];
  };
  const dep = (x, y) => { const r = rot(x, y); return r[0] + r[1]; };
  const P = (x, y, z) => { const q = pt(x, y, z); return q[0].toFixed(1) + ',' + q[1].toFixed(1); };
  const poly = (pts, fill, o) =>
    `<polygon points="${pts.map(a => P(a[0], a[1], a[2])).join(' ')}" fill="${fill}" ${o || ''}/>`;
  const ln = (a, b, st, w) => {
    const p = pt(a[0], a[1], a[2]), q = pt(b[0], b[1], b[2]);
    return `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${st}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const cir = (x, y, z, r, fill, op) => {
    const q = pt(x, y, z);
    return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${r}" fill="${fill}"${op ? ` opacity="${op}"` : ''}/>`;
  };
  const ell = (x, y, z, rx, ry, fill, o) => {
    const q = pt(x, y, z);
    return `<ellipse cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" rx="${(rx * s).toFixed(1)}" ry="${(ry * s * yStrekk).toFixed(1)}" fill="${fill}" ${o || ''}/>`;
  };
  /** Sylinderform mellom to høyder – brukes til duker som henger ned */
  const skjort = (x, y, zTopp, zBunn, rTopp, rBunn, fill) => {
    const t = pt(x, y, zTopp), b = pt(x, y, zBunn);
    const rxT = (rTopp * s).toFixed(1), rxB = (rBunn * s).toFixed(1);
    const ryB = (rBunn * 0.58 * s * yStrekk).toFixed(1);
    return `<path d="M${(t[0] - rTopp * s).toFixed(1)} ${t[1].toFixed(1)} L${(b[0] - rBunn * s).toFixed(1)} ${b[1].toFixed(1)} A${rxB} ${ryB} 0 0 0 ${(b[0] + rBunn * s).toFixed(1)} ${b[1].toFixed(1)} L${(t[0] + rTopp * s).toFixed(1)} ${t[1].toFixed(1)} Z" fill="${fill}"/>`;
  };
  const skygge = (x, y, rx, ry) => ell(x, y, 0.004, rx, ry, F.skygge);
  /** Liten tallbrikke som viser hvor mange enheter en stabel består av */
  const etikett = (x, y, z, tekst) => {
    const p = pt(x, y, z);
    const b = 7.2 * tekst.length + 16;
    return `<g><rect x="${(p[0] - b / 2).toFixed(1)}" y="${(p[1] - 21).toFixed(1)}" width="${b.toFixed(1)}" height="19" rx="9.5" fill="rgba(17,59,63,0.82)"/>`
      + `<text x="${p[0].toFixed(1)}" y="${(p[1] - 7.5).toFixed(1)}" text-anchor="middle" font-family="Schibsted Grotesk, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff">${tekst}</text></g>`;
  };

  return { pt, dep, poly, ln, cir, ell, skjort, skygge, etikett, s, yStrekk, RAMME_B, RAMME_H };
}

/** Hvor mange bord av en gitt type får plass i et telt. */
export function kapasitet(teltId, bordType) {
  const dim = TELT[teltId];
  if (!dim) return 0;
  const [Ld, Wd] = dim;
  const mal = MAL[bordType];
  if (!mal) return 0;

  if (bordType === 'rbord') {
    return Math.max(0, Math.floor((Ld - 0.4) / 2.6) * (Wd >= 5 ? 2 : 1));
  }
  if (bordType === 'stabord') {
    return Math.max(0, Math.floor((Ld - 0.4) / 1.5) * Math.max(1, Math.floor(Wd / 2.2)));
  }
  return Math.max(0, Math.floor((Ld - 0.6) / (mal[0] + 0.1)) * (Wd >= 4.5 ? 2 : 1));
}

export function oppsettSvg(kurv, finn, kam = {}) {
  const q = (id) => kurv[id] || 0;

  const teltIder = Object.keys(TELT).filter(id => q(id) > 0);
  const teltId = teltIder.sort((a, b) => (TELT[b][0] * TELT[b][1]) - (TELT[a][0] * TELT[a][1]))[0] || null;

  let Ld, Wd;
  if (teltId) {
    [Ld, Wd] = TELT[teltId];
  } else {
    const bord = q('kbord') + q('trebord') + q('rbord') + q('stabord');
    Ld = Math.max(6, Math.min(14, 3 + bord * 1.1));
    Wd = 5;
  }

  /* --- fordel møbler mellom teltet og plassen ved siden --- */
  const plan = {};
  ['kbord', 'trebord', 'rbord', 'stabord'].forEach(type => {
    const n = q(type);
    if (!teltId) { plan[type] = { inne: n, ute: 0 }; return; }
    const plass = kapasitet(teltId, type);
    plan[type] = { inne: Math.min(n, plass), ute: Math.max(0, n - plass) };
  });

  const bruktAndel = !teltId ? 0 : ['kbord', 'trebord', 'rbord', 'stabord'].reduce((a, t) => {
    const kap = kapasitet(teltId, t);
    return a + (kap ? plan[t].inne / kap : 0);
  }, 0);
  if (bruktAndel > 1) {
    ['kbord', 'trebord', 'rbord', 'stabord'].forEach(t => {
      const ny = Math.floor(plan[t].inne / bruktAndel);
      plan[t].ute += plan[t].inne - ny;
      plan[t].inne = ny;
    });
  }

  let stolerIgjen = q('stol');
  let benkerIgjen = q('trebenk');
  let dukerIgjen = q('duk');
  let runddukIgjen = q('rundduk');
  let stadukIgjen = q('staduk-hvit') + q('staduk-sort');

  const harStabel = plan.kbord.ute + plan.trebord.ute + plan.rbord.ute + plan.stabord.ute > 0;
  const lagerBredde = harStabel || stolerIgjen > 0 ? 3.8 : 0;

  const S = lagScene(-1.3, Ld + 1.3 + lagerBredde, -1.3, Wd + 1.3, kam);
  const { pt, dep, poly, ln, cir, ell, skjort, skygge, etikett, s, yStrekk, RAMME_B, RAMME_H } = S;
  const Cd = dep(Ld / 2, Wd / 2);

  const bak = [], midt = [], foran = [];
  let svg = '';

  /* --- gressplen som dekker hele flaten --- */
  svg += `<rect x="0" y="0" width="${RAMME_B}" height="${RAMME_H}" fill="url(#gress)"/>`;
  svg += `<rect x="0" y="0" width="${RAMME_B}" height="${RAMME_H}" fill="url(#stra)"/>`;

  /* --- teltgulv og tregulv --- */
  const gulvKvm = q('gulv') * 2;
  if (teltId) {
    svg += poly([[-0.4, -0.4, 0], [Ld + 0.4, -0.4, 0], [Ld + 0.4, Wd + 0.4, 0], [-0.4, Wd + 0.4, 0]],
                'rgba(150,170,140,0.22)');
  }

  // Gulv kan leies uten telt, så det tegnes uavhengig av om det står et telt.
  // Med telt dekker det en andel av teltflaten; uten telt legges det som et
  // felt midt på plassen, med den flaten kunden faktisk har kjøpt.
  let dekket = 0, gLd = 0, gWd = Wd, gY0 = 0, gX0 = 0;
  if (gulvKvm > 0) {
    if (teltId) {
      dekket = Math.min(1, gulvKvm / (Ld * Wd));
      gLd = Ld * dekket;
    } else {
      gWd = Math.min(Wd, Math.max(2, Math.sqrt(gulvKvm * 0.6)));
      gLd = Math.min(Ld, gulvKvm / gWd);
      gY0 = (Wd - gWd) / 2;
      gX0 = (Ld - gLd) / 2;          // sentrer gulvet under møblene
      dekket = 1;
    }
  }
  if (gLd > 0) {
    const gY1 = gY0 + gWd, gX1 = gX0 + gLd;
    svg += poly([[gX0, gY0, 0.08], [gX1, gY0, 0.08], [gX1, gY1, 0.08], [gX0, gY1, 0.08]], F.tre, `stroke="${F.treMork}" stroke-width="0.9"`);
    for (let x = gX0 + 0.45; x < gX1 - 0.05; x += 0.45) svg += ln([x, gY0, 0.085], [x, gY1, 0.085], F.treStripe, 0.7);
    svg += poly([[gX0, gY1, 0], [gX1, gY1, 0], [gX1, gY1, 0.08], [gX0, gY1, 0.08]], F.treMork);
    svg += poly([[gX1, gY0, 0], [gX1, gY1, 0], [gX1, gY1, 0.08], [gX1, gY0, 0.08]], F.treMork);
  }

  /* --- telt --- */
  const h = 2, H = 3;
  if (teltId) {
    const stolpe = (x, y, hoyde, tykk) =>
      ell(x, y, 0.004, 0.14, 0.08, F.skygge) + ln([x, y, 0], [x, y, hoyde], F.stang, tykk);

    [[0, 0], [Ld, 0], [Ld, Wd], [0, Wd]].forEach(c => {
      const ux = c[0] === 0 ? -0.9 : 0.9, uy = c[1] === 0 ? -0.9 : 0.9;
      const g = ln([c[0], c[1], h], [c[0] + ux, c[1] + uy, 0.1], F.stang, 1.4)
        + ln([c[0] + ux, c[1] + uy, 0], [c[0] + ux, c[1] + uy, 0.34], F.stangMork, 3.2)
        + stolpe(c[0], c[1], h, 2.8);
      (dep(c[0], c[1]) <= Cd ? bak : foran).push({ d: dep(c[0], c[1]), s: g });
    });

    const seksjoner = Math.max(1, Math.round(Ld / 3));
    for (let i = 1; i < seksjoner; i++) {
      const x = Ld * i / seksjoner;
      [0, Wd].forEach(y => {
        (dep(x, y) <= Cd ? bak : foran).push({ d: dep(x, y), s: stolpe(x, y, h, 2.1) });
      });
    }

    const takFyll = q('lining') > 0 ? 'url(#lining)' : 'url(#duk)';
    [
      { p: [[0, 0, h], [Ld, 0, h], [Ld, Wd / 2, H], [0, Wd / 2, H]], c: [Ld / 2, Wd * 0.25], f: takFyll },
      { p: [[0, Wd, h], [Ld, Wd, h], [Ld, Wd / 2, H], [0, Wd / 2, H]], c: [Ld / 2, Wd * 0.75], f: takFyll },
      { p: [[0, 0, h], [0, Wd, h], [0, Wd / 2, H]], c: [0.01, Wd / 2], f: F.dukSkygge },
      { p: [[Ld, 0, h], [Ld, Wd, h], [Ld, Wd / 2, H]], c: [Ld - 0.01, Wd / 2], f: F.dukSkygge }
    ].forEach(f => {
      const d = dep(f.c[0], f.c[1]);
      if (d <= Cd) bak.push({ d, s: poly(f.p, f.f, `stroke="${F.kant}" stroke-width="1"`) });
      else foran.push({ d, s: poly(f.p, F.dukFront, `stroke="${F.kant}" stroke-width="0.9"`) });
    });
  }

  bak.sort((a, b) => a.d - b.d);
  svg += bak.map(i => i.s).join('');

  /* ================= møbler ================= */
  const kant = `stroke="${F.plateKant}" stroke-width="0.8"`;

  const stol = (cx, cy, fx, fy) => {
    const bx = cx - fx * 0.18, by = cy - fy * 0.18, px = -fy, py = fx;
    let g = skygge(cx, cy, 0.23, 0.14);
    [[-0.14, -0.14], [0.14, -0.14], [0.14, 0.14], [-0.14, 0.14]].forEach(o => {
      g += ln([cx + o[0], cy + o[1], 0], [cx + o[0], cy + o[1], 0.44], F.stolKant, 1);
    });
    const sete = ell(cx, cy, 0.46, 0.21, 0.12, F.stol, `stroke="${F.stolKant}" stroke-width="0.9"`);
    const rygg = poly([
      [bx - px * 0.17, by - py * 0.17, 0.5], [bx + px * 0.17, by + py * 0.17, 0.5],
      [bx + px * 0.17, by + py * 0.17, 0.95], [bx - px * 0.17, by - py * 0.17, 0.95]
    ], F.stolRygg, `stroke="${F.stolKant}" stroke-width="0.9" stroke-linejoin="round"`);
    midt.push({ d: dep(cx, cy), s: g + (dep(bx, by) > dep(cx, cy) ? sete + rygg : rygg + sete) });
  };

  const avlangtBord = (x0, cy, L, B, plate, medDuk) => {
    const y0 = cy - B / 2, y1 = cy + B / 2, x1 = x0 + L, zt = 0.74;
    let g = skygge(x0 + L / 2, cy, L * 0.55, B * 0.6);
    [[x0 + 0.14, y0 + 0.1], [x1 - 0.14, y0 + 0.1], [x0 + 0.14, y1 - 0.1], [x1 - 0.14, y1 - 0.1]].forEach(o => {
      g += ln([o[0], o[1], 0], [o[0], o[1], zt], F.plateKant, 1.1);
    });
    if (medDuk) {
      // Duken henger ned på alle fire sider. Sidene sorteres etter dybde slik
      // at de riktige er synlige uansett hvilken vei tegningen er snudd.
      const o = 0.09, zb = 0.3;
      const a0 = x0 - o, a1 = x1 + o, b0 = y0 - o, b1 = y1 + o;
      [
        { p: [[a0, b1, zb], [a1, b1, zb], [a1, b1, zt], [a0, b1, zt]], d: dep((a0 + a1) / 2, b1), f: F.duk },
        { p: [[a0, b0, zb], [a1, b0, zb], [a1, b0, zt], [a0, b0, zt]], d: dep((a0 + a1) / 2, b0), f: F.duk },
        { p: [[a1, b0, zb], [a1, b1, zb], [a1, b1, zt], [a1, b0, zt]], d: dep(a1, cy), f: '#F1F0E7' },
        { p: [[a0, b0, zb], [a0, b1, zb], [a0, b1, zt], [a0, b0, zt]], d: dep(a0, cy), f: '#F1F0E7' }
      ].sort((p, r) => p.d - r.d)
       .forEach(side => { g += poly(side.p, side.f, `stroke="${F.dukKant}" stroke-width="0.7"`); });
      g += poly([[a0, b0, zt], [a1, b0, zt], [a1, b1, zt], [a0, b1, zt]], F.duk, `stroke="${F.dukKant}" stroke-width="0.8"`);
    } else {
      g += poly([[x0, y1, 0.6], [x1, y1, 0.6], [x1, y1, zt], [x0, y1, zt]], F.plateSide);
      g += poly([[x1, y0, 0.6], [x1, y1, 0.6], [x1, y1, zt], [x1, y0, zt]], F.plateKant);
      g += poly([[x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]], plate, kant);
    }
    midt.push({ d: dep(x0 + L / 2, cy), s: g });
  };

  const rundtBord = (cx, cy, medDuk) => {
    const r = 0.75, zt = 0.74;
    let g = skygge(cx, cy, r * 1.15, r * 0.7);
    g += ln([cx, cy, 0], [cx, cy, zt], F.plateKant, 2);
    g += medDuk
      ? skjort(cx, cy, zt, 0.22, r * 1.18, r * 1.24, F.duk)
      : skjort(cx, cy, zt, 0.6, r * 1.18, r * 1.18, F.plateSide);
    g += ell(cx, cy, zt, r * 1.18, r * 0.68, medDuk ? F.duk : F.plate, `stroke="${medDuk ? F.dukKant : F.plateKant}" stroke-width="0.8"`);
    midt.push({ d: dep(cx, cy), s: g });
  };

  const staaBord = (cx, cy, medDuk) => {
    const zt = 1.1;
    let g = skygge(cx, cy, 0.42, 0.26);
    g += ell(cx, cy, 0.04, 0.3, 0.17, F.metall);
    g += medDuk
      ? skjort(cx, cy, zt, 0.08, 0.47, 0.4, F.duk)
      : ln([cx, cy, 0.04], [cx, cy, zt], F.metall, 2.4);
    g += ell(cx, cy, zt, 0.47, 0.27, medDuk ? F.duk : F.plate, `stroke="${medDuk ? F.dukKant : F.plateKant}" stroke-width="0.8"`);
    midt.push({ d: dep(cx, cy), s: g });
  };

  const benk = (x0, cy, L) => {
    const y0 = cy - 0.15, y1 = cy + 0.15, x1 = x0 + L, zt = 0.46;
    let g = skygge(x0 + L / 2, cy, L * 0.5, 0.2);
    [[x0 + 0.18, cy], [x1 - 0.18, cy]].forEach(o => {
      g += ln([o[0], o[1], 0], [o[0], o[1], zt], F.treMork, 1.6);
    });
    g += poly([[x0, y1, zt - 0.07], [x1, y1, zt - 0.07], [x1, y1, zt], [x0, y1, zt]], F.treMork);
    g += poly([[x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]], '#C9B896', kant);
    midt.push({ d: dep(x0 + L / 2, cy), s: g });
  };

  /* --- plassering inne i teltet --- */
  const radY = (rader) => rader === 1 ? [Wd / 2] : [Wd * 0.28, Wd * 0.72];

  [['kbord', 1.8, 0.75, F.plate], ['trebord', 1.97, 0.6, '#E8DCC2']].forEach(([type, L, B, plate]) => {
    const n = plan[type].inne;
    if (!n) return;
    const rader = Wd >= 4.5 ? 2 : 1;
    const perRad = Math.ceil(n / rader);
    let lagt = 0;
    radY(rader).forEach(cy => {
      const iRad = Math.min(perRad, n - lagt);
      if (iRad <= 0) return;
      const total = iRad * L + (iRad - 1) * 0.12;
      let x = (Ld - total) / 2;
      for (let i = 0; i < iRad; i++) {
        const medDuk = type === 'kbord' && dukerIgjen > 0;
        if (medDuk) dukerIgjen--;
        avlangtBord(x, cy, L, B, plate, medDuk);
        if (type === 'trebord') {
          if (benkerIgjen > 0) { benk(x, cy - B / 2 - 0.52, L); benkerIgjen--; }
          if (benkerIgjen > 0) { benk(x, cy + B / 2 + 0.52, L); benkerIgjen--; }
        } else {
          for (let k = 0; k < 3 && stolerIgjen > 0; k++) { stol(x + 0.35 + k * 0.55, cy - B / 2 - 0.44, 0, 1); stolerIgjen--; }
          for (let k = 0; k < 3 && stolerIgjen > 0; k++) { stol(x + 0.35 + k * 0.55, cy + B / 2 + 0.44, 0, -1); stolerIgjen--; }
        }
        x += L + 0.12;
        lagt++;
      }
    });
  });

  if (plan.rbord.inne) {
    const n = plan.rbord.inne;
    const rader = Wd >= 5 ? 2 : 1;
    const perRad = Math.ceil(n / rader);
    let lagt = 0;
    radY(rader).forEach(cy => {
      const iRad = Math.min(perRad, n - lagt);
      if (iRad <= 0) return;
      for (let i = 0; i < iRad; i++) {
        const cx = Ld * (i + 1) / (iRad + 1);
        const medDuk = runddukIgjen > 0;
        if (medDuk) runddukIgjen--;
        rundtBord(cx, cy, medDuk);
        for (let a = 0; a < 8 && stolerIgjen > 0; a++) {
          const th = a * Math.PI / 4 + 0.4;
          stol(cx + Math.cos(th) * 1.22, cy + Math.sin(th) * 1.08, -Math.cos(th), -Math.sin(th));
          stolerIgjen--;
        }
        lagt++;
      }
    });
  }

  if (plan.stabord.inne) {
    const harAndre = plan.kbord.inne + plan.trebord.inne + plan.rbord.inne > 0;
    const perRad = Math.max(1, Math.floor((Ld - 1.2) / 1.5));
    for (let i = 0; i < plan.stabord.inne; i++) {
      const kol = i % perRad, rad = Math.floor(i / perRad);
      const cx = Math.min(0.9 + kol * 1.5, Ld - 0.6);
      const cy = harAndre ? (rad % 2 === 0 ? 0.55 : Wd - 0.55) : Wd * (rad % 2 === 0 ? 0.32 : 0.68);
      staaBord(cx, cy, stadukIgjen-- > 0);
    }
  }

  /* --- det som står sammenklappet ved siden --- */
  const notater = [];
  const merker = [];
  if (teltId && (harStabel || stolerIgjen > 0 || benkerIgjen > 0)) {
    const lagerX = Ld + 1.7, lagerY = Wd / 2;

    const stabelBord = (x, y, antall, L, B, plate, z0) => {
      midt.push({ d: dep(x + L / 2, y) - 0.6, s: skygge(x + L / 2, y, L * 0.58, B * 0.7) });
      for (let i = 0; i < Math.min(antall, 8); i++) {
        const z = z0 + i * 0.1;
        midt.push({
          d: dep(x + L / 2, y) + i * 0.001,
          s: poly([[x, y + B / 2, z - 0.09], [x + L, y + B / 2, z - 0.09], [x + L, y + B / 2, z], [x, y + B / 2, z]], F.plateKant)
            + poly([[x, y - B / 2, z], [x + L, y - B / 2, z], [x + L, y + B / 2, z], [x, y + B / 2, z]], plate, kant)
        });
      }
    };

    if (plan.kbord.ute) {
      stabelBord(lagerX, lagerY - 1.2, plan.kbord.ute, 1.8, 0.75, F.plate, 0.06);
      merker.push({ x: lagerX + 0.9, y: lagerY - 1.2, z: 0.06 + Math.min(plan.kbord.ute, 8) * 0.1, t: `${plan.kbord.ute} bord` });
      notater.push(`${plan.kbord.ute} avlange bord`);
    }
    if (plan.trebord.ute) {
      const z0 = 0.06 + Math.min(plan.kbord.ute, 8) * 0.1;
      stabelBord(lagerX, lagerY - 1.2, plan.trebord.ute, 1.97, 0.6, '#E8DCC2', z0);
      merker.push({ x: lagerX + 1, y: lagerY - 1.2, z: z0 + Math.min(plan.trebord.ute, 8) * 0.1, t: `${plan.trebord.ute} trebord` });
      notater.push(`${plan.trebord.ute} trebord`);
    }
    if (plan.rbord.ute) {
      midt.push({ d: dep(lagerX + 0.8, lagerY + 0.9) - 0.6, s: skygge(lagerX + 0.8, lagerY + 0.9, 0.9, 0.32) });
      for (let i = 0; i < Math.min(plan.rbord.ute, 6); i++) {
        const x = lagerX + 0.45 + i * 0.17;
        midt.push({ d: dep(x, lagerY + 0.9) + i * 0.001, s: ell(x, lagerY + 0.9, 0.8, 0.13, 0.78, F.plate, `stroke="${F.plateKant}" stroke-width="0.8"`) });
      }
      merker.push({ x: lagerX + 0.9, y: lagerY + 0.9, z: 1.6, t: `${plan.rbord.ute} runde bord` });
      notater.push(`${plan.rbord.ute} runde bord`);
    }
    if (plan.stabord.ute) {
      for (let i = 0; i < Math.min(plan.stabord.ute, 6); i++) staaBord(lagerX + 0.5 + i * 0.7, lagerY + 1.7, false);
      merker.push({ x: lagerX + 1.2, y: lagerY + 1.7, z: 1.2, t: `${plan.stabord.ute} ståbord` });
      notater.push(`${plan.stabord.ute} ståbord`);
    }
    if (stolerIgjen > 0) {
      // Sammenklappede stoler står lent mot hverandre i rader, ikke som en pølse
      const perStabel = 6;
      const stabler = Math.min(3, Math.ceil(stolerIgjen / perStabel));
      for (let st = 0; st < stabler; st++) {
        const sx = lagerX + 2.5, sy = lagerY - 0.9 + st * 0.85;
        const iStabel = Math.min(perStabel, stolerIgjen - st * perStabel);
        midt.push({ d: dep(sx + 0.3, sy) - 0.6, s: skygge(sx + 0.3, sy, 0.5, 0.22) });
        for (let i = 0; i < iStabel; i++) {
          const x = sx + i * 0.1;
          const rygg = poly([[x, sy - 0.2, 0.06], [x + 0.05, sy + 0.2, 0.06],
                             [x + 0.05, sy + 0.2, 0.92], [x, sy - 0.2, 0.92]],
                            F.stolRygg, `stroke="${F.stolKant}" stroke-width="0.8" stroke-linejoin="round"`);
          const sete = poly([[x - 0.16, sy - 0.19, 0.42], [x + 0.16, sy - 0.19, 0.42],
                             [x + 0.16, sy + 0.19, 0.42], [x - 0.16, sy + 0.19, 0.42]],
                            F.stol, `stroke="${F.stolKant}" stroke-width="0.7"`);
          midt.push({ d: dep(x, sy) + i * 0.002, s: sete + rygg });
        }
      }
      merker.push({ x: lagerX + 2.8, y: lagerY - 0.9, z: 1.05, t: `${stolerIgjen} stoler` });
      notater.push(`${stolerIgjen} stoler`);
    }
    if (benkerIgjen > 0) {
      for (let i = 0; i < Math.min(benkerIgjen, 6); i++) benk(lagerX + 0.2, lagerY + 2.3 + i * 0.26, 1.97);
      merker.push({ x: lagerX + 1.2, y: lagerY + 2.4, z: 0.7, t: `${benkerIgjen} benker` });
      notater.push(`${benkerIgjen} benker`);
    }
  }

  midt.sort((a, b) => a.d - b.d);
  svg += midt.map(i => i.s).join('');

  foran.sort((a, b) => a.d - b.d);
  svg += foran.map(i => i.s).join('');

  /* --- lysslynge --- */
  if (teltId && q('lys') > 0) {
    svg += ln([0, Wd / 2, H], [Ld, Wd / 2, H], '#CFD6CC', 1.4);
    let path = '', lp = '';
    const segs = Math.max(3, Math.round(Ld / 1.9));
    for (let i = 0; i < segs; i++) {
      const xa = 0.25 + (Ld - 0.5) * i / segs, xb = 0.25 + (Ld - 0.5) * (i + 1) / segs;
      const a = pt(xa, Wd / 2, H - 0.05), b = pt(xb, Wd / 2, H - 0.05), m = pt((xa + xb) / 2, Wd / 2, H - 0.42);
      path += (i === 0 ? `M${a[0].toFixed(1)} ${a[1].toFixed(1)}` : '') +
        ` Q${m[0].toFixed(1)} ${m[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
      for (let j = 1; j <= 3; j++) {
        const t = j / 4, xq = xa + (xb - xa) * t, zq = H - 0.05 - Math.sin(Math.PI * t) * 0.32;
        lp += cir(xq, Wd / 2, zq, 4.4, F.lysGlod, 0.4) + cir(xq, Wd / 2, zq, 1.8, F.lys);
      }
    }
    svg += `<path d="${path}" fill="none" stroke="#C9A45C" stroke-width="1"/>` + lp;
  }

  merker.forEach(m => { svg += etikett(m.x, m.y, m.z, m.t); });

  const defs = `<defs>
    <linearGradient id="gress" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#E6EDDC"/><stop offset="100%" stop-color="#CFDBBE"/>
    </linearGradient>
    <pattern id="stra" width="34" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(-11)">
      <path d="M5 27 q1 -5 0.4 -8 M17 29 q-1 -4 -0.3 -7 M27 26 q1.2 -5 0.6 -8"
            stroke="#C6D4B1" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.3"/>
    </pattern>
    <linearGradient id="duk" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#FDFEFA"/><stop offset="100%" stop-color="#E9EDE0"/>
    </linearGradient>
    <linearGradient id="lining" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#F3F6EC"/>
    </linearGradient>
  </defs>`;

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RAMME_B} ${RAMME_H}" role="img"><title>Slik kan oppsettet se ut</title>${defs}${svg}</svg>`,
    teltId, plan, stolerUte: stolerIgjen, benkerUte: benkerIgjen, notater,
    gulvdekning: dekket
  };
}
