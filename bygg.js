/* ===========================================================================
   Byggeskript – genererer hele nettstedet som statiske HTML-filer i dist/

   Kjør:  npm run bygg
   Alt innhold kommer fra data/produkter.js. Endrer du en pris der,
   oppdateres alle sider som viser den prisen.
   ======================================================================== */

import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUKTER, PAKKER, KATEGORIER, SONER, STEDER, finn, kr, fraPris } from './data/produkter.js';
import { teltSvg } from './data/telt-svg.js';

const ROT = dirname(fileURLToPath(import.meta.url));
const UT = join(ROT, 'dist');
const NETTSTED = 'https://bergutleie.no';

/* --- små hjelpere --- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => s.toLowerCase()
  .replace(/[æå]/g, 'a').replace(/ø/g, 'o')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const sider = [];   // samles opp til sitemap

/* --- felles sidemal --- */
function layout({ url, tittel, beskrivelse, bilde, innhold, jsonld = [], klasse = '' }) {
  const full = NETTSTED + url;
  sider.push(url);
  return `<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tittel)}</title>
<meta name="description" content="${esc(beskrivelse)}">
<link rel="canonical" href="${full}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Berg Utleie">
<meta property="og:locale" content="nb_NO">
<meta property="og:title" content="${esc(tittel)}">
<meta property="og:description" content="${esc(beskrivelse)}">
<meta property="og:url" content="${full}">
<meta property="og:image" content="${NETTSTED}${bilde || '/uploads/hageselskap.webp'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/uploads/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
${jsonld.map(j => `<script type="application/ld+json">\n${JSON.stringify(j, null, 2)}\n</script>`).join('\n')}
</head>
<body${klasse ? ` class="${klasse}"` : ''}>

<header class="site-header">
  <div class="wrap">
    <a href="/" class="logo"><img src="/uploads/logo.png" alt="Berg Utleie" width="908" height="491"></a>
    <nav class="site-nav">
      <a href="/">Forside</a>
      <a href="/utstyr/">Alle produkter</a>
      <a href="/selskapspakker/">Pakketilbud</a>
      <a href="/#levering">Henting og levering</a>
      <a href="/tilbud/">Få tilbud</a>
    </nav>
    <div class="header-actions">
      <a class="btn kurv-knapp" href="/handlekurv/">
        Handlekurv<span class="kurv-teller" data-kurv-teller>0</span>
      </a>
    </div>
  </div>
</header>

${innhold}

<footer id="kontakt" class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <img src="/uploads/logo.png" alt="Berg Utleie" width="908" height="491">
      <p class="blurb">Utleie av partytelt, møbler, dekketøy og eventutstyr til faste priser. Hent selv i Halden, eller få levert på hele Østlandet.</p>
      <a class="parent" href="https://bergevent.no">En del av Berg Event-familien →</a>
    </div>
    <div class="footer-col">
      <p class="eyebrow">Utstyr</p>
      <div class="footer-links">
        ${KATEGORIER.map(k => `<a href="/utstyr/#${slugify(k.navn)}">${esc(k.navn)}</a>`).join('\n        ')}
      </div>
    </div>
    <div class="footer-col">
      <p class="eyebrow">Selskapet</p>
      <div class="footer-links">
        <a href="/selskapspakker/">Selskapspakker</a>
        <a href="/#slik">Slik fungerer det</a>
        <a href="/#levering">Henting og levering</a>
        <a href="https://bergevent.no">Berg Event</a>
      </div>
    </div>
    <div class="footer-col">
      <p class="eyebrow">Kontakt</p>
      <div class="footer-links">
        <a href="mailto:post@bergutleie.no">post@bergutleie.no</a>
        <span>Lageret vårt ligger rett ved E6 i Halden</span>
        <span>Man–fre 09–18 · Søn 12–15</span>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <div class="wrap">
      <span>© 2026 Berg Utleie. Alle rettigheter reservert.</span>
      <span class="legal"><a href="/personvern/">Personvern</a><a href="/leievilkar/">Leievilkår</a></span>
    </div>
  </div>
</footer>

<script type="module" src="/assets/app.js"></script>
</body>
</html>
`;
}

/* --- gjenbrukbare biter --- */
const bilde = (b, klasse, ekstra = '') => b
  ? `<img src="${b.u}" alt="${esc(b.alt || '')}" class="${klasse}${b.fit === 'contain' ? ' contain' : ''}" loading="lazy" ${ekstra}>`
  : `<span class="${klasse} tom-media" aria-hidden="true"></span>`;

