/* ===========================================================================
   GET /api/adresse?sok=...

   Proxy mot Kartverkets adresse-API. Kartverket sender ingen CORS-header,
   så nettleseren kan ikke kalle dem direkte – vi går veien om Worker-en.

   Svarene caches på kanten i et døgn. Adresser endrer seg sjelden, og de
   fleste søk i vårt område vil gjenta seg.
   ======================================================================== */

const KARTVERKET = 'https://ws.geonorge.no/adresser/v1/sok';
const CACHE_SEKUNDER = 86400;

/* Lageret i Sørliveien 78, 1788 Halden. Treffene sorteres etter avstand
   herfra, ellers får en kunde i Østfold forslag fra Nord-Norge først. */
const LAGER = { lat: 59.12257, lon: 11.30843 };

/** Luftlinje i kilometer – god nok til å rangere forslag. */
function avstandKm(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return Infinity;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat - LAGER.lat) * rad, dLon = (lon - LAGER.lon) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(LAGER.lat * rad) * Math.cos(lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Kartverket søker på eksakte tegn, så «Sorliveien» finner ikke «Sørliveien».
 * Mange skriver uten æ, ø og å – særlig på mobil. Jokertegnet * dekker ett
 * eller flere tegn, så vi bytter ut kandidatene og prøver på nytt.
 */
function medJokertegn(s) {
  return s
    .replace(/ae/gi, '*').replace(/oe/gi, '*').replace(/aa/gi, '*')
    .replace(/[oa]/gi, '*')
    .replace(/\*{2,}/g, '*');
}

async function slaOpp(sok) {
  const kilde = new URL(KARTVERKET);
  kilde.searchParams.set('sok', sok);
  kilde.searchParams.set('treffPerSide', '30');
  kilde.searchParams.set('side', '0');
  kilde.searchParams.set('asciiKompatibel', 'true');
  // Kartverket avviser filtrer-parameteren på dette endepunktet, så vi tar
  // imot hele svaret og plukker ut feltene vi trenger.
  return fetch(kilde.toString(), {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: CACHE_SEKUNDER, cacheEverything: true }
  });
}

export async function handterAdressesok(request) {
  const url = new URL(request.url);
  const sok = (url.searchParams.get('sok') || '').trim();

  // For korte søk gir bare støy – vent til kunden har skrevet litt
  if (sok.length < 3) return json({ adresser: [] });

  let svar;
  try {
    svar = await slaOpp(sok);
  } catch {
    return json({ adresser: [], feil: 'Adressesøket er utilgjengelig' }, 502);
  }

  if (!svar.ok) return json({ adresser: [], feil: 'Adressesøket svarte ikke' }, 502);

  let data = await svar.json();

  // Ingen treff? Prøv én gang til med jokertegn for æ, ø og å.
  if (!(data.adresser || []).length) {
    const alternativ = medJokertegn(sok);
    if (alternativ !== sok && alternativ.includes('*')) {
      try {
        const nytt = await slaOpp(alternativ);
        if (nytt.ok) data = await nytt.json();
      } catch { /* beholder det tomme svaret */ }
    }
  }

  // Kartverket rangerer bare på tekst, ikke geografi. Vi deler treffene i
  // avstandsbånd som følger fraktsonene, og beholder Kartverkets rekkefølge
  // innenfor hvert bånd. Da havner Sarpsborg foran Sandefjord på «Storgata 12»,
  // uten at husnummeret blir ignorert.
  const band = (km) => km <= 60 ? 0 : km <= 150 ? 1 : km <= 300 ? 2 : 3;
  const adresser = (data.adresser || [])
    .map((a, i) => {
      const lat = a.representasjonspunkt?.lat;
      const lon = a.representasjonspunkt?.lon;
      const km = Math.round(avstandKm(lat, lon));
      return {
        tekst: a.adressetekst,
        postnr: a.postnummer,
        poststed: a.poststed,
        kommune: a.kommunenavn,
        lat, lon, km,
        _rang: band(km) * 1000 + i
      };
    })
    .sort((a, b) => a._rang - b._rang)
    .slice(0, 6)
    .map(({ _rang, ...a }) => a);

  return json({ adresser }, 200, CACHE_SEKUNDER);
}

function json(kropp, status = 200, cache = 0) {
  return new Response(JSON.stringify(kropp), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache ? `public, max-age=${cache}` : 'no-store'
    }
  });
}
