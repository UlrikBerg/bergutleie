/* ===========================================================================
   «Slik kan det se ut» – isometrisk tegning av hele handlekurven.

   Tar innholdet i kurven og tegner teltet med bord, stoler og ståbord
   plassert inni. Det som ikke får plass, settes sammenklappet i stabler
   ved siden av teltet, slik det ville stått på plassen i virkeligheten.

   Samme visuelle språk som pakketegningene på /selskapspakker/, men her
   styres oppsettet av hva kunden faktisk har lagt i kurven.
   ======================================================================== */

/* Teltenes gulvflate i meter. Må stemme med produktene i produkter.js. */
const TELT = {
  t36: [6, 3], t38: [8, 3], t56: [6, 5], t58: [8, 5], t510: [10, 5]
};

/* Møbelmål i meter: [lengde, bredde] */
const MAL = {
  kbord: [1.8, 0.75],    // avlangt bord
  trebord: [1.97, 0.6],  // trebord i benkesett
  rbord: [1.5, 1.5],     // rundt bord, diameter
  stabord: [0.8, 0.8]    // ståbord, diameter
};

/** Bygger projeksjonen og tegneprimitivene for en scene av gitt utstrekning. */
function lagScene(minX, maksX, minY, maksY, ang) {
  const cx0 = (minX + maksX) / 2, cy0 = (minY + maksY) / 2;
  const ca = Math.cos(ang || 0), sa = Math.sin(ang || 0);
  const rot = (x, y) => {
    const dx = x - cx0, dy = y - cy0;
    return [cx0 + dx * ca - dy * sa, cy0 + dx * sa + dy * ca];
  };

  let minXu = 1e9, maksXu = -1e9, minYu = 1e9, maksYu = -1e9;
  [[minX, minY], [maksX, minY], [maksX, maksY], [minX, maksY]].forEach(c => {
    const r = rot(c[0], c[1]);
    const X = (r[0] - r[1]) * 0.866, Y = (r[0] + r[1]) * 0.5;
    if (X < minXu) minXu = X;
    if (X > maksXu) maksXu = X;
    if (Y < minYu) minYu = Y;
    if (Y > maksYu) maksYu = Y;
  });
  minYu -= 3.2;                                  // plass til telttoppen

  // Rammen tilpasser seg innholdet i stedet for omvendt, slik at tegningen
  // alltid fyller flaten uansett hvor bred plassen blir av stablene.
  const bU = maksXu - minXu, hU = maksYu - minYu;
  const MARG = 16;
  let s = (860 - MARG * 2) / bU;
  if (hU * s > 400 - MARG * 2) s = (400 - MARG * 2) / hU;
  const bredde = Math.round(bU * s + MARG * 2);
  const hoyde = Math.round(hU * s + MARG * 2);
  const ox = bredde / 2 - (minXu + maksXu) / 2 * s;
  const oy = hoyde / 2 - (minYu + maksYu) / 2 * s;

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
    return `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${st}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const cir = (x, y, z, r, fill, op) => {
    const q = pt(x, y, z);
    return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${r}" fill="${fill}"${op ? ` opacity="${op}"` : ''}/>`;
  };
  const ell = (x, y, z, rx, ry, fill, o) => {
    const q = pt(x, y, z);
    return `<ellipse cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" rx="${(rx * s).toFixed(1)}" ry="${(ry * s).toFixed(1)}" fill="${fill}" ${o || ''}/>`;
  };
  return { pt, dep, poly, ln, cir, ell, s, cx0, cy0, bredde, hoyde };
}

/** Hvor mange bord av en gitt type får plass i et telt på Ld × Wd meter. */
export function kapasitet(teltId, bordType) {
  const dim = TELT[teltId];
  if (!dim) return 0;
  const [Ld, Wd] = dim;
  const mal = MAL[bordType];
  if (!mal) return 0;

  if (bordType === 'rbord') {
    // Runde bord trenger ~2,6 m i diameter med stoler rundt
    const perRad = Math.floor((Ld - 0.4) / 2.6);
    const rader = Wd >= 5 ? 2 : 1;
    return Math.max(0, perRad * rader);
  }
  if (bordType === 'stabord') {
    const perRad = Math.floor((Ld - 0.4) / 1.5);
    const rader = Math.max(1, Math.floor(Wd / 2.2));
    return Math.max(0, perRad * rader);
  }
  // Avlange bord: rad langs teltets lengde, stoler på begge sider
  const perRad = Math.floor((Ld - 0.6) / (mal[0] + 0.1));
  const rader = Wd >= 4.5 ? 2 : 1;
  return Math.max(0, perRad * rader);
}

