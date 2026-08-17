/* ===========================================================================
   Bilaget som følger e-posten som PDF.

   Dokumentet er to ting, avhengig av `d.betalt`:

     BOOKING   forskuddet er trukket i Vipps. Da er dette en kvittering og
               en bekreftelse – kunden skal kunne finne fram til lageret og
               se hva som gjenstår å betale.
     TILBUD    ikke betalt ennå. Da er det et pristilbud med gyldighet.

   MERK at kontonummer og KID med vilje IKKE står her lenger. Forskuddet
   betales med Vipps i kassen, og en giro ved siden av ville invitert til
   en dobbeltbetaling. Restbeløpet faktureres separat.

   Layouten holder seg til tre virkemidler: vekt, størrelse og luft.
   Streker brukes bare der øyet trenger å stoppe – ikke som dekor.
   ======================================================================== */

import { nyPdf, bredde, tilBase64 } from './pdf.js';
import { LOGO_JPEG, LOGO_B, LOGO_H } from './logo.js';
import { APNINGSTID_TEKST } from '../data/apningstid.js';

/* Fargene fra nettstedet, som PDF-verdier 0–1 */
const INK = [0.067, 0.231, 0.247];      // #113B3F
const AKSENT = [0.910, 0.337, 0.180];   // #E8562E
const DEMPET = [0.353, 0.431, 0.427];   // #5A6E6D
const DEMPET2 = [0.486, 0.553, 0.545];  // #7C8D8B
const LINJE = [0.898, 0.906, 0.882];    // #E5E7E1
const FLATE = [0.969, 0.965, 0.945];    // #F7F6F1
const GRONN = [0.118, 0.478, 0.267];    // #1E7A44 – betalt
const GRONN_FLATE = [0.918, 0.961, 0.933];

const V = 52;                            // venstre marg
const H = 543;                           // høyre kant
const kr = (n) => (Number(n) || 0).toLocaleString('nb-NO').replace(/ /g, ' ') + ' kr';

