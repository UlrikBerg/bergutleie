/* ===========================================================================
   Registrerer webhooken hos Vipps. Kjøres én gang per miljø.

     node registrer-webhook.js            # testmiljø, leser .dev.vars
     node registrer-webhook.js --list     # vis hva som er registrert
     node registrer-webhook.js --slett ID # fjern en registrering

   For produksjon settes verdiene som miljøvariabler i stedet:

     VIPPS_API=https://api.vipps.no VIPPS_MSN=… VIPPS_CLIENT_ID=… \
     VIPPS_CLIENT_SECRET=… VIPPS_SUBSCRIPTION_KEY=… \
     NETTSTED=https://bergutleie.no node registrer-webhook.js

   Hemmeligheten i svaret vises bare denne ene gangen. Lagre den med
   `npx wrangler secret put VIPPS_WEBHOOK_SECRET` med det samme.
   ======================================================================== */

import { readFileSync } from 'node:fs';
import { registrerWebhook, listWebhooks, slettWebhook, WEBHOOK_HENDELSER } from './src/vipps.js';

function lesDevVars() {
  try {
    return Object.fromEntries(
      readFileSync(new URL('.dev.vars', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    );
  } catch { return {}; }
}

// Miljøvariabler vinner over .dev.vars, så produksjon aldri leser testnøkler.
const env = { ...lesDevVars(), ...Object.fromEntries(
  Object.entries(process.env).filter(([k]) => k.startsWith('VIPPS_') || k === 'NETTSTED')) };

for (const n of ['VIPPS_API', 'VIPPS_MSN', 'VIPPS_CLIENT_ID', 'VIPPS_CLIENT_SECRET', 'VIPPS_SUBSCRIPTION_KEY']) {
  if (!env[n]) { console.error(`Mangler ${n}.`); process.exit(1); }
}

const erProd = env.VIPPS_API.includes('//api.vipps');
const nettsted = env.NETTSTED || (erProd ? 'https://bergutleie.no' : 'https://bergutleie.no');
const url = `${nettsted}/api/vipps-webhook`;

const [flagg, arg] = process.argv.slice(2);

if (flagg === '--list') {
  const { webhooks } = await listWebhooks(env);
  console.log(`${webhooks.length} registrert i ${erProd ? 'PRODUKSJON' : 'test'} (MSN ${env.VIPPS_MSN}):`);
  for (const w of webhooks) console.log(`  ${w.id}  ${w.url}\n    ${w.events.join(', ')}`);
  process.exit(0);
}

if (flagg === '--slett') {
  if (!arg) { console.error('Oppgi id: --slett <id>'); process.exit(1); }
  await slettWebhook(env, arg);
  console.log('Slettet', arg);
  process.exit(0);
}

const { webhooks } = await listWebhooks(env);
if (webhooks.some((w) => w.url === url)) {
  console.log(`Finnes allerede for ${url}.`);
  console.log('Kjør --list for å se den, eller --slett <id> for å registrere på nytt.');
  process.exit(0);
}

console.log(`Registrerer i ${erProd ? 'PRODUKSJON' : 'test'} (MSN ${env.VIPPS_MSN})`);
console.log(`  ${url}`);
console.log(`  ${WEBHOOK_HENDELSER.join('\n  ')}\n`);

const svar = await registrerWebhook(env, url);

console.log('Registrert. Id:', svar.id);
console.log('\n  Hemmelighet (vises bare nå):\n');
console.log('   ', svar.secret);
console.log('\n  Lagre den med en gang:\n');
console.log('    npx wrangler secret put VIPPS_WEBHOOK_SECRET\n');
