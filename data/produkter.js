/* ===========================================================================
   Berg Utleie – all produktdata og prislogikk.

   DETTE ER ENESTE STED PRISER SKAL ENDRES.
   Både byggeskriptet (bygg.mjs) og nettleseren leser fra denne fila,
   så en endring her slår gjennom på alle sider ved neste `npm run bygg`.

   Feltforklaring per produkt:
     id      intern nøkkel (brukes i handlekurv og pakker)
     slug    URL-en produktet får: /utstyr/<slug>/
     cat     kategori – styrer gruppering i katalogen
     navn    produktnavn slik det vises
     desc    kort undertekst i lister
     dl      lang beskrivelse på produktsiden
     d       døgnpris i kroner
     fast    fastpris som ikke påvirkes av leieperiode (brukes i stedet for d)
     lp      lasteplass – styrer om leveransen krever lastebil
     areal   teltets gulvflate i kvm (kun telt)
     capL    kapasitet med langbord (kun telt)
     capR    kapasitet med runde bord (kun telt)

   MERK om kapasitetstallene: de er lavere enn tallene Berg Event oppgir,
   og det er med vilje.
     5x6 m  – vi sier 30 fordi pakken bruker hestesko-oppsett. Dropper man
              hesteskoen får seks avlange bord plass som to langbord, og da
              er kapasiteten 36.
     5x8 m  – 48 er tallet uten de to ekstra stolene på den ene kortsiden.
              Pakken oppgir 50 for at selskapspakkene skal gå opp i 10-gangen.
   Ikke «rett» disse mot bergevent.no uten å sjekke med Ulrik først.
     bilder  galleri; første bilde er hovedbildet
     fit     'contain' når bildet er en tegning som ikke skal beskjæres
     specs   punktliste med spesifikasjoner
     rec     anbefalt tilbehør: [produkt-id, antall]
   ======================================================================== */

