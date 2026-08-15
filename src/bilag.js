/* ===========================================================================
   Bookingbilaget som legges ved forespørsels-e-posten som PDF.

   Stilrent og minimalistisk: logo, kundeopplysninger, leieperiode,
   utstyrsliste med enhetspris og sum, og et prissammendrag med mva
   og forskudd. Samme farger som nettstedet.
   ======================================================================== */

import { nyPdf, bredde, tilBase64 } from './pdf.js';
import { LOGO_JPEG, LOGO_B, LOGO_H } from './logo.js';

/* Fargene fra nettstedet, som PDF-verdier 0–1 */
const INK = [0.067, 0.231, 0.247];      // #113B3F
const AKSENT = [0.910, 0.337, 0.180];   // #E8562E
const DEMPET = [0.353, 0.431, 0.427];   // #5A6E6D
const DEMPET2 = [0.486, 0.553, 0.545];  // #7C8D8B
const LINJE = [0.898, 0.906, 0.882];    // #E5E7E1
const FLATE = [0.969, 0.965, 0.945];    // #F7F6F1

const V = 52;                            // venstre marg
const H = 543;                           // høyre kant
const kr = (n) => (Number(n) || 0).toLocaleString('nb-NO').replace(/ /g, ' ') + ' kr';

export function lagBilag(d) {
  const p = nyPdf(LOGO_JPEG, LOGO_B, LOGO_H);
  let y = 790;

  /* --- topp: logo og dokumenttype --- */
  p.logo(V, y - 34, 104);
  p.tekst(H, y + 6, 'BOOKINGDETALJER', { fet: true, str: 9, f: DEMPET2, hoyre: true });
  p.tekst(H, y - 12, d.referanse, { fet: true, str: 16, f: INK, hoyre: true });
  p.tekst(H, y - 28, d.utstedt, { str: 9, f: DEMPET2, hoyre: true });

  y -= 62;
  p.rekt(V, y, H - V, 1.2, INK);
  y -= 34;

  /* --- kunde og leieperiode side om side --- */
  const kol2 = 310;
  p.tekst(V, y, 'KUNDE', { fet: true, str: 8, f: AKSENT });
  p.tekst(kol2, y, 'LEIEPERIODE', { fet: true, str: 8, f: AKSENT });
  y -= 17;

  const rad = (venstre, hoyre2) => {
    if (venstre) p.tekst(V, y, venstre, { str: 10.5, f: INK });
    if (hoyre2) p.tekst(kol2, y, hoyre2, { str: 10.5, f: INK });
    y -= 15;
  };
  rad(d.navn, d.periode);
  rad(d.mobil, d.dagerLabel);
  rad(d.epost, '');
  y -= 6;

  p.tekst(V, y, d.henter ? 'HENTING' : 'LEVERINGSADRESSE', { fet: true, str: 8, f: AKSENT });
  y -= 17;
  p.tekst(V, y, d.henter ? 'Hentes på lageret ved E6 i Halden' : d.levering, { str: 10.5, f: INK });
  y -= 14;
  p.tekst(V, y, d.henter ? 'Åpent man-fre 09-18 og søndag 12-15' : 'Utkjøring og henting er inkludert', { str: 9.5, f: DEMPET });

  /* --- utstyrstabell --- */
  y -= 42;
  p.tekst(V, y, 'UTSTYR', { fet: true, str: 8, f: AKSENT });
  y -= 16;

  const kAntall = 330, kPris = 430, kSum = H;
  p.tekst(V, y, 'Produkt', { fet: true, str: 8, f: DEMPET2 });
  p.tekst(kAntall, y, 'Antall', { fet: true, str: 8, f: DEMPET2, hoyre: true });
  p.tekst(kPris, y, 'Pris', { fet: true, str: 8, f: DEMPET2, hoyre: true });
  p.tekst(kSum, y, 'Sum', { fet: true, str: 8, f: DEMPET2, hoyre: true });
  y -= 7;
  p.rekt(V, y, H - V, 0.8, LINJE);
  y -= 17;

  d.varer.forEach(v => {
    p.tekst(V, y, kutt(v.navn, 42), { str: 10.5, f: INK });
    p.tekst(kAntall, y, String(v.antall), { str: 10.5, f: DEMPET, hoyre: true });
    p.tekst(kPris, y, v.enhet ? kr(v.enhet) + (v.fast ? ' fast' : '') : '', { str: 10.5, f: DEMPET, hoyre: true });
    p.tekst(kSum, y, kr(v.sum), { fet: true, str: 10.5, f: INK, hoyre: true });
    y -= 8;
    p.rekt(V, y, H - V, 0.5, LINJE);
    y -= 15;
  });

  /* --- sammendrag --- */
  y -= 12;
  const sumLinje = (etikett, verdi, { fet = false, f = DEMPET } = {}) => {
    p.tekst(kPris, y, etikett, { str: fet ? 11 : 10, f: fet ? INK : f, fet, hoyre: true });
    p.tekst(kSum, y, verdi, { str: fet ? 13 : 10, f: INK, fet: true, hoyre: true });
    y -= fet ? 20 : 15;
  };

  sumLinje('Leie av utstyr', kr(d.leie));
  sumLinje(d.henter ? 'Henting på lager' : 'Levering og henting', d.frakt ? kr(d.frakt) : '0 kr');
  y -= 3;
  p.rekt(kPris - 120, y + 8, H - kPris + 120, 0.5, LINJE);
  y -= 8;
  sumLinje('Sum eks. mva', kr(d.utenMva));
  sumLinje('Mva 25 %', kr(d.mva));
  y -= 2;
  p.rekt(kPris - 120, y + 10, H - kPris + 120, 1.2, INK);
  y -= 6;
  sumLinje('Totalt inkl. mva', kr(d.total), { fet: true });

  /* --- betaling --- */
  y -= 16;
  const boksH = 76;
  p.rekt(V, y - boksH, H - V, boksH, FLATE);
  p.rekt(V, y - boksH, 2.5, boksH, AKSENT);
  p.tekst(V + 16, y - 20, 'BETALING', { fet: true, str: 8, f: AKSENT });
  p.tekst(V + 16, y - 38, `Forskudd 50 %: ${kr(d.forskudd)}`, { fet: true, str: 11.5, f: INK });
  p.tekst(V + 16, y - 53, d.henter
    ? 'Må være betalt før utstyret hentes.'
    : 'Må være betalt før vi kjører ut utstyret.', { str: 9.5, f: DEMPET });
  p.tekst(V + 16, y - 66, `Resten, ${kr(d.rest)}, faktureres etter at utstyret er levert tilbake.`,
    { str: 9.5, f: DEMPET });
  y -= boksH + 22;

  /* --- kommentar --- */
  if (d.kommentar) {
    p.tekst(V, y, 'KOMMENTAR FRA KUNDEN', { fet: true, str: 8, f: AKSENT });
    y -= 16;
    brytTekst(d.kommentar, 88).slice(0, 4).forEach(l => {
      p.tekst(V, y, l, { str: 10, f: INK });
      y -= 14;
    });
  }

  /* --- bunnlinje --- */
  p.rekt(V, 66, H - V, 0.5, LINJE);
  p.tekst(V, 52, 'Berg Utleie', { fet: true, str: 9, f: INK });
  p.tekst(V, 40, 'bergutleie.no  ·  post@bergutleie.no', { str: 9, f: DEMPET });
  p.tekst(H, 52, 'Lageret ved E6 i Halden', { str: 9, f: DEMPET, hoyre: true });
  p.tekst(H, 40, 'Alle priser er inkl. mva. Montering inngår ikke.', { str: 9, f: DEMPET2, hoyre: true });

  return tilBase64(p.bygg());
}

function kutt(s, maks) {
  return s.length > maks ? s.slice(0, maks - 1) + '…' : s;
}

function brytTekst(s, bredde2) {
  const ord = String(s).replace(/\s+/g, ' ').trim().split(' ');
  const linjer = [];
  let n = '';
  for (const o of ord) {
    if ((n + ' ' + o).trim().length > bredde2) { linjer.push(n.trim()); n = o; }
    else n += ' ' + o;
  }
  if (n.trim()) linjer.push(n.trim());
  return linjer;
}
