# Berg Utleie – Google Ads, steg for steg

Skrevet 16. august 2026. Målingen er bygget og live; ID-ene mangler.

**Rekkefølgen er ikke tilfeldig.** Berg Event brukte 825 000 kr på to år
med en måling som ikke målte bookinger. Her settes målingen opp *før*
den første kronen brukes.

---

# FASE 1 – MÅLING (gjør dette først)

## Steg 1: Egen GA4-eiendom

**analytics.google.com → Administrator → Opprett → Eiendom**

- Navn: `Berg Utleie`
- Tidssone: Norge, valuta NOK
- Datastrøm: **Nett** → `https://bergutleie.no` → strømnavn `bergutleie.no`

**Lag en ny eiendom, ikke en datastrøm i Berg Event-eiendommen.** To
virksomheter i samme eiendom blander trafikken, og du får aldri rene tall
for noen av dem.

Noter mål-ID-en, formen `G-XXXXXXXXXX`.

## Steg 2: Konverteringshandling i Google Ads

**ads.google.com → Mål → Konverteringer → + Ny konverteringshandling
→ Nettsted**

- Nettadresse: `bergutleie.no`
- Velg **Legg til manuelt** hvis den ber om å skanne siden
- Kategori: **Skjema for potensielle salg sendt inn**
- Navn: `Berg Utleie – forespørsel`
- Verdi: **Bruk ulike verdier for hver konvertering** (siden vi sender
  totalsummen med)
- Telling: **Én** (ikke «Alle») – én forespørsel per kunde, ikke per klikk

Velg **Google-tag** som oppsettmetode. Da får du opp to verdier:

```
send_to: 'AW-123456789/AbC-D_efGhIjK'
          └── ADS_ID ──┘ └─ ADS_LABEL ─┘
```

Noter begge.

## Steg 3: Send meg de tre ID-ene

`G-…`, `AW-…` og etiketten. Jeg legger dem i `data/maling.js` og deployer.

Da skjer dette automatisk:

- Samtykkebanner vises (påkrevd i Norge for sporingskapsler)
- Alt står avslått til kunden trykker Godta – Google Consent Mode gjør at
  konverteringer modelleres likevel for dem som takker nei
- `gclid` fra annonseklikk lagres i 90 dager og følger med forespørselen
- Konverteringen telles når skjemaet faktisk er sendt, med totalsummen
  som verdi

## Steg 4: Test at det virker

Åpne `https://bergutleie.no/?gclid=TEST123`, godta samtykke, og send en
forespørsel. Sjekk at:

- **Klikk-ID-en står nederst i varslings-e-posten** («Fra Google-annonse»)
- Konverteringen dukker opp i Ads innen et døgn

Kommer ikke klikk-ID-en frem i e-posten, si fra – da er koblingen brutt,
og hele fase 4 faller bort.

---

# FASE 2 – SKILL FRA BERG EVENT

Begge kampanjene ligger i samme konto. **Google viser bare én annonse per
annonsør i samme auksjon**, så uten et skarpt skille slår de hverandre ut.

Skillet ligger allerede i forretningen:

| | Berg Event | Berg Utleie |
|---|---|---|
| Tilbud | nøkkelferdig, montering, full service | selvbetjent, hent selv |
| Kunde | vil ha det gjort for seg | vil gjøre det selv, billigere |
| Søk | «bryllupstelt», «med montering» | «billig», «hent selv», «pris» |

## Ekskluder i Berg Event-kampanjene

Legg til i den delte lista `Utleie – ikke relevant`, eller lag en ny:

```
billig
billigst
rimelig
hent selv
hente selv
låne
leie selv
selvbetjent
```

## Ekskluder i Berg Utleie-kampanjen

```
montering
montert
opprigg
nedrigg
nøkkelferdig
toalettvogn
scene
dansegulv
konferanse
festival
```

De to listene peker mot hverandre med vilje: det som er kjernen i det ene
tilbudet, er støy i det andre.

---

# FASE 3 – KAMPANJEN

**Ikke start før fase 1 er ferdig og testet.**

## Timing

Det er august – teltsesongen ebber ut. To muligheter:

- **Test i september**, 100–150 kr/dag. Formålet er ikke salg, men å finne
  ut hvilke søkeord som konverterer mens klikkene er billige.
- **Vent til mars**, og start med et halvår med Search Console-data i
  ryggen.