export const PRODUKTER = [
  {
    id: "t33", slug: "popup-telt-3x3m", cat: "Partytelt",
    navn: "Pop-up-telt 3×3 m", desc: "Quick up · serverings- og mattelt",
    dl: "Værbestandig pop-up-telt som rigges opp og ned på minutter – ingen verktøy og ingen stangkabal. Perfekt som serverings- eller mattelt ved siden av festteltet, eller som ly for grillen. Får plass i stort sett alle hager.",
    d: 500, lp: 2, areal: 9,
    bilder: [
      { u: "/uploads/telt-3x3-tegning.png", fit: "contain", alt: "Tegning av pop-up-telt 3x3 meter" },
      { u: "/uploads/telt-3x3-b.png", fit: "contain", alt: "Pop-up-telt 3x3 m" },
      { u: "/uploads/telt-3x3-c.png", fit: "contain", alt: "Pop-up-telt rigget opp" }
    ],
    specs: ["Mål: 3×3 m (9 kvm) · høyde 2,9 m", "Pop-up – rigges opp på minutter uten verktøy", "Vekt: 14 kg", "Vegger og tak i værbestandig polyeten"],
    rec: [["sikring", 1]]
  },
  {
    id: "t36", slug: "partytelt-3x6m", cat: "Partytelt",
    navn: "Partytelt 3×6 m", desc: "18 personer med langbord",
    dl: "Et værbestandig telt med vegger og tak av polyeten. Dette teltet beskytter deg mot både stekende sol og grusom vind og regnvær. Veggene på langsidene har sprosser som gir teltet en stilig og luksuriøs stil.",
    d: 1900, lp: 8, areal: 18, capL: 18,
    bilder: [
      { u: "/uploads/telt-3x6-tegning.png", fit: "contain", alt: "Tegning av partytelt 3x6 meter" },
      { u: "/uploads/telt-3x6-a.webp", alt: "Partytelt 3x6 m satt opp i hage" },
      { u: "/uploads/telt-3x6-c.jpg", alt: "Partytelt 3x6 m med bordoppsett" },
      { u: "/uploads/telt-3x6-b.jpg", alt: "Partytelt 3x6 m dekket til fest" },
      { u: "/uploads/barnebursdag.webp", alt: "Partytelt dekorert til barnebursdag" }
    ],
    specs: ["Mål: 3×6 m (18 kvm)", "18 personer med langbord", "Sidehøyde 2,0 m · avtakbare vegger", "Må forankres med sikringsutstyr"],
    rec: [["gulv", 9], ["kbord", 3], ["duk", 3], ["stol", 18], ["lys", 1], ["sikring", 1]]
  },
  {
    id: "t38", slug: "partytelt-3x8m", cat: "Partytelt",
    navn: "Partytelt 3×8 m", desc: "24 personer med langbord",
    dl: "Et værbestandig telt med vegger og tak av polyeten. Dette teltet beskytter deg mot både stekende sol og grusom vind og regnvær. Veggene på langsidene har sprosser som gir teltet en stilig og luksuriøs stil.",
    d: 2400, lp: 10, areal: 24, capL: 24,
    bilder: [
      { u: "/uploads/telt-3x8-tegning.png", fit: "contain", alt: "Tegning av partytelt 3x8 meter" },
      { u: "/uploads/telt-3x8-a.jpg", alt: "Partytelt 3x8 m satt opp" },
      { u: "/uploads/telt-oppsett-ute.webp", alt: "Partytelt rigget opp utendørs" },
      { u: "/uploads/drobak-sjoutsikt.webp", alt: "Partytelt med sjøutsikt i Drøbak" },
      { u: "/uploads/bord-pyntet.jpg", alt: "Pyntet langbord i partytelt" }
    ],
    specs: ["Mål: 3×8 m (24 kvm) · høyde 2,8 m", "24 personer med langbord", "Vekt 75 kg · værbestandig duk med sprosser", "Åpning på begge sider · må forankres"],
    rec: [["gulv", 12], ["kbord", 4], ["duk", 4], ["stol", 24], ["lys", 1], ["sikring", 1]]
  },
  {
    id: "t56", slug: "partytelt-5x6m", cat: "Partytelt",
    navn: "Partytelt 5×6 m", desc: "36 med langbord · 24 med runde bord",
    dl: "Bredt og kompakt telt med god plass rundt bordene. Fint til konfirmasjon, jubileer og selskap i hagen.",
    d: 3400, lp: 12, areal: 30, capL: 36, capR: 24,
    bilder: [
      { u: "/uploads/telt-5x6-tegning.png", fit: "contain", alt: "Tegning av partytelt 5x6 meter" },
      { u: "/uploads/telt-5x6-36pers.png", fit: "contain", alt: "Oppsett med langbord til 36 personer" },
      { u: "/uploads/telt-5x6-24pers.png", fit: "contain", alt: "Oppsett med runde bord til 24 personer" },
      { u: "/uploads/telt-5x6-fest.jpg", alt: "Partytelt 5x6 m dekket til selskap" },
      { u: "/uploads/hageselskap.webp", alt: "Hageselskap i partytelt" }
    ],
    specs: ["Mål: 5×6 m (30 kvm)", "36 personer med langbord · 24 med runde bord", "Sidehøyde 2,0 m · avtakbare vegger", "Må forankres med sikringsutstyr"],
    rec: [["gulv", 15], ["kbord", 5], ["duk", 5], ["stol", 30], ["lys", 1], ["sikring", 1]]
  },
  {
    id: "t58", slug: "partytelt-5x8m", cat: "Partytelt",
    navn: "Partytelt 5×8 m", desc: "48 med langbord · 32 med runde bord",
    dl: "Romslig telt med plass til både bordoppsett og dansegulv. Passer bryllup og større familieselskap.",
    d: 3900, lp: 16, areal: 40, capL: 48, capR: 32,
    bilder: [
      { u: "/uploads/telt-5x8-tegning.png", fit: "contain", alt: "Tegning av partytelt 5x8 meter" },
      { u: "/uploads/telt-5x8-48pers.png", fit: "contain", alt: "Oppsett med langbord til 48 personer" },
      { u: "/uploads/telt-5x8-32pers.png", fit: "contain", alt: "Oppsett med runde bord til 32 personer" },
      { u: "/uploads/telt-pyntet-inngang.webp", alt: "Pyntet inngang til partytelt" },
      { u: "/uploads/5x8m-pyntet.jpg", alt: "Partytelt 5x8 m pyntet til fest" },
      { u: "/uploads/bryllup-dekorert.webp", alt: "Partytelt dekorert til bryllup" }
    ],
    specs: ["Mål: 5×8 m (40 kvm)", "48 personer med langbord · 32 med runde bord", "Sidehøyde 2,0 m · avtakbare vegger", "Må forankres med sikringsutstyr"],
    rec: [["gulv", 20], ["kbord", 8], ["duk", 8], ["stol", 50], ["lys", 1], ["sikring", 1], ["jbl", 1]]
  },
  {
    id: "t510", slug: "partytelt-5x10m", cat: "Partytelt",
    navn: "Partytelt 5×10 m", desc: "60 med langbord · 40 med runde bord",
    dl: "Vårt største telt – god plass til middag, buffet og dansegulv for store markeringer.",
    d: 4400, lp: 20, areal: 50, capL: 60, capR: 40,
    bilder: [
      { u: "/uploads/telt-5x10-tegning.png", fit: "contain", alt: "Tegning av partytelt 5x10 meter" },
      { u: "/uploads/telt-5x10-60pers.png", fit: "contain", alt: "Oppsett med langbord til 60 personer" },
      { u: "/uploads/telt-5x10-40pers.png", fit: "contain", alt: "Oppsett med runde bord til 40 personer" },
      { u: "/uploads/telt-5x10-fest.jpg", alt: "Stort partytelt dekket til selskap" },
      { u: "/uploads/stort-arrangement.webp", alt: "Stort partytelt til arrangement" },
      { u: "/uploads/bryllup-romantisk.webp", alt: "Romantisk bryllupsdekor i stort partytelt" }
    ],
    specs: ["Mål: 5×10 m (50 kvm)", "60 personer med langbord · 40 med runde bord", "Sidehøyde 2,0 m · avtakbare vegger", "Må forankres med sikringsutstyr"],
    rec: [["gulv", 25], ["kbord", 10], ["duk", 10], ["stol", 60], ["lys", 2], ["sikring", 1], ["jbl", 1]]
  },
  {
    id: "gulv", slug: "gulvmodul", cat: "Gulv og lining",
    navn: "Gulvmodul 2×1 m (pris per kvm)", desc: "Impregnert terrassebord · 2 kvm per modul",
    dl: "Gulvmoduler av impregnert terrassebord gir selskapet et elegant løft – en jevn og solid base som beskytter mot bløtt underlag. Passer alle teltstørrelser.",
    d: 140, lp: 1.2,
    bilder: [
      { u: "/uploads/tregulv-montering.webp", alt: "Montering av tregulv i partytelt" },
      { u: "/uploads/nesparken-moss.webp", alt: "Partytelt med tregulv i Nesparken" },
      { u: "/uploads/carlberg-gard.webp", alt: "Partytelt med gulv på Carlberg gård" },
      { u: "/uploads/tregulv-detaljer.webp", alt: "Detaljer av elegant tregulv" },
      { u: "/uploads/stort-arrangement.webp", alt: "Stort telt med tregulv" }
    ],
    specs: ["Modul: 2×1 m · høyde 5,6 cm", "Vekt: 53 kg per modul", "Krever rett og flatt underlag"],
    rec: []
  },
  {
    id: "lining", slug: "lining-i-tak", cat: "Gulv og lining",
    navn: "Lining i tak (pris per kvm)", desc: "Hvit drapering, per teltmodul",
    dl: "Hvit himling som skjuler teltets rammer og gir rommet et mykt, festkledd uttrykk.",
    d: 100, lp: 1,
    bilder: [
      { u: "/uploads/bryllup-gulv-lining.webp", alt: "Hvit lining i taket på partytelt" },
      { u: "/uploads/bryllup-dekorert.webp", alt: "Partytelt med lining dekorert til bryllup" }
    ],
    specs: ["Hvit drapering i hele taket", "Prises per kvm", "Monteres enkelt med strikk"],
    rec: [["lys", 1]]
  },
  {
    id: "kbord", slug: "langbord", cat: "Bord og stoler",
    navn: "Avlangt bord 180×75 cm", desc: "6–8 personer per bord",
    dl: "Klassisk klappbord i solid utførelse. Rett høyde for middag, buffet eller gavebord.",
    d: 140, lp: 1,
    bilder: [
      { u: "/uploads/avlangt-bord.png", fit: "contain", alt: "Avlangt bord 180x75 cm til leie" },
      { u: "/uploads/bord-pyntet.jpg", alt: "Pyntet langbord i partytelt" },
      { u: "/uploads/bord-event.jpg", alt: "Avlange bord satt opp til arrangement" },
      { u: "/uploads/duk-avlangt-b.jpg", alt: "Avlangt bord dekket med hvit duk" }
    ],
    specs: ["Mål: 180×75 cm · høyde 74 cm", "6 personer med god plass, maks 8", "Klappes flatt – enkel transport"],
    rec: [["duk", 1], ["stol", 6]]
  },
  {
    id: "rbord", slug: "rundt-bord", cat: "Bord og stoler",
    navn: "Rundt bord Ø150 cm", desc: "8 personer per bord",
    dl: "Runde bord skaper god samtale rundt middagen. Klassisk valg til bryllup og finere selskap.",
    d: 180, lp: 1.5,
    bilder: [
      { u: "/uploads/rundt-bord.png", fit: "contain", alt: "Rundt bord Ø150 cm til leie" },
      { u: "/uploads/rundt-bord-dekket.jpg", alt: "Rundt bord dekket til selskap" },
      { u: "/uploads/rundt-bord-fest.jpg", alt: "Runde bord i partytelt" },
      { u: "/uploads/bryllup-gulv-lining.webp", alt: "Runde bord i partytelt med lining" }
    ],
    specs: ["Diameter: 150 cm · høyde 74 cm", "8 personer per bord", "Klappbart understell"],
    rec: [["rundduk", 1], ["stol", 8]]
  },
  {
    id: "stol", slug: "klappstol", cat: "Bord og stoler",
    navn: "Hvit klappstol", desc: "Med polstret sete",
    dl: "Hvit klappstol med polstret sete. Pen nok til bryllup, robust nok til hagefest.",
    d: 25, lp: 0.25,
    bilder: [
      { u: "/uploads/klappstol.png", fit: "contain", alt: "Hvit klappstol til leie" },
      { u: "/uploads/klappstol-produkt.jpg", alt: "Hvit klappstol med polstret sete" },
      { u: "/uploads/klappstol-bryllup.jpg", alt: "Hvite klappstoler dekket til bryllup" },
      { u: "/uploads/klappstol-fest.jpg", alt: "Hvite klappstoler rundt festbord" },
      { u: "/uploads/klappstol-dekket-bord.webp", alt: "Dekket bord med hvite klappstoler" }
    ],
    specs: ["Hvit med polstret sete", "Tåler utendørs bruk", "Stables enkelt"],
    rec: []
  },
  {
    id: "stabord", slug: "stabord", cat: "Bord og stoler",
    navn: "Ståbord", desc: "Diameter 80 cm · høyde 110 cm",
    dl: "Fleksibelt ståbord som passer like godt til mingling i bryllup som til konferanser, messer og firmafester. Med stretchduk i hvit eller sort får bordet et sofistikert preg – dukene leies separat.",
    d: 170, lp: 0.5,
    bilder: [
      { u: "/uploads/stabord.png", alt: "Ståbord til leie" },
      { u: "/uploads/stabord-duk-hvit.png", alt: "Ståbord med hvit stretchduk" },
      { u: "/uploads/stabord-duk-sort.png", alt: "Ståbord med sort stretchduk" }
    ],
    specs: ["Diameter: 80 cm · høyde 110 cm", "Vekt: 9,3 kg", "Fungerer både innendørs og utendørs", "Stretchduk i hvit eller sort leies separat"],
    rec: [["staduk-hvit", 1]]
  },
  {
    id: "trebord", slug: "trebord", cat: "Bord og stoler",
    navn: "Trebord", desc: "197 × 60 cm · del av benkesett",
    dl: "Klassisk trebord fra benkesettet vårt – ideelt til hagefester, firmafester og sit-down-selskap der du vil ha plass til mange gjester. Bordplaten er i tre og bena i stål, og bordet klappes enkelt sammen når dansegulvet skal fram.",
    d: 180, lp: 1,
    bilder: [
      { u: "/uploads/trebord.png", fit: "contain", alt: "Trebord til leie" },
      { u: "/uploads/benkesett.webp", alt: "Benkesett med trebord og trebenker" },
      { u: "/uploads/trebenk-b.webp", alt: "Trebenk til benkesett" }
    ],
    specs: ["Lengde: 197 cm · bredde 60 cm", "Vekt: 16 kg", "Treplate med ben i stål", "Klappes sammen for enkel transport"],
    rec: [["trebenk", 2]]
  },
  {
    id: "trebenk", slug: "trebenk", cat: "Bord og stoler",
    navn: "Trebenk", desc: "197 cm · plass til 3 voksne + 1 barn",
    dl: "Trebenk som hører til benkesettet. Én benk gir plass til opptil tre voksne og ett barn, så to benker dekker ett trebord. Treplate med ben i stål, og klappes sammen når den ikke er i bruk.",
    d: 120, lp: 0.6,
    bilder: [
      { u: "/uploads/trebenk.png", fit: "contain", alt: "Trebenk til leie" },
      { u: "/uploads/benkesett.webp", alt: "Benkesett med trebord og trebenker" },
      { u: "/uploads/trebord.png", fit: "contain", alt: "Trebord som hører til benken" }
    ],
    specs: ["Lengde: 197 cm", "Plass til 3 voksne + 1 barn", "Vekt: 8 kg", "Treplate med ben i stål"],
    rec: [["trebord", 1]]
  },
  {
    id: "duk", slug: "duk", cat: "Duker",
    navn: "Duk til avlangt bord", desc: "Passer langbord og rundbord",
    dl: "Hvit bomullsduk, nyvasket og strøket. Løfter bordet fra piknik til selskap.",
    d: 120, lp: 0.05,
    bilder: [
      { u: "/uploads/duk-avlangt.webp", fit: "contain", alt: "Hvit duk til avlangt bord" },
      { u: "/uploads/duk-avlangt-b.jpg", alt: "Avlangt bord dekket med hvit duk" },
      { u: "/uploads/duk-avlangt-c.jpg", alt: "Langbord med hvite duker" },
      { u: "/uploads/bord-pyntet.jpg", alt: "Pyntet langbord i partytelt" },
      { u: "/uploads/duk-avlangt-kveld.webp", alt: "Dekket langbord i partytelt om kvelden" }
    ],
    specs: ["Hvit bomull, strøket", "Passer avlangt bord 180x75 cm", "Leveres rene – returneres brukte"],
    rec: []
  },
  {
    id: "rundduk", slug: "duk-til-rundt-bord", cat: "Duker",
    navn: "Duk til rundt bord", desc: "Diameter 200 cm · vevet mønster",
    dl: "Elegant festduk med vevet mønster som gir et sofistikert uttrykk til bordet. Tidløs design som passer alle typer anledninger – fra bryllup til firmafest.",
    d: 200, lp: 0.05,
    bilder: [
      { u: "/uploads/duk-rundt-bord.png", fit: "contain", alt: "Duk til rundt bord" },
      { u: "/uploads/duk-rundt-bord-b.png", alt: "Rundt bord med festduk" },
      { u: "/uploads/duk-rundt-bord-c.jpg", alt: "Dekket rundbord med duk" },
      { u: "/uploads/duk-rundt-bord-d.jpg", alt: "Runde bord med duker i telt" }
    ],
    specs: ["Diameter: 200 cm", "Passer runde bord opptil 170 cm i diameter", "60 % polyester, 40 % bomull", "Vekt: 0,9 kg · rens er inkludert"],
    rec: []
  },
  {
    id: "staduk-hvit", slug: "hvit-duk-til-stabord", cat: "Duker",
    navn: "Hvit duk til ståbord", desc: "Stretchtrekk til ståbord",
    dl: "Fleksibelt stretch-bordtrekk som er lett å trekke over ståbordet og gir det et elegant preg. Ideelt til mingling – og fungerer like godt ute som inne.",
    d: 120, lp: 0.05,
    bilder: [
      { u: "/uploads/stabord-duk-hvit.png", alt: "Hvit stretchduk til ståbord" },
      { u: "/uploads/stabord.png", alt: "Ståbord" }
    ],
    specs: ["Type: stretch", "Passer bord med diameter 80 cm", "Vekt: 0,5 kg", "Prisen inkluderer rens"],
    rec: [["stabord", 1]]
  },
  {
    id: "staduk-sort", slug: "sort-duk-til-stabord", cat: "Duker",
    navn: "Sort duk til ståbord", desc: "Stretchtrekk til ståbord",
    dl: "Fleksibelt stretch-bordtrekk i sort som er lett å trekke over ståbordet og gir det et elegant preg. Ideelt til mingling – og fungerer like godt ute som inne.",
    d: 120, lp: 0.05,
    bilder: [
      { u: "/uploads/stabord-duk-sort.png", alt: "Sort stretchduk til ståbord" },
      { u: "/uploads/stabord.png", alt: "Ståbord" }
    ],
    specs: ["Type: stretch", "Passer bord med diameter 80 cm", "Vekt: 0,5 kg", "Prisen inkluderer rens"],
    rec: [["stabord", 1]]
  },
  {
    id: "jbl", slug: "jbl-partybox-310", cat: "Lyd og lys",
    navn: "JBL PartyBox 310", desc: "Kraftig partyhøyttaler med lysshow",
    dl: "Partyhøyttaler med kraftig lyd, innebygd lysshow og batteri til hele kvelden. Koble til mobilen via Bluetooth – klar for tale og dansegulv.",
    d: 590, lp: 2,
    bilder: [
      { u: "/uploads/jbl-partybox-310.jpg", fit: "contain", alt: "JBL PartyBox 310 partyhøyttaler med lysshow" },
      { u: "/uploads/jbl-partybox-310-miljo.jpg", alt: "JBL PartyBox 310 i bruk på utefest" }
    ],
    specs: ["Kraftig lyd med innebygd lysshow", "Batteri i inntil 18 timer", "Bluetooth og mikrofoninngang", "Hjul og håndtak – enkel å flytte"],
    rec: []
  },
  {
    id: "lys", slug: "lysslynge", cat: "Lyd og lys",
    navn: "Lysslynge 4,5 m", desc: "Henger i midten av telttaket",
    dl: "Varmhvite pærer på slynge som henger langs mønet i telttaket. Slyngene kan skjøtes sammen for lengre telt – skjøteledning og transformator følger med, og du trenger bare én uansett hvor mange slynger du skjøter.",
    d: 129, lp: 0.2,
    bilder: [
      { u: "/uploads/lysslynge.jpg", fit: "contain", alt: "Lysslynge med varmhvite pærer" }
    ],
    specs: ["Lengde: 4,5 m · kan skjøtes sammen", "Henger i midten av telttaket", "1 slynge til telt på 6–8 m · 2 slynger fra 10 m", "Skjøteledning og transformator følger med – én holder"],
    rec: []
  },
  {
    id: "sikring", slug: "sikringspakke", cat: "Sikringsutstyr",
    navn: "Sikringspakke telt", desc: "4 jekkestropper, 4 hanketau og 4 jordanker",
    dl: "Alt du trenger for å forankre teltet trygt: 4 jekkestropper, 4 hanketau og 4 jordanker. Fastpris uansett leieperiode – én pakke per telt.",
    fast: 400, lp: 1,
    bilder: [
      { u: "/uploads/sikringspakke.jpg", alt: "Sikringspakke med 4 hanketau, 4 jekkestropper og 4 jordanker" }
    ],
    specs: ["Inkluderer alltid: 4 jekkestropper · 4 hanketau · 4 jordanker", "Fastpris – uavhengig av antall dager", "Én pakke sikrer ett telt", "Påkrevd for trygg oppføring"],
    rec: []
  }
];

