# Berg Utleie – drift og publisering

## Slik oppdaterer du siden

```
cd ~/bergutleie
git add -A && git commit -m "hva du endret" && git push
```

Cloudflare bygger og publiserer automatisk. Live på ca. ett minutt.

## Oppsett

- **Repo:** https://github.com/UlrikBerg/bergutleie (public, branch `main`)
- **Hosting:** Cloudflare Pages, bygger fra `main`, rot-mappa
- **Domene:** bergutleie.no – registrert hos Domeneshop, DNS flyttet til Cloudflare
- **Byggkommando:** ingen (rene statiske filer)

## Filer som styrer drift

| Fil | Hva den gjør |
|---|---|
| `_redirects` | Ekte 301-omdirigeringer. Legg inn en linje hver gang en URL endres. |
| `_headers` | Cache og sikkerhetsheadere. |
| `robots.txt` | Slipper søkemotorer inn, peker til sitemap. |
| `sitemap.xml` | Liste over alle sider. **Må oppdateres når nye sider lages.** |
| `404.html` | Vises ved feil adresse. |
| `CNAME` | Rest fra GitHub Pages. Skader ikke, men er ikke i bruk på Cloudflare. |

## Gjenstår (krever innlogging)

- [ ] Cloudflare-konto opprettet
- [ ] Domenet lagt til i Cloudflare
- [ ] Navnetjenere endret hos Domeneshop til Cloudflares
- [ ] Pages-prosjekt koblet til GitHub-repoet
- [ ] bergutleie.no + www lagt til som custom domains
- [ ] «Always Use HTTPS» slått på
- [ ] HSTS slått på (vent til siden er bekreftet stabil på https)
- [ ] Google Search Console: domenet verifisert, sitemap sendt inn
- [ ] Google Business-profil koblet til bergutleie.no

## Viktig å vite

**DNS-flyttingen er trygg.** Domenet har ingen MX- eller TXT-poster, altså ingen
e-post eller verifiseringer som kan knekke. Det eneste som finnes er
webpekerne, og de settes opp på nytt i Cloudflare.

**Får du e-post på domenet senere**, må MX-postene inn i Cloudflare – ikke hos
Domeneshop.

**Aldri slett en regel i `_redirects`.** Den er det som holder på rankingen når
en side har byttet adresse.