/**
 * Tegner hele oppsettet.
 * kurv: { produktId: antall }
 * finn: oppslagsfunksjon for produkter (fra produkter.js)
 */
export function oppsettSvg(kurv, finn, ang = 0) {
  const q = (id) => kurv[id] || 0;

  /* --- velg telt: det største kunden har lagt i kurven --- */
  const teltIder = Object.keys(TELT).filter(id => q(id) > 0);
  const teltId = teltIder.sort((a, b) =>
    (TELT[b][0] * TELT[b][1]) - (TELT[a][0] * TELT[a][1]))[0] || null;
  let Ld, Wd;
  if (teltId) {
    [Ld, Wd] = TELT[teltId];
  } else {
    // Ingen telt: still møblene fritt opp på plassen, uten plassbegrensning
    const bord = q('kbord') + q('trebord') + q('rbord') + q('stabord');
    Ld = Math.max(6, Math.min(14, 3 + bord * 1.1));
    Wd = 5;
  }

  /* --- fordel møbler mellom «inne i teltet» og «stablet ved siden» --- */
  const plan = {};
  ['kbord', 'trebord', 'rbord', 'stabord'].forEach(type => {
    const antall = q(type);
    if (!teltId) { plan[type] = { inne: antall, ute: 0 }; return; }
    const plass = kapasitet(teltId, type);
    plan[type] = { inne: Math.min(antall, plass), ute: Math.max(0, antall - plass) };
  });

  // Bordene deler samme gulv – ta hensyn til at flere typer konkurrerer
  const bruktAndel = !teltId ? 0 : ['kbord', 'trebord', 'rbord', 'stabord'].reduce((a, t) => {
    const kap = kapasitet(teltId, t);
    return a + (kap ? plan[t].inne / kap : 0);
  }, 0);
  if (bruktAndel > 1) {
    // Skaler ned det som får plass, resten havner utenfor
    ['kbord', 'trebord', 'rbord', 'stabord'].forEach(t => {
      const nyInne = Math.floor(plan[t].inne / bruktAndel);
      plan[t].ute += plan[t].inne - nyInne;
      plan[t].inne = nyInne;
    });
  }

  const stolerTotalt = q('stol');
  const benkerTotalt = q('trebenk');

  /* --- hvor mye plass trengs til stabler ved siden av teltet? --- */
  const harStabel = plan.kbord.ute + plan.trebord.ute + plan.rbord.ute + plan.stabord.ute > 0;
  const lagerBredde = harStabel ? 3.4 : 0;

  const S = lagScene(-1.2, Ld + 1.2 + lagerBredde, -1.2, Wd + 1.2, ang);
  const { pt, dep, poly, ln, cir, ell, s, bredde, hoyde } = S;
  const Cd = dep(Ld / 2, Wd / 2);

  let svg = '';
  const bak = [], midt = [], foran = [];

  /* --- bakke --- */
  const gc = pt((Ld + lagerBredde) / 2, Wd / 2, 0);
  svg += `<ellipse cx="${gc[0].toFixed(1)}" cy="${(gc[1] + 4).toFixed(1)}" rx="${((Ld + lagerBredde) * 0.62 * s).toFixed(1)}" ry="${(Wd * 0.44 * s).toFixed(1)}" fill="#E7EDDF"/>`;

  /* --- gulvmoduler dekker så mye av teltflaten som kunden har kjøpt --- */
  const gulvKvm = q('gulv') * 2;
  const teltKvm = Ld * Wd;
  if (teltId) {
    svg += poly([[-0.35, -0.35, 0], [Ld + 0.35, -0.35, 0], [Ld + 0.35, Wd + 0.35, 0], [-0.35, Wd + 0.35, 0]], '#DDE4D4');
    if (gulvKvm > 0) {
      const dekket = Math.min(1, gulvKvm / teltKvm);
      const gLd = Ld * dekket;
      svg += poly([[0, 0, 0.06], [gLd, 0, 0.06], [gLd, Wd, 0.06], [0, Wd, 0.06]], '#D8C9A8', 'stroke="#C4B492" stroke-width="0.8"');
      // bordbord i gulvet
      for (let x = 0.5; x < gLd; x += 0.5) {
        svg += ln([x, 0, 0.065], [x, Wd, 0.065], '#C9B896', 0.6);
      }
    }
  }

  /* --- teltets stolper og duk --- */
  const h = 2, H = 3;
  if (teltId) {
    [[0, 0], [Ld, 0], [Ld, Wd], [0, Wd]].forEach(c => {
      const ux = c[0] === 0 ? -0.85 : 0.85, uy = c[1] === 0 ? -0.85 : 0.85;
      const g = ln([c[0], c[1], h], [c[0] + ux, c[1] + uy, 0.1], '#93A5A0', 1.3)
        + ln([c[0] + ux, c[1] + uy, 0], [c[0] + ux, c[1] + uy, 0.32], '#5C6B67', 3)
        + ln([c[0], c[1], 0], [c[0], c[1], h], '#C6CDC5', 2.5);
      (dep(c[0], c[1]) <= Cd ? bak : foran).push({ d: dep(c[0], c[1]), s: g });
    });
    const liningFarge = q('lining') > 0 ? '#FFFFFF' : '#F8F9F1';
    [
      { p: [[0, 0, h], [Ld, 0, h], [Ld, Wd / 2, H], [0, Wd / 2, H]], c: [Ld / 2, Wd * 0.25] },
      { p: [[0, Wd, h], [Ld, Wd, h], [Ld, Wd / 2, H], [0, Wd / 2, H]], c: [Ld / 2, Wd * 0.75] },
      { p: [[0, 0, h], [0, Wd, h], [0, Wd / 2, H]], c: [0.01, Wd / 2] },
      { p: [[Ld, 0, h], [Ld, Wd, h], [Ld, Wd / 2, H]], c: [Ld - 0.01, Wd / 2] }
    ].forEach(f => {
      const d = dep(f.c[0], f.c[1]);
      if (d <= Cd) bak.push({ d, s: poly(f.p, liningFarge, 'stroke="#DCE1D6" stroke-width="1"') });
      else foran.push({ d, s: poly(f.p, 'rgba(255,255,255,0.42)', 'stroke="#D8DDD3" stroke-width="1"') });
    });
  }
  bak.sort((a, b) => a.d - b.d);
  svg += bak.map(i => i.s).join('');

  /* --- møbler --- */
  const kant = 'stroke="#D8D7CB" stroke-width="0.8"';

  const stol = (cx, cy, fx, fy) => {
    const bx = cx - fx * 0.18, by = cy - fy * 0.18, px = -fy, py = fx;
    const sete = ell(cx, cy, 0.46, 0.205, 0.118, '#FFFFFF', 'stroke="#CFCEC2" stroke-width="0.9"');
    const rygg = poly([
      [bx - px * 0.17, by - py * 0.17, 0.5], [bx + px * 0.17, by + py * 0.17, 0.5],
      [bx + px * 0.17, by + py * 0.17, 0.92], [bx - px * 0.17, by - py * 0.17, 0.92]
    ], '#F3F3EA', 'stroke="#C6C5B9" stroke-width="0.9" stroke-linejoin="round"');
    midt.push({ d: dep(cx, cy), s: dep(bx, by) > dep(cx, cy) ? sete + rygg : rygg + sete });
  };

  const avlangtBord = (x0, cy, lengde, bredde, plate) => {
    const y0 = cy - bredde / 2, y1 = cy + bredde / 2, x1 = x0 + lengde;
    const zt = 0.74, zb = 0.16;
    const sv = poly([[x0, y1, zb], [x1, y1, zb], [x1, y1, zt], [x0, y1, zt]], '#F0EFE5')
      + poly([[x1, y0, zb], [x1, y1, zb], [x1, y1, zt], [x1, y0, zt]], '#E6E5DA')
      + poly([[x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]], plate, kant);
    midt.push({ d: dep(x0 + lengde / 2, cy), s: sv });
  };

  const rundtBord = (cx, cy) => {
    const r = 0.72, c1 = pt(cx, cy, 0.74), c2 = pt(cx, cy, 0.18);
    const rx = (1.22 * r * s).toFixed(1), ry = (0.7 * r * s).toFixed(1);
    let sv = `<ellipse cx="${c2[0].toFixed(1)}" cy="${c2[1].toFixed(1)}" rx="${rx}" ry="${ry}" fill="#E6E5DA"/>`;
    sv += `<rect x="${(c1[0] - 1.22 * r * s).toFixed(1)}" y="${c1[1].toFixed(1)}" width="${(2.44 * r * s).toFixed(1)}" height="${(c2[1] - c1[1]).toFixed(1)}" fill="#F0EFE5"/>`;
    sv += `<ellipse cx="${c1[0].toFixed(1)}" cy="${c1[1].toFixed(1)}" rx="${rx}" ry="${ry}" fill="#FFFFFF" stroke="#D8D7CB" stroke-width="0.8"/>`;
    midt.push({ d: dep(cx, cy), s: sv });
  };

  const staaBord = (cx, cy) => {
    const c1 = pt(cx, cy, 1.1), c2 = pt(cx, cy, 0.05);
    const rx = (0.49 * s).toFixed(1), ry = (0.28 * s).toFixed(1);
    let sv = `<ellipse cx="${c2[0].toFixed(1)}" cy="${c2[1].toFixed(1)}" rx="${(0.3 * s).toFixed(1)}" ry="${(0.17 * s).toFixed(1)}" fill="#D9D8CC"/>`;
    sv += `<rect x="${(c1[0] - 0.05 * s).toFixed(1)}" y="${c1[1].toFixed(1)}" width="${(0.1 * s).toFixed(1)}" height="${(c2[1] - c1[1]).toFixed(1)}" fill="#CFCEC2"/>`;
    sv += `<ellipse cx="${c1[0].toFixed(1)}" cy="${c1[1].toFixed(1)}" rx="${rx}" ry="${ry}" fill="#FFFFFF" stroke="#D8D7CB" stroke-width="0.8"/>`;
    midt.push({ d: dep(cx, cy), s: sv });
  };

  const benk = (x0, cy, lengde) => {
    const y0 = cy - 0.14, y1 = cy + 0.14, x1 = x0 + lengde, zt = 0.45, zb = 0.1;
    const sv = poly([[x0, y1, zb], [x1, y1, zb], [x1, y1, zt], [x0, y1, zt]], '#E6DCC6')
      + poly([[x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt]], '#C9B896', kant);
    midt.push({ d: dep(x0 + lengde / 2, cy), s: sv });
  };

  /* --- plasser bordene inne i teltet --- */
  let stolerIgjen = stolerTotalt;
  let benkerIgjen = benkerTotalt;

  const settStoler = (cx, cy, antall, retning) => {
    for (let i = 0; i < antall && stolerIgjen > 0; i++) {
      const [fx, fy] = retning[i % retning.length];
      const off = Math.floor(i / retning.length);
      stol(cx + fx * 0 + (retning[i % retning.length][2] || 0) * 0, cy, fx, fy);
      stolerIgjen--;
    }
  };

  const radY = (rader) => rader === 1 ? [Wd / 2] : [Wd * 0.28, Wd * 0.72];

  // avlange bord (kbord + trebord behandles likt visuelt, ulik plate)
  [['kbord', 1.8, 0.75, '#FFFFFF'], ['trebord', 1.97, 0.6, '#E8DCC2']].forEach(([type, L, B, plate]) => {
    const n = plan[type].inne;
    if (!n) return;
    const rader = Wd >= 4.5 ? 2 : 1;
    const ys = radY(rader);
    const perRad = Math.ceil(n / rader);
    let lagt = 0;
    ys.forEach(cy => {
      const iRad = Math.min(perRad, n - lagt);
      if (iRad <= 0) return;
      const total = iRad * L + (iRad - 1) * 0.1;
      let x = (Ld - total) / 2;
      for (let i = 0; i < iRad; i++) {
        avlangtBord(x, cy, L, B, plate);
        // stoler langs begge langsider
        const perSide = 3;
        for (let k = 0; k < perSide && stolerIgjen > 0; k++) {
          stol(x + 0.35 + k * 0.55, cy - B / 2 - 0.42, 0, 1); stolerIgjen--;
        }
        for (let k = 0; k < perSide && stolerIgjen > 0; k++) {
          stol(x + 0.35 + k * 0.55, cy + B / 2 + 0.42, 0, -1); stolerIgjen--;
        }
        // benker til trebord i stedet for stoler
        if (type === 'trebord') {
          if (benkerIgjen > 0) { benk(x, cy - B / 2 - 0.52, L); benkerIgjen--; }
          if (benkerIgjen > 0) { benk(x, cy + B / 2 + 0.52, L); benkerIgjen--; }
        }
        x += L + 0.1;
        lagt++;
      }
    });
  });

  // runde bord
  if (plan.rbord.inne) {
    const n = plan.rbord.inne;
    const rader = Wd >= 5 ? 2 : 1;
    const ys = radY(rader);
    const perRad = Math.ceil(n / rader);
    let lagt = 0;
    ys.forEach(cy => {
      const iRad = Math.min(perRad, n - lagt);
      if (iRad <= 0) return;
      for (let i = 0; i < iRad; i++) {
        const cx = Ld * (i + 1) / (iRad + 1);
        rundtBord(cx, cy);
        for (let a = 0; a < 8 && stolerIgjen > 0; a++) {
          const th = a * Math.PI / 4 + 0.4;
          stol(cx + Math.cos(th) * 1.15, cy + Math.sin(th) * 1.02, -Math.cos(th), -Math.sin(th));
          stolerIgjen--;
        }
        lagt++;
      }
    });
  }

  // ståbord langs kanten
  if (plan.stabord.inne) {
    // Ståbord settes langs kantene, der de ikke kolliderer med bordoppsettet
    const harAndreBord = plan.kbord.inne + plan.trebord.inne + plan.rbord.inne > 0;
    const perRad = Math.max(1, Math.floor((Ld - 1.2) / 1.5));
    for (let i = 0; i < plan.stabord.inne; i++) {
      const kol = i % perRad, rad = Math.floor(i / perRad);
      const cx = 0.9 + kol * 1.5;
      const cy = harAndreBord
        ? (rad % 2 === 0 ? 0.55 : Wd - 0.55)          // langs begge langsider
        : Wd * (rad % 2 === 0 ? 0.32 : 0.68);         // spredt utover når teltet er tomt
      staaBord(Math.min(cx, Ld - 0.6), cy);
    }
  }

  /* --- resten: sammenklappet ved siden av teltet --- */
  const notater = [];
  if (teltId && (harStabel || stolerIgjen > 0 || benkerIgjen > 0)) {
    let lagerX = Ld + 1.5;
    const lagerY = Wd / 2;

    // stablede bordplater – ligger flatt oppå hverandre
    const stabelBord = (x, y, antall, L, B, plate, hoyde0) => {
      for (let i = 0; i < Math.min(antall, 8); i++) {
        const z = hoyde0 + i * 0.09;
        midt.push({
          d: dep(x + L / 2, y) + i * 0.001,
          s: poly([[x, y - B / 2, z], [x + L, y - B / 2, z], [x + L, y + B / 2, z], [x, y + B / 2, z]], plate, kant)
            + poly([[x, y + B / 2, z - 0.08], [x + L, y + B / 2, z - 0.08], [x + L, y + B / 2, z], [x, y + B / 2, z]], '#E6E5DA')
        });
      }
    };

    if (plan.kbord.ute) { stabelBord(lagerX, lagerY - 1.1, plan.kbord.ute, 1.8, 0.75, '#FFFFFF', 0.05); notater.push(`${plan.kbord.ute} avlange bord`); }
    if (plan.trebord.ute) { stabelBord(lagerX, lagerY - 1.1, plan.trebord.ute, 1.97, 0.6, '#E8DCC2', 0.05 + plan.kbord.ute * 0.09); notater.push(`${plan.trebord.ute} trebord`); }
    if (plan.rbord.ute) {
      for (let i = 0; i < Math.min(plan.rbord.ute, 6); i++) {
        // runde plater står på høykant, lent mot hverandre
        const x = lagerX + 0.5 + i * 0.16;
        midt.push({
          d: dep(x, lagerY + 0.9) + i * 0.001,
          s: ell(x, lagerY + 0.9, 0.78, 0.12, 0.76, '#FFFFFF', 'stroke="#D8D7CB" stroke-width="0.8"')
        });
      }
      notater.push(`${plan.rbord.ute} runde bord`);
    }
    if (plan.stabord.ute) {
      for (let i = 0; i < Math.min(plan.stabord.ute, 6); i++) staaBord(lagerX + 0.5 + i * 0.7, lagerY + 1.5);
      notater.push(`${plan.stabord.ute} ståbord`);
    }
    if (stolerIgjen > 0) {
      // stablede stoler
      const sx = lagerX + 2.2, sy = lagerY - 0.2;
      for (let i = 0; i < Math.min(stolerIgjen, 12); i++) {
        const z = 0.06 + i * 0.075;
        midt.push({
          d: dep(sx, sy) + i * 0.001,
          s: ell(sx, sy, z + 0.4, 0.2, 0.115, '#FFFFFF', 'stroke="#CFCEC2" stroke-width="0.8"')
        });
      }
      notater.push(`${stolerIgjen} stoler`);
    }
    if (benkerIgjen > 0) {
      for (let i = 0; i < Math.min(benkerIgjen, 6); i++) benk(lagerX + 0.2, lagerY + 2.0 + i * 0.24, 1.97);
      notater.push(`${benkerIgjen} benker`);
    }
  }

  /* --- tegn møblene bakfra og fram --- */
  midt.sort((a, b) => a.d - b.d);
  svg += midt.map(i => i.s).join('');

  foran.sort((a, b) => a.d - b.d);
  svg += foran.map(i => i.s).join('');

  /* --- lysslynge langs mønet --- */
  if (teltId && q('lys') > 0) {
    svg += ln([0, Wd / 2, H], [Ld, Wd / 2, H], '#CFD6CC', 1.4);
    let path = '', lp = '';
    const segs = Math.max(3, Math.round(Ld / 1.9));
    for (let i = 0; i < segs; i++) {
      const xa = 0.25 + (Ld - 0.5) * i / segs, xb = 0.25 + (Ld - 0.5) * (i + 1) / segs;
      const a = pt(xa, Wd / 2, H - 0.05), b = pt(xb, Wd / 2, H - 0.05), m = pt((xa + xb) / 2, Wd / 2, H - 0.4);
      path += (i === 0 ? `M${a[0].toFixed(1)} ${a[1].toFixed(1)}` : '') +
        ` Q${m[0].toFixed(1)} ${m[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
      for (let j = 1; j <= 3; j++) {
        const t = j / 4, xq = xa + (xb - xa) * t, zq = H - 0.05 - Math.sin(Math.PI * t) * 0.3;
        lp += cir(xq, Wd / 2, zq, 3.6, '#FFDE9E', 0.35) + cir(xq, Wd / 2, zq, 1.6, '#F0B44A');
      }
    }
    svg += `<path d="${path}" fill="none" stroke="#CBA24E" stroke-width="1"/>` + lp;
  }

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bredde} ${hoyde}" role="img"><title>Slik kan oppsettet se ut</title>${svg}</svg>`,
    teltId,
    plan,
    stolerUte: stolerIgjen,
    benkerUte: benkerIgjen,
    notater,
    gulvdekning: teltId ? Math.min(1, gulvKvm / teltKvm) : 0
  };
}
