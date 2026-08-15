/* ===========================================================================
   POST /api/foresporsel

   Tar imot forespørselen fra handlekurven og sender den som e-post til
   post@bergutleie.no. Kalles fra src/index.js – ingen egen server å drifte.

   Krever to miljøvariabler i Cloudflare (Settings → Variables and Secrets):
     RESEND_API_KEY   API-nøkkel fra resend.com
     VARSEL_TIL       e-postadressen forespørslene skal til

   Se DEPLOY.md for oppsettet.
   ======================================================================== */

const AVSENDER = 'Berg Utleie <skjema@bergutleie.no>';

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

  const navn = tekst(data.navn, 100);
  const mobil = tekst(data.mobil, 40);
  const epost = tekst(data.epost, 120);
  if (!navn || !mobil || !epost || !epost.includes('@')) {
    return svar(400, { feil: 'Fyll ut navn, mobil og e-post.' });
  }

  const varer = Array.isArray(data.varer) ? data.varer.slice(0, 60) : [];
  if (!varer.length) return svar(400, { feil: 'Handlekurven er tom.' });

  const sum = varer.reduce((a, v) => a + (Number(v.sum) || 0), 0);
  const frakt = Number(data.fraktpris) || 0;

  const linjer = varer
    .map(v => `  ${v.antall} × ${tekst(v.navn, 80)} — ${nok(v.sum)}`)
    .join('\n');

  const kropp = [
    `Ny forespørsel fra bergutleie.no`,
    ``,
    `Navn:    ${navn}`,
    `Mobil:   ${mobil}`,
    `E-post:  ${epost}`,
    ``,
    `Leieperiode: ${tekst(data.fra, 20) || '(ikke valgt)'} – ${tekst(data.til, 20) || '(ikke valgt)'}` +
      (data.dager ? ` (${data.dager} dager)` : ''),
    `Levering:    ${tekst(data.levering, 200)}`,
    ``,
    `Utstyr:`,
    linjer,
    ``,
    `Leie:    ${nok(sum)}`,
    `Frakt:   ${frakt ? nok(frakt) : '0 kr'}`,
    `Totalt:  ${nok(sum + frakt)}`,
    ``,
    `Kommentar:`,
    tekst(data.kommentar, 2000) || '(ingen)'
  ].join('\n');

  if (!env.RESEND_API_KEY) {
    return svar(500, { feil: 'E-post er ikke satt opp ennå.' });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: AVSENDER,
      to: [env.VARSEL_TIL || 'post@bergutleie.no'],
      reply_to: epost,
      subject: `Forespørsel fra ${navn} – ${nok(sum + frakt)}`,
      text: kropp
    })
  });

  if (!res.ok) {
    return svar(502, { feil: 'Klarte ikke å sende e-posten.' });
  }
  return svar(200, { ok: true });
}

/* Klipper og renser en verdi fra skjemaet. */
function tekst(v, maks) {
  return typeof v === 'string' ? v.trim().slice(0, maks) : '';
}

function nok(n) {
  return (Number(n) || 0).toLocaleString('nb-NO') + ' kr';
}

function svar(status, kropp) {
  return new Response(JSON.stringify(kropp), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
