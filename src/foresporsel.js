/* ===========================================================================
   POST /api/foresporsel

   Tar imot forespørselen fra handlekurven og sender den som e-post til
   kontakt@bergevent.no. Kalles fra src/index.js – ingen egen server å drifte.

   E-posten sendes både som HTML og ren tekst, slik at den er lesbar
   uansett hvilken e-postklient som åpner den.

   Krever to miljøvariabler i Cloudflare (Settings → Variables and Secrets):
     RESEND_API_KEY   API-nøkkel fra resend.com
     VARSEL_TIL       e-postadressen forespørslene skal til

   Se DEPLOY.md for oppsettet.
   ======================================================================== */

import { lagBilag } from './bilag.js';
import { regnUt } from './pris.js';
import { FORSKUDD_ANDEL, FORSKUDD_PROSENT } from '../data/vilkar.js';
import { APNINGSTID_TEKST, erBetjent } from '../data/apningstid.js';

const AVSENDER = 'Berg Utleie <skjema@bergutleie.no>';
const MVA_SATS = 0.25;          // prisene på nettsiden er oppgitt inkl. mva
const GYLDIG_DAGER = 2;         // hvor lenge tilbudet står ved lag
const KONTONR = '9803 22 90426';
const ORGNR = '919 326 581';
const EPOST = 'post@bergutleie.no';
const TILBUDSNR_START = 17512;

/* Fargene fra nettstedet, så e-posten kjennes igjen */
const C = {
  ink: '#113B3F', aksent: '#E8562E', bg: '#F7F6F1',
  linje: '#E5E7E1', dempet: '#5A6E6D', dempet2: '#7C8D8B'
};

/** Neste tilbudsnummer. Teller opp i KV; uten KV brukes et tidsbasert
    nummer som også er unikt og stigende, bare med hull i rekka. */
async function nesteTilbudsnr(env) {
  if (env.TELLER) {
    try {
      const forrige = parseInt(await env.TELLER.get('tilbudsnr'), 10);
      const neste = (isNaN(forrige) ? TILBUDSNR_START : forrige) + 1;
      await env.TELLER.put('tilbudsnr', String(neste));
      return neste;
    } catch { /* faller gjennom til reserven */ }
  }
  const minutterSidenStart = Math.floor((Date.now() - Date.UTC(2026, 7, 15)) / 60000);
  return TILBUDSNR_START + minutterSidenStart;
}

export async function handterForesporsel(request, env) {
  let data;
  try {
    data = await request.json();
  } catch {
    return svar(400, { feil: 'Ugyldig forespørsel' });
  }

  // Honningkrukke: feltet er skjult for mennesker, så utfylt = bot.
  // Vi svarer 200 så boten ikke skjønner at den ble avvist.
  if (data.firma) return svar(200, { ok: true });

  const klar = await klargjor(data, env);
  if (klar.feil) return svar(400, { feil: klar.feil });

  if (!env.RESEND_API_KEY) {
    return svar(500, { feil: 'E-post er ikke satt opp ennå.' });
  }
  if (!await sendVarsel(env, klar.felles)) {
    return svar(502, { feil: 'Klarte ikke å sende e-posten.' });
  }

  // Totalen sendes tilbake så konverteringen til Google Ads får serverens
  // tall, ikke nettleserens. Ellers kunne annonsestatistikken vise
  // ordreverdier som aldri fantes.
  return svar(200, { ok: true, total: klar.felles.total });
}

/**
 * Validerer det klienten sendte, regner prisen og bygger bookingen.
 * Delt mellom forespørselsflyten og betalingsflyten, slik at en booking
 * som betales med Vipps er nøyaktig samme objekt som en som faktureres.
 *
 * @returns { feil } ved ugyldige data, ellers { felles, pris }
 */
