# Vipps på bergutleie.no – steg for steg

Skrevet 17. august 2026.

**Status:** integrasjonen er bygget og verifisert mot testmiljøet.
Produksjonssalgsstedet ble bestilt 17. august, med oppgitt behandlingstid på
én uke – altså svar rundt **24. august 2026**. Nettsidekravene er oppfylt og
publisert. Det som gjenstår er nøklene, én full gjennomkjøring med testappen,
og vilkårsteksten.

**25 % forskudd betales med Vipps i handlekurven, resten faktureres.**
Grunnen til at forskuddet er lavt: Vipps tar gebyr av beløpet som går
gjennom, faktura gjør ikke. Jo mindre gjennom Vipps, jo mindre gebyr.

---

## Utgangspunktet

| | |
|---|---|
| Avtale | Finnes – på **BERG EVENT**, enkeltpersonforetak, org.nr. 919 326 581 |
| Salgssted i dag | «Berg Event» #62439 |
| Produkt i dag | «Vippsnummer Handlekurv» – **kan ikke brukes på nett** |
| Trengs | Betalingsintegrasjon (ePayment) på et nytt salgssted |

Berg Utleie, Berg Event og Teltdeler er tre varemerker under **ett og samme
enkeltpersonforetak**. Derfor trengs ingen ny avtale – bare nye salgssteder
under den som allerede finnes.

### Hvorfor Vippsnummer ikke duger

Vippsnummer er en kasseløsning for salg ansikt til ansikt. Skattemyndighetene
regner det som **kontantsalg, ikke fjernsalg**, og regelverket er et annet.
Det er ikke bare feil verktøy – det er feil regelverk. Produktet som står
«Godkjent» i portalen hjelper oss altså ikke.

---

# FASE 1 – TESTMILJØ (gjør dette nå, tar to minutter)

Testmiljøet krever **ingen godkjenning og ingen ventetid**. Du oppretter
salgsstedet selv, og det finnes med en gang.

```
portal.vipps.no
  → For utviklere
  → API-nøkler
  → Testmiljø
  → «Legg til testsalgssted»
  → navn: Berg Utleie
  → Opprett
  → «Vis nøkler»
```

Du får tre verdier:

```
client_id
client_secret
Ocp-Apim-Subscription-Key      (primær og sekundær – de er likeverdige)
```

Testnøkler kan sendes i klartekst. Det er lekepenger, og de virker ikke mot
ekte konti. **Produksjonsnøkler skal aldri sendes i en chat eller havne i
repoet** – se fase 3.

For å fullføre en betaling i test trengs en Vipps-testbruker. Den opprettes
også under «For utviklere». Vi tar den når integrasjonen står.

---

# FASE 2 – DET SOM BYGGES

Kan bygges ferdig mot testmiljøet mens produksjonssøknaden ligger til
behandling. Ingenting av dette venter på Vipps.

| Fil | Gjør |
|---|---|
| `src/vipps.js` | Henter tilgangstoken, oppretter betaling, sjekker status |
| `src/index.js` | Ruter `/api/betaling` og `/betalt` |
| KV `TELLER` | Lagrer bookingen mot betalingsreferansen |

Flyten:

```
handlekurv → "Reserver med Vipps · 1 500 kr"
    ↓   serveren regner totalen selv (src/pris.js) og lagrer bookingen
Vipps-appen
    ↓   serveren verifiserer status mot Vipps – aldri stol på retur-URL-en
kvittering til kunde + varsel til deg + konvertering til Google Ads
```

Tre regler som ikke kan fravikes:

- **Beløpet regnes på serveren.** Klienten sender hva som er valgt, aldri hva
  det koster. Dette er allerede på plass i `src/pris.js`.
- **Statusen verifiseres serverside.** At kunden kommer tilbake til
  retur-URL-en beviser ingenting – den kan åpnes direkte.
- **Idempotensnøkkel ved opprettelse.** Uten den kan et nettverksforsøk nummer
  to bli et trekk nummer to.

Webhook settes opp som reserve, for kunder som lukker nettleseren etter at de
har betalt men før de kommer tilbake.

---

# FASE 3 – PRODUKSJON (bestilt 17. aug, svar ca. 24. aug)

Bestillingen er inne. Slik ble den fylt ut, i tilfelle den må gjøres om:

| Felt | Svar |
|---|---|
| Produkt | Integrert betaling (2,99 % + 1 kr per transaksjon) |
| Implementeres av | oss selv, egen nettside |
| Faste betalinger | av |
| Salgsstedets navn | Berg Utleie |
| Nettsted | bergutleie.no |
| Salgsvilkår | bergutleie.no/leievilkar/ |
| Konto | 9803 22 90426 |
| Omsetning / andel via Vipps | 2 500 000 kr / 10 % |
| Leie av varer eller tjenester | ja |
| Gavekort | nei |

Salgsstedet vises i appen som «Berg Utleie» med «BERG EVENT» under – det
siste kommer fra foretaket og kan ikke endres. Derfor står foretaksnavnet
også i bunnteksten på nettstedet, så kunden kjenner igjen navnet.

