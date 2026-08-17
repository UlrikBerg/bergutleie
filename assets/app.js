/* ===========================================================================
   Berg Utleie – klientlogikk.

   Sidene fungerer og er lesbare uten dette skriptet; her legges bare
   interaktiviteten på: handlekurv, galleri, pakkevisning og prisberegning.
   Kurven ligger i localStorage, så den følger deg mellom sidene.
   ======================================================================== */

import { PRODUKTER, STEDER, SONER, finn, sone, enhetspris, kr } from '/data/produkter.js';
import { soneForKommune } from '/data/kommuner.js';
import { teltSvg } from '/data/telt-svg.js';
import { lagAdressesok } from '/assets/adressesok.js';
import { oppsettSvg } from '/data/oppsett-svg.js';
import { startMaling, hentGclid, sporForesporsel } from '/assets/maling.js';
import { FORSKUDD_ANDEL, FORSKUDD_PROSENT } from '/data/vilkar.js';
import { tiderFor, erStengt, APNINGSTID_TEKST } from '/data/apningstid.js';

const NOKKEL = 'bergutleie-kurv';
const ADRESSE_NOKKEL = 'bergutleie-adresse';
const BESTILLING_NOKKEL = 'bergutleie-bestilling';

/* Adressen skrives inn på forsiden og følger med til handlekurven. */
const lesAdresse = () => {
  try { return localStorage.getItem(ADRESSE_NOKKEL) || ''; } catch { return ''; }
};
const lagreAdresse = (v) => {
  try { localStorage.setItem(ADRESSE_NOKKEL, v); } catch { /* privat modus */ }
};

/* Adressen kunden har valgt fra Kartverket, med poststed og koordinater. */
const VALGT_NOKKEL = 'bergutleie-valgt-adresse';
const lesValgtAdresse = () => {
  try { return JSON.parse(localStorage.getItem(VALGT_NOKKEL)) || null; } catch { return null; }
};
const lagreValgtAdresse = (a) => {
  try {
    if (a) localStorage.setItem(VALGT_NOKKEL, JSON.stringify(a));
    else localStorage.removeItem(VALGT_NOKKEL);
  } catch { /* privat modus */ }
};

/* Datoer og leveringsvalg må også følge med fra handlekurven til tilbudssiden. */
const lesBestilling = () => {
  try { return JSON.parse(localStorage.getItem(BESTILLING_NOKKEL)) || {}; } catch { return {}; }
};
const lagreBestilling = (b) => {
  try {
    localStorage.setItem(BESTILLING_NOKKEL,
      JSON.stringify({ fra: b.fra, til: b.til, modus: b.modus }));
  } catch { /* privat modus */ }
};

/**
 * Finner fraktsonen for adressen. Har kunden valgt en adresse fra Kartverket,
 * bruker vi kommunen – det er den soneinndelingen vi selv har bestemt.
 * Ellers faller vi tilbake til å kjenne igjen et stedsnavn i fritekst.
 * Returnerer { sone, navn } eller null når vi ikke kjører dit til fast pris.
 */
function finnSted(adresse, valgt) {
  if (valgt?.kommune) {
    const nr = soneForKommune(valgt.kommune);
    if (nr) return { sone: nr, navn: valgt.poststed || valgt.kommune };
    return null;                       // kjent adresse, men utenfor sonene
  }
  const a = (adresse || '').trim().toLowerCase();
  if (a.length < 2) return null;
  const sted = STEDER.find(s => a.includes(s.navn.toLowerCase()));
  if (!sted) return null;
  const s = sone(sted.km);
  return s ? { sone: SONER.indexOf(s) + 1, navn: sted.navn } : null;
}

/* --- kurvtilstand --- */
const les = () => {
  try { return JSON.parse(localStorage.getItem(NOKKEL)) || {}; }
  catch { return {}; }
};
let kurv = les();

function lagre() {
  try { localStorage.setItem(NOKKEL, JSON.stringify(kurv)); } catch { /* privat modus */ }
  tegnAlt();
}
const antall = (id) => kurv[id] || 0;
const totaltAntall = () => Object.values(kurv).reduce((a, b) => a + b, 0);

function endre(id, n) {
  const ny = Math.max(0, antall(id) + n);
  if (ny === 0) delete kurv[id]; else kurv[id] = ny;
  lagre();
}
function settAntall(id, n) {
  if (n <= 0) delete kurv[id]; else kurv[id] = n;
  lagre();
}

/* --- header --- */
function tegnTeller() {
  const t = document.querySelector('[data-kurv-teller]');
  if (!t) return;
  t.textContent = totaltAntall();
}

