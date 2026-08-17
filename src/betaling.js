/* ===========================================================================
   Betalingsflyten – 25 % forskudd med Vipps.

       handlekurv
          │  POST /api/betaling
          │  serveren regner totalen selv og lagrer bookingen i KV
          ▼
       Vipps-appen
          │  kunden godkjenner – pengene er nå RESERVERT, ikke trukket
          ▼
       GET /betalt?ref=…
          │  serveren spør Vipps hva som faktisk skjedde,
          │  trekker beløpet, sender varsel og viser kvittering
          ▼
       ferdig

   To ting som er lette å gjøre feil, og som er løst her:

   1. At kunden havner på retur-URL-en beviser ingenting. Den kan åpnes
      direkte i adressefeltet. Derfor spør vi alltid Vipps om status før
      noe regnes som betalt.

   2. Salgsstedet er satt opp med «Reserve Capture». Kundens godkjenning
      reserverer bare pengene – uten et capture-kall forsvinner de igjen.

   Bookingen ligger i KV under `booking:<referanse>` mens betalingen pågår.
   Beløpet leses derfra ved retur, aldri fra adressen – ellers kunne hvem
   som helst endret summen mellom de to stegene.
   ======================================================================== */

import { klargjor, sendVarsel, sendKundebekreftelse } from './foresporsel.js';
import { sjekkBooking } from './pris.js';
import { opprettBetaling, hentBetaling, trekk, erSattOpp, verifiserWebhook, VippsFeil } from './vipps.js';
import { FORSKUDD_ANDEL, FORSKUDD_PROSENT } from '../data/vilkar.js';

const NETTSTED = 'https://bergutleie.no';
const VENTETID = 60 * 60 * 2;        // bookingen holdes i KV i to timer mens kunden betaler
const FERDIG_TID = 60 * 60 * 24 * 30; // og i 30 dager etterpå, så en oppfrisket side svarer likt

/* --------------------------------------------------------------- status --- */

/** Sier om betaling er mulig i det hele tatt. Nettleseren spør om dette før
    den viser Vipps-knappen – ellers ville knappen dukket opp i produksjon
    før nøklene finnes, og kunden fått en feilmelding i stedet for en app. */
export function handterBetalingStatus(env) {
  return json(200, { tilgjengelig: erSattOpp(env), forskuddProsent: FORSKUDD_PROSENT });
}

/* ------------------------------------------------------- steg 1: start --- */

export async function handterStartBetaling(request, env) {
  if (!erSattOpp(env)) {
    return json(503, { feil: 'Betaling er ikke satt opp ennå.' });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { feil: 'Ugyldig forespørsel' });
  }
  if (data.firma) return json(200, { ok: true });     // honningkrukke

  const klar = await klargjor(data, env);
  if (klar.feil) return json(400, { feil: klar.feil });

  const d = klar.felles;

  // En betalt reservasjon må ha dato og klokkeslett vi kan møte opp på.
  // Nettleseren sjekker det samme, men den kan omgås.
  const bookbar = sjekkBooking({
    fra: klar.rå.fra, til: klar.rå.til,
    hentetid: d.hentetid, returtid: d.returtid,
    modus: klar.rå.modus, adresse: klar.rå.kommune
  });
  if (!bookbar.ok) return json(400, { feil: bookbar.feil });

  const ore = Math.round(d.total * FORSKUDD_ANDEL) * 100;
  if (ore < 100) return json(400, { feil: 'Beløpet er for lavt.' });

  const referanse = `bu-${d.tilbudsnr}-${crypto.randomUUID().slice(0, 8)}`;

  // Bookingen lagres FØR kunden sendes til Vipps. Skjer det noe underveis,
  // finnes den fortsatt når betalingen kommer tilbake.
  await env.TELLER.put(`booking:${referanse}`,
    JSON.stringify({ ...d, vippsRef: referanse, status: 'venter' }),
    { expirationTtl: VENTETID });

  try {
    const svar = await opprettBetaling(env, {
      referanse,
      ore,
      telefon: d.mobil,
      beskrivelse: `Forskudd ${FORSKUDD_PROSENT} % – booking #${d.tilbudsnr} Berg Utleie`,
      returUrl: `${env.NETTSTED || NETTSTED}/betalt?ref=${encodeURIComponent(referanse)}`
    });
    return json(200, { ok: true, redirectUrl: svar.redirectUrl, referanse });
  } catch (feil) {
    await env.TELLER.delete(`booking:${referanse}`).catch(() => {});
    const detalj = feil instanceof VippsFeil ? ` (${feil.status})` : '';
    return json(502, { feil: 'Kom ikke i kontakt med Vipps' + detalj + '. Prøv igjen.' });
  }
}