const produktkort = (p) => `
  <article class="prod-kort">
    <a class="prod-media" href="/utstyr/${p.slug}/">
      ${bilde(p.bilder[0], 'prod-bilde')}
    </a>
    <div class="prod-tekst">
      <div>
        <h3><a href="/utstyr/${p.slug}/">${esc(p.navn)}</a></h3>
        <p class="desc">${esc(p.desc)}</p>
      </div>
      <div class="prod-bunn">
        <span><span class="pris">${fraPris(p)}</span><span class="pris-tag"> ${p.fast ? 'fastpris' : '1–4 dager'}</span></span>
        <button type="button" class="legg-i-kurv" data-id="${p.id}" aria-label="Legg ${esc(p.navn)} i handlekurven">+</button>
      </div>
    </div>
  </article>`;

/* --- forside --- */
function forside() {
  // Hentes fra datafila, så meta-teksten aldri blir stående med utdatert pris
  const billigsteTelt = Math.min(...PRODUKTER.filter(p => p.cat === 'Partytelt').map(p => p.d));
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'LocalBusiness',
      name: 'Berg Utleie', url: NETTSTED + '/', email: 'post@bergutleie.no',
      image: NETTSTED + '/uploads/hageselskap.webp',
      description: 'Utleie av partytelt, bord, stoler, dekketøy, lyd og lys til faste priser. Henting i Halden eller levering på Østlandet.',
      priceRange: 'kr',
      address: { '@type': 'PostalAddress', addressLocality: 'Halden', addressCountry: 'NO' },
      areaServed: ['Halden', 'Sarpsborg', 'Fredrikstad', 'Moss', 'Oslo'].map(n => ({ '@type': 'City', name: n })),
      openingHoursSpecification: [
        { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
        { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Sunday', opens: '12:00', closes: '15:00' }
      ],
      parentOrganization: { '@type': 'Organization', name: 'Berg Event', url: 'https://bergevent.no' }
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: [
        ['Hva er forskjellen på Berg Utleie og Berg Event?', 'Samme utstyr og samme folk. Berg Utleie er for deg som vil ha faste priser og ordne det praktiske selv – eller betale en fast sonepris for levering og henting. Berg Event skreddersyr hele arrangementer med montering og rigging.'],
        ['Hvordan beregnes leieprisen?', 'Samme pris for 1–4 dagers leie – en hel helg koster altså det samme som én dag. Fra dag 5 legges det til 15 % av grunnprisen per døgn. Sikringsutstyr har fastpris uansett periode.'],
        ['Når kan jeg hente og levere tilbake?', 'Lageret ligger rett ved E6 i Halden og har åpent man–fre 09–18 og søndag 12–15. Helgeleie hentes torsdag–fredag og leveres tilbake mandag.'],
        ['Kan dere montere teltet for meg?', 'Levering inkluderer ikke montering. Ønsker du opprigg og nedrigg, hjelper søsterselskapet vårt Berg Event deg – be om tilbud, så ordner vi resten.']
      ].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
    }
  ];

  const innhold = `
<main>
  <section class="wrap hero">
    <div>
      <h1>Lei festutstyr til fast pris</h1>
      <p class="lead">Utleie av alt du trenger til selskap i egen hage – telt, bord, stoler, dekketøy, lyd og lys. Hent selv gratis på lageret vårt ved E6 i Halden, eller få alt levert dit festen skal stå.</p>
      <div class="hero-actions">
        <a class="btn btn-lg" href="/selskapspakker/">Se pakketilbud</a>
        <a class="btn-ghost" href="#utstyr">Se utstyret</a>
      </div>
      <div class="usp">
        <span><span class="dot"></span>Faste priser – ingen overraskelser</span>
        <span><span class="dot"></span>Gratis henting på lager</span>
        <span><span class="dot"></span>2000+ utleier i Berg-familien</span>
      </div>
    </div>
    <div class="hero-media">
      <img src="/uploads/bord-pyntet.jpg" alt="Partytelt med tregulv og festdekorasjon" width="900" height="1200" fetchpriority="high">
    </div>
  </section>

  <section id="slik" class="band">
    <div class="wrap">
      <h2 class="visuelt-skjult">Slik fungerer det</h2>
      <div class="steps">
        ${[
          ['Velg utstyr og datoer', 'Sett sammen det du trenger – 1–4 dagers leie koster det samme.'],
          ['Se prisen med en gang', 'Handlekurven viser fast totalpris – med eller uten levering.'],
          ['Vi bekrefter innen 6 timer', 'Send forespørsel, så bekrefter vi tilgjengelighet raskt.'],
          ['Hent – eller få levert', 'Hent på lageret ved E6, eller få alt kjørt ut og hentet igjen.']
        ].map(([t, b], i) => `
        <div>
          <div class="step-head"><span class="step-num">${i + 1}</span><h3>${esc(t)}</h3></div>
          <p>${esc(b)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section id="utstyr" class="wrap section">
    <div class="section-head">
      <div>
        <h2>Alt du trenger til festen</h2>
        <p>Telt, møbler, dekketøy og teknikk – til fast pris.</p>
      </div>
      <a class="btn-link" href="/utstyr/">Se alle produktene →</a>
    </div>
    <div class="cat-grid">
      ${KATEGORIER.map(k => {
        const fra = PRODUKTER.filter(p => p.cat === k.navn)
          .reduce((m, p) => Math.min(m, p.fast || p.d), Infinity);
        const erFast = PRODUKTER.filter(p => p.cat === k.navn).every(p => p.fast);
        return `
      <a class="cat-card" href="/utstyr/#${slugify(k.navn)}">
        <img src="${k.bilde}" alt="${esc(k.alt)}" width="800" height="450" loading="lazy">
        <span class="meta">
          <span><span class="navn">${esc(k.navn)}</span><span class="fra">${erFast ? kr(fra) + ' fastpris' : 'fra ' + kr(fra)}</span></span>
          <span class="arrow">→</span>
        </span>
      </a>`;
      }).join('')}
    </div>
  </section>

  <section id="levering" class="wrap section">
    <div class="section-head-center">
      <h2>Hent selv, eller få det levert</h2>
      <p>Du velger selv, og prisen er fast uansett.</p>
    </div>
    <div class="split">
      <div class="card-light">
        <h3>Hent og tilbakelever på vårt lager</h3>
        <p class="big-price">0 kr</p>
        <ul class="ticks">
          <li><span class="tick">✓</span>Lager rett ved E6 i Halden – enkel av- og påkjøring</li>
          <li><span class="tick">✓</span>Vi hjelper deg med lasting</li>
          <li><span class="tick">✓</span>Det meste får plass i varebil eller på tilhenger</li>
          <li><span class="tick">✓</span>Samme pris for leie opptil 4 dager – f.eks. tor–man</li>
          <li><span class="tick">✓</span>Selvbetjent henting 24/7 – hent når det passer deg</li>
        </ul>
        <a class="btn-ghost" href="#kontakt">Finn veien til lageret</a>
      </div>
      <div class="card-dark">
        <h3>Vi leverer og henter for deg</h3>
        <p class="big-price">fra ${kr(SONER[0].pris)}</p>
        <ul class="ticks lys">
          <li><span class="tick">✓</span>Fast pris – du ser totalen før du bestiller</li>
          <li><span class="tick">✓</span>Kjøres ut og hentes av Berg Event-ansatte</li>
          <li><span class="tick">✓</span>Rett til festplassen – du slipper tilhenger og tunge løft</li>
          <li><span class="tick">✓</span>Vi henter alt igjen når festen er over</li>
        </ul>
        <p class="adresse-label">Hvor skal festen være?</p>
        <input type="text" class="adresse-felt" data-forside-adresse list="stederliste"
               placeholder="Legg inn adresse her – se fraktprisen med en gang">
        <p class="adresse-bekreft" data-forside-bekreft hidden></p>
        <p class="fine">Adressen følger deg gjennom hele handleturen – fraktprisen ser du i handlekurven. Montering inngår ikke.</p>
        <datalist id="stederliste">${STEDER.map(s => `<option value="${esc(s.navn)}">`).join('')}</datalist>
      </div>
    </div>
  </section>

  <section class="faq wrap">
    <h2>Ofte stilte spørsmål</h2>
    <div class="faq-list">
      ${jsonld[1].mainEntity.map(q => `
      <details>
        <summary>${esc(q.name)}</summary>
        <p>${esc(q.acceptedAnswer.text)}</p>
      </details>`).join('')}
    </div>
  </section>

  <section class="cta-outer">
    <div class="cta">
      <h2>Fest på gang?</h2>
      <p>Sett sammen utstyret og se totalprisen på under ett minutt.</p>
      <a class="btn btn-xl" href="/utstyr/">Utforsk produktene</a>
    </div>
  </section>
</main>`;

  return layout({
    url: '/', tittel: 'Berg Utleie – lei partytelt, bord og stoler til fast pris i Halden',
    beskrivelse: `Utleie av partytelt, bord, stoler, dekketøy, lyd og lys til faste priser. Hent gratis på lageret ved E6 i Halden, eller få alt levert på Østlandet. Partytelt fra ${kr(billigsteTelt)}.`,
    bilde: '/uploads/bord-pyntet.jpg', innhold, jsonld
  });
}

/* --- produktkatalog --- */
function katalog() {
  const katNavn = [...new Set(PRODUKTER.map(p => p.cat))];
  const innhold = `
<main class="wrap side">
  <div class="side-intro">
    <h1>Alle produkter</h1>
    <p>Samme pris for 1–4 dagers leie – datoene velger du i handlekurven. Åpne et produkt for mål, kapasitet og hva som ofte velges sammen med det.</p>
  </div>
  <nav class="filtre" aria-label="Hopp til kategori">
    ${katNavn.map(n => `<a href="#${slugify(n)}">${esc(n)}</a>`).join('\n    ')}
  </nav>
  <div class="katalog">
    ${katNavn.map(n => `
    <section>
      <h2 id="${slugify(n)}" class="kat-tittel">${esc(n)}</h2>
      <div class="prod-grid">
        ${PRODUKTER.filter(p => p.cat === n).map(produktkort).join('')}
      </div>
    </section>`).join('')}
  </div>
</main>`;

  return layout({
    url: '/utstyr/', tittel: 'Alt utstyr til leie – priser og mål | Berg Utleie',
    beskrivelse: 'Komplett oversikt over utleieutstyr: partytelt, bord, stoler, ståbord, tregulv, duker, lyd og lys. Faste priser, samme pris for 1–4 dagers leie.',
    innhold,
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Forsiden', item: NETTSTED + '/' },
        { '@type': 'ListItem', position: 2, name: 'Alle produkter', item: NETTSTED + '/utstyr/' }
      ]
    }]
  });
}

/* --- produktside --- */
function produktside(p) {
  const hoved = p.bilder[0];
  const pris = p.fast ? kr(p.fast) : 'Fra ' + kr(p.d);
  const prisSub = p.fast
    ? 'Fastpris – uavhengig av leieperiode. Inkluderer alltid 4 jekkestropper, 4 hanketau og 4 jordanker.'
    : 'Samme pris for 1–4 dagers leie · +15 % per døgn utover 4. Velg datoer i handlekurven.';

  const anbefalt = (p.rec || []).map(([rid, n]) => {
    const r = finn(rid);
    return { r, n, sum: r.fast ? kr(n * r.fast) + ' fastpris' : 'Fra ' + kr(n * r.d) };
  });
  const pakkeSum = (p.fast || p.d) + anbefalt.reduce((a, { r, n }) => a + n * (r.fast || r.d), 0);
  const pakkeNavn = p.capL ? `Full festpakke til ${p.capL} gjester` : `Full pakke med ${p.navn.toLowerCase()}`;
  const pakkeInnhold = [p.navn].concat(anbefalt.map(({ r, n }) => n + ' ' + r.navn.toLowerCase().split(',')[0])).join(' + ');

  const innhold = `
<main class="wrap side">
  <p class="brodsmuler"><a href="/utstyr/">Alle produkter</a><span>/</span><span class="naa">${esc(p.navn)}</span></p>

  <div class="prod-topp">
    <div class="galleri" data-galleri>
      <div class="galleri-hoved">
        ${p.bilder.length
          ? `<img src="${hoved.u}" alt="${esc(hoved.alt || p.navn)}" class="${hoved.fit === 'contain' ? 'contain' : ''}" data-galleri-hoved width="900" height="675" fetchpriority="high">`
          : '<span class="tom-media stor" aria-hidden="true"></span>'}
        ${p.bilder.length > 1 ? `
        <button type="button" class="gal-nav forrige" data-gal-forrige aria-label="Forrige bilde">‹</button>
        <button type="button" class="gal-nav neste" data-gal-neste aria-label="Neste bilde">›</button>` : ''}
      </div>
      ${p.bilder.length > 1 ? `
      <div class="miniatyrer">
        ${p.bilder.map((b, i) => `<button type="button" class="mini${i === 0 ? ' aktiv' : ''}" data-mini="${i}" data-u="${b.u}" data-fit="${b.fit || 'cover'}" data-alt="${esc(b.alt || '')}" aria-label="Vis bilde ${i + 1}"><img src="${b.u}" alt="" loading="lazy"></button>`).join('')}
      </div>` : ''}
    </div>

    <div>
      <h1>${esc(p.navn)}</h1>
      <p class="prod-lang">${esc(p.dl)}</p>
      <div class="spesifikasjoner">
        ${p.specs.map(t => `<p><span class="tick">✓</span>${esc(t)}</p>`).join('\n        ')}
      </div>
      <div class="kjopsboks">
        <p class="pris-stor">${pris}</p>
        <p class="pris-sub">${esc(prisSub)}</p>
        <div class="kjop-rad">
          <button type="button" class="btn btn-lg legg-i-kurv bred" data-id="${p.id}">Legg i handlekurven</button>
          <div class="antall-boks" data-antall-boks="${p.id}" hidden>
            <button type="button" class="dec" data-id="${p.id}" aria-label="Fjern én">−</button>
            <span class="val" data-antall="${p.id}">0</span>
            <button type="button" class="inc" data-id="${p.id}" aria-label="Legg til én">+</button>
          </div>
        </div>
        <p class="i-kurv-note" data-i-kurv="${p.id}" hidden></p>
        <p class="mva">Alle priser er inkl. mva. Hent selv gratis i Halden, eller få levert – frakt beregnes i handlekurven.</p>
      </div>
    </div>
  </div>

  ${anbefalt.length ? `
  <section class="anbefalt">
    <h2>Ofte valgt sammen med</h2>
    <p class="anbefalt-intro">${p.capL
      ? `Alt under er regnet ut for at ${esc(p.navn.toLowerCase())} skal være festklart for ${p.capL} gjester.`
      : `Passer godt sammen med ${esc(p.navn.toLowerCase())}.`}</p>

    <div class="pakkeboks">
      <div>
        <p class="pakke-navn">${esc(pakkeNavn)}</p>
        <p class="pakke-innhold">${esc(pakkeInnhold)}</p>
      </div>
      <div class="pakke-hoyre">
        <p class="pakke-pris">Fra ${kr(pakkeSum)}</p>
        <button type="button" class="btn legg-pakke" data-pakke="${p.id}">Legg alt i handlekurven</button>
      </div>
    </div>

    <div class="anbefalt-liste">
      ${anbefalt.map(({ r, n, sum }) => `
      <div class="anbefalt-rad">
        <span class="anbefalt-media">${r.bilder.length ? `<img src="${r.bilder[0].u}" alt="" loading="lazy">` : ''}</span>
        <div>
          <p class="anbefalt-navn"><span class="antall">${n} ×</span> <a href="/utstyr/${r.slug}/">${esc(r.navn)}</a></p>
          <p class="anbefalt-why">${esc(hvorfor(r.id, n, p))}</p>
        </div>
        <div class="anbefalt-hoyre">
          <span class="anbefalt-pris">${sum}</span>
          <button type="button" class="btn-liten legg-i-kurv" data-id="${r.id}" data-antall="${n}">+ Legg til</button>
        </div>
      </div>`).join('')}
    </div>
  </section>` : ''}
</main>`;

  return layout({
    url: `/utstyr/${p.slug}/`,
    tittel: `${p.navn} til leie – ${p.fast ? kr(p.fast) : 'fra ' + kr(p.d)} | Berg Utleie`,
    beskrivelse: `${p.dl.slice(0, 150)}${p.dl.length > 150 ? '…' : ''}`,
    bilde: hoved ? hoved.u : undefined,
    innhold,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.navn, description: p.dl,
        image: p.bilder.map(b => NETTSTED + b.u),
        category: p.cat,
        brand: { '@type': 'Brand', name: 'Berg Utleie' },
        offers: {
          '@type': 'Offer', priceCurrency: 'NOK', price: String(p.fast || p.d),
          availability: 'https://schema.org/InStock',
          url: NETTSTED + `/utstyr/${p.slug}/`,
          priceSpecification: {
            '@type': 'UnitPriceSpecification', priceCurrency: 'NOK', price: String(p.fast || p.d),
            unitText: p.fast ? 'fastpris' : 'per leieperiode 1–4 dager'
          }
        }
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Forsiden', item: NETTSTED + '/' },
          { '@type': 'ListItem', position: 2, name: 'Alle produkter', item: NETTSTED + '/utstyr/' },
          { '@type': 'ListItem', position: 3, name: p.navn, item: NETTSTED + `/utstyr/${p.slug}/` }
        ]
      }
    ]
  });
}

/* Forklaringstekst for hvorfor et tilbehør anbefales i et gitt antall. */
function hvorfor(rid, n, sel) {
  if (rid === 'gulv') {
    const kvm = n * 2;
    if (sel.areal && kvm >= sel.areal) return `${n} moduler = ${kvm} kvm – dekker hele teltgulvet (${sel.areal} kvm)`;
    if (sel.areal) return `${n} moduler = ${kvm} kvm – dekker ${kvm} av teltets ${sel.areal} kvm`;
    return `${n} moduler = ${kvm} kvm gulv`;
  }
  if (rid === 'kbord') return `Plass til ${n * 6}–${n * 8} gjester ved langbord`;
  if (rid === 'rbord') return `Plass til ${n * 8} gjester ved runde bord`;
  if (rid === 'stol') return `Én stol per gjest – ${n} stk`;
  if (rid === 'duk') return `Én duk per bord – ${n} stk`;
  if (rid === 'lys') return n === 1
    ? '1 slynge à 4,5 m langs mønet i taket – skjøteledning og transformator følger med'
    : `${n} slynger skjøtet sammen til ${(n * 4.5).toLocaleString('nb-NO')} m i taket – én transformator holder`;
  if (rid === 'sikring') return n === 1
    ? 'Fastpris · inkluderer alltid 4 jekkestropper, 4 hanketau og 4 jordanker'
    : `Fastpris · ${n} pakker à 4 jekkestropper, 4 hanketau og 4 jordanker`;
  if (rid === 'jbl') return 'Kraftig lyd og lysshow – batteri til hele kvelden';
  return '';
}

/* --- selskapspakker --- */
function pakkeside() {
  const kort = (p, bordtype) => {
    const cfg = p[bordtype];
    if (!cfg) return '';
    const sum = cfg.deler.reduce((a, [id, n]) => { const pr = finn(id); return a + n * (pr.fast || pr.d); }, 0);
    const nBord = (cfg.deler.find(d => d[0] === 'kbord' || d[0] === 'rbord') || [0, 4])[1];
    const hs = bordtype === 'lang' && (p.n === 30 || p.n === 40);
    const svg = teltSvg(cfg.telt, bordtype, nBord, hs, p.n === 50, 0);
    return `
    <article class="pakke-kort" data-pakke-kort data-telt="${cfg.telt}" data-bordtype="${bordtype}" data-nbord="${nBord}" data-hs="${hs ? 1 : 0}" data-ends="${p.n === 50 ? 1 : 0}">
      <div class="pakke-media" data-pakke-media title="Dra for å se rundt">
        ${svg}
        <span class="dra-hint">↻ Dra for å se rundt</span>
      </div>
      <div class="pakke-tekst">
        <div>
          <h3>Selskapspakke · ${p.n} gjester</h3>
          <p class="pakke-pris">Fra ${kr(sum)}</p>
        </div>
        <div class="pakke-innhold">
          ${cfg.deler.map(([id, n]) => `<p><span class="tick">✓</span>${n} × ${esc(finn(id).navn)}</p>`).join('\n          ')}
        </div>
        <div>
          <button type="button" class="btn bred velg-pakke" data-deler="${esc(JSON.stringify(cfg.deler))}">Velg pakken · ${p.n} gjester</button>
          <p class="pakke-note">Tømmer handlekurven og legger inn hele pakken</p>
        </div>
      </div>
    </article>`;
  };

  const innhold = `
<main class="wrap side">
  <div class="side-intro midt">
    <h1>Selskapspakker</h1>
    <p>Komplette pakker med telt, bord, stoler, duker, lys, lyd og sikring. Velg antall gjester og om dere vil sitte ved avlange eller runde bord – resten er pakket klart. Samme pris for 1–4 dagers leie.</p>
  </div>

  <div class="bordvalg" role="tablist">
    <button type="button" class="bordknapp aktiv" data-bordtype="lang" role="tab" aria-selected="true">Avlange bord</button>
    <button type="button" class="bordknapp" data-bordtype="rund" role="tab" aria-selected="false">Runde bord</button>
  </div>
  <p class="rund-note" data-rund-note hidden>Selskap for 50 og 60 gjester dekkes best med avlange bord – bytt til «Avlange bord» for å se dem.</p>

  <div class="pakke-grid" data-gruppe="lang">
    ${PAKKER.map(p => kort(p, 'lang')).join('')}
  </div>
  <div class="pakke-grid" data-gruppe="rund" hidden>
    ${PAKKER.map(p => kort(p, 'rund')).join('')}
  </div>

  <p class="pakke-fot">Trenger du gulv, ståbord eller lys i tillegg? Alt kan legges til i <a href="/utstyr/">produktkatalogen</a> etterpå – handlekurven foreslår det som mangler.</p>
</main>`;

  return layout({
    url: '/selskapspakker/', tittel: 'Selskapspakker for 20–60 gjester | Berg Utleie',
    beskrivelse: 'Ferdige pakker med telt, bord, stoler, duker, lys, lyd og sikring – for 20, 30, 40, 50 eller 60 gjester. Velg avlange eller runde bord. Fast pris.',
    innhold,
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Forsiden', item: NETTSTED + '/' },
        { '@type': 'ListItem', position: 2, name: 'Selskapspakker', item: NETTSTED + '/selskapspakker/' }
      ]
    }]
  });
}

/* --- handlekurv --- */
function handlekurv() {
  const innhold = `
<main class="wrap side">
  <h1 class="kurv-tittel">Handlekurven</h1>

  <div class="kurv-tom" data-kurv-tom>
    <p>Handlekurven er tom.</p>
    <a class="btn btn-lg" href="/utstyr/">Utforsk produktene</a>
  </div>

  <div class="kurv-layout" data-kurv-layout hidden>
    <div class="kurv-venstre">
      <section class="oppsett" data-oppsett hidden>
        <div class="oppsett-topp">
          <h2>Slik kan det se ut</h2>
          <button type="button" class="btn-liten" data-oppsett-snu>↻ Snu</button>
        </div>
        <div class="oppsett-scene" data-oppsett-scene></div>
        <p class="oppsett-note" data-oppsett-note></p>
      </section>

      <div class="kurv-liste" data-kurv-liste></div>

      <section class="innsikt" data-innsikt hidden>
        <h2>Plassen og oppsettet</h2>
        <div data-innsikt-liste></div>
      </section>
    </div>

    <aside class="summary">
      <div>
        <p class="field-label">Leieperiode</p>
        <div class="dato-rad">
          <label><span>Utstyret klart</span><input type="date" data-fra></label>
          <label><span>Leveres tilbake</span><input type="date" data-til></label>
        </div>
        <p class="dager-note" data-dager-note>Velg datoer – 1–4 dagers leie koster det samme.</p>
      </div>

      <div>
        <p class="field-label">Henting eller levering</p>
        <div class="seg" data-seg-modus>
          <button type="button" data-val="hent" aria-pressed="true">Hent selv · 0 kr</button>
          <button type="button" data-val="lev" aria-pressed="false">Få det levert</button>
        </div>
        <div data-adresse-felt hidden style="margin-top: 12px;">
          <input type="text" data-adresse list="stederliste"
                 placeholder="Gateadresse og sted, f.eks. Storgata 1, Fredrikstad">
          <p class="rute-treff" data-rute-treff hidden></p>
          <p class="sone-note" data-adresse-note hidden></p>
        </div>
      </div>

      <div class="sum-lines">
        <div><span class="k">Leie av utstyr <span data-periode-tag>(1–4 dager)</span></span><span class="v" data-leie>0 kr</span></div>
        <div><span class="k">Levering og henting</span><span class="v" data-levering>0 kr</span></div>
      </div>
      <div class="sum-total">
        <span class="label">Totalt</span>
        <span class="value" data-total>0 kr</span>
      </div>
      <p class="mva">Alle priser er inkl. mva. Montering inngår ikke – be om tilbud fra Berg Event.</p>
      <a class="btn btn-lg bred" href="/tilbud/">Send bestillingsforespørsel</a>
      <p class="uforpliktende">Uforpliktende – vi svarer innen 6 timer</p>
    </aside>
  </div>

  <datalist id="stederliste">${STEDER.map(s => `<option value="${esc(s.navn)}">`).join('')}</datalist>
</main>`;

  return layout({
    url: '/handlekurv/', tittel: 'Handlekurven | Berg Utleie',
    beskrivelse: 'Se utstyret du har valgt, velg datoer og henting eller levering, og få totalprisen før du sender forespørsel.',
    innhold
  });
}

/* --- få tilbud --- */
function tilbud() {
  const innhold = `
<main class="wrap tilbud-side">
  <div class="tilbud-intro">
    <h1>Få et uforpliktende tilbud</h1>
    <p>Fortell oss om festen, så sjekker vi tilgjengelighet og svarer med et konkret tilbud innen 6 timer.</p>
  </div>

  <form class="tilbud-skjema" data-skjema>
    <div class="felt-rad">
      <label><span>Navn</span><input type="text" name="navn" placeholder="Fornavn Etternavn" required autocomplete="name"></label>
      <label><span>Mobilnummer</span><input type="tel" name="mobil" placeholder="900 00 000" required autocomplete="tel"></label>
    </div>
    <div class="felt-rad">
      <label><span>E-post</span><input type="email" name="epost" placeholder="navn@epost.no" required autocomplete="email"></label>
      <label><span>Adresse for festen</span><input type="text" name="adresse" data-adresse list="stederliste" placeholder="Gateadresse og sted"></label>
    </div>
    <div>
      <span class="field-label">Henting eller levering</span>
      <div class="seg" data-seg-modus>
        <button type="button" data-val="hent" aria-pressed="true">Hent selv · 0 kr</button>
        <button type="button" data-val="lev" aria-pressed="false">Få det levert</button>
      </div>
    </div>
    <div class="felt-rad">
      <label><span>Utstyret klart</span><input type="date" name="fra" data-fra></label>
      <label><span>Leveres tilbake</span><input type="date" name="til" data-til></label>
    </div>
    <label><span>Kommentar</span><textarea name="kommentar" placeholder="Hva slags utstyr trenger du? Antall gjester, type arrangement og annet vi bør vite."></textarea></label>

    <div class="kurv-sammendrag" data-kurv-sammendrag hidden></div>

    <input type="text" name="firma" tabindex="-1" autocomplete="off" class="honningkrukke" aria-hidden="true">
    <div>
      <button type="submit" class="btn btn-lg bred">Send forespørsel</button>
      <p class="uforpliktende">Uforpliktende – vi svarer innen 6 timer</p>
    </div>
    <p class="skjema-status" data-skjema-status role="status"></p>
  </form>

  <datalist id="stederliste">${STEDER.map(s => `<option value="${esc(s.navn)}">`).join('')}</datalist>
</main>`;

  return layout({
    url: '/tilbud/', tittel: 'Få et uforpliktende tilbud | Berg Utleie',
    beskrivelse: 'Fortell oss om festen, så sjekker vi tilgjengelighet og svarer med et konkret tilbud innen 6 timer. Uforpliktende.',
    innhold
  });
}

/* --- bygg --- */
async function skriv(rel, html) {
  const fil = join(UT, rel, 'index.html');
  await mkdir(dirname(fil), { recursive: true });
  await writeFile(fil, html, 'utf8');
}

await rm(UT, { recursive: true, force: true });
await mkdir(UT, { recursive: true });

await skriv('', forside());
await skriv('utstyr', katalog());
await skriv('selskapspakker', pakkeside());
await skriv('handlekurv', handlekurv());
await skriv('tilbud', tilbud());
for (const p of PRODUKTER) await skriv(join('utstyr', p.slug), produktside(p));

/* statiske filer */
for (const f of ['assets', 'uploads', 'data']) {
  await cp(join(ROT, f), join(UT, f), { recursive: true });
}
for (const f of ['_headers', '_redirects', 'robots.txt', '404.html']) {
  await cp(join(ROT, f), join(UT, f));
}

/* sitemap */
await writeFile(join(UT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sider.map(u => `  <url><loc>${NETTSTED}${u}</loc></url>`).join('\n') +
  `\n</urlset>\n`, 'utf8');

console.log(`Bygget ${sider.length} sider til dist/`);
sider.forEach(s => console.log('  ' + s));
