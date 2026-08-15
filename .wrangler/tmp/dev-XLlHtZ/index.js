var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/pdf.js
var SIDE_B = 595;
var SIDE_H = 842;
function pdfStreng(s) {
  const rens = String(s ?? "").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[·•]/g, "-").replace(/ | /g, " ").replace(/×/g, "x").replace(/→/g, "->");
  let ut = "";
  for (const tegn of rens) {
    const k = tegn.codePointAt(0);
    if (tegn === "(" || tegn === ")" || tegn === "\\") ut += "\\" + tegn;
    else if (k < 32) ut += " ";
    else if (k <= 255) ut += tegn;
    else ut += "?";
  }
  return ut;
}
__name(pdfStreng, "pdfStreng");
function bredde(tekst2, str, fet) {
  const faktor = fet ? 0.58 : 0.52;
  return String(tekst2).length * str * faktor;
}
__name(bredde, "bredde");
function nyPdf(logoBase64, logoB, logoH) {
  const deler = [];
  let harLogo = false;
  const farge = /* @__PURE__ */ __name((f) => f ? `${f[0]} ${f[1]} ${f[2]} rg
` : "", "farge");
  return {
    tekst(x, y, t, { fet = false, str = 10, f = [0, 0, 0], hoyre = false } = {}) {
      const px = hoyre ? x - bredde(t, str, fet) : x;
      deler.push(
        farge(f) + `BT /${fet ? "F2" : "F1"} ${str} Tf 1 0 0 1 ${px.toFixed(1)} ${y.toFixed(1)} Tm (${pdfStreng(t)}) Tj ET
`
      );
    },
    rekt(x, y, b, h, f = [0, 0, 0]) {
      deler.push(farge(f) + `${x.toFixed(1)} ${y.toFixed(1)} ${b.toFixed(1)} ${h.toFixed(1)} re f
`);
    },
    logo(x, y, b) {
      if (!logoBase64) return;
      harLogo = true;
      const h = b * (logoH / logoB);
      deler.push(`q ${b.toFixed(1)} 0 0 ${h.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} cm /Im1 Do Q
`);
    },
    bygg() {
      const innhold = deler.join("");
      const obj = [];
      obj[1] = "<< /Type /Catalog /Pages 2 0 R >>";
      obj[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
      obj[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${SIDE_B} ${SIDE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>` + (harLogo ? ` /XObject << /Im1 6 0 R >>` : "") + ` >> /Contents 7 0 R >>`;
      obj[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
      obj[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
      const biter = [];
      const skriv = /* @__PURE__ */ __name((s) => biter.push(typeof s === "string" ? latin1Bytes(s) : s), "skriv");
      let lengde = 0;
      const posisjoner = [];
      const tell = /* @__PURE__ */ __name((b) => {
        lengde += b.length;
      }, "tell");
      const leggTil = /* @__PURE__ */ __name((s) => {
        const b = typeof s === "string" ? latin1Bytes(s) : s;
        biter.push(b);
        tell(b);
      }, "leggTil");
      leggTil("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
      const skrivObj = /* @__PURE__ */ __name((nr, kropp, strom) => {
        posisjoner[nr] = lengde;
        leggTil(`${nr} 0 obj
${kropp}
`);
        if (strom) {
          leggTil("stream\n");
          leggTil(strom);
          leggTil("\nendstream\n");
        }
        leggTil("endobj\n");
      }, "skrivObj");
      [1, 2, 3, 4, 5].forEach((n) => skrivObj(n, obj[n]));
      if (harLogo) {
        const jpg = base64Bytes(logoBase64);
        skrivObj(
          6,
          `<< /Type /XObject /Subtype /Image /Width ${logoB} /Height ${logoH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`,
          jpg
        );
      }
      const innholdBytes = latin1Bytes(innhold);
      skrivObj(7, `<< /Length ${innholdBytes.length} >>`, innholdBytes);
      const xrefPos = lengde;
      const antall = harLogo ? 8 : 8;
      let xref = `xref
0 ${antall}
0000000000 65535 f 
`;
      for (let n = 1; n <= 7; n++) {
        xref += String(posisjoner[n] ?? 0).padStart(10, "0") + " 00000 n \n";
      }
      leggTil(xref);
      leggTil(`trailer
<< /Size ${antall} /Root 1 0 R >>
startxref
${xrefPos}
%%EOF
`);
      const ut = new Uint8Array(lengde);
      let i = 0;
      for (const b of biter) {
        ut.set(b, i);
        i += b.length;
      }
      return ut;
    }
  };
}
__name(nyPdf, "nyPdf");
function latin1Bytes(s) {
  const ut = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) ut[i] = s.charCodeAt(i) & 255;
  return ut;
}
__name(latin1Bytes, "latin1Bytes");
function base64Bytes(b64) {
  const bin = atob(b64);
  const ut = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) ut[i] = bin.charCodeAt(i);
  return ut;
}
__name(base64Bytes, "base64Bytes");
function tilBase64(bytes) {
  let bin = "";
  const bit = 32768;
  for (let i = 0; i < bytes.length; i += bit) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + bit));
  }
  return btoa(bin);
}
__name(tilBase64, "tilBase64");

// src/logo.js
var LOGO_B = 400;
var LOGO_H = 216;
var LOGO_JPEG = [
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQA",
  "AAABAAABkKADAAQAAAABAAAA2AAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmA",
  "CZjs+EJ+/8AAEQgA2AGQAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQE",
  "AAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldY",
  "WVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk",
  "5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMR",
  "BAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdo",
  "aWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz",
  "9PX29/j5+v/bAEMAAQEBAQEBAgEBAgMCAgIDBAMDAwMEBQQEBAQEBQYFBQUFBQUGBgYGBgYGBgcHBwcHBwgICAgICQkJCQkJCQkJ",
  "Cf/bAEMBAQEBAgICBAICBAkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCf/dAAQA",
  "Gf/aAAwDAQACEQMRAD8A/uq+MPxh8AfAnwBffEn4lXy2OmWK8seXkdvuRxqOWdjwAPqcAEj+f34nf8FtPitfa5Ivwi8M6dp+mo2I",
  "zqfmXM7r6sIpIlQ/7I3Y/vGnf8Ft/iZrt78V/C/wiWRk0zT9MGqGMH5XuLmWWLcw7lEiwvpub1r8Pa/jjxh8YMzo5nPLctqezhT0",
  "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"
].join("");

// src/bilag.js
var INK = [0.067, 0.231, 0.247];
var AKSENT = [0.91, 0.337, 0.18];
var DEMPET = [0.353, 0.431, 0.427];
var DEMPET2 = [0.486, 0.553, 0.545];
var LINJE = [0.898, 0.906, 0.882];
var FLATE = [0.969, 0.965, 0.945];
var V = 52;
var H = 543;
var kr = /* @__PURE__ */ __name((n) => (Number(n) || 0).toLocaleString("nb-NO").replace(/ /g, " ") + " kr", "kr");
function lagBilag(d) {
  const p = nyPdf(LOGO_JPEG, LOGO_B, LOGO_H);
  let y = 790;
  p.logo(V, y - 34, 104);
  p.tekst(H, y + 6, "TILBUD", { fet: true, str: 9, f: DEMPET2, hoyre: true });
  p.tekst(H, y - 16, "#" + d.tilbudsnr, { fet: true, str: 22, f: AKSENT, hoyre: true });
  p.tekst(H, y - 32, d.utstedt, { str: 9, f: DEMPET2, hoyre: true });
  y -= 62;
  p.rekt(V, y, H - V, 1.2, INK);
  y -= 34;
  const kol2 = 310;
  p.tekst(V, y, "KUNDE", { fet: true, str: 8, f: AKSENT });
  p.tekst(kol2, y, "LEIEPERIODE", { fet: true, str: 8, f: AKSENT });
  y -= 17;
  const rad = /* @__PURE__ */ __name((venstre, hoyre2) => {
    if (venstre) p.tekst(V, y, venstre, { str: 10.5, f: INK });
    if (hoyre2) p.tekst(kol2, y, hoyre2, { str: 10.5, f: INK });
    y -= 15;
  }, "rad");
  rad(d.navn, d.periode);
  rad(d.mobil, d.dagerLabel);
  rad(d.epost, "");
  y -= 6;
  p.tekst(V, y, d.henter ? "HENTING" : "LEVERINGSADRESSE", { fet: true, str: 8, f: AKSENT });
  y -= 17;
  p.tekst(V, y, d.henter ? "S\xF8rliveien 78, 1788 Halden (ved E6)" : d.levering, { str: 10.5, f: INK });
  y -= 14;
  p.tekst(V, y, d.henter ? "\xC5pent man-fre 09-18 og s\xF8ndag 12-15" : "Utkj\xF8ring og henting er inkludert", { str: 9.5, f: DEMPET });
  y -= 42;
  p.tekst(V, y, "UTSTYR", { fet: true, str: 8, f: AKSENT });
  y -= 16;
  const kAntall = 330, kPris = 430, kSum = H;
  p.tekst(V, y, "Produkt", { fet: true, str: 8, f: DEMPET2 });
  p.tekst(kAntall, y, "Antall", { fet: true, str: 8, f: DEMPET2, hoyre: true });
  p.tekst(kPris, y, "Pris", { fet: true, str: 8, f: DEMPET2, hoyre: true });
  p.tekst(kSum, y, "Sum", { fet: true, str: 8, f: DEMPET2, hoyre: true });
  y -= 7;
  p.rekt(V, y, H - V, 0.8, LINJE);
  y -= 17;
  d.varer.forEach((v) => {
    p.tekst(V, y, kutt(v.navn, 42), { str: 10.5, f: INK });
    p.tekst(kAntall, y, String(v.antall), { str: 10.5, f: DEMPET, hoyre: true });
    p.tekst(kPris, y, v.enhet ? kr(v.enhet) + (v.fast ? " fast" : "") : "", { str: 10.5, f: DEMPET, hoyre: true });
    p.tekst(kSum, y, kr(v.sum), { fet: true, str: 10.5, f: INK, hoyre: true });
    y -= 8;
    p.rekt(V, y, H - V, 0.5, LINJE);
    y -= 15;
  });
  y -= 12;
  const sumLinje = /* @__PURE__ */ __name((etikett, verdi, { fet = false, f = DEMPET } = {}) => {
    p.tekst(kPris, y, etikett, { str: fet ? 11 : 10, f: fet ? INK : f, fet, hoyre: true });
    p.tekst(kSum, y, verdi, { str: fet ? 13 : 10, f: INK, fet: true, hoyre: true });
    y -= fet ? 20 : 15;
  }, "sumLinje");
  sumLinje("Leie av utstyr", kr(d.leie));
  sumLinje(d.henter ? "Henting p\xE5 lager" : "Levering og henting", d.frakt ? kr(d.frakt) : "0 kr");
  y -= 3;
  p.rekt(kPris - 120, y + 8, H - kPris + 120, 0.5, LINJE);
  y -= 8;
  sumLinje("Sum eks. mva", kr(d.utenMva));
  sumLinje("Mva 25 %", kr(d.mva));
  y -= 2;
  p.rekt(kPris - 120, y + 10, H - kPris + 120, 1.2, INK);
  y -= 6;
  sumLinje("Totalt inkl. mva", kr(d.total), { fet: true });
  y -= 18;
  const boksH = 128;
  p.rekt(V, y - boksH, H - V, boksH, FLATE);
  p.rekt(V, y - boksH, 3, boksH, AKSENT);
  p.tekst(V + 18, y - 21, "BETALING AV FORSKUDD", { fet: true, str: 8, f: AKSENT });
  p.tekst(V + 18, y - 46, kr(d.forskudd), { fet: true, str: 19, f: INK });
  p.tekst(V + 18, y - 61, "50 % av totalen", { str: 9, f: DEMPET2 });
  const kx = V + 205;
  p.tekst(kx, y - 40, "Kontonummer", { str: 8.5, f: DEMPET2 });
  p.tekst(kx + 100, y - 40, d.kontonr, { fet: true, str: 12, f: INK });
  p.tekst(kx, y - 60, "Merkes med", { str: 8.5, f: DEMPET2 });
  p.tekst(kx + 100, y - 60, "Tilbud " + d.tilbudsnr, { fet: true, str: 12, f: AKSENT });
  p.tekst(kx, y - 78, "Bel\xF8p", { str: 8.5, f: DEMPET2 });
  p.tekst(kx + 100, y - 78, kr(d.forskudd), { fet: true, str: 12, f: INK });
  p.rekt(V + 18, y - 92, H - V - 36, 0.5, LINJE);
  p.tekst(V + 18, y - 106, d.henter ? "Forskuddet m\xE5 v\xE6re betalt f\xF8r utstyret kan hentes." : "Forskuddet m\xE5 v\xE6re betalt f\xF8r vi kj\xF8rer ut utstyret.", { str: 9.5, f: INK });
  p.tekst(
    V + 18,
    y - 119,
    `Resten, ${kr(d.rest)}, faktureres etter at utstyret er levert tilbake.`,
    { str: 9.5, f: DEMPET }
  );
  y -= boksH + 24;
  if (d.kommentar) {
    p.tekst(V, y, "KOMMENTAR FRA KUNDEN", { fet: true, str: 8, f: AKSENT });
    y -= 16;
    brytTekst(d.kommentar, 88).slice(0, 4).forEach((l) => {
      p.tekst(V, y, l, { str: 10, f: INK });
      y -= 14;
    });
  }
  p.rekt(V, 78, H - V, 0.5, LINJE);
  p.tekst(V, 64, "Berg Utleie", { fet: true, str: 9.5, f: INK });
  p.tekst(V, 52, `Org.nr. ${d.orgnr}`, { str: 9, f: DEMPET });
  p.tekst(V, 40, `Konto ${d.kontonr}`, { str: 9, f: DEMPET });
  p.tekst(V + 200, 64, "S\xF8rliveien 78, 1788 Halden", { str: 9, f: DEMPET });
  p.tekst(V + 200, 52, "Man-fre 09-18  \xB7  S\xF8ndag 12-15", { str: 9, f: DEMPET });
  p.tekst(H, 64, d.epostFirma, { str: 9, f: DEMPET, hoyre: true });
  p.tekst(H, 52, "bergutleie.no", { str: 9, f: DEMPET, hoyre: true });
  p.tekst(H, 40, "Alle priser inkl. mva  \xB7  Montering inng\xE5r ikke", { str: 8.5, f: DEMPET2, hoyre: true });
  p.tekst(V, 26, `Tilbud #${d.tilbudsnr} \xB7 gyldig i 14 dager fra ${d.utstedt}`, { str: 8.5, f: DEMPET2 });
  return tilBase64(p.bygg());
}
__name(lagBilag, "lagBilag");
function kutt(s, maks) {
  return s.length > maks ? s.slice(0, maks - 1) + "\u2026" : s;
}
__name(kutt, "kutt");
function brytTekst(s, bredde2) {
  const ord = String(s).replace(/\s+/g, " ").trim().split(" ");
  const linjer = [];
  let n = "";
  for (const o of ord) {
    if ((n + " " + o).trim().length > bredde2) {
      linjer.push(n.trim());
      n = o;
    } else n += " " + o;
  }
  if (n.trim()) linjer.push(n.trim());
  return linjer;
}
__name(brytTekst, "brytTekst");

// src/foresporsel.js
var AVSENDER = "Berg Utleie <skjema@bergutleie.no>";
var MVA_SATS = 0.25;
var FORSKUDD_ANDEL = 0.5;
var KONTONR = "9803 22 90426";
var ORGNR = "919 326 581";
var EPOST = "post@bergutleie.no";
var TILBUDSNR_START = 17512;
var C = {
  ink: "#113B3F",
  aksent: "#E8562E",
  bg: "#F7F6F1",
  linje: "#E5E7E1",
  dempet: "#5A6E6D",
  dempet2: "#7C8D8B"
};
async function nesteTilbudsnr(env) {
  if (env.TELLER) {
    try {
      const forrige = parseInt(await env.TELLER.get("tilbudsnr"), 10);
      const neste = (isNaN(forrige) ? TILBUDSNR_START : forrige) + 1;
      await env.TELLER.put("tilbudsnr", String(neste));
      return neste;
    } catch {
    }
  }
  const minutterSidenStart = Math.floor((Date.now() - Date.UTC(2026, 7, 15)) / 6e4);
  return TILBUDSNR_START + minutterSidenStart;
}
__name(nesteTilbudsnr, "nesteTilbudsnr");
async function handterForesporsel(request, env) {
  let data;
  try {
    data = await request.json();
  } catch {
    return svar(400, { feil: "Ugyldig foresp\xF8rsel" });
  }
  if (data.firma) return svar(200, { ok: true });
  const navn = tekst(data.navn, 100) || [tekst(data.fornavn, 60), tekst(data.etternavn, 60)].filter(Boolean).join(" ");
  const mobil = tekst(data.mobil, 40) || "Ikke oppgitt";
  const epost = tekst(data.epost, 120);
  if (!navn || !epost || !epost.includes("@")) {
    return svar(400, { feil: "Fyll ut navn og e-post." });
  }
  const varer = Array.isArray(data.varer) ? data.varer.slice(0, 60) : [];
  if (!varer.length) return svar(400, { feil: "Handlekurven er tom." });
  const leie = varer.reduce((a, v) => a + (Number(v.sum) || 0), 0);
  const frakt = Number(data.fraktpris) || 0;
  const total = leie + frakt;
  const utenMva = Math.round(total / (1 + MVA_SATS));
  const mva = total - utenMva;
  const dagerLabel = tekst(data.dagerLabel, 30) || "1\u20134 dager";
  const fra = tekst(data.fra, 20), til = tekst(data.til, 20);
  const periode = fra && til ? `${norskDato(fra)} \u2013 ${norskDato(til)}` : "Ikke valgt";
  const levering = tekst(data.levering, 200) || "Ikke oppgitt";
  const henter = /henter selv/i.test(levering);
  const kommentar = tekst(data.kommentar, 2e3);
  const naa = /* @__PURE__ */ new Date();
  const tilbudsnr = await nesteTilbudsnr(env);
  const felles = {
    navn,
    mobil,
    epost,
    periode,
    dagerLabel,
    levering,
    henter,
    varer,
    leie,
    frakt,
    total,
    utenMva,
    mva,
    kommentar,
    hentDato: fra ? norskDato(fra) : "avtales",
    returDato: til ? norskDato(til) : "avtales",
    tilbudsnr,
    kontonr: KONTONR,
    orgnr: ORGNR,
    epostFirma: EPOST,
    utstedt: `${naa.getDate()}. ${MANEDER[naa.getMonth()]} ${naa.getFullYear()}`,
    forskudd: Math.round(total * FORSKUDD_ANDEL),
    rest: total - Math.round(total * FORSKUDD_ANDEL)
  };
  if (!env.RESEND_API_KEY) {
    return svar(500, { feil: "E-post er ikke satt opp enn\xE5." });
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: AVSENDER,
      to: [env.VARSEL_TIL || "kontakt@bergevent.no"],
      reply_to: epost,
      subject: `Foresp\xF8rsel #${tilbudsnr} fra ${navn} \u2013 ${nok(total)}${fra ? " \u2013 " + norskDato(fra) : ""}`,
      html: htmlEpost(felles),
      text: tekstEpost(felles),
      attachments: [{
        filename: `Tilbud-${tilbudsnr}-Berg-Utleie.pdf`,
        content: lagBilag(felles)
      }]
    })
  });
  if (!res.ok) {
    return svar(502, { feil: "Klarte ikke \xE5 sende e-posten." });
  }
  return svar(200, { ok: true });
}
__name(handterForesporsel, "handterForesporsel");
function htmlEpost(d) {
  const rad = /* @__PURE__ */ __name((v) => `
    <tr>
      <td style="padding:11px 8px 11px 0;border-bottom:1px solid ${C.linje};font-size:15px;color:${C.ink};">
        <strong style="font-weight:700;">${esc(v.navn)}</strong>
      </td>
      <td style="padding:11px 8px;border-bottom:1px solid ${C.linje};font-size:14px;color:${C.dempet};text-align:center;white-space:nowrap;">
        ${Number(v.antall) || 0} stk
      </td>
      <td style="padding:11px 8px;border-bottom:1px solid ${C.linje};font-size:14px;color:${C.dempet};text-align:right;white-space:nowrap;">
        ${v.enhet ? nok(v.enhet) + (v.fast ? " fast" : "") : ""}
      </td>
      <td style="padding:11px 0 11px 8px;border-bottom:1px solid ${C.linje};font-size:15px;color:${C.ink};text-align:right;font-weight:700;white-space:nowrap;">
        ${nok(v.sum)}
      </td>
    </tr>`, "rad");
  const sumRad = /* @__PURE__ */ __name((etikett, verdi, fet) => `
    <tr>
      <td style="padding:${fet ? "13px" : "6px"} 0 ${fet ? "13px" : "6px"};font-size:${fet ? "17px" : "14.5px"};color:${fet ? C.ink : C.dempet};font-weight:${fet ? "800" : "400"};${fet ? `border-top:2px solid ${C.ink};` : ""}">
        ${etikett}
      </td>
      <td style="padding:${fet ? "13px" : "6px"} 0 ${fet ? "13px" : "6px"};font-size:${fet ? "22px" : "14.5px"};color:${C.ink};text-align:right;font-weight:${fet ? "800" : "700"};white-space:nowrap;${fet ? `border-top:2px solid ${C.ink};` : ""}">
        ${verdi}
      </td>
    </tr>`, "sumRad");
  const infoRad = /* @__PURE__ */ __name((etikett, verdi) => `
    <tr>
      <td style="padding:5px 16px 5px 0;font-size:13px;color:${C.dempet2};white-space:nowrap;vertical-align:top;">${etikett}</td>
      <td style="padding:5px 0;font-size:15px;color:${C.ink};font-weight:600;">${verdi}</td>
    </tr>`, "infoRad");
  return `<!doctype html>
<html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ny foresp\xF8rsel</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${C.linje};">

  <tr><td style="background:${C.ink};padding:26px 30px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#7FA09E;">Berg Utleie</p>
    <h1 style="margin:0;font-size:23px;font-weight:800;color:#ffffff;">Ny foresp\xF8rsel</h1>
    <p style="margin:6px 0 0;font-size:14px;color:#BCD0CE;">${esc(d.navn)} \xB7 ${nok(d.total)} \xB7 Tilbud #${d.tilbudsnr}</p>
  </td></tr>

  <tr><td style="padding:26px 30px 6px;">
    <p style="margin:0 0 12px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.aksent};">Kunde</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${infoRad("Navn", esc(d.navn))}
      ${infoRad("Mobil", `<a href="tel:${esc(d.mobil.replace(/\s/g, ""))}" style="color:${C.ink};text-decoration:none;">${esc(d.mobil)}</a>`)}
      ${infoRad("E-post", `<a href="mailto:${esc(d.epost)}" style="color:${C.aksent};text-decoration:none;">${esc(d.epost)}</a>`)}
    </table>
  </td></tr>

  <tr><td style="padding:22px 30px 6px;">
    <p style="margin:0 0 12px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.aksent};">Leie</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${infoRad("Periode", esc(d.periode) + ` <span style="color:${C.dempet2};font-weight:400;">(${esc(d.dagerLabel)})</span>`)}
      ${infoRad(d.henter ? "Henting" : "Levering", esc(d.levering))}
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
      ${d.varer.map(rad).join("")}
    </table>
  </td></tr>

  <tr><td style="padding:18px 30px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${sumRad("Leie av utstyr", nok(d.leie))}
      ${sumRad(d.henter ? "Henting p\xE5 lager" : "Levering og henting", d.frakt ? nok(d.frakt) : "0 kr")}
      ${sumRad(`Herav mva (${MVA_SATS * 100} %)`, nok(d.mva))}
      ${sumRad("Sum eks. mva", nok(d.utenMva))}
      ${sumRad("Totalt inkl. mva", nok(d.total), true)}
    </table>
  </td></tr>

  ${d.kommentar ? `
  <tr><td style="padding:0 30px 26px;">
    <div style="background:${C.bg};border-left:3px solid ${C.aksent};border-radius:8px;padding:16px 18px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.dempet};">Kommentar fra kunden</p>
      <p style="margin:0;font-size:15px;color:${C.ink};line-height:1.6;white-space:pre-wrap;">${esc(d.kommentar)}</p>
    </div>
  </td></tr>` : ""}

  <tr><td style="padding:0 30px 30px;">
    <a href="${svarmal(d)}"
       style="display:inline-block;background:${C.aksent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:8px;">
      Bekreft bookingen til ${esc(d.navn.split(" ")[0])}
    </a>
    <p style="margin:12px 0 0;font-size:12.5px;color:${C.dempet2};">
      \xC5pner en ferdig bekreftelse med hentetidspunkt, forskudd og foresp\xF8rselen sitert under.
      Bookingdetaljene ligger vedlagt som PDF \u2013 den kan videresendes til kunden.
    </p>
  </td></tr>

  <tr><td style="background:${C.bg};padding:16px 30px;border-top:1px solid ${C.linje};">
    <p style="margin:0;font-size:12px;color:${C.dempet2};">
      Sendt fra skjemaet p\xE5 <a href="https://bergutleie.no" style="color:${C.dempet};">bergutleie.no</a>.
      Prisene er beregnet av kalkulatoren og m\xE5 bekreftes f\xF8r tilbud sendes.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
__name(htmlEpost, "htmlEpost");
function svarmal(d) {
  const fornavn = d.navn.split(" ")[0];
  const bredde2 = 42;
  const linje = /* @__PURE__ */ __name((a, b) => "  " + a.padEnd(bredde2 - String(b).length, ".") + " " + b, "linje");
  const forskudd = Math.round(d.total * FORSKUDD_ANDEL);
  const rest = d.total - forskudd;
  const kropp = [
    `Hei ${fornavn},`,
    "",
    `Vi kontakter deg vedr\xF8rende henvendelsen om booking av selskapsutstyr`,
    `${d.periode === "Ikke valgt" ? "" : "til " + d.periode + ". "}Utstyret er satt av til deg, og avtalen er med dette bekreftet.`,
    "",
    "HENTING OG TILBAKELEVERING",
    ...d.henter ? [
      `  Hentes:            ${d.hentDato}`,
      `  Leveres tilbake:   ${d.returDato}`,
      "  Sted: S\xF8rliveien 78, 1788 Halden (rett ved E6).",
      "  \xC5pent man\u2013fre 09\u201318 og s\xF8ndag 12\u201315."
    ] : [
      `  Leveres ut:        ${d.hentDato}`,
      `  Hentes igjen:      ${d.returDato}`,
      `  Adresse: ${d.levering}`
    ],
    "",
    "UTSTYRET",
    ...d.varer.map((v) => linje(`${v.antall} \xD7 ${v.navn}`, nok(v.sum))),
    ...d.frakt ? [linje("Levering og henting", nok(d.frakt))] : [],
    "  " + "-".repeat(bredde2),
    linje("Totalt inkl. mva", nok(d.total)),
    "",
    "BETALING",
    `Tilbudsnummer: ${d.tilbudsnr}`,
    `Konto: ${KONTONR}`,
    "Merk betalingen med tilbudsnummeret.",
    "",
    `Det er ${Math.round(FORSKUDD_ANDEL * 100)} % forskuddsbetaling p\xE5 bookingen, alts\xE5 ${nok(forskudd)}.`,
    d.henter ? "Forskuddet m\xE5 v\xE6re betalt f\xF8r utstyret kan hentes." : "Forskuddet m\xE5 v\xE6re betalt f\xF8r vi kj\xF8rer ut utstyret.",
    `Resten, ${nok(rest)}, faktureres etter at utstyret er levert tilbake.`,
    "",
    "Gi oss gjerne beskjed hvis noe skal endres, s\xE5 ordner vi det.",
    "Du kan svare direkte p\xE5 denne e-posten.",
    "",
    "Med vennlig hilsen",
    "Berg Utleie",
    "kontakt@bergevent.no \xB7 bergutleie.no",
    "",
    "",
    "--------------------------------------------------",
    "Din foresp\xF8rsel fra bergutleie.no:",
    "",
    `  Navn:      ${d.navn}`,
    `  Mobil:     ${d.mobil}`,
    `  E-post:    ${d.epost}`,
    `  Periode:   ${d.periode} (${d.dagerLabel})`,
    `  ${d.henter ? "Henting:  " : "Levering: "} ${d.levering}`,
    "",
    ...d.varer.map((v) => `  ${v.antall} \xD7 ${v.navn} \u2014 ${nok(v.sum)}`),
    "",
    `  Totalt inkl. mva: ${nok(d.total)}`,
    ...d.kommentar ? ["", "  Kommentar:", ...d.kommentar.split("\n").map((l) => "  " + l)] : []
  ].join("\n");
  return "mailto:" + encodeURIComponent(d.epost) + "?subject=" + encodeURIComponent(`Bekreftelse p\xE5 booking \u2013 Berg Utleie${d.periode === "Ikke valgt" ? "" : " \u2013 " + d.periode}`) + "&body=" + encodeURIComponent(kropp);
}
__name(svarmal, "svarmal");
function tekstEpost(d) {
  const bredde2 = 46;
  const linje = /* @__PURE__ */ __name((a, b) => a.padEnd(bredde2 - String(b).length, " ") + b, "linje");
  return [
    "NY FORESP\xD8RSEL FRA BERGUTLEIE.NO",
    "=".repeat(bredde2),
    "",
    "KUNDE",
    `  Navn:    ${d.navn}`,
    `  Mobil:   ${d.mobil}`,
    `  E-post:  ${d.epost}`,
    "",
    "LEIE",
    `  Periode:  ${d.periode} (${d.dagerLabel})`,
    `  ${d.henter ? "Henting:" : "Levering:"}  ${d.levering}`,
    "",
    "UTSTYR",
    ...d.varer.map((v) => `  ${String(v.antall).padStart(3)} \xD7 ${v.navn}`.padEnd(bredde2 - nok(v.sum).length) + nok(v.sum)),
    "",
    "-".repeat(bredde2),
    linje("  Leie av utstyr", nok(d.leie)),
    linje(d.henter ? "  Henting p\xE5 lager" : "  Levering og henting", d.frakt ? nok(d.frakt) : "0 kr"),
    linje(`  Herav mva (${MVA_SATS * 100} %)`, nok(d.mva)),
    linje("  Sum eks. mva", nok(d.utenMva)),
    "=".repeat(bredde2),
    linje("  TOTALT INKL. MVA", nok(d.total)),
    "",
    ...d.kommentar ? ["KOMMENTAR FRA KUNDEN", d.kommentar, ""] : [],
    "Svar p\xE5 denne e-posten g\xE5r rett til kunden."
  ].join("\n");
}
__name(tekstEpost, "tekstEpost");
function tekst(v, maks) {
  return typeof v === "string" ? v.trim().slice(0, maks) : "";
}
__name(tekst, "tekst");
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(esc, "esc");
function nok(n) {
  return (Number(n) || 0).toLocaleString("nb-NO").replace(/ /g, " ") + " kr";
}
__name(nok, "nok");
var MANEDER = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember"
];
function norskDato(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])}. ${MANEDER[Number(m[2]) - 1]} ${m[1]}`;
}
__name(norskDato, "norskDato");
function svar(status, kropp) {
  return new Response(JSON.stringify(kropp), {
    status,
    headers: { "content-type": "application/json" }
  });
}
__name(svar, "svar");

// src/adresse.js
var KARTVERKET = "https://ws.geonorge.no/adresser/v1/sok";
var CACHE_SEKUNDER = 86400;
var LAGER = { lat: 59.12257, lon: 11.30843 };
function avstandKm(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return Infinity;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat - LAGER.lat) * rad, dLon = (lon - LAGER.lon) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(LAGER.lat * rad) * Math.cos(lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
__name(avstandKm, "avstandKm");
function medJokertegn(s) {
  return s.replace(/ae/gi, "*").replace(/oe/gi, "*").replace(/aa/gi, "*").replace(/[oa]/gi, "*").replace(/\*{2,}/g, "*");
}
__name(medJokertegn, "medJokertegn");
async function slaOpp(sok) {
  const kilde = new URL(KARTVERKET);
  kilde.searchParams.set("sok", sok);
  kilde.searchParams.set("treffPerSide", "30");
  kilde.searchParams.set("side", "0");
  kilde.searchParams.set("asciiKompatibel", "true");
  return fetch(kilde.toString(), {
    headers: { accept: "application/json" },
    cf: { cacheTtl: CACHE_SEKUNDER, cacheEverything: true }
  });
}
__name(slaOpp, "slaOpp");
async function handterAdressesok(request) {
  const url = new URL(request.url);
  const sok = (url.searchParams.get("sok") || "").trim();
  if (sok.length < 3) return json({ adresser: [] });
  let svar2;
  try {
    svar2 = await slaOpp(sok);
  } catch {
    return json({ adresser: [], feil: "Adresses\xF8ket er utilgjengelig" }, 502);
  }
  if (!svar2.ok) return json({ adresser: [], feil: "Adresses\xF8ket svarte ikke" }, 502);
  let data = await svar2.json();
  if (!(data.adresser || []).length) {
    const alternativ = medJokertegn(sok);
    if (alternativ !== sok && alternativ.includes("*")) {
      try {
        const nytt = await slaOpp(alternativ);
        if (nytt.ok) data = await nytt.json();
      } catch {
      }
    }
  }
  const band = /* @__PURE__ */ __name((km) => km <= 60 ? 0 : km <= 150 ? 1 : km <= 300 ? 2 : 3, "band");
  const adresser = (data.adresser || []).map((a, i) => {
    const lat = a.representasjonspunkt?.lat;
    const lon = a.representasjonspunkt?.lon;
    const km = Math.round(avstandKm(lat, lon));
    return {
      tekst: a.adressetekst,
      postnr: a.postnummer,
      poststed: a.poststed,
      kommune: a.kommunenavn,
      lat,
      lon,
      km,
      _rang: band(km) * 1e3 + i
    };
  }).sort((a, b) => a._rang - b._rang).slice(0, 6).map(({ _rang, ...a }) => a);
  return json({ adresser }, 200, CACHE_SEKUNDER);
}
__name(handterAdressesok, "handterAdressesok");
function json(kropp, status = 200, cache = 0) {
  return new Response(JSON.stringify(kropp), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache ? `public, max-age=${cache}` : "no-store"
    }
  });
}
__name(json, "json");

// src/index.js
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.bergutleie.no") {
      url.hostname = "bergutleie.no";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/adresse") {
      return handterAdressesok(request);
    }
    if (url.pathname === "/api/foresporsel") {
      if (request.method !== "POST") {
        return new Response("Kun POST", { status: 405, headers: { allow: "POST" } });
      }
      return handterForesporsel(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-kvmamF/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-kvmamF/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