export async function klargjor(data, env) {
  const navn = tekst(data.navn, 100)
    || [tekst(data.fornavn, 60), tekst(data.etternavn, 60)].filter(Boolean).join(' ');
  const mobil = tekst(data.mobil, 40) || 'Ikke oppgitt';
  const epost = tekst(data.epost, 120);
  if (!navn || !epost || !epost.includes('@')) {
    return { feil: 'Fyll ut navn og e-post.' };
  }

  const fra = tekst(data.fra, 20), til = tekst(data.til, 20);

  // Prisen regnes her, ikke i nettleseren. Klienten sier bare hva som er
  // valgt – se src/pris.js for hvorfor det er verdt et eget steg.
  const pris = regnUt({
    linjer: data.linjer,
    fra, til,
    modus: tekst(data.modus, 10),
    kommune: tekst(data.kommune, 80)
  });
  if (!pris.ok) return { feil: pris.feil };

  const { varer, leie, frakt, total, dagerLabel } = pris;
  const utenMva = Math.round(total / (1 + MVA_SATS));
  const mva = total - utenMva;

  // Klokkeslett for henting og retur. Valideres mot åpningstidene i
  // sjekkBooking() før det tas betalt – her bare leses de inn.
  const hentetid = /^\d{2}:\d{2}$/.test(data.hentetid || '') ? data.hentetid : '';
  const returtid = /^\d{2}:\d{2}$/.test(data.returtid || '') ? data.returtid : '';

  const periode = fra && til ? `${norskDato(fra)} – ${norskDato(til)}` : 'Ikke valgt';
  const levering = tekst(data.levering, 200) || 'Ikke oppgitt';
  // Samme kilde som frakten regnes ut fra. Leses den av teksten i stedet,
  // kan e-posten si «Henting» om en booking det er tatt betalt utkjøring for.
  const henter = tekst(data.modus, 10) !== 'lev';
  const kommentar = tekst(data.kommentar, 2000);
  // Kom kunden fra en annonse, følger klikk-ID-en med. Den trengs for å
  // rapportere den faktiske ordreverdien tilbake til Google senere.
  const gclid = tekst(data.gclid, 200);
  const gclidType = tekst(data.gclidType, 20) || 'gclid';

  // Worker-en kjører i UTC, Norge ligger 1–2 timer foran. Uten omregning
  // dateres alt som sendes mellom midnatt og klokka to til gårsdagen – og
  // da blir «gyldig i 2 dager fra …» en dag for kort.
  const naa = norskNaa();
  const tilbudsnr = await nesteTilbudsnr(env);

  const felles = { navn, mobil, epost, periode, dagerLabel, levering, henter,
                   varer, leie, frakt, total, utenMva, mva, kommentar,
                   gclid, gclidType,
                   hentetid, returtid,
                   // «(selvbetjent)» står i bekreftelsen og på bilaget, slik at
                   // kunden ikke møter en låst dør og lurer på om noe er galt.
                   hentSelvbetjent: !!(fra && hentetid) && !erBetjent(fra, hentetid),
                   returSelvbetjent: !!(til && returtid) && !erBetjent(til, returtid),
                   hentDato: medTid(fra, hentetid),
                   returDato: medTid(til, returtid),
                   tilbudsnr,
                   kontonr: KONTONR, orgnr: ORGNR, epostFirma: EPOST,
                   utstedt: `${naa.dag}. ${MANEDER[naa.maned]} ${naa.aar}`,
                   gyldigDager: GYLDIG_DAGER,
                   forskudd: Math.round(total * FORSKUDD_ANDEL),
                   rest: total - Math.round(total * FORSKUDD_ANDEL),
                   forskuddProsent: FORSKUDD_PROSENT };

  // `rå` er det klienten sendte, etter opprydding. Betalingsflyten trenger
  // det for å validere booking mot åpningstidene.
  return { felles, pris, rå: { fra, til, modus: tekst(data.modus, 10), kommune: tekst(data.kommune, 80) } };
}

