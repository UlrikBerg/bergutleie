/* ===========================================================================
   Worker-inngang for bergutleie.no

   Statiske filer i dist/ serveres direkte av Cloudflare uten å gå
   gjennom denne koden. Worker-en kjører bare for adresser som ikke
   finnes som fil – i praksis skjema-endepunktet.
   ======================================================================== */

import { handterForesporsel } from './foresporsel.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/foresporsel') {
      if (request.method !== 'POST') {
        return new Response('Kun POST', { status: 405, headers: { allow: 'POST' } });
      }
      return handterForesporsel(request, env);
    }

    // Alt annet: la assets-laget svare (inkludert 404-siden)
    return env.ASSETS.fetch(request);
  }
};