/* --- knapper som finnes på flere sider --- */
document.addEventListener('click', (e) => {
  const legg = e.target.closest('.legg-i-kurv');
  if (legg) {
    endre(legg.dataset.id, parseInt(legg.dataset.antall || '1', 10));
    blink(legg);
    return;
  }
  const inc = e.target.closest('.antall-boks .inc');
  if (inc) { endre(inc.dataset.id, 1); return; }
  const dec = e.target.closest('.antall-boks .dec');
  if (dec) { endre(dec.dataset.id, -1); return; }

  const pakke = e.target.closest('.legg-pakke');
  if (pakke) {
    const p = finn(pakke.dataset.pakke);
    if (antall(p.id) === 0) kurv[p.id] = 1;
    (p.rec || []).forEach(([rid, n]) => { kurv[rid] = Math.max(antall(rid), n); });
    lagre();
    blink(pakke);
    return;
  }

  const velg = e.target.closest('.velg-pakke');
  if (velg) {
    kurv = Object.fromEntries(JSON.parse(velg.dataset.deler));
    lagre();
    velg.textContent = 'Lagt i handlekurven ✓';
    setTimeout(() => { window.location.href = '/handlekurv/'; }, 600);
  }
});

function blink(el) {
  el.classList.add('blink');
  setTimeout(() => el.classList.remove('blink'), 400);
}

/* --- mobilmeny --- */
function settOppMeny() {
  const knapp = document.querySelector('[data-meny]');
  const meny = document.getElementById('hovedmeny');
  if (!knapp || !meny) return;

  const lukk = () => {
    meny.classList.remove('apen');
    knapp.setAttribute('aria-expanded', 'false');
    knapp.setAttribute('aria-label', 'Åpne menyen');
  };

  knapp.addEventListener('click', () => {
    const apen = meny.classList.toggle('apen');
    knapp.setAttribute('aria-expanded', String(apen));
    knapp.setAttribute('aria-label', apen ? 'Lukk menyen' : 'Åpne menyen');
  });

  // Lukk når man klikker utenfor, trykker Escape, eller velger en lenke
  document.addEventListener('click', (e) => {
    if (!meny.contains(e.target) && !knapp.contains(e.target)) lukk();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lukk(); });
  meny.querySelectorAll('a').forEach(a => a.addEventListener('click', lukk));
}

/* --- produktside: antall og galleri --- */
function tegnProduktside() {
  document.querySelectorAll('[data-antall-boks]').forEach(boks => {
    const id = boks.dataset.antallBoks;
    const n = antall(id);
    boks.hidden = n === 0;
    const val = boks.querySelector('[data-antall]');
    if (val) val.textContent = n;
    const note = document.querySelector(`[data-i-kurv="${id}"]`);
    if (note) {
      note.hidden = n === 0;
      note.innerHTML = n === 0 ? '' :
        `✓ I handlekurven: ${n} stk · <a href="/handlekurv/">Til handlekurven →</a>`;
    }
  });
}

function settOppGalleri() {
  const gal = document.querySelector('[data-galleri]');
  if (!gal) return;
  const hoved = gal.querySelector('[data-galleri-hoved]');
  const minier = [...gal.querySelectorAll('[data-mini]')];
  if (!hoved || minier.length < 2) return;
  let i = 0;
  const vis = (n) => {
    i = (n + minier.length) % minier.length;
    const m = minier[i];
    hoved.src = m.dataset.u;
    hoved.alt = m.dataset.alt;
    hoved.classList.toggle('contain', m.dataset.fit === 'contain');
    minier.forEach((x, k) => x.classList.toggle('aktiv', k === i));
  };
  minier.forEach((m, k) => m.addEventListener('click', () => vis(k)));
  gal.querySelector('[data-gal-forrige]')?.addEventListener('click', () => vis(i - 1));
  gal.querySelector('[data-gal-neste]')?.addEventListener('click', () => vis(i + 1));
  gal.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') vis(i - 1);
    if (e.key === 'ArrowRight') vis(i + 1);
  });
}