/**
 * Sender varselet til lageret, med bookingdetaljene som PDF.
 *
 * @param betalt  true når forskuddet allerede er trukket i Vipps. Da er
 *                dette ikke en forespørsel å svare på, men en bekreftet
 *                booking – og emnefeltet må si det, ellers behandles den
 *                som om den fortsatt venter på et tilbud.
 * @returns true hvis e-posten gikk ut
 */
export async function sendVarsel(env, d, { betalt = false } = {}) {
  if (!env.RESEND_API_KEY) return false;

  const emne = betalt
    ? `BETALT #${d.tilbudsnr} – ${d.navn} – ${nok(d.forskudd)} av ${nok(d.total)}`
    : `Forespørsel #${d.tilbudsnr} fra ${d.navn} – ${nok(d.total)}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: AVSENDER,
      to: [env.VARSEL_TIL || 'kontakt@bergevent.no'],
      reply_to: d.epost,
      subject: emne + (d.periode !== 'Ikke valgt' ? ' – ' + d.periode : ''),
      html: htmlEpost(d, betalt),
      text: tekstEpost(d, betalt),
      attachments: [{
        filename: `${betalt ? 'Booking' : 'Tilbud'}-${d.tilbudsnr}-Berg-Utleie.pdf`,
        content: lagBilag(d)
      }]
    })
  });
  return res.ok;
}

/**
 * Bekreftelse til kunden etter betalt reservasjon.
 *
 * Uten denne har kunden ingenting å vise til når fanen er lukket – bare et
 * trekk i Vipps. Da ringer de og spør om det gikk gjennom, hva de har
 * bestilt, og når de skal hente. Alt det står her.
 */
export async function sendKundebekreftelse(env, d) {
  if (!env.RESEND_API_KEY) return false;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: AVSENDER,
      to: [d.epost],
      reply_to: env.VARSEL_TIL || 'kontakt@bergevent.no',
      subject: `Bookingen din er bekreftet – Berg Utleie #${d.tilbudsnr}`,
      html: kundeHtml(d),
      text: kundeTekst(d),
      attachments: [{
        filename: `Booking-${d.tilbudsnr}-Berg-Utleie.pdf`,
        content: lagBilag(d)
      }]
    })
  });
  return res.ok;
}