/* ------------------------------------------------------ steg 2: retur --- */

export async function handterRetur(request, env) {
  const referanse = new URL(request.url).searchParams.get('ref') || '';
  if (!referanse) return side(400, 'Mangler referanse', 'Vi finner ikke betalingen. Ta kontakt, så ordner vi det.');

  const raa = await env.TELLER.get(`booking:${referanse}`);
  if (!raa) {
    return side(404, 'Vi finner ikke bookingen',
      'Betalingen kan ha blitt liggende for lenge. Har du blitt trukket, ta kontakt på post@bergutleie.no, så rydder vi opp med en gang.');
  }
  const d = JSON.parse(raa);

  // Kunden kan oppfriske siden. Da skal den svare likt, ikke trekke på nytt.
  if (d.status === 'ferdig') return kvittering(d);
  if (d.status === 'avbrutt') return avbrutt(d);

  let betaling;
  try {
    betaling = await hentBetaling(env, referanse);
  } catch {
    return side(502, 'Vi får ikke svar fra Vipps',
      'Betalingen kan ha gått gjennom likevel. Ikke prøv på nytt – ta kontakt på post@bergutleie.no, så sjekker vi.');
  }

  if (betaling.state !== 'AUTHORIZED') {
    await env.TELLER.put(`booking:${referanse}`,
      JSON.stringify({ ...d, status: 'avbrutt' }), { expirationTtl: VENTETID });
    return avbrutt(d);
  }

  const res = await fullfor(env, referanse, d, betaling);
  if (res === 'ferdig') return kvittering({ ...d, vippsRef: referanse });
  return side(200, 'Betalingen er reservert',
    'Vi fikk reservert beløpet, men ikke fullført trekket. Bookingen er registrert, og vi tar kontakt for å bekrefte. Du trenger ikke gjøre noe.');
}

/* ------------------------------------------------------------- webhook --- */

/**
 * Vipps melder fra her når noe skjer med en betaling.
 *
 * Uten dette taper vi bookinger stille: godkjenner kunden i appen og så
 * lukker nettleseren, kommer hen aldri til /betalt, og trekket – som ligger
 * i returflyten – skjer aldri. Pengene står reservert til de faller bort,
 * og verken du eller kunden får vite det.
 *
 * Registreres én gang per miljø. Se VIPPS.md.
 */
export async function handterWebhook(request, env) {
  const kropp = await request.text();

  if (!env.VIPPS_WEBHOOK_SECRET) return new Response('Ikke satt opp', { status: 503 });
  if (!await verifiserWebhook(request, kropp, env.VIPPS_WEBHOOK_SECRET)) {
    // Uten denne kontrollen kunne hvem som helst POSTet «betalt» hit.
    return new Response('Ugyldig signatur', { status: 401 });
  }

  let hendelse;
  try { hendelse = JSON.parse(kropp); } catch { return new Response('ok', { status: 200 }); }

  const referanse = hendelse.reference;
  const navn = hendelse.name || '';
  if (!referanse) return new Response('ok', { status: 200 });

  const raa = await env.TELLER.get(`booking:${referanse}`);
  if (!raa) return new Response('ok', { status: 200 });   // ukjent hos oss – ikke vår sak
  const d = JSON.parse(raa);
  if (d.status === 'ferdig') return new Response('ok', { status: 200 });

  if (navn === 'AUTHORIZED' || navn.includes('authorized')) {
    await fullfor(env, referanse, d);
  } else {
    await env.TELLER.put(`booking:${referanse}`,
      JSON.stringify({ ...d, status: 'avbrutt' }), { expirationTtl: VENTETID });
  }

  // Vipps prøver på nytt hvis vi ikke svarer 200, så vi kvitterer alltid ut
  // så lenge signaturen var ekte – ellers får vi den samme hendelsen i loop.
  return new Response('ok', { status: 200 });
}

/* ------------------------------------------------------------ fullføring --- */

/**
 * Trekker pengene og varsler. Kalles både fra returflyten og fra webhooken,
 * og må derfor tåle å bli kalt to ganger for samme betaling.
 *
 * Dobbelttrekk er umulig uansett: capture bruker referansen som
 * idempotensnøkkel, så Vipps utfører det bare én gang. Statussjekken her
 * sparer oss for en dobbel e-post i det vanlige tilfellet.
 */