/* Ferdige selskapspakker. `lang` = avlange bord, `rund` = runde bord.
   deler: [produkt-id, antall]

   Gjestetallet (n) er satt for å gå opp i 10-gangen, og forutsetter
   hestesko-oppsett der pakken bruker det. Se merknaden om kapasitet
   lenger opp – tallene her og capL/capR på teltene måler ikke det samme. */
export const PAKKER = [
  { n: 20,
    lang: { telt: 't38', deler: [['t38', 1], ['sikring', 1], ['kbord', 4], ['duk', 4], ['stol', 24], ['lys', 1], ['jbl', 1]] },
    rund: { telt: 't56', deler: [['t56', 1], ['sikring', 1], ['rbord', 3], ['rundduk', 3], ['stol', 24], ['lys', 1], ['jbl', 1]] } },
  { n: 30,
    lang: { telt: 't56', deler: [['t56', 1], ['sikring', 1], ['kbord', 6], ['duk', 6], ['stol', 30], ['lys', 1], ['jbl', 1]] },
    rund: { telt: 't58', deler: [['t58', 1], ['sikring', 1], ['rbord', 4], ['rundduk', 4], ['stol', 32], ['lys', 1], ['jbl', 1]] } },
  { n: 40,
    lang: { telt: 't58', deler: [['t58', 1], ['sikring', 1], ['kbord', 8], ['duk', 8], ['stol', 40], ['lys', 1], ['jbl', 1]] },
    rund: { telt: 't510', deler: [['t510', 1], ['sikring', 1], ['rbord', 5], ['rundduk', 5], ['stol', 40], ['lys', 2], ['jbl', 1]] } },
  { n: 50,
    lang: { telt: 't58', deler: [['t58', 1], ['sikring', 1], ['kbord', 8], ['duk', 8], ['stol', 50], ['lys', 1], ['jbl', 1]] } },
  { n: 60,
    lang: { telt: 't510', deler: [['t510', 1], ['sikring', 1], ['kbord', 10], ['duk', 10], ['stol', 60], ['lys', 2], ['jbl', 1]] } }
];