/* --- pakkeside: bordtype og rotasjon --- */
function settOppPakker() {
  const knapper = [...document.querySelectorAll('.bordknapp')];
  if (!knapper.length) return;
  const note = document.querySelector('[data-rund-note]');
  knapper.forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.bordtype;
    knapper.forEach(x => {
      const på = x === b;
      x.classList.toggle('aktiv', på);
      x.setAttribute('aria-selected', String(på));
    });
    document.querySelectorAll('[data-gruppe]').forEach(g => { g.hidden = g.dataset.gruppe !== t; });
    if (note) note.hidden = t !== 'rund';
  }));

  document.querySelectorAll('[data-pakke-kort]').forEach(kort => {
    const media = kort.querySelector('[data-pakke-media]');
    const svgEl = () => media.querySelector('svg');
    let vinkel = 0;
    media.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      media.setPointerCapture(e.pointerId);
      media.classList.add('drar');
      const x0 = e.clientX, v0 = vinkel;
      const flytt = (ev) => {
        vinkel = v0 + (ev.clientX - x0) * 0.011;
        const ny = teltSvg(kort.dataset.telt, kort.dataset.bordtype,
          parseInt(kort.dataset.nbord, 10), kort.dataset.hs === '1',
          kort.dataset.ends === '1', vinkel);
        svgEl().outerHTML = ny;
      };
      const slipp = () => {
        media.classList.remove('drar');
        media.removeEventListener('pointermove', flytt);
        media.removeEventListener('pointerup', slipp);
      };
      media.addEventListener('pointermove', flytt);
      media.addEventListener('pointerup', slipp);
    });
  });
}

/* --- delt tilstand for handlekurv og tilbudsskjema --- */
const lagret = lesBestilling();
const bestilling = {
  fra: lagret.fra || '',
  til: lagret.til || '',
  adresse: lesAdresse(),
  valgt: lesValgtAdresse(),
  // Har kunden oppgitt adresse på forsiden, står levering forhåndsvalgt
  modus: lagret.modus || (lesAdresse() ? 'lev' : 'hent')
};

function dager() {
  const t1 = Date.parse(bestilling.fra), t2 = Date.parse(bestilling.til);
  if (isNaN(t1) || isNaN(t2) || t2 < t1) return { har: false, n: 1 };
  return { har: true, n: Math.max(1, Math.round((t2 - t1) / 86400000)) };
}

const stedTreff = () => finnSted(bestilling.adresse, bestilling.valgt);

/** Regner ut leie, frakt og total ut fra kurv, datoer og adresse. */
function summer() {
  const d = dager();
  let leie = 0;
  PRODUKTER.forEach(p => { leie += antall(p.id) * enhetspris(p, d.n); });

  // utenforSone betyr at vi ikke kjører dit i det hele tatt – ikke at prisen
  // settes senere. Da kan bookingen ikke betales, og kunden må hente selv
  // eller sende en forespørsel. Se src/pris.js.
  let levering = 0, levLabel = '0 kr', ruteMeta = '', adresseNote = '',
      utenforSone = false, manglerAdresse = false;

  if (bestilling.modus === 'lev') {
    const sted = stedTreff();
    if (!sted) {
      if (bestilling.valgt) {
        utenforSone = true;
        levLabel = 'Vi kjører ikke hit';
        adresseNote = (bestilling.valgt.poststed || 'Stedet') +
          ' ligger utenfor området vi leverer til. Du kan hente selv i Halden, ' +
          'eller sende en forespørsel så finner vi ut av det.';
      } else {
        manglerAdresse = true;
        levLabel = 'Legg inn adresse';
        adresseNote = bestilling.adresse.trim().length > 1
          ? 'Velg adressen fra listen, så finner vi fast fraktpris.'
          : 'Skriv adressen, så finner vi fast fraktpris automatisk.';
      }
    } else {
      const z = SONER[sted.sone - 1];
      levering = z.pris;
      levLabel = kr(levering);
      ruteMeta = 'Fast fraktpris til ' + sted.navn + ' – både utkjøring og henting er inkludert.';
    }
  }
  return { d, leie, levering, levLabel, ruteMeta, adresseNote,
           utenforSone, manglerAdresse, total: leie + levering,
           kanBookes: !utenforSone && !manglerAdresse && leie > 0 };
}