function kundeHtml(d) {
  const rad = (etikett, verdi) => `
    <tr>
      <td style="padding:7px 16px 7px 0;font-size:14px;color:${C.dempet2};white-space:nowrap;vertical-align:top;">${etikett}</td>
      <td style="padding:7px 0;font-size:15px;color:${C.ink};font-weight:600;">${verdi}</td>
    </tr>`;

  return `<!doctype html>
<html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bookingen din er bekreftet</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${C.linje};">

  <tr><td style="background:${C.ink};padding:28px 30px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#7FA09E;">Berg Utleie</p>
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">Bookingen din er bekreftet</h1>
    <p style="margin:8px 0 0;font-size:15px;color:#BCD0CE;">Booking #${d.tilbudsnr} · utstyret er reservert til deg</p>
  </td></tr>

  <tr><td style="padding:26px 30px 4px;">
    <p style="margin:0 0 18px;font-size:16px;color:${C.ink};line-height:1.6;">
      Hei ${esc(d.navn.split(' ')[0])}, takk for bestillingen! Vi har mottatt
      <strong>${nok(d.forskudd)}</strong> i forskudd, og utstyret er satt av til deg.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      ${rad(d.henter ? 'Hentes' : 'Leveres ut', esc(d.hentDato))}
      ${rad(d.henter ? 'Leveres tilbake' : 'Hentes igjen', esc(d.returDato))}
      ${rad(d.henter ? 'Sted' : 'Adresse', d.henter
          ? 'Sørliveien 78, 1788 Halden<br><span style="font-weight:400;color:' + C.dempet + ';font-size:13.5px;">Rett ved E6</span>'
          : esc(d.levering))}
    </table>
  </td></tr>

  <tr><td style="padding:20px 30px 0;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.aksent};">Dette har du bestilt</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${d.varer.map(v => `
      <tr>
        <td style="padding:8px 8px 8px 0;border-bottom:1px solid ${C.linje};font-size:15px;color:${C.ink};">
          ${Number(v.antall) || 0} × ${esc(v.navn)}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid ${C.linje};font-size:15px;color:${C.ink};text-align:right;white-space:nowrap;">
          ${nok(v.sum)}
        </td>
      </tr>`).join('')}
      ${d.frakt ? `
      <tr>
        <td style="padding:8px 8px 8px 0;border-bottom:1px solid ${C.linje};font-size:15px;color:${C.ink};">Levering og henting</td>
        <td style="padding:8px 0;border-bottom:1px solid ${C.linje};font-size:15px;color:${C.ink};text-align:right;">${nok(d.frakt)}</td>
      </tr>` : ''}
    </table>
  </td></tr>

  <tr><td style="padding:16px 30px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:10px 0;font-size:16px;color:${C.ink};font-weight:700;border-top:2px solid ${C.ink};">Totalt</td>
        <td style="padding:10px 0;font-size:18px;color:${C.ink};text-align:right;font-weight:800;border-top:2px solid ${C.ink};">${nok(d.total)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:14.5px;color:#1E7A44;font-weight:600;">Betalt nå med Vipps (${d.forskuddProsent} %)</td>
        <td style="padding:6px 0;font-size:14.5px;color:#1E7A44;text-align:right;font-weight:700;">− ${nok(d.forskudd)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:14.5px;color:${C.dempet};">Faktureres etter retur</td>
        <td style="padding:6px 0;font-size:14.5px;color:${C.ink};text-align:right;font-weight:700;">${nok(d.rest)}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 30px 26px;">
    <div style="background:${C.bg};border-radius:10px;padding:18px 20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${C.ink};">Godt å vite</p>
      <p style="margin:0 0 6px;font-size:14px;color:${C.dempet};line-height:1.6;">
        Restbeløpet på ${nok(d.rest)} faktureres først etter at utstyret er levert tilbake – ingenting mer trekkes automatisk.
      </p>
      <p style="margin:0 0 6px;font-size:14px;color:${C.dempet};line-height:1.6;">
        Montering inngår ikke. Trenger du hjelp til opprigg, si fra i god tid.
      </p>
      <p style="margin:0;font-size:14px;color:${C.dempet};line-height:1.6;">
        Må noe endres, eller passer ikke datoen likevel? Svar på denne e-posten, så finner vi en løsning.
      </p>
    </div>
  </td></tr>

  <tr><td style="background:${C.bg};padding:18px 30px;border-top:1px solid ${C.linje};">
    <p style="margin:0 0 4px;font-size:13px;color:${C.ink};font-weight:600;">Berg Utleie</p>
    <p style="margin:0;font-size:12.5px;color:${C.dempet2};line-height:1.7;">
      Sørliveien 78, 1788 Halden · ${APNINGSTID_TEKST}<br>
      <a href="mailto:${EPOST}" style="color:${C.dempet};">${EPOST}</a> ·
      <a href="tel:+4741241285" style="color:${C.dempet};">412 41 285</a> ·
      <a href="https://bergutleie.no" style="color:${C.dempet};">bergutleie.no</a><br>
      Et varemerke av Berg Event · Org.nr. ${ORGNR}
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function kundeTekst(d) {
  return [
    `Hei ${d.navn.split(' ')[0]},`,
    '',
    `Takk for bestillingen! Bookingen din er bekreftet, og utstyret er reservert til deg.`,
    '',
    `BOOKING #${d.tilbudsnr}`,
    `  ${d.henter ? 'Hentes:         ' : 'Leveres ut:     '} ${d.hentDato}`,
    `  ${d.henter ? 'Leveres tilbake:' : 'Hentes igjen:   '} ${d.returDato}`,
    d.henter
      ? '  Sted:            Sørliveien 78, 1788 Halden (rett ved E6)'
      : `  Adresse:         ${d.levering}`,
    '',
    'DETTE HAR DU BESTILT',
    ...d.varer.map(v => `  ${v.antall} × ${v.navn} — ${nok(v.sum)}`),
    ...(d.frakt ? [`  Levering og henting — ${nok(d.frakt)}`] : []),
    '',
    `  Totalt:                ${nok(d.total)}`,
    `  Betalt nå med Vipps:   ${nok(d.forskudd)} (${d.forskuddProsent} %)`,
    `  Faktureres etter retur: ${nok(d.rest)}`,
    '',
    'GODT Å VITE',
    `  Restbeløpet faktureres først etter at utstyret er levert tilbake.`,
    '  Montering inngår ikke.',
    '  Må noe endres, svar på denne e-posten.',
    '',
    'Berg Utleie',
    `Sørliveien 78, 1788 Halden · ${APNINGSTID_TEKST}`,
    `${EPOST} · 412 41 285 · bergutleie.no`,
    `Et varemerke av Berg Event · Org.nr. ${ORGNR}`
  ].join('\n');
}