export function lagBilag(d) {
  const p = nyPdf(LOGO_JPEG, LOGO_B, LOGO_H);
  const betalt = !!d.betalt;
  let y = 792;

  /* ------------------------------------------------------------- topp --- */
  p.logo(V, y - 36, 100);

  p.tekst(H, y + 2, betalt ? 'BOOKING' : 'TILBUD',
    { fet: true, str: 7.5, f: DEMPET2, hoyre: true, sperre: 2.6 });
  const nr = String(d.tilbudsnr);
  p.tekst(H - bredde(nr, 21, true) - 5, y - 21, '#', { fet: true, str: 12, f: DEMPET2 });
  p.tekst(H, y - 21, nr, { fet: true, str: 21, f: INK, hoyre: true });
  p.tekst(H, y - 38, d.utstedt, { str: 8.5, f: DEMPET2, hoyre: true });

  y -= 66;
  p.rekt(V, y, H - V, 1, INK);
  y -= 36;

  /* ------------------------------------------- kunde og leieperiode ----- */
  const kol2 = 300;
  const overskrift = (x, t) => p.tekst(x, y, t, { fet: true, str: 7.5, f: AKSENT, sperre: 1.4 });

  overskrift(V, 'KUNDE');
  overskrift(kol2, d.henter ? 'HENTING OG RETUR' : 'LEVERING OG RETUR');
  y -= 18;

  const venstre = [d.navn, d.mobil, d.epost].filter(Boolean);
  const hoyre = [
    [d.henter ? 'Hentes' : 'Leveres ut', d.hentDato],
    [d.henter ? 'Leveres tilbake' : 'Hentes igjen', d.returDato]
  ];

  // To kolonner side om side. Venstre er ren liste, høyre er etikett + verdi
  // under hverandre, fordi datoene trenger mer plass enn en linje gir.
  let yv = y, yh = y;
  venstre.forEach(t => { p.tekst(V, yv, t, { str: 10.5, f: INK }); yv -= 15; });
  hoyre.forEach(([etikett, verdi]) => {
    p.tekst(kol2, yh, etikett, { str: 8.5, f: DEMPET2 });
    p.tekst(kol2, yh - 13, verdi || 'avtales', { fet: true, str: 10.5, f: INK });
    yh -= 31;
  });

  y = Math.min(yv, yh) - 12;

  /* --- hvor --- */
  overskrift(V, d.henter ? 'HENT PÅ LAGERET' : 'LEVERINGSADRESSE');
  y -= 18;
  p.tekst(V, y, d.henter ? 'Sørliveien 78, 1788 Halden' : d.levering, { str: 10.5, f: INK });
  y -= 14;
  p.tekst(V, y, d.henter ? `Rett ved E6 · ${APNINGSTID_TEKST}` : 'Utkjøring og henting er inkludert i prisen',
    { str: 9, f: DEMPET });

  /* -------------------------------------------------------- utstyret --- */
  y -= 40;
  overskrift(V, 'UTSTYR');
  y -= 17;

  const kAntall = 348, kPris = 438, kSum = H;
  p.tekst(V, y, 'Produkt', { str: 8, f: DEMPET2 });
  p.tekst(kAntall, y, 'Antall', { str: 8, f: DEMPET2, hoyre: true });
  p.tekst(kPris, y, 'Enhetspris', { str: 8, f: DEMPET2, hoyre: true });
  p.tekst(kSum, y, 'Sum', { str: 8, f: DEMPET2, hoyre: true });
  y -= 8;
  p.rekt(V, y, H - V, 0.8, LINJE);
  y -= 18;

  d.varer.forEach((v, i) => {
    // Annenhver rad får en svak flate i stedet for en strek. Øyet følger
    // linja like godt, og siden blir roligere.
    if (i % 2 === 1) p.rekt(V - 6, y - 6, H - V + 12, 20, FLATE);
    p.tekst(V, y, kutt(v.navn, 44), { str: 10.5, f: INK });
    p.tekst(kAntall, y, String(v.antall), { str: 10.5, f: DEMPET, hoyre: true });
    p.tekst(kPris, y, v.enhet ? kr(v.enhet) + (v.fast ? ' fast' : '') : '', { str: 10, f: DEMPET, hoyre: true });
    p.tekst(kSum, y, kr(v.sum), { fet: true, str: 10.5, f: INK, hoyre: true });
    y -= 23;
  });

  /* ------------------------------------------------------ sammendrag --- */
  y -= 4;
  const sumX = kPris;
  const sumLinje = (etikett, verdi, { fet = false, f = DEMPET } = {}) => {
    p.tekst(sumX, y, etikett, { str: fet ? 11 : 9.5, f: fet ? INK : f, fet, hoyre: true });
    p.tekst(kSum, y, verdi, { str: fet ? 14 : 9.5, f: INK, fet: true, hoyre: true });
    y -= fet ? 22 : 15;
  };

  sumLinje('Leie av utstyr', kr(d.leie));
  sumLinje(d.henter ? 'Henting på lager' : 'Levering og henting', d.frakt ? kr(d.frakt) : '0 kr');
  y -= 4;
  p.rekt(sumX - 132, y + 9, H - sumX + 132, 1, INK);
  y -= 10;
  sumLinje('Totalt', kr(d.total), { fet: true });
  p.tekst(kSum, y + 6, `herav mva 25 % · ${kr(d.mva)}`, { str: 8.5, f: DEMPET2, hoyre: true });
  y -= 12;

  /* --------------------------------------------------------- betaling --- */
  y -= 22;
  const boksH = betalt ? 86 : 76;
  p.rekt(V, y - boksH, H - V, boksH, betalt ? GRONN_FLATE : FLATE);
  p.rekt(V, y - boksH, 3, boksH, betalt ? GRONN : AKSENT);

  if (betalt) {
    p.tekst(V + 20, y - 22, 'BETALT MED VIPPS', { fet: true, str: 7.5, f: GRONN, sperre: 1.4 });
    p.tekst(V + 20, y - 46, kr(d.forskudd), { fet: true, str: 20, f: INK });
    p.tekst(V + 20 + bredde(kr(d.forskudd), 20, true) + 10, y - 46,
      `${d.forskuddProsent} % forskudd`, { str: 9.5, f: DEMPET });
    p.tekst(V + 20, y - 66,
      `Utstyret er reservert til deg. Restbeløpet, ${kr(d.rest)}, faktureres`,
      { str: 9.5, f: INK });
    p.tekst(V + 20, y - 78, 'etter at utstyret er levert tilbake.', { str: 9.5, f: INK });
  } else {
    p.tekst(V + 20, y - 22, 'FORSKUDDSBETALING FOR RESERVASJON', { fet: true, str: 7.5, f: AKSENT, sperre: 1.4 });
    p.tekst(V + 20, y - 46, kr(d.forskudd), { fet: true, str: 20, f: INK });
    p.tekst(V + 20 + bredde(kr(d.forskudd), 20, true) + 10, y - 46,
      `${d.forskuddProsent} % av totalen`, { str: 9.5, f: DEMPET });
    p.tekst(V + 20, y - 66,
      `Betales med Vipps når du bestiller. Resten, ${kr(d.rest)}, faktureres etter retur.`,
      { str: 9.5, f: INK });
  }
  y -= boksH + 26;

  /* -------------------------------------------------------- kommentar --- */
  if (d.kommentar) {
    overskrift(V, 'KOMMENTAR FRA KUNDEN');
    y -= 16;
    brytTekst(d.kommentar, 92).slice(0, 3).forEach(l => {
      p.tekst(V, y, l, { str: 9.5, f: DEMPET });
      y -= 13;
    });
  }

  /* -------------------------------------------------------- bunnlinje --- */
  p.rekt(V, 74, H - V, 0.8, LINJE);

  p.tekst(V, 58, 'Berg Utleie', { fet: true, str: 9.5, f: INK });
  p.tekst(V, 46, `Et varemerke av Berg Event · Org.nr. ${d.orgnr}`, { str: 8.5, f: DEMPET });
  p.tekst(V, 34, `${d.epostFirma} · 412 41 285 · bergutleie.no`, { str: 8.5, f: DEMPET });

  p.tekst(H, 58, 'Sørliveien 78, 1788 Halden', { str: 8.5, f: DEMPET, hoyre: true });
  p.tekst(H, 46, APNINGSTID_TEKST, { str: 8.5, f: DEMPET, hoyre: true });
  p.tekst(H, 34, betalt
    ? 'Alle priser inkl. mva · montering inngår ikke'
    : `Gyldig i ${d.gyldigDager} dager · priser inkl. mva`,
    { str: 8.5, f: DEMPET2, hoyre: true });

  return tilBase64(p.bygg());
}