/* --- handlekurvsiden --- */
function tegnKurvside() {
  const liste = document.querySelector('[data-kurv-liste]');
  if (!liste) return;

  const varer = PRODUKTER.filter(p => antall(p.id) > 0);
  document.querySelector('[data-kurv-tom]').hidden = varer.length > 0;
  document.querySelector('[data-kurv-layout]').hidden = varer.length === 0;

  const s = summer();
  const dagerLabel = s.d.har ? (s.d.n === 1 ? '1 døgn' : s.d.n + ' dager') : '1–4 dager';

  liste.innerHTML = varer.map(p => {
    const e = enhetspris(p, s.d.n);
    return `
    <div class="kurv-rad">
      <div class="kurv-navn">
        <p class="navn"><a href="/utstyr/${p.slug}/">${p.navn}</a></p>
        <p class="enhet">${p.fast ? kr(p.fast) + ' fastpris /stk' : kr(e) + ' /stk for ' + dagerLabel}</p>
      </div>
      <div class="antall-boks synlig">
        <button type="button" class="dec" data-id="${p.id}" aria-label="Fjern én">−</button>
        <span class="val">${antall(p.id)}</span>
        <button type="button" class="inc" data-id="${p.id}" aria-label="Legg til én">+</button>
      </div>
      <p class="kurv-sum">${kr(antall(p.id) * e)}</p>
      <button type="button" class="fjern" data-fjern="${p.id}" aria-label="Fjern ${p.navn}">×</button>
    </div>`;
  }).join('');

  const sett = (sel, t) => { const e = document.querySelector(sel); if (e) e.textContent = t; };
  sett('[data-periode-tag]', '(' + dagerLabel + ')');
  sett('[data-leie]', kr(s.leie));
  sett('[data-levering]', s.levLabel);
  sett('[data-total]', s.utenforSone ? '—' : kr(s.total));

  // Forskuddet vises allerede i kurven, så beløpet ikke er en overraskelse
  // i det Vipps åpner.
  const fLinje = document.querySelector('[data-forskudd-linje]');
  if (fLinje) {
    fLinje.hidden = !s.kanBookes;
    sett('[data-forskudd]', kr(Math.round(s.total * FORSKUDD_ANDEL)));
  }

  // Kan bookingen ikke betales, skal veien videre stenges her – ikke i
  // kassen. Kunden skal aldri komme til betalingssiden og få avslag der.
  const videre = document.querySelector('[data-ga-videre]');
  const sperre = document.querySelector('[data-kurv-sperre]');
  const kurvNote = document.querySelector('[data-kurv-note]');
  if (videre && sperre) {
    const blokkert = s.utenforSone;
    videre.hidden = blokkert;
    if (kurvNote) kurvNote.hidden = blokkert;
    sperre.hidden = !blokkert;
    if (blokkert) {
      sperre.querySelector('[data-kurv-sperre-tekst]').textContent =
        'Vi kjører ikke ut til denne adressen. Velg «Hent selv», eller send en forespørsel – ' +
        'ofte finner vi en løsning likevel.';
    }
  }
  sett('[data-dager-note]', !s.d.har
    ? 'Velg datoer – 1–4 dagers leie koster det samme.'
    : (s.d.n <= 4 ? dagerLabel + ' – samme pris som én dag.' : s.d.n + ' dager – +15 % per døgn utover 4.'));

  const rute = document.querySelector('[data-rute-treff]');
  if (rute) { rute.textContent = s.ruteMeta ? '✓ ' + s.ruteMeta : ''; rute.hidden = !s.ruteMeta; }
  const aNote = document.querySelector('[data-adresse-note]');
  if (aNote) { aNote.textContent = s.adresseNote; aNote.hidden = !s.adresseNote; }
  const aFelt = document.querySelector('[data-adresse-felt]');
  if (aFelt) aFelt.hidden = bestilling.modus !== 'lev';
  const hFelt = document.querySelector('[data-hente-sted]');
  if (hFelt) hFelt.hidden = bestilling.modus !== 'hent';

  tegnOppsett();
  tegnInnsikt();
}

/* --- «Slik kan det se ut» – 3D-tegning av hele kurven --- */
const KAM_START = { az: 0, elev: 0.5, zoom: 1, panX: 0, panY: 0 };
let kamera = { ...KAM_START };

function tegnOppsett() {
  const boks = document.querySelector('[data-oppsett]');
  if (!boks) return;

  const relevant = ['t33','t36','t38','t56','t58','t510','kbord','trebord','rbord',
                    'stabord','stol','trebenk','gulv','lys','duk','rundduk',
                    'lining56','lining58','lining510'];
  const noeAaVise = relevant.some(id => antall(id) > 0);
  boks.hidden = !noeAaVise;
  if (!noeAaVise) return;

  const kurvTall = {};
  PRODUKTER.forEach(p => { if (antall(p.id) > 0) kurvTall[p.id] = antall(p.id); });

  const res = oppsettSvg(kurvTall, finn, kamera);
  document.querySelector('[data-oppsett-scene]').innerHTML = res.svg;

  const note = document.querySelector('[data-oppsett-note]');
  const deler = [];
  if (!res.teltId) {
    deler.push('Legg et telt i kurven for å se oppsettet under duk.');
  } else if (res.notater.length) {
    deler.push('Får ikke plass i teltet og står sammenklappet ved siden av: ' + res.notater.join(', ') + '.');
  } else {
    deler.push('Alt utstyret får plass i teltet.');
  }
  if (res.teltId && res.gulvdekning > 0 && res.gulvdekning < 1) {
    deler.push(`Tregulvet dekker ${Math.round(res.gulvdekning * 100)} % av flaten.`);
  }
  note.textContent = deler.join(' ');

}

