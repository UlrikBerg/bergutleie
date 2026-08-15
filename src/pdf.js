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
export function bredde(tekst, str, fet) {
  // Gjennomsnittlig tegnbredde for Helvetica, relativt til punktstørrelsen
  const faktor = fet ? 0.58 : 0.52;
  return String(tekst).length * str * faktor;
}

export function nyPdf(logoBase64, logoB, logoH) {
  const deler = [];                      // innholdsstrømmen
  let harLogo = false;

  const farge = (f) => f ? `${f[0]} ${f[1]} ${f[2]} rg\n` : '';

  return {
    tekst(x, y, t, { fet = false, str = 10, f = [0, 0, 0], hoyre = false } = {}) {
      const px = hoyre ? x - bredde(t, str, fet) : x;
      deler.push(
        farge(f) +
        `BT /${fet ? 'F2' : 'F1'} ${str} Tf 1 0 0 1 ${px.toFixed(1)} ${y.toFixed(1)} Tm (${pdfStreng(t)}) Tj ET\n`
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

function latin1Bytes(s) {
  const ut = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) ut[i] = s.charCodeAt(i) & 0xff;
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