/* ===========================================================================
   Kvittering for forskuddet.

   Kort med vilje. Kunden har allerede hele bookingen i e-posten – det som
   mangler er dokumentasjon på at pengene er betalt. Derfor bare beløp,
   dato, referanse og hvem som har mottatt dem.
   ======================================================================== */
export function lagKvittering(d) {
  const p = nyPdf(LOGO_JPEG, LOGO_B, LOGO_H);
  let y = 760;

  p.logo(V, y - 36, 100);
  p.tekst(H, y + 2, 'KVITTERING', { fet: true, str: 7.5, f: DEMPET2, hoyre: true, sperre: 2.6 });
  const nr = String(d.tilbudsnr);
  p.tekst(H - bredde(nr, 21, true) - 5, y - 21, '#', { fet: true, str: 12, f: DEMPET2 });
  p.tekst(H, y - 21, nr, { fet: true, str: 21, f: INK, hoyre: true });
  p.tekst(H, y - 38, d.utstedt, { str: 8.5, f: DEMPET2, hoyre: true });

  y -= 66;
  p.rekt(V, y, H - V, 1, INK);
  y -= 44;

  /* --- beløpet, stort og alene --- */
  p.tekst(V, y, 'BETALT MED VIPPS', { fet: true, str: 7.5, f: GRONN, sperre: 1.4 });
  y -= 34;
  p.tekst(V, y, kr(d.forskudd), { fet: true, str: 30, f: INK });
  y -= 20;
  p.tekst(V, y, `${d.forskuddProsent} % forskudd for reservasjon · alle priser inkl. mva`,
    { str: 9.5, f: DEMPET });

  /* --- hva det gjelder --- */
  y -= 40;
  const rad = (etikett, verdi, { fet = false } = {}) => {
    p.tekst(V, y, etikett, { str: 10, f: DEMPET });
    p.tekst(H, y, verdi, { fet: true, str: fet ? 12 : 10.5, f: INK, hoyre: true });
    y -= 19;
  };

  p.rekt(V, y + 13, H - V, 0.8, LINJE);
  y -= 9;
  rad('Gjelder booking', '#' + nr);
  rad('Leieperiode', d.periode);
  rad('Kunde', d.navn);
  rad('Totalbeløp for leien', kr(d.total));
  p.rekt(V, y + 13, H - V, 0.5, LINJE);
  y -= 9;
  rad('Betalt nå', kr(d.forskudd), { fet: true });
  rad('Gjenstår, faktureres etter retur', kr(d.rest));

  /* --- fotnote --- */
  y -= 16;
  p.rekt(V, y - 44, H - V, 44, FLATE);
  p.tekst(V + 16, y - 18, 'Restbeløpet trekkes ikke automatisk.', { str: 9.5, f: INK });
  p.tekst(V + 16, y - 31, 'Du får faktura etter at utstyret er levert tilbake.', { str: 9.5, f: DEMPET });

  /* --- bunnlinje --- */
  p.rekt(V, 74, H - V, 0.8, LINJE);
  p.tekst(V, 58, 'Berg Utleie', { fet: true, str: 9.5, f: INK });
  p.tekst(V, 46, `Et varemerke av Berg Event · Org.nr. ${d.orgnr}`, { str: 8.5, f: DEMPET });
  p.tekst(V, 34, `${d.epostFirma} · 412 41 285 · bergutleie.no`, { str: 8.5, f: DEMPET });
  p.tekst(H, 46, 'Sørliveien 78, 1788 Halden', { str: 8.5, f: DEMPET, hoyre: true });
  if (d.vippsRef) {
    p.tekst(H, 34, 'Vipps-ref. ' + d.vippsRef, { str: 8, f: DEMPET2, hoyre: true });
  }

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
