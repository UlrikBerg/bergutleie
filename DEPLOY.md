# Berg Utleie – drift og publisering

## Slik endrer du priser og produkter

Alt av produkter, priser, pakker og fraktsoner ligger i **`data/produkter.js`**.
Det er eneste sted priser skal endres – alle 20 sidene bygges fra den fila.

```
cd ~/bergutleie
# endre prisen i data/produkter.js
npm run bygg          # bygger dist/ på nytt
npm start             # bygger og starter http://localhost:8899 for å se over
git add -A && git commit -m "Justerte prisen på X" && git push
```

Cloudflare bygger og publiserer automatisk ved push. Live på ca. ett minutt.

## Sidestruktur

| URL | Innhold |
|---|---|
| `/` | Forside |
| `/utstyr/` | Produktkatalog, alle 16 produkter |
| `/utstyr/<slug>/` | Én side per produkt – 16 stk |
| `/selskapspakker/` | Ferdige pakker for 20–60 gjester |
| `/foresporsel/` | Handlekurv, prisberegning og skjema |

## Filene

| Fil | Hva den gjør |
|---|---|
| `data/produkter.js` | **Produkter, priser, pakker, fraktsoner.** Endres her. |
| `data/telt-svg.js` | Tegner teltoppsettet isometrisk. Brukes av både bygg og nettleser. |
| `bygg.js` | Genererer alle sidene til `dist/`. |
| `assets/app.js` | Handlekurv, galleri, prisberegning i nettleseren. |
| `assets/style.css` | Alle stiler. |
| `functions/api/foresporsel.js` | Tar imot skjemaet og sender e-post. |
| `_redirects` | Ekte 301-omdirigeringer. Legg inn en linje når en URL endres. |
| `_headers` | Cache og sikkerhetsheadere. |
| `sitemap.xml` | Genereres automatisk av `bygg.js`. |

`dist/` er bygget output og ligger ikke i git – Cloudflare bygger den selv.

## Innstillinger i Cloudflare

Prosjektet må ha disse (Settings → Builds & deployments):

- **Build command:** `npm run bygg`
- **Build output directory:** `dist`
- **Root directory:** `/`

Og under Settings → Environment variables (for skjemaet):

- `RESEND_API_KEY` – API-nøkkel fra resend.com
- `VARSEL_TIL` – `post@bergutleie.no`

## Gjenstår

- [ ] Rydd DNS i Cloudflare: slett A-postene mot `185.199.*` og CNAME `www` → `ulrikberg.github.io`
- [ ] Koble `bergutleie.no` og `www.bergutleie.no` som custom domains på Pages-prosjektet
- [ ] Sett build command og output directory som over
- [ ] Opprett Resend-konto, verifiser bergutleie.no som avsenderdomene, legg inn nøkkelen
- [ ] Slå på «Always Use HTTPS» når sertifikatet er utstedt
- [ ] Google Search Console: verifiser domenet og send inn sitemap
- [ ] Gå gjennom prisene i `data/produkter.js` mot faktiske priser

## Viktig å vite

**Prisene har én kilde.** `data/produkter.js` leses av både byggeskriptet og
nettleseren, så prislisten på sidene og utregningen i handlekurven kan ikke
komme i utakt.

**Prismodellen:** 1–4 dagers leie koster det samme. Fra dag 5 legges det til
15 % av grunnprisen per døgn, rundet til nærmeste 5 kr. Produkter med `fast`
i stedet for `d` (sikringspakka) har fastpris uansett periode.

**Aldri slett en regel i `_redirects`.** Den er det som holder på rankingen når
en side har byttet adresse.

**Får du e-post på domenet senere**, må MX-postene inn i Cloudflare – ikke hos
Domeneshop, som ikke lenger styrer DNS.
