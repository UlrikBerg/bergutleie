/* ===========================================================================
   Lokalt redigeringsverktøy – kun for byggefasen.

   Kjør:  npm run rediger      → åpner http://localhost:8080

   Serveren binder seg til 127.0.0.1 og er derfor bare tilgjengelig fra
   denne maskinen. Verktøyet ligger utenfor dist/, så det blir aldri
   deployet til bergutleie.no uansett hva som skjer.

   Endringer skrives rett inn i PRODUKTER-blokken i data/produkter.js.
   Resten av fila (pakker, soner, prislogikk og kommentarer) røres ikke.
   ======================================================================== */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = dirname(fileURLToPath(import.meta.url));
const DATAFIL = join(ROT, 'data', 'produkter.js');
const PORT = 8080;

/* --- lesing og skriving av produktdata --- */

async function lesProdukter() {
  // Cache-buster så vi alltid får siste versjon fra disk
  const mod = await import(`./data/produkter.js?t=${Date.now()}`);
  return mod.PRODUKTER;
}

/** Serialiserer ett produkt tilbake til pen JS-kildekode. */
function skrivProdukt(p) {
  const s = (v) => JSON.stringify(v).replace(/\\"/g, '\\"');
  const linjer = [];
  linjer.push(`  {`);
  linjer.push(`    id: ${s(p.id)}, slug: ${s(p.slug)}, cat: ${s(p.cat)},`);
  linjer.push(`    navn: ${s(p.navn)}, desc: ${s(p.desc)},`);
  linjer.push(`    dl: ${s(p.dl)},`);
  const pris = p.fast != null ? `fast: ${p.fast}` : `d: ${p.d}`;
  const mal = [pris, `lp: ${p.lp}`];
  if (p.areal != null) mal.push(`areal: ${p.areal}`);
  if (p.capL != null) mal.push(`capL: ${p.capL}`);
  if (p.capR != null) mal.push(`capR: ${p.capR}`);
  linjer.push(`    ${mal.join(', ')},`);

  if (p.bilder?.length) {
    linjer.push(`    bilder: [`);
    p.bilder.forEach((b, i) => {
      const deler = [`u: ${s(b.u)}`];
      if (b.fit) deler.push(`fit: ${s(b.fit)}`);
      deler.push(`alt: ${s(b.alt || '')}`);
      linjer.push(`      { ${deler.join(', ')} }${i < p.bilder.length - 1 ? ',' : ''}`);
    });
    linjer.push(`    ],`);
  } else {
    linjer.push(`    bilder: [],`);
  }

  linjer.push(`    specs: [${(p.specs || []).map(s).join(', ')}],`);
  const rec = (p.rec || []).map(([id, n]) => `[${s(id)}, ${n}]`).join(', ');
  linjer.push(`    rec: [${rec}]`);
  linjer.push(`  }`);
  return linjer.join('\n');
}

async function lagreProdukter(produkter) {
  const kilde = await readFile(DATAFIL, 'utf8');
  const start = kilde.indexOf('export const PRODUKTER = [');
  if (start === -1) throw new Error('Fant ikke PRODUKTER i data/produkter.js');

  // Finn den avsluttende ];  på egen linje
  const slutt = kilde.indexOf('\n];', start);
  if (slutt === -1) throw new Error('Fant ikke slutten av PRODUKTER');

  const ny = 'export const PRODUKTER = [\n'
    + produkter.map(skrivProdukt).join(',\n')
    + '\n];';

  const oppdatert = kilde.slice(0, start) + ny + kilde.slice(slutt + 3);
  await writeFile(DATAFIL, oppdatert, 'utf8');
}

/* --- HTTP --- */

const json = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const lesKropp = (req) => new Promise((ok, feil) => {
  const biter = [];
  req.on('data', b => biter.push(b));
  req.on('end', () => {
    try { ok(JSON.parse(Buffer.concat(biter).toString('utf8'))); }
    catch (e) { feil(e); }
  });
  req.on('error', feil);
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const html = await readFile(join(ROT, 'rediger.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/api/produkter') {
      return json(res, 200, await lesProdukter());
    }

    if (req.method === 'POST' && url.pathname === '/api/lagre') {
      const produkter = await lesKropp(req);
      await lagreProdukter(produkter);
      console.log(`  lagret ${produkter.length} produkter til data/produkter.js`);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/bilde') {
      const { filnavn, data } = await lesKropp(req);
      const trygt = filnavn.toLowerCase()
        .replace(/[æå]/g, 'a').replace(/ø/g, 'o')
        .replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
      const ext = extname(trygt) || '.jpg';
      const navn = trygt.slice(0, trygt.length - ext.length).slice(0, 50) + ext;
      const bin = Buffer.from(data.split(',')[1], 'base64');
      await mkdir(join(ROT, 'uploads'), { recursive: true });
      await writeFile(join(ROT, 'uploads', navn), bin);
      console.log(`  lastet opp uploads/${navn} (${Math.round(bin.length / 1024)} kB)`);
      return json(res, 200, { sti: `/uploads/${navn}` });
    }

    // Bilder, så miniatyrer kan vises i verktøyet
    if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
      const fil = join(ROT, decodeURIComponent(url.pathname));
      const typer = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
      const b = await readFile(fil);
      res.writeHead(200, { 'content-type': typer[extname(fil)] || 'application/octet-stream' });
      return res.end(b);
    }

    res.writeHead(404); res.end('Ikke funnet');
  } catch (feil) {
    console.error('  feil:', feil.message);
    json(res, 500, { feil: feil.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Redigering av produkter: http://localhost:${PORT}\n`);
  console.log('  Endringer lagres i data/produkter.js.');
  console.log('  Kjør deretter:  npm run bygg  og push for å publisere.\n');
});