**Ikke gjenbruk salgsstedet «Berg Event».** Kunden ser salgsstedets navn i
Vipps-appen når betalingen bekreftes. Står det «Berg Event» på en booking
gjort på bergutleie.no, ser det ut som en feilbelastning – og det bryter med
at Berg Event ikke skal figurere som avsender på den siden.

Samme øvelse for Teltdeler når den tid kommer: eget salgssted, eget navn.

Når salgsstedet er godkjent:

```
For utviklere → Produksjon → finn salgsstedet → «Vis nøkler»
```

Nøklene settes som secrets, ikke i repoet:

```sh
npx wrangler secret put VIPPS_CLIENT_ID
npx wrangler secret put VIPPS_CLIENT_SECRET
npx wrangler secret put VIPPS_SUBSCRIPTION_KEY
npx wrangler secret put VIPPS_MSN
npx wrangler secret put VIPPS_API              # https://api.vipps.no
```

## Registrer webhooken – ikke hopp over dette

Uten webhook taper du bookinger stille. Godkjenner kunden i appen og så
lukker nettleseren, kommer hen aldri til `/betalt`, og trekket – som ligger i
returflyten – skjer aldri. Pengene står reservert til de faller bort, og
verken du eller kunden får vite det.

Registreringen gjøres én gang per miljø:

```sh
node registrer-webhook.js --list     # se hva som er registrert
node registrer-webhook.js            # registrer (testmiljø, leser .dev.vars)

# produksjon – med nøklene fra portalen:
VIPPS_API=https://api.vipps.no VIPPS_MSN=… VIPPS_CLIENT_ID=… \
VIPPS_CLIENT_SECRET=… VIPPS_SUBSCRIPTION_KEY=… node registrer-webhook.js
```

Under panseret er kallet `POST /webhooks/v1/webhooks` med:

```json
{ "url": "https://bergutleie.no/api/vipps-webhook",
  "events": ["epayments.payment.authorized.v1",
             "epayments.payment.aborted.v1",
             "epayments.payment.expired.v1"] }
```

Svaret inneholder en **hemmelighet som bare vises denne ene gangen**. Den må
lagres med det samme:

```sh
npx wrangler secret put VIPPS_WEBHOOK_SECRET
```

Mister du den, må webhooken slettes og registreres på nytt.

Signaturen kontrolleres i `verifiserWebhook()` i `src/vipps.js`. Uten den
kunne hvem som helst POSTet «betaling godkjent» til nettstedet og fått en
booking registrert uten å ha betalt en krone.

---

# FASE 4 – VILKÅRENE MÅ ENDRES SAMTIDIG

**Ikke før, ikke etter.** Sier vilkårene at man betaler i kassa før kassen
finnes, er vi verre stilt enn i dag.

Tre punkter i `/leievilkar/` beskriver dagens flyt og blir feil:

1. «Den faktureres når avtalen er bekreftet» – med Vipps trekkes forskuddet
   med en gang, i handlekurven.
2. «Avbestiller du før avtalen er bekreftet og forskuddet fakturert, koster
   det ingenting» – når betalingen *er* bekreftelsen, finnes ikke det vinduet.
3. Avtalen blir bindende ved betaling, ikke ved skriftlig bekreftelse.

Forespørselsflyten må bestå ved siden av, av én grunn: **leveringer utenfor
de faste fraktsonene har ingen pris ennå.** `src/pris.js` merker dem
`tilbudspris`, og de kan ikke betales på nett. De skal fortsatt gå som
forespørsel med manuelt tilbud.

Vipps har egne krav til utleie: leievilkårene må oppgi frister for endring,
flytting og avbestilling. Det står allerede i `/leievilkar/`.

---

# TING SOM ER LETT Å GJØRE FEIL

- **Ikke bruk Vippsnummer til nettbetaling.** Feil regelverk, ikke bare feil
  verktøy.
- **Ikke send produksjonsnøkler i chat.** De hører hjemme i
  `wrangler secret put`, ingen andre steder.
- **Ikke stol på at kunden kom tilbake.** Retur-URL-en er ingen kvittering.
- **Ikke la klienten oppgi beløpet.** Da kan et 5×10-telt reserveres for én
  krone.
- **Ikke sett vilkårene live før betalingen virker.**
- **Ikke gjenbruk salgsstedet på tvers av merkene.** Navnet vises i appen.

---

# NETTSIDEKRAVENE (oppfylt 17. aug 2026)

Vipps sjekker siden manuelt før godkjenning. Alle fem må stå godt synlig:

| Krav | Hvor |
|---|---|
| Organisasjonens navn | Bunntekst: «Et varemerke av Berg Event» |
| Organisasjonsnummer | Bunntekst: 919 326 581 |
| Adresse | Bunntekst: Sørliveien 78, 1788 Halden |
| Telefonnummer | Bunntekst: 412 41 285 |
| E-postadresse | Bunntekst: post@bergutleie.no |

Merk at **forretningsadressen i Brønnøysund er Sørlifjellet 7B**, mens siden
oppgir lageret i Sørliveien 78. Det er greit – men vær forberedt på
spørsmålet hvis Vipps krysspeiler mot registeret.