function settKamera(endring) {
  Object.assign(kamera, endring);
  kamera.elev = Math.max(0.18, Math.min(0.92, kamera.elev));
  kamera.zoom = Math.max(0.5, Math.min(4, kamera.zoom));
  tegnOppsett();
}

function settOppKamera() {
  const scene = document.querySelector('[data-oppsett-scene]');
  if (!scene) return;

  /* Dra: horisontalt roterer, vertikalt vipper. Shift eller to fingre panorerer. */
  scene.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // Enkelte nettlesere kaster her hvis pekeren ikke er «aktiv». Draget
    // skal fungere uansett, så feilen må ikke stoppe resten.
    try { scene.setPointerCapture(e.pointerId); } catch { /* ikke kritisk */ }
    scene.classList.add('drar');
    const x0 = e.clientX, y0 = e.clientY;
    const start = { ...kamera };
    const panorer = e.shiftKey || e.button === 1;

    const flytt = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (panorer) {
        settKamera({ panX: start.panX + dx, panY: start.panY + dy });
      } else {
        settKamera({ az: start.az - dx * 0.009, elev: start.elev + dy * 0.0035 });
      }
    };
    const slipp = () => {
      scene.classList.remove('drar');
      scene.removeEventListener('pointermove', flytt);
      scene.removeEventListener('pointerup', slipp);
      scene.removeEventListener('pointercancel', slipp);
    };
    scene.addEventListener('pointermove', flytt);
    scene.addEventListener('pointerup', slipp);
    scene.addEventListener('pointercancel', slipp);
  });

  /* Rullehjul zoomer */
  scene.addEventListener('wheel', (e) => {
    e.preventDefault();
    settKamera({ zoom: kamera.zoom * (e.deltaY < 0 ? 1.11 : 0.9) });
  }, { passive: false });

  /* Klyp for å zoome på mobil */
  let pekere = new Map(), startAvstand = 0, startZoom = 1;
  scene.addEventListener('pointerdown', (e) => {
    pekere.set(e.pointerId, e);
    if (pekere.size === 2) {
      const [a, b] = [...pekere.values()];
      startAvstand = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      startZoom = kamera.zoom;
    }
  });
  scene.addEventListener('pointermove', (e) => {
    if (!pekere.has(e.pointerId)) return;
    pekere.set(e.pointerId, e);
    if (pekere.size === 2 && startAvstand > 0) {
      const [a, b] = [...pekere.values()];
      const na = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      settKamera({ zoom: startZoom * (na / startAvstand) });
    }
  });
  ['pointerup', 'pointercancel'].forEach(t =>
    scene.addEventListener(t, (e) => { pekere.delete(e.pointerId); startAvstand = 0; }));

  /* Tastatur når tegningen har fokus */
  scene.setAttribute('tabindex', '0');
  scene.addEventListener('keydown', (e) => {
    const steg = e.shiftKey ? 0.35 : 0.12;
    if (e.key === 'ArrowLeft') { settKamera({ az: kamera.az - steg }); e.preventDefault(); }
    if (e.key === 'ArrowRight') { settKamera({ az: kamera.az + steg }); e.preventDefault(); }
    if (e.key === 'ArrowUp') { settKamera({ elev: kamera.elev + 0.06 }); e.preventDefault(); }
    if (e.key === 'ArrowDown') { settKamera({ elev: kamera.elev - 0.06 }); e.preventDefault(); }
    if (e.key === '+' || e.key === '=') settKamera({ zoom: kamera.zoom * 1.15 });
    if (e.key === '-') settKamera({ zoom: kamera.zoom * 0.87 });
    if (e.key === '0') settKamera({ ...KAM_START });
  });

  /* Dobbeltklikk nullstiller visningen */
  scene.addEventListener('dblclick', () => settKamera({ ...KAM_START }));
}