Anbefaling: kjør septembertesten. Lærdommen er billig nå, og du får
avklart om etterspørselen finnes før du satser i høysesong.

## Oppsett

- Kampanjetype: **Søk**, ingen Display, ingen søkepartnere
- Steder: Østfold, Oslo, Akershus. **Stedsalternativer → «Tilstedeværelse»**
  (ikke standardvalget «eller interesse» – det var lekkasjen i Berg Event)
- Språk: Norsk og Engelsk
- Budstrategi: **Maksimer antall klikk** med CPC-tak 12 kr til å begynne
  med. Bytt til konverteringer når du har ~30 forespørsler i måneden.
- Budsjett: 100–150 kr/dag

## Annonsegruppe 1 – Billig og pris

Landingsside: `https://bergutleie.no/`

```
[leie partytelt billig]
[billig partytelt]
[billig teltutleie]
[partytelt pris]
[leie telt pris]
[hva koster det å leie partytelt]
"billig partytelt"
"partytelt pris"
"rimelig teltutleie"
"leie telt billig"
"billig festutstyr"
```

Overskrifter (maks 30 tegn):

```
Leie partytelt billig
Faste priser på nett
Se prisen med en gang
Partytelt fra 1900 kr
Ingen skjulte kostnader
Hent selv og spar penger
Alt til festen på ett sted
Bestill på nett
Telt, bord og stoler
2000+ utleier i Berg-familien
Se pris og ledige datoer
Hent i Halden ved E6
Vi leverer også
Uforpliktende forespørsel
Priser rett på nettsiden
```

## Annonsegruppe 2 – Hent selv

Landingsside: `https://bergutleie.no/`

```
[hente telt selv]
[leie telt selv]
[hente partytelt selv]
[hent selv utleie]
"hente selv"
"leie selv"
"hent i halden"
```

Overskrifter:

```
Hent selv i Halden
Gratis henting på lageret
Hent selv og spar frakt
Rett ved E6 i Halden
Åpent man-fre 09-18
Søndag 12-15
Faste priser på nett
Telt, bord, stoler og duker
Se pris med en gang
Bestill på nett
Ingen skjulte kostnader
Alt til festen
Uforpliktende forespørsel
Leie festutstyr selv
Sørliveien 78, Halden
```

## Annonsegruppe 3 – Lokalt

Landingsside: `https://bergutleie.no/`

```
[leie festutstyr halden]
[utleie halden]
[partytelt halden]
[leie telt halden]
[leie bord og stoler halden]
[partytelt sarpsborg]
[partytelt fredrikstad]
"utleie halden"
"festutstyr halden"
"partytelt østfold"
```

---

# FASE 4 – DET SOM SKILLER SEG UT

Dette er grepet Berg Event mangler, og det er verdt mest på sikt.

Når en booking faktisk er betalt, kan du sende **den reelle ordreverdien**
tilbake til Google. Da lærer den ikke bare hvilke søk som gir
forespørsler, men hvilke som gir *lønnsomme* kunder – og byr deretter.

Alt som trengs er allerede bygget: klikk-ID-en følger med forespørselen og
står i varslings-e-posten.

Slik gjør du det, en gang i måneden:

1. **Ads → Mål → Opplastinger → + → Konverteringer**
2. Last opp en CSV med kolonnene:

```
Google Click ID, Conversion Name, Conversion Time, Conversion Value, Conversion Currency
```

3. `Conversion Name` skal være navnet på konverteringshandlingen fra steg 2

Ta det opp igjen når du har 20–30 bookinger med klikk-ID. Før det er
datagrunnlaget for tynt til at Google lærer noe av det.

---

# TING SOM ER LETT Å GJØRE FEIL

- **Ikke øk budsjettet før du vet kostnad per forespørsel.** Det var
  feilen som gjorde Berg Event dyr.
- **Ikke bruk fleksibelt samsvar** før konverteringene er reelle. I Berg
  Event sto det for 52,5 % av forbruket og ga «garasje telt» og
  «partytelt biltema».
- **Ikke la stedsalternativet stå på standard.** «Tilstedeværelse eller
  interesse» viser annonsen til folk over hele landet som søker om ditt
  område.
- **Ikke lov priser i annonsen som ikke står på siden.** Her stemmer det –
  bergutleie.no viser faktiske priser, i motsetning til bergevent.no. Det
  er en av de sterkeste forskjellene, og verdt å bruke i teksten.