/* ---------------------------------------------------------------- HTML --- */

function htmlEpost(d, betalt = false) {
  const rad = (v) => `
    <tr>
      <td style="padding:11px 8px 11px 0;border-bottom:1px solid ${C.linje};font-size:15px;color:${C.ink};">
        <strong style="font-weight:700;">${esc(v.navn)}</strong>
      </td>
      <td style="padding:11px 8px;border-bottom:1px solid ${C.linje};font-size:14px;color:${C.dempet};text-align:center;white-space:nowrap;">
        ${Number(v.antall) || 0} stk
      </td>
      <td style="padding:11px 8px;border-bottom:1px solid ${C.linje};font-size:14px;color:${C.dempet};text-align:right;white-space:nowrap;">
        ${v.enhet ? nok(v.enhet) + (v.fast ? ' fast' : '') : ''}
      </td>
      <td style="padding:11px 0 11px 8px;border-bottom:1px solid ${C.linje};font-size:15px;color:${C.ink};text-align:right;font-weight:700;white-space:nowrap;">
        ${nok(v.sum)}
      </td>
    </tr>`;

  const sumRad = (etikett, verdi, fet) => `
    <tr>
      <td style="padding:${fet ? '13px' : '6px'} 0 ${fet ? '13px' : '6px'};font-size:${fet ? '17px' : '14.5px'};color:${fet ? C.ink : C.dempet};font-weight:${fet ? '800' : '400'};${fet ? `border-top:2px solid ${C.ink};` : ''}">
        ${etikett}
      </td>
      <td style="padding:${fet ? '13px' : '6px'} 0 ${fet ? '13px' : '6px'};font-size:${fet ? '22px' : '14.5px'};color:${C.ink};text-align:right;font-weight:${fet ? '800' : '700'};white-space:nowrap;${fet ? `border-top:2px solid ${C.ink};` : ''}">
        ${verdi}
      </td>
    </tr>`;

  const infoRad = (etikett, verdi) => `
    <tr>
      <td style="padding:5px 16px 5px 0;font-size:13px;color:${C.dempet2};white-space:nowrap;vertical-align:top;">${etikett}</td>
      <td style="padding:5px 0;font-size:15px;color:${C.ink};font-weight:600;">${verdi}</td>
    </tr>`;

  return `<!doctype html>
<html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ny forespørsel</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${C.linje};">

  <tr><td style="background:${C.ink};padding:26px 30px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#7FA09E;">Berg Utleie</p>
    <h1 style="margin:0;font-size:23px;font-weight:800;color:#ffffff;">${betalt ? 'Booking betalt' : 'Ny forespørsel'}</h1>
    <p style="margin:6px 0 0;font-size:14px;color:#BCD0CE;">${esc(d.navn)} · ${nok(d.total)} · ${betalt ? 'Booking' : 'Tilbud'} #${d.tilbudsnr}</p>
  </td></tr>

  <tr><td style="padding:26px 30px 6px;">
    <p style="margin:0 0 12px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.aksent};">Kunde</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${infoRad('Navn', esc(d.navn))}
      ${infoRad('Mobil', `<a href="tel:${esc(d.mobil.replace(/\s/g, ''))}" style="color:${C.ink};text-decoration:none;">${esc(d.mobil)}</a>`)}
      ${infoRad('E-post', `<a href="mailto:${esc(d.epost)}" style="color:${C.aksent};text-decoration:none;">${esc(d.epost)}</a>`)}
    </table>
  </td></tr>

  <tr><td style="padding:22px 30px 6px;">
    <p style="margin:0 0 12px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.aksent};">Leie</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${infoRad('Periode', esc(d.periode) + ` <span style="color:${C.dempet2};font-weight:400;">(${esc(d.dagerLabel)})</span>`)}
      ${infoRad(d.henter ? 'Henting' : 'Levering', esc(d.levering))}
    </table>
  </td></tr>

  <tr><td style="padding:22px 30px 0;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.aksent};">Utstyr</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <th align="left" style="padding:0 8px 8px 0;font-size:11.5px;font-weight:700;color:${C.dempet2};text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid ${C.linje};">Produkt</th>
        <th align="center" style="padding:0 8px 8px;font-size:11.5px;font-weight:700;color:${C.dempet2};text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid ${C.linje};">Antall</th>
        <th align="right" style="padding:0 8px 8px;font-size:11.5px;font-weight:700;color:${C.dempet2};text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid ${C.linje};">Pris</th>
        <th align="right" style="padding:0 0 8px 8px;font-size:11.5px;font-weight:700;color:${C.dempet2};text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid ${C.linje};">Sum</th>
      </tr>
      ${d.varer.map(rad).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:18px 30px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${sumRad('Leie av utstyr', nok(d.leie))}
      ${sumRad(d.henter ? 'Henting på lager' : 'Levering og henting', fraktTekst(d))}
      ${sumRad(`Herav mva (${MVA_SATS * 100} %)`, nok(d.mva))}
      ${sumRad('Sum eks. mva', nok(d.utenMva))}
      ${sumRad('Totalt inkl. mva', nok(d.total), true)}
    </table>
  </td></tr>

  ${d.kommentar ? `
  <tr><td style="padding:0 30px 26px;">
    <div style="background:${C.bg};border-left:3px solid ${C.aksent};border-radius:8px;padding:16px 18px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.dempet};">Kommentar fra kunden</p>
      <p style="margin:0;font-size:15px;color:${C.ink};line-height:1.6;white-space:pre-wrap;">${esc(d.kommentar)}</p>
    </div>
  </td></tr>` : ''}

  ${d.gclid ? `
  <tr><td style="padding:0 30px 22px;">
    <p style="margin:0;font-size:12px;color:${C.dempet2 || C.dempet};">
      Fra Google-annonse · ${esc(d.gclidType)}: <span style="font-family:ui-monospace,Menlo,monospace;">${esc(d.gclid)}</span>
    </p>
  </td></tr>` : ''}

  ${betalt ? `
  <tr><td style="padding:0 30px 30px;">
    <div style="background:#EAF5EE;border-left:3px solid #1E7A44;border-radius:8px;padding:16px 18px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1E7A44;">Forskuddet er betalt med Vipps</p>
      <p style="margin:0;font-size:15px;color:${C.ink};line-height:1.6;">
        <strong>${nok(d.forskudd)}</strong> er trukket. Utstyret er reservert, og
        kunden har fått kvittering. Restbeløpet på <strong>${nok(d.rest)}</strong>
        faktureres etter at utstyret er levert tilbake.
      </p>
      ${d.vippsRef ? `<p style="margin:8px 0 0;font-size:12px;color:${C.dempet2};">Vipps-referanse: <span style="font-family:ui-monospace,Menlo,monospace;">${esc(d.vippsRef)}</span></p>` : ''}
    </div>
  </td></tr>` : `
  <tr><td style="padding:0 30px 30px;">
    <a href="${svarmal(d)}"
       style="display:inline-block;background:${C.aksent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:8px;">
      Bekreft bookingen til ${esc(d.navn.split(' ')[0])}
    </a>
    <p style="margin:12px 0 0;font-size:12.5px;color:${C.dempet2};">
      Åpner en ferdig bekreftelse med hentetidspunkt, forskudd og forespørselen sitert under.
      Bookingdetaljene ligger vedlagt som PDF – den kan videresendes til kunden.
    </p>
  </td></tr>`}

  <tr><td style="background:${C.bg};padding:16px 30px;border-top:1px solid ${C.linje};">
    <p style="margin:0;font-size:12px;color:${C.dempet2};">
      Sendt fra skjemaet på <a href="https://bergutleie.no" style="color:${C.dempet};">bergutleie.no</a>.
      Prisene er beregnet av kalkulatoren og må bekreftes før tilbud sendes.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}


/** Ferdig utfylt bekreftelse til kunden, som åpnes av knappen i e-posten. */
function svarmal(d) {
  const fornavn = d.navn.split(' ')[0];
  const bredde = 42;
  const linje = (a, b) => '  ' + a.padEnd(bredde - String(b).length, '.') + ' ' + b;
  const forskudd = Math.round(d.total * FORSKUDD_ANDEL);
  const rest = d.total - forskudd;

  const kropp = [
    `Hei ${fornavn},`,
    '',
    `Vi kontakter deg vedrørende henvendelsen om booking av selskapsutstyr`,
    `${d.periode === 'Ikke valgt' ? '' : 'til ' + d.periode + '. '}Utstyret er satt av til deg, og avtalen er med dette bekreftet.`,
    '',
    'HENTING OG TILBAKELEVERING',
    ...(d.henter
      ? [
          `  Hentes:            ${d.hentDato}`,
          `  Leveres tilbake:   ${d.returDato}`,
          '  Sted: Sørliveien 78, 1788 Halden (rett ved E6).',
          '  Åpent man–fre 09–18 og søndag 12–15.'
        ]
      : [
          `  Leveres ut:        ${d.hentDato}`,
          `  Hentes igjen:      ${d.returDato}`,
          `  Adresse: ${d.levering}`
        ]),
    '',
    'UTSTYRET',
    ...d.varer.map(v => linje(`${v.antall} × ${v.navn}`, nok(v.sum))),
    ...(d.frakt ? [linje('Levering og henting', nok(d.frakt))] : []),
    '  ' + '-'.repeat(bredde),
    linje('Totalt inkl. mva', nok(d.total)),
    '',
    'BETALING',
    `Tilbudsnummer: ${d.tilbudsnr}`,
    `Konto: ${KONTONR}`,
    'Merk betalingen med tilbudsnummeret.',
    '',
    `Forskuddsbetaling for reservasjon: ${FORSKUDD_PROSENT} % av totalen, altså ${nok(forskudd)}.`,
    d.henter
      ? 'Forskuddet reserverer utstyret og må være betalt før henting.'
      : 'Forskuddet reserverer utstyret og må være betalt før utkjøring.',
    `Resten, ${nok(rest)}, faktureres etter at utstyret er levert tilbake.`,
    '',
    'Gi oss gjerne beskjed hvis noe skal endres, så ordner vi det.',
    'Du kan svare direkte på denne e-posten.',
    '',
    'Med vennlig hilsen',
    'Berg Utleie',
    'kontakt@bergevent.no · bergutleie.no',
    '',
    '',
    '--------------------------------------------------',
    'Din forespørsel fra bergutleie.no:',
    '',
    `  Navn:      ${d.navn}`,
    `  Mobil:     ${d.mobil}`,
    `  E-post:    ${d.epost}`,
    `  Periode:   ${d.periode} (${d.dagerLabel})`,
    `  ${d.henter ? 'Henting:  ' : 'Levering: '} ${d.levering}`,
    '',
    ...d.varer.map(v => `  ${v.antall} × ${v.navn} — ${nok(v.sum)}`),
    '',
    `  Totalt inkl. mva: ${nok(d.total)}`,
    ...(d.kommentar ? ['', '  Kommentar:', ...d.kommentar.split('\n').map(l => '  ' + l)] : [])
  ].join('\n');

  return 'mailto:' + encodeURIComponent(d.epost)
    + '?subject=' + encodeURIComponent(`Bekreftelse på booking – Berg Utleie${d.periode === 'Ikke valgt' ? '' : ' – ' + d.periode}`)
    + '&body=' + encodeURIComponent(kropp);
}

/* ----------------------------------------------------------- ren tekst --- */

function tekstEpost(d, betalt = false) {
  const bredde = 46;
  const linje = (a, b) => a.padEnd(bredde - String(b).length, ' ') + b;
  return [
    betalt ? 'BETALT BOOKING FRA BERGUTLEIE.NO' : 'NY FORESPØRSEL FRA BERGUTLEIE.NO',
    '='.repeat(bredde),
    '',
    'KUNDE',
    `  Navn:    ${d.navn}`,
    `  Mobil:   ${d.mobil}`,
    `  E-post:  ${d.epost}`,
    '',
    'LEIE',
    `  Periode:  ${d.periode} (${d.dagerLabel})`,
    `  ${d.henter ? 'Henting:' : 'Levering:'}  ${d.levering}`,
    '',
    'UTSTYR',
    ...d.varer.map(v => `  ${String(v.antall).padStart(3)} × ${v.navn}`.padEnd(bredde - nok(v.sum).length) + nok(v.sum)),
    '',
    '-'.repeat(bredde),
    linje('  Leie av utstyr', nok(d.leie)),
    linje(d.henter ? '  Henting på lager' : '  Levering og henting', fraktTekst(d)),
    linje(`  Herav mva (${MVA_SATS * 100} %)`, nok(d.mva)),
    linje('  Sum eks. mva', nok(d.utenMva)),
    '='.repeat(bredde),
    linje('  TOTALT INKL. MVA', nok(d.total)),
    '',
    ...(d.kommentar ? ['KOMMENTAR FRA KUNDEN', d.kommentar, ''] : []),
    ...(betalt ? [
      'BETALING',
      `  Forskudd trukket med Vipps:  ${nok(d.forskudd)}`,
      `  Restbeløp å fakturere:       ${nok(d.rest)}`,
      ...(d.vippsRef ? [`  Vipps-referanse:             ${d.vippsRef}`] : []),
      ''
    ] : []),
    ...(d.gclid ? [`Fra Google-annonse (${d.gclidType}): ${d.gclid}`, ''] : []),
    'Svar på denne e-posten går rett til kunden.'
  ].join('\n');
}

/* ------------------------------------------------------------ hjelpere --- */

function tekst(v, maks) {
  return typeof v === 'string' ? v.trim().slice(0, maks) : '';
}

function fraktTekst(d) {
  return d.frakt ? nok(d.frakt) : '0 kr';
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nok(n) {
  return (Number(n) || 0).toLocaleString('nb-NO').replace(/ /g, ' ') + ' kr';
}

/** Dagens dato slik den er i Norge, ikke i UTC. Returnerer {dag, maned, aar}. */
function norskNaa() {
  const deler = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()).split('-');            // «2026-08-17»
  return { aar: +deler[0], maned: +deler[1] - 1, dag: +deler[2] };
}

/** «4. juli 2026 kl. 20:00 (selvbetjent)» */
function medTid(iso, tid) {
  if (!iso) return 'avtales';
  if (!tid) return norskDato(iso);
  return `${norskDato(iso)} kl. ${tid}` + (erBetjent(iso, tid) ? '' : ' (selvbetjent)');
}

/** 2026-07-04 → 4. juli 2026 */
const MANEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
                 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

function norskDato(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])}. ${MANEDER[Number(m[2]) - 1]} ${m[1]}`;
}

function svar(status, kropp) {
  return new Response(JSON.stringify(kropp), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
