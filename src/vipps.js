/* ===========================================================================
   Vipps ePayment – klienten mot API-et.

   Salgsstedet er satt opp med belastningstype «Reserve Capture». Det betyr
   at kundens godkjenning bare *reserverer* pengene – de kommer ikke inn før
   vi kaller capture. Glemmer vi det steget, forsvinner reservasjonen og
   ingen penger kommer. Derfor trekkes forskuddet med en gang betalingen er
   bekreftet, i samme serverkall. Se src/betaling.js.

   Miljøvariabler (Cloudflare → Settings → Variables and Secrets):
     VIPPS_MSN                salgsstedets nummer, f.eks. 525085
     VIPPS_CLIENT_ID          fra portal.vipps.no → For utviklere
     VIPPS_CLIENT_SECRET      samme sted – hemmelig
     VIPPS_SUBSCRIPTION_KEY   Ocp-Apim-Subscription-Key, primær
     VIPPS_API                https://apitest.vipps.no i test,
                              https://api.vipps.no i produksjon

   Lokalt ligger testverdiene i .dev.vars, som er utenfor git.
   ======================================================================== */

const SYSTEM = { navn: 'bergutleie.no', versjon: '1.0.0' };

/* Tilgangstokenet varer i en time. Vi holder på det i minnet så lenge
   isolatet lever – det sparer et rundtur-kall per betaling, men vi kan
   ikke stole på at det overlever, så det er bare en snarvei. */
let bufretToken = null;

async function token(env) {
  const naa = Date.now();
  if (bufretToken && bufretToken.utloper > naa + 60_000) return bufretToken.verdi;

  const res = await fetch(`${env.VIPPS_API}/accesstoken/get`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      client_id: env.VIPPS_CLIENT_ID,
      client_secret: env.VIPPS_CLIENT_SECRET,
      'Ocp-Apim-Subscription-Key': env.VIPPS_SUBSCRIPTION_KEY,
      'Merchant-Serial-Number': env.VIPPS_MSN
    }
  });
  if (!res.ok) throw new VippsFeil('Fikk ikke tilgangstoken', res.status, await res.text());

  const data = await res.json();
  // expires_in kommer som sekunder i en streng.
  const levetid = (Number(data.expires_in) || 3600) * 1000;
  bufretToken = { verdi: data.access_token, utloper: naa + levetid };
  return data.access_token;
}

/** Felles hoder. `idempotens` settes kun på kall som endrer penger. */
async function hoder(env, idempotens) {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${await token(env)}`,
    'Ocp-Apim-Subscription-Key': env.VIPPS_SUBSCRIPTION_KEY,
    'Merchant-Serial-Number': env.VIPPS_MSN,
    'Vipps-System-Name': SYSTEM.navn,
    'Vipps-System-Version': SYSTEM.versjon,
    ...(idempotens ? { 'Idempotency-Key': idempotens } : {})
  };
}

/**
 * Oppretter en betaling og returnerer adressen kunden skal sendes til.
 *
 * @param referanse  vår egen unike id, brukes også som idempotensnøkkel
 * @param ore        beløpet i øre – 1500 kr er 150000
 */
export async function opprettBetaling(env, { referanse, ore, beskrivelse, returUrl, telefon }) {
  const kropp = {
    amount: { currency: 'NOK', value: ore },
    paymentMethod: { type: 'WALLET' },
    reference: referanse,
    returnUrl: returUrl,
    userFlow: 'WEB_REDIRECT',
    paymentDescription: beskrivelse.slice(0, 100)
  };
  // Har vi mobilnummeret, slipper kunden å taste det inn i Vipps.
  const norsk = /^(\+?47)?[49]\d{7}$/.test((telefon || '').replace(/\s/g, ''));
  if (norsk) {
    kropp.customer = { phoneNumber: '47' + telefon.replace(/\s/g, '').replace(/^\+?47/, '') };
  }

  const res = await fetch(`${env.VIPPS_API}/epayment/v1/payments`, {
    method: 'POST',
    headers: await hoder(env, referanse),
    body: JSON.stringify(kropp)
  });
  if (!res.ok) throw new VippsFeil('Klarte ikke å opprette betalingen', res.status, await res.text());
  return res.json();                       // { redirectUrl, reference }
}

/** Henter betalingen slik Vipps ser den. Dette er fasiten – aldri retur-URL-en. */
export async function hentBetaling(env, referanse) {
  const res = await fetch(`${env.VIPPS_API}/epayment/v1/payments/${encodeURIComponent(referanse)}`, {
    headers: await hoder(env)
  });
  if (!res.ok) throw new VippsFeil('Fant ikke betalingen', res.status, await res.text());
  return res.json();                       // { state, aggregate, amount, ... }
}

/** Trekker de reserverte pengene. Uten dette kommer ingen penger inn. */
export async function trekk(env, referanse, ore) {
  const res = await fetch(`${env.VIPPS_API}/epayment/v1/payments/${encodeURIComponent(referanse)}/capture`, {
    method: 'POST',
    headers: await hoder(env, `capture-${referanse}`),
    body: JSON.stringify({ modificationAmount: { currency: 'NOK', value: ore } })
  });
  if (!res.ok) throw new VippsFeil('Klarte ikke å trekke beløpet', res.status, await res.text());
  return res.json();
}

/** Betaler tilbake et trukket beløp. Brukes manuelt, ikke av nettstedet. */
export async function tilbakebetal(env, referanse, ore) {
  const res = await fetch(`${env.VIPPS_API}/epayment/v1/payments/${encodeURIComponent(referanse)}/refund`, {
    method: 'POST',
    headers: await hoder(env, `refund-${referanse}-${ore}`),
    body: JSON.stringify({ modificationAmount: { currency: 'NOK', value: ore } })
  });
  if (!res.ok) throw new VippsFeil('Klarte ikke å tilbakebetale', res.status, await res.text());
  return res.json();
}

/* --------------------------------------------------------------- webhook --- */

/** Hendelsene vi trenger. Godkjenning er den viktige – den forteller oss at
    pengene er reservert, også når kunden aldri kom tilbake til nettsiden. */
export const WEBHOOK_HENDELSER = [
  'epayments.payment.authorized.v1',
  'epayments.payment.aborted.v1',
  'epayments.payment.expired.v1'
];

/** Registreres én gang per miljø. Returnerer hemmeligheten som signaturen
    skal kontrolleres mot – den vises bare her, så den må lagres med én gang. */
export async function registrerWebhook(env, url) {
  const res = await fetch(`${env.VIPPS_API}/webhooks/v1/webhooks`, {
    method: 'POST',
    headers: await hoder(env),
    body: JSON.stringify({ url, events: WEBHOOK_HENDELSER })
  });
  if (!res.ok) throw new VippsFeil('Klarte ikke å registrere webhook', res.status, await res.text());
  return res.json();                       // { id, secret }
}

export async function listWebhooks(env) {
  const res = await fetch(`${env.VIPPS_API}/webhooks/v1/webhooks`, { headers: await hoder(env) });
  if (!res.ok) throw new VippsFeil('Fikk ikke listet webhooks', res.status, await res.text());
  return res.json();
}

export async function slettWebhook(env, id) {
  const res = await fetch(`${env.VIPPS_API}/webhooks/v1/webhooks/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: await hoder(env)
  });
  if (!res.ok && res.status !== 204) {
    throw new VippsFeil('Klarte ikke å slette webhook', res.status, await res.text());
  }
  return true;
}

