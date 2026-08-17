/* ===========================================================================
   Minimal PDF-bygger for Cloudflare Workers.

   Workers har ingen PDF-biblioteker, så dokumentet settes sammen direkte
   i PDF-syntaks. Det holder for et bookingbilag: tekst i to vekter,
   fargede flater, linjer og ett innbygd JPEG-bilde (logoen).

   Bruk:
     const p = nyPdf();
     p.tekst(40, 780, 'Overskrift', { fet: true, str: 20 });
     p.rekt(40, 700, 515, 1, GRÅ);
     const bytes = p.bygg();
   ======================================================================== */

const SIDE_B = 595, SIDE_H = 842;   // A4 i punkter

/** Latin-1-koding med escaping, slik PDF-strenger krever. */
function pdfStreng(s) {
  const rens = String(s ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[·•]/g, '-')
    .replace(/ | /g, ' ')     // tynt og hardt mellomrom
    .replace(/×/g, 'x')
    .replace(/→/g, '->');
  let ut = '';
  for (const tegn of rens) {
    const k = tegn.codePointAt(0);
    if (tegn === '(' || tegn === ')' || tegn === '\\') ut += '\\' + tegn;
    else if (k < 32) ut += ' ';
    else if (k <= 255) ut += tegn;
    else ut += '?';                      // utenfor latin-1
  }
  return ut;
}

/** Bredden på en tekst i punkter – grov, men god nok til høyrestilling. */
export function bredde(tekst, str, fet, sperre = 0) {
  // Gjennomsnittlig tegnbredde for Helvetica, relativt til punktstørrelsen
  const faktor = fet ? 0.58 : 0.52;
  const n = String(tekst).length;
  return n * str * faktor + Math.max(0, n - 1) * sperre;
}

export function nyPdf(logoBase64, logoB, logoH) {
  const deler = [];                      // innholdsstrømmen
  let harLogo = false;

  const farge = (f) => f ? `${f[0]} ${f[1]} ${f[2]} rg\n` : '';

  return {
    // sperre = ekstra avstand mellom tegnene, til små etiketter i kapitéler.
    // Tc er del av grafikkstaten og lever videre etter ET, så den settes alltid.
    tekst(x, y, t, { fet = false, str = 10, f = [0, 0, 0], hoyre = false, sperre = 0 } = {}) {
      const px = hoyre ? x - bredde(t, str, fet, sperre) : x;
      deler.push(
        farge(f) +
        `BT /${fet ? 'F2' : 'F1'} ${str} Tf ${sperre} Tc `
        + `1 0 0 1 ${px.toFixed(1)} ${y.toFixed(1)} Tm (${pdfStreng(t)}) Tj ET\n`
      );
    },
    rekt(x, y, b, h, f = [0, 0, 0]) {
      deler.push(farge(f) + `${x.toFixed(1)} ${y.toFixed(1)} ${b.toFixed(1)} ${h.toFixed(1)} re f\n`);
    },
    logo(x, y, b) {
      if (!logoBase64) return;
      harLogo = true;
      const h = b * (logoH / logoB);
      deler.push(`q ${b.toFixed(1)} 0 0 ${h.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} cm /Im1 Do Q\n`);
    },

    bygg() {
      const innhold = deler.join('');
      const obj = [];

      obj[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      obj[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
      obj[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${SIDE_B} ${SIDE_H}] `
        + `/Resources << /Font << /F1 4 0 R /F2 5 0 R >>`
        + (harLogo ? ` /XObject << /Im1 6 0 R >>` : '')
        + ` >> /Contents 7 0 R >>`;
      obj[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
      obj[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

      // Bygg fila som byte-biter, siden JPEG-en er binær
      const biter = [];
      const skriv = (s) => biter.push(typeof s === 'string' ? latin1Bytes(s) : s);
      let lengde = 0;
      const posisjoner = [];
      const tell = (b) => { lengde += b.length; };
      const leggTil = (s) => { const b = typeof s === 'string' ? latin1Bytes(s) : s; biter.push(b); tell(b); };

      leggTil('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

      const skrivObj = (nr, kropp, strom) => {
        posisjoner[nr] = lengde;
        leggTil(`${nr} 0 obj\n${kropp}\n`);
        if (strom) {
          leggTil('stream\n');
          leggTil(strom);
          leggTil('\nendstream\n');
        }
        leggTil('endobj\n');
      };

      [1, 2, 3, 4, 5].forEach(n => skrivObj(n, obj[n]));

      if (harLogo) {
        const jpg = base64Bytes(logoBase64);
        skrivObj(6,
          `<< /Type /XObject /Subtype /Image /Width ${logoB} /Height ${logoH} `
          + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`,
          jpg);
      }

      const innholdBytes = latin1Bytes(innhold);
      skrivObj(7, `<< /Length ${innholdBytes.length} >>`, innholdBytes);

      const xrefPos = lengde;
      const antall = harLogo ? 8 : 8;
      let xref = `xref\n0 ${antall}\n0000000000 65535 f \n`;
      for (let n = 1; n <= 7; n++) {
        xref += String(posisjoner[n] ?? 0).padStart(10, '0') + ' 00000 n \n';
      }
      leggTil(xref);
      leggTil(`trailer\n<< /Size ${antall} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

      // slå sammen
      const ut = new Uint8Array(lengde);
      let i = 0;
      for (const b of biter) { ut.set(b, i); i += b.length; }
      return ut;
    }
  };
}

/* Typografiske tegn som finnes i WinAnsiEncoding, men på andre kodepunkter
   enn i Unicode. Uten denne tabellen blir en tankestrek (U+2013) maskert
   ned til 0x13 – et kontrolltegn – og teksten får et hull midt i seg.
   Det er ikke synlig før noen leser en ferdig PDF. */
const WINANSI = new Map([
  [0x2013, 0x96], [0x2014, 0x97],                   // – —
  [0x2018, 0x91], [0x2019, 0x92],                   // ' '
  [0x201C, 0x93], [0x201D, 0x94],                   // " "
  [0x2020, 0x86], [0x2021, 0x87],                   // † ‡
  [0x2022, 0x95], [0x2026, 0x85],                   // • …
  [0x2030, 0x89], [0x20AC, 0x80],                   // ‰ €
  [0x2039, 0x8B], [0x203A, 0x9B],                   // ‹ ›
  [0x0160, 0x8A], [0x0161, 0x9A],                   // Š š
  [0x017D, 0x8E], [0x017E, 0x9E],                   // Ž ž
  [0x0152, 0x8C], [0x0153, 0x9C],                   // Œ œ
  [0x2122, 0x99], [0x0178, 0x9F]                    // ™ Ÿ
]);

/** Tynne og harde mellomrom er usynlige i kilden, men bryter i WinAnsi. */
const MELLOMROM = new Set([0x2009, 0x202F, 0x2007, 0x2060]);

function latin1Bytes(s) {
  const ut = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i);
    if (k < 256) { ut[i] = k; continue; }
    const kart = WINANSI.get(k);
    if (kart !== undefined) ut[i] = kart;
    else if (MELLOMROM.has(k)) ut[i] = 0x20;
    else ut[i] = 0x3F;                               // ? framfor søppel
  }
  return ut;
}

function base64Bytes(b64) {
  const bin = atob(b64);
  const ut = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) ut[i] = bin.charCodeAt(i);
  return ut;
}

/** Uint8Array → base64, som Resend trenger for vedlegg. */
export function tilBase64(bytes) {
  let bin = '';
  const bit = 0x8000;
  for (let i = 0; i < bytes.length; i += bit) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + bit));
  }
  return btoa(bin);
}
