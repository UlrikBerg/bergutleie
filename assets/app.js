/* ===========================================================================
   Berg Utleie – klientlogikk.

   Sidene fungerer og er lesbare uten dette skriptet; her legges bare
   interaktiviteten på: handlekurv, galleri, pakkevisning og prisberegning.
   Kurven ligger i localStorage, så den følger deg mellom sidene.
   ======================================================================== */

import { PRODUKTER, STEDER, finn, sone, enhetspris, kr } from '/data/produkter.js';
import { teltSvg } from '/data/telt-svg.js';

const NOKKEL = 'bergutleie-kurv';

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
    setTimeout(() => { window.location.href = '/foresporsel/'; }, 600);
  }
});

function blink(el) {
  el.classList.add('blink');
  setTimeout(() => el.classList.remove('blink'), 400);
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
        `✓ I handlekurven: ${n} stk · <a href="/foresporsel/">Til handlekurven →</a>`;
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

/* --- handlekurv og forespørsel --- */
const kurvSide = {
  fra: '', til: '', modus: 'hent', adresse: ''
};

function dager() {
  const t1 = Date.parse(kurvSide.fra), t2 = Date.parse(kurvSide.til);
  if (isNaN(t1) || isNaN(t2) || t2 < t1) return { har: false, n: 1 };
  return { har: true, n: Math.max(1, Math.round((t2 - t1) / 86400000)) };
}

function stedTreff() {
  const a = kurvSide.adresse.trim().toLowerCase();
  if (a.length < 2) return null;
  return STEDER.find(s => a.includes(s.navn.toLowerCase())) || null;
}

function tegnKurvside() {
  const liste = document.querySelector('[data-kurv-liste]');
  if (!liste) return;

  const varer = PRODUKTER.filter(p => antall(p.id) > 0);
  const tom = document.querySelector('[data-kurv-tom]');
  const skjema = document.querySelector('[data-skjema-seksjon]');
  tom.hidden = varer.length > 0;
  liste.hidden = varer.length === 0;
  if (skjema) skjema.hidden = varer.length === 0;

  const d = dager();
  const dagerLabel = d.har ? (d.n === 1 ? '1 døgn' : d.n + ' dager') : '1–4 dager';

  liste.innerHTML = varer.map(p => {
    const e = enhetspris(p, d.n);
    return `
    <div class="kurv-rad">
      <span class="kurv-media">${p.bilder.length ? `<img src="${p.bilder[0].u}" alt="" loading="lazy">` : ''}</span>
      <div class="kurv-navn">
        <p class="navn"><a href="/utstyr/${p.slug}/">${p.navn}</a></p>
        <p class="enhet">${p.fast ? kr(p.fast) + ' fastpris /stk' : kr(e) + ' /stk for ' + dagerLabel}</p>
      </div>
      <div class="antall-boks synlig">
        <button type="button" class="dec" data-id="${p.id}" aria-label="Fjern én">−</button>
        <span class="val">${antall(p.id)}</span>
        <button type="button" class="inc" data-id="${p.id}" aria-label="Legg til én">+</button>
      </div>
      <span class="kurv-sum">${kr(antall(p.id) * e)}</span>
      <button type="button" class="fjern" data-fjern="${p.id}" aria-label="Fjern ${p.navn}">×</button>
    </div>`;
  }).join('');

  /* priser */
  let leie = 0, lastplass = 0;
  PRODUKTER.forEach(p => {
    leie += antall(p.id) * enhetspris(p, d.n);
    lastplass += antall(p.id) * p.lp;
  });

  let levering = 0, levLabel = '0 kr', adresseNote = '', tilbud = false;
  if (kurvSide.modus === 'lev') {
    const sted = stedTreff();
    if (!sted) {
      levLabel = 'Legg inn adresse';
      adresseNote = kurvSide.adresse.trim().length > 1
        ? 'Fant ikke stedet i ruteplanen – skriv nærmeste by (f.eks. Fredrikstad), eller send forespørsel så beregner vi.'
        : 'Skriv adressen, så finner vi fast fraktpris automatisk.';
    } else {
      const z = sone(sted.km);
      if (!z) {
        tilbud = true;
        levLabel = 'Etter avtale';
        adresseNote = sted.navn + ' ligger utenfor de faste sonene våre – vi gir deg fast pris på forespørsel.';
      } else {
        levering = z.pris;
        levLabel = kr(levering);
        adresseNote = 'Fast fraktpris til ' + sted.navn + ' – levering og henting av Berg Event-ansatte er inkludert.';
      }
    }
  }

  const settTekst = (sel, t) => { const e = document.querySelector(sel); if (e) e.textContent = t; };
  settTekst('[data-periode-tag]', '(' + dagerLabel + ')');
  settTekst('[data-leie]', kr(leie));
  settTekst('[data-levering]', levLabel);
  settTekst('[data-total]', tilbud ? kr(leie + levering) + ' + levering' : kr(leie + levering));
  settTekst('[data-dager-note]', !d.har
    ? 'Velg datoer – 1–4 dagers leie koster det samme.'
    : (d.n <= 4 ? dagerLabel + ' – samme pris som én dag.' : d.n + ' dager – +15 % per døgn utover 4.'));

  const aNote = document.querySelector('[data-adresse-note]');
  if (aNote) { aNote.textContent = adresseNote; aNote.hidden = !adresseNote; }
  const aFelt = document.querySelector('[data-adresse-felt]');
  if (aFelt) aFelt.hidden = kurvSide.modus !== 'lev';

  tegnInnsikt(lastplass);
}

/* Forslag basert på hva som ligger i kurven */
function tegnInnsikt() {
  const boks = document.querySelector('[data-innsikt]');
  if (!boks) return;
  const ut = [];
  const q = antall;
  const telt = PRODUKTER.filter(p => p.cat === 'Partytelt' && q(p.id) > 0);
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

function settOppKurvside() {
  const liste = document.querySelector('[data-kurv-liste]');
  if (!liste) return;

  const dl = document.getElementById('stederliste');
  if (dl) dl.innerHTML = STEDER.map(s => `<option value="${s.navn}">`).join('');

  document.querySelector('[data-fra]')?.addEventListener('change', (e) => { kurvSide.fra = e.target.value; tegnKurvside(); });
  document.querySelector('[data-til]')?.addEventListener('change', (e) => { kurvSide.til = e.target.value; tegnKurvside(); });
  document.querySelector('[data-adresse]')?.addEventListener('input', (e) => { kurvSide.adresse = e.target.value; tegnKurvside(); });

  document.querySelectorAll('[data-seg-modus] button').forEach(b => {
    b.addEventListener('click', () => {
      kurvSide.modus = b.dataset.val;
      document.querySelectorAll('[data-seg-modus] button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      tegnKurvside();
    });
  });

  liste.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fjern]');
    if (f) settAntall(f.dataset.fjern, 0);
  });

  const skjema = document.querySelector('[data-skjema]');
  skjema?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = skjema.querySelector('[data-skjema-status]');
    const knapp = skjema.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(skjema));
    if (data.firma) return;                      // honningkrukke – bot fylte den ut

    const d = dager();
    const sted = stedTreff();
    const z = sted ? sone(sted.km) : null;
    const kropp = {
      ...data,
      fra: kurvSide.fra, til: kurvSide.til,
      dager: d.har ? d.n : null,
      levering: kurvSide.modus === 'lev' ? (kurvSide.adresse || '(ikke oppgitt)') : 'Henter selv',
      fraktpris: kurvSide.modus === 'lev' && z ? z.pris : 0,
      varer: PRODUKTER.filter(p => antall(p.id) > 0)
        .map(p => ({ navn: p.navn, antall: antall(p.id), sum: antall(p.id) * enhetspris(p, d.n) }))
    };

    knapp.disabled = true;
    status.textContent = 'Sender …';
    status.className = 'skjema-status';
    try {
      const svar = await fetch('/api/foresporsel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(kropp)
      });
      if (!svar.ok) throw new Error('Serveren svarte ' + svar.status);
      skjema.innerHTML = `<div class="kvittering">
        <p class="kvittering-tittel">✓ Takk – forespørselen er sendt!</p>
        <p>Vi bekrefter tilgjengelighet på e-post innen 6 timer. Du hører fra oss på ${data.epost}.</p>
        <a class="btn" href="/">Tilbake til forsiden</a></div>`;
      kurv = {};
      lagre();
    } catch (feil) {
      knapp.disabled = false;
      status.className = 'skjema-status feil';
      status.textContent = 'Noe gikk galt. Prøv igjen, eller send e-post til post@bergutleie.no.';
    }
  });
}

/* --- tegn alt som avhenger av kurven --- */
function tegnAlt() {
  tegnTeller();
  tegnProduktside();
  tegnKurvside();
}

settOppGalleri();
settOppPakker();
settOppKurvside();
tegnAlt();
