/* ===========================================================================
   Kommune → fraktsone.

   Sonen er en prisbeslutning, ikke en måling. Tallene under er kjøreavstand
   fra lageret til kommunesenteret, målt én gang som utgangspunkt – men det
   er sonen som gjelder, og den kan settes fritt.

   Vil du flytte en kommune til en annen sone, endre `sone` her. `km` er bare
   dokumentasjon på hvorfor forslaget ble som det ble.

   Kommuner som ikke står her får «pris på forespørsel». Det gjelder blant
   annet Vestfold og Telemark: Færder ligger 48 km unna i luftlinje, men
   216 km å kjøre, siden veien går rundt Oslofjorden.
   ======================================================================== */

export const KOMMUNESONER = [
  { navn: 'Halden', sone: 1, km: 20 },
  { navn: 'Sarpsborg', sone: 1, km: 22 },
  { navn: 'Aremark', sone: 2, km: 28 },
  { navn: 'Rakkestad', sone: 2, km: 34 },
  { navn: 'Fredrikstad', sone: 2, km: 39 },
  { navn: 'Råde', sone: 2, km: 44 },
  { navn: 'Skiptvet', sone: 3, km: 52 },
  { navn: 'Hvaler', sone: 3, km: 53 },
  { navn: 'Moss', sone: 3, km: 55 },
  { navn: 'Våler', sone: 3, km: 60 },
  { navn: 'Marker', sone: 3, km: 66 },
  { navn: 'Indre Østfold', sone: 3, km: 70 },
  { navn: 'Vestby', sone: 3, km: 72 },
  { navn: 'Ås', sone: 3, km: 84 },
  { navn: 'Frogn', sone: 3, km: 93 },
  { navn: 'Enebakk', sone: 3, km: 99 },
  { navn: 'Nordre Follo', sone: 3, km: 100 },
  { navn: 'Aurskog-Høland', sone: 4, km: 103 },
  { navn: 'Nesodden', sone: 4, km: 104 },
  { navn: 'Asker', sone: 4, km: 109 },
  { navn: 'Oslo', sone: 4, km: 120 },
  { navn: 'Lørenskog', sone: 4, km: 127 },
  { navn: 'Bærum', sone: 4, km: 134 },
  { navn: 'Rælingen', sone: 4, km: 136 },
  { navn: 'Lier', sone: 4, km: 137 },
  { navn: 'Nittedal', sone: 4, km: 138 },
  { navn: 'Lillestrøm', sone: 4, km: 140 },
  { navn: 'Drammen', sone: 4, km: 141 },
  { navn: 'Gjerdrum', sone: 4, km: 141 },
  { navn: 'Eidskog', sone: 4, km: 150 },
];

/** Slår opp sone for en kommune. Returnerer null når vi ikke kjører dit fast. */
export function soneForKommune(kommune) {
  if (!kommune) return null;
  const k = kommune.trim().toLowerCase();
  const treff = KOMMUNESONER.find(x => x.navn.toLowerCase() === k);
  return treff ? treff.sone : null;
}