/**
 * Kontrollerer at kallet faktisk kommer fra Vipps.
 *
 * Uten dette kan hvem som helst POSTe «betaling godkjent» til oss og få en
 * booking registrert uten å ha betalt. Signaturen er en HMAC-SHA256 over
 * metode, sti, dato, vert og innholdshash – alt må stemme.
 *
 * @param kropp  rå tekst, ikke parset JSON. Én endret mellomrom og hashen ryker.
 */
export async function verifiserWebhook(request, kropp, hemmelighet) {
  const dato = request.headers.get('x-ms-date');
  const innholdshash = request.headers.get('x-ms-content-sha256');
  const auth = request.headers.get('authorization') || '';
  if (!dato || !innholdshash || !auth) return false;

  const enc = new TextEncoder();

  // 1. Stemmer hashen med det som faktisk ble sendt?
  const egenHash = base64(await crypto.subtle.digest('SHA-256', enc.encode(kropp)));
  if (!likeStrenger(egenHash, innholdshash)) return false;

  // 2. Bygg strengen som ble signert, og regn ut vår egen signatur.
  const url = new URL(request.url);
  const tilSignering = `POST\n${url.pathname}${url.search}\n${dato};${url.host};${innholdshash}`;

  const nokkel = await crypto.subtle.importKey(
    'raw', base64TilBytes(hemmelighet),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const egen = base64(await crypto.subtle.sign('HMAC', nokkel, enc.encode(tilSignering)));

  const oppgitt = /Signature=([^&,\s]+)/.exec(auth)?.[1] || '';
  return likeStrenger(egen, oppgitt);
}

/** Sammenligning som bruker like lang tid uansett hvor de er ulike, så en
    angriper ikke kan gjette seg fram tegn for tegn. */
function likeStrenger(a, b) {
  if (a.length !== b.length) return false;
  let ulikt = 0;
  for (let i = 0; i < a.length; i++) ulikt |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ulikt === 0;
}

const base64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const base64TilBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Er Vipps satt opp i det hele tatt? Uten nøkler skal knappen ikke vises. */
export function erSattOpp(env) {
  return !!(env.VIPPS_API && env.VIPPS_MSN && env.VIPPS_CLIENT_ID
            && env.VIPPS_CLIENT_SECRET && env.VIPPS_SUBSCRIPTION_KEY);
}

export class VippsFeil extends Error {
  constructor(melding, status, kropp) {
    super(`${melding} (${status})`);
    this.status = status;
    this.kropp = kropp;
  }
}
