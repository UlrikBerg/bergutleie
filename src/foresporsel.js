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

const AVSENDER = 'Berg Utleie <skjema@bergutleie.no>';
const MVA_SATS = 0.25;          // prisene på nettsiden er oppgitt inkl. mva

/* Fargene fra nettstedet, så e-posten kjennes igjen */
const C = {
  ink: '#113B3F', aksent: '#E8562E', bg: '#F7F6F1',
  linje: '#E5E7E1', dempet: '#5A6E6D', dempet2: '#7C8D8B'
};

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

  const leie = varer.reduce((a, v) => a + (Number(v.sum) || 0), 0);
  const frakt = Number(data.fraktpris) || 0;
  const total = leie + frakt;
  const utenMva = Math.round(total / (1 + MVA_SATS));
  const mva = total - utenMva;

  const dagerLabel = tekst(data.dagerLabel, 30) || '1–4 dager';
  const fra = tekst(data.fra, 20), til = tekst(data.til, 20);
  const periode = fra && til ? `${norskDato(fra)} – ${norskDato(til)}` : 'Ikke valgt';
  const levering = tekst(data.levering, 200) || 'Ikke oppgitt';
  const henter = /henter selv/i.test(levering);
  const kommentar = tekst(data.kommentar, 2000);

  const felles = { navn, mobil, epost, periode, dagerLabel, levering, henter,
                   varer, leie, frakt, total, utenMva, mva, kommentar };

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
      to: [env.VARSEL_TIL || 'kontakt@bergevent.no'],
      reply_to: epost,
      subject: `Forespørsel fra ${navn} – ${nok(total)}${fra ? ' – ' + norskDato(fra) : ''}`,
      html: htmlEpost(felles),
      text: tekstEpost(felles)
    })
  });

  if (!res.ok) {
    return svar(502, { feil: 'Klarte ikke å sende e-posten.' });
  }
  return svar(200, { ok: true });
}

/* ---------------------------------------------------------------- HTML --- */

function htmlEpost(d) {
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
    <h1 style="margin:0;font-size:23px;font-weight:800;color:#ffffff;">Ny forespørsel</h1>
    <p style="margin:6px 0 0;font-size:14px;color:#BCD0CE;">${esc(d.navn)} · ${nok(d.total)}</p>
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
      ${sumRad(d.henter ? 'Henting på lager' : 'Levering og henting', d.frakt ? nok(d.frakt) : '0 kr')}
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

  <tr><td style="padding:0 30px 30px;">
    <a href="mailto:${esc(d.epost)}?subject=${encodeURIComponent('Tilbud fra Berg Utleie')}"
       style="display:inline-block;background:${C.aksent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:8px;">
      Svar ${esc(d.navn.split(' ')[0])} med tilbud
    </a>
    <p style="margin:12px 0 0;font-size:12.5px;color:${C.dempet2};">Svar på denne e-posten går rett til kunden.</p>
  </td></tr>

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

/* ----------------------------------------------------------- ren tekst --- */

function tekstEpost(d) {
  const bredde = 46;
  const linje = (a, b) => a.padEnd(bredde - String(b).length, ' ') + b;
  return [
    'NY FORESPØRSEL FRA BERGUTLEIE.NO',
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
    linje(d.henter ? '  Henting på lager' : '  Levering og henting', d.frakt ? nok(d.frakt) : '0 kr'),
    linje(`  Herav mva (${MVA_SATS * 100} %)`, nok(d.mva)),
    linje('  Sum eks. mva', nok(d.utenMva)),
    '='.repeat(bredde),
    linje('  TOTALT INKL. MVA', nok(d.total)),
    '',
    ...(d.kommentar ? ['KOMMENTAR FRA KUNDEN', d.kommentar, ''] : []),
    'Svar på denne e-posten går rett til kunden.'
  ].join('\n');
}

/* ------------------------------------------------------------ hjelpere --- */

function tekst(v, maks) {
  return typeof v === 'string' ? v.trim().slice(0, maks) : '';
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nok(n) {
  return (Number(n) || 0).toLocaleString('nb-NO').replace(/ /g, ' ') + ' kr';
}

/** 2026-07-04 → 4. juli 2026 */
function norskDato(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const mnd = ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
               'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  return `${Number(m[3])}. ${mnd[Number(m[2]) - 1]} ${m[1]}`;
}

function svar(status, kropp) {
  return new Response(JSON.stringify(kropp), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