/* Forslag basert på hva som ligger i kurven */
function tegnInnsikt() {
  const boks = document.querySelector('[data-innsikt]');
  if (!boks) return;
  const ut = [];
  const q = antall;
  const telt = PRODUKTER.filter(p => p.cat === 'Partytelt' && p.capL > 0 && q(p.id) > 0);
  const teltAnt = telt.reduce((a, p) => a + q(p.id), 0);
  const teltCap = telt.reduce((a, p) => a + q(p.id) * (p.capL || 0), 0);
  const teltAreal = telt.reduce((a, p) => a + q(p.id) * (p.areal || 0), 0);
  const bordAnt = q('kbord') + q('rbord');
  const bordMin = bordAnt * 4;
  const bordMaks = q('kbord') * 8 + q('rbord') * 8;

  if (teltAnt > 0) ut.push({ ok: true, t: `Teltplass: inntil ${teltCap} gjester med langbord (${teltAreal} kvm).` });
  if (bordAnt > 0) ut.push({ ok: true, t: `Bordplasser: inntil ${bordMaks} gjester ved ${bordAnt} bord.` });
  if (bordAnt > 0 && q('stol') < bordMin)
    ut.push({ t: `Du mangler ${bordMin - q('stol')} stoler for å fylle bordene.`, id: 'stol', n: bordMin - q('stol'), knapp: `+ ${bordMin - q('stol')} stoler` });
  else if (bordAnt > 0)
    ut.push({ ok: true, t: `${q('stol')} stoler til ${bordAnt} bord – oppsettet går fint opp.` });
  if (teltAnt > 0 && bordMin > teltCap)
    ut.push({ t: `Bordoppsettet er større enn teltkapasiteten (${teltCap} gjester) – vurder større telt.` });
  if (teltAnt > 0) {
    const kvm = q('gulv') * 2;
    if (kvm === 0) ut.push({ t: `Tregulv gir jevnt og tørt underlag – ${teltAreal / 2} moduler (${teltAreal} kvm) dekker hele teltet.`, id: 'gulv', n: teltAreal / 2, knapp: `+ ${teltAreal / 2} moduler` });
    else if (kvm < teltAreal) ut.push({ t: `Gulvet dekker ${kvm} av ${teltAreal} kvm.`, id: 'gulv', n: (teltAreal - kvm) / 2, knapp: `+ ${(teltAreal - kvm) / 2} moduler` });
    else ut.push({ ok: true, t: `Gulvet dekker hele teltflaten (${teltAreal} kvm).` });
    if (q('sikring') < teltAnt)
      ut.push({ t: 'Husk forankring: én sikringspakke per telt (499 kr fastpris).', id: 'sikring', n: teltAnt - q('sikring'), knapp: '+ Sikringspakke' });
    const lysBehov = telt.reduce((a, p) => a + q(p.id) * ((p.rec.find(r => r[0] === 'lys') || [0, 1])[1]), 0);
    if (lysBehov > q('lys'))
      ut.push({ t: `Lysslynge langs mønet gjør teltet festklart – teltene dine trenger ${lysBehov} stk.`, id: 'lys', n: lysBehov - q('lys'), knapp: `+ ${lysBehov - q('lys')} lysslynge${lysBehov - q('lys') > 1 ? 'r' : ''}` });
  }
  if (bordAnt > 0 && q('duk') < bordAnt)
    ut.push({ t: `Duker: én per bord – du mangler ${bordAnt - q('duk')}.`, id: 'duk', n: bordAnt - q('duk'), knapp: `+ ${bordAnt - q('duk')} duker` });

  boks.hidden = ut.length === 0;
  boks.querySelector('[data-innsikt-liste]').innerHTML = ut.map(i => `
    <div class="innsikt-rad">
      <span class="innsikt-prikk${i.ok ? ' ok' : ''}"></span>
      <span class="innsikt-tekst">${i.t}</span>
      ${i.id ? `<button type="button" class="btn-liten legg-i-kurv" data-id="${i.id}" data-antall="${i.n}">${i.knapp}</button>` : ''}
    </div>`).join('');
}

/* Felles oppkobling av dato-, adresse- og modusfelt (finnes på begge sider) */
function koblBestillingsfelt(etterEndring) {
  const fra = document.querySelector('[data-fra]');
  const til = document.querySelector('[data-til]');
  if (fra) { fra.value = bestilling.fra; fra.addEventListener('change', e => { bestilling.fra = e.target.value; lagreBestilling(bestilling); etterEndring(); }); }
  if (til) { til.value = bestilling.til; til.addEventListener('change', e => { bestilling.til = e.target.value; lagreBestilling(bestilling); etterEndring(); }); }

  const adr = document.querySelector('[data-adresse]');
  if (adr) {
    adr.value = bestilling.adresse;
    lagAdressesok(adr, (valgt) => {
      bestilling.valgt = valgt;
      bestilling.adresse = adr.value;
      lagreAdresse(adr.value);
      lagreValgtAdresse(valgt);
      etterEndring();
    });
  }

  const knapper = [...document.querySelectorAll('[data-seg-modus] button')];
  knapper.forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.val === bestilling.modus));
    b.addEventListener('click', () => {
      bestilling.modus = b.dataset.val;
      lagreBestilling(bestilling);
      knapper.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      etterEndring();
    });
  });
}

