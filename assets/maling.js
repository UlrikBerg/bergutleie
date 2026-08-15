/* ===========================================================================
   Måling for Google Ads og Analytics.

   Tre ting skjer her:

   1. Samtykke. Sporingsinformasjonskapsler krever samtykke i Norge, så
      alt står på «denied» til kunden sier ja. Google Consent Mode lar
      taggen lastes likevel, og Google modellerer da konverteringer for
      dem som ikke samtykker – bedre enn å ikke måle dem i det hele tatt.

   2. Klikk-ID. Kommer kunden fra en annonse, ligger ?gclid=… i adressen.
      Den lagres i 90 dager og sendes med forespørselen, slik at en booking
      senere kan kobles tilbake til søket som skaffet den.

   3. Konvertering. Kalles fra skjemaet når forespørselen faktisk er sendt,
      ikke når knappen trykkes.

   ID-ene settes i data/maling.js. Er de tomme, laster ingenting – da kan
   nettstedet kjøre uten sporing i det hele tatt.
   ======================================================================== */

import { GA4_ID, ADS_ID, ADS_LABEL } from '/data/maling.js';

const SAMTYKKE_NOKKEL = 'bu_samtykke';
const GCLID_NOKKEL = 'bu_gclid';
const GCLID_DAGER = 90;

/* --- klikk-ID fra annonsen --------------------------------------------- */

export function fangGclid() {
  const p = new URLSearchParams(location.search);
  const id = p.get('gclid') || p.get('wbraid') || p.get('gbraid');
  if (!id) return;
  try {
    localStorage.setItem(GCLID_NOKKEL, JSON.stringify({
      id,
      type: p.get('gclid') ? 'gclid' : (p.get('wbraid') ? 'wbraid' : 'gbraid'),
      tid: Date.now()
    }));
  } catch { /* privat modus – da går vi uten */ }
}

export function hentGclid() {
  try {
    const r = JSON.parse(localStorage.getItem(GCLID_NOKKEL) || 'null');
    if (!r) return null;
    if (Date.now() - r.tid > GCLID_DAGER * 86400000) return null;
    return r;
  } catch { return null; }
}

/* --- samtykke ----------------------------------------------------------- */

function lagretSamtykke() {
  try { return localStorage.getItem(SAMTYKKE_NOKKEL); } catch { return null; }
}

function settSamtykke(svar) {
  try { localStorage.setItem(SAMTYKKE_NOKKEL, svar); } catch { /* ignorer */ }
  if (!window.gtag) return;
  const gitt = svar === 'ja' ? 'granted' : 'denied';
  window.gtag('consent', 'update', {
    ad_storage: gitt,
    ad_user_data: gitt,
    ad_personalization: gitt,
    analytics_storage: gitt
  });
}

function visBanner() {
  if (lagretSamtykke()) return;
  const b = document.createElement('div');
  b.className = 'samtykke';
  b.innerHTML = `
    <p>Vi bruker informasjonskapsler til å måle hvor besøkende kommer fra,
       slik at vi vet hvilke annonser som virker.
       <a href="/personvern/">Les mer</a>.</p>
    <div class="samtykke-knapper">
      <button type="button" data-samtykke="nei" class="btn btn-lys">Bare nødvendige</button>
      <button type="button" data-samtykke="ja" class="btn btn-mork">Godta</button>
    </div>`;
  b.addEventListener('click', (e) => {
    const k = e.target.closest('[data-samtykke]');
    if (!k) return;
    settSamtykke(k.dataset.samtykke);
    b.remove();
  });
  document.body.appendChild(b);
}

/* --- lasting ------------------------------------------------------------ */

export function startMaling() {
  fangGclid();
  if (!GA4_ID && !ADS_ID) return;          // ingen ID satt – ingen sporing

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };

  // Alt avslått til kunden har sagt ja. wait_for_update gir banneret et
  // halvsekund til å svare før taggen sender noe som helst.
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });

  const lagret = lagretSamtykke();
  if (lagret) settSamtykke(lagret);

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + (GA4_ID || ADS_ID);
  document.head.appendChild(s);

  window.gtag('js', new Date());
  if (GA4_ID) window.gtag('config', GA4_ID);
  if (ADS_ID) window.gtag('config', ADS_ID);

  visBanner();
}

/* --- konvertering ------------------------------------------------------- */

/**
 * Kalles når forespørselen faktisk er sendt.
 * @param {number} verdi  Totalsum inkl. mva, brukt som konverteringsverdi.
 */
export function sporForesporsel(verdi) {
  if (!window.gtag) return;
  if (GA4_ID) {
    window.gtag('event', 'foresporsel_sendt', {
      currency: 'NOK',
      value: Number(verdi) || 0
    });
  }
  if (ADS_ID && ADS_LABEL) {
    window.gtag('event', 'conversion', {
      send_to: ADS_ID + '/' + ADS_LABEL,
      currency: 'NOK',
      value: Number(verdi) || 0
    });
  }
}
