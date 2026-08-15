/* ===========================================================================
   Worker-inngang for bergutleie.no

   Kjører foran de statiske filene (run_worker_first i wrangler.toml), slik
   at vi rekker å sende www videre til apex-domenet. Alt annet enn skjemaet
   sendes rett til assets-laget, som serverer dist/ og 404-siden.
   ======================================================================== */

import { handterForesporsel } from './foresporsel.js';
import { handterAdressesok } from './adresse.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // www → bergutleie.no, som ekte 301 så rankingen samles på ett domene.
    // Kan ikke ligge i _redirects: Cloudflare tillater kun relative stier der.
    if (url.hostname === 'www.bergutleie.no') {
      url.hostname = 'bergutleie.no';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/api/adresse') {
      return handterAdressesok(request);
    }

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