/* Steder vi kjenner kjøreavstand til. Brukes til å slå opp fraktsone
   ut fra hva kunden skriver i adressefeltet. */
export const STEDER = [
  { navn: 'Halden', km: 5 }, { navn: 'Svinesund', km: 12 }, { navn: 'Aremark', km: 22 },
  { navn: 'Sarpsborg', km: 30 }, { navn: 'Rakkestad', km: 38 }, { navn: 'Fredrikstad', km: 40 },
  { navn: 'Ørje', km: 42 }, { navn: 'Mysen', km: 48 }, { navn: 'Råde', km: 50 },
  { navn: 'Askim', km: 55 }, { navn: 'Moss', km: 62 }, { navn: 'Son', km: 72 },
  { navn: 'Vestby', km: 78 }, { navn: 'Ås', km: 90 }, { navn: 'Ski', km: 98 },
  { navn: 'Oslo', km: 115 }, { navn: 'Lillestrøm', km: 125 }, { navn: 'Sandvika', km: 135 },
  { navn: 'Asker', km: 142 }, { navn: 'Drammen', km: 155 }
];

export const SONER = [
  { maksKm: 25, pris: 790, navn: 'Sone 1 (0–25 km)' },
  { maksKm: 50, pris: 1490, navn: 'Sone 2 (25–50 km)' },
  { maksKm: 100, pris: 2290, navn: 'Sone 3 (50–100 km)' },
  { maksKm: 150, pris: 2990, navn: 'Sone 4 (100–150 km)' }
];