async function fullfor(env, referanse, d, betaling) {
  const fersk = await env.TELLER.get(`booking:${referanse}`);
  if (fersk && JSON.parse(fersk).status === 'ferdig') return 'ferdig';

  const ore = betaling?.amount?.value ?? Math.round(d.total * FORSKUDD_ANDEL) * 100;
  try {
    await trekk(env, referanse, ore);
  } catch {
    // Reservasjonen står. Vi mister ikke bookingen – varselet går ut, og
    // trekket tas for hånd.
    await sendVarsel(env, { ...d, vippsRef: referanse }, { betalt: false }).catch(() => {});
    return 'reservert';
  }

  // `betalt` styrer om PDF-en er en booking eller et tilbud. Settes først
  // her, etter at trekket faktisk gikk gjennom – ikke når kunden trykket.
  const ferdig = { ...d, vippsRef: referanse, status: 'ferdig', betalt: true };
  await env.TELLER.put(`booking:${referanse}`, JSON.stringify(ferdig), { expirationTtl: FERDIG_TID });

  // Varsel til lageret og bekreftelse til kunden. Begge feiler stille –
  // pengene er trukket, og bookingen skal ikke gå tapt fordi Resend er nede.
  await Promise.allSettled([
    sendVarsel(env, ferdig, { betalt: true }),
    sendKundebekreftelse(env, ferdig)
  ]);
  return 'ferdig';
}

/* ----------------------------------------------------------- kvittering --- */

function kvittering(d) {
  return side(200, 'Takk – bookingen er bekreftet', `
    <p class="stor">Vi har trukket <strong>${nok(d.forskudd)}</strong> med Vipps,
      og utstyret er reservert til deg.</p>
    <dl>
      <dt>Bookingnummer</dt><dd>#${esc(d.tilbudsnr)}</dd>
      <dt>Periode</dt><dd>${esc(d.periode)}</dd>
      <dt>${d.henter ? 'Henting' : 'Levering'}</dt><dd>${esc(d.levering)}</dd>
      <dt>Totalt</dt><dd>${nok(d.total)}</dd>
      <dt>Betalt nå</dt><dd>${nok(d.forskudd)} (${d.forskuddProsent} %)</dd>
      <dt>Faktureres etterpå</dt><dd>${nok(d.rest)}</dd>
    </dl>
    <p>Du får en bekreftelse på e-post til ${esc(d.epost)}. Restbeløpet
      faktureres etter at utstyret er levert tilbake.</p>
    <p class="dempet">Skal noe endres, svar på bekreftelsen eller skriv til
      <a href="mailto:post@bergutleie.no">post@bergutleie.no</a>.</p>`,
    { sporTotal: d.total });
}

function avbrutt(d) {
  return side(200, 'Betalingen ble ikke fullført', `
    <p class="stor">Ingenting er trukket, og bookingen er ikke registrert.</p>
    <p>Handlekurven ligger som den var. Du kan prøve igjen, eller sende en
      uforpliktende forespørsel hvis du heller vil ha et tilbud først.</p>
    <p><a class="knapp" href="/handlekurv/">Tilbake til handlekurven</a></p>`);
}

/* -------------------------------------------------------------- hjelpere --- */

/** Enkel side i nettstedets drakt. Serveres av Worker-en, ikke fra dist/. */
function side(status, tittel, kropp, { sporTotal } = {}) {
  const html = `<!doctype html>
<html lang="no"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(tittel)} – Berg Utleie</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/assets/style.css">
<style>
  .kvitt { max-width: 40rem; margin: 4rem auto; padding: 0 1.25rem; }
  .kvitt h1 { font-size: 1.75rem; margin: 0 0 1rem; }
  .kvitt .stor { font-size: 1.1rem; }
  .kvitt dl { display: grid; grid-template-columns: auto 1fr; gap: .4rem 1.5rem;
              margin: 1.5rem 0; padding: 1.25rem; background: #F7F6F1; border-radius: 12px; }
  .kvitt dt { color: #5A6E6D; font-size: .9rem; }
  .kvitt dd { margin: 0; font-weight: 600; text-align: right; }
  .kvitt .dempet { color: #5A6E6D; font-size: .9rem; }
  .kvitt .knapp { display: inline-block; background: #113B3F; color: #fff;
                  padding: .8rem 1.5rem; border-radius: 8px; text-decoration: none; }
</style>
</head><body>
<main class="kvitt">
  <h1>${esc(tittel)}</h1>
  ${kropp}
  <p style="margin-top:2.5rem"><a href="/">Til forsiden</a></p>
</main>
${sporTotal ? `<script>
  // Konverteringen telles her, ikke i handlekurven – først nå er pengene
  // faktisk trukket. Verdien er serverens tall.
  try { window.dataLayer = window.dataLayer || [];
        window.sporKjop && window.sporKjop(${Number(sporTotal) || 0}); } catch (e) {}
</script>` : ''}
</body></html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function json(status, kropp) {
  return new Response(JSON.stringify(kropp), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nok(n) {
  return (Number(n) || 0).toLocaleString('nb-NO').replace(/ /g, ' ') + ' kr';
}