function settOppKurvside() {
  const liste = document.querySelector('[data-kurv-liste]');
  if (!liste) return;
  koblBestillingsfelt(tegnKurvside);

  settOppKamera();
;
  liste.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fjern]');
    if (f) settAntall(f.dataset.fjern, 0);
  });
}

/* --- tilbudssiden --- */
function settOppTilbud() {
  const skjema = document.querySelector('[data-skjema]');
  if (!skjema) return;

  const sammendrag = document.querySelector('[data-kurv-sammendrag]');
  const tegnSammendrag = () => {
    const varer = PRODUKTER.filter(p => antall(p.id) > 0);
    if (!varer.length) { sammendrag.hidden = true; return; }
    const s = summer();
    sammendrag.hidden = false;
    const dagerTekst = s.d.har ? (s.d.n === 1 ? '1 døgn' : s.d.n + ' dager') : 'ikke valgt';
    const norsk = (iso) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      if (!m) return iso;
      const mnd = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];
      return `${Number(m[3])}. ${mnd[Number(m[2]) - 1]}`;
    };
    const periode = bestilling.fra && bestilling.til
      ? `${norsk(bestilling.fra)} – ${norsk(bestilling.til)} (${dagerTekst})` : 'Datoer ikke valgt';
    const levering = bestilling.modus === 'lev'
      ? (bestilling.adresse ? 'Leveres til ' + bestilling.adresse : 'Leveres – adresse mangler')
      : 'Hentes i Sørliveien 78, 1788 Halden';

    sammendrag.innerHTML = `
      <p class="sammendrag-tittel">Din bestilling</p>
      <ul>${varer.map(p => `<li>${antall(p.id)} × ${p.navn}</li>`).join('')}</ul>
      <dl class="sammendrag-fakta">
        <dt>Leieperiode</dt><dd>${periode}</dd>
        <dt>${bestilling.modus === 'lev' ? 'Levering' : 'Henting'}</dt><dd>${levering}</dd>
      </dl>
      <p class="sammendrag-sum">Totalt: <strong>${s.utenforSone ? '—' : kr(s.total)}</strong></p>
      <p class="sammendrag-note"><a href="/handlekurv/">← Endre i handlekurven</a></p>`;
  };

  tegnSammendrag();

  /* Forespørselsskjemaet på /tilbud/ har ingen betaling – det er hele
     poenget med det. Resten her gjelder bare kassen. */
  const erForesporsel = skjema.hasAttribute('data-foresporsel');
  const vippsKnapp = skjema.querySelector('[data-vipps]');

  /* --- klokkeslett, begrenset av åpningstidene --- */
  const hentetid = skjema.querySelector('[data-hentetid]');
  const returtid = skjema.querySelector('[data-returtid]');

  function fyllTider() {
    if (!hentetid || !returtid) return;
    const note = skjema.querySelector('[data-tid-note]');
    const lev = bestilling.modus === 'lev';

    skjema.querySelector('[data-hent-etikett]').textContent = lev ? 'Levering' : 'Henting';
    skjema.querySelector('[data-retur-etikett]').textContent = lev ? 'Vi henter igjen' : 'Tilbakelevering';

    const fyll = (el, iso) => {
      const tider = tiderFor(iso);
      el.innerHTML = tider.length
        ? tider.map(t => `<option value="${t}">${t}</option>`).join('')
        : '<option value="">—</option>';
      el.disabled = !tider.length;
    };
    fyll(hentetid, bestilling.fra);
    fyll(returtid, bestilling.til);

    // Lørdag er stengt. Uten dette kunne kunden betalt for en henting
    // som ikke kan skje.
    const stengt = [bestilling.fra, bestilling.til].filter(erStengt);
    if (!bestilling.fra || !bestilling.til) {
      note.textContent = 'Velg datoer i handlekurven først.';
      note.className = 'tid-note feil';
    } else if (stengt.length) {
      note.textContent = 'Lageret er stengt på lørdager. Velg en annen dag i handlekurven.';
      note.className = 'tid-note feil';
    } else {
      note.textContent = APNINGSTID_TEKST;
      note.className = 'tid-note';
    }
  }
  fyllTider();

  async function tegnVipps() {
    if (!vippsKnapp) return;
    const s = summer();

    // Serveren avgjør om betaling er mulig. Uten nøkler skal knappen aldri
    // være aktiv – en betalingsknapp som svarer med feil er verre enn ingen.
    let tilgjengelig = false;
    try {
      const res = await fetch('/api/betaling');
      tilgjengelig = res.ok && (await res.json()).tilgjengelig === true;
    } catch { /* nettverksfeil */ }

    const kan = tilgjengelig && s.kanBookes;
    vippsKnapp.disabled = !kan;
    skjema.querySelector('[data-vipps-belop]').textContent =
      kan ? '· ' + kr(Math.round(s.total * FORSKUDD_ANDEL)) : '';
    if (!kan && !tilgjengelig) {
      vippsKnapp.textContent = 'Betaling er ikke tilgjengelig akkurat nå';
    }
  }
  if (!erForesporsel) tegnVipps();

  function byggKropp(data) {
    const s = summer();
    const klikk = hentGclid();
    return {
      ...data,
      gclid: klikk ? klikk.id : null,
      gclidType: klikk ? klikk.type : null,
      navn: [data.fornavn, data.etternavn].filter(Boolean).join(' ').trim(),
      fra: bestilling.fra, til: bestilling.til,
      dager: s.d.har ? s.d.n : null,
      levering: bestilling.modus === 'lev' ? (bestilling.adresse || '(ikke oppgitt)') : 'Henter selv',
      koordinater: bestilling.valgt ? { lat: bestilling.valgt.lat, lon: bestilling.valgt.lon } : null,
      // Vi sender hva som er valgt, ikke hva det koster. Serveren regner
      // prisen selv – se src/pris.js. Sender vi summen herfra, kan hvem som
      // helst endre den i utviklerverktøyet før den går til Vipps.
      modus: bestilling.modus,
      kommune: bestilling.valgt?.kommune || null,
      linjer: PRODUKTER.filter(p => antall(p.id) > 0)
        .map(p => ({ id: p.id, antall: antall(p.id) }))
    };
  }

  const status = skjema.querySelector('[data-skjema-status]');
  const settFeil = (t) => { status.className = 'skjema-status feil'; status.textContent = t; };

  skjema.addEventListener('submit', async (e) => {
    e.preventDefault();
    const knapp = skjema.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(skjema));
    if (data.firma) return;                      // honningkrukke – bot fylte den ut

    // Kassen betaler. Forespørselsskjemaet sender e-post. Samme skjema-kode,
    // to helt ulike utfall – derfor skiller vi tidlig.
    if (!erForesporsel) return startBetaling(knapp, data);

    knapp.disabled = true;
    status.textContent = 'Sender …';
    status.className = 'skjema-status';
    try {
      const svar = await fetch('/api/foresporsel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(byggKropp(data))
      });
      if (!svar.ok) throw new Error('Serveren svarte ' + svar.status);
      const kvittering = await svar.json().catch(() => ({}));
      sporForesporsel(kvittering.total ?? summer().total);
      skjema.outerHTML = `<div class="kvittering">
        <span class="kvittering-hake">✓</span>
        <h2>Takk for forespørselen!</h2>
        <p>Vi sjekker tilgjengelighet og sender deg et uforpliktende tilbud innen 6 timer.</p>
        <a class="btn btn-mork" href="/">Til forsiden</a>
      </div>`;
      kurv = {};
      lagre();
    } catch (feil) {
      knapp.disabled = false;
      settFeil('Noe gikk galt. Prøv igjen, eller send e-post til post@bergutleie.no.');
    }
  });

  /* --- betal forskuddet med Vipps --- */
  async function startBetaling(knapp, data) {
    knapp.disabled = true;
    status.className = 'skjema-status';
    status.textContent = 'Åpner Vipps …';
    try {
      const svar = await fetch('/api/betaling', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(byggKropp(data))
      });
      const res = await svar.json().catch(() => ({}));
      if (!svar.ok || !res.redirectUrl) {
        throw new Error(res.feil || 'Serveren svarte ' + svar.status);
      }
      // Kurven tømmes ikke her – først når betalingen faktisk er gjennomført.
      // Avbryter kunden i Vipps, skal handlekurven ligge der som den var.
      window.location.href = res.redirectUrl;
    } catch (feil) {
      knapp.disabled = false;
      settFeil(feil.message || 'Fikk ikke åpnet Vipps. Prøv igjen, eller ring 412 41 285.');
    }
  }
}


/* --- tegn alt som avhenger av kurven --- */
function tegnAlt() {
  tegnTeller();
  tegnProduktside();
  tegnKurvside();
}

startMaling();
settOppMeny();
settOppGalleri();
settOppPakker();
settOppKurvside();
settOppTilbud();
tegnAlt();