export const KATEGORIER = [
  { navn: 'Partytelt', bilde: '/uploads/hageselskap.webp', alt: 'Partytelt til leie' },
  { navn: 'Bord og stoler', bilde: '/uploads/bord-pyntet.jpg', alt: 'Bord og stoler til leie' },
  { navn: 'Gulv og lining', bilde: '/uploads/tregulv-montering.webp', alt: 'Tregulv og lining til partytelt' },
  { navn: 'Duker', bilde: '/uploads/duk-rundt-bord.png', alt: 'Duker til leie' },
  { navn: 'Lyd og lys', bilde: '/uploads/bryllup-gulv-lining.webp', alt: 'Lyd og lys til fest' },
  { navn: 'Sikringsutstyr', bilde: '/uploads/barnebursdag.webp', alt: 'Sikringsutstyr til telt' }
];

/* --- Prislogikk – delt mellom byggeskript og nettleser --- */

/** Fraktsone for en gitt kjørelengde. null = utenfor faste soner. */
export function sone(km) {
  return SONER.find(s => km <= s.maksKm) || null;
}

/** Pris for ett eksemplar gitt antall leiedager.
    1–4 dager koster det samme. Deretter +15 % per døgn, rundet til nærmeste 5 kr. */
export function enhetspris(p, dager) {
  if (p.fast) return p.fast;
  if (dager <= 4) return p.d;
  return Math.round(p.d * (1 + 0.15 * (dager - 4)) / 5) * 5;
}

/** "1 690 kr" – norsk tallformat med tynt mellomrom. */
export function kr(n) {
  return n.toLocaleString('nb-NO').replace(/ /g, ' ') + ' kr';
}

/** Fra-pris slik den vises i lister. */
export function fraPris(p) {
  return p.fast ? kr(p.fast) : 'Fra ' + kr(p.d);
}

export const finn = (id) => PRODUKTER.find(p => p.id === id);
